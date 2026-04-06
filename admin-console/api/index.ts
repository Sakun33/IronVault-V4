import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";
import { Pool } from "pg";

// ── Auth config ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "admin-secret-change-in-prod";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD_HASH = crypto
  .createHash("sha256")
  .update(process.env.ADMIN_PASSWORD || "admin123")
  .digest("hex");

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
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const b = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() / 1000 + 86400 })).toString("base64url");
  const s = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest("base64url");
  return `${h}.${b}.${s}`;
}

function verifyJWT(token: string): object | null {
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

// ── Static data ───────────────────────────────────────────────────────────────
const PLANS = [
  { id: "free",     name: "Free",     price: 0,   interval: null,    features: ["5 vaults", "100MB storage"] },
  { id: "pro",      name: "Pro",      price: 9.99, interval: "month", features: ["Unlimited vaults", "10GB storage", "Priority support"] },
  { id: "family",   name: "Family",   price: 14.99, interval: "month", features: ["6 members", "50GB storage", "Priority support"] },
  { id: "lifetime", name: "Lifetime", price: 99,  interval: null,    features: ["Everything in Pro", "Lifetime access", "All future features"] },
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

  // ── Public customer registration ────────────────────────────────────────────
  if (path === "/api/public/customers/register" && method === "POST") {
    const { email, fullName, country, platform, planType } = (req.body as Record<string, string>) || {};
    if (!email) return res.status(400).json({ error: "email required" });
    try {
      const { rows } = await db.query(
        `INSERT INTO customers (email, full_name, country, platform, plan_type, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name, country = EXCLUDED.country,
           platform = EXCLUDED.platform, updated_at = NOW()
         RETURNING *`,
        [email, fullName || null, country || null, platform || null, planType || "free"]
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

  // ── GET /api/customers/export/csv ──────────────────────────────────────────
  if (path === "/api/customers/export/csv" && method === "GET") {
    try {
      const { rows } = await db.query(`SELECT * FROM customers ORDER BY created_at DESC`);
      const header = "id,email,full_name,country,platform,plan_type,status,created_at\n";
      const csv = rows.map(r =>
        [r.id, r.email, r.full_name || "", r.country || "", r.platform || "", r.plan_type, r.status, r.created_at].join(",")
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=customers.csv");
      return res.status(200).send(header + csv);
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── GET /api/customers ──────────────────────────────────────────────────────
  if (path === "/api/customers" && method === "GET") {
    try {
      const { rows, rowCount } = await db.query(`SELECT * FROM customers ORDER BY created_at DESC`);
      return res.json({ customers: rows, total: rowCount });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }

  // ── GET /api/customers/:id ──────────────────────────────────────────────────
  const customerMatch = path.match(/^\/api\/customers\/([^/]+)$/);
  if (customerMatch) {
    const id = customerMatch[1];

    if (method === "GET") {
      try {
        const { rows } = await db.query(`SELECT * FROM customers WHERE id = $1`, [id]);
        if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
        return res.json(rows[0]);
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }

    if (method === "PUT") {
      const { plan_type, status, full_name, country, platform, app_version } = req.body || {};
      const updates: string[] = [];
      const values: any[] = [];
      let i = 1;
      if (plan_type    !== undefined) { updates.push(`plan_type = $${i++}`);    values.push(plan_type); }
      if (status       !== undefined) { updates.push(`status = $${i++}`);       values.push(status); }
      if (full_name    !== undefined) { updates.push(`full_name = $${i++}`);    values.push(full_name); }
      if (country      !== undefined) { updates.push(`country = $${i++}`);      values.push(country); }
      if (platform     !== undefined) { updates.push(`platform = $${i++}`);     values.push(platform); }
      if (app_version  !== undefined) { updates.push(`app_version = $${i++}`);  values.push(app_version); }
      if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
      updates.push(`updated_at = NOW()`);
      values.push(id);
      try {
        const { rows } = await db.query(
          `UPDATE customers SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
          values
        );
        if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
        return res.json(rows[0]);
      } catch (err: any) { return res.status(500).json({ error: err.message }); }
    }

    if (method === "DELETE") {
      try {
        const { rowCount } = await db.query(`DELETE FROM customers WHERE id = $1`, [id]);
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
      const { rows } = await db.query(`SELECT id, email, plan_type, status FROM customers WHERE id = $1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
      return res.json({ plan_type: rows[0].plan_type, status: rows[0].status });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  }
  if (subMatch && method === "PUT") {
    const id = subMatch[1];
    const { plan_type } = req.body || {};
    if (!plan_type) return res.status(400).json({ error: "plan_type required" });
    try {
      const { rows } = await db.query(
        `UPDATE customers SET plan_type = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [plan_type, id]
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
        const { rows: cRows } = await db.query(`SELECT id FROM customers WHERE email=$1 LIMIT 1`, [customer_email]);
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

  // ── GET /api/audit-log / /api/admin-logs ────────────────────────────────────
  if (path === "/api/audit-log" || path === "/api/admin-logs") return res.json([]);

  // ── GET /api/activity-feed ──────────────────────────────────────────────────
  if (path.startsWith("/api/activity-feed")) return res.json([]);

  // ── GET /api/dashboard/kpis ────────────────────────────────────────────────
  if (path === "/api/dashboard/kpis" && method === "GET") {
    try {
      const { rows } = await db.query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE plan_type='trial') AS trials FROM customers`
      );
      return res.json({ totalCustomers: parseInt(rows[0].total, 10), activeTrials: parseInt(rows[0].trials, 10), mrr: 0, churn: 0 });
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
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE plan_type='trial') AS trials FROM customers`
      );
      const { rows: tRows } = await db.query(
        `SELECT COUNT(*) AS open_tickets FROM tickets WHERE status='open'`
      );
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
