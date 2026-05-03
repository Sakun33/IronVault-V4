import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";
import { createHmac, randomBytes, randomInt, randomUUID, scrypt as scryptCb, scryptSync, timingSafeEqual, createCipheriv, createDecipheriv } from "crypto";
import { promisify } from "util";
import nodemailer from "nodemailer";
import { generateSecret as totpGenerateSecret, generateURI as totpGenerateURI, verifySync as totpVerifySync } from "otplib";
import QRCode from "qrcode";

const scrypt = promisify(scryptCb) as (password: string | Buffer, salt: string | Buffer, keylen: number) => Promise<Buffer>;

// Cryptographically random alphanumeric token of arbitrary length.
function cryptoRandomString(len: number, alphabet: string): string {
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    out.push(alphabet[randomInt(0, alphabet.length)]);
  }
  return out.join('');
}

// Account-password hashing — scrypt with per-user random salt, format
// `scrypt$<salt_hex>$<key_hex>`. Legacy 64-char hex SHA-256 hashes are
// recognized on login and silently re-hashed.
async function hashAccountPassword(input: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(input, salt, 64);
  return `scrypt$${salt.toString('hex')}$${(key as Buffer).toString('hex')}`;
}

async function verifyAccountPassword(input: string, stored: string): Promise<{ ok: boolean; legacy: boolean }> {
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return { ok: false, legacy: false };
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const got = (await scrypt(input, salt, expected.length)) as Buffer;
    if (got.length !== expected.length) return { ok: false, legacy: false };
    return { ok: timingSafeEqual(got, expected), legacy: false };
  }
  // Legacy: 64-char hex SHA-256, no salt. Compare in constant time.
  if (/^[a-f0-9]{64}$/i.test(stored) && /^[a-f0-9]{64}$/i.test(input)) {
    const a = Buffer.from(stored, 'hex');
    const b = Buffer.from(input, 'hex');
    if (a.length !== b.length) return { ok: false, legacy: true };
    return { ok: timingSafeEqual(a, b), legacy: true };
  }
  return { ok: false, legacy: false };
}

// AES-256-GCM envelope for TOTP secrets at rest. Key = scrypt(JWT_SECRET, "totp")
let _totpEncKey: Buffer | null = null;
function getTotpEncKey(): Buffer {
  if (_totpEncKey) return _totpEncKey;
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  _totpEncKey = scryptSync(secret, 'ironvault-totp-v1', 32);
  return _totpEncKey;
}
function encryptTotpSecret(plain: string): string {
  const key = getTotpEncKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}
function decryptTotpSecret(stored: string): string {
  if (!stored.startsWith('enc:v1:')) return stored; // legacy plaintext fallback
  const parts = stored.split(':');
  if (parts.length !== 5) return stored;
  const iv = Buffer.from(parts[2], 'hex');
  const tag = Buffer.from(parts[3], 'hex');
  const enc = Buffer.from(parts[4], 'hex');
  const decipher = createDecipheriv('aes-256-gcm', getTotpEncKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// Constant-time string-or-buffer compare; falls back to false on length mismatch.
function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// otplib v13 functional API. epochTolerance: 30 == ±1 step (30s) for clock skew
// between server and authenticator app — same posture as the v12 `window: 1`.
const TOTP_TOLERANCE_SECONDS = 30;

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
        contact: { email: opts.email },
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

// ── Zoho CRM API ──────────────────────────────────────────────────────────────
let _crmToken: string | null = null;
let _crmTokenExpiry = 0;

async function getCrmAccessToken(): Promise<string | null> {
  if (_crmToken && Date.now() < _crmTokenExpiry - 60_000) return _crmToken;
  const { ZOHO_DESK_CLIENT_ID: cid, ZOHO_DESK_CLIENT_SECRET: csec, ZOHO_CRM_REFRESH_TOKEN: rt } = process.env;
  if (!cid || !csec || !rt) return null;
  try {
    const r = await fetch(`https://accounts.zoho.in/oauth/v2/token?grant_type=refresh_token&client_id=${cid}&client_secret=${csec}&refresh_token=${rt}`, { method: 'POST' });
    const d = await r.json() as any;
    if (d.access_token) { _crmToken = d.access_token; _crmTokenExpiry = Date.now() + (d.expires_in ?? 3600) * 1000; return _crmToken; }
    console.error('[crm] token refresh error:', JSON.stringify(d));
  } catch (e: any) { console.error('[crm] token refresh failed:', e.message); }
  return null;
}

async function createCrmContact(opts: { email: string; firstName: string; lastName: string; source?: string; phone?: string; country?: string; plan?: string; company?: string; address?: string; city?: string; state?: string; postalCode?: string }): Promise<string | null> {
  const token = await getCrmAccessToken();
  if (!token) return null;
  try {
    const contact: Record<string, unknown> = {
      Email: opts.email,
      First_Name: opts.firstName,
      Last_Name: opts.lastName || opts.email,
      Lead_Source: opts.source || 'Web Site',
    };
    if (opts.phone) contact.Phone = opts.phone;
    if (opts.country) contact.Mailing_Country = opts.country;
    if (opts.company) contact.Account_Name = opts.company;
    if (opts.plan) contact.Description = `Plan: ${opts.plan}`;
    if (opts.address) contact.Mailing_Street = opts.address;
    if (opts.city) contact.Mailing_City = opts.city;
    if (opts.state) contact.Mailing_State = opts.state;
    if (opts.postalCode) contact.Mailing_Zip = opts.postalCode;
    const r = await fetch('https://www.zohoapis.in/crm/v7/Contacts/upsert', {
      method: 'POST',
      headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [contact], duplicate_check_fields: ['Email'] }),
    });
    const d = await r.json() as any;
    const id = d.data?.[0]?.details?.id;
    if (id) return String(id);
    console.error('[crm] contact upsert failed:', JSON.stringify(d));
  } catch (e: any) { console.error('[crm] create contact error:', e.message); }
  return null;
}

async function createOrUpdateCrmDeal(opts: { contactId: string | null; email: string; plan: string; amount?: number }): Promise<string | null> {
  const token = await getCrmAccessToken();
  if (!token) return null;
  try {
    const dealName = `IronVault ${opts.plan.charAt(0).toUpperCase() + opts.plan.slice(1)} — ${opts.email}`;
    const body: any = { Deal_Name: dealName, Stage: 'Closed Won', Amount: opts.amount ?? (opts.plan === 'pro' ? 9.99 : opts.plan === 'lifetime' ? 49.99 : 0), Lead_Source: 'Web Site' };
    if (opts.contactId) body.Contact_Id = opts.contactId;
    const r = await fetch('https://www.zohoapis.in/crm/v7/Deals', {
      method: 'POST',
      headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [body] }),
    });
    const d = await r.json() as any;
    const id = d.data?.[0]?.details?.id;
    if (id) return String(id);
    console.error('[crm] deal create failed:', JSON.stringify(d));
  } catch (e: any) { console.error('[crm] create deal error:', e.message); }
  return null;
}

