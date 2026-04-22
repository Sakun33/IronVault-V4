import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";
import { createHmac } from "crypto";
import nodemailer from "nodemailer";

// ── Zoho Desk API ─────────────────────────────────────────────────────────────
let _zdToken: string | null = null;
let _zdTokenExpiry = 0;

async function getZohoAccessToken(): Promise<string | null> {
  if (_zdToken && Date.now() < _zdTokenExpiry - 60_000) return _zdToken;
  const { ZOHO_DESK_CLIENT_ID: cid, ZOHO_DESK_CLIENT_SECRET: csec, ZOHO_DESK_REFRESH_TOKEN: rt } = process.env;
  if (!cid || !csec || !rt) return null;
  try {
    const r = await fetch(`https://accounts.zoho.in/oauth/v2/token?grant_type=refresh_token&client_id=${cid}&client_secret=${csec}&refresh_token=${rt}`, { method: 'POST' });
    const d = await r.json() as any;
    if (d.access_token) { _zdToken = d.access_token; _zdTokenExpiry = Date.now() + (d.expires_in ?? 3600) * 1000; return _zdToken; }
    console.error('[zoho] token refresh error:', JSON.stringify(d));
  } catch (e: any) { console.error('[zoho] token refresh failed:', e.message); }
  return null;
}

