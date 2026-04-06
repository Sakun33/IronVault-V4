import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  const path = (req.url || "").replace(/\?.*$/, "");

  // ── Health ──────────────────────────────────────────────────────────────────
  if (path === "/api/health" || path === "/api/health/") {
    return res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: "vercel",
      db: !!process.env.DATABASE_URL,
    });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL not configured" });
  }

  const db = getPool();

  // ── /api/crm/register ───────────────────────────────────────────────────────
  if (path === "/api/crm/register" && req.method === "POST") {
    const { email, fullName, country, platform, appVersion, planType } = req.body || {};
    if (!email) return res.status(400).json({ error: "email required" });

    try {
      const { rows } = await db.query(
        `INSERT INTO customers (email, full_name, country, platform, app_version, plan_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           country = EXCLUDED.country,
           platform = EXCLUDED.platform,
           app_version = EXCLUDED.app_version,
           updated_at = NOW()
         RETURNING id, email, plan_type`,
        [email, fullName || null, country || null, platform || null, appVersion || null, planType || "free"]
      );
      const row = rows[0];
      return res.json({ success: true, message: "Registration received", email, plan: row.plan_type, id: row.id });
    } catch (err: any) {
      console.error("register error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── /api/crm/entitlement/:userId ────────────────────────────────────────────
  if (path.startsWith("/api/crm/entitlement/")) {
    const userId = path.replace("/api/crm/entitlement/", "");
    if (!userId) return res.status(400).json({ error: "userId required" });

    try {
      const isUuid = /^[0-9a-f-]{36}$/i.test(userId);
      const col = isUuid ? "id" : "email";
      const { rows } = await db.query(
        `SELECT id, email, plan_type, status FROM customers WHERE ${col} = $1 LIMIT 1`,
        [userId]
      );
      if (!rows[0]) return res.json({ plan: "free", status: "active", trial_active: false });
      const row = rows[0];
      return res.json({
        plan: row.plan_type,
        status: row.status,
        trial_active: row.plan_type === "trial",
        id: row.id,
        email: row.email,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── /api/crm/heartbeat ──────────────────────────────────────────────────────
  if (path === "/api/crm/heartbeat" && req.method === "POST") {
    const { email, userId } = req.body || {};
    if (!email && !userId) return res.status(400).json({ error: "email or userId required" });

    try {
      const col = email ? "email" : "id";
      const val = email || userId;
      await db.query(
        `UPDATE customers SET last_active = NOW(), updated_at = NOW() WHERE ${col} = $1`,
        [val]
      );
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── /api/crm/vaults/sync ────────────────────────────────────────────────────
  if (path === "/api/crm/vaults/sync" && req.method === "POST") {
    const { userId, email, vaultCount } = req.body || {};
    if (!userId && !email) return res.status(400).json({ error: "userId or email required" });
    try {
      const col = userId ? "id" : "email";
      const val = userId || email;
      await db.query(
        `UPDATE customers SET last_active = NOW(), updated_at = NOW() WHERE ${col} = $1`,
        [val]
      );
      return res.json({ success: true, vaultCount: vaultCount || 0, synced: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/crm/tickets ────────────────────────────────────────────────────
  if (path === "/api/crm/tickets" && req.method === "POST") {
    const { email, subject, description, priority } = req.body || {};
    if (!email || !subject) return res.status(400).json({ error: "email and subject required" });
    try {
      // Look up customer_id (optional — ticket can exist without a customer row)
      const { rows: cRows } = await db.query(
        `SELECT id FROM customers WHERE email = $1 LIMIT 1`, [email]
      );
      const customerId = cRows[0]?.id || null;
      const { rows } = await db.query(
        `INSERT INTO tickets (customer_id, customer_email, subject, description, priority)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [customerId, email, subject, description || null, priority || "normal"]
      );
      return res.json({ success: true, ticket: rows[0] });
    } catch (err: any) {
      console.error("ticket create error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/crm/tickets/:email ──────────────────────────────────────────────
  if (path.startsWith("/api/crm/tickets/") && req.method === "GET") {
    const email = decodeURIComponent(path.replace("/api/crm/tickets/", ""));
    if (!email) return res.status(400).json({ error: "email required" });
    try {
      const { rows } = await db.query(
        `SELECT * FROM tickets WHERE customer_email = $1 ORDER BY created_at DESC`, [email]
      );
      return res.json({ tickets: rows, total: rows.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: "endpoint not found", path });
}