// ── Zoho SMTP email service ────────────────────────────────────────────────────
// _FROM_ADDR is the Zoho SMTP auth username — must remain the real mailbox
// the workspace was provisioned with. _FROM_DISPLAY is what recipients see
// in their inbox; we route all outbound mail under the noreply@ alias so
// users don't accidentally reply into a personal address. The alias must
// be configured under "Send-as" on the saket@ Zoho account for SMTP to
// accept the From header.
const _FROM_ADDR    = 'saket@ironvault.app';
const _FROM_DISPLAY = 'noreply@ironvault.app';
const _FROM_NAME    = 'IronVault';
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
    // Split-envelope sender: SMTP MAIL FROM = saket@ (the authed mailbox
    // Zoho will accept and DKIM-sign), while the visible From: header
    // shows noreply@ (what the user sees in Gmail). Both addresses are
    // on @ironvault.app so DMARC relaxed-alignment is preserved.
    // Without this split, nodemailer derives MAIL FROM from `from`, and
    // Zoho silently drops alias-submitted messages — the SMTP transaction
    // returns 250 OK and a Message-ID, but the message never leaves
    // Zoho's outbound queue. Symptom: [email] sent logs success, user
    // never receives anything.
    const result = await _getTransporter().sendMail({
      from: `"${_FROM_NAME}" <${_FROM_DISPLAY}>`,
      replyTo: _FROM_DISPLAY,
      sender: _FROM_ADDR,
      envelope: { from: _FROM_ADDR, to },
      to, subject, html,
    });
    console.log('[email] sent:', subject, '→', to, result.messageId);
    return true;
  } catch (e: any) { console.error('[email] Zoho send error', e.message); return false; }
}
function _emailLayout(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:40px 20px 60px"><div style="text-align:center;margin-bottom:28px"><img src="https://www.ironvault.app/icon-192.png" alt="IronVault" width="48" height="48" style="display:inline-block;vertical-align:middle;border-radius:11px;border:0" /><span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:21px;font-weight:700;color:#111827;letter-spacing:-0.3px">IronVault</span></div><div style="background:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.04)">${body}</div><div style="text-align:center;padding:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.7"><p style="margin:0">© 2026 IronVault — Secure Password Manager</p><p style="margin:4px 0 0"><a href="mailto:noreply@ironvault.app" style="color:#6366f1;text-decoration:none">noreply@ironvault.app</a></p></div></div></body></html>`;
}
function _eh1(t: string) { return `<h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;text-align:center;letter-spacing:-0.4px">${t}</h1>`; }
function _ep(t: string)  { return `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#6b7280;text-align:center">${t}</p>`; }
function _ebtn(u: string, l: string) { return `<div style="text-align:center;margin:8px 0 24px"><a href="${u}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 32px;font-weight:600;font-size:15px;letter-spacing:-0.1px">${l}</a></div>`; }
function _ecard(i: string) { return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;margin:0 0 24px">${i}</div>`; }
function _edivider() { return `<hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0">`; }
function welcomeEmail(name: string) {
  const body = `${_eh1(`Welcome to IronVault, ${name||'there'}!`)}${_ep('Your secure vault account has been created. Everything you store is AES-256 encrypted.')}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Getting started</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>Create your vault and master password</li><li>Add passwords, notes, reminders</li><li>Track subscriptions and expenses</li></ul>`)}${_ebtn(_APP_URL,'Open IronVault')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">You're receiving this because you created an IronVault account.</p>`;
  return { subject: 'Welcome to IronVault', html: _emailLayout(body) };
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
  const body = `${_eh1('We received your ticket')}${_ep('Our support team will get back to you within 24 hours.')}${_ecard(`<p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Ticket #${id}</p><p style="margin:0;font-size:15px;font-weight:600;color:#111827">${sub}</p>`)}${_ebtn('mailto:noreply@ironvault.app','Reply via Email')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">You can also reply directly to this email to update your ticket.</p>`;
  return { subject: `[IronVault Support] Ticket received: ${sub}`, html: _emailLayout(body) };
}
function ticketReplyEmail(id: string|number, preview: string) {
  const body = `${_eh1('New reply on your ticket')}${_ep(`Our support team has responded to ticket <strong style="color:#111827">#${id}</strong>.`)}${_ecard(`<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Reply preview</p><p style="margin:0;font-size:14px;color:#374151;font-style:italic">"${String(preview).slice(0,200)}"</p>`)}${_ebtn('mailto:noreply@ironvault.app','Reply')}`;
  return { subject: `[IronVault Support] Update on ticket #${id}`, html: _emailLayout(body) };
}
function ticketClosedEmail(id: string|number) {
  const body = `${_eh1('Ticket resolved')}${_ep(`Ticket <strong style="color:#111827">#${id}</strong> has been marked as resolved.`)}${_ecard(`<p style="margin:0;font-size:14px;color:#374151">We hope your issue was resolved. If you need further help, feel free to reach out — we're always here.</p>`)}${_ebtn('mailto:noreply@ironvault.app','Contact Support Again')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">Reply to this email if you need further assistance.</p>`;
  return { subject: `[IronVault Support] Ticket #${id} resolved`, html: _emailLayout(body) };
}
function planUpgradeEmail(plan: string) {
  const label = plan==='lifetime'?'Lifetime':plan==='family'?'Family':'Pro';
  const body = `${_eh1(`You're now on ${label}!`)}${_ep(`Your IronVault account has been upgraded to <strong style="color:#111827">${label}</strong>. All premium features are now unlocked.`)}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">What's included</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>Unlimited vaults</li><li>Cloud sync across devices</li><li>Priority support</li></ul>`)}${_ebtn(_APP_URL,'Open IronVault')}`;
  return { subject: `You're now on IronVault ${label} ⭐`, html: _emailLayout(body) };
}
function vaultReadyEmail(vaultName: string) {
  const body = `${_eh1('Your vault is ready 🔒')}${_ep(`<strong style="color:#111827">${vaultName || 'Your vault'}</strong> has been created and encrypted with your master password.`)}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">What you can store</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>Passwords &amp; login credentials</li><li>Secure notes &amp; documents</li><li>Financial data &amp; subscriptions</li><li>Reminders &amp; goals</li></ul>`)}${_ebtn(_APP_URL,'Open IronVault')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">Keep your master password safe — it cannot be recovered.</p>`;
  return { subject: 'Your IronVault vault is ready! 🔒', html: _emailLayout(body) };
}
function familyInviteEmail(ownerEmail: string, inviteId: string, inviteeEmail: string) {
  const ownerHandle = ownerEmail.split('@')[0];
  const inviteLink = `${_APP_URL}/auth/signup?invite=${encodeURIComponent(inviteId)}&email=${encodeURIComponent(inviteeEmail)}`;
  const body = `${_eh1(`Join ${ownerHandle}'s IronVault Family!`)}${_ep(`<strong style="color:#111827">${ownerEmail}</strong> has invited you to their IronVault Family plan — you get full premium access at no cost.`)}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">What you get</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>2 vaults total (any mix of local + cloud, your own private)</li><li>Cloud sync across all your devices</li><li>Unlimited passwords, notes &amp; documents</li><li>Expense tracking &amp; bank statement import</li></ul>`)}${_ebtn(inviteLink,`Join ${ownerHandle}'s Family Plan`)}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">Sign in or create a free IronVault account to accept. If you didn't expect this, you can safely ignore this email.</p>`;
  return { subject: `${ownerEmail} invited you to IronVault Family`, html: _emailLayout(body) };
}
// ── End email service ──────────────────────────────────────────────────────────

// ── n8n webhook triggers (fire-and-forget) ────────────────────────────────────
const N8N_SIGNUP_WEBHOOK         = 'https://saketapptest.app.n8n.cloud/webhook/ironvault-signup';
const N8N_PAYMENT_WEBHOOK        = 'https://saketapptest.app.n8n.cloud/webhook/razorpay-payment';
const N8N_PAYMENT_FAILED_WEBHOOK = 'https://saketapptest.app.n8n.cloud/webhook/razorpay-failed';

function triggerN8n(url: string, payload: unknown): void {
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((r) => console.log(`[n8n] POST ${url} → ${r.status}`))
    .catch((e) => console.error(`[n8n] POST ${url} failed:`, e.message));
}

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
  'https://admin.ironvault.app',
  'capacitor://localhost',   // Capacitor iOS native
  'http://localhost',        // Capacitor Android native
  'https://localhost',       // Capacitor Android (HTTPS mode)
];

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

// ── In-memory rate limiter for /api/auth/token ───────────────────────────────
// Tracks failed login attempts per client IP. After 5 failures within a 15-min
// rolling window, returns 429. The Map persists across requests within the same
// Fluid Compute instance — this is best-effort, not a distributed lock. For the
// QA-audit threat model (credential-stuffing from a single source) it is the
// right granularity; multi-instance bypass is acceptable.
const _RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const _RATE_LIMIT_MAX = 5;
const _loginFailures = new Map<string, number[]>();

function _pruneFailures(ip: string, now: number) {
  const arr = _loginFailures.get(ip);
  if (!arr) return;
  const cutoff = now - _RATE_LIMIT_WINDOW_MS;
  const fresh = arr.filter(t => t > cutoff);
  if (fresh.length === 0) _loginFailures.delete(ip);
  else _loginFailures.set(ip, fresh);
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  _pruneFailures(ip, now);
  return (_loginFailures.get(ip)?.length ?? 0) >= _RATE_LIMIT_MAX;
}

function recordLoginFailure(ip: string) {
  const now = Date.now();
  _pruneFailures(ip, now);
  const arr = _loginFailures.get(ip) ?? [];
  arr.push(now);
  _loginFailures.set(ip, arr);
}

function clearLoginFailures(ip: string) {
  _loginFailures.delete(ip);
}