async function createZohoDeskTicket(opts: { email: string; subject: string; description: string; priority?: string }): Promise<{ id: string; ticketNumber: string } | null> {
  const token = await getZohoAccessToken();
  if (!token) return null;
  const orgId = process.env.ZOHO_DESK_ORG_ID || '60070327163';
  try {
    const r = await fetch('https://desk.zoho.in/api/v1/tickets', {
      method: 'POST',
      headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'orgId': orgId, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: opts.subject,
        description: opts.description,
        email: opts.email,
        departmentId: '189695000000010772',
        priority: opts.priority === 'high' ? 'High' : opts.priority === 'low' ? 'Low' : 'Medium',
        channel: 'Web',
      }),
    });
    const d = await r.json() as any;
    if (d.id) return { id: String(d.id), ticketNumber: String(d.ticketNumber ?? d.id) };
    console.error('[zoho] ticket create failed:', JSON.stringify(d));
  } catch (e: any) { console.error('[zoho] create ticket error:', e.message); }
  return null;
}

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
function _emailLayout(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:40px 20px 60px"><div style="text-align:center;margin-bottom:28px"><div style="display:inline-flex;align-items:center;gap:10px"><div style="width:38px;height:38px;background:#4f46e5;border-radius:9px;display:inline-flex;align-items:center;justify-content:center"><span style="color:#fff;font-size:20px">🛡</span></div><span style="font-size:21px;font-weight:700;color:#111827;letter-spacing:-0.3px">IronVault</span></div></div><div style="background:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.04)">${body}</div><div style="text-align:center;padding:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.7"><p style="margin:0">© 2026 IronVault — Secure Password Manager</p><p style="margin:4px 0 0"><a href="mailto:saket@ironvault.app" style="color:#6366f1;text-decoration:none">saket@ironvault.app</a></p></div></div></body></html>`;
}
function _eh1(t: string) { return `<h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;text-align:center;letter-spacing:-0.4px">${t}</h1>`; }
function _ep(t: string)  { return `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#6b7280;text-align:center">${t}</p>`; }
function _ebtn(u: string, l: string) { return `<div style="text-align:center;margin:8px 0 24px"><a href="${u}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 32px;font-weight:600;font-size:15px;letter-spacing:-0.1px">${l}</a></div>`; }
function _ecard(i: string) { return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;margin:0 0 24px">${i}</div>`; }
function _edivider() { return `<hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0">`; }
function welcomeEmail(name: string) {
  const body = `${_eh1(`Welcome to IronVault, ${name||'there'}!`)}${_ep('Your secure vault account has been created. Everything you store is AES-256 encrypted.')}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Getting started</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>Create your vault and master password</li><li>Add passwords, notes, reminders</li><li>Track subscriptions and expenses</li></ul>`)}${_ebtn(_APP_URL,'Open IronVault')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">You're receiving this because you created an IronVault account.</p>`;
  return { subject: 'Welcome to IronVault 🛡', html: _emailLayout(body) };
}
function passwordResetEmail(link: string) {
  const body = `${_eh1('Reset your password')}${_ep('Click below to set a new password. This link expires in <strong style="color:#111827">1 hour</strong>.')}${_ebtn(link,'Reset Password')}${_ecard(`<p style="margin:0;font-size:13px;color:#6b7280">Or copy this link into your browser:</p><p style="margin:6px 0 0;font-size:12px;word-break:break-all"><a href="${link}" style="color:#6366f1;text-decoration:none">${link}</a></p>`)}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">If you didn't request this, you can safely ignore this email.</p>`;
  return { subject: 'Reset your IronVault password', html: _emailLayout(body) };
}
function verificationEmail(name: string, link: string) {
  const body = `${_eh1('Verify your email address')}${_ep(`Hi ${name||'there'}, please confirm your email to activate your IronVault account.`)}${_ebtn(link,'Verify Email Address')}${_ecard(`<p style="margin:0;font-size:13px;color:#6b7280">Or copy this link into your browser:</p><p style="margin:6px 0 0;font-size:12px;word-break:break-all"><a href="${link}" style="color:#6366f1;text-decoration:none">${link}</a></p>`)}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.</p>`;
  return { subject: 'Verify your IronVault email address', html: _emailLayout(body) };
}
function ticketConfirmationEmail(sub: string, id: string|number) {
  const body = `${_eh1('We received your ticket')}${_ep('Our support team will get back to you within 24 hours.')}${_ecard(`<p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Ticket #${id}</p><p style="margin:0;font-size:15px;font-weight:600;color:#111827">${sub}</p>`)}${_ebtn('mailto:saket@ironvault.app','Reply via Email')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">You can also reply directly to this email to update your ticket.</p>`;
  return { subject: `[IronVault Support] Ticket received: ${sub}`, html: _emailLayout(body) };
}
function ticketReplyEmail(id: string|number, preview: string) {
  const body = `${_eh1('New reply on your ticket')}${_ep(`Our support team has responded to ticket <strong style="color:#111827">#${id}</strong>.`)}${_ecard(`<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Reply preview</p><p style="margin:0;font-size:14px;color:#374151;font-style:italic">"${String(preview).slice(0,200)}"</p>`)}${_ebtn('mailto:saket@ironvault.app','Reply')}`;
  return { subject: `[IronVault Support] Update on ticket #${id}`, html: _emailLayout(body) };
}
function ticketClosedEmail(id: string|number) {
  const body = `${_eh1('Ticket resolved')}${_ep(`Ticket <strong style="color:#111827">#${id}</strong> has been marked as resolved.`)}${_ecard(`<p style="margin:0;font-size:14px;color:#374151">We hope your issue was resolved. If you need further help, feel free to reach out — we're always here.</p>`)}${_ebtn('mailto:saket@ironvault.app','Contact Support Again')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">Reply to this email if you need further assistance.</p>`;
  return { subject: `[IronVault Support] Ticket #${id} resolved`, html: _emailLayout(body) };
}
function planUpgradeEmail(plan: string) {
  const label = plan==='lifetime'?'Lifetime':plan==='family'?'Family':'Pro';
  const body = `${_eh1(`You're now on ${label}!`)}${_ep(`Your IronVault account has been upgraded to <strong style="color:#111827">${label}</strong>. All premium features are now unlocked.`)}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">What's included</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>Unlimited vaults</li><li>Cloud sync across devices</li><li>Priority support</li></ul>`)}${_ebtn(_APP_URL,'Open IronVault')}`;
  return { subject: `You're now on IronVault ${label} ⭐`, html: _emailLayout(body) };
}
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
           full_name = CASE WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name != ''
             THEN EXCLUDED.full_name ELSE customers.full_name END,
           country = COALESCE(EXCLUDED.country, customers.country),
           platform = COALESCE(EXCLUDED.platform, customers.platform),
           app_version = COALESCE(EXCLUDED.app_version, customers.app_version),
           updated_at = NOW()
         RETURNING id, email, plan_type, (xmax = 0) AS is_new_insert`,
        [email, safeFullName, country || null, platform || null, appVersion || null, planType || "free"]
      );
      const row = rows[0];
      // Only send welcome email for truly new registrations (not ON CONFLICT updates)
      if (row?.is_new_insert) {
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
    const safeDescription = description ? stripHtml(String(description)) : '';
    try {
      // Primary: create ticket in Zoho Desk
      const zdTicket = await createZohoDeskTicket({ email, subject: safeSubject, description: safeDescription, priority });
      const ticketId = zdTicket?.ticketNumber ?? zdTicket?.id ?? 'N/A';

      // Secondary: also persist locally for audit trail (fire-and-forget)
      db.query(
        `SELECT id FROM customers WHERE email = $1 LIMIT 1`, [email]
      ).then(({ rows: cRows }) => {
        const customerId = cRows[0]?.id || null;
        return db.query(
          `INSERT INTO tickets (customer_id, customer_email, subject, description, priority)
           VALUES ($1, $2, $3, $4, $5)`,
          [customerId, email, safeSubject, safeDescription || null, priority || 'normal']
        );
      }).catch(() => {});

      // Send confirmation email with Zoho ticket number
      sendEmail({ to: email, ...ticketConfirmationEmail(safeSubject, ticketId) }).catch(() => {});
      return res.json({ success: true, ticket: { id: ticketId, zoho: !!zdTicket } });
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

  // ── POST /api/test-email ────────────────────────────────────────────────────
  if (path === '/api/test-email' && req.method === 'POST') {
    const { type, to, name, plan } = req.body || {};
    const email = (to as string) || 'saketsuman1312@gmail.com';
    const displayName = (name as string) || 'Saket';
    try {
      let tmpl: { subject: string; html: string };
      if (type === 'welcome') {
        tmpl = welcomeEmail(displayName);
      } else if (type === 'plan_upgrade') {
        tmpl = planUpgradeEmail((plan as string) || 'lifetime');
      } else if (type === 'ticket_confirmation') {
        tmpl = ticketConfirmationEmail('Email Template Test', 'TEST-001');
      } else if (type === 'ticket_reply') {
        tmpl = ticketReplyEmail('TEST-001', 'Thank you for reaching out. We are looking into your request.');
      } else if (type === 'ticket_closed') {
        tmpl = ticketClosedEmail('TEST-001');
      } else if (type === 'password_reset') {
        tmpl = passwordResetEmail(`${process.env.APP_URL || 'https://www.ironvault.app'}/auth/reset-password?token=PREVIEW&email=${encodeURIComponent(email)}`);
      } else if (type === 'verification') {
        tmpl = verificationEmail(displayName, `${process.env.APP_URL || 'https://www.ironvault.app'}/auth/verify?token=PREVIEW&email=${encodeURIComponent(email)}`);
      } else {
        return res.status(400).json({ error: 'type required: welcome|verification|plan_upgrade|ticket_confirmation|ticket_reply|ticket_closed|password_reset' });
      }
      const sent = await sendEmail({ to: email, ...tmpl });
      return res.json({ success: sent, type, to: email, subject: tmpl.subject });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/auth/register ────────────────────────────────────────────────
  // Creates a new account with pending_verification status and sends a verification email.
  if (path === '/api/auth/register' && req.method === 'POST') {
    const { email, accountPasswordHash, fullName, country, phone, planType, marketingConsent } = req.body || {};
    if (!email || !accountPasswordHash) return res.status(400).json({ error: 'email and accountPasswordHash required' });
    const normalizedEmail = (email as string).toLowerCase().trim();
    const safeFullName = fullName ? stripHtml(String(fullName)) : normalizedEmail.split('@')[0];
    try {
      const { rows: existing } = await db.query(
        `SELECT id FROM crm_users WHERE email = $1 LIMIT 1`, [normalizedEmail]
      );
      if (existing[0]) return res.status(409).json({ error: 'An account with this email already exists.' });

      const tokenChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const verifyToken = Array.from({ length: 64 }, () => tokenChars[Math.floor(Math.random() * tokenChars.length)]).join('');

      const { rows: newUser } = await db.query(
        `INSERT INTO crm_users (email, full_name, country, marketing_consent, support_consent, account_password_hash, account_status, verification_token, verification_token_expires_at)
         VALUES ($1, $2, $3, $4, true, $5, 'pending_verification', $6, NOW() + INTERVAL '24 hours')
         RETURNING id`,
        [normalizedEmail, safeFullName, country || 'US', marketingConsent || false, accountPasswordHash, verifyToken]
      );
      const userId = newUser[0].id;

      // Mirror in customers + entitlements (non-blocking)
      db.query(
        `INSERT INTO customers (email, full_name, country, platform, plan_type, status, marketing_consent)
         VALUES ($1, $2, $3, 'web', $4, 'active', $5) ON CONFLICT (email) DO NOTHING`,
        [normalizedEmail, safeFullName, country || 'US', planType || 'free', marketingConsent || false]
      ).catch(() => {});
      db.query(
        `INSERT INTO entitlements (user_id, plan, status, trial_active, will_renew, admin_override)
         VALUES ($1, $2, 'active', false, false, false) ON CONFLICT DO NOTHING`,
        [userId, planType || 'free']
      ).catch(() => {});

      const APP_URL_REG = process.env.APP_URL || 'https://www.ironvault.app';
      const verifyLink = `${APP_URL_REG}/auth/verify?token=${verifyToken}&email=${encodeURIComponent(normalizedEmail)}`;
      const tmpl = verificationEmail(safeFullName, verifyLink);
      const emailSent = await sendEmail({ to: normalizedEmail, ...tmpl });

      return res.status(201).json({ success: true, emailSent, message: 'Account created. Please check your email to verify.' });
    } catch (err: any) {
      console.error('auth/register error:', err.message);
      return res.status(500).json({ error: 'Failed to create account' });
    }
  }

  // ── POST /api/auth/verify-email ────────────────────────────────────────────
  if (path === '/api/auth/verify-email' && req.method === 'POST') {
    const { email, token } = req.body || {};
    if (!email || !token) return res.status(400).json({ error: 'email and token required' });
    const normalizedEmail = (email as string).toLowerCase().trim();
    try {
      const { rows } = await db.query(
        `SELECT id, verification_token, verification_token_expires_at, account_status FROM crm_users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Account not found' });
      const user = rows[0];
      if (user.account_status === 'active') return res.json({ success: true, message: 'Email already verified. You can log in.' });
      if (user.verification_token !== token) return res.status(400).json({ error: 'Invalid verification link.' });
      if (!user.verification_token_expires_at || new Date(user.verification_token_expires_at) < new Date()) {
        return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });
      }
      await db.query(
        `UPDATE crm_users SET account_status = 'active', verification_token = NULL, verification_token_expires_at = NULL WHERE id = $1`,
        [user.id]
      );
      return res.json({ success: true, message: 'Email verified! You can now log in.' });
    } catch (err: any) {
      console.error('verify-email error:', err.message);
      return res.status(500).json({ error: 'Verification failed' });
    }
  }

  // ── POST /api/auth/resend-verification ─────────────────────────────────────
  if (path === '/api/auth/resend-verification' && req.method === 'POST') {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const normalizedEmail = (email as string).toLowerCase().trim();
    try {
      const { rows } = await db.query(
        `SELECT id, full_name, account_status FROM crm_users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Account not found' });
      if (rows[0].account_status === 'active') return res.json({ success: true, message: 'Email already verified.' });

      const tokenChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const verifyToken = Array.from({ length: 64 }, () => tokenChars[Math.floor(Math.random() * tokenChars.length)]).join('');
      await db.query(
        `UPDATE crm_users SET verification_token = $1, verification_token_expires_at = NOW() + INTERVAL '24 hours' WHERE id = $2`,
        [verifyToken, rows[0].id]
      );
      const APP_URL_RES = process.env.APP_URL || 'https://www.ironvault.app';
      const verifyLink = `${APP_URL_RES}/auth/verify?token=${verifyToken}&email=${encodeURIComponent(normalizedEmail)}`;
      const tmpl = verificationEmail(rows[0].full_name || normalizedEmail.split('@')[0], verifyLink);
      const emailSent = await sendEmail({ to: normalizedEmail, ...tmpl });
      return res.json({ success: true, emailSent });
    } catch (err: any) {
      console.error('resend-verification error:', err.message);
      return res.status(500).json({ error: 'Failed to resend verification' });
    }
  }

  // ── GET /api/auth/check ─────────────────────────────────────────────────────
  if (path === '/api/auth/check' && req.method === 'GET') {
    const qEmail = ((req.query?.email as string) || '').toLowerCase().trim();
    if (!qEmail) return res.json({ exists: false });
    try {
      const { rows } = await db.query(`SELECT id FROM crm_users WHERE email = $1 LIMIT 1`, [qEmail]);
      return res.json({ exists: rows.length > 0 });
    } catch {
      return res.json({ exists: false }); // fail open — don't block signup on DB error
    }
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
        `SELECT id, account_password_hash, account_status FROM crm_users WHERE email = $1 LIMIT 1`,
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
        // Send welcome email for genuinely new accounts
        const welcomeTmpl = welcomeEmail(fullName);
        sendEmail({ to: normalizedEmail, ...welcomeTmpl }).catch(() => {});
      } else {
        userId = userRows[0].id;
        const storedHash = userRows[0].account_password_hash;
        if (!storedHash) {
          // First time associating a hash with this account
          await db.query(`UPDATE crm_users SET account_password_hash = $1 WHERE id = $2`, [accountPasswordHash, userId]);
        } else if (storedHash !== accountPasswordHash) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Block login if email not yet verified
        if (userRows[0].account_status === 'pending_verification') {
          return res.status(403).json({ error: 'email_not_verified' });
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

  // ── POST /api/admin/set-plan ────────────────────────────────────────────────
  // Protected by JWT_SECRET header. Updates plan in both customers + entitlements.
  if (path === '/api/admin/set-plan' && req.method === 'POST') {
    const adminKey = req.headers['x-admin-key'] as string;
    if (!adminKey || adminKey !== JWT_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    const { email, plan } = req.body || {};
    if (!email || !plan) return res.status(400).json({ error: 'email and plan required' });
    const normalizedEmail = (email as string).toLowerCase().trim();
    try {
      const { rowCount: cRows } = await db.query(
        `UPDATE customers SET plan_type = $1, updated_at = NOW() WHERE email = $2`,
        [plan, normalizedEmail]
      );
      const { rowCount: eRows } = await db.query(
        `UPDATE entitlements SET plan = $1, updated_at = NOW()
         WHERE user_id = (SELECT id FROM crm_users WHERE email = $2 LIMIT 1)`,
        [plan, normalizedEmail]
      );
      return res.json({ success: true, email: normalizedEmail, plan, customersUpdated: cRows, entitlementsUpdated: eRows });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: "endpoint not found", path });
}
