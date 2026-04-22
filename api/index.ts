import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";
import { createHmac } from "crypto";
import nodemailer from "nodemailer";

// ── Zoho SMTP email service ────────────────────────────────────────────────────
const _FROM_ADDR = 'saket@ironvault.app';
const _FROM_NAME = 'IronVault';
const _APP_URL   = process.env.APP_URL || 'https://www.ironvault.app';
const emailConfigured = !!process.env.ZOHO_MAIL_PASSWORD;

function _getTransporter() {
  return nodemailer.createTransport({
    host: 'smtppro.zoho.in',
    port: 465,
    secure: true,
    auth: { user: _FROM_ADDR, pass: process.env.ZOHO_MAIL_PASSWORD },
  });
}

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!emailConfigured) { console.warn('[email] ZOHO_MAIL_PASSWORD not set, skip →', to); return false; }
  try {
    const result = await _getTransporter().sendMail({
      from: `"${_FROM_NAME}" <${_FROM_ADDR}>`,
      to, subject, html,
    });
    console.log('[email] sent:', subject, '→', to, result.messageId);
    return true;
  } catch (e: any) { console.error('[email] Zoho send error', e.message); return false; }
}
function _emailLayout(icon: string, bg: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#0f0f13;font-family:-apple-system,sans-serif"><div style="max-width:480px;margin:0 auto;background:#1a1a24;border-radius:16px;padding:36px;border:1px solid #2a2a3a"><div style="text-align:center;margin-bottom:24px"><div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:${bg}"><span style="font-size:26px">${icon}</span></div></div>${body}<hr style="border:none;border-top:1px solid #2a2a3a;margin:28px 0 18px"><p style="margin:0;text-align:center;font-size:11px;color:#475569">© 2026 IronVault &nbsp;·&nbsp;<a href="mailto:saket@ironvault.app" style="color:#6366f1;text-decoration:none">saket@ironvault.app</a></p></div></body></html>`;
}
function _eh1(t: string) { return `<h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#f1f5f9;text-align:center">${t}</h1>`; }
function _ep(t: string)  { return `<p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#94a3b8;text-align:center">${t}</p>`; }
function _ebtn(u: string, l: string) { return `<a href="${u}" style="display:block;text-align:center;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px">${l}</a>`; }
function _ecard(i: string) { return `<div style="background:rgba(255,255,255,.04);border:1px solid #2a2a3a;border-radius:12px;padding:16px;margin-bottom:22px">${i}</div>`; }
function welcomeEmail(name: string) { return { subject: 'Welcome to IronVault 🛡', html: _emailLayout('🛡','rgba(99,102,241,.15)',`${_eh1(`Welcome to IronVault, ${name||'there'}!`)}${_ep('Your secure vault is ready. All your data is AES-256 encrypted and stored locally.')}${_ecard(`<p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Getting started</p><ul style="margin:0;padding-left:18px;color:#e2e8f0;font-size:13px;line-height:2.2"><li>Create your vault and master password</li><li>Add passwords, notes, reminders</li><li>Track subscriptions and expenses</li></ul>`)}${_ebtn(_APP_URL,'Open IronVault')}`)}; }
function passwordResetEmail(link: string) { return { subject: 'Reset your IronVault password', html: _emailLayout('🔑','rgba(239,68,68,.1)',`${_eh1('Reset your password')}${_ep('Click below to set a new password. This link expires in <strong style="color:#e2e8f0">1 hour</strong>.')}${_ebtn(link,'Reset Password')}<p style="margin:14px 0 0;text-align:center;font-size:12px;color:#64748b">If you didn't request this, ignore this email.</p><p style="margin:6px 0 0;text-align:center;font-size:11px;word-break:break-all"><a href="${link}" style="color:#6366f1">${link}</a></p>`)}; }
function ticketConfirmationEmail(sub: string, id: string|number) { return { subject: `[IronVault Support] Ticket received: ${sub}`, html: _emailLayout('✅','rgba(34,197,94,.1)',`${_eh1('We received your ticket')}${_ep('Our support team will get back to you within 24 hours.')}${_ecard(`<p style="margin:0 0 4px;font-size:11px;color:#64748b">Ticket #${id}</p><p style="margin:0;font-size:14px;font-weight:600;color:#f1f5f9">${sub}</p>`)}<a href="mailto:saket@ironvault.app" style="display:block;text-align:center;background:rgba(99,102,241,.12);color:#6366f1;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px;border:1px solid rgba(99,102,241,.25)">Reply via Email</a>`)}; }
function ticketReplyEmail(id: string|number, preview: string) { return { subject: `[IronVault Support] Update on ticket #${id}`, html: _emailLayout('💬','rgba(99,102,241,.15)',`${_eh1('New reply on your ticket')}${_ep(`New response on ticket <strong style="color:#e2e8f0">#${id}</strong>.`)}${_ecard(`<p style="margin:0;font-size:13px;color:#94a3b8;font-style:italic">"${String(preview).slice(0,200)}"</p>`)}<a href="mailto:saket@ironvault.app" style="display:block;text-align:center;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px">Reply</a>`)}; }
function ticketClosedEmail(id: string|number) { return { subject: `[IronVault Support] Ticket #${id} resolved`, html: _emailLayout('✔️','rgba(34,197,94,.1)',`${_eh1('Ticket resolved')}${_ep(`Ticket <strong style="color:#e2e8f0">#${id}</strong> has been resolved. Reply to this email if you need further help.`)}<a href="mailto:saket@ironvault.app" style="display:block;text-align:center;background:rgba(99,102,241,.12);color:#6366f1;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px;border:1px solid rgba(99,102,241,.25)">Contact Support Again</a>`)}; }
function planUpgradeEmail(plan: string) { const label = plan==='lifetime'?'Lifetime':plan==='family'?'Family':'Pro'; return { subject: `You're now on IronVault ${label} ⭐`, html: _emailLayout('⭐','rgba(245,158,11,.1)',`${_eh1(`Welcome to ${label}!`)}${_ep(`Your account has been upgraded to <strong style="color:#e2e8f0">${label}</strong>. All premium features are now unlocked.`)}${_ebtn(_APP_URL,'Open IronVault')}`)}; }
// ── End email service ──────────────────────────────────────────────────────────

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

const ALLOWED_ORIGINS = [
  'https://www.ironvault.app',
  'https://ironvault.app',
  'capacitor://localhost',   // Capacitor iOS native
  'http://localhost',        // Capacitor Android native
  'https://localhost',       // Capacitor Android (HTTPS mode)
];

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // Same-origin or server-to-server requests (no Origin header)
    res.setHeader("Access-Control-Allow-Origin", "https://www.ironvault.app");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
  res.setHeader("Vary", "Origin");
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

  // ── /api/crm/notify — internal endpoint for admin→app email triggers ─────────
  if (path === "/api/crm/notify" && req.method === "POST") {
    const secret = req.headers["x-notify-secret"] as string | undefined;
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || secret !== jwtSecret) return res.status(401).json({ error: "Unauthorized" });
    const { type, email: toEmail, data } = req.body || {};
    if (!toEmail || !type) return res.status(400).json({ error: "type and email required" });
    if (type === "plan_upgrade" && data?.plan) {
      const tmpl = planUpgradeEmail(data.plan);
      sendEmail({ to: toEmail, ...tmpl }).catch(() => {});
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: "unknown notification type" });
  }

  // ── /api/crm/register ───────────────────────────────────────────────────────
  if (path === "/api/crm/register" && req.method === "POST") {
    const { email, fullName, country, platform, appVersion, planType } = req.body || {};
    if (!email) return res.status(400).json({ error: "email required" });
    const safeFullName = fullName ? stripHtml(String(fullName)) : null;

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
        [email, safeFullName, country || null, platform || null, appVersion || null, planType || "free"]
      );
      const row = rows[0];
      // Send welcome email (fire-and-forget — non-critical)
      if (row) {
        const tmpl = welcomeEmail(safeFullName || email.split('@')[0]);
        sendEmail({ to: email, ...tmpl }).catch(() => {});
      }
      return res.json({ success: true, message: "Registration received", email, plan: row.plan_type, id: row.id });
    } catch (err: any) {
      console.error("register error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── /api/crm/entitlement/:userId ────────────────────────────────────────────
  if (path.startsWith("/api/crm/entitlement/")) {
    const userId = decodeURIComponent(path.replace("/api/crm/entitlement/", ""));
    if (!userId) return res.status(400).json({ error: "userId required" });

    try {
      const isUuid = /^[0-9a-f-]{36}$/i.test(userId);
      const col = isUuid ? "u.id" : "u.email";
      // Check entitlements table (joined with crm_users) — this is the authoritative source
      // after admin plan changes. Falls back to legacy customers table if not found.
      const { rows } = await db.query(
        `SELECT u.id, u.email, COALESCE(e.plan, 'free') AS plan_type, COALESCE(e.status, 'active') AS status
         FROM crm_users u LEFT JOIN entitlements e ON e.user_id = u.id
         WHERE ${col} = $1 LIMIT 1`,
        [userId]
      );
      if (!rows[0]) {
        // Legacy fallback: check old customers table
        const legacyCol = isUuid ? "id" : "email";
        const { rows: legacyRows } = await db.query(
          `SELECT id, email, plan_type, status FROM customers WHERE ${legacyCol} = $1 LIMIT 1`,
          [userId]
        );
        if (!legacyRows[0]) return res.json({ plan: "free", status: "active", trial_active: false, entitlement: { plan: "free", status: "active", trial_active: false } });
        const lr = legacyRows[0];
        const legacyData = { plan: lr.plan_type, status: lr.status, trial_active: lr.plan_type === "trial", id: lr.id, email: lr.email };
        return res.json({ ...legacyData, entitlement: legacyData });
      }
      const row = rows[0];
      const entitlementData = {
        plan: row.plan_type,
        status: row.status,
        trial_active: row.plan_type === "trial",
        id: row.id,
        email: row.email,
      };
      return res.json({ ...entitlementData, entitlement: entitlementData });
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
    const safeSubject = stripHtml(String(subject));
    const safeDescription = description ? stripHtml(String(description)) : null;
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
        [customerId, email, safeSubject, safeDescription, priority || "normal"]
      );
      const ticket = rows[0];
      // Send ticket confirmation email (fire-and-forget)
      const tmpl = ticketConfirmationEmail(safeSubject, ticket.id);
      sendEmail({ to: email, ...tmpl }).catch(() => {});
      return res.json({ success: true, ticket });
    } catch (err: any) {
      console.error("ticket create error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PATCH /api/crm/tickets/:id ──────────────────────────────────────────────
  if (path.match(/^\/api\/crm\/tickets\/[^/]+$/) && req.method === "PATCH") {
    const ticketId = path.replace("/api/crm/tickets/", "");
    const { status, reply } = req.body || {};
    try {
      const updates: string[] = ['updated_at = NOW()'];
      const vals: any[] = [ticketId];
      if (status) { updates.push(`status = $${vals.length + 1}`); vals.push(status); }
      if (reply)  { updates.push(`last_reply = $${vals.length + 1}`); vals.push(String(reply).slice(0, 1000)); }
      const { rows } = await db.query(
        `UPDATE tickets SET ${updates.join(', ')} WHERE id = $1 RETURNING *`, vals
      );
      if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' });
      const ticket = rows[0];
      // Send email notification (fire-and-forget)
      if (ticket.customer_email) {
        if (status === 'closed' || status === 'resolved') {
          const tmpl = ticketClosedEmail(ticketId);
          sendEmail({ to: ticket.customer_email, ...tmpl }).catch(() => {});
        } else if (reply) {
          const tmpl = ticketReplyEmail(ticketId, reply);
          sendEmail({ to: ticket.customer_email, ...tmpl }).catch(() => {});
        }
      }
      return res.json({ success: true, ticket });
    } catch (err: any) {
      console.error('ticket update error:', err.message);
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

  // ── Cloud vault helpers (manual HS256 JWT — avoids jsonwebtoken ESM issues) ──
  const JWT_SECRET = process.env.JWT_SECRET || 'ironvault-dev-secret';

  function b64url(buf: Buffer | string): string {
    const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
    return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function signCloudToken(userId: string, email: string): string {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ userId, email, exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600, iat: Math.floor(Date.now() / 1000) }));
    const sig = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
    return `${header}.${payload}.${sig}`;
  }

  function verifyCloudToken(token: string): { userId: string; email: string } | null {
    try {
      const [header, payload, sig] = token.split('.');
      if (!header || !payload || !sig) return null;
      const expected = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
      if (expected !== sig) return null;
      const data = JSON.parse(Buffer.from(payload, 'base64').toString());
      if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
      return { userId: data.userId, email: data.email };
    } catch { return null; }
  }

  function getCloudUser(req: VercelRequest): { userId: string; email: string } | null {
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return null;
    return verifyCloudToken(auth.substring(7));
  }

  // ── POST /api/auth/token ────────────────────────────────────────────────────
  if (path === '/api/auth/token' && req.method === 'POST') {
    const { email, accountPasswordHash } = req.body || {};
    if (!email || !accountPasswordHash) {
      return res.status(400).json({ error: 'email and accountPasswordHash required' });
    }
    const normalizedEmail = (email as string).toLowerCase().trim();
    try {
      // Look up user in crm_users table (Drizzle schema)
      const { rows: userRows } = await db.query(
        `SELECT id, account_password_hash FROM crm_users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );
      let userId: string;
      if (!userRows[0]) {
        // Check legacy customers table to inherit plan for existing customers
        const { rows: legacyRows } = await db.query(
          `SELECT full_name, plan_type FROM customers WHERE email = $1 LIMIT 1`,
          [normalizedEmail]
        ).catch(() => ({ rows: [] as any[] }));
        const legacyPlan = legacyRows[0]?.plan_type || 'free';
        const fullName = legacyRows[0]?.full_name || normalizedEmail.split('@')[0];
        // Auto-register minimal CRM user and inherit plan from legacy table.
        // ON CONFLICT handles the race condition where two simultaneous logins
        // both see "not found" and attempt INSERT at the same time.
        const { rows: newUser } = await db.query(
          `INSERT INTO crm_users (email, full_name, country, marketing_consent, support_consent)
           VALUES ($1, $2, 'US', false, true)
           ON CONFLICT (email) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, crm_users.full_name)
           RETURNING id`,
          [normalizedEmail, fullName]
        );
        userId = newUser[0].id;
        const resolvedPlan = ['pro', 'lifetime', 'family'].includes(legacyPlan) ? legacyPlan : 'free';
        // Check if entitlement already exists before inserting
        const { rows: existingEnt } = await db.query(
          `SELECT id FROM entitlements WHERE user_id = $1 LIMIT 1`, [userId]
        ).catch(() => ({ rows: [] as any[] }));
        if (!existingEnt[0]) {
          await db.query(
            `INSERT INTO entitlements (user_id, plan, status, trial_active, will_renew, admin_override)
             VALUES ($1, $2, 'active', false, false, false)`,
            [userId, resolvedPlan]
          ).catch(() => {}); // ignore if table doesn't exist or other constraint issue
        }
        // Store hash (trust-on-first-use)
        await db.query(`UPDATE crm_users SET account_password_hash = $1 WHERE id = $2`, [accountPasswordHash, userId]);
      } else {
        userId = userRows[0].id;
        const storedHash = userRows[0].account_password_hash;
        if (!storedHash) {
          // First time associating a hash with this account
          await db.query(`UPDATE crm_users SET account_password_hash = $1 WHERE id = $2`, [accountPasswordHash, userId]);
        } else if (storedHash !== accountPasswordHash) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }
      const token = signCloudToken(userId, normalizedEmail);
      return res.json({ success: true, token, userId, email: normalizedEmail });
    } catch (err: any) {
      console.error('auth/token error:', err.message);
      return res.status(500).json({ error: 'Auth failed' });
    }
  }

  // ── GET /api/vaults/cloud ───────────────────────────────────────────────────
  if (path === '/api/vaults/cloud' && req.method === 'GET') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { rows } = await db.query(
        `SELECT vault_id, vault_name, is_default, client_modified_at, server_updated_at, created_at, source_device_id
         FROM cloud_vaults WHERE user_id = $1 ORDER BY created_at DESC`,
        [cloudUser.userId]
      );
      return res.json({ success: true, vaults: rows.map((r: any) => ({
        vaultId: r.vault_id, vaultName: r.vault_name, isDefault: r.is_default,
        clientModifiedAt: r.client_modified_at?.toISOString(),
        serverUpdatedAt: r.server_updated_at?.toISOString(),
        createdAt: r.created_at?.toISOString(),
        sourceDeviceId: r.source_device_id ?? null,
      }))});
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to list vaults' });
    }
  }

  // ── GET /api/vaults/cloud/:vaultId ─────────────────────────────────────────
  if (path.startsWith('/api/vaults/cloud/') && !path.endsWith('/default') && req.method === 'GET') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const vaultId = path.replace('/api/vaults/cloud/', '');
    try {
      const { rows } = await db.query(
        `SELECT vault_id, vault_name, is_default, encrypted_blob, client_modified_at, server_updated_at
         FROM cloud_vaults WHERE user_id = $1 AND vault_id = $2 LIMIT 1`,
        [cloudUser.userId, vaultId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Vault not found' });
      const r = rows[0];
      return res.json({ success: true, vaultId: r.vault_id, vaultName: r.vault_name, isDefault: r.is_default,
        encryptedBlob: r.encrypted_blob,
        clientModifiedAt: r.client_modified_at?.toISOString(),
        serverUpdatedAt: r.server_updated_at?.toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to get vault' });
    }
  }

  // ── POST /api/vaults/cloud ──────────────────────────────────────────────────
  if (path === '/api/vaults/cloud' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const { vaultId, vaultName, encryptedBlob, isDefault = false, clientModifiedAt, sourceDeviceId } = req.body || {};
    if (!vaultId || !vaultName || !encryptedBlob) {
      return res.status(400).json({ error: 'vaultId, vaultName, encryptedBlob required' });
    }
    try {
      // Plan check — check entitlements first, fall back to legacy customers table
      const { rows: entRows } = await db.query(
        `SELECT plan FROM entitlements WHERE user_id = $1 LIMIT 1`, [cloudUser.userId]
      ).catch(() => ({ rows: [] as any[] }));
      let plan = entRows[0]?.plan;
      if (!plan) {
        const { rows: custRows } = await db.query(
          `SELECT plan_type FROM customers WHERE email = $1 LIMIT 1`, [cloudUser.email]
        ).catch(() => ({ rows: [] as any[] }));
        plan = custRows[0]?.plan_type || 'free';
      }
      if (plan === 'free') {
        return res.status(403).json({ error: 'Cloud vaults require a Pro or Lifetime plan', code: 'PLAN_UPGRADE_REQUIRED' });
      }
      // Check duplicate
      const { rows: existing } = await db.query(
        `SELECT id FROM cloud_vaults WHERE user_id = $1 AND vault_id = $2 LIMIT 1`,
        [cloudUser.userId, vaultId]
      );
      if (existing[0]) return res.status(409).json({ error: 'Vault already exists. Use PUT to update.' });
      const ts = clientModifiedAt ? new Date(clientModifiedAt) : new Date();
      const { rows: created } = await db.query(
        `INSERT INTO cloud_vaults (user_id, vault_id, vault_name, encrypted_blob, is_default, client_modified_at, source_device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING vault_id, vault_name, is_default, server_updated_at`,
        [cloudUser.userId, vaultId, vaultName, encryptedBlob, isDefault, ts, sourceDeviceId ?? null]
      );
      if (isDefault) {
        await db.query(`UPDATE cloud_vaults SET is_default = false WHERE user_id = $1 AND vault_id != $2`, [cloudUser.userId, vaultId]);
        await db.query(`UPDATE cloud_vaults SET is_default = true WHERE user_id = $1 AND vault_id = $2`, [cloudUser.userId, vaultId]);
      }
      const r = created[0];
      return res.status(201).json({ success: true, vault: {
        vaultId: r.vault_id, vaultName: r.vault_name, isDefault: r.is_default,
        serverUpdatedAt: r.server_updated_at?.toISOString(),
      }});
    } catch (err: any) {
      console.error('cloud vault create error:', err.message);
      return res.status(500).json({ error: 'Failed to create cloud vault' });
    }
  }

  // ── PUT /api/vaults/cloud/:vaultId ─────────────────────────────────────────
  if (path.startsWith('/api/vaults/cloud/') && !path.endsWith('/default') && req.method === 'PUT') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const vaultId = path.replace('/api/vaults/cloud/', '');
    const { encryptedBlob, vaultName, isDefault, clientModifiedAt } = req.body || {};
    if (!encryptedBlob) return res.status(400).json({ error: 'encryptedBlob required' });
    try {
      const { rows: existing } = await db.query(
        `SELECT vault_id, encrypted_blob, client_modified_at, server_updated_at
         FROM cloud_vaults WHERE user_id = $1 AND vault_id = $2 LIMIT 1`,
        [cloudUser.userId, vaultId]
      );
      if (!existing[0]) return res.status(404).json({ error: 'Vault not found' });
      // Plan check — check entitlements first, fall back to legacy customers table
      const { rows: putEntRows } = await db.query(
        `SELECT plan FROM entitlements WHERE user_id = $1 LIMIT 1`, [cloudUser.userId]
      ).catch(() => ({ rows: [] as any[] }));
      let putPlan = putEntRows[0]?.plan;
      if (!putPlan) {
        const { rows: putCustRows } = await db.query(
          `SELECT plan_type FROM customers WHERE email = $1 LIMIT 1`, [cloudUser.email]
        ).catch(() => ({ rows: [] as any[] }));
        putPlan = putCustRows[0]?.plan_type || 'free';
      }
      if (putPlan === 'free') {
        return res.status(403).json({ error: 'Cloud vault sync requires Pro or Lifetime plan', code: 'PLAN_UPGRADE_REQUIRED' });
      }
      const incomingTs = clientModifiedAt ? new Date(clientModifiedAt) : new Date();
      const storedTs = existing[0].client_modified_at ? new Date(existing[0].client_modified_at) : null;
      if (storedTs && incomingTs < storedTs) {
        // Server has newer data
        const r = existing[0];
        return res.json({ success: true, merged: false, serverNewer: true, vault: {
          vaultId: r.vault_id, encryptedBlob: r.encrypted_blob,
          clientModifiedAt: r.client_modified_at?.toISOString(),
          serverUpdatedAt: r.server_updated_at?.toISOString(),
        }});
      }
      const sets: string[] = ['encrypted_blob = $3', 'client_modified_at = $4', 'server_updated_at = NOW()'];
      const params: any[] = [cloudUser.userId, vaultId, encryptedBlob, incomingTs];
      if (vaultName) { sets.push(`vault_name = $${params.length + 1}`); params.push(vaultName); }
      if (isDefault !== undefined) { sets.push(`is_default = $${params.length + 1}`); params.push(isDefault); }
      const { rows: updated } = await db.query(
        `UPDATE cloud_vaults SET ${sets.join(', ')} WHERE user_id = $1 AND vault_id = $2 RETURNING vault_id, server_updated_at`,
        params
      );
      if (isDefault) {
        await db.query(`UPDATE cloud_vaults SET is_default = false WHERE user_id = $1 AND vault_id != $2`, [cloudUser.userId, vaultId]);
        await db.query(`UPDATE cloud_vaults SET is_default = true WHERE user_id = $1 AND vault_id = $2`, [cloudUser.userId, vaultId]);
      }
      return res.json({ success: true, merged: true, vault: {
        vaultId: updated[0]?.vault_id, serverUpdatedAt: updated[0]?.server_updated_at?.toISOString(),
      }});
    } catch (err: any) {
      console.error('cloud vault update error:', err.message);
      return res.status(500).json({ error: 'Failed to update cloud vault' });
    }
  }

  // ── DELETE /api/vaults/cloud/:vaultId ──────────────────────────────────────
  if (path.startsWith('/api/vaults/cloud/') && !path.endsWith('/default') && req.method === 'DELETE') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const vaultId = path.replace('/api/vaults/cloud/', '');
    try {
      const { rows } = await db.query(
        `DELETE FROM cloud_vaults WHERE user_id = $1 AND vault_id = $2 RETURNING id`,
        [cloudUser.userId, vaultId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Vault not found' });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to delete vault' });
    }
  }

  // ── PATCH /api/vaults/cloud/:vaultId/default ────────────────────────────────
  if (path.endsWith('/default') && req.method === 'PATCH') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const vaultId = path.replace('/api/vaults/cloud/', '').replace('/default', '');
    try {
      const { rows } = await db.query(
        `SELECT id FROM cloud_vaults WHERE user_id = $1 AND vault_id = $2 LIMIT 1`,
        [cloudUser.userId, vaultId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Vault not found' });
      await db.query(`UPDATE cloud_vaults SET is_default = false WHERE user_id = $1`, [cloudUser.userId]);
      await db.query(`UPDATE cloud_vaults SET is_default = true WHERE user_id = $1 AND vault_id = $2`, [cloudUser.userId, vaultId]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to set default' });
    }
  }

  // ── POST /api/crm/migrate ────────────────────────────────────────────────────
  // Creates / alters tables needed for BUG-023 schema improvements.
  // Idempotent — safe to re-run.
  if (path === '/api/crm/migrate' && req.method === 'POST') {
    try {
      await db.query(`
        -- Add missing columns to customers if they don't exist
        ALTER TABLE customers
          ADD COLUMN IF NOT EXISTS phone TEXT,
          ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS vault_count INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS flagged_over_limit BOOLEAN DEFAULT false;

        -- Family invites table (BUG-023)
        CREATE TABLE IF NOT EXISTS family_invites (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_email TEXT NOT NULL REFERENCES customers(email) ON DELETE CASCADE,
          invitee_email TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | declined | revoked
          invited_at TIMESTAMPTZ DEFAULT NOW(),
          accepted_at TIMESTAMPTZ,
          declined_at TIMESTAMPTZ,
          revoked_at TIMESTAMPTZ,
          vault_share_id TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(owner_email, invitee_email)
        );
        CREATE INDEX IF NOT EXISTS idx_family_invites_owner ON family_invites(owner_email);
        CREATE INDEX IF NOT EXISTS idx_family_invites_invitee ON family_invites(invitee_email);

        -- Plan audit log (BUG-023)
        CREATE TABLE IF NOT EXISTS plan_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          customer_email TEXT NOT NULL,
          old_plan TEXT,
          new_plan TEXT NOT NULL,
          changed_by TEXT NOT NULL DEFAULT 'system',   -- admin email or 'system'
          reason TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_plan_audit_email ON plan_audit_log(customer_email);
      `);
      return res.json({ success: true, message: 'Schema migration complete (BUG-023)' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/crm/family-invites/invitee/:email ───────────────────────────────
  if (path.startsWith('/api/crm/family-invites/invitee/') && req.method === 'GET') {
    const inviteeEmail = decodeURIComponent(path.replace('/api/crm/family-invites/invitee/', ''));
    try {
      const { rows } = await db.query(
        `SELECT fi.*, c.full_name as owner_name
         FROM family_invites fi
         LEFT JOIN customers c ON c.email = fi.owner_email
         WHERE fi.invitee_email = $1
           AND fi.status = 'pending'
         ORDER BY fi.invited_at DESC`,
        [inviteeEmail.toLowerCase()]
      );
      return res.json({ invites: rows, total: rows.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/crm/family-invites/:ownerEmail ──────────────────────────────────
  if (path.startsWith('/api/crm/family-invites/') && req.method === 'GET') {
    const ownerEmail = decodeURIComponent(path.replace('/api/crm/family-invites/', ''));
    try {
      const { rows } = await db.query(
        `SELECT * FROM family_invites WHERE owner_email = $1 ORDER BY invited_at DESC`,
        [ownerEmail.toLowerCase()]
      );
      return res.json({ invites: rows, total: rows.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/crm/family-invites ─────────────────────────────────────────────
  if (path === '/api/crm/family-invites' && req.method === 'POST') {
    const { ownerEmail, inviteeEmail, vaultShareId } = req.body || {};
    if (!ownerEmail || !inviteeEmail) {
      return res.status(400).json({ error: 'ownerEmail and inviteeEmail required' });
    }
    // Validate owner has a paid plan (family or lifetime)
    try {
      const { rows: cRows } = await db.query(
        `SELECT plan_type FROM customers WHERE email = $1 LIMIT 1`,
        [ownerEmail.toLowerCase()]
      );
      const plan = cRows[0]?.plan_type || 'free';
      if (!['family', 'lifetime', 'pro'].includes(plan)) {
        return res.status(403).json({ error: 'Family invites require a Pro or higher plan', code: 'PLAN_UPGRADE_REQUIRED' });
      }
      const { rows } = await db.query(
        `INSERT INTO family_invites (owner_email, invitee_email, vault_share_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (owner_email, invitee_email) DO UPDATE
           SET status = 'pending', invited_at = NOW(), updated_at = NOW()
         RETURNING *`,
        [ownerEmail.toLowerCase(), inviteeEmail.toLowerCase(), vaultShareId || null]
      );
      return res.json({ success: true, invite: rows[0] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PATCH /api/crm/family-invites/:id ────────────────────────────────────────
  // Accepts status: accepted | declined | revoked
  if (path.match(/^\/api\/crm\/family-invites\/[^/]+$/) && req.method === 'PATCH') {
    const id = path.split('/').pop();
    const { status } = req.body || {};
    if (!['accepted', 'declined', 'revoked'].includes(status)) {
      return res.status(400).json({ error: 'status must be accepted, declined, or revoked' });
    }
    const tsCol = status === 'accepted' ? 'accepted_at' : status === 'declined' ? 'declined_at' : 'revoked_at';
    try {
      const { rows } = await db.query(
        `UPDATE family_invites SET status = $1, ${tsCol} = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [status, id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Invite not found' });
      return res.json({ success: true, invite: rows[0] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/crm/vaults/report ──────────────────────────────────────────────
  // Client reports current local vault count — server updates and flags over-limit accounts
  if (path === '/api/crm/vaults/report' && req.method === 'POST') {
    const { email, vaultCount, planId } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const count = Number(vaultCount) || 0;
    // Determine plan limit
    const planLimits: Record<string, number> = { free: 1, pro: 5, family: 5, lifetime: 5 };
    const resolvedPlanId = (planId as string) || 'free';
    const limit = planLimits[resolvedPlanId] ?? 1;
    const flagged = count > limit;
    try {
      await db.query(
        `UPDATE customers
         SET vault_count = $1, flagged_over_limit = $2, last_active = NOW(), updated_at = NOW()
         WHERE email = $3`,
        [count, flagged, email.toLowerCase()]
      );
      return res.json({ success: true, vaultCount: count, limit, flagged });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/auth/forgot-password ─────────────────────────────────────────
  if (path === '/api/auth/forgot-password' && req.method === 'POST') {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const normalizedEmail = (email as string).toLowerCase().trim();
    const APP_URL = process.env.APP_URL || 'https://www.ironvault.app';
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL,
          token VARCHAR(10) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      const { rows } = await db.query(
        `SELECT id FROM crm_users WHERE email = $1 LIMIT 1`, [normalizedEmail]
      );
      // Always return success (don't reveal if email exists)
      if (!rows[0]) {
        return res.json({ success: true, emailSent: emailConfigured });
      }
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const token = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      await db.query(`UPDATE password_reset_tokens SET used = true WHERE email = $1`, [normalizedEmail]);
      await db.query(
        `INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [normalizedEmail, token]
      );
      const resetLink = `${APP_URL}/auth/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
      if (emailConfigured) {
        const tmpl = passwordResetEmail(resetLink);
        const sent = await sendEmail({ to: normalizedEmail, ...tmpl });
        return res.json({ success: true, emailSent: sent });
      } else {
        // SMTP not configured — return token for in-app display (dev/demo fallback)
        return res.json({ success: true, emailSent: false, resetCode: token, resetLink });
      }
    } catch (err: any) {
      console.error('forgot-password error:', err.message);
      return res.status(500).json({ error: 'Failed to generate reset code' });
    }
  }

  // ── POST /api/auth/reset-password ──────────────────────────────────────────
  if (path === '/api/auth/reset-password' && req.method === 'POST') {
    const { email, token, newPasswordHash } = req.body || {};
    if (!email || !newPasswordHash) {
      return res.status(400).json({ error: 'email and newPasswordHash required' });
    }
    const normalizedEmail = (email as string).toLowerCase().trim();
    try {
      if (token) {
        // Token-based flow: verify reset code
        const { rows } = await db.query(
          `SELECT id FROM password_reset_tokens
           WHERE email = $1 AND token = $2 AND used = false AND expires_at > NOW()
           LIMIT 1`,
          [normalizedEmail, (token as string).toUpperCase()]
        );
        if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset code' });
        await db.query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [rows[0].id]);
      } else {
        // Tokenless flow: verify email exists
        const { rows } = await db.query(`SELECT id FROM crm_users WHERE email = $1`, [normalizedEmail]);
        if (!rows[0]) return res.status(404).json({ error: 'No account found for that email' });
      }
      await db.query(
        `UPDATE crm_users SET account_password_hash = $1 WHERE email = $2`,
        [newPasswordHash, normalizedEmail]
      );
      return res.json({ success: true, message: 'Password reset successfully. Please log in.' });
    } catch (err: any) {
      console.error('reset-password error:', err.message);
      return res.status(500).json({ error: 'Failed to reset password' });
    }
  }

  return res.status(404).json({ error: "endpoint not found", path });
}