function setSecurityHeaders(res: VercelResponse) {
  // 'unsafe-inline' is currently required because the Razorpay checkout SDK
  // injects inline event handlers into its iframe shell. We accept the trade-off
  // for now; XSS sinks in user content are mitigated separately (DOMPurify on
  // notes, etc.). Migrate to nonce-based CSP when Razorpay supports it.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.ironvault.app https://api.razorpay.com; frame-src https://api.razorpay.com"
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

// DuckDuckGo's icon endpoint returns a fixed-size globe ICO when it has no
// real favicon for a domain. The exact byte length is stable but we don't
// hardcode it — probe a guaranteed-unknown domain once and memoize.
let _ddgPlaceholderSize: number | null = null;
let _ddgPlaceholderProbed = false;
async function getDdgPlaceholderSize(): Promise<number | null> {
  if (_ddgPlaceholderProbed) return _ddgPlaceholderSize;
  _ddgPlaceholderProbed = true;
  try {
    const r = await fetch('https://icons.duckduckgo.com/ip3/no-such-domain-zzz999.example.ico');
    if (r.ok) _ddgPlaceholderSize = (await r.arrayBuffer()).byteLength;
  } catch { /* leave as null — placeholder check will be skipped */ }
  return _ddgPlaceholderSize;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);

  const origin = req.headers.origin as string | undefined;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // Same-origin or server-to-server requests (no Origin header)
    res.setHeader("Access-Control-Allow-Origin", "https://www.ironvault.app");
  }
  // If a browser sends an Origin and it's not in the allowlist, ACAO is simply
  // not set — the browser will block the response. No wildcard fallback.
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(200).end();

  const path = (req.url || "").replace(/\?.*$/, "");

  // ── Health ──────────────────────────────────────────────────────────────────
  if (path === "/api/health" || path === "/api/health/" || path === "/api/healthz" || path === "/api/healthz/") {
    return res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: "vercel",
      db: !!process.env.DATABASE_URL,
    });
  }

  // ── Version ─────────────────────────────────────────────────────────────────
  if (path === "/api/version" || path === "/api/version/") {
    return res.json({
      version: "1.0.0",
      build: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "dev",
      timestamp: new Date().toISOString(),
    });
  }

  // ── Plans ───────────────────────────────────────────────────────────────────
  // Public — mirrors client/src/lib/plans.ts. Mobile clients hit this so they
  // don't have to ship updated bundles when pricing changes.
  if (path === "/api/plans" || path === "/api/plans/") {
    return res.json({
      plans: [
        { id: 'free',     name: 'Free',        priceMonthly: 0,    priceYearly: 0,    priceOneTime: null, seats: 1, vaultLimit: 1,  available: true },
        { id: 'pro',      name: 'Pro Monthly', priceMonthly: 149,  priceYearly: 1499, priceOneTime: null, seats: 1, vaultLimit: 5,  available: true },
        { id: 'family',   name: 'Pro Family',  priceMonthly: 299,  priceYearly: 2999, priceOneTime: null, seats: 6, vaultLimit: 5,  available: true },
        { id: 'lifetime', name: 'Lifetime',    priceMonthly: null, priceYearly: null, priceOneTime: 9999, seats: 1, vaultLimit: 5,  available: true },
      ],
    });
  }

  // ── /api/favicon — first-party proxy for site favicons ────────────────────
  // Browser ad-blockers filter third-party icon services (Google s2, DuckDuckGo,
  // Clearbit, etc.), which made favicons render as empty circles for many users.
  // Fetching same-origin and proxying server-side bypasses those filter lists.
  if (path === "/api/favicon" && req.method === "GET") {
    const domain = (req.query?.d as string | undefined)?.toLowerCase();
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || domain.length > 253) {
      return res.status(400).send('Invalid domain');
    }
    try {
      const upstream = await fetch(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
      if (!upstream.ok) return res.status(404).send('Not found');
      const buffer = Buffer.from(await upstream.arrayBuffer());
      // DuckDuckGo serves a fixed-size globe placeholder for unknown domains.
      // Detect via byte length so the client letter-avatar fallback fires
      // instead of rendering a generic globe. Size is learned lazily by
      // probing a guaranteed-unknown domain on the first call.
      const placeholderSize = await getDdgPlaceholderSize();
      if (placeholderSize !== null && buffer.length === placeholderSize) {
        return res.status(404).send('No icon');
      }
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/x-icon');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.send(buffer);
    } catch {
      return res.status(404).send('Not found');
    }
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
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    try {
      // Always operate on the authenticated user — never trust body-supplied identity.
      await db.query(
        `UPDATE customers SET last_active = NOW(), updated_at = NOW() WHERE email = $1`,
        [cloudUser.email]
      );
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── /api/crm/vaults/sync ────────────────────────────────────────────────────
  if (path === "/api/crm/vaults/sync" && req.method === "POST") {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    const { vaultCount } = req.body || {};
    try {
      await db.query(
        `UPDATE customers SET last_active = NOW(), updated_at = NOW() WHERE email = $1`,
        [cloudUser.email]
      );
      return res.json({ success: true, vaultCount: vaultCount || 0, synced: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed' });
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
      // Upsert CRM contact so ticket submitters appear in Zoho CRM
      createCrmContact({ email, firstName: email.split('@')[0], lastName: 'IronVault User', source: 'Support Ticket' }).catch(() => {});
      return res.json({ success: true, ticket: { id: ticketId, zoho: !!zdTicket } });
    } catch (err: any) {
      console.error("ticket create error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PATCH /api/crm/tickets/:id ──────────────────────────────────────────────
  // Admin-only: requires ADMIN_API_KEY (or JWT_SECRET fallback)
  if (path.match(/^\/api\/crm\/tickets\/[^/]+$/) && req.method === "PATCH") {
    const adminKey = req.headers['x-admin-key'] as string;
    const expectedAdminKey = process.env.ADMIN_API_KEY || process.env.JWT_SECRET;
    if (!adminKey || !expectedAdminKey || !safeEq(adminKey, expectedAdminKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── GET /api/crm/tickets/:email ──────────────────────────────────────────────
  if (path.startsWith("/api/crm/tickets/") && req.method === "GET") {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    // Authenticated user can only fetch their own tickets — ignore the path param.
    try {
      const { rows } = await db.query(
        `SELECT * FROM tickets WHERE customer_email = $1 ORDER BY created_at DESC`, [cloudUser.email]
      );
      return res.json({ tickets: rows, total: rows.length });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── Cloud vault helpers (manual HS256 JWT — avoids jsonwebtoken ESM issues) ──
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error('[fatal] JWT_SECRET env var is not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

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

  function verifyCloudToken(token: string): { userId: string; email: string; iat: number } | null {
    try {
      const [header, payload, sig] = token.split('.');
      if (!header || !payload || !sig) return null;
      const expected = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
      if (!safeEq(expected, sig)) return null;
      const data = JSON.parse(Buffer.from(payload, 'base64').toString());
      if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
      return { userId: data.userId, email: data.email, iat: data.iat || 0 };
    } catch { return null; }
  }

  function getCloudUser(req: VercelRequest): { userId: string; email: string } | null {
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return null;
    return verifyCloudToken(auth.substring(7));
  }

  function getCloudUserToken(req: VercelRequest): string | null {
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.substring(7);
  }

  function hashJwtToken(token: string): string {
    return createHmac('sha256', JWT_SECRET).update(token).digest('hex');
  }

  function getClientIp(req: VercelRequest): string {
    const xff = (req.headers['x-forwarded-for'] as string) || '';
    const first = xff.split(',')[0]?.trim();
    return first || (req.headers['x-real-ip'] as string) || (req.socket?.remoteAddress as string) || 'unknown';
  }

  function parseUserAgent(ua: string | undefined): { browser: string; os: string; deviceName: string } {
    const s = ua || '';
    let browser = 'Unknown';
    if (/Edg\//i.test(s)) browser = 'Edge';
    else if (/OPR\/|Opera/i.test(s)) browser = 'Opera';
    else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
    else if (/Firefox\//i.test(s)) browser = 'Firefox';
    else if (/Safari\//i.test(s) && !/Chrome\//i.test(s)) browser = 'Safari';
    else if (/Chromium/i.test(s)) browser = 'Chromium';
    let os = 'Unknown';
    if (/Windows NT/i.test(s)) os = 'Windows';
    else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
    else if (/Android/i.test(s)) os = 'Android';
    else if (/iPhone|iPad|iOS/i.test(s)) os = 'iOS';
    else if (/Linux/i.test(s)) os = 'Linux';
    return { browser, os, deviceName: `${browser} on ${os}` };
  }

  // Idempotent table provisioning (called from endpoints below). Wrapped in
  // try so missing privileges don't 500 — re-issuing the migration via the
  // first POST that needs the table is the same pattern as auth_verification_codes.
  async function ensureSessionAndActivityTables(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS extension_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          device_name TEXT,
          browser TEXT,
          os TEXT,
          ip_address TEXT,
          user_agent TEXT,
          client_kind TEXT,
          jwt_token_hash TEXT NOT NULL,
          last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at TIMESTAMPTZ,
          is_active BOOLEAN NOT NULL DEFAULT true
        )
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_extension_sessions_user ON extension_sessions(user_id, is_active)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_extension_sessions_hash ON extension_sessions(jwt_token_hash)`);
      await db.query(`
        CREATE TABLE IF NOT EXISTS vault_activity (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          session_id UUID,
          action TEXT NOT NULL,
          item_type TEXT,
          item_title TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_vault_activity_user ON vault_activity(user_id, created_at DESC)`);
    } catch (e: any) {
      console.error('[ensureSessionAndActivityTables]', e.message);
    }
  }

  async function getActiveSessionByToken(token: string): Promise<{ id: string; userId: string } | null> {
    try {
      const hash = hashJwtToken(token);
      const { rows } = await db.query(
        `SELECT id, user_id FROM extension_sessions WHERE jwt_token_hash = $1 AND is_active = true LIMIT 1`,
        [hash]
      );
      if (!rows[0]) return null;
      return { id: rows[0].id, userId: rows[0].user_id };
    } catch {
      return null;
    }
  }

  // ── TOTP / 2FA helpers ──────────────────────────────────────────────────────
  // First-call provisioning: ALTER TABLE only adds columns that don't exist, so
  // re-running on every request is cheap and lets us roll out without a separate
  // migration step. Same pattern as ensureSessionAndActivityTables above.
  let _totpColumnsEnsured = false;
  async function ensureTotpColumns(): Promise<void> {
    if (_totpColumnsEnsured) return;
    try {
      await db.query(`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS totp_secret TEXT`);
      await db.query(`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false`);
      await db.query(`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[]`);
      // password_changed_at supports JWT invalidation on password change.
      await db.query(`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ`);
      _totpColumnsEnsured = true;
    } catch (e: any) {
      console.error('[ensureTotpColumns]', e.message);
    }
  }

  // Short-lived (5 min) JWT carrying only `sub: userId, email, purpose: '2fa_pending'`.
  // Issued after password verification when 2FA is enabled, exchanged for a real
  // session token at /api/auth/2fa/validate. Distinct purpose claim prevents reuse
  // as a session token.
  function signTwoFactorPending(userId: string, email: string): string {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = b64url(JSON.stringify({ userId, email, purpose: '2fa_pending', exp: now + 5 * 60, iat: now }));
    const sig = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
    return `${header}.${payload}.${sig}`;
  }

  function verifyTwoFactorPending(token: string): { userId: string; email: string } | null {
    try {
      const [header, payload, sig] = token.split('.');
      if (!header || !payload || !sig) return null;
      const expected = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
      if (!safeEq(expected, sig)) return null;
      const data = JSON.parse(Buffer.from(payload, 'base64').toString());
      if (data.purpose !== '2fa_pending') return null;
      if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
      return { userId: data.userId, email: data.email };
    } catch { return null; }
  }

  function generateBackupCodes(count = 10): string[] {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const bytes = randomBytes(8);
      const half1 = Array.from(bytes.slice(0, 4)).map(b => alphabet[b % alphabet.length]).join('');
      const half2 = Array.from(bytes.slice(4, 8)).map(b => alphabet[b % alphabet.length]).join('');
      codes.push(`${half1}-${half2}`);
    }
    return codes;
  }

  function hashBackupCode(code: string): string {
    // Strip dashes/whitespace and uppercase before hashing so user input format is forgiving.
    const normalized = code.replace(/[-\s]/g, '').toUpperCase();
    return createHmac('sha256', JWT_SECRET).update(normalized).digest('hex');
  }

  async function verifyTotpOrBackup(userId: string, code: string): Promise<{ ok: true; usedBackup?: boolean } | { ok: false }> {
    const trimmed = code.trim();
    const { rows } = await db.query(
      `SELECT totp_secret, totp_enabled, totp_backup_codes FROM crm_users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const row = rows[0];
    if (!row || !row.totp_secret) return { ok: false };
    let plainSecret: string;
    try { plainSecret = decryptTotpSecret(row.totp_secret); }
    catch { return { ok: false }; }
    // Try TOTP first (6-digit numeric).
    if (/^\d{6}$/.test(trimmed)) {
      try {
        const r = totpVerifySync({ secret: plainSecret, token: trimmed, epochTolerance: TOTP_TOLERANCE_SECONDS });
        if (r.valid) return { ok: true };
      } catch { /* fall through */ }
    }
    // Fall back to backup codes.
    const codeHash = hashBackupCode(trimmed);
    const backupCodes: string[] = row.totp_backup_codes || [];
    const idx = backupCodes.indexOf(codeHash);
    if (idx === -1) return { ok: false };
    // Consume the code (single use).
    const remaining = backupCodes.filter((_: string, i: number) => i !== idx);
    await db.query(`UPDATE crm_users SET totp_backup_codes = $1 WHERE id = $2`, [remaining, userId]);
    return { ok: true, usedBackup: true };
  }

  // ── POST /api/auth/2fa/setup — generate secret, return QR ───────────────────
  if (path === '/api/auth/2fa/setup' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensureTotpColumns();
    try {
      // Block re-setup if already enabled — caller must disable first.
      const { rows } = await db.query(`SELECT totp_enabled FROM crm_users WHERE id = $1 LIMIT 1`, [cloudUser.userId]);
      if (rows[0]?.totp_enabled) {
        return res.status(400).json({ error: '2FA is already enabled. Disable it first to re-setup.' });
      }
      const secret = totpGenerateSecret();
      const otpauthUrl = totpGenerateURI({ issuer: 'IronVault', label: cloudUser.email, secret });
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 });
      // Encrypt secret at rest (AES-256-GCM with key derived from JWT_SECRET).
      const encryptedSecret = encryptTotpSecret(secret);
      await db.query(
        `UPDATE crm_users SET totp_secret = $1, totp_enabled = false WHERE id = $2`,
        [encryptedSecret, cloudUser.userId]
      );
      // Note: secret is intentionally NOT echoed back — the QR + otpauthUrl
      // already carry it. Reduces accidental log/cache exposure.
      return res.json({ otpauthUrl, qrDataUrl });
    } catch (err: any) {
      console.error('[2fa/setup]', err.message);
      return res.status(500).json({ error: '2FA setup failed' });
    }
  }

  // ── POST /api/auth/2fa/verify — enable 2FA after user confirms code ─────────
  if (path === '/api/auth/2fa/verify' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'code required' });
    await ensureTotpColumns();
    try {
      const { rows } = await db.query(`SELECT totp_secret FROM crm_users WHERE id = $1 LIMIT 1`, [cloudUser.userId]);
      const storedSecret = rows[0]?.totp_secret;
      if (!storedSecret) return res.status(400).json({ error: 'Run /api/auth/2fa/setup first' });
      let secret: string;
      try { secret = decryptTotpSecret(storedSecret); }
      catch { return res.status(500).json({ error: '2FA verification failed' }); }
      const v = totpVerifySync({ secret, token: code.trim(), epochTolerance: TOTP_TOLERANCE_SECONDS });
      if (!v.valid) {
        return res.status(401).json({ error: 'Invalid code' });
      }
      const backupCodes = generateBackupCodes(10);
      const hashedBackup = backupCodes.map(hashBackupCode);
      await db.query(
        `UPDATE crm_users SET totp_enabled = true, totp_backup_codes = $1 WHERE id = $2`,
        [hashedBackup, cloudUser.userId]
      );
      return res.json({ enabled: true, backupCodes });
    } catch (err: any) {
      console.error('[2fa/verify]', err.message);
      return res.status(500).json({ error: '2FA verification failed' });
    }
  }

  // ── POST /api/auth/2fa/disable — requires valid code, clears secret ─────────
  if (path === '/api/auth/2fa/disable' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'code required' });
    await ensureTotpColumns();
    try {
      const v = await verifyTotpOrBackup(cloudUser.userId, code);
      if (!v.ok) return res.status(401).json({ error: 'Invalid code' });
      await db.query(
        `UPDATE crm_users SET totp_enabled = false, totp_secret = NULL, totp_backup_codes = NULL WHERE id = $1`,
        [cloudUser.userId]
      );
      return res.json({ disabled: true });
    } catch (err: any) {
      console.error('[2fa/disable]', err.message);
      return res.status(500).json({ error: '2FA disable failed' });
    }
  }

  // ── POST /api/auth/2fa/validate — finish login after password step ──────────
  // Body: { tempToken, code }. tempToken is the short-lived 2fa_pending JWT issued
  // by /api/auth/token when totp_enabled is true. Returns a real session token.
  if (path === '/api/auth/2fa/validate' && req.method === 'POST') {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    const { tempToken, code } = req.body || {};
    if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code required' });
    const pending = verifyTwoFactorPending(tempToken);
    if (!pending) {
      recordLoginFailure(clientIp);
      return res.status(401).json({ error: 'Invalid or expired 2FA challenge' });
    }
    await ensureTotpColumns();
    try {
      const v = await verifyTotpOrBackup(pending.userId, code);
      if (!v.ok) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid code' });
      }
      clearLoginFailures(clientIp);
      const token = signCloudToken(pending.userId, pending.email);
      // Mirror /api/auth/token: register session row so this device shows up
      // under Active Sessions and the extension session_check works.
      let sessionId: string | null = null;
      try {
        await ensureSessionAndActivityTables();
        const ua = (req.headers['user-agent'] as string) || '';
        const clientKind = (req.headers['x-iv-client'] as string) || 'web';
        const { browser, os, deviceName } = parseUserAgent(ua);
        const ip = getClientIp(req);
        const tokenHash = hashJwtToken(token);
        const { rows: sessRows } = await db.query(
          `INSERT INTO extension_sessions (user_id, device_name, browser, os, ip_address, user_agent, client_kind, jwt_token_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [pending.userId, deviceName, browser, os, ip, ua, clientKind, tokenHash]
        );
        sessionId = sessRows[0]?.id || null;
      } catch (e: any) {
        console.error('[2fa/validate] session register failed:', e.message);
      }
      db.query(`UPDATE crm_users SET last_active_at = NOW() WHERE id = $1`, [pending.userId])
        .catch((e: any) => console.error('[2fa/validate] last_active_at update failed:', e.message));
      return res.json({ success: true, token, userId: pending.userId, email: pending.email, sessionId, usedBackup: v.usedBackup === true });
    } catch (err: any) {
      console.error('[2fa/validate]', err.message);
      return res.status(500).json({ error: '2FA validation failed' });
    }
  }

  // ── GET /api/auth/2fa/status — return enabled flag for current user ─────────
  if (path === '/api/auth/2fa/status' && req.method === 'GET') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensureTotpColumns();
    try {
      const { rows } = await db.query(
        `SELECT totp_enabled, COALESCE(array_length(totp_backup_codes, 1), 0) AS backup_count FROM crm_users WHERE id = $1 LIMIT 1`,
        [cloudUser.userId]
      );
      return res.json({ enabled: !!rows[0]?.totp_enabled, backupCodesRemaining: rows[0]?.backup_count ?? 0 });
    } catch (err: any) {
      console.error('[2fa/status]', err.message);
      return res.status(500).json({ error: '2FA status failed' });
    }
  }

  // ── POST /api/auth/2fa/backup-codes — regenerate (replaces existing) ────────
  if (path === '/api/auth/2fa/backup-codes' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'code required' });
    await ensureTotpColumns();
    try {
      const { rows } = await db.query(`SELECT totp_enabled FROM crm_users WHERE id = $1 LIMIT 1`, [cloudUser.userId]);
      if (!rows[0]?.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });
      const v = await verifyTotpOrBackup(cloudUser.userId, code);
      if (!v.ok) return res.status(401).json({ error: 'Invalid code' });
      const backupCodes = generateBackupCodes(10);
      const hashedBackup = backupCodes.map(hashBackupCode);
      await db.query(`UPDATE crm_users SET totp_backup_codes = $1 WHERE id = $2`, [hashedBackup, cloudUser.userId]);
      return res.json({ backupCodes });
    } catch (err: any) {
      console.error('[2fa/backup-codes]', err.message);
      return res.status(500).json({ error: 'backup code regeneration failed' });
    }
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
    const { email, accountPasswordHash, fullName, country, phone, company, planType, marketingConsent, address, city, state, postalCode } = req.body || {};
    if (!email || !accountPasswordHash) return res.status(400).json({ error: 'email and accountPasswordHash required' });
    if (!/^[a-f0-9]{64}$/i.test(accountPasswordHash)) {
      return res.status(400).json({ error: 'Invalid password hash format' });
    }
    const normalizedEmail = (email as string).toLowerCase().trim();
    const safeFullName = fullName ? stripHtml(String(fullName)) : normalizedEmail.split('@')[0];
    try {
      const { rows: existing } = await db.query(
        `SELECT id FROM crm_users WHERE email = $1 LIMIT 1`, [normalizedEmail]
      );
      if (existing[0]) return res.status(409).json({ error: 'An account with this email already exists.' });

      const tokenChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const verifyToken = cryptoRandomString(64, tokenChars);
      const storedHash = await hashAccountPassword(accountPasswordHash);

      const { rows: newUser } = await db.query(
        `INSERT INTO crm_users (email, full_name, country, marketing_consent, support_consent, account_password_hash, account_status, verification_token, verification_token_expires_at)
         VALUES ($1, $2, $3, $4, true, $5, 'pending_verification', $6, NOW() + INTERVAL '24 hours')
         RETURNING id`,
        [normalizedEmail, safeFullName, country || 'US', marketingConsent || false, storedHash, verifyToken]
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

      // Fire-and-forget: sync new signup to Zoho CRM with all collected fields
      const nameParts = safeFullName.split(' ');
      createCrmContact({
        email: normalizedEmail,
        firstName: nameParts[0] || safeFullName,
        lastName: nameParts.slice(1).join(' ') || normalizedEmail,
        source: 'Web Site',
        phone: phone || undefined,
        country: country || 'US',
        plan: planType || 'free',
        company: company || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        postalCode: postalCode || undefined,
      }).catch(() => {});

      // n8n onboarding-drip is intentionally NOT fired here — we only kick
      // it off after the user verifies their email (see /api/auth/verify-email
      // below). Otherwise the welcome/drip email collides with the
      // verification email and arrives before the account is usable.

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
        `SELECT id, full_name, verification_token, verification_token_expires_at, account_status FROM crm_users WHERE email = $1 LIMIT 1`,
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
      // Send welcome email now that the account is verified
      const displayName = user.full_name || normalizedEmail.split('@')[0];
      sendEmail({ to: normalizedEmail, ...welcomeEmail(displayName) }).catch(() => {});

      // Fire-and-forget: kick off the n8n onboarding-drip workflow now that
      // the email is verified. Plan lives on entitlements (crm_users has
      // no plan column), so look it up — fall back to 'free' if missing.
      let onboardingPlan = 'free';
      try {
        const { rows: entRows } = await db.query(
          `SELECT plan FROM entitlements WHERE user_id = $1 LIMIT 1`,
          [user.id]
        );
        if (entRows[0]?.plan) onboardingPlan = entRows[0].plan;
      } catch { /* ignore — webhook still fires with default */ }
      triggerN8n(N8N_SIGNUP_WEBHOOK, {
        email: normalizedEmail,
        name: displayName,
        plan: onboardingPlan,
      });

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
      const verifyToken = cryptoRandomString(64, tokenChars);
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
  // Constant response: this endpoint used to leak account existence (a perfect
  // user-enumeration oracle). Always return { ok: true } regardless of input.
  // Real existence checks now live behind authenticated paths (signup attempts
  // collide on the unique index; password reset is silent).
  if (path === '/api/auth/check' && req.method === 'GET') {
    return res.json({ ok: true });
  }

  // ── POST /api/auth/send-verification-code ──────────────────────────────────
  // Generic 6-digit code-by-email endpoint used by Security flows that need a
  // second factor (currently: master-password change). The code is hashed at
  // rest with HMAC(JWT_SECRET) and expires in 10 minutes. Single outstanding
  // code per (email, purpose) — issuing a new one supersedes the previous.
  if (path === '/api/auth/send-verification-code' && req.method === 'POST') {
    const { email, purpose } = req.body || {};
    const normalizedEmail = (email as string || '').toLowerCase().trim();
    const normalizedPurpose = (purpose as string || 'master_password_change').trim();
    if (!normalizedEmail) return res.status(400).json({ error: 'email required' });
    const allowedPurposes = new Set(['master_password_change']);
    if (!allowedPurposes.has(normalizedPurpose)) {
      return res.status(400).json({ error: 'Invalid purpose' });
    }
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS auth_verification_codes (
          email TEXT NOT NULL,
          purpose TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          attempts INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (email, purpose)
        )
      `);
      const code = String(randomInt(100000, 1000000));
      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).json({ error: 'Server misconfigured' });
      const codeHash = createHmac('sha256', secret).update(`${normalizedEmail}:${normalizedPurpose}:${code}`).digest('hex');
      await db.query(
        `INSERT INTO auth_verification_codes (email, purpose, code_hash, expires_at, attempts)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0)
         ON CONFLICT (email, purpose) DO UPDATE
         SET code_hash = EXCLUDED.code_hash,
             expires_at = EXCLUDED.expires_at,
             attempts = 0,
             created_at = NOW()`,
        [normalizedEmail, normalizedPurpose, codeHash],
      );
      const subject = 'Your IronVault security code';
      const body = `${_eh1('Confirm your master password change')}${_ep('Use the 6-digit code below to confirm changing your IronVault master password. The code expires in <strong style="color:#111827">10 minutes</strong>.')}${_ecard(`<div style="text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;color:#111827;font-family:'SF Mono','Menlo',monospace">${code}</div>`)}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">If you didn't request this, your account password is still safe — just ignore this email and consider changing your account password.</p>`;
      const sent = await sendEmail({ to: normalizedEmail, subject, html: _emailLayout(body) });
      return res.json({ ok: true, emailSent: sent });
    } catch (err: any) {
      console.error('send-verification-code error:', err.message);
      return res.status(500).json({ error: 'Failed to send code' });
    }
  }

  // ── POST /api/auth/verify-code ─────────────────────────────────────────────
  // Verifies a code issued by send-verification-code. On success, deletes the
  // code (single-use). Limits to 5 wrong attempts per code.
  if (path === '/api/auth/verify-code' && req.method === 'POST') {
    const { email, purpose, code } = req.body || {};
    const normalizedEmail = (email as string || '').toLowerCase().trim();
    const normalizedPurpose = (purpose as string || 'master_password_change').trim();
    const normalizedCode = (code as string || '').trim();
    if (!normalizedEmail || !normalizedCode) return res.status(400).json({ error: 'email and code required' });
    try {
      const { rows } = await db.query(
        `SELECT code_hash, expires_at, attempts FROM auth_verification_codes WHERE email = $1 AND purpose = $2 LIMIT 1`,
        [normalizedEmail, normalizedPurpose],
      );
      if (!rows[0]) return res.status(400).json({ error: 'No active code. Please request a new one.' });
      if (rows[0].attempts >= 5) {
        await db.query(`DELETE FROM auth_verification_codes WHERE email = $1 AND purpose = $2`, [normalizedEmail, normalizedPurpose]);
        return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
      }
      if (new Date(rows[0].expires_at) < new Date()) {
        await db.query(`DELETE FROM auth_verification_codes WHERE email = $1 AND purpose = $2`, [normalizedEmail, normalizedPurpose]);
        return res.status(400).json({ error: 'Code expired. Please request a new one.' });
      }
      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).json({ error: 'Server misconfigured' });
      const candidateHash = createHmac('sha256', secret).update(`${normalizedEmail}:${normalizedPurpose}:${normalizedCode}`).digest('hex');
      if (candidateHash !== rows[0].code_hash) {
        await db.query(`UPDATE auth_verification_codes SET attempts = attempts + 1 WHERE email = $1 AND purpose = $2`, [normalizedEmail, normalizedPurpose]);
        return res.status(400).json({ error: 'Incorrect code.' });
      }
      // Single-use: consume on success
      await db.query(`DELETE FROM auth_verification_codes WHERE email = $1 AND purpose = $2`, [normalizedEmail, normalizedPurpose]);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error('verify-code error:', err.message);
      return res.status(500).json({ error: 'Failed to verify code' });
    }
  }

  // ── POST /api/auth/token ────────────────────────────────────────────────────
  if (path === '/api/auth/token' && req.method === 'POST') {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    const { email, accountPasswordHash } = req.body || {};
    if (!email || !accountPasswordHash) {
      return res.status(400).json({ error: 'email and accountPasswordHash required' });
    }
    const normalizedEmail = (email as string).toLowerCase().trim();
    try {
      // Make sure totp_* columns exist before SELECTing them — first-deploy
      // hosts won't have them yet. Cheap on subsequent calls (memoized flag).
      await ensureTotpColumns();
      // Look up user in crm_users table (Drizzle schema)
      const { rows: userRows } = await db.query(
        `SELECT id, account_password_hash, account_status, totp_enabled FROM crm_users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );
      if (!userRows[0]) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Account not found. Please sign up first.' });
      }
      const userId: string = userRows[0].id;
      const storedHash = userRows[0].account_password_hash;
      if (!storedHash) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Account not found. Please sign up first.' });
      }
      const verify = await verifyAccountPassword(accountPasswordHash, storedHash);
      if (!verify.ok) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      // Migrate legacy SHA-256 hashes to scrypt on successful login
      if (verify.legacy) {
        try {
          const upgraded = await hashAccountPassword(accountPasswordHash);
          await db.query(`UPDATE crm_users SET account_password_hash = $1 WHERE id = $2`, [upgraded, userId]);
        } catch (e: any) { console.error('[auth/token] hash upgrade failed:', e.message); }
      }
      // Block login if email not yet verified
      if (userRows[0].account_status === 'pending_verification') {
        return res.status(403).json({ error: 'email_not_verified' });
      }
      // 2FA gate: if enabled, do NOT issue a session token. Return a short-lived
      // pending-token instead — caller must POST it + the TOTP code to
      // /api/auth/2fa/validate to receive the real token.
      if (userRows[0].totp_enabled) {
        clearLoginFailures(clientIp);
        const tempToken = signTwoFactorPending(userId, normalizedEmail);
        return res.json({ requires2FA: true, tempToken, email: normalizedEmail });
      }
      // Successful auth — wipe failure counter for this IP
      clearLoginFailures(clientIp);
      // Fire-and-forget: stamp last_active_at for inactive-user re-engagement workflow
      db.query(`UPDATE crm_users SET last_active_at = NOW() WHERE id = $1`, [userId])
        .catch((e: any) => console.error('[auth/token] last_active_at update failed:', e.message));
      const token = signCloudToken(userId, normalizedEmail);

      // Register session in extension_sessions. Auto-creates the table on first
      // use (same pattern as auth_verification_codes). The hashed token is the
      // server-side handle the extension's session_check polls against.
      let sessionId: string | null = null;
      try {
        await ensureSessionAndActivityTables();
        const ua = (req.headers['user-agent'] as string) || '';
        const clientKind = (req.headers['x-iv-client'] as string) || (ua.includes('Chrome') && !ua.includes('Mobile') ? 'web' : 'web');
        const { browser, os, deviceName } = parseUserAgent(ua);
        const ip = getClientIp(req);
        const tokenHash = hashJwtToken(token);
        const { rows: sessRows } = await db.query(
          `INSERT INTO extension_sessions (user_id, device_name, browser, os, ip_address, user_agent, client_kind, jwt_token_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [userId, deviceName, browser, os, ip, ua, clientKind, tokenHash]
        );
        sessionId = sessRows[0]?.id || null;
      } catch (e: any) {
        console.error('[auth/token] session register failed:', e.message);
      }

      return res.json({ success: true, token, userId, email: normalizedEmail, sessionId });
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
      // Count existing vaults before insert to detect first vault
      const { rows: priorVaults } = await db.query(
        `SELECT COUNT(*) AS cnt FROM cloud_vaults WHERE user_id = $1`, [cloudUser.userId]
      );
      const isFirstVault = parseInt(priorVaults[0]?.cnt ?? '0', 10) === 0;
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
      // Send vault-ready email on first vault creation
      if (isFirstVault) {
        sendEmail({ to: cloudUser.email, ...vaultReadyEmail(vaultName as string) }).catch(() => {});
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

  // ── GET /api/vault/autofill ────────────────────────────────────────────────
  // Returns the encrypted blob of the user's default cloud vault. Used by the
  // IronVault browser extension — the extension decrypts client-side using
  // the user's master password (zero-knowledge). The server never sees the
  // plaintext credentials.
  if (path === '/api/vault/autofill' && req.method === 'GET') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { rows } = await db.query(
        `SELECT vault_id, vault_name, is_default, encrypted_blob, client_modified_at, server_updated_at
           FROM cloud_vaults
          WHERE user_id = $1
          ORDER BY is_default DESC, created_at DESC
          LIMIT 1`,
        [cloudUser.userId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'No cloud vault found' });
      const r = rows[0];
      // Set short cache so the extension doesn't hammer the endpoint on every
      // tab. The encrypted blob is opaque, so caching is safe.
      res.setHeader('Cache-Control', 'private, max-age=15');
      return res.json({
        success: true,
        vaultId: r.vault_id,
        vaultName: r.vault_name,
        isDefault: r.is_default,
        encryptedBlob: r.encrypted_blob,
        clientModifiedAt: r.client_modified_at?.toISOString(),
        serverUpdatedAt: r.server_updated_at?.toISOString(),
      });
    } catch (err: any) {
      console.error('vault/autofill error:', err.message);
      return res.status(500).json({ error: 'Failed to load vault' });
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
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    // Authenticated users may only list invites addressed to them.
    try {
      const { rows } = await db.query(
        `SELECT fi.*, c.full_name as owner_name
         FROM family_invites fi
         LEFT JOIN customers c ON c.email = fi.owner_email
         WHERE fi.invitee_email = $1
           AND fi.status = 'pending'
         ORDER BY fi.invited_at DESC`,
        [cloudUser.email]
      );
      return res.json({ invites: rows, total: rows.length });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── GET /api/crm/family-invites/:ownerEmail ──────────────────────────────────
  if (path.startsWith('/api/crm/family-invites/') && req.method === 'GET') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    // Only the owner can list their own invites.
    try {
      const { rows } = await db.query(
        `SELECT * FROM family_invites WHERE owner_email = $1 ORDER BY invited_at DESC`,
        [cloudUser.email]
      );
      return res.json({ invites: rows, total: rows.length });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── POST /api/crm/family-invites ─────────────────────────────────────────────
  if (path === '/api/crm/family-invites' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    const { inviteeEmail, vaultShareId } = req.body || {};
    if (!inviteeEmail) return res.status(400).json({ error: 'inviteeEmail required' });
    const ownerEmail = cloudUser.email; // bound to authenticated identity
    try {
      const { rows: cRows } = await db.query(
        `SELECT plan_type FROM customers WHERE email = $1 LIMIT 1`,
        [ownerEmail]
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
        [ownerEmail, String(inviteeEmail).toLowerCase(), vaultShareId || null]
      );
      const emailSent = await sendEmail({ to: String(inviteeEmail).toLowerCase(), ...familyInviteEmail(ownerEmail, rows[0].id, String(inviteeEmail).toLowerCase()) });
      console.log('[invite-email]', emailSent ? 'SENT' : 'FAILED', '→', String(inviteeEmail).toLowerCase());
      return res.json({ success: true, invite: rows[0] });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── PATCH /api/crm/family-invites/:id ────────────────────────────────────────
  // Accepts status: accepted | declined | revoked
  if (path.match(/^\/api\/crm\/family-invites\/[^/]+$/) && req.method === 'PATCH') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    const id = path.split('/').pop();
    const { status } = req.body || {};
    if (!['accepted', 'declined', 'revoked'].includes(status)) {
      return res.status(400).json({ error: 'status must be accepted, declined, or revoked' });
    }
    const tsCol = status === 'accepted' ? 'accepted_at' : status === 'declined' ? 'declined_at' : 'revoked_at';
    try {
      // Look up the invite first to authorize: invitee can accept/decline,
      // owner can revoke.
      const { rows: existing } = await db.query(
        `SELECT * FROM family_invites WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (!existing[0]) return res.status(404).json({ error: 'Invite not found' });
      const invite = existing[0];
      if (status === 'revoked' && invite.owner_email !== cloudUser.email) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if ((status === 'accepted' || status === 'declined') && invite.invitee_email !== cloudUser.email) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { rows } = await db.query(
        `UPDATE family_invites SET status = $1, ${tsCol} = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [status, id]
      );
      if (status === 'accepted' && rows[0].invitee_email) {
        await db.query(
          `UPDATE customers SET plan_type = 'pro_family_member', updated_at = NOW()
           WHERE email = $1`,
          [rows[0].invitee_email]
        ).catch(e => console.error('[invite-accept] plan update failed:', e.message));
      }
      return res.json({ success: true, invite: rows[0] });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── POST /api/crm/vaults/report ──────────────────────────────────────────────
  // Authenticated: client reports their own vault count, server flags over-limit.
  if (path === '/api/crm/vaults/report' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    const { vaultCount, planId } = req.body || {};
    const count = Number(vaultCount) || 0;
    const planLimits: Record<string, number> = { free: 1, pro: 5, family: 5, lifetime: 5, pro_family_member: 1 };
    const resolvedPlanId = (planId as string) || 'free';
    const limit = planLimits[resolvedPlanId] ?? 1;
    const flagged = count > limit;
    try {
      await db.query(
        `UPDATE customers
         SET vault_count = $1, flagged_over_limit = $2, last_active = NOW(), updated_at = NOW()
         WHERE email = $3`,
        [count, flagged, cloudUser.email]
      );
      return res.json({ success: true, vaultCount: count, limit, flagged });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed' });
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
          token VARCHAR(64) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      // Widen legacy schemas (was VARCHAR(10))
      await db.query(`ALTER TABLE password_reset_tokens ALTER COLUMN token TYPE VARCHAR(64)`).catch(() => {});
      const { rows } = await db.query(
        `SELECT id FROM crm_users WHERE email = $1 LIMIT 1`, [normalizedEmail]
      );
      // Always return success (don't reveal if email exists). Report
      // emailSent based on whether SMTP is configured, not on whether
      // we actually attempted a send for this email.
      if (!rows[0]) {
        return res.json({ success: true, emailSent: emailConfigured });
      }
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      // 16-char token (~80 bits) — strong vs the legacy 6-char (~30 bits).
      // Server-generated; user types only the link from email so length OK.
      const token = cryptoRandomString(16, chars);
      await db.query(`UPDATE password_reset_tokens SET used = true WHERE email = $1`, [normalizedEmail]);
      await db.query(
        `INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [normalizedEmail, token]
      );
      const resetLink = `${APP_URL}/auth/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
      if (emailConfigured) {
        const tmpl = passwordResetEmail(resetLink);
        // Await the email send fully so the response reflects the actual
        // outcome. Retry once on transient SMTP failure to smooth over
        // network blips that previously caused intermittent emailSent:false.
        let sent = await sendEmail({ to: normalizedEmail, ...tmpl });
        if (!sent) {
          sent = await sendEmail({ to: normalizedEmail, ...tmpl });
        }
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
    if (!email || !token || !newPasswordHash) {
      return res.status(400).json({ error: 'email, token and newPasswordHash required' });
    }
    const normalizedEmail = (email as string).toLowerCase().trim();
    try {
      // Token-based flow only — tokenless else-branch removed (allowed account
      // takeover with just an email).
      const { rows } = await db.query(
        `SELECT id FROM password_reset_tokens
         WHERE email = $1 AND token = $2 AND used = false AND expires_at > NOW()
         LIMIT 1`,
        [normalizedEmail, (token as string).toUpperCase()]
      );
      if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset code' });
      await db.query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [rows[0].id]);

      // Re-hash with scrypt before storing (no longer accept raw client SHA-256)
      const storedHash = await hashAccountPassword(newPasswordHash as string);
      await db.query(
        `UPDATE crm_users SET account_password_hash = $1, password_changed_at = NOW() WHERE email = $2`,
        [storedHash, normalizedEmail]
      );
      // Invalidate all existing sessions on password change
      await db.query(
        `UPDATE extension_sessions SET is_active = false, revoked_at = NOW()
         WHERE user_id = (SELECT id FROM crm_users WHERE email = $1 LIMIT 1)
         AND is_active = true`,
        [normalizedEmail]
      ).catch(() => {});
      return res.json({ success: true, message: 'Password reset successfully. Please log in.' });
    } catch (err: any) {
      console.error('reset-password error:', err.message);
      return res.status(500).json({ error: 'Failed to reset password' });
    }
  }

  // ── POST /api/admin/set-plan ────────────────────────────────────────────────
  // Protected by ADMIN_API_KEY (separate from JWT_SECRET — see audit H-2).
  if (path === '/api/admin/set-plan' && req.method === 'POST') {
    const adminKey = req.headers['x-admin-key'] as string;
    const expectedAdminKey = process.env.ADMIN_API_KEY || JWT_SECRET;
    if (!adminKey || !expectedAdminKey || !safeEq(adminKey, expectedAdminKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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
      // Fire-and-forget: sync plan upgrade to Zoho CRM
      createOrUpdateCrmDeal({ contactId: null, email: normalizedEmail, plan }).catch(() => {});
      return res.json({ success: true, email: normalizedEmail, plan, customersUpdated: cRows, entitlementsUpdated: eRows });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/admin/users ────────────────────────────────────────────────────
  // Returns active users for the n8n backup-reminder workflow.
  // Protected by N8N_API_KEY env var via the x-api-key header.
  // lastBackupAt is derived from the most recent cloud_vaults.server_updated_at row.
  if (path === '/api/admin/users' && req.method === 'GET') {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const expected = process.env.N8N_API_KEY;
    if (!expected || !apiKey || apiKey !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const { rows } = await db.query(
        `SELECT u.id, u.email, u.full_name AS name,
                u.created_at, u.last_active_at,
                MAX(cv.server_updated_at) AS last_backup_at,
                COALESCE(MAX(e.plan), 'free') AS plan,
                MAX(e.current_period_ends_at) AS plan_expires_at
           FROM crm_users u
           LEFT JOIN entitlements e ON e.user_id = u.id
           LEFT JOIN cloud_vaults cv ON cv.user_id = u.id
          WHERE u.account_status = 'active'
          GROUP BY u.id, u.email, u.full_name, u.created_at, u.last_active_at`
      );
      return res.json({
        users: rows.map((r: any) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          lastBackupAt: r.last_backup_at,
          plan: r.plan,
          planExpiresAt: r.plan_expires_at,
          lastLoginAt: r.last_active_at,
          createdAt: r.created_at,
        })),
      });
    } catch (err: any) {
      console.error('[admin/users] error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/crm/upgrade ──────────────────────────────────────────────────
  // Called by the client after a successful plan upgrade to sync a Deal to Zoho CRM.
  if (path === '/api/crm/upgrade' && req.method === 'POST') {
    const user = getCloudUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { plan, amount } = req.body || {};
    if (!plan) return res.status(400).json({ error: 'plan required' });
    const dealId = await createOrUpdateCrmDeal({ contactId: null, email: user.email, plan, amount }).catch(() => null);
    return res.json({ success: true, dealId });
  }

  // ── POST /api/webhooks/zoho-billing ─────────────────────────────────────────
  // Handles subscription.created, subscription.reactivated, payment.success from Zoho Billing.
  // Zoho Billing sends a webhook secret in the X-Zoho-Billing-Secret header.
  if (path === '/api/webhooks/zoho-billing' && req.method === 'POST') {
    const secret = req.headers['x-zoho-billing-secret'];
    const expectedSecret = process.env.ZOHO_BILLING_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('[zoho-billing webhook] ZOHO_BILLING_WEBHOOK_SECRET not set — rejecting');
      return res.status(500).json({ error: 'Server misconfigured' });
    }
    if (typeof secret !== 'string' || !safeEq(secret, expectedSecret)) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    try {
      const payload = req.body || {};
      const eventType: string = payload.event_type || payload.eventType || '';
      const subscription = payload.data?.subscription || payload.subscription || {};
      const email: string = (
        subscription.customer?.email ||
        subscription.email ||
        payload.data?.customer?.email ||
        ''
      ).toLowerCase().trim();

      if (!email) return res.status(400).json({ error: 'No email in payload' });

      // Map Zoho Billing plan code to IronVault plan name
      const rawPlan: string = (subscription.plan?.code || subscription.planCode || '').toLowerCase();
      const plan = rawPlan.includes('lifetime') ? 'lifetime'
        : rawPlan.includes('family') ? 'family'
        : rawPlan.includes('pro') ? 'pro'
        : 'free';

      const handledEvents = ['subscription_created', 'subscription_activated', 'subscription_reactivated', 'payment_success', 'invoice_payment_success'];
      if (!handledEvents.includes(eventType)) {
        return res.json({ received: true, skipped: true, eventType });
      }

      // Update entitlement in DB
      const { rows } = await db.query(
        `SELECT u.id FROM crm_users u WHERE u.email = $1 LIMIT 1`, [email]
      );
      if (!rows[0]) {
        console.warn(`[zoho-billing webhook] No user found for email: ${email}`);
        return res.json({ received: true, warning: 'user not found' });
      }
      const userId = rows[0].id;
      await db.query(
        `INSERT INTO entitlements (user_id, plan, status, trial_active, will_renew, admin_override, updated_at)
         VALUES ($1, $2, 'active', false, true, false, NOW())
         ON CONFLICT (user_id) DO UPDATE SET plan = $2, status = 'active', trial_active = false, will_renew = true, updated_at = NOW()`,
        [userId, plan]
      );

      // Fire upgrade email + CRM deal (fire-and-forget)
      sendEmail({ to: email, ...planUpgradeEmail(plan) }).catch(() => {});
      createOrUpdateCrmDeal({ contactId: null, email, plan }).catch(() => {});
      console.log(`[zoho-billing] ${eventType} → ${email} → ${plan}`);
      return res.json({ received: true, email, plan, eventType });
    } catch (err: any) {
      console.error('[zoho-billing webhook] error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/admin/migrate-to-crm ──────────────────────────────────────────
  // One-shot migration: push all crm_users to Zoho CRM. Protected by x-admin-key.
  if (path === '/api/admin/migrate-to-crm' && req.method === 'POST') {
    const adminKey = (req.headers['x-admin-key'] as string) || req.body?.adminKey;
    const expectedAdminKey = process.env.ADMIN_API_KEY || JWT_SECRET;
    if (!adminKey || !expectedAdminKey || !safeEq(adminKey, expectedAdminKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const { rows: users } = await db.query(
        `SELECT u.id, u.email, u.full_name, u.phone, u.country,
                e.plan
         FROM crm_users u
         LEFT JOIN entitlements e ON e.user_id = u.id`
      );
      const results: { email: string; action: string; error?: string }[] = [];
      let succeeded = 0;
      let failed = 0;
      for (const u of users) {
        try {
          const nameParts = ((u.full_name as string) || (u.email as string).split('@')[0]).split(' ');
          const firstName = nameParts.length > 1 ? nameParts[0] : '';
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];
          const id = await createCrmContact({
            email: u.email,
            firstName,
            lastName,
            phone: u.phone,
            country: u.country,
            plan: u.plan || 'free',
            source: 'IronVault App',
          });
          results.push({ email: u.email, action: id ? 'upserted' : 'no-id' });
          succeeded++;
        } catch (e: any) {
          results.push({ email: u.email, action: 'error', error: e.message });
          failed++;
        }
      }
      return res.json({ success: true, total: users.length, succeeded, failed, results });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/payments/create-order ─────────────────────────────────────────
  if (path === '/api/payments/create-order' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const RAZORPAY_PLANS: Record<string, { amount: number; currency: string }> = {
      pro_monthly:       { amount: 14900,  currency: 'INR' },
      pro_yearly:        { amount: 149900, currency: 'INR' },
      pro_family:        { amount: 29900,  currency: 'INR' },
      pro_family_yearly: { amount: 299900, currency: 'INR' },
      lifetime:          { amount: 999900, currency: 'INR' },
    };
    const { plan } = req.body || {};
    const planCfg = RAZORPAY_PLANS[plan as string];
    if (!planCfg) return res.status(400).json({ error: 'Invalid plan' });
    // Always use the authenticated user's email — never trust client-supplied email.
    const orderEmail = cloudUser.email;
    try {
      const { default: RazorpayClient } = await import('razorpay');
      const rzp = new RazorpayClient({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
      const order = await rzp.orders.create({
        amount: planCfg.amount,
        currency: planCfg.currency,
        receipt: `iv_${plan}_${Date.now()}`,
        notes: { email: orderEmail, plan, userId: cloudUser.userId },
      });
      // Persist authoritative plan+email mapping for verify endpoint
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS payment_orders (
            order_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            email TEXT NOT NULL,
            plan TEXT NOT NULL,
            amount INTEGER NOT NULL,
            currency TEXT NOT NULL,
            consumed_payment_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await db.query(
          `INSERT INTO payment_orders (order_id, user_id, email, plan, amount, currency)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (order_id) DO NOTHING`,
          [order.id, cloudUser.userId, orderEmail, plan, planCfg.amount, planCfg.currency]
        );
      } catch (e: any) {
        console.error('[Razorpay] order persist failed:', e.message);
      }
      return res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
    } catch (err: any) {
      console.error('[Razorpay] create-order error:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to create order' });
    }
  }

  // ── POST /api/payments/verify ────────────────────────────────────────────────
  if (path === '/api/payments/verify' && req.method === 'POST') {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const RAZORPAY_TIERS: Record<string, { tier: string; isLifetime: boolean; periodMonths: number }> = {
      pro_monthly:       { tier: 'pro',      isLifetime: false, periodMonths: 1  },
      pro_yearly:        { tier: 'pro',      isLifetime: false, periodMonths: 12 },
      pro_family:        { tier: 'family',   isLifetime: false, periodMonths: 1  },
      pro_family_yearly: { tier: 'family',   isLifetime: false, periodMonths: 12 },
      lifetime:          { tier: 'lifetime', isLifetime: true,  periodMonths: 0  },
    };

    // Canonical plan + email come from the server-side order row, NOT the
    // request body. Razorpay's HMAC only covers (order_id|payment_id), so
    // trusting body-supplied plan/email allowed plan tampering.
    const { rows: orderRows } = await db.query(
      `SELECT user_id, email, plan, amount, consumed_payment_id FROM payment_orders WHERE order_id = $1 LIMIT 1`,
      [razorpay_order_id]
    );
    const orderRow = orderRows[0];
    if (!orderRow) return res.status(404).json({ error: 'Unknown order' });
    if (orderRow.consumed_payment_id) {
      return res.status(409).json({ error: 'Payment already verified' });
    }
    const plan = orderRow.plan as string;
    const normalizedEmail = (orderRow.email as string).toLowerCase().trim();
    const userId = orderRow.user_id as string;
    const tierCfg = RAZORPAY_TIERS[plan];
    if (!tierCfg) return res.status(400).json({ error: 'Invalid plan' });

    const expectedSigBuf = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest();
    let sigOk = false;
    try {
      const provided = Buffer.from(String(razorpay_signature), 'hex');
      sigOk = provided.length === expectedSigBuf.length && timingSafeEqual(provided, expectedSigBuf);
    } catch { sigOk = false; }
    if (!sigOk) {
      console.warn('[Razorpay] Signature mismatch:', razorpay_payment_id);
      triggerN8n(N8N_PAYMENT_FAILED_WEBHOOK, {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: razorpay_payment_id,
              amount: orderRow.amount ?? 0,
              currency: 'INR',
              email: normalizedEmail,
              error_description: 'Invalid payment signature',
              notes: { plan, userId },
            },
          },
        },
      });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    try {
      // Atomically mark this order consumed so the same payment can't upgrade twice
      const { rowCount } = await db.query(
        `UPDATE payment_orders SET consumed_payment_id = $1 WHERE order_id = $2 AND consumed_payment_id IS NULL`,
        [razorpay_payment_id, razorpay_order_id]
      );
      if (!rowCount) {
        return res.status(409).json({ error: 'Payment already verified' });
      }

      const now = new Date();
      let periodEndsAt: Date | null = null;
      if (!tierCfg.isLifetime) {
        periodEndsAt = new Date(now);
        periodEndsAt.setMonth(periodEndsAt.getMonth() + tierCfg.periodMonths);
      }

      await db.query(
        `INSERT INTO entitlements (user_id, plan, status, trial_active, will_renew, subscription_platform, subscription_id, current_period_ends_at, admin_override, updated_at)
         VALUES ($1, $2, 'active', false, $3, 'razorpay', $4, $5, false, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           plan = $2, status = 'active', trial_active = false, will_renew = $3,
           subscription_platform = 'razorpay', subscription_id = $4,
           current_period_ends_at = $5, updated_at = NOW()`,
        [userId, tierCfg.tier, !tierCfg.isLifetime, razorpay_payment_id, periodEndsAt]
      );

      createOrUpdateCrmDeal({ contactId: null, email: normalizedEmail, plan: tierCfg.tier }).catch(() => {});
      sendEmail({ to: normalizedEmail, ...planUpgradeEmail(tierCfg.tier) }).catch(() => {});

      // Fire-and-forget: trigger n8n payment-lifecycle workflow with Razorpay-shaped payload
      triggerN8n(N8N_PAYMENT_WEBHOOK, {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: razorpay_payment_id,
              amount: orderRow.amount ?? 0,
              currency: 'INR',
              status: 'captured',
              order_id: razorpay_order_id,
              email: normalizedEmail,
              notes: { plan, userId },
            },
          },
        },
      });

      console.log(`[Razorpay] Payment verified: ${normalizedEmail} → ${tierCfg.tier} (${plan})`);
      return res.json({ success: true, plan: tierCfg.tier });
    } catch (err: any) {
      console.error('[Razorpay] verify error:', err.message);
      return res.status(500).json({ error: err.message || 'Verification failed' });
    }
  }

  // ── POST /api/share/migrate ───────────────────────────────────────────────────
  if (path === '/api/share/migrate' && req.method === 'POST') {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS shared_links (
          id SERIAL PRIMARY KEY,
          token VARCHAR(255) UNIQUE NOT NULL,
          encrypted_data TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          viewed BOOLEAN DEFAULT false,
          viewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);
      `);
      return res.json({ success: true, message: 'shared_links table ready' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/share/create ────────────────────────────────────────────────────
  if (path === '/api/share/create' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { data, expiresIn = 24 } = req.body as { data: unknown; expiresIn?: number };
      if (!data) return res.status(400).json({ error: 'data required' });
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + (expiresIn as number) * 60 * 60 * 1000);
      await db.query(
        'INSERT INTO shared_links (token, encrypted_data, expires_at) VALUES ($1, $2, $3)',
        [token, JSON.stringify(data), expiresAt]
      );
      return res.json({
        link: `https://www.ironvault.app/share/${token}`,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/share/:token ─────────────────────────────────────────────────────
  if (path.startsWith('/api/share/') && req.method === 'GET') {
    const token = path.slice('/api/share/'.length);
    if (!token || token.includes('/')) return res.status(400).json({ error: 'Invalid token' });
    try {
      const { rows } = await db.query('SELECT * FROM shared_links WHERE token = $1', [token]);
      if (rows.length === 0) return res.status(404).json({ error: 'Link not found' });
      const share = rows[0];
      if (new Date(share.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Link expired' });
      }
      if (share.viewed) {
        return res.status(410).json({ error: 'Link already used — one-time links expire after first view' });
      }
      await db.query('UPDATE shared_links SET viewed = true, viewed_at = NOW() WHERE token = $1', [token]);
      return res.json({ data: JSON.parse(share.encrypted_data) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/auth/sessions ─────────────────────────────────────────────────
  // Lists all active sessions (extension + web) for the authenticated user.
  // Used by the Active Sessions UI in Profile → Security and by the extension
  // settings list.
  if (path === '/api/auth/sessions' && req.method === 'GET') {
    const cloudUser = getCloudUser(req);
    const callerToken = getCloudUserToken(req);
    if (!cloudUser || !callerToken) return res.status(401).json({ error: 'Auth required' });
    try {
      await ensureSessionAndActivityTables();
      const callerHash = hashJwtToken(callerToken);
      const { rows } = await db.query(
        `SELECT id, device_name, browser, os, ip_address, client_kind, last_active_at, created_at, revoked_at, is_active, jwt_token_hash
           FROM extension_sessions
          WHERE user_id = $1 AND is_active = true
          ORDER BY last_active_at DESC
          LIMIT 100`,
        [cloudUser.userId]
      );
      return res.json({
        success: true,
        sessions: rows.map((r: any) => ({
          id: r.id,
          deviceName: r.device_name,
          browser: r.browser,
          os: r.os,
          ipAddress: r.ip_address,
          clientKind: r.client_kind,
          lastActiveAt: r.last_active_at?.toISOString(),
          createdAt: r.created_at?.toISOString(),
          isCurrent: r.jwt_token_hash === callerHash,
        })),
      });
    } catch (err: any) {
      console.error('auth/sessions error:', err.message);
      return res.status(500).json({ error: 'Failed to list sessions' });
    }
  }

  // ── POST /api/auth/sessions/:id/revoke ─────────────────────────────────────
  if (/^\/api\/auth\/sessions\/[^\/]+\/revoke$/.test(path) && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const id = path.split('/')[4];
    try {
      await ensureSessionAndActivityTables();
      const { rows } = await db.query(
        `UPDATE extension_sessions
            SET is_active = false, revoked_at = NOW()
          WHERE id = $1 AND user_id = $2 AND is_active = true
          RETURNING id`,
        [id, cloudUser.userId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('auth/sessions revoke error:', err.message);
      return res.status(500).json({ error: 'Failed to revoke session' });
    }
  }

  // ── POST /api/auth/sessions/revoke-all ─────────────────────────────────────
  // Revokes every session except the caller's own, so the user isn't logged
  // out of the device they're using to revoke. The "Sign out everywhere"
  // button calls this.
  if (path === '/api/auth/sessions/revoke-all' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    const callerToken = getCloudUserToken(req);
    if (!cloudUser || !callerToken) return res.status(401).json({ error: 'Auth required' });
    try {
      await ensureSessionAndActivityTables();
      const callerHash = hashJwtToken(callerToken);
      const { rowCount } = await db.query(
        `UPDATE extension_sessions
            SET is_active = false, revoked_at = NOW()
          WHERE user_id = $1 AND is_active = true AND jwt_token_hash <> $2`,
        [cloudUser.userId, callerHash]
      );
      return res.json({ success: true, revoked: rowCount });
    } catch (err: any) {
      console.error('auth/sessions revoke-all error:', err.message);
      return res.status(500).json({ error: 'Failed to revoke sessions' });
    }
  }

  // ── GET /api/auth/session/check ────────────────────────────────────────────
  // The extension polls this every 5 minutes. If the caller's token has been
  // revoked server-side, returns 401 so the extension wipes local data.
  if (path === '/api/auth/session/check' && req.method === 'GET') {
    const cloudUser = getCloudUser(req);
    const callerToken = getCloudUserToken(req);
    if (!cloudUser || !callerToken) return res.status(401).json({ error: 'Auth required' });
    try {
      await ensureSessionAndActivityTables();
      const session = await getActiveSessionByToken(callerToken);
      if (!session) {
        return res.status(401).json({ error: 'session_revoked', valid: false });
      }
      // Touch last_active_at so the UI reflects extension liveness.
      db.query(`UPDATE extension_sessions SET last_active_at = NOW() WHERE id = $1`, [session.id])
        .catch((e: any) => console.error('[session/check] touch failed:', e.message));
      return res.json({ success: true, valid: true, sessionId: session.id });
    } catch (err: any) {
      console.error('auth/session/check error:', err.message);
      return res.status(500).json({ error: 'Failed to check session' });
    }
  }

  // ── POST /api/vault/items/add ──────────────────────────────────────────────
  // Extension uploads a re-encrypted vault blob containing one or more newly
  // appended items. Server is zero-knowledge: it only swaps the encrypted_blob
  // for the chosen vault. Functionally a thin wrapper around PUT but lives at
  // a clearer path the extension reaches for "Save to Vault".
  if (path === '/api/vault/items/add' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const { vaultId, encryptedBlob, clientModifiedAt, addedItem } = req.body || {};
    if (!encryptedBlob) return res.status(400).json({ error: 'encryptedBlob required' });
    try {
      await ensureSessionAndActivityTables();
      // Resolve target vault: explicit vaultId, default vault, or single vault.
      let targetVaultId = vaultId as string | undefined;
      if (!targetVaultId) {
        const { rows } = await db.query(
          `SELECT vault_id FROM cloud_vaults WHERE user_id = $1
             ORDER BY is_default DESC, created_at DESC LIMIT 1`,
          [cloudUser.userId]
        );
        targetVaultId = rows[0]?.vault_id;
      }
      if (!targetVaultId) return res.status(404).json({ error: 'No cloud vault found' });
      const incomingTs = clientModifiedAt ? new Date(clientModifiedAt) : new Date();
      const { rows: updated } = await db.query(
        `UPDATE cloud_vaults
            SET encrypted_blob = $3, client_modified_at = $4, server_updated_at = NOW()
          WHERE user_id = $1 AND vault_id = $2
          RETURNING vault_id, server_updated_at`,
        [cloudUser.userId, targetVaultId, encryptedBlob, incomingTs]
      );
      if (!updated[0]) return res.status(404).json({ error: 'Vault not found' });

      // Best-effort activity log.
      const callerToken = getCloudUserToken(req);
      const session = callerToken ? await getActiveSessionByToken(callerToken) : null;
      const itemType = addedItem?.itemType || 'password';
      const itemTitle = addedItem?.title ? String(addedItem.title).slice(0, 200) : null;
      db.query(
        `INSERT INTO vault_activity (user_id, session_id, action, item_type, item_title, ip_address, user_agent)
         VALUES ($1, $2, 'created', $3, $4, $5, $6)`,
        [cloudUser.userId, session?.id || null, itemType, itemTitle, getClientIp(req), (req.headers['user-agent'] as string) || null]
      ).catch((e: any) => console.error('[vault/items/add] activity log failed:', e.message));

      return res.json({
        success: true,
        vaultId: updated[0].vault_id,
        serverUpdatedAt: updated[0].server_updated_at?.toISOString(),
      });
    } catch (err: any) {
      console.error('vault/items/add error:', err.message);
      return res.status(500).json({ error: 'Failed to add item' });
    }
  }

  // ── POST /api/vault/activity ───────────────────────────────────────────────
  // Generic activity-log endpoint. Called by the extension on autofill, by the
  // web app on view/import/export/delete, and anywhere else that wants to leave
  // an audit trail in the user's activity timeline.
  if (path === '/api/vault/activity' && req.method === 'POST') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const { action, itemType, itemTitle } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action required' });
    const allowedActions = new Set(['viewed', 'filled', 'created', 'updated', 'deleted', 'exported', 'imported', 'login', 'logout']);
    if (!allowedActions.has(String(action))) {
      return res.status(400).json({ error: 'invalid action' });
    }
    try {
      await ensureSessionAndActivityTables();
      const callerToken = getCloudUserToken(req);
      const session = callerToken ? await getActiveSessionByToken(callerToken) : null;
      await db.query(
        `INSERT INTO vault_activity (user_id, session_id, action, item_type, item_title, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          cloudUser.userId,
          session?.id || null,
          String(action),
          itemType ? String(itemType).slice(0, 40) : null,
          itemTitle ? String(itemTitle).slice(0, 200) : null,
          getClientIp(req),
          (req.headers['user-agent'] as string) || null,
        ]
      );
      return res.json({ success: true });
    } catch (err: any) {
      console.error('vault/activity log error:', err.message);
      return res.status(500).json({ error: 'Failed to log activity' });
    }
  }

  // ── GET /api/vault/activity ────────────────────────────────────────────────
  // Paginated timeline used by Profile → Activity. Filterable by item_type
  // and action. Returns up to 100 rows per page.
  if (path === '/api/vault/activity' && req.method === 'GET') {
    const cloudUser = getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      await ensureSessionAndActivityTables();
      const limitRaw = parseInt((req.query?.limit as string) || '50', 10);
      const offsetRaw = parseInt((req.query?.offset as string) || '0', 10);
      const limit = Math.max(1, Math.min(100, isFinite(limitRaw) ? limitRaw : 50));
      const offset = Math.max(0, isFinite(offsetRaw) ? offsetRaw : 0);
      const itemType = (req.query?.type as string) || '';
      const action = (req.query?.action as string) || '';
      const params: any[] = [cloudUser.userId];
      const where: string[] = ['va.user_id = $1'];
      if (itemType) { params.push(itemType); where.push(`va.item_type = $${params.length}`); }
      if (action) { params.push(action); where.push(`va.action = $${params.length}`); }
      params.push(limit); params.push(offset);
      const { rows } = await db.query(
        `SELECT va.id, va.action, va.item_type, va.item_title, va.ip_address, va.created_at,
                es.device_name, es.browser, es.os
           FROM vault_activity va
           LEFT JOIN extension_sessions es ON es.id = va.session_id
          WHERE ${where.join(' AND ')}
          ORDER BY va.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      const { rows: countRows } = await db.query(
        `SELECT COUNT(*)::int AS total FROM vault_activity WHERE user_id = $1`,
        [cloudUser.userId]
      );
      return res.json({
        success: true,
        total: countRows[0]?.total || 0,
        items: rows.map((r: any) => ({
          id: r.id,
          action: r.action,
          itemType: r.item_type,
          itemTitle: r.item_title,
          ipAddress: r.ip_address,
          createdAt: r.created_at?.toISOString(),
          deviceName: r.device_name || null,
          browser: r.browser || null,
          os: r.os || null,
        })),
      });
    } catch (err: any) {
      console.error('vault/activity list error:', err.message);
      return res.status(500).json({ error: 'Failed to list activity' });
    }
  }

  return res.status(404).json({ error: "endpoint not found", path });
}
