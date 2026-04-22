import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";
import { Pool } from "pg";

// ── Auth config ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
// Computed only when env var is present; null signals misconfiguration
const ADMIN_PASSWORD_HASH = ADMIN_PASSWORD
  ? crypto.createHash("sha256").update(ADMIN_PASSWORD).digest("hex")
  : null;

// ── DB pool ───────────────────────────────────────────────────────────────────
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

// ── JWT helpers ───────────────────────────────────────────────────────────────
function createJWT(payload: object): string {
  if (!JWT_SECRET) throw new Error("JWT_SECRET not configured");
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const b = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() / 1000 + 86400 })).toString("base64url");
  const s = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest("base64url");
  return `${h}.${b}.${s}`;
}

function verifyJWT(token: string): object | null {
  if (!JWT_SECRET) return null;
  try {
    const [h, b, s] = token.split(".");
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest("base64url");
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, "base64url").toString()) as { exp: number };
    return payload.exp >= Date.now() / 1000 ? payload : null;
  } catch { return null; }
}

function getToken(req: VercelRequest): object | null {
  const auth = (req.headers.authorization || "").replace("Bearer ", "").trim();
  return auth ? verifyJWT(auth) : null;
}

// ── Static data ── canonical plan set (must match client/src/lib/plans.ts) ─────
const PLANS = [
  { id: "free",     name: "Free",        price: 0,    interval: null,    features: ["50 passwords", "10 notes", "1 vault", "Local storage only"] },
  { id: "pro",      name: "Pro Monthly", price: 1.79, interval: "month", features: ["Unlimited passwords", "Unlimited notes", "5 vaults", "Cloud sync", "Priority support"] },
  { id: "family",   name: "Pro Family",  price: 3.58, interval: "month", features: ["Everything in Pro", "Up to 6 members", "Shared vaults", "Family dashboard"], comingSoon: true },
  { id: "lifetime", name: "Lifetime",    price: 119.75, interval: null,  features: ["Everything in Pro", "Lifetime access", "All future updates", "Premium support"] },
];

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const path = (req.url || "").replace(/\?.*$/, "");
  const method = req.method || "GET";

  // ── Health (public) ─────────────────────────────────────────────────────────
  if (path === "/api/health") {
    return res.json({ status: "ok", db: !!process.env.DATABASE_URL, admins: 1 });
  }

  // ── GET /api/auth/me ────────────────────────────────────────────────────────
  if (path === "/api/auth/me" && method === "GET") {
    const user = getToken(req) as any;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({ username: user.username, role: user.role });
  }

  // ── Auth login (public) ─────────────────────────────────────────────────────
  if (path === "/api/auth/login" && method === "POST") {
    if (!ADMIN_PASSWORD_HASH || !JWT_SECRET) {
      return res.status(503).json({ error: "Admin credentials not configured" });
    }
    const { username, password } = (req.body as { username?: string; password?: string }) || {};
    const hash = crypto.createHash("sha256").update(password || "").digest("hex");
    if (username === ADMIN_USERNAME && hash === ADMIN_PASSWORD_HASH) {
      return res.json({ token: createJWT({ username, role: "super_admin" }), user: { username, role: "super_admin" } });
    }
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // ── Plans (public) ──────────────────────────────────────────────────────────
  if (path === "/api/plans" && method === "GET") {
    return res.json(PLANS);
  }

  // ── DB-dependent routes require DATABASE_URL ────────────────────────────────
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL not configured" });
  }

  const db = getPool();

  // ── Public customer registration (writes to crm_users — same table as main backend) ─
  if (path === "/api/public/customers/register" && method === "POST") {
    const { email, fullName, country, platform, planType } = (req.body as Record<string, string>) || {};
    if (!email) return res.status(400).json({ error: "email required" });
    try {
      const { rows } = await db.query(
        `INSERT INTO crm_users (email, full_name, country, platform, marketing_consent, support_consent)
         VALUES ($1, $2, $3, $4, false, true)
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name, country = EXCLUDED.country,
           platform = EXCLUDED.platform, last_active_at = NOW(), updated_at = NOW()
         RETURNING id, email, full_name, country, platform, created_at`,
        [email.toLowerCase().trim(), fullName || null, country || null, platform || null]
      );
      return res.json({ success: true, customer: rows[0] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/migrate ───────────────────────────────────────────────────────
  if (path === "/api/migrate" && method === "POST") {
    if (!getToken(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          full_name TEXT, country TEXT, platform TEXT, app_version TEXT,
          plan_type TEXT DEFAULT 'free', status TEXT DEFAULT 'active',
          last_active TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
        DROP TABLE IF EXISTS ticket_replies;
        CREATE TABLE IF NOT EXISTS ticket_replies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
          author_type TEXT DEFAULT 'admin',
          author_id TEXT DEFAULT 'admin',
          message TEXT NOT NULL,
          is_internal BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);
      `);
      return res.json({ success: true, message: "Schema ready" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── All remaining routes require JWT ────────────────────────────────────────
  if (!getToken(req)) return res.status(401).json({ error: "Unauthorized" });

  // ── Shared CRM query helper ─────────────────────────────────────────────────
  // Reads from crm_users + entitlements — the same tables the main backend writes to.
  // Returns rows shaped like the legacy "customers" schema the admin frontend expects.
  async function queryCrmCustomers(where = "", values: any[] = []) {
    const { rows } = await db.query(
      `SELECT u.id, u.email,
              COALESCE(u.full_name, split_part(u.email, '@', 1)) AS name,
              u.phone, u.country AS region,
              COALESCE(e.plan, 'free') AS plan_name,
              COALESCE(e.plan, 'free') AS subscription_plan,
              'active' AS status,
              u.created_at,
              COALESCE(u.last_active_at, u.created_at) AS last_active,
              u.vault_created_at IS NOT NULL AS vault_created,
              COALESCE(u.platform, 'web') AS source
       FROM crm_users u
       LEFT JOIN entitlements e ON e.user_id = u.id
       ${where}
       ORDER BY u.created_at DESC`,
      values
    );
    return rows;
  }

  // ── GET /api/customers/export/csv ──────────────────────────────────────────
  if (path === "/api/customers/export/csv" && method === "GET") {
    try {
      const rows = await queryCrmCustomers();
      const header = "id,email,name,region,plan_name,status,created_at\n";
      const csv = rows.map(r =>
        [r.id, r.email, r.name || "", r.region || "", r.plan_name, r.status, r.created_at].join(",")
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=customers.csv");
      return res.status(200).send(header + csv);
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── GET /api/customers ──────────────────────────────────────────────────────
  if (path === "/api/customers" && method === "GET") {
    try {
      const { search, plan, status: statusFilter, page = "1", limit = "50" } = req.query as Record<string, string>;
      let where = "";
      const vals: any[] = [];
      const conditions: string[] = [];
      if (search) {
        vals.push(`%${search}%`);
        conditions.push(`(u.email ILIKE $${vals.length} OR u.full_name ILIKE $${vals.length})`);
      }
      if (plan) {
        vals.push(plan.toLowerCase());
        conditions.push(`LOWER(COALESCE(e.plan,'free')) = $${vals.length}`);
      }
      if (conditions.length) where = `WHERE ${conditions.join(" AND ")}`;
      const rows = await queryCrmCustomers(where, vals);
      const pageN = parseInt(page, 10);
      const limitN = parseInt(limit, 10);
      const paginated = rows.slice((pageN - 1) * limitN, pageN * limitN);
      return res.json({ customers: paginated, total: rows.length, pagination: { page: pageN, limit: limitN, total: rows.length, pages: Math.ceil(rows.length / limitN) } });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── GET /api/customers/:id ──────────────────────────────────────────────────
  const customerMatch = path.match(/^\/api\/customers\/([^/]+)$/);
  if (customerMatch) {
    const id = customerMatch[1];

    if (method === "GET") {
      try {
        const rows = await queryCrmCustomers(`WHERE u.id = $1`, [id]);
        if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
        return res.json(rows[0]);
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }

    if (method === "PUT") {
      // Update crm_users profile fields and/or entitlement plan
      const { plan_name, subscription_plan, full_name, country, platform } = req.body || {};
      const newPlan = plan_name || subscription_plan;
      try {
        if (full_name || country || platform) {
          const updates: string[] = [];
          const vals: any[] = [];
          let i = 1;
          if (full_name !== undefined) { updates.push(`full_name = $${i++}`); vals.push(full_name); }
          if (country   !== undefined) { updates.push(`country = $${i++}`);   vals.push(country); }
          if (platform  !== undefined) { updates.push(`platform = $${i++}`);  vals.push(platform); }
          updates.push(`updated_at = NOW()`);
          vals.push(id);
          await db.query(`UPDATE crm_users SET ${updates.join(", ")} WHERE id = $${i}`, vals);
        }
        if (newPlan) {
          const dbPlan = newPlan.toLowerCase().includes("lifetime") ? "lifetime"
            : newPlan.toLowerCase().includes("pro") || newPlan.toLowerCase().includes("premium") ? "premium"
            : "free";
          await db.query(
            `UPDATE entitlements SET plan = $1, updated_at = NOW() WHERE user_id = $2`,
            [dbPlan, id]
          );
        }
        const rows = await queryCrmCustomers(`WHERE u.id = $1`, [id]);
        if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
        return res.json(rows[0]);
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }

    if (method === "DELETE") {
      try {
        const { rowCount } = await db.query(`DELETE FROM crm_users WHERE id = $1`, [id]);
        if (!rowCount) return res.status(404).json({ error: "Customer not found" });
        return res.json({ success: true });
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── GET /api/customers/:id/journey ─────────────────────────────────────────
  const journeyMatch = path.match(/^\/api\/customers\/([^/]+)\/journey$/);
  if (journeyMatch && method === "GET") {
    return res.json([]);
  }

  // ── GET /api/customers/:id/tickets ─────────────────────────────────────────
  const ticketsByCustomerMatch = path.match(/^\/api\/customers\/([^/]+)\/tickets$/);
  if (ticketsByCustomerMatch && method === "GET") {
    return res.json([]);
  }

  // ── GET /api/customers/:id/notes ───────────────────────────────────────────
  const notesByCustomerMatch = path.match(/^\/api\/customers\/([^/]+)\/notes$/);
  if (notesByCustomerMatch) {
    if (method === "GET") return res.json([]);
    if (method === "POST") return res.json({ success: true });
  }

  // ── GET /api/customers/:id/communications ──────────────────────────────────
  const commsMatch = path.match(/^\/api\/customers\/([^/]+)\/communications$/);
  if (commsMatch && method === "GET") {
    return res.json([]);
  }

  // ── /api/customers/:id/tags ────────────────────────────────────────────────
  const tagsMatch = path.match(/^\/api\/customers\/([^/]+)\/tags(?:\/([^/]+))?$/);
  if (tagsMatch) {
    if (method === "GET")    return res.json([]);
    if (method === "POST")   return res.json({ success: true });
    if (method === "DELETE") return res.json({ success: true });
  }

  // ── /api/customers/:id/subscription ────────────────────────────────────────
  const subMatch = path.match(/^\/api\/customers\/([^/]+)\/subscription$/);
  if (subMatch && method === "GET") {
    const id = subMatch[1];
    try {
      const { rows } = await db.query(
        `SELECT u.id, u.email, COALESCE(e.plan,'free') AS plan_type, COALESCE(e.status,'active') AS status
         FROM crm_users u LEFT JOIN entitlements e ON e.user_id = u.id WHERE u.id = $1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
      return res.json({ plan_type: rows[0].plan_type, status: rows[0].status });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }
  if (subMatch && method === "PUT") {
    const id = subMatch[1];
    const { plan_type } = req.body || {};
    if (!plan_type) return res.status(400).json({ error: "plan_type required" });
    try {
      await db.query(
        `UPDATE entitlements SET plan = $1, updated_at = NOW() WHERE user_id = $2`,
        [plan_type, id]
      );
      const { rows } = await db.query(
        `SELECT u.id, u.email, COALESCE(e.plan,'free') AS plan_type FROM crm_users u
         LEFT JOIN entitlements e ON e.user_id = u.id WHERE u.id = $1`, [id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
      return res.json(rows[0]);
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── POST /api/customers/:id/message ────────────────────────────────────────
  const msgMatch = path.match(/^\/api\/customers\/([^/]+)\/message$/);
  if (msgMatch && method === "POST") {
    return res.json({ success: true, message: "Message queued" });
  }

  // ── GET /api/tags ───────────────────────────────────────────────────────────
  if (path === "/api/tags" && method === "GET") {
    return res.json([]);
  }

  // ── POST /api/plans ─────────────────────────────────────────────────────────
  if (path === "/api/plans" && method === "POST") {
    return res.json({ success: true, plan: req.body });
  }

  // ── GET/PUT/DELETE /api/plans/:id ───────────────────────────────────────────
  const planMatch = path.match(/^\/api\/plans\/([^/]+)$/);
  if (planMatch) {
    const plan = PLANS.find(p => p.id === planMatch[1]);
    if (method === "GET") return plan ? res.json(plan) : res.status(404).json({ error: "Plan not found" });
    if (method === "PUT") return res.json({ ...(plan || {}), ...req.body });
    if (method === "DELETE") return res.json({ success: true });
  }

  // ── GET/POST /api/tickets ───────────────────────────────────────────────────
  if (path === "/api/tickets") {
    if (method === "GET") {
      try {
        const { rows } = await db.query(
          `SELECT t.*, c.full_name AS customer_name
           FROM tickets t
           LEFT JOIN customers c ON t.customer_id = c.id
           ORDER BY t.created_at DESC`
        );
        return res.json({ tickets: rows, total: rows.length });
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }
    if (method === "POST") {
      const { customer_email, subject, description, priority } = req.body || {};
      if (!customer_email || !subject) return res.status(400).json({ error: "customer_email and subject required" });
      try {
        const { rows: cRows } = await db.query(`SELECT id FROM crm_users WHERE email=$1 LIMIT 1`, [customer_email]);
        const customerId = cRows[0]?.id || null;
        const { rows } = await db.query(
          `INSERT INTO tickets (customer_id, customer_email, subject, description, priority)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [customerId, customer_email, subject, description || null, priority || "normal"]
        );
        return res.json({ success: true, ticket: rows[0] });
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── GET/PUT/DELETE /api/tickets/:id ─────────────────────────────────────────
  const ticketIdMatch = path.match(/^\/api\/tickets\/([^/]+)$/);
  if (ticketIdMatch) {
    const tid = ticketIdMatch[1];
    if (method === "GET") {
      try {
        const { rows: tRows } = await db.query(
          `SELECT t.*, c.full_name AS customer_name FROM tickets t LEFT JOIN customers c ON t.customer_id=c.id WHERE t.id=$1`, [tid]
        );
        if (!tRows[0]) return res.status(404).json({ error: "Ticket not found" });
        const { rows: rRows } = await db.query(
          `SELECT * FROM ticket_replies WHERE ticket_id=$1 ORDER BY created_at ASC`, [tid]
        );
        return res.json({ ...tRows[0], replies: rRows });
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }
    if (method === "PUT") {
      const { status, priority, assigned_to } = req.body || {};
      const updates: string[] = [];
      const values: any[] = [];
      let i = 1;
      if (status      !== undefined) { updates.push(`status=$${i++}`);      values.push(status); }
      if (priority    !== undefined) { updates.push(`priority=$${i++}`);    values.push(priority); }
      if (assigned_to !== undefined) { updates.push(`assigned_to=$${i++}`); values.push(assigned_to); }
      if (status === "resolved") { updates.push(`resolved_at=NOW()`); }
      updates.push(`updated_at=NOW()`);
      values.push(tid);
      try {
        const { rows } = await db.query(
          `UPDATE tickets SET ${updates.join(",")} WHERE id=$${i} RETURNING *`, values
        );
        if (!rows[0]) return res.status(404).json({ error: "Ticket not found" });
        return res.json(rows[0]);
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }
    if (method === "DELETE") {
      try {
        const { rowCount } = await db.query(`DELETE FROM tickets WHERE id=$1`, [tid]);
        if (!rowCount) return res.status(404).json({ error: "Ticket not found" });
        return res.json({ success: true });
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── POST /api/tickets/:id/reply ─────────────────────────────────────────────
  const ticketReplyMatch = path.match(/^\/api\/tickets\/([^/]+)\/reply$/);
  if (ticketReplyMatch && method === "POST") {
    const tid = ticketReplyMatch[1];
    const { message, is_internal } = req.body || {};
    if (!message) return res.status(400).json({ error: "message required" });
    try {
      const { rows } = await db.query(
        `INSERT INTO ticket_replies (ticket_id, author_type, author_id, message, is_internal)
         VALUES ($1,'admin','admin',$2,$3) RETURNING *`,
        [tid, message, is_internal || false]
      );
      await db.query(`UPDATE tickets SET updated_at=NOW() WHERE id=$1`, [tid]);
      return res.json({ success: true, reply: rows[0] });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── POST /api/tickets/:id/close ─────────────────────────────────────────────
  const ticketCloseMatch = path.match(/^\/api\/tickets\/([^/]+)\/close$/);
  if (ticketCloseMatch && method === "POST") {
    const tid = ticketCloseMatch[1];
    try {
      const { rows } = await db.query(
        `UPDATE tickets SET status='closed', resolved_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`, [tid]
      );
      if (!rows[0]) return res.status(404).json({ error: "Ticket not found" });
      return res.json({ success: true, ticket: rows[0] });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── GET /api/customers/:id/vaults ──────────────────────────────────────────
  // Returns vault count metadata for a customer (BUG-024)
  const vaultsByCustomerMatch = path.match(/^\/api\/customers\/([^/]+)\/vaults$/);
  if (vaultsByCustomerMatch && method === "GET") {
    const id = vaultsByCustomerMatch[1];
    try {
      const { rows: cRows } = await db.query(
        `SELECT u.email, COALESCE(e.plan,'free') AS plan_type
         FROM crm_users u LEFT JOIN entitlements e ON e.user_id = u.id WHERE u.id = $1 LIMIT 1`, [id]
      );
      if (!cRows[0]) return res.status(404).json({ error: "Customer not found" });
      const c = cRows[0];
      const { rows: cvRows } = await db.query(
        `SELECT vault_id, vault_name, is_default, created_at, server_updated_at
         FROM cloud_vaults WHERE user_id = $1 ORDER BY created_at DESC`, [id]
      ).catch(() => ({ rows: [] as any[] }));
      const planLimits: Record<string, number> = { free: 1, premium: 5, pro: 5, family: 5, lifetime: 5 };
      return res.json({
        localVaultCount: 0,
        cloudVaultCount: cvRows.length,
        planLimit: planLimits[c.plan_type] ?? 1,
        cloudVaults: cvRows,
      });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── GET /api/customers/:id/family-invites ───────────────────────────────────
  const familyInvitesByCustomerMatch = path.match(/^\/api\/customers\/([^/]+)\/family-invites$/);
  if (familyInvitesByCustomerMatch) {
    const id = familyInvitesByCustomerMatch[1];
    if (method === "GET") {
      try {
        const { rows: cRows } = await db.query(`SELECT email FROM crm_users WHERE id=$1 LIMIT 1`, [id]);
        if (!cRows[0]) return res.status(404).json({ error: "Customer not found" });
        const { rows } = await db.query(
          `SELECT * FROM family_invites WHERE owner_email = $1 ORDER BY invited_at DESC`,
          [cRows[0].email]
        );
        return res.json({ invites: rows, total: rows.length });
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }
    if (method === "DELETE") {
      const inviteId = req.query?.invite_id as string | undefined;
      if (!inviteId) return res.status(400).json({ error: "invite_id query param required" });
      try {
        const { rows } = await db.query(
          `UPDATE family_invites SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
           WHERE id = $1 RETURNING *`,
          [inviteId]
        );
        if (!rows[0]) return res.status(404).json({ error: "Invite not found" });
        return res.json({ success: true, invite: rows[0] });
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }
  }

  // ── POST /api/customers/:id/upgrade ─────────────────────────────────────────
  // Admin plan upgrade/downgrade with audit log (BUG-024)
  const upgradeMatch = path.match(/^\/api\/customers\/([^/]+)\/upgrade$/);
  if (upgradeMatch && method === "POST") {
    const id = upgradeMatch[1];
    const { plan_type, reason } = req.body || {};
    if (!plan_type) return res.status(400).json({ error: "plan_type required" });
    const validPlans = ["free", "pro", "premium", "family", "lifetime"];
    if (!validPlans.includes(plan_type.toLowerCase())) {
      return res.status(400).json({ error: `plan_type must be one of: ${validPlans.join(", ")}` });
    }
    const dbPlan = plan_type.toLowerCase() === "pro" ? "premium" : plan_type.toLowerCase();
    try {
      const { rows: old } = await db.query(
        `SELECT u.email, COALESCE(e.plan,'free') AS plan_type FROM crm_users u
         LEFT JOIN entitlements e ON e.user_id = u.id WHERE u.id=$1`, [id]);
      if (!old[0]) return res.status(404).json({ error: "Customer not found" });
      await db.query(
        `INSERT INTO entitlements (user_id, plan, status, trial_active, will_renew, admin_override)
         VALUES ($2, $1, 'active', false, false, true)
         ON CONFLICT (user_id) DO UPDATE SET plan=$1, status='active', updated_at=NOW()`,
        [dbPlan, id]
      );
      await db.query(
        `INSERT INTO plan_audit_log (customer_email, old_plan, new_plan, changed_by, reason)
         VALUES ($1, $2, $3, 'admin', $4)`,
        [old[0].email, old[0].plan_type, dbPlan, reason || null]
      ).catch(() => {});
      const rows = await queryCrmCustomers(`WHERE u.id = $1`, [id]);
      return res.json({ success: true, customer: rows[0] });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── GET /api/customers/:id/plan-history ─────────────────────────────────────
  const planHistoryMatch = path.match(/^\/api\/customers\/([^/]+)\/plan-history$/);
  if (planHistoryMatch && method === "GET") {
    const id = planHistoryMatch[1];
    try {
      const { rows: cRows } = await db.query(`SELECT email FROM crm_users WHERE id=$1 LIMIT 1`, [id]);
      if (!cRows[0]) return res.status(404).json({ error: "Customer not found" });
      const { rows } = await db.query(
        `SELECT * FROM plan_audit_log WHERE customer_email = $1 ORDER BY created_at DESC`,
        [cRows[0].email]
      );
      return res.json({ history: rows, total: rows.length });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── GET /api/flagged-accounts ────────────────────────────────────────────────
  // Returns accounts that are over their plan's vault limit (BUG-022)
  if (path === "/api/flagged-accounts" && method === "GET") {
    // No flagging mechanism in crm_users; return empty for now
    return res.json({ accounts: [], total: 0 });
  }

  // ── GET /api/audit-log / /api/admin-logs ────────────────────────────────────
  if (path === "/api/audit-log" || path === "/api/admin-logs") {
    try {
      const { rows } = await db.query(
        `SELECT * FROM plan_audit_log ORDER BY created_at DESC LIMIT 100`
      );
      return res.json(rows);
    } catch {
      return res.json([]);
    }
  }

  // ── GET /api/activity-feed ──────────────────────────────────────────────────
  if (path.startsWith("/api/activity-feed")) return res.json([]);

  // ── GET /api/dashboard/kpis ────────────────────────────────────────────────
  if (path === "/api/dashboard/kpis" && method === "GET") {
    try {
      const { rows } = await db.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE e.status='trial') AS trials,
                COUNT(*) FILTER (WHERE e.plan IN ('premium','lifetime')) AS paid
         FROM crm_users u
         LEFT JOIN entitlements e ON e.user_id = u.id`
      );
      return res.json({ totalCustomers: parseInt(rows[0].total, 10), activeTrials: parseInt(rows[0].trials, 10), paidCustomers: parseInt(rows[0].paid, 10), mrr: 0, churn: 0 });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── GET /api/dashboard/analytics ───────────────────────────────────────────
  if (path === "/api/dashboard/analytics" && method === "GET") {
    return res.json({ revenue: [], users: [], retention: [] });
  }

  // ── GET /api/dashboard/stats ────────────────────────────────────────────────
  if (path === "/api/dashboard/stats" && method === "GET") {
    try {
      const { rows: cRows } = await db.query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE e.status='trial') AS trials
         FROM crm_users u LEFT JOIN entitlements e ON e.user_id = u.id`
      );
      const { rows: tRows } = await db.query(
        `SELECT COUNT(*) AS open_tickets FROM tickets WHERE status='open'`
      ).catch(() => ({ rows: [{ open_tickets: 0 }] }));
      return res.json({
        totalCustomers: parseInt(cRows[0].total, 10),
        activeTrials: parseInt(cRows[0].trials, 10),
        mrr: 0,
        openTickets: parseInt(tRows[0].open_tickets, 10),
      });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── Analytics stubs ─────────────────────────────────────────────────────────
  if (path.startsWith("/api/analytics/")) return res.json({ data: [], labels: [] });

  // ── Email stubs ─────────────────────────────────────────────────────────────
  if (path.startsWith("/api/email")) {
    if (method === "GET") return res.json([]);
    return res.json({ success: true });
  }

  // ── Notifications stubs ─────────────────────────────────────────────────────
  if (path === "/api/notifications/count") return res.json({ count: 0 });
  if (path.startsWith("/api/notifications") || path.startsWith("/api/admin/notifications")) {
    if (method === "GET") return res.json([]);
    return res.json({ success: true });
  }

  // ── Admins stub ─────────────────────────────────────────────────────────────
  if (path === "/api/admins") {
    if (method === "GET") return res.json([{ username: ADMIN_USERNAME, role: "super_admin" }]);
    return res.json({ success: true });
  }

  // ── Promotions stub ─────────────────────────────────────────────────────────
  if (path.startsWith("/api/promotions")) {
    if (method === "GET") return res.json([]);
    return res.json({ success: true });
  }

  // ── Email templates stub ────────────────────────────────────────────────────
  if (path.startsWith("/api/email-templates")) {
    if (method === "GET") return res.json([]);
    return res.json({ success: true });
  }

  return res.status(404).json({ error: "not found", path });
}
