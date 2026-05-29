import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";
import { createHmac, randomBytes, randomInt, randomUUID, scrypt as scryptCb, scryptSync, timingSafeEqual, createCipheriv, createDecipheriv } from "crypto";
import { promisify } from "util";
import nodemailer from "nodemailer";
import { generateSecret as totpGenerateSecret, generateURI as totpGenerateURI, verifySync as totpVerifySync } from "otplib";
import QRCode from "qrcode";
// Static-import WebAuthn at module load. Dynamic `import('@simplewebauthn/server')`
// inside the handler was failing in Vercel's serverless runtime — the bundler
// trips over the package's CJS/ESM exports map. Top-of-file ESM import gives
// Vercel a single, deterministic resolution and surfaces a clear error at
// cold-start if the dep is missing.
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

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
  // Normalize: legacy SHA-256 hashes can sneak in with stray whitespace or
  // mixed case from older insert paths; trim before format-detecting.
  const normStored = (stored || '').trim();
  const normInput = (input || '').trim();
  if (normStored.startsWith('scrypt$')) {
    const parts = normStored.split('$');
    if (parts.length !== 3) return { ok: false, legacy: false };
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    if (salt.length === 0 || expected.length === 0) return { ok: false, legacy: false };
    const got = (await scrypt(normInput, salt, expected.length)) as Buffer;
    if (got.length !== expected.length) return { ok: false, legacy: false };
    return { ok: timingSafeEqual(got, expected), legacy: false };
  }
  // Legacy: 64-char hex SHA-256, no salt. Case-insensitive hex compare.
  if (/^[a-f0-9]{64}$/i.test(normStored) && /^[a-f0-9]{64}$/i.test(normInput)) {
    const a = Buffer.from(normStored.toLowerCase(), 'hex');
    const b = Buffer.from(normInput.toLowerCase(), 'hex');
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

// Best-effort: search Zoho CRM Contacts by email and delete any match.
// Returns true if a delete was issued, false otherwise. Used on account
// deletion so user PII doesn't linger in the CRM after a GDPR/CCPA request.
async function deleteCrmContactByEmail(email: string): Promise<boolean> {
  const token = await getCrmAccessToken();
  if (!token) return false;
  try {
    const search = await fetch(`https://www.zohoapis.in/crm/v7/Contacts/search?email=${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    });
    if (!search.ok) {
      // 204 = no match; anything else is logged but not fatal.
      if (search.status !== 204) console.warn('[crm] contact search failed:', search.status);
      return false;
    }
    const sd = await search.json() as any;
    const id = sd.data?.[0]?.id;
    if (!id) return false;
    const del = await fetch(`https://www.zohoapis.in/crm/v7/Contacts/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    });
    if (!del.ok) {
      console.warn('[crm] contact delete failed:', del.status);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error('[crm] delete contact error:', e.message);
    return false;
  }
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
      from: `"${_FROM_NAME}" <${_FROM_ADDR}>`,
      to, subject, html,
    });
    void result;
    return true;
  } catch (e: any) { console.error('[email] Zoho send error', e.message); return false; }
}
// HTML-escape user-controlled strings before injection into email template HTML.
// Prevents phishing-via-vault-name and HTML injection in ticket subjects / agent
// reply previews / owner emails. Applied at template-build time (not at storage)
// so existing rows render safely without a backfill.
function _eHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const safeName = _eHtml(name || 'there');
  const body = `${_eh1(`Welcome to IronVault, ${safeName}!`)}${_ep('Your secure vault account has been created. Everything you store is AES-256 encrypted.')}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Getting started</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>Create your vault and master password</li><li>Add passwords, notes, reminders</li><li>Track subscriptions and expenses</li></ul>`)}${_ebtn(_APP_URL,'Open IronVault')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">You're receiving this because you created an IronVault account.</p>`;
  return { subject: 'Welcome to IronVault', html: _emailLayout(body) };
}
function passwordResetEmail(link: string) {
  const safeLink = _eHtml(link);
  const body = `${_eh1('Reset your password')}${_ep('Click below to set a new password. This link expires in <strong style="color:#111827">1 hour</strong>.')}${_ebtn(safeLink,'Reset Password')}${_ecard(`<p style="margin:0;font-size:13px;color:#6b7280">Or copy this link into your browser:</p><p style="margin:6px 0 0;font-size:12px;word-break:break-all"><a href="${safeLink}" style="color:#6366f1;text-decoration:none">${safeLink}</a></p>`)}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">If you didn't request this, you can safely ignore this email.</p>`;
  return { subject: 'Reset your IronVault password', html: _emailLayout(body) };
}
function verificationEmail(name: string, link: string) {
  const safeName = _eHtml(name || 'there');
  const safeLink = _eHtml(link);
  const body = `${_eh1('Verify your email address')}${_ep(`Hi ${safeName}, please confirm your email to activate your IronVault account.`)}${_ebtn(safeLink,'Verify Email Address')}${_ecard(`<p style="margin:0;font-size:13px;color:#6b7280">Or copy this link into your browser:</p><p style="margin:6px 0 0;font-size:12px;word-break:break-all"><a href="${safeLink}" style="color:#6366f1;text-decoration:none">${safeLink}</a></p>`)}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.</p>`;
  return { subject: 'Verify your IronVault email address', html: _emailLayout(body) };
}
function ticketConfirmationEmail(sub: string, id: string|number) {
  // Subject must be CRLF-stripped to prevent SMTP header injection (defense in
  // depth — nodemailer also serializes safely). Body uses the html-escaped form.
  const safeSubText = String(sub).replace(/[\r\n]+/g, ' ').slice(0, 200);
  const safeSubHtml = _eHtml(safeSubText);
  const safeId = _eHtml(id);
  const body = `${_eh1('We received your ticket')}${_ep('Our support team will get back to you within 24 hours.')}${_ecard(`<p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Ticket #${safeId}</p><p style="margin:0;font-size:15px;font-weight:600;color:#111827">${safeSubHtml}</p>`)}${_ebtn('mailto:noreply@ironvault.app','Reply via Email')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">You can also reply directly to this email to update your ticket.</p>`;
  return { subject: `[IronVault Support] Ticket received: ${safeSubText}`, html: _emailLayout(body) };
}
function ticketReplyEmail(id: string|number, preview: string) {
  const safeId = _eHtml(id);
  const safePreview = _eHtml(String(preview).slice(0,200));
  const body = `${_eh1('New reply on your ticket')}${_ep(`Our support team has responded to ticket <strong style="color:#111827">#${safeId}</strong>.`)}${_ecard(`<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Reply preview</p><p style="margin:0;font-size:14px;color:#374151;font-style:italic">"${safePreview}"</p>`)}${_ebtn('mailto:noreply@ironvault.app','Reply')}`;
  return { subject: `[IronVault Support] Update on ticket #${String(id).replace(/[\r\n]+/g, ' ')}`, html: _emailLayout(body) };
}
function ticketClosedEmail(id: string|number) {
  const safeId = _eHtml(id);
  const body = `${_eh1('Ticket resolved')}${_ep(`Ticket <strong style="color:#111827">#${safeId}</strong> has been marked as resolved.`)}${_ecard(`<p style="margin:0;font-size:14px;color:#374151">We hope your issue was resolved. If you need further help, feel free to reach out — we're always here.</p>`)}${_ebtn('mailto:noreply@ironvault.app','Contact Support Again')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">Reply to this email if you need further assistance.</p>`;
  return { subject: `[IronVault Support] Ticket #${String(id).replace(/[\r\n]+/g, ' ')} resolved`, html: _emailLayout(body) };
}
function planUpgradeEmail(plan: string) {
  const label = plan==='lifetime'?'Lifetime':plan==='family'?'Family':'Pro';
  const body = `${_eh1(`You're now on ${label}!`)}${_ep(`Your IronVault account has been upgraded to <strong style="color:#111827">${label}</strong>. All premium features are now unlocked.`)}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">What's included</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>Unlimited vaults</li><li>Cloud sync across devices</li><li>Priority support</li></ul>`)}${_ebtn(_APP_URL,'Open IronVault')}`;
  return { subject: `You're now on IronVault ${label} ⭐`, html: _emailLayout(body) };
}
function vaultReadyEmail(vaultName: string) {
  const safeName = _eHtml(vaultName || 'Your vault');
  const body = `${_eh1('Your vault is ready 🔒')}${_ep(`<strong style="color:#111827">${safeName}</strong> has been created and encrypted with your master password.`)}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">What you can store</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>Passwords &amp; login credentials</li><li>Secure notes &amp; documents</li><li>Financial data &amp; subscriptions</li><li>Reminders &amp; goals</li></ul>`)}${_ebtn(_APP_URL,'Open IronVault')}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">Keep your master password safe — it cannot be recovered.</p>`;
  return { subject: 'Your IronVault vault is ready! 🔒', html: _emailLayout(body) };
}
function familyInviteEmail(ownerEmail: string, inviteId: string, inviteeEmail: string) {
  const ownerHandle = ownerEmail.split('@')[0];
  const safeOwnerEmail = _eHtml(ownerEmail);
  const safeOwnerHandle = _eHtml(ownerHandle);
  const inviteLink = `${_APP_URL}/auth/signup?invite=${encodeURIComponent(inviteId)}&email=${encodeURIComponent(inviteeEmail)}`;
  const safeInviteLink = _eHtml(inviteLink);
  const body = `${_eh1(`Join ${safeOwnerHandle}'s IronVault Family!`)}${_ep(`<strong style="color:#111827">${safeOwnerEmail}</strong> has invited you to their IronVault Family plan — you get full premium access at no cost.`)}${_ecard(`<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">What you get</p><ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:2.2"><li>2 vaults total (any mix of local + cloud, your own private)</li><li>Cloud sync across all your devices</li><li>Unlimited passwords, notes &amp; documents</li><li>Expense tracking &amp; bank statement import</li></ul>`)}${_ebtn(safeInviteLink,`Join ${safeOwnerHandle}'s Family Plan`)}${_edivider()}<p style="margin:0;text-align:center;font-size:12px;color:#9ca3af">Sign in or create a free IronVault account to accept. If you didn't expect this, you can safely ignore this email.</p>`;
  return { subject: `${ownerEmail.replace(/[\r\n]+/g, ' ')} invited you to IronVault Family`, html: _emailLayout(body) };
}
// ── End email service ──────────────────────────────────────────────────────────

// ── n8n webhook triggers (fire-and-forget) ────────────────────────────────────
const N8N_SIGNUP_WEBHOOK         = 'https://saketapptest.app.n8n.cloud/webhook/ironvault-signup';
const N8N_PAYMENT_WEBHOOK        = 'https://saketapptest.app.n8n.cloud/webhook/razorpay-payment';
const N8N_PAYMENT_FAILED_WEBHOOK = 'https://saketapptest.app.n8n.cloud/webhook/razorpay-failed';

// Fire-and-forget n8n webhook trigger with one retry after 2s. Transient
// outages (n8n cold start, brief network blips) shouldn't permanently lose
// signup/payment events. Persistent failures are logged for ops follow-up.
async function triggerN8n(url: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  const post = () => fetch(url, { method: 'POST', headers, body });
  try {
    const r = await post();
    if (r.ok) return;
    console.warn(`[n8n] POST ${url} returned ${r.status}, retrying in 2s`);
  } catch (e: any) {
    console.warn(`[n8n] POST ${url} failed (${e.message}), retrying in 2s`);
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
  try {
    const r2 = await post();
    if (!r2.ok) console.error(`[n8n] POST ${url} retry returned ${r2.status} — event lost`);
  } catch (e: any) {
    console.error(`[n8n] POST ${url} retry failed:`, e.message);
  }
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
//
// QA-R2 H7 — KNOWN LIMITATION:
//   Vercel serverless functions can scale across multiple instances, and each
//   instance gets its own fresh in-process Map. An attacker distributing
//   attempts across enough concurrent invocations can therefore exceed the
//   intended 5-attempts-per-15-min cap. We've judged this acceptable for the
//   current threat model (low traffic, scrypt-hashed server-side passwords,
//   per-IP not per-account, account lockout NOT used).
//
//   For higher scale OR if we ever expose an account-enumeration vector, swap
//   this implementation for a Redis-backed counter (Upstash, Vercel KV, etc.)
//   so all instances share state. Sketch:
//     await redis.incr(key); await redis.expire(key, 15*60);
//     if (await redis.get(key) > 5) return 429;
//   Document this swap as a follow-up at:
//   https://vercel.com/docs/storage/vercel-kv (Vercel KV is deprecated; use
//   Upstash Redis from the Vercel Marketplace instead).
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

// ── Generic per-IP + per-action rate limiter ─────────────────────────────────
// Used for non-login auth endpoints that previously had no rate limiting:
//   /api/auth/forgot-password (email-flood / SMTP-abuse vector)
//   /api/auth/reset-password  (token brute-force vector)
//   /api/auth/register        (signup flood / Zoho-CRM abuse vector)
// Each (action, ip) tuple is bucketed independently so a forgot-password
// flood does not lock a legitimate user out of /api/auth/token.
// Same per-instance caveat as _loginFailures (see QA-R2 H7 above).
const _actionBuckets = new Map<string, number[]>();
function checkAndRecordAction(action: string, ip: string, max: number, windowMs: number): boolean {
  // Returns true if rate-limited (does NOT record), false if allowed (records).
  const now = Date.now();
  const key = `${action}:${ip}`;
  const cutoff = now - windowMs;
  const fresh = (_actionBuckets.get(key) ?? []).filter(t => t > cutoff);
  if (fresh.length >= max) {
    _actionBuckets.set(key, fresh);
    return true;
  }
  fresh.push(now);
  _actionBuckets.set(key, fresh);
  return false;
}

function setSecurityHeaders(res: VercelResponse) {
  // QA-R2 H6 — explicit policy:
  //   * NO 'unsafe-eval' anywhere (audited grep this file: none present).
  //   * 'unsafe-inline' on script-src and style-src is INTENTIONAL and
  //     ONLY because the Razorpay checkout SDK injects inline event
  //     handlers into its iframe shell at runtime. Removing it would
  //     break payments. XSS sinks in user-generated content are
  //     mitigated separately (DOMPurify on notes, see also H8).
  //   * Migrate to a nonce-based CSP (and drop unsafe-inline) once
  //     Razorpay's checkout SDK supports it.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.ironvault.app https://api.razorpay.com; frame-src https://api.razorpay.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
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
  // Strict allowlist: only echo Origin back if it is explicitly approved.
  // No-Origin requests (same-origin, server-to-server, curl) don't need ACAO —
  // browsers only enforce CORS on cross-origin requests with an Origin header.
  // Removing the no-Origin fallback prevents accidental wide-open responses.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  // If a browser sends an Origin and it's not in the allowlist, ACAO is simply
  // not set — the browser will block the response. No wildcard fallback.
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Fire-and-forget startup migrations. Each helper has its own
  // already-ran guard, so calling on every request is cheap.
  void ensureTotpColumns().catch(() => { /* logged inside */ });
  void ensureUniqueIndexes().catch(() => { /* logged inside */ });

  // P0 (2026-05-05) — JWT_SECRET MUST be initialized before any matcher
  // that calls verifyCloudToken / signCloudToken / getCloudUser. It used
  // to live ~400 lines down inside this handler, which meant any matcher
  // earlier in the file (e.g. /api/crm/entitlement/* at line ~657) hit
  // the temporal-dead-zone when its inner verifyCloudToken referenced
  // JWT_SECRET — the throw was caught by verifyCloudToken's try/catch,
  // it returned null, and the user got a silent 401 even with a valid
  // Bearer token. /api/auth/me + /api/vaults/cloud worked only because
  // they execute much later in the handler, after the const had been
  // initialized. Hoisting to the top makes ALL matchers behave the same.
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error('[fatal] JWT_SECRET env var is not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

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

  // ── /api/security/breach-check — HIBP k-anonymity proxy ────────────────────
  // Client SHA-1s the password and sends only the first 5 hex chars. We
  // forward to api.pwnedpasswords.com/range/{prefix} which returns every
  // suffix that has appeared in a breach, with occurrence counts. The full
  // password (and full hash) never leaves the device. Proxying server-side
  // sidesteps mobile WebView CORS quirks and lets us add server-side cache.
  if (path === "/api/security/breach-check" && req.method === "POST") {
    const body = (req.body ?? {}) as { prefixes?: unknown };
    const raw = Array.isArray(body.prefixes) ? body.prefixes : [];
    if (raw.length === 0) return res.status(400).json({ error: "prefixes required" });
    if (raw.length > 100) return res.status(400).json({ error: "max 100 prefixes per call" });

    const prefixes: string[] = [];
    for (const p of raw) {
      if (typeof p !== "string") continue;
      const up = p.toUpperCase();
      if (/^[0-9A-F]{5}$/.test(up)) prefixes.push(up);
    }
    if (prefixes.length === 0) return res.status(400).json({ error: "no valid prefixes" });

    const results: Record<string, Record<string, number>> = {};
    await Promise.all(prefixes.map(async (prefix) => {
      try {
        const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
          headers: { "User-Agent": "IronVault/4.2 (breach-check)", "Add-Padding": "true" },
        });
        if (!r.ok) { results[prefix] = {}; return; }
        const text = await r.text();
        const map: Record<string, number> = {};
        for (const line of text.split(/\r?\n/)) {
          const [suffix, countStr] = line.split(":");
          if (!suffix || !countStr) continue;
          const count = parseInt(countStr, 10);
          if (count > 0) map[suffix.toUpperCase()] = count;
        }
        results[prefix] = map;
      } catch {
        results[prefix] = {};
      }
    }));

    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.json({ results });
  }

  // ── /api/security/phishing-check — URL safety screen ────────────────────────
  // Multi-source check:
  //  1. Heuristic regex against IDN / look-alike domains (always on).
  //  2. Google Safe Browsing v4 lookup if GOOGLE_SAFE_BROWSING_API_KEY is set.
  //     Returns matches across MALWARE / SOCIAL_ENGINEERING / UNWANTED_SOFTWARE.
  //  3. Curated phishing host list (suspicious TLDs + known typosquats).
  // The client gets a normalized severity (clean / warn / phishing) plus the
  // raw reasons so the page can explain *why* something looks bad.
  if (path === "/api/security/phishing-check" && req.method === "POST") {
    const { url } = (req.body || {}) as { url?: unknown };
    if (!url || typeof url !== "string") return res.status(400).json({ error: "url required" });

    let parsed: URL;
    try {
      parsed = new URL(url.includes("://") ? url : `https://${url}`);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }
    const host = parsed.hostname.toLowerCase();

    const reasons: string[] = [];
    let severity: "clean" | "warn" | "phishing" = "clean";

    // 1. Heuristics — punycode, look-alike substitution, suspicious TLDs.
    if (host.startsWith("xn--") || host.includes(".xn--")) {
      reasons.push("Internationalized domain (IDN) — possible homograph attack");
      severity = "warn";
    }
    const susTlds = [".tk", ".gq", ".ml", ".cf", ".pw", ".top", ".click", ".loan", ".click", ".country", ".kim", ".cricket"];
    if (susTlds.some(t => host.endsWith(t))) {
      reasons.push(`Suspicious TLD ${host.slice(host.lastIndexOf("."))}`);
      severity = "warn";
    }
    // Brand-imitation heuristic: long subdomain hosting a known brand string.
    const brands = ["paypal", "apple", "amazon", "microsoft", "google", "facebook", "bank", "chase", "wells", "hdfc", "icici", "sbi"];
    const parts = host.split(".");
    const apex = parts.slice(-2).join(".");
    for (const b of brands) {
      if (apex.includes(b)) continue; // legitimate root
      if (host.includes(b)) {
        reasons.push(`Brand "${b}" appears in subdomain but not in registered apex — common phishing pattern`);
        severity = "phishing";
      }
    }
    // Excessive subdomain depth + hyphens.
    if (parts.length >= 5 && host.includes("-")) {
      reasons.push("Unusually deep subdomain chain with hyphens");
      severity = severity === "phishing" ? severity : "warn";
    }
    // IP literal in host.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      reasons.push("URL uses a raw IP address instead of a domain name");
      severity = "phishing";
    }

    // 2. Google Safe Browsing — only if API key configured.
    const gsbKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
    let gsbMatches: any[] = [];
    if (gsbKey) {
      try {
        const sbRes = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${gsbKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client: { clientId: "ironvault", clientVersion: "4.3" },
            threatInfo: {
              threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
              platformTypes: ["ANY_PLATFORM"],
              threatEntryTypes: ["URL"],
              threatEntries: [{ url: parsed.toString() }],
            },
          }),
        });
        if (sbRes.ok) {
          const body: any = await sbRes.json();
          gsbMatches = Array.isArray(body?.matches) ? body.matches : [];
          if (gsbMatches.length > 0) {
            severity = "phishing";
            for (const m of gsbMatches) {
              reasons.push(`Google Safe Browsing: ${m.threatType?.replace(/_/g, " ").toLowerCase() || "threat"}`);
            }
          }
        }
      } catch {
        // network failures must not destabilize the response
      }
    }

    res.setHeader("Cache-Control", "private, max-age=300");
    return res.json({
      url: parsed.toString(),
      host,
      severity,
      reasons,
      safeBrowsingChecked: !!gsbKey,
      safeBrowsingMatches: gsbMatches.length,
      checkedAt: new Date().toISOString(),
    });
  }


  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "DATABASE_URL not configured" });
  }

  const db = getPool();

  // ── /api/crm/notify — internal endpoint for admin→app email triggers ─────────
  // Authenticated via CRM_NOTIFY_SECRET (separate from JWT_SECRET — auditing flagged
  // the old behaviour of reusing the JWT signing key as a service token, since a
  // leak of either rotates both privilege levels in lock-step).
  if (path === "/api/crm/notify" && req.method === "POST") {
    const secret = req.headers["x-notify-secret"] as string | undefined;
    const expected = process.env.CRM_NOTIFY_SECRET;
    if (!expected) return res.status(500).json({ error: "CRM_NOTIFY_SECRET not configured" });
    if (!secret || !safeEq(secret, expected)) return res.status(401).json({ error: "Unauthorized" });
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
  // Legacy lead-capture endpoint. Admin-only (ADMIN_API_KEY) — without this
  // gate the endpoint is an open spam relay (welcome emails to arbitrary
  // recipients) and lets anyone pollute the customers table.
  if (path === "/api/crm/register" && req.method === "POST") {
    const adminKey = req.headers['x-admin-key'] as string;
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) return res.status(500).json({ error: 'ADMIN_API_KEY not configured' });
    if (!adminKey || !safeEq(adminKey, expectedAdminKey)) return res.status(401).json({ error: 'Unauthorized' });
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
      return res.status(500).json({ error: 'Registration failed' });
    }
  }

  // ── /api/crm/entitlement/:userId ────────────────────────────────────────────
  if (path.startsWith("/api/crm/entitlement/")) {
    const userId = decodeURIComponent(path.replace("/api/crm/entitlement/", ""));
    if (!userId) return res.status(400).json({ error: "userId required" });
    // QA-R2 C2: this endpoint reveals plan / status / subscription_platform —
    // an unauthenticated attacker could probe it to learn which emails are
    // registered and which are paying customers. Require either:
    //   1) a JWT for the SAME user (own entitlement only), OR
    //   2) the ADMIN_API_KEY header (admin tooling).
    const adminKey = req.headers['x-admin-key'] as string;
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    const adminAuthed = !!expectedAdminKey && !!adminKey && safeEq(adminKey, expectedAdminKey);
    if (!adminAuthed) {
      const cloudUser = await getCloudUser(req);
      if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
      // Allow lookup by either id or email, but only the user's own row.
      const matchesOwn =
        userId === cloudUser.userId ||
        userId.toLowerCase() === cloudUser.email.toLowerCase();
      if (!matchesOwn) return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const isUuid = /^[0-9a-f-]{36}$/i.test(userId);
      const col = isUuid ? "u.id" : "u.email";
      // Check entitlements table (joined with crm_users) — this is the authoritative source
      // after admin plan changes. Falls back to legacy customers table if not found.
      const { rows } = await db.query(
        `SELECT u.id, u.email,
                COALESCE(e.plan, 'free') AS plan_type,
                COALESCE(e.status, 'active') AS status,
                e.current_period_ends_at,
                e.subscription_platform
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
      // Read-time enforcement of subscription expiry. Lifetime plans never
      // expire; for everything else, if current_period_ends_at is in the past,
      // downgrade to free. Without this, paid users keep premium forever even
      // after their card declines, since Razorpay subscription_cancelled events
      // aren't reliably delivered to us.
      let plan = row.plan_type as string;
      let status = row.status as string;
      const expiresAt: Date | null = row.current_period_ends_at ? new Date(row.current_period_ends_at) : null;
      if (plan !== 'free' && plan !== 'lifetime' && expiresAt && expiresAt.getTime() < Date.now()) {
        plan = 'free';
        status = 'expired';
        // Persist the downgrade so admin views agree with read-time computation.
        // Best-effort — we don't block the response on the write.
        db.query(
          `UPDATE entitlements SET plan = 'free', status = 'expired', will_renew = false, updated_at = NOW() WHERE user_id = $1`,
          [row.id]
        ).catch((e: any) => console.error('[entitlement] expiry-downgrade failed:', e.message));
      }
      const entitlementData = {
        plan,
        status,
        trial_active: plan === "trial",
        id: row.id,
        email: row.email,
      };
      return res.json({ ...entitlementData, entitlement: entitlementData });
    } catch (err: any) {
      console.error('[entitlement] error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch entitlement' });
    }
  }

  // ── /api/crm/heartbeat ──────────────────────────────────────────────────────
  if (path === "/api/crm/heartbeat" && req.method === "POST") {
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    // QA-R2 C1: ticket creation was open to anyone — an attacker could spam
    // arbitrary emails into our tickets table + Zoho Desk. Require an
    // authenticated session and ALWAYS use the JWT's email rather than a
    // body-supplied one to prevent submitter spoofing.
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    const { subject, description, priority } = req.body || {};
    const email = cloudUser.email; // server-trusted, ignores body.email
    if (!subject) return res.status(400).json({ error: "subject required" });
    const safeSubject = stripHtml(String(subject));
    const safeDescription = description ? stripHtml(String(description)) : '';
    try {
      // Primary: create ticket in Zoho Desk
      const zdTicket = await createZohoDeskTicket({ email, subject: safeSubject, description: safeDescription, priority });
      const ticketId = zdTicket?.ticketNumber ?? zdTicket?.id ?? 'N/A';

      // Secondary: also persist locally for audit trail (fire-and-forget).
      // We store the Zoho Desk ticket id + number alongside, so an inbound
      // Zoho Desk webhook can map an agent reply back to the local row.
      db.query(
        `SELECT id FROM customers WHERE email = $1 LIMIT 1`, [email]
      ).then(({ rows: cRows }) => {
        const customerId = cRows[0]?.id || null;
        return db.query(
          `INSERT INTO tickets (customer_id, customer_email, subject, description, priority, zoho_ticket_id, zoho_ticket_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [customerId, email, safeSubject, safeDescription || null, priority || 'normal', zdTicket?.id || null, zdTicket?.ticketNumber || null]
        );
      }).catch(() => {});

      // Send confirmation email with Zoho ticket number
      sendEmail({ to: email, ...ticketConfirmationEmail(safeSubject, ticketId) }).catch(() => {});
      // Upsert CRM contact so ticket submitters appear in Zoho CRM
      createCrmContact({ email, firstName: email.split('@')[0], lastName: 'IronVault User', source: 'Support Ticket' }).catch(() => {});
      return res.json({ success: true, ticket: { id: ticketId, zoho: !!zdTicket } });
    } catch (err: any) {
      console.error("ticket create error:", err.message);
      return res.status(500).json({ error: 'Failed to create ticket' });
    }
  }

  // ── PATCH /api/crm/tickets/:id ──────────────────────────────────────────────
  // Admin-only: requires ADMIN_API_KEY
  if (path.match(/^\/api\/crm\/tickets\/[^/]+$/) && req.method === "PATCH") {
    const adminKey = req.headers['x-admin-key'] as string;
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) {
      return res.status(500).json({ error: 'ADMIN_API_KEY not configured' });
    }
    if (!adminKey || !safeEq(adminKey, expectedAdminKey)) {
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
    const cloudUser = await getCloudUser(req);
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
  // JWT_SECRET is now hoisted to the top of the handler (see comment up
  // there explaining why); the helpers below close over the lexical
  // binding initialised at handler entry.

  function b64url(buf: Buffer | string): string {
    const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
    return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function signCloudToken(userId: string, email: string): string {
    // P0 FIX: forward-bias iat by 1 second. Any UPDATE to crm_users that
    // happens during the SAME login request (legacy scrypt migration, an
    // implicit ON UPDATE password_changed_at trigger, etc.) can land on a
    // timestamp that — once truncated to whole seconds — is equal to or
    // greater than the JWT's iat, causing verifyTokenNotStale to reject
    // the freshly-issued token. Using Math.ceil + 1 guarantees iat is
    // strictly in the future of any concurrent server-side write at
    // second granularity. The +1s shift on a 30-day exp is irrelevant.
    const iat = Math.ceil(Date.now() / 1000) + 1;
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    // SEC-17: stamp iss/aud so a main-app token can't be replayed against
    // the admin console (which now requires iss='ironvault-admin').
    const payload = b64url(JSON.stringify({
      userId, email,
      exp: iat + 30 * 24 * 3600, iat,
      iss: 'ironvault', aud: 'ironvault-app',
    }));
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
      // SEC-17: pre-rollout tokens lack iss/aud entirely — accept those for
      // the 30-day rollover window. Any token that DOES carry a claim must
      // match the main app's audience.
      if (data.iss && data.iss !== 'ironvault') return null;
      if (data.aud && data.aud !== 'ironvault-app') return null;
      return { userId: data.userId, email: data.email, iat: data.iat || 0 };
    } catch { return null; }
  }

  // Verify JWT iat against the user's password_changed_at to invalidate
  // tokens issued before a password change. Returns true if the token is
  // newer than (or within 2s of) the most recent password change.
  //
  // P0 FIX: pair with the +1s forward bias in signCloudToken. The
  // STALENESS_GRACE_S window absorbs the remaining sources of small
  // skew that can cause a freshly-issued token to look "too old":
  //   • postgres EXTRACT(EPOCH)::bigint truncates fractional seconds
  //     up by floor, while the API server uses Math.ceil — these
  //     can disagree by up to 1s on the same instant
  //   • clock drift between the API container and the postgres host
  //     (Vercel Fluid Compute and the cloud DB are in different regions)
  // 2s is generous enough to cover both without meaningfully weakening
  // the staleness invariant — a real password change moves
  // password_changed_at by minutes, not seconds.
  const STALENESS_GRACE_S = 2;
  async function verifyTokenNotStale(userId: string, iat: number): Promise<boolean> {
    if (!iat) return true;
    try {
      const { rows } = await db.query(
        `SELECT EXTRACT(EPOCH FROM password_changed_at)::bigint AS pc FROM crm_users WHERE id = $1`,
        [userId]
      );
      const pc = rows[0]?.pc as number | undefined;
      if (!pc) return true;
      const ok = iat >= pc - STALENESS_GRACE_S;
      if (!ok) {
        console.warn('[auth] token stale: iat=%d pc=%d delta=%ds userId=%s', iat, pc, pc - iat, userId);
      }
      return ok;
    } catch { return true; }
  }

  async function getCloudUser(req: VercelRequest): Promise<{ userId: string; email: string } | null> {
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.substring(7);
    const decoded = verifyCloudToken(token);
    if (!decoded) return null;
    // SEC-18: cryptographic validity isn't enough — a leaked/revoked token
    // must stop working immediately. Every successful login registers a row
    // in extension_sessions; logout/revoke flips is_active=false. Require an
    // active session here so revocation is honored across all protected
    // endpoints, not just the few that already called getActiveSessionByToken.
    try {
      const hash = hashJwtToken(token);
      const { rows } = await db.query(
        `SELECT 1 FROM extension_sessions WHERE jwt_token_hash = $1 AND is_active = true LIMIT 1`,
        [hash]
      );
      if (!rows[0]) return null;
    } catch (e: any) {
      // Table missing or query failed — treat as no active session rather than
      // fail-open. ensureSessionAndActivityTables runs in every login path so
      // the table is provisioned on first auth/token.
      console.error('[getCloudUser] session check failed:', e.message);
      return null;
    }
    return { userId: decoded.userId, email: decoded.email };
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

  // Backfill the auth_provider columns we need for Google Sign-In. Same
  // memoized pattern as ensureTotpColumns — first call after deploy adds the
  // columns, subsequent calls are a no-op. Called from /api/auth/google.
  let _googleAuthColumnsEnsured = false;
  async function ensureGoogleAuthColumns(): Promise<void> {
    if (_googleAuthColumnsEnsured) return;
    try {
      await db.query(`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20)`);
      await db.query(`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`);
      await db.query(`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS profile_picture TEXT`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_crm_users_google_id ON crm_users(google_id)`);
      _googleAuthColumnsEnsured = true;
    } catch (e: any) {
      console.error('[ensureGoogleAuthColumns]', e.message);
    }
  }

  // Shared-link storage — server stores only AES-encrypted payload + metadata,
  // never the plaintext credential or the decryption key. The key lives in
  // the URL fragment (#k=…) which never reaches the server. Anyone with the
  // link can decrypt; the server enforces TTL and view-count limits.
  let _sharedLinkTableEnsured = false;
  async function ensureSharedLinkTable(): Promise<void> {
    if (_sharedLinkTableEnsured) return;
    try {
      // Probe FK type, same pattern as ensurePasskeyTable.
      const { rows: crmIdInfo } = await db.query(`
        SELECT data_type FROM information_schema.columns
         WHERE table_name = 'crm_users' AND column_name = 'id'
      `);
      const crmIdType = (crmIdInfo[0]?.data_type || 'uuid').toUpperCase();
      const fkColType =
        crmIdType.includes('UUID') ? 'UUID' :
        crmIdType.includes('BIGINT') ? 'BIGINT' :
        crmIdType.includes('INTEGER') ? 'INTEGER' :
        crmIdType.includes('TEXT') || crmIdType.includes('CHAR') ? 'TEXT' :
        'UUID';
      // Drop the table if EITHER (a) the FK column type doesn't match or
      // (b) the FK column is missing entirely (a half-created legacy table
      // from a prior failed CREATE). The shared_links table was empty in
      // every prior deploy, so dropping is safe.
      const { rows: tableExistsRows } = await db.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_links'
      `);
      if (tableExistsRows.length > 0) {
        const { rows: existing } = await db.query(`
          SELECT data_type FROM information_schema.columns
           WHERE table_name = 'shared_links' AND column_name = 'owner_user_id'
        `);
        const colMissing = existing.length === 0;
        const colWrongType = existing.length > 0 && !existing[0].data_type.toUpperCase().includes(fkColType);
        if (colMissing || colWrongType) {
          console.warn(`[ensureSharedLinkTable] dropping legacy table (colMissing=${colMissing}, colWrongType=${colWrongType})`);
          await db.query(`DROP TABLE IF EXISTS shared_links CASCADE`);
        }
      }
      await db.query(`
        CREATE TABLE IF NOT EXISTS shared_links (
          id TEXT PRIMARY KEY,
          owner_user_id ${fkColType} REFERENCES crm_users(id) ON DELETE CASCADE,
          owner_email TEXT,
          encrypted_payload TEXT NOT NULL,
          iv TEXT NOT NULL,
          item_label TEXT,
          item_kind TEXT,
          max_views INTEGER NOT NULL DEFAULT 1,
          view_count INTEGER NOT NULL DEFAULT 0,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at TIMESTAMPTZ
        )
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_shared_links_owner ON shared_links(owner_user_id)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_shared_links_expires ON shared_links(expires_at)`);
      _sharedLinkTableEnsured = true;
    } catch (e: any) {
      console.error('[ensureSharedLinkTable]', e.message);
      throw e;
    }
  }

  // Passkey storage — one row per credential. Multiple credentials per user
  // allowed (one per device). `credential_id` is the WebAuthn-issued ID
  // (base64url), `public_key` is the cose-encoded key bytes, `counter` is the
  // authenticator signature counter (used to detect cloned authenticators).
  let _passkeyTableEnsured = false;
  async function ensurePasskeyTable(): Promise<void> {
    if (_passkeyTableEnsured) return;
    try {
      // crm_users.id is UUID — the FK column type MUST match. Earlier deploys
      // used INTEGER FK columns which made CREATE TABLE fail with a type
      // mismatch; the try/catch swallowed the error so the tables were
      // never created and every endpoint returned 500. The migration block
      // below detects a v1 (INTEGER-FK) table and drops it before the v2
      // CREATE — safe because the tables were never reachable so they
      // can't have real data.
      // Probe the actual data type of crm_users.id at runtime so the FK
      // matches even if a future schema migration changes it. Postgres
      // refuses to create a FK on type-mismatched columns.
      const { rows: crmIdInfo } = await db.query(`
        SELECT data_type FROM information_schema.columns
         WHERE table_name = 'crm_users' AND column_name = 'id'
      `);
      const crmIdType = (crmIdInfo[0]?.data_type || 'uuid').toUpperCase();
      // Map information_schema's logical name back to a CREATE-TABLE token.
      const fkColType =
        crmIdType.includes('UUID') ? 'UUID' :
        crmIdType.includes('BIGINT') ? 'BIGINT' :
        crmIdType.includes('INTEGER') ? 'INTEGER' :
        crmIdType.includes('TEXT') || crmIdType.includes('CHAR') ? 'TEXT' :
        'UUID';

      // Drop legacy passkey tables if EITHER the FK column has the wrong
      // type OR is missing (half-created). Both scenarios are real: prior
      // deploys hit the type-mismatch error mid-CREATE and left tables in
      // an unusable state. They were never reachable from production code,
      // so dropping is safe.
      const { rows: passkeyTableRows } = await db.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'passkey_credentials'
      `);
      if (passkeyTableRows.length > 0) {
        const { rows: existingPasskey } = await db.query(`
          SELECT data_type FROM information_schema.columns
           WHERE table_name = 'passkey_credentials' AND column_name = 'user_id'
        `);
        const colMissing = existingPasskey.length === 0;
        const colWrongType = existingPasskey.length > 0 && !existingPasskey[0].data_type.toUpperCase().includes(fkColType);
        if (colMissing || colWrongType) {
          console.warn(`[ensurePasskeyTable] dropping legacy tables (colMissing=${colMissing}, colWrongType=${colWrongType})`);
          await db.query(`DROP TABLE IF EXISTS passkey_credentials CASCADE`);
          await db.query(`DROP TABLE IF EXISTS passkey_challenges CASCADE`);
        }
      }

      await db.query(`
        CREATE TABLE IF NOT EXISTS passkey_credentials (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id ${fkColType} NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
          credential_id TEXT UNIQUE NOT NULL,
          public_key BYTEA NOT NULL,
          counter BIGINT NOT NULL DEFAULT 0,
          transports TEXT,
          device_label TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_used_at TIMESTAMPTZ
        )
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_passkey_user_id ON passkey_credentials(user_id)`);
      await db.query(`
        CREATE TABLE IF NOT EXISTS passkey_challenges (
          challenge TEXT PRIMARY KEY,
          user_id ${fkColType},
          email TEXT,
          purpose TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      _passkeyTableEnsured = true;
    } catch (e: any) {
      console.error('[ensurePasskeyTable]', e.message);
      // Re-throw so the endpoint surfaces the real DB error to the client
      // instead of returning a generic "Failed to generate options". This
      // makes future schema drift much easier to diagnose.
      throw e;
    }
  }

  function passkeyRpId(): string {
    // The RP ID for WebAuthn must match the eTLD+1 of the site (or be a
    // suffix of it). Hard-coded to ironvault.app so a deploy preview URL
    // doesn't accidentally try to mint credentials bound to a vercel.app
    // hostname users will never come back to.
    return process.env.PASSKEY_RP_ID || 'ironvault.app';
  }
  function passkeyOrigin(): string[] {
    const env = process.env.PASSKEY_ORIGIN;
    if (env) return env.split(',').map(s => s.trim()).filter(Boolean);
    return ['https://www.ironvault.app', 'https://ironvault.app'];
  }

  // Backfill the apple_id column for Sign in with Apple. Same memoized pattern
  // as ensureGoogleAuthColumns. Called from /api/auth/apple.
  let _appleAuthColumnsEnsured = false;
  async function ensureAppleAuthColumns(): Promise<void> {
    if (_appleAuthColumnsEnsured) return;
    try {
      await db.query(`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20)`);
      await db.query(`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_crm_users_apple_id ON crm_users(apple_id)`);
      _appleAuthColumnsEnsured = true;
    } catch (e: any) {
      console.error('[ensureAppleAuthColumns]', e.message);
    }
  }

  // Apple JWKS cache. Apple's signing keys rotate but rarely — caching for
  // 24h keeps verification fast without missing rotation entirely.
  let _appleJwksCache: { keys: any[]; fetchedAt: number } | null = null;
  const APPLE_JWKS_TTL_MS = 24 * 60 * 60 * 1000;

  async function getAppleJwks(): Promise<any[]> {
    if (_appleJwksCache && Date.now() - _appleJwksCache.fetchedAt < APPLE_JWKS_TTL_MS) {
      return _appleJwksCache.keys;
    }
    const res = await fetch('https://appleid.apple.com/auth/keys');
    if (!res.ok) throw new Error(`Apple JWKS fetch failed: ${res.status}`);
    const body: any = await res.json();
    const keys = Array.isArray(body?.keys) ? body.keys : [];
    if (keys.length === 0) throw new Error('Apple JWKS returned no keys');
    _appleJwksCache = { keys, fetchedAt: Date.now() };
    return keys;
  }

  // Verify an Apple-issued identity token (JWT). Returns the decoded claims on
  // success, throws on any failure (signature, issuer, audience, expiry). The
  // caller is responsible for re-checking sub/email against its own records.
  async function verifyAppleIdentityToken(
    idToken: string,
    allowedAudiences: string[],
  ): Promise<{ sub: string; email?: string; email_verified?: boolean | string; iss: string; aud: string; exp: number }> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('Malformed identity token');
    const [headerB64, payloadB64, sigB64] = parts;

    const b64urlToBuf = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const header = JSON.parse(b64urlToBuf(headerB64).toString());
    const payload = JSON.parse(b64urlToBuf(payloadB64).toString());

    if (header.alg !== 'RS256') throw new Error(`Unsupported alg: ${header.alg}`);
    if (!header.kid) throw new Error('Missing kid in token header');

    const keys = await getAppleJwks();
    const jwk = keys.find((k: any) => k.kid === header.kid);
    if (!jwk) throw new Error(`No matching JWK for kid ${header.kid}`);

    // Node ≥16 can import a JWK directly into a KeyObject.
    const { createPublicKey, createVerify } = await import('crypto');
    const pubKey = createPublicKey({ key: jwk, format: 'jwk' });

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sig = b64urlToBuf(sigB64);
    const valid = verifier.verify(pubKey, sig);
    if (!valid) throw new Error('Apple token signature invalid');

    if (payload.iss !== 'https://appleid.apple.com') throw new Error('Invalid issuer');
    if (!payload.aud || !allowedAudiences.includes(payload.aud)) {
      throw new Error(`Invalid audience: ${payload.aud}`);
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) throw new Error('Token expired');
    if (!payload.sub) throw new Error('Missing sub claim');

    return {
      sub: String(payload.sub),
      email: payload.email,
      email_verified: payload.email_verified,
      iss: payload.iss,
      aud: payload.aud,
      exp: payload.exp,
    };
  }

  // Adds UNIQUE constraints that enforce the data-shape invariants the app
  // relies on (one entitlements row per user, one cloud_vaults row per
  // (user, vault) pair). Pre-existing duplicates are coalesced first so the
  // CREATE UNIQUE INDEX call doesn't fail.
  let _uniqueIndexesEnsured = false;
  async function ensureUniqueIndexes(): Promise<void> {
    if (_uniqueIndexesEnsured) return;
    try {
      // Collapse any pre-existing duplicate entitlements rows down to the
      // most-recent one before adding the UNIQUE index.
      await db.query(`
        DELETE FROM entitlements e
        USING entitlements e2
        WHERE e.user_id = e2.user_id
          AND e.ctid < e2.ctid
      `).catch(() => {/* table may not exist yet */});
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS entitlements_user_id_unique
          ON entitlements(user_id)
      `).catch((e: any) => console.error('[ensureUniqueIndexes entitlements]', e.message));

      // Same treatment for cloud_vaults: drop dup (user_id, vault_id) rows.
      await db.query(`
        DELETE FROM cloud_vaults c
        USING cloud_vaults c2
        WHERE c.user_id = c2.user_id
          AND c.vault_id = c2.vault_id
          AND c.ctid < c2.ctid
      `).catch(() => {/* table may not exist yet */});
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS cloud_vaults_user_vault_unique
          ON cloud_vaults(user_id, vault_id)
      `).catch((e: any) => console.error('[ensureUniqueIndexes cloud_vaults]', e.message));

      // Non-unique indexes on hot lookup columns. These accelerate the most
      // frequent queries: login (email), session lookup (token hash), share
      // resolution (token), payment lookup (email), cloud vault listing
      // (user_id). All are IF NOT EXISTS so they're safe to run on every
      // cold start.
      await Promise.all([
        db.query(`CREATE INDEX IF NOT EXISTS idx_crm_users_email ON crm_users(email)`),
        db.query(`CREATE INDEX IF NOT EXISTS idx_extension_sessions_token ON extension_sessions(jwt_token_hash) WHERE jwt_token_hash IS NOT NULL`),
        db.query(`CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token)`),
        db.query(`CREATE INDEX IF NOT EXISTS idx_payment_orders_email ON payment_orders(email)`),
        db.query(`CREATE INDEX IF NOT EXISTS idx_cloud_vaults_user ON cloud_vaults(user_id)`),
      ].map(p => p.catch((e: any) => console.error('[ensureUniqueIndexes hot-path index]', e.message))));

      _uniqueIndexesEnsured = true;
    } catch (e: any) {
      console.error('[ensureUniqueIndexes]', e.message);
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

  // Backup codes are stored hashed with scrypt + per-code random salt.
  // Format: `scrypt$<salt_hex>$<hash_hex>`. A single-pass HMAC was previously
  // used; scrypt's memory-hard parameters make offline cracking after a DB
  // dump dramatically more expensive without adding a new native dependency.
  function normalizeBackupCode(code: string): string {
    return code.replace(/[-\s]/g, '').toUpperCase();
  }

  async function hashBackupCodeAsync(code: string): Promise<string> {
    const normalized = normalizeBackupCode(code);
    const salt = randomBytes(16);
    const key = (await scrypt(normalized, salt, 32)) as Buffer;
    return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
  }

  async function verifyBackupCodeStored(input: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    const normalized = normalizeBackupCode(input);
    if (stored.startsWith('scrypt$')) {
      const parts = stored.split('$');
      if (parts.length !== 3) return false;
      try {
        const salt = Buffer.from(parts[1], 'hex');
        const expected = Buffer.from(parts[2], 'hex');
        const got = (await scrypt(normalized, salt, expected.length)) as Buffer;
        if (got.length !== expected.length) return false;
        return timingSafeEqual(got, expected);
      } catch { return false; }
    }
    // Legacy HMAC-SHA256(JWT_SECRET, normalized) — verify in constant time.
    const legacy = createHmac('sha256', JWT_SECRET).update(normalized).digest('hex');
    if (legacy.length !== stored.length) return false;
    return timingSafeEqual(Buffer.from(legacy, 'utf8'), Buffer.from(stored, 'utf8'));
  }

  // Synchronous form retained ONLY for legacy comparisons during disable / rotate
  // flows that read existing rows (which may still be HMAC-SHA256).
  function hashBackupCode(code: string): string {
    const normalized = normalizeBackupCode(code);
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
    // Fall back to backup codes — iterate and verify against each stored hash.
    // With scrypt-hashed codes we cannot do a constant-time index lookup, so we
    // walk the list. List size is bounded (10 codes) so the linear cost is fine.
    const backupCodes: string[] = row.totp_backup_codes || [];
    let matchedIdx = -1;
    for (let i = 0; i < backupCodes.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      if (await verifyBackupCodeStored(trimmed, backupCodes[i])) { matchedIdx = i; break; }
    }
    if (matchedIdx === -1) return { ok: false };
    // Consume the code (single use).
    const remaining = backupCodes.filter((_: string, i: number) => i !== matchedIdx);
    await db.query(`UPDATE crm_users SET totp_backup_codes = $1 WHERE id = $2`, [remaining, userId]);
    return { ok: true, usedBackup: true };
  }

  // ── POST /api/auth/2fa/setup — generate secret, return QR ───────────────────
  if (path === '/api/auth/2fa/setup' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
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
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    const cloudUser = await getCloudUser(req);
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
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid code' });
      }
      const backupCodes = generateBackupCodes(10);
      const hashedBackup = await Promise.all(backupCodes.map(hashBackupCodeAsync));
      // Cast to text[] for PostgreSQL array storage
      await db.query(
        `UPDATE crm_users SET totp_enabled = true, totp_backup_codes = $1::text[] WHERE id = $2`,
        [hashedBackup, cloudUser.userId]
      );
      return res.json({ enabled: true, backupCodes });
    } catch (err: any) {
      console.error('[2fa/verify]', err.message);
      return res.status(500).json({ error: '2FA verification failed' });
    }
  }

  // ── POST /api/auth/2fa/disable — requires account password OR valid TOTP/backup code
  // Either form of strong re-auth is accepted; this prevents a stolen session
  // alone from disabling 2FA. Body: { password?: string (sha256 hex), code?: string }
  if (path === '/api/auth/2fa/disable' && req.method === 'POST') {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const { code, password } = (req.body || {}) as { code?: unknown; password?: unknown };
    const codeStr = typeof code === 'string' && code.length > 0 ? code : null;
    const pwdStr = typeof password === 'string' && password.length > 0 ? password : null;
    if (!codeStr && !pwdStr) {
      return res.status(400).json({ error: 'password or code required' });
    }
    await ensureTotpColumns();
    try {
      let authed = false;
      if (pwdStr) {
        const { rows } = await db.query(
          `SELECT account_password_hash FROM crm_users WHERE id = $1 LIMIT 1`,
          [cloudUser.userId]
        );
        if (rows.length === 0) return res.status(401).json({ error: 'Auth required' });
        const v = await verifyAccountPassword(pwdStr, rows[0].account_password_hash);
        authed = v.ok;
      }
      if (!authed && codeStr) {
        const v = await verifyTotpOrBackup(cloudUser.userId, codeStr);
        authed = v.ok;
      }
      if (!authed) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid password or code' });
      }
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
    const cloudUser = await getCloudUser(req);
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
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'code required' });
    await ensureTotpColumns();
    try {
      const { rows } = await db.query(`SELECT totp_enabled FROM crm_users WHERE id = $1 LIMIT 1`, [cloudUser.userId]);
      if (!rows[0]?.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });
      const v = await verifyTotpOrBackup(cloudUser.userId, code);
      if (!v.ok) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid code' });
      }
      const backupCodes = generateBackupCodes(10);
      const hashedBackup = await Promise.all(backupCodes.map(hashBackupCodeAsync));
      // Cast to text[] for PostgreSQL array storage
      await db.query(`UPDATE crm_users SET totp_backup_codes = $1::text[] WHERE id = $2`, [hashedBackup, cloudUser.userId]);
      return res.json({ backupCodes });
    } catch (err: any) {
      console.error('[2fa/backup-codes]', err.message);
      return res.status(500).json({ error: 'backup code regeneration failed' });
    }
  }

  // ── POST /api/test-email ────────────────────────────────────────────────────
  // Admin-only utility used to preview transactional email templates. Without
  // auth, an attacker could spam arbitrary recipients with our verified-sender
  // brand. Require ADMIN_API_KEY (same gate as the admin RPCs).
  if (path === '/api/test-email' && req.method === 'POST') {
    const adminKey = process.env.ADMIN_API_KEY;
    const provided = (req.headers['x-admin-key'] as string) || '';
    if (!adminKey || !safeEq(provided, adminKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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
      console.error('[email-trigger] error:', err.message);
      return res.status(500).json({ error: 'Failed to send email' });
    }
  }

  // ── POST /api/auth/register ────────────────────────────────────────────────
  // Creates a new account with pending_verification status and sends a verification email.
  if (path === '/api/auth/register' && req.method === 'POST') {
    // QA-2026-05 SEC: per-IP signup rate limit. Without this an attacker can
    // flood Zoho CRM (createCrmContact is fire-and-forget on every signup),
    // exhaust verification-email quota, and spam the customers table. 3 / hour
    // is enough for legitimate household / device-switch signups.
    const _ip = getClientIp(req);
    if (checkAndRecordAction('register', _ip, 3, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many signup attempts. Please try again in an hour.' });
    }
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

      return res.status(201).json({ success: true, emailSent, verificationRequired: true, message: 'Account created. Please check your email to verify your account.' });
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
      // Timing-safe compare so token guessing can't be assisted by latency oracle.
      if (!user.verification_token || !safeEq(String(user.verification_token), String(token))) {
        return res.status(400).json({ error: 'Invalid verification link.' });
      }
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
  // Always returns the same response shape regardless of whether the account
  // exists / is already verified — prevents account-enumeration via this
  // endpoint. The work for actual unverified accounts still happens server-side.
  if (path === '/api/auth/resend-verification' && req.method === 'POST') {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const normalizedEmail = (email as string).toLowerCase().trim();
    const generic = { success: true, message: 'If an account with this email exists and is not yet verified, a verification email has been sent.' };
    try {
      const { rows } = await db.query(
        `SELECT id, full_name, account_status FROM crm_users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );
      const user = rows[0];
      if (user && user.account_status !== 'active') {
        const tokenChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const verifyToken = cryptoRandomString(64, tokenChars);
        await db.query(
          `UPDATE crm_users SET verification_token = $1, verification_token_expires_at = NOW() + INTERVAL '24 hours' WHERE id = $2`,
          [verifyToken, user.id]
        );
        const APP_URL_RES = process.env.APP_URL || 'https://www.ironvault.app';
        const verifyLink = `${APP_URL_RES}/auth/verify?token=${verifyToken}&email=${encodeURIComponent(normalizedEmail)}`;
        const tmpl = verificationEmail(user.full_name || normalizedEmail.split('@')[0], verifyLink);
        sendEmail({ to: normalizedEmail, ...tmpl }).catch(() => {});
      }
      return res.json(generic);
    } catch (err: any) {
      console.error('resend-verification error:', err.message);
      // Still return the same generic message — don't leak via error type.
      return res.json(generic);
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
      if (!safeEq(candidateHash, String(rows[0].code_hash || ''))) {
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
      // SECURITY: Use one generic message for "account does not exist", "no
      // password set", and "wrong password" — otherwise an attacker can probe
      // the user database to learn which emails are registered.
      if (!userRows[0]) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const userId: string = userRows[0].id;
      const storedHash = userRows[0].account_password_hash;
      if (!storedHash) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const verify = await verifyAccountPassword(accountPasswordHash, storedHash);
      if (!verify.ok) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      // Migrate legacy SHA-256 hashes to scrypt on successful login
      if (verify.legacy) {
        try {
          const upgraded = await hashAccountPassword(accountPasswordHash);
          await db.query(`UPDATE crm_users SET account_password_hash = $1 WHERE id = $2`, [upgraded, userId]);
        } catch (e: any) { console.error('[auth/token] hash upgrade failed:', e.message); }
      }
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

  // ── POST /api/auth/google ───────────────────────────────────────────────────
  // Sign in / sign up with a Google ID token. The client (web GSI or
  // Capacitor GoogleAuth plugin) hands us a JWT-shaped credential issued by
  // Google. We verify it via the tokeninfo endpoint, validate the audience
  // against our configured client IDs, then either create a new crm_users row
  // or look up the existing one and issue our own cloud-token JWT.
  if (path === '/api/auth/google' && req.method === 'POST') {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    const { idToken, platform } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken required' });
    }
    try {
      // Verify with Google. tokeninfo also re-validates the signature, so we
      // don't need the heavier google-auth-library dependency.
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!verifyRes.ok) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid Google token' });
      }
      const googleUser: any = await verifyRes.json();

      // Audience check — must match one of our configured OAuth client IDs.
      const GOOGLE_CLIENT_IDS = [
        process.env.GOOGLE_CLIENT_ID_WEB,
        process.env.GOOGLE_CLIENT_ID_IOS,
        process.env.GOOGLE_CLIENT_ID_ANDROID,
      ].filter(Boolean) as string[];
      if (GOOGLE_CLIENT_IDS.length === 0) {
        console.error('[auth/google] no GOOGLE_CLIENT_ID_* env vars configured');
        return res.status(500).json({ error: 'Google sign-in not configured' });
      }
      if (!googleUser.aud || !GOOGLE_CLIENT_IDS.includes(googleUser.aud)) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid token audience' });
      }
      // Issuer must be Google. tokeninfo wouldn't 200 otherwise but be defensive.
      if (googleUser.iss !== 'https://accounts.google.com' && googleUser.iss !== 'accounts.google.com') {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Invalid issuer' });
      }
      // Expiry: tokeninfo returns `exp` as a unix-seconds string.
      const expSec = parseInt(String(googleUser.exp || '0'), 10);
      if (!expSec || expSec * 1000 < Date.now()) {
        recordLoginFailure(clientIp);
        return res.status(401).json({ error: 'Token expired' });
      }

      const email = (googleUser.email || '').toLowerCase().trim();
      const emailVerified = googleUser.email_verified === true || googleUser.email_verified === 'true';
      if (!email || !emailVerified) {
        return res.status(400).json({ error: 'Verified Google email required' });
      }
      const fullName = stripHtml(googleUser.name || email.split('@')[0]);
      const profilePicture = googleUser.picture || null;
      const googleId = googleUser.sub;

      // Make sure the auth_provider columns exist before touching them. Cheap
      // on subsequent calls (memoized flag inside ensureGoogleAuthColumns).
      await ensureGoogleAuthColumns();

      // Look up or create user.
      const { rows } = await db.query(
        `SELECT id, email, full_name, account_status FROM crm_users WHERE email = $1 LIMIT 1`,
        [email]
      );
      let userId: string;
      let isNewUser = false;
      let resolvedFullName = fullName;

      if (rows[0]) {
        userId = rows[0].id;
        // If the existing row is still pending verification (registered via
        // password but never clicked the link), Google's email_verified=true
        // is sufficient to flip it to active — Google has already proven
        // ownership of the inbox.
        if (rows[0].account_status === 'pending_verification') {
          await db.query(
            `UPDATE crm_users SET account_status = 'active' WHERE id = $1`,
            [userId]
          );
        }
        // Backfill auth_provider / google_id / profile_picture without
        // overwriting an existing non-google provider record (e.g. password).
        await db.query(
          `UPDATE crm_users
             SET google_id = COALESCE(google_id, $1),
                 profile_picture = COALESCE($2, profile_picture),
                 auth_provider = COALESCE(auth_provider, 'google'),
                 last_active_at = NOW()
           WHERE id = $3`,
          [googleId, profilePicture, userId]
        );
        resolvedFullName = rows[0].full_name || fullName;
      } else {
        isNewUser = true;
        const { rows: newRows } = await db.query(
          `INSERT INTO crm_users
             (email, full_name, auth_provider, google_id, profile_picture, account_status, marketing_consent, support_consent)
           VALUES ($1, $2, 'google', $3, $4, 'active', true, true)
           RETURNING id`,
          [email, fullName, googleId, profilePicture]
        );
        userId = newRows[0].id;

        // Mirror in customers + entitlements (non-blocking, same pattern as /api/auth/register).
        db.query(
          `INSERT INTO customers (email, full_name, platform, plan_type, status, marketing_consent)
           VALUES ($1, $2, $3, 'free', 'active', true)
           ON CONFLICT (email) DO NOTHING`,
          [email, fullName, platform || 'web']
        ).catch(() => {});
        db.query(
          `INSERT INTO entitlements (user_id, plan, status, trial_active, will_renew, admin_override)
           VALUES ($1, 'free', 'active', false, false, false) ON CONFLICT DO NOTHING`,
          [userId]
        ).catch(() => {});

        // Fire-and-forget CRM sync — same as register.
        const nameParts = fullName.split(' ');
        createCrmContact({
          email,
          firstName: nameParts[0] || fullName,
          lastName: nameParts.slice(1).join(' ') || email,
          source: 'Google Sign-In',
          plan: 'free',
        }).catch(() => {});
      }

      // Successful auth — wipe failure counter for this IP.
      clearLoginFailures(clientIp);

      const token = signCloudToken(userId, email);

      // Register session in extension_sessions — same as /api/auth/token.
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
          [userId, deviceName, browser, os, ip, ua, clientKind, tokenHash]
        );
        sessionId = sessRows[0]?.id || null;
      } catch (e: any) {
        console.error('[auth/google] session register failed:', e.message);
      }

      return res.json({
        success: true,
        token,
        userId,
        email,
        fullName: resolvedFullName,
        isNewUser,
        authProvider: 'google',
        sessionId,
      });
    } catch (err: any) {
      console.error('auth/google error:', err.message);
      return res.status(500).json({ error: 'Google sign-in failed' });
    }
  }

  // ── POST /api/auth/apple ────────────────────────────────────────────────────
  // Sign in / sign up with an Apple identity token. The client (web Apple JS
  // SDK or Capacitor social-login plugin) hands us a JWT issued by Apple. We
  // verify its signature against Apple's JWKS, validate the audience against
  // our configured Services / Bundle IDs, then either create a new crm_users
  // row or look up the existing one and issue our own cloud-token JWT.
  //
  // Apple only sends `email` and the `user.name` block on the FIRST sign-in.
  // Subsequent sign-ins return just `sub`, so the client may pass an
  // optional `user` payload (name fields) on first registration. The email
  // claim inside the verified ID token is the source of truth.
  if (path === '/api/auth/apple' && req.method === 'POST') {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    const { idToken, platform, user: appleUserPayload } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken required' });
    }
    try {
      const APPLE_CLIENT_IDS = [
        process.env.APPLE_CLIENT_ID_WEB,
        process.env.APPLE_CLIENT_ID_IOS,
        process.env.APPLE_CLIENT_ID_ANDROID,
      ].filter(Boolean) as string[];
      if (APPLE_CLIENT_IDS.length === 0) {
        console.error('[auth/apple] no APPLE_CLIENT_ID_* env vars configured');
        return res.status(500).json({ error: 'Apple sign-in not configured' });
      }

      let appleClaims: Awaited<ReturnType<typeof verifyAppleIdentityToken>>;
      try {
        appleClaims = await verifyAppleIdentityToken(idToken, APPLE_CLIENT_IDS);
      } catch (verErr: any) {
        recordLoginFailure(clientIp);
        console.error('[auth/apple] verify failed:', verErr.message);
        return res.status(401).json({ error: 'Invalid Apple token' });
      }

      const appleSub = appleClaims.sub;
      const tokenEmail = (appleClaims.email || '').toLowerCase().trim();
      const tokenEmailVerified =
        appleClaims.email_verified === true || appleClaims.email_verified === 'true';

      // First-time-only display name payload from the client.
      const givenName =
        typeof appleUserPayload?.name?.firstName === 'string' ? appleUserPayload.name.firstName : '';
      const familyName =
        typeof appleUserPayload?.name?.lastName === 'string' ? appleUserPayload.name.lastName : '';
      const composedName = `${givenName} ${familyName}`.trim();

      await ensureAppleAuthColumns();

      // Look up by apple_id first (handles private-relay emails that change),
      // then fall back to email match.
      const { rows: byApple } = await db.query(
        `SELECT id, email, full_name, account_status FROM crm_users WHERE apple_id = $1 LIMIT 1`,
        [appleSub]
      );

      let existingRow: any = byApple[0] || null;
      if (!existingRow && tokenEmail) {
        const { rows: byEmail } = await db.query(
          `SELECT id, email, full_name, account_status FROM crm_users WHERE email = $1 LIMIT 1`,
          [tokenEmail]
        );
        existingRow = byEmail[0] || null;
      }

      let userId: string;
      let isNewUser = false;
      let resolvedFullName = '';
      let resolvedEmail = tokenEmail;

      if (existingRow) {
        userId = existingRow.id;
        resolvedEmail = (existingRow.email || tokenEmail || '').toLowerCase().trim();
        if (existingRow.account_status === 'pending_verification' && tokenEmailVerified) {
          await db.query(
            `UPDATE crm_users SET account_status = 'active' WHERE id = $1`,
            [userId]
          );
        }
        await db.query(
          `UPDATE crm_users
             SET apple_id = COALESCE(apple_id, $1),
                 auth_provider = COALESCE(auth_provider, 'apple'),
                 last_active_at = NOW()
           WHERE id = $2`,
          [appleSub, userId]
        );
        resolvedFullName = existingRow.full_name || composedName || (resolvedEmail.split('@')[0]) || 'Apple User';
      } else {
        // New user. We need an email — Apple's token always includes one on
        // first sign-up (either the real address or a private-relay alias).
        if (!resolvedEmail) {
          return res.status(400).json({ error: 'Apple did not return an email on first sign-in' });
        }
        isNewUser = true;
        resolvedFullName = stripHtml(composedName || resolvedEmail.split('@')[0]);
        const { rows: newRows } = await db.query(
          `INSERT INTO crm_users
             (email, full_name, auth_provider, apple_id, account_status, marketing_consent, support_consent)
           VALUES ($1, $2, 'apple', $3, 'active', true, true)
           RETURNING id`,
          [resolvedEmail, resolvedFullName, appleSub]
        );
        userId = newRows[0].id;

        db.query(
          `INSERT INTO customers (email, full_name, platform, plan_type, status, marketing_consent)
           VALUES ($1, $2, $3, 'free', 'active', true)
           ON CONFLICT (email) DO NOTHING`,
          [resolvedEmail, resolvedFullName, platform || 'web']
        ).catch(() => {});
        db.query(
          `INSERT INTO entitlements (user_id, plan, status, trial_active, will_renew, admin_override)
           VALUES ($1, 'free', 'active', false, false, false) ON CONFLICT DO NOTHING`,
          [userId]
        ).catch(() => {});

        const nameParts = resolvedFullName.split(' ');
        createCrmContact({
          email: resolvedEmail,
          firstName: nameParts[0] || resolvedFullName,
          lastName: nameParts.slice(1).join(' ') || resolvedEmail,
          source: 'Apple Sign-In',
          plan: 'free',
        }).catch(() => {});
      }

      clearLoginFailures(clientIp);

      const token = signCloudToken(userId, resolvedEmail);

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
          [userId, deviceName, browser, os, ip, ua, clientKind, tokenHash]
        );
        sessionId = sessRows[0]?.id || null;
      } catch (e: any) {
        console.error('[auth/apple] session register failed:', e.message);
      }

      return res.json({
        success: true,
        token,
        userId,
        email: resolvedEmail,
        fullName: resolvedFullName,
        isNewUser,
        authProvider: 'apple',
        sessionId,
      });
    } catch (err: any) {
      console.error('auth/apple error:', err.message);
      return res.status(500).json({ error: 'Apple sign-in failed' });
    }
  }

  // ── Passkey (FIDO2/WebAuthn) ────────────────────────────────────────────────
  // Four endpoints implement the standard two-step ceremony:
  //   1. /register-options — server generates a challenge + relying-party info
  //   2. /register         — server verifies the attestation, stores credential
  //   3. /authenticate-options — server generates challenge for an existing cred
  //   4. /authenticate     — server verifies the assertion, issues cloud JWT
  //
  // Credentials live in `passkey_credentials`; transient challenges live in
  // `passkey_challenges` keyed on the challenge itself (deleted after use).
  // Challenge GC: rows older than 10 minutes are stale and ignored.

  if (path === '/api/auth/passkey/register-options' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensurePasskeyTable();
    try {
      const { rows: existing } = await db.query(
        `SELECT credential_id FROM passkey_credentials WHERE user_id = $1`,
        [cloudUser.userId]
      );
      const opts = await generateRegistrationOptions({
        rpName: 'IronVault',
        rpID: passkeyRpId(),
        userName: cloudUser.email,
        userDisplayName: cloudUser.email,
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
        excludeCredentials: existing.map((r: any) => ({
          id: r.credential_id,
          type: 'public-key' as const,
        })),
      });
      await db.query(
        `INSERT INTO passkey_challenges (challenge, user_id, email, purpose)
         VALUES ($1, $2, $3, 'register')
         ON CONFLICT (challenge) DO UPDATE SET created_at = NOW()`,
        [opts.challenge, cloudUser.userId, cloudUser.email]
      );
      return res.json(opts);
    } catch (err: any) {
      console.error('[passkey/register-options]', err.message);
      return res.status(500).json({ error: 'Failed to generate options' });
    }
  }

  if (path === '/api/auth/passkey/register' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensurePasskeyTable();
    const { attestationResponse, deviceLabel } = (req.body || {}) as any;
    if (!attestationResponse) return res.status(400).json({ error: 'attestationResponse required' });
    try {
      const expectedChallenge = attestationResponse?.response?.clientDataJSON
        ? JSON.parse(Buffer.from(attestationResponse.response.clientDataJSON, 'base64url').toString()).challenge
        : null;
      if (!expectedChallenge) return res.status(400).json({ error: 'Malformed response' });

      const { rows } = await db.query(
        `SELECT user_id FROM passkey_challenges
          WHERE challenge = $1 AND user_id = $2 AND purpose = 'register'
            AND created_at > NOW() - INTERVAL '10 minutes'`,
        [expectedChallenge, cloudUser.userId]
      );
      if (rows.length === 0) return res.status(400).json({ error: 'Stale or unknown challenge' });

      const verification = await verifyRegistrationResponse({
        response: attestationResponse,
        expectedChallenge,
        expectedOrigin: passkeyOrigin(),
        expectedRPID: passkeyRpId(),
      });
      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Verification failed' });
      }
      const reg = verification.registrationInfo as any;
      const credentialId: string = reg.credential?.id || reg.credentialID;
      const publicKey: Uint8Array = reg.credential?.publicKey || reg.credentialPublicKey;
      const counter: number = reg.credential?.counter ?? reg.counter ?? 0;
      const transports = Array.isArray(attestationResponse.response?.transports)
        ? attestationResponse.response.transports.join(',')
        : null;
      await db.query(
        `INSERT INTO passkey_credentials (user_id, credential_id, public_key, counter, transports, device_label)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (credential_id) DO NOTHING`,
        [cloudUser.userId, credentialId, Buffer.from(publicKey), counter, transports, (deviceLabel || '').slice(0, 80) || null]
      );
      await db.query(`DELETE FROM passkey_challenges WHERE challenge = $1`, [expectedChallenge]);
      return res.json({ success: true, credentialId });
    } catch (err: any) {
      console.error('[passkey/register]', err.message);
      return res.status(500).json({ error: 'Registration failed' });
    }
  }

  if (path === '/api/auth/passkey/authenticate-options' && req.method === 'POST') {
    try {
      await ensurePasskeyTable();
    } catch (e: any) {
      return res.status(500).json({ error: 'Passkey table init failed', detail: e.message });
    }
    const { email } = (req.body || {}) as any;
    try {
      let userId: string | null = null;
      let allowCredentials: any[] = [];
      if (email && typeof email === 'string') {
        const e = email.toLowerCase().trim();
        const { rows } = await db.query(`SELECT id FROM crm_users WHERE email = $1 LIMIT 1`, [e]);
        if (rows[0]) {
          userId = rows[0].id;
          const { rows: creds } = await db.query(
            `SELECT credential_id, transports FROM passkey_credentials WHERE user_id = $1`,
            [userId]
          );
          allowCredentials = creds.map((r: any) => ({
            id: r.credential_id,
            type: 'public-key',
            ...(r.transports ? { transports: r.transports.split(',').filter(Boolean) } : {}),
          }));
        }
      }
      const opts = await generateAuthenticationOptions({
        rpID: passkeyRpId(),
        userVerification: 'preferred',
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      });
      await db.query(
        `INSERT INTO passkey_challenges (challenge, user_id, email, purpose)
         VALUES ($1, $2, $3, 'authenticate')
         ON CONFLICT (challenge) DO UPDATE SET created_at = NOW()`,
        [opts.challenge, userId, email || null]
      );
      return res.json(opts);
    } catch (err: any) {
      console.error('[passkey/auth-options]', err.message);
      return res.status(500).json({ error: 'Failed to generate options' });
    }
  }

  if (path === '/api/auth/passkey/authenticate' && req.method === 'POST') {
    await ensurePasskeyTable();
    const { assertionResponse } = (req.body || {}) as any;
    if (!assertionResponse) return res.status(400).json({ error: 'assertionResponse required' });
    try {
      const expectedChallenge = assertionResponse?.response?.clientDataJSON
        ? JSON.parse(Buffer.from(assertionResponse.response.clientDataJSON, 'base64url').toString()).challenge
        : null;
      if (!expectedChallenge) return res.status(400).json({ error: 'Malformed response' });

      const { rows: chalRows } = await db.query(
        `SELECT user_id, email FROM passkey_challenges
          WHERE challenge = $1 AND purpose = 'authenticate'
            AND created_at > NOW() - INTERVAL '10 minutes'`,
        [expectedChallenge]
      );
      if (chalRows.length === 0) return res.status(400).json({ error: 'Stale or unknown challenge' });

      const credentialId: string = assertionResponse.id;
      const { rows: credRows } = await db.query(
        `SELECT pc.public_key, pc.counter, pc.user_id, u.email
           FROM passkey_credentials pc
           JOIN crm_users u ON u.id = pc.user_id
          WHERE pc.credential_id = $1
          LIMIT 1`,
        [credentialId]
      );
      if (credRows.length === 0) return res.status(404).json({ error: 'Unknown credential' });
      const cred = credRows[0];

      const verification = await verifyAuthenticationResponse({
        response: assertionResponse,
        expectedChallenge,
        expectedOrigin: passkeyOrigin(),
        expectedRPID: passkeyRpId(),
        credential: {
          id: credentialId,
          publicKey: new Uint8Array(cred.public_key),
          counter: Number(cred.counter),
        },
      });
      if (!verification.verified) return res.status(401).json({ error: 'Verification failed' });

      const newCounter = (verification.authenticationInfo as any)?.newCounter ?? Number(cred.counter) + 1;
      await db.query(
        `UPDATE passkey_credentials SET counter = $1, last_used_at = NOW() WHERE credential_id = $2`,
        [newCounter, credentialId]
      );
      await db.query(`DELETE FROM passkey_challenges WHERE challenge = $1`, [expectedChallenge]);

      const token = signCloudToken(cred.user_id, cred.email);
      return res.json({
        success: true,
        token,
        userId: cred.user_id,
        email: cred.email,
        authProvider: 'passkey',
      });
    } catch (err: any) {
      console.error('[passkey/authenticate]', err.message);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  }

  if (path === '/api/auth/passkey/list' && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensurePasskeyTable();
    try {
      const { rows } = await db.query(
        `SELECT credential_id, device_label, transports, created_at, last_used_at
           FROM passkey_credentials WHERE user_id = $1 ORDER BY created_at DESC`,
        [cloudUser.userId]
      );
      return res.json({
        credentials: rows.map((r: any) => ({
          credentialId: r.credential_id,
          deviceLabel: r.device_label,
          transports: r.transports ? r.transports.split(',').filter(Boolean) : [],
          createdAt: r.created_at,
          lastUsedAt: r.last_used_at,
        })),
      });
    } catch (err: any) {
      console.error('[passkey/list]', err.message);
      return res.status(500).json({ error: 'Failed to list credentials' });
    }
  }

  // ── Password share links ────────────────────────────────────────────────────
  // The client encrypts the credential on-device with a freshly-generated
  // AES key, sends the ciphertext + IV here, and embeds the raw key in the
  // URL fragment when sharing the link. The server therefore never sees
  // the password — only an opaque blob plus TTL and view-count metadata.
  if (path === '/api/share/create' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      await ensureSharedLinkTable();
    } catch (e: any) {
      return res.status(500).json({ error: 'Share-link table init failed', detail: e.message });
    }
    const { encryptedPayload, iv, itemLabel, itemKind, maxViews, ttlSeconds } = (req.body || {}) as any;
    if (!encryptedPayload || !iv) return res.status(400).json({ error: 'encryptedPayload + iv required' });
    if (typeof encryptedPayload !== 'string' || encryptedPayload.length > 50_000) {
      return res.status(400).json({ error: 'encryptedPayload too large' });
    }
    const views = Math.min(50, Math.max(1, parseInt(String(maxViews ?? 1), 10) || 1));
    const ttl = Math.min(30 * 24 * 3600, Math.max(60, parseInt(String(ttlSeconds ?? 24 * 3600), 10) || 24 * 3600));
    const id = cryptoRandomString(22, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
    const expiresAt = new Date(Date.now() + ttl * 1000);
    try {
      await db.query(
        `INSERT INTO shared_links (id, owner_user_id, owner_email, encrypted_payload, iv, item_label, item_kind, max_views, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, cloudUser.userId, cloudUser.email, encryptedPayload, iv,
         (itemLabel || '').slice(0, 120) || null, (itemKind || '').slice(0, 24) || null,
         views, expiresAt]
      );
      return res.json({
        id,
        expiresAt: expiresAt.toISOString(),
        maxViews: views,
      });
    } catch (err: any) {
      console.error('[share/create]', err.message);
      return res.status(500).json({ error: 'Could not create share link' });
    }
  }

  if (path === '/api/share/redeem' && req.method === 'POST') {
    try {
      await ensureSharedLinkTable();
    } catch (e: any) {
      return res.status(500).json({ error: 'Share-link table init failed', detail: e.message });
    }
    const { id } = (req.body || {}) as any;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });
    try {
      const { rows } = await db.query(
        `SELECT encrypted_payload, iv, item_label, item_kind, max_views, view_count, expires_at, revoked_at
           FROM shared_links WHERE id = $1`,
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Link not found or expired' });
      const row = rows[0];
      if (row.revoked_at) return res.status(410).json({ error: 'Link revoked by owner' });
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(410).json({ error: 'Link expired' });
      }
      if (row.view_count >= row.max_views) {
        return res.status(410).json({ error: 'Link view limit reached' });
      }
      // Atomic-ish increment. Two near-simultaneous redemptions could both
      // succeed at the boundary; that's accepted (the user explicitly
      // allowed N views and one extra over the boundary is harmless).
      const updated = await db.query(
        `UPDATE shared_links SET view_count = view_count + 1
           WHERE id = $1 AND view_count < max_views
         RETURNING view_count, max_views`,
        [id]
      );
      const viewCount = updated.rows[0]?.view_count ?? row.view_count + 1;
      return res.json({
        encryptedPayload: row.encrypted_payload,
        iv: row.iv,
        itemLabel: row.item_label,
        itemKind: row.item_kind,
        viewCount,
        maxViews: row.max_views,
        expiresAt: row.expires_at,
      });
    } catch (err: any) {
      console.error('[share/redeem]', err.message);
      return res.status(500).json({ error: 'Redeem failed' });
    }
  }

  if (path === '/api/share/list' && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensureSharedLinkTable();
    try {
      const { rows } = await db.query(
        `SELECT id, item_label, item_kind, max_views, view_count, created_at, expires_at, revoked_at
           FROM shared_links
          WHERE owner_user_id = $1
            AND (revoked_at IS NULL AND expires_at > NOW())
          ORDER BY created_at DESC
          LIMIT 100`,
        [cloudUser.userId]
      );
      return res.json({
        links: rows.map((r: any) => ({
          id: r.id,
          itemLabel: r.item_label,
          itemKind: r.item_kind,
          maxViews: r.max_views,
          viewCount: r.view_count,
          createdAt: r.created_at,
          expiresAt: r.expires_at,
        })),
      });
    } catch (err: any) {
      console.error('[share/list]', err.message);
      return res.status(500).json({ error: 'List failed' });
    }
  }

  if (path === '/api/share/revoke' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensureSharedLinkTable();
    const { id } = (req.body || {}) as any;
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      const r = await db.query(
        `UPDATE shared_links SET revoked_at = NOW() WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [id, cloudUser.userId]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Link not found' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[share/revoke]', err.message);
      return res.status(500).json({ error: 'Revoke failed' });
    }
  }

  if (path === '/api/auth/passkey/delete' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensurePasskeyTable();
    const { credentialId } = (req.body || {}) as any;
    if (!credentialId) return res.status(400).json({ error: 'credentialId required' });
    try {
      await db.query(
        `DELETE FROM passkey_credentials WHERE user_id = $1 AND credential_id = $2`,
        [cloudUser.userId, credentialId]
      );
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[passkey/delete]', err.message);
      return res.status(500).json({ error: 'Failed to delete' });
    }
  }

  // ── DELETE /api/auth/account ────────────────────────────────────────────────
  // Permanently delete the authenticated user and every record we have for
  // them. Best-effort across known related tables — failures on individual
  // tables are swallowed so the core crm_users row still gets removed.
  if (path === '/api/auth/account' && req.method === 'DELETE') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const userId = cloudUser.userId;
    const email = cloudUser.email;
    // SEC-03 / SEC-19: irreversible action — require fresh password (and TOTP
    // if 2FA is enabled) so a stolen bearer token alone can't nuke the account.
    const { password, totpCode } = (req.body || {}) as { password?: string; totpCode?: string };
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'password required' });
    }
    try {
      const { rows: pwRows } = await db.query(
        `SELECT account_password_hash, totp_enabled FROM crm_users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      if (pwRows.length === 0) return res.status(404).json({ error: 'Account not found' });
      const v = await verifyAccountPassword(password, pwRows[0].account_password_hash);
      if (!v.ok) {
        recordLoginFailure(getClientIp(req));
        return res.status(401).json({ error: 'Invalid password' });
      }
      if (pwRows[0].totp_enabled) {
        if (!totpCode || typeof totpCode !== 'string') {
          return res.status(400).json({ error: 'totpCode required', requires2fa: true });
        }
        const tv = await verifyTotpOrBackup(userId, totpCode);
        if (!tv.ok) {
          recordLoginFailure(getClientIp(req));
          return res.status(401).json({ error: 'Invalid 2FA code' });
        }
      }
    } catch (err: any) {
      console.error('[auth/account DELETE pw-check]', err.message);
      return res.status(500).json({ error: 'Account deletion failed' });
    }
    try {
      // Wipe rows in dependent tables first to avoid FK trip-ups, but tolerate
      // any individual failure (table may not exist on older deploys).
      const safeQuery = async (sql: string, params: any[]) => {
        try { await db.query(sql, params); } catch (e: any) {
          console.error(`[auth/account DELETE] swallow ${sql.split(' ')[1]}:`, e.message);
        }
      };
      await safeQuery(`DELETE FROM entitlements WHERE user_id = $1`, [userId]);
      await safeQuery(`DELETE FROM extension_sessions WHERE user_id = $1`, [userId]);
      await safeQuery(`DELETE FROM share_links WHERE user_id = $1`, [userId]);
      // QA-R2 C3: shared_links table has no user FK column (token-only).
      // Skip it; rows expire on their own via expires_at.
      await safeQuery(`DELETE FROM cloud_vaults WHERE user_id = $1`, [userId]);
      await safeQuery(`DELETE FROM payment_orders WHERE email = $1`, [email]);
      await safeQuery(`DELETE FROM vault_activity WHERE user_id = $1`, [userId]);
      await safeQuery(`DELETE FROM customers WHERE email = $1`, [email]);
      // QA-R2 C3: tables that were missing from the original cleanup.
      // tickets has both customer_id (FK to customers) and customer_email,
      // so we delete by both to catch rows where one column was nulled.
      await safeQuery(`DELETE FROM tickets WHERE customer_email = $1`, [email]);
      await safeQuery(`DELETE FROM plan_audit_log WHERE customer_email = $1`, [email]);
      await safeQuery(`DELETE FROM auth_verification_codes WHERE email = $1`, [email]);
      await safeQuery(`DELETE FROM password_reset_tokens WHERE email = $1`, [email]);
      await safeQuery(`DELETE FROM billing_events WHERE user_id = $1`, [userId]);
      await safeQuery(`DELETE FROM ticket_replies WHERE user_id = $1`, [userId]);
      await safeQuery(`DELETE FROM support_tickets WHERE user_id = $1`, [userId]);
      await safeQuery(`DELETE FROM deletion_requests WHERE email = $1`, [email]);

      const { rowCount } = await db.query(`DELETE FROM crm_users WHERE id = $1`, [userId]);
      if (!rowCount) return res.status(404).json({ error: 'Account not found' });
      // Best-effort: remove the user's Zoho CRM contact so PII doesn't linger
      // after deletion (GDPR/CCPA). Don't fail the response if this errors.
      deleteCrmContactByEmail(email).catch((e: any) =>
        console.error('[auth/account DELETE] zoho-crm cleanup failed:', e?.message)
      );
      return res.json({ success: true, deleted: true });
    } catch (err: any) {
      console.error('[auth/account DELETE]', err.message);
      return res.status(500).json({ error: 'Account deletion failed' });
    }
  }

  // ── GET /api/auth/me ────────────────────────────────────────────────────────
  // QA-R2 H9: returns the authenticated user's display name + email so the
  // dashboard greeting can show the ACTUAL name the user typed at signup
  // ("Saket" rather than "Saketsuman1312" parsed out of the email prefix).
  // If full_name matches the email prefix exactly, return null so the client
  // falls back to email-based humanization which produces a better result.
  // Tiny endpoint by design — anything more belongs in /api/profile.
  if (path === '/api/auth/me' && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { rows } = await db.query(
        `SELECT id, email, full_name FROM crm_users WHERE id = $1 LIMIT 1`,
        [cloudUser.userId]
      );
      const row = rows[0];
      if (!row) return res.status(404).json({ error: 'Not found' });

      // Check if full_name is just the email prefix
      let fullName = row.full_name || null;
      if (fullName) {
        const emailLocal = row.email.split('@')[0];
        if (fullName.toLowerCase() === emailLocal.toLowerCase()) {
          fullName = null; // Treat email prefix as not set
        }
      }

      return res.json({
        userId: row.id,
        email: row.email,
        fullName,
      });
    } catch (err: any) {
      console.error('[auth/me] error:', err.message);
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── GET /api/vaults/cloud ───────────────────────────────────────────────────
  if (path === '/api/vaults/cloud' && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
      const priorCount = parseInt(priorVaults[0]?.cnt ?? '0', 10);
      const isFirstVault = priorCount === 0;
      // QA-R2 C4: enforce per-plan vault cap server-side. The client also gates
      // creation but a malicious client could bypass that. Mirror the limits
      // published at /api/plans (free=1, pro=5, family=5, lifetime=5,
      // pro_family_member=2; -1 = unlimited).
      const VAULT_LIMITS: Record<string, number> = {
        free: 1,
        pro: 5,
        family: 5,
        lifetime: 5,
        pro_family_member: 2,
      };
      const cap = VAULT_LIMITS[plan as string] ?? 1;
      if (cap !== -1 && priorCount >= cap) {
        return res.status(403).json({
          error: `Vault limit reached (${cap}). Delete an existing vault or upgrade your plan to add more.`,
          code: 'VAULT_LIMIT_REACHED',
          cap,
          current: priorCount,
        });
      }
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
  // Idempotent — safe to re-run. Admin-only (ADMIN_API_KEY).
  if (path === '/api/crm/migrate' && req.method === 'POST') {
    const adminKey = req.headers['x-admin-key'] as string;
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) return res.status(500).json({ error: 'ADMIN_API_KEY not configured' });
    if (!adminKey || !safeEq(adminKey, expectedAdminKey)) return res.status(401).json({ error: 'Unauthorized' });
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

        -- Tickets: track Zoho Desk linkage so inbound webhooks (agent replies)
        -- can be correlated back to the local row.
        ALTER TABLE tickets
          ADD COLUMN IF NOT EXISTS zoho_ticket_id TEXT,
          ADD COLUMN IF NOT EXISTS zoho_ticket_number TEXT;
        CREATE INDEX IF NOT EXISTS idx_tickets_zoho_id ON tickets(zoho_ticket_id);
      `);
      return res.json({ success: true, message: 'Schema migration complete (BUG-023)' });
    } catch (err: any) {
      console.error('[migrate] error:', err.message);
      return res.status(500).json({ error: 'Migration failed' });
    }
  }

  // ── GET /api/crm/family-invites/invitee/:email ───────────────────────────────
  if (path.startsWith('/api/crm/family-invites/invitee/') && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
      await sendEmail({ to: String(inviteeEmail).toLowerCase(), ...familyInviteEmail(ownerEmail, rows[0].id, String(inviteeEmail).toLowerCase()) });
      return res.json({ success: true, invite: rows[0] });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── PATCH /api/crm/family-invites/:id ────────────────────────────────────────
  // Accepts status: accepted | declined | revoked
  if (path.match(/^\/api\/crm\/family-invites\/[^/]+$/) && req.method === 'PATCH') {
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    // QA-2026-05 SEC: per-IP rate limit. Previously unprotected — an attacker
    // could spam reset emails to any address (SMTP-quota / inbox-flood vector).
    // Live audit confirmed 8 consecutive 200s with no throttle. 5 / 15min
    // matches /api/auth/token; legitimate users rarely need more than 1.
    const _ip = getClientIp(req);
    if (checkAndRecordAction('forgot-pw', _ip, 5, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many password reset requests. Please try again in 15 minutes.' });
    }
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
        // QA-R2 H1: in production, NEVER return the reset token in the
        // response — that's an account-takeover vector if SMTP is mis-
        // configured. Generic "we sent it" so the response shape mirrors
        // the success path (and we don't leak whether SMTP is broken).
        // The token still exists in password_reset_tokens; the legitimate
        // user just won't get an email. Logs surface the misconfig.
        if (process.env.NODE_ENV === 'production') {
          console.error('[forgot-password] SMTP not configured in production — token NOT delivered for', normalizedEmail);
          return res.json({ success: true, emailSent: false });
        }
        // Non-production (dev / preview): keep the inline reset link for
        // local testing convenience.
        return res.json({ success: true, emailSent: false, resetCode: token, resetLink });
      }
    } catch (err: any) {
      console.error('forgot-password error:', err.message);
      return res.status(500).json({ error: 'Failed to generate reset code' });
    }
  }

  // ── POST /api/auth/reset-password ──────────────────────────────────────────
  if (path === '/api/auth/reset-password' && req.method === 'POST') {
    // QA-2026-05 SEC: per-IP rate limit. The reset token is 16 chars from a
    // 32-char alphabet (~80 bits) so blind guessing is infeasible, but a
    // network-eavesdropper or shoulder-surfer could brute-force a partial.
    // 5 / 15min stops the cheap attack and matches forgot-password.
    const _ip = getClientIp(req);
    if (checkAndRecordAction('reset-pw', _ip, 5, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many reset attempts. Please try again in 15 minutes.' });
    }
    const { email, token, newPasswordHash } = req.body || {};
    if (!email || !token || !newPasswordHash) {
      return res.status(400).json({ error: 'email, token and newPasswordHash required' });
    }
    const normalizedEmail = (email as string).toLowerCase().trim();
    try {
      // Token-based flow only — tokenless else-branch removed (allowed account
      // takeover with just an email). Compare token in app-layer with a
      // timing-safe equality so SQL latency doesn't leak token bytes.
      const submittedToken = (token as string).toUpperCase();
      const { rows } = await db.query(
        `SELECT id, token FROM password_reset_tokens
         WHERE email = $1 AND used = false AND expires_at > NOW()
         ORDER BY created_at DESC NULLS LAST
         LIMIT 1`,
        [normalizedEmail]
      );
      const candidate = rows[0];
      if (!candidate || !candidate.token || !safeEq(String(candidate.token).toUpperCase(), submittedToken)) {
        return res.status(400).json({ error: 'Invalid or expired reset code' });
      }
      await db.query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [candidate.id]);

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
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) {
      return res.status(500).json({ error: 'ADMIN_API_KEY not configured' });
    }
    if (!adminKey || !safeEq(adminKey, expectedAdminKey)) {
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
      console.error('[admin/set-plan] error:', err.message);
      return res.status(500).json({ error: 'Failed to update plan' });
    }
  }

  // ── GET /api/admin/users ────────────────────────────────────────────────────
  // Returns active users for the n8n backup-reminder workflow.
  // Protected by N8N_API_KEY env var via the x-api-key header.
  // lastBackupAt is derived from the most recent cloud_vaults.server_updated_at row.
  if (path === '/api/admin/users' && req.method === 'GET') {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const expected = process.env.N8N_API_KEY;
    if (!expected || !apiKey || !safeEq(apiKey, expected)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      // Pagination — defaults to 100, hard cap at 500 to bound response size.
      const url = new URL(req.url || '', 'http://localhost');
      const limitRaw = parseInt(url.searchParams.get('limit') || '100', 10);
      const offsetRaw = parseInt(url.searchParams.get('offset') || '0', 10);
      const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);
      const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);
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
          GROUP BY u.id, u.email, u.full_name, u.created_at, u.last_active_at
          ORDER BY u.created_at DESC
          LIMIT $1 OFFSET $2`,
        [limit, offset]
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
        pagination: { limit, offset, count: rows.length },
      });
    } catch (err: any) {
      console.error('[admin/users] error:', err.message);
      return res.status(500).json({ error: 'Failed to list users' });
    }
  }

  // ── POST /api/crm/upgrade ──────────────────────────────────────────────────
  // Called by the client after a successful plan upgrade to sync a Deal to Zoho CRM.
  // Requires the caller to actually hold an active paid entitlement — without
  // this gate any authenticated user could stamp Closed Won deals into CRM.
  if (path === '/api/crm/upgrade' && req.method === 'POST') {
    const user = await getCloudUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { plan, amount } = req.body || {};
    if (!plan) return res.status(400).json({ error: 'plan required' });
    const { rows: entRows } = await db.query(
      `SELECT plan, status, current_period_ends_at FROM entitlements WHERE user_id = $1 LIMIT 1`,
      [user.userId]
    );
    const ent = entRows[0];
    const isPaid = ent && ent.plan && ent.plan !== 'free';
    const isActive = ent && ent.status === 'active';
    const notExpired = !ent?.current_period_ends_at
      || ent.plan === 'lifetime'
      || new Date(ent.current_period_ends_at).getTime() > Date.now();
    if (!isPaid || !isActive || !notExpired) {
      return res.status(403).json({ error: 'Active paid entitlement required' });
    }
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

      const upgradeEvents = ['subscription_created', 'subscription_activated', 'subscription_reactivated', 'payment_success', 'invoice_payment_success'];
      const downgradeEvents = ['subscription_cancelled', 'subscription_expired', 'subscription_paused', 'payment_failed', 'invoice_payment_failed'];
      const isUpgrade = upgradeEvents.includes(eventType);
      const isDowngrade = downgradeEvents.includes(eventType);
      if (!isUpgrade && !isDowngrade) {
        return res.json({ received: true, skipped: true, eventType });
      }

      // Look up local user
      const { rows } = await db.query(
        `SELECT u.id FROM crm_users u WHERE u.email = $1 LIMIT 1`, [email]
      );
      if (!rows[0]) {
        console.warn(`[zoho-billing webhook] No user found for email: ${email}`);
        return res.json({ received: true, warning: 'user not found' });
      }
      const userId = rows[0].id;

      if (isDowngrade) {
        // Cancel / expire / payment-failed → revoke entitlement to free.
        // Lifetime plans are excluded from auto-downgrade (one-time purchase).
        await db.query(
          `UPDATE entitlements
           SET plan = CASE WHEN plan = 'lifetime' THEN plan ELSE 'free' END,
               status = $1,
               will_renew = false,
               updated_at = NOW()
           WHERE user_id = $2`,
          [eventType === 'subscription_cancelled' ? 'cancelled' : 'expired', userId]
        );
        return res.json({ received: true, email, eventType, action: 'downgraded' });
      }

      // Upgrade flow — store entitlement
      await db.query(
        `INSERT INTO entitlements (user_id, plan, status, trial_active, will_renew, admin_override, updated_at)
         VALUES ($1, $2, 'active', false, true, false, NOW())
         ON CONFLICT (user_id) DO UPDATE SET plan = $2, status = 'active', trial_active = false, will_renew = true, updated_at = NOW()`,
        [userId, plan]
      );

      // Fire upgrade email + CRM deal (fire-and-forget)
      sendEmail({ to: email, ...planUpgradeEmail(plan) }).catch(() => {});
      createOrUpdateCrmDeal({ contactId: null, email, plan }).catch(() => {});
      return res.json({ received: true, email, plan, eventType });
    } catch (err: any) {
      console.error('[zoho-billing webhook] error:', err.message);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // ── POST /api/razorpay-webhook ──────────────────────────────────────────────
  // Handles Razorpay subscription lifecycle: payment.captured (confirm),
  // subscription.cancelled / subscription.halted (downgrade), refund.created
  // (revoke). Signature: HMAC-SHA256(raw_body, RAZORPAY_WEBHOOK_SECRET) in
  // hex, sent in X-Razorpay-Signature.
  //
  // Vercel parses JSON bodies before this handler runs, so we re-stringify
  // for HMAC verification. Razorpay sends compact (no-whitespace) JSON; the
  // re-stringified output matches what they signed for typical payloads.
  if (path === '/api/razorpay-webhook' && req.method === 'POST') {
    const expectedSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('[razorpay webhook] RAZORPAY_WEBHOOK_SECRET not set — rejecting');
      return res.status(500).json({ error: 'Server misconfigured' });
    }
    const sig = req.headers['x-razorpay-signature'];
    if (typeof sig !== 'string') {
      return res.status(401).json({ error: 'Missing signature' });
    }
    let rawBody = '';
    try { rawBody = JSON.stringify(req.body); } catch { return res.status(400).json({ error: 'Invalid body' }); }
    const expected = createHmac('sha256', expectedSecret).update(rawBody).digest('hex');
    let sigOk = false;
    try {
      const a = Buffer.from(sig, 'hex');
      const b = Buffer.from(expected, 'hex');
      sigOk = a.length === b.length && timingSafeEqual(a, b);
    } catch { sigOk = false; }
    if (!sigOk) {
      console.warn('[razorpay webhook] signature mismatch');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    try {
      const payload = req.body || {};
      const event: string = payload.event || '';
      const entity = payload.payload?.payment?.entity || payload.payload?.subscription?.entity || payload.payload?.refund?.entity || {};
      const email: string = (entity.email || entity.notes?.email || '').toLowerCase().trim();

      if (event === 'payment.captured') {
        // Confirm payment — already handled inline by /api/payments/verify, but
        // a webhook fires for safety. No-op if already consumed.
        return res.json({ received: true, event });
      }

      if (event === 'subscription.cancelled' || event === 'subscription.halted' || event === 'refund.created') {
        if (!email) return res.json({ received: true, event, warning: 'no email' });
        const { rows } = await db.query(`SELECT id FROM crm_users WHERE email = $1 LIMIT 1`, [email]);
        if (!rows[0]) return res.json({ received: true, event, warning: 'user not found' });
        await db.query(
          `UPDATE entitlements
           SET plan = CASE WHEN plan = 'lifetime' THEN plan ELSE 'free' END,
               status = $1,
               will_renew = false,
               updated_at = NOW()
           WHERE user_id = $2`,
          [event === 'subscription.cancelled' ? 'cancelled' : 'expired', rows[0].id]
        );
        return res.json({ received: true, event, action: 'downgraded' });
      }

      return res.json({ received: true, event, skipped: true });
    } catch (err: any) {
      console.error('[razorpay webhook] error:', err.message);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // ── POST /api/admin/migrate-to-crm ──────────────────────────────────────────
  // One-shot migration: push all crm_users to Zoho CRM. Protected by x-admin-key.
  if (path === '/api/admin/migrate-to-crm' && req.method === 'POST') {
    const adminKey = (req.headers['x-admin-key'] as string) || req.body?.adminKey;
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) {
      return res.status(500).json({ error: 'ADMIN_API_KEY not configured' });
    }
    if (!adminKey || !safeEq(adminKey, expectedAdminKey)) {
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
          console.error('[migrate-to-crm] item failed:', u.email, e.message);
          results.push({ email: u.email, action: 'error' });
          failed++;
        }
      }
      return res.json({ success: true, total: users.length, succeeded, failed, results });
    } catch (err: any) {
      console.error('[migrate-to-crm] error:', err.message);
      return res.status(500).json({ error: 'Migration failed' });
    }
  }

  // ── POST /api/subscription/cancel ───────────────────────────────────────────
  // SEC-22: user-initiated cancel. Previously the Profile UI just flipped local
  // state, so the user thought they cancelled but Razorpay kept charging. Now
  // persists status='cancelled' + will_renew=false in entitlements; the Razorpay
  // subscription itself winds down on the next billing event (or the user can
  // refund via support). This is a soft cancel — access remains until
  // current_period_end, matching the toast text the UI shows.
  if (path === '/api/subscription/cancel' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { rowCount } = await db.query(
        `UPDATE entitlements
            SET status = 'cancelled', will_renew = false, updated_at = NOW()
          WHERE user_id = $1 AND plan <> 'free' AND plan <> 'lifetime'`,
        [cloudUser.userId]
      );
      if (rowCount === 0) {
        return res.status(400).json({ error: 'No active subscription to cancel' });
      }
      // Audit (best-effort).
      await db.query(
        `INSERT INTO plan_audit_log (customer_email, old_plan, new_plan, changed_by, reason)
         SELECT $1, plan::text, plan::text, 'user', 'user_cancel' FROM entitlements WHERE user_id = $2`,
        [cloudUser.email, cloudUser.userId]
      ).catch(() => {});
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[subscription/cancel]', err.message);
      return res.status(500).json({ error: 'Cancel failed' });
    }
  }

  // ── POST /api/payments/create-order ─────────────────────────────────────────
  if (path === '/api/payments/create-order' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
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
      return res.status(500).json({ error: 'Failed to create order' });
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
    // trusting body-supplied plan/email allowed plan tampering. Wrap the
    // lookup in try/catch so a missing payment_orders table or transient DB
    // error returns a clean 500 instead of FUNCTION_INVOCATION_FAILED.
    let orderRow: { user_id: string; email: string; plan: string; amount: number | null; consumed_payment_id: string | null } | undefined;
    try {
      const { rows: orderRows } = await db.query(
        `SELECT user_id, email, plan, amount, consumed_payment_id FROM payment_orders WHERE order_id = $1 LIMIT 1`,
        [razorpay_order_id]
      );
      orderRow = orderRows[0];
    } catch (err: any) {
      console.error('[Razorpay] order lookup failed:', err.message);
      return res.status(500).json({ error: 'Verification failed' });
    }
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

      return res.json({ success: true, plan: tierCfg.tier });
    } catch (err: any) {
      console.error('[Razorpay] verify error:', err.message);
      return res.status(500).json({ error: 'Verification failed' });
    }
  }

  // ── POST /api/share/migrate ───────────────────────────────────────────────────
  // Admin-only (ADMIN_API_KEY). DDL endpoints must not be reachable by anonymous callers.
  if (path === '/api/share/migrate' && req.method === 'POST') {
    const adminKey = req.headers['x-admin-key'] as string;
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) return res.status(500).json({ error: 'ADMIN_API_KEY not configured' });
    if (!adminKey || !safeEq(adminKey, expectedAdminKey)) return res.status(401).json({ error: 'Unauthorized' });
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
      console.error('[share/migrate] error:', err.message);
      return res.status(500).json({ error: 'Migration failed' });
    }
  }

  // ── POST /api/share/create ────────────────────────────────────────────────────
  if (path === '/api/share/create' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
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
      console.error('[share/create] error:', err.message);
      return res.status(500).json({ error: 'Failed to create share link' });
    }
  }

  // ── GET /api/share/:token ─────────────────────────────────────────────────────
  if (path.startsWith('/api/share/') && req.method === 'GET') {
    const token = path.slice('/api/share/'.length);
    if (!token || token.includes('/')) return res.status(400).json({ error: 'Invalid token' });
    try {
      // Atomic claim of the share to prevent TOCTOU between concurrent reads.
      // Only one caller wins the UPDATE; everyone else gets 0 rows back.
      const { rows: claimed } = await db.query(
        `UPDATE shared_links
            SET viewed = true, viewed_at = NOW()
          WHERE token = $1
            AND viewed = false
            AND expires_at > NOW()
        RETURNING encrypted_data`,
        [token]
      );
      if (claimed.length > 0) {
        return res.json({ data: JSON.parse(claimed[0].encrypted_data) });
      }
      // Lookup why the claim failed for a more useful error.
      const { rows: existing } = await db.query(
        'SELECT viewed, expires_at FROM shared_links WHERE token = $1',
        [token]
      );
      if (existing.length === 0) return res.status(404).json({ error: 'Link not found' });
      const e = existing[0];
      if (new Date(e.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Link expired' });
      }
      return res.status(410).json({ error: 'Link already used — one-time links expire after first view' });
    } catch (err: any) {
      console.error('[share GET]', err.message);
      return res.status(500).json({ error: 'Failed' });
    }
  }

  // ── Phase 3: Webhooks (Zapier / Make / n8n integration) ─────────────────────
  // User-registered webhooks fired on vault events. Stored per-user; URL is
  // hit fire-and-forget with 5s timeout (no retries) — external systems are
  // expected to be idempotent. Payloads are intentionally NON-sensitive: only
  // event metadata (e.g. password title, not the password itself).
  const ensureWebhooksTable = (() => {
    let ready = false;
    return async () => {
      if (ready) return;
      await db.query(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          url TEXT NOT NULL,
          events TEXT[] NOT NULL DEFAULT '{}',
          active BOOLEAN NOT NULL DEFAULT true,
          last_fired_at TIMESTAMPTZ,
          last_status INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);
      `);
      ready = true;
    };
  })();

  const VALID_WEBHOOK_EVENTS = new Set([
    'password_added', 'password_updated', 'password_deleted',
    'subscription_renewal_upcoming',
    'security_score_changed',
    'vault_synced',
    'expense_added',
  ]);

  // SEC-20: SSRF guard. Reject URLs targeting loopback / RFC-1918 / link-local
  // / .local mDNS so an attacker can't pivot through our serverless function
  // to internal Vercel-environment metadata, K8s control planes, etc. Returns
  // a string error message, or null if the URL is safe.
  function validateWebhookUrl(rawUrl: string): string | null {
    let parsed: URL;
    try { parsed = new URL(rawUrl); }
    catch { return 'invalid url'; }
    if (!/^https?:$/.test(parsed.protocol)) return 'url must be http(s)';
    const host = parsed.hostname.toLowerCase();
    if (!host) return 'invalid host';
    // Block hostname-form internal targets.
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
      return 'private/internal hosts are not allowed';
    }
    // IPv6 literals in URL appear bracketed; URL strips brackets in hostname.
    if (host.includes(':')) {
      // ::1 loopback or fe80::/10 link-local
      if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
        return 'private/internal hosts are not allowed';
      }
    }
    // IPv4 literal check.
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
      const o = m.slice(1).map(Number);
      if (o.some((n) => n < 0 || n > 255)) return 'invalid ipv4';
      // 127.0.0.0/8, 10.0.0.0/8, 169.254.0.0/16, 192.168.0.0/16,
      // 172.16.0.0/12, 0.0.0.0/8, multicast/reserved.
      if (
        o[0] === 0 || o[0] === 127 || o[0] === 10 ||
        (o[0] === 169 && o[1] === 254) ||
        (o[0] === 192 && o[1] === 168) ||
        (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
        o[0] >= 224
      ) {
        return 'private/internal hosts are not allowed';
      }
    }
    return null;
  }

  if (path === '/api/webhooks' && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      await ensureWebhooksTable();
      const { rows } = await db.query(
        `SELECT id, url, events, active, last_fired_at, last_status, created_at
           FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC`,
        [cloudUser.userId]
      );
      return res.json({ success: true, webhooks: rows });
    } catch (err: any) {
      console.error('[webhooks GET]', err.message);
      return res.status(500).json({ error: 'Failed to list webhooks' });
    }
  }

  if (path === '/api/webhooks/register' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { url, events } = req.body as { url?: string; events?: string[] };
      if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });
      const urlErr = validateWebhookUrl(url);
      if (urlErr) return res.status(400).json({ error: urlErr });
      const evs = Array.isArray(events) ? events.filter((e) => VALID_WEBHOOK_EVENTS.has(e)) : [];
      if (evs.length === 0) return res.status(400).json({ error: 'at least one valid event required' });
      await ensureWebhooksTable();
      const { rows: countRows } = await db.query(
        `SELECT COUNT(*)::int AS c FROM webhooks WHERE user_id = $1`,
        [cloudUser.userId]
      );
      if ((countRows[0]?.c ?? 0) >= 20) return res.status(400).json({ error: 'webhook limit (20) reached' });
      const { rows } = await db.query(
        `INSERT INTO webhooks (user_id, url, events) VALUES ($1, $2, $3)
         RETURNING id, url, events, active, created_at`,
        [cloudUser.userId, url, evs]
      );
      return res.json({ success: true, webhook: rows[0] });
    } catch (err: any) {
      console.error('[webhooks/register]', err.message);
      return res.status(500).json({ error: 'Failed to register webhook' });
    }
  }

  if (/^\/api\/webhooks\/[a-f0-9-]{36}$/.test(path) && req.method === 'DELETE') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const id = path.split('/')[3];
    try {
      await ensureWebhooksTable();
      const { rowCount } = await db.query(
        `DELETE FROM webhooks WHERE id = $1 AND user_id = $2`,
        [id, cloudUser.userId]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'not found' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[webhooks DELETE]', err.message);
      return res.status(500).json({ error: 'Failed to delete webhook' });
    }
  }

  if (/^\/api\/webhooks\/[a-f0-9-]{36}\/toggle$/.test(path) && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const id = path.split('/')[3];
    try {
      await ensureWebhooksTable();
      const { active } = req.body as { active?: boolean };
      if (typeof active !== 'boolean') return res.status(400).json({ error: 'active boolean required' });
      const { rowCount } = await db.query(
        `UPDATE webhooks SET active = $1 WHERE id = $2 AND user_id = $3`,
        [active, id, cloudUser.userId]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'not found' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[webhooks/toggle]', err.message);
      return res.status(500).json({ error: 'Failed to toggle webhook' });
    }
  }

  if (/^\/api\/webhooks\/test\/[a-f0-9-]{36}$/.test(path) && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const id = path.split('/')[4];
    try {
      await ensureWebhooksTable();
      const { rows } = await db.query(
        `SELECT id, url, events FROM webhooks WHERE id = $1 AND user_id = $2`,
        [id, cloudUser.userId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'not found' });
      const hook = rows[0];
      // SEC-20: re-validate URL at test time — a row could pre-date the
      // validator, or have been side-loaded. Don't blindly trust the DB.
      const urlErr = validateWebhookUrl(hook.url);
      if (urlErr) return res.status(400).json({ error: urlErr });
      const samplePayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        source: 'IronVault',
        userId: cloudUser.userId,
        data: { message: 'This is a test payload from IronVault.', sampleField: 'sampleValue' },
      };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      let status = 0;
      try {
        const r = await fetch(hook.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': 'IronVault-Webhook/1.0' },
          body: JSON.stringify(samplePayload),
          signal: ctrl.signal,
        });
        status = r.status;
        // SEC-20: drain body without echoing — leaking internal-host
        // responses to the caller is the SSRF amplification we're avoiding.
        await r.text().catch(() => '');
      } catch (e: any) {
        clearTimeout(timer);
        await db.query(
          `UPDATE webhooks SET last_fired_at = NOW(), last_status = 0 WHERE id = $1`,
          [hook.id]
        );
        return res.status(200).json({ success: false, status: 0, error: 'fetch failed' });
      }
      clearTimeout(timer);
      await db.query(
        `UPDATE webhooks SET last_fired_at = NOW(), last_status = $1 WHERE id = $2`,
        [status, hook.id]
      );
      return res.json({ success: status >= 200 && status < 300, status });
    } catch (err: any) {
      console.error('[webhooks/test]', err.message);
      return res.status(500).json({ error: 'Failed to test webhook' });
    }
  }

  // Internal dispatcher endpoint — called from the client when an event happens.
  // The client knows the event name and a small payload; the server fans out to
  // any matching active webhooks for that user. Fire-and-forget, never blocks
  // the originating user action.
  if (path === '/api/webhooks/dispatch' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { event, data } = req.body as { event?: string; data?: any };
      if (!event || !VALID_WEBHOOK_EVENTS.has(event)) return res.status(400).json({ error: 'invalid event' });
      await ensureWebhooksTable();
      const { rows } = await db.query(
        `SELECT id, url FROM webhooks WHERE user_id = $1 AND active = true AND $2 = ANY(events)`,
        [cloudUser.userId, event]
      );
      const payload = JSON.stringify({
        event, timestamp: new Date().toISOString(),
        source: 'IronVault', userId: cloudUser.userId, data: data || {},
      });
      // Fire all in parallel — never await response, never throw.
      // SEC-20: skip rows whose URL now fails validation (legacy/private targets).
      for (const h of rows) {
        if (validateWebhookUrl(h.url)) continue;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        fetch(h.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': 'IronVault-Webhook/1.0' },
          body: payload,
          signal: ctrl.signal,
        })
          .then((r) => {
            clearTimeout(t);
            return db.query(`UPDATE webhooks SET last_fired_at = NOW(), last_status = $1 WHERE id = $2`, [r.status, h.id])
              .catch(() => {});
          })
          .catch(() => {
            clearTimeout(t);
            return db.query(`UPDATE webhooks SET last_fired_at = NOW(), last_status = 0 WHERE id = $1`, [h.id])
              .catch(() => {});
          });
      }
      return res.json({ success: true, dispatched: rows.length });
    } catch (err: any) {
      console.error('[webhooks/dispatch]', err.message);
      return res.status(500).json({ error: 'Dispatch failed' });
    }
  }

  // ── Phase 3: Emergency Access (Digital Will) ────────────────────────────────
  // Owner designates trusted contacts who can request read-only vault access
  // after a configured inactivity period. When a request fires, the owner is
  // emailed with a 24h deny window before access is granted. The vault itself
  // is NEVER unlocked server-side — instead, when access is granted, the
  // owner's last cloud-vault blob (encrypted) is delivered to the contact, who
  // must still know the master password OR the owner can store a separate
  // emergency-encrypted blob in a future iteration. For v1 we deliver the
  // encrypted blob; the contact uses an out-of-band master password
  // (envelope/sealed note) to unlock.
  const ensureEmergencyTables = (() => {
    let ready = false;
    return async () => {
      if (ready) return;
      await db.query(`
        CREATE TABLE IF NOT EXISTS emergency_contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_user_id TEXT NOT NULL,
          owner_email TEXT NOT NULL,
          contact_email TEXT NOT NULL,
          contact_name TEXT,
          waiting_period_hours INTEGER NOT NULL DEFAULT 168,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(owner_user_id, contact_email)
        );
        CREATE INDEX IF NOT EXISTS idx_emerg_owner ON emergency_contacts(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_emerg_contact ON emergency_contacts(contact_email);

        CREATE TABLE IF NOT EXISTS emergency_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contact_id UUID NOT NULL REFERENCES emergency_contacts(id) ON DELETE CASCADE,
          owner_user_id TEXT NOT NULL,
          contact_email TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          unlocks_at TIMESTAMPTZ NOT NULL,
          denied_at TIMESTAMPTZ,
          access_token TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_emerg_req_owner ON emergency_requests(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_emerg_req_token ON emergency_requests(access_token);

        CREATE TABLE IF NOT EXISTS user_activity_pings (
          user_id TEXT PRIMARY KEY,
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      ready = true;
    };
  })();

  if (path === '/api/emergency/contacts' && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      await ensureEmergencyTables();
      const { rows } = await db.query(
        `SELECT id, contact_email, contact_name, waiting_period_hours, status, created_at
           FROM emergency_contacts WHERE owner_user_id = $1 ORDER BY created_at DESC`,
        [cloudUser.userId]
      );
      return res.json({ success: true, contacts: rows });
    } catch (err: any) {
      console.error('[emergency/contacts GET]', err.message);
      return res.status(500).json({ error: 'Failed to list contacts' });
    }
  }

  if (path === '/api/emergency/add-contact' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { email, name, waitingPeriodHours } = req.body as {
        email?: string; name?: string; waitingPeriodHours?: number;
      };
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'valid email required' });
      const allowed = new Set([24, 168, 720]);
      const wph = allowed.has(Number(waitingPeriodHours)) ? Number(waitingPeriodHours) : 168;
      await ensureEmergencyTables();
      const ownerEmail = (cloudUser as any).email || '';
      if (email.toLowerCase() === String(ownerEmail).toLowerCase()) {
        return res.status(400).json({ error: 'cannot add yourself as a contact' });
      }
      const { rows } = await db.query(
        `INSERT INTO emergency_contacts (owner_user_id, owner_email, contact_email, contact_name, waiting_period_hours)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (owner_user_id, contact_email) DO UPDATE SET
           contact_name = EXCLUDED.contact_name,
           waiting_period_hours = EXCLUDED.waiting_period_hours,
           status = 'active'
         RETURNING id, contact_email, contact_name, waiting_period_hours, status, created_at`,
        [cloudUser.userId, ownerEmail, email.toLowerCase(), name || null, wph]
      );
      // Notify the contact they've been designated
      const safeOwner = _eHtml(ownerEmail);
      const safeName = _eHtml(name || email);
      sendEmail({
        to: email,
        subject: `${safeOwner} has designated you as an emergency contact on IronVault`,
        html: _emailLayout(
          `${_eh1('Emergency contact designation')}` +
          `${_ep(`${safeOwner} has designated you as an emergency access contact for their IronVault account. If they become inactive for ${wph} hours, you may request read-only access to their encrypted vault.`)}` +
          `${_ecard(`<p style="margin:0;font-size:14px;color:#374151">No action is needed right now. You'll receive instructions if access is ever requested.</p>`)}`
        ),
      }).catch(() => {});
      return res.json({ success: true, contact: rows[0] });
    } catch (err: any) {
      console.error('[emergency/add-contact]', err.message);
      return res.status(500).json({ error: 'Failed to add contact' });
    }
  }

  if (/^\/api\/emergency\/contacts\/[a-f0-9-]{36}$/.test(path) && req.method === 'DELETE') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    const id = path.split('/')[4];
    try {
      await ensureEmergencyTables();
      const { rowCount } = await db.query(
        `DELETE FROM emergency_contacts WHERE id = $1 AND owner_user_id = $2`,
        [id, cloudUser.userId]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'not found' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[emergency/contacts DELETE]', err.message);
      return res.status(500).json({ error: 'Failed to delete contact' });
    }
  }

  // Authenticated owner pings activity — used by the inactivity check.
  if (path === '/api/emergency/ping' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      await ensureEmergencyTables();
      await db.query(
        `INSERT INTO user_activity_pings (user_id, last_seen_at) VALUES ($1, NOW())
         ON CONFLICT (user_id) DO UPDATE SET last_seen_at = NOW()`,
        [cloudUser.userId]
      );
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[emergency/ping]', err.message);
      return res.status(500).json({ error: 'ping failed' });
    }
  }

  // Owner-side: list pending and granted requests against THEIR account.
  if (path === '/api/emergency/requests' && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      await ensureEmergencyTables();
      const { rows } = await db.query(
        `SELECT r.id, r.status, r.requested_at, r.unlocks_at, r.denied_at, r.contact_email,
                c.contact_name
           FROM emergency_requests r
           LEFT JOIN emergency_contacts c ON c.id = r.contact_id
          WHERE r.owner_user_id = $1
          ORDER BY r.requested_at DESC LIMIT 50`,
        [cloudUser.userId]
      );
      return res.json({ success: true, requests: rows });
    } catch (err: any) {
      console.error('[emergency/requests GET]', err.message);
      return res.status(500).json({ error: 'Failed to list requests' });
    }
  }

  // Contact-side: initiate a request. Identified by being authenticated AND
  // matching the contact_email on a registered emergency_contacts row.
  if (path === '/api/emergency/request-access' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { ownerEmail } = req.body as { ownerEmail?: string };
      if (!ownerEmail) return res.status(400).json({ error: 'ownerEmail required' });
      const requesterEmail = String((cloudUser as any).email || '').toLowerCase();
      if (!requesterEmail) return res.status(400).json({ error: 'requester email unavailable' });
      await ensureEmergencyTables();
      const { rows: cRows } = await db.query(
        `SELECT id, owner_user_id, waiting_period_hours
           FROM emergency_contacts
          WHERE owner_email = $1 AND contact_email = $2 AND status = 'active'`,
        [ownerEmail.toLowerCase(), requesterEmail]
      );
      if (cRows.length === 0) return res.status(403).json({ error: 'You are not an active emergency contact for this account' });
      const c = cRows[0];
      const { rows: existing } = await db.query(
        `SELECT id FROM emergency_requests WHERE contact_id = $1 AND status = 'pending'`,
        [c.id]
      );
      if (existing.length > 0) return res.status(400).json({ error: 'A pending request already exists' });
      const unlocksAt = new Date(Date.now() + (c.waiting_period_hours as number) * 60 * 60 * 1000);
      const accessToken = randomUUID();
      await db.query(
        `INSERT INTO emergency_requests (contact_id, owner_user_id, contact_email, unlocks_at, access_token)
         VALUES ($1, $2, $3, $4, $5)`,
        [c.id, c.owner_user_id, requesterEmail, unlocksAt, accessToken]
      );
      // Email owner a deny link
      const denyLink = `${_APP_URL}/emergency-access?action=deny&token=${encodeURIComponent(accessToken)}`;
      const safeRequester = _eHtml(requesterEmail);
      const safeUnlocks = _eHtml(unlocksAt.toUTCString());
      sendEmail({
        to: ownerEmail,
        subject: 'Emergency access requested on your IronVault account',
        html: _emailLayout(
          `${_eh1('Emergency access requested')}` +
          `${_ep(`${safeRequester} has requested emergency access to your vault. Access will be granted automatically on <strong>${safeUnlocks}</strong> unless you deny the request.`)}` +
          `${_ebtn(denyLink, 'Deny this request')}` +
          `${_ecard(`<p style="margin:0;font-size:13px;color:#6b7280">If you didn't expect this, deny immediately and consider rotating your master password.</p>`)}`
        ),
      }).catch(() => {});
      return res.json({ success: true, unlocksAt: unlocksAt.toISOString() });
    } catch (err: any) {
      console.error('[emergency/request-access]', err.message);
      return res.status(500).json({ error: 'Request failed' });
    }
  }

  // Owner deny — accepts token via query OR body
  if (path === '/api/emergency/deny' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { token } = req.body as { token?: string };
      if (!token) return res.status(400).json({ error: 'token required' });
      await ensureEmergencyTables();
      const { rowCount } = await db.query(
        `UPDATE emergency_requests
            SET status = 'denied', denied_at = NOW()
          WHERE access_token = $1 AND owner_user_id = $2 AND status = 'pending'`,
        [token, cloudUser.userId]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'request not found or already resolved' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[emergency/deny]', err.message);
      return res.status(500).json({ error: 'Deny failed' });
    }
  }

  // Contact pulls vault blob after unlock window passes and not denied.
  if (path === '/api/emergency/access-vault' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    try {
      const { token } = req.body as { token?: string };
      if (!token) return res.status(400).json({ error: 'token required' });
      const requesterEmail = String((cloudUser as any).email || '').toLowerCase();
      await ensureEmergencyTables();
      const { rows } = await db.query(
        `SELECT id, owner_user_id, contact_email, status, unlocks_at, denied_at
           FROM emergency_requests WHERE access_token = $1`,
        [token]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'request not found' });
      const r = rows[0];
      if (r.contact_email.toLowerCase() !== requesterEmail) return res.status(403).json({ error: 'Not your request' });
      if (r.status === 'denied') return res.status(403).json({ error: 'Request was denied by owner' });
      if (new Date(r.unlocks_at) > new Date()) return res.status(425).json({ error: 'Unlock window not yet reached', unlocksAt: r.unlocks_at });
      // Mark granted
      if (r.status !== 'granted') {
        await db.query(`UPDATE emergency_requests SET status = 'granted' WHERE id = $1`, [r.id]);
      }
      // Pull owner's latest cloud vault blob (encrypted — contact still needs master password out-of-band)
      const { rows: vRows } = await db.query(
        `SELECT vault_id, encrypted_data, updated_at FROM cloud_vaults
          WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [r.owner_user_id]
      );
      if (vRows.length === 0) return res.status(404).json({ error: 'No vault data available' });
      return res.json({ success: true, vault: vRows[0] });
    } catch (err: any) {
      console.error('[emergency/access-vault]', err.message);
      return res.status(500).json({ error: 'Access failed' });
    }
  }

  // ── GET /api/auth/sessions ─────────────────────────────────────────────────
  // Lists all active sessions (extension + web) for the authenticated user.
  // Used by the Active Sessions UI in Profile → Security and by the extension
  // settings list.
  if (path === '/api/auth/sessions' && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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
    const cloudUser = await getCloudUser(req);
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

  // ── Teams (business plan) ──────────────────────────────────────────────────
  // Team-management endpoints. Schema is provisioned lazily on first call so
  // older deploys without migrations don't 500. Roles: owner, admin, member,
  // viewer. Owner is the user who created the team and is implicitly an admin.
  async function ensureTeamsTables(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS teams (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          owner_user_id UUID NOT NULL,
          plan TEXT NOT NULL DEFAULT 'team',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS team_members (
          team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          user_id UUID,
          email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          status TEXT NOT NULL DEFAULT 'active',
          invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          accepted_at TIMESTAMPTZ,
          PRIMARY KEY (team_id, email)
        );
        CREATE TABLE IF NOT EXISTS team_shared_vaults (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_by UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
        CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
      `);
    } catch (e: any) {
      console.error('[teams] table provisioning failed:', e.message);
    }
  }

  async function isTeamMember(teamId: string, userId: string, email: string): Promise<{ role: string } | null> {
    const { rows } = await db.query(
      `SELECT role FROM team_members
       WHERE team_id = $1 AND (user_id = $2 OR LOWER(email) = LOWER($3))
         AND status = 'active' LIMIT 1`,
      [teamId, userId, email]
    );
    return rows[0] ? { role: rows[0].role } : null;
  }

  // POST /api/teams/create — { name }
  if (path === '/api/teams/create' && req.method === 'POST') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensureTeamsTables();
    try {
      const name = String((req.body?.name ?? '')).trim();
      if (!name) return res.status(400).json({ error: 'name required' });
      const { rows } = await db.query(
        `INSERT INTO teams (name, owner_user_id) VALUES ($1, $2) RETURNING id, name, plan, created_at`,
        [name, cloudUser.userId]
      );
      const team = rows[0];
      // Owner is auto-added as an active admin so subsequent member-list/invite
      // calls treat them as part of the team without an extra accept step.
      await db.query(
        `INSERT INTO team_members (team_id, user_id, email, role, status, accepted_at)
         VALUES ($1, $2, $3, 'admin', 'active', NOW())
         ON CONFLICT (team_id, email) DO NOTHING`,
        [team.id, cloudUser.userId, cloudUser.email]
      );
      return res.json({ success: true, team });
    } catch (err: any) {
      console.error('[teams/create]', err.message);
      return res.status(500).json({ error: 'Failed to create team' });
    }
  }

  // GET /api/teams — list teams the user belongs to
  if (path === '/api/teams' && req.method === 'GET') {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensureTeamsTables();
    try {
      const { rows } = await db.query(
        `SELECT t.id, t.name, t.plan, t.owner_user_id, t.created_at, m.role
         FROM teams t
         JOIN team_members m ON m.team_id = t.id
         WHERE (m.user_id = $1 OR LOWER(m.email) = LOWER($2)) AND m.status = 'active'
         ORDER BY t.created_at DESC`,
        [cloudUser.userId, cloudUser.email]
      );
      return res.json({ success: true, teams: rows });
    } catch (err: any) {
      console.error('[teams list]', err.message);
      return res.status(500).json({ error: 'Failed to list teams' });
    }
  }

  // /api/teams/:id/* — sub-routes
  const teamsMatch = path.match(/^\/api\/teams\/([^/]+)\/(invite|remove|members|shared-vault)$/);
  if (teamsMatch) {
    const cloudUser = await getCloudUser(req);
    if (!cloudUser) return res.status(401).json({ error: 'Auth required' });
    await ensureTeamsTables();
    const teamId = teamsMatch[1];
    const action = teamsMatch[2];

    const membership = await isTeamMember(teamId, cloudUser.userId, cloudUser.email);
    if (!membership) return res.status(403).json({ error: 'Not a member of this team' });

    if (action === 'members' && req.method === 'GET') {
      try {
        const { rows } = await db.query(
          `SELECT email, role, status, invited_at, accepted_at, user_id
           FROM team_members WHERE team_id = $1 ORDER BY invited_at ASC`,
          [teamId]
        );
        return res.json({ success: true, members: rows });
      } catch (err: any) {
        console.error('[teams/members]', err.message);
        return res.status(500).json({ error: 'Failed to list members' });
      }
    }

    if (action === 'invite' && req.method === 'POST') {
      if (!['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: 'Admin role required' });
      }
      try {
        const inviteEmail = String((req.body?.email ?? '')).trim().toLowerCase();
        const role = String((req.body?.role ?? 'member')).toLowerCase();
        if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
          return res.status(400).json({ error: 'valid email required' });
        }
        if (!['admin', 'member', 'viewer'].includes(role)) {
          return res.status(400).json({ error: 'invalid role' });
        }
        // Look up an existing user_id for the invitee so /api/teams works for
        // them on first read without re-keying by email.
        const userLookup = await db.query(
          `SELECT id FROM crm_users WHERE LOWER(email) = $1 LIMIT 1`,
          [inviteEmail]
        );
        const inviteeUserId = userLookup.rows[0]?.id ?? null;
        await db.query(
          `INSERT INTO team_members (team_id, user_id, email, role, status)
           VALUES ($1, $2, $3, $4, 'pending')
           ON CONFLICT (team_id, email)
           DO UPDATE SET role = EXCLUDED.role, status = 'pending'`,
          [teamId, inviteeUserId, inviteEmail, role]
        );
        // Best-effort invite email — don't fail the response if SMTP is down.
        const teamRow = await db.query(`SELECT name FROM teams WHERE id = $1`, [teamId]);
        const teamName = teamRow.rows[0]?.name ?? 'IronVault Team';
        const subject = `${cloudUser.email} invited you to ${teamName} on IronVault`;
        const safeName = _eHtml(teamName);
        const safeOwner = _eHtml(cloudUser.email);
        const link = `${_APP_URL}/teams`;
        const html = _emailLayout(
          `${_eh1(`Join ${safeName}`)}${_ep(`<strong>${safeOwner}</strong> invited you to collaborate on IronVault.`)}${_ebtn(link, 'Open IronVault')}`
        );
        sendEmail({ to: inviteEmail, subject, html }).catch(() => undefined);
        return res.json({ success: true, invited: inviteEmail, role });
      } catch (err: any) {
        console.error('[teams/invite]', err.message);
        return res.status(500).json({ error: 'Failed to invite' });
      }
    }

    if (action === 'remove' && req.method === 'POST') {
      if (!['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: 'Admin role required' });
      }
      try {
        const removeEmail = String((req.body?.email ?? '')).trim().toLowerCase();
        if (!removeEmail) return res.status(400).json({ error: 'email required' });
        // Don't allow removing the team owner via this endpoint — that needs
        // a deliberate transfer-or-delete flow.
        const owner = await db.query(`SELECT owner_user_id FROM teams WHERE id = $1`, [teamId]);
        const ownerId = owner.rows[0]?.owner_user_id;
        const target = await db.query(
          `SELECT user_id FROM team_members WHERE team_id = $1 AND LOWER(email) = $2 LIMIT 1`,
          [teamId, removeEmail]
        );
        if (target.rows[0]?.user_id === ownerId) {
          return res.status(400).json({ error: 'Cannot remove team owner' });
        }
        const { rowCount } = await db.query(
          `DELETE FROM team_members WHERE team_id = $1 AND LOWER(email) = $2`,
          [teamId, removeEmail]
        );
        if (!rowCount) return res.status(404).json({ error: 'Member not found' });
        return res.json({ success: true, removed: removeEmail });
      } catch (err: any) {
        console.error('[teams/remove]', err.message);
        return res.status(500).json({ error: 'Failed to remove' });
      }
    }

    if (action === 'shared-vault' && req.method === 'POST') {
      if (!['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ error: 'Admin role required' });
      }
      try {
        const vaultName = String((req.body?.name ?? '')).trim();
        if (!vaultName) return res.status(400).json({ error: 'name required' });
        const { rows } = await db.query(
          `INSERT INTO team_shared_vaults (team_id, name, created_by)
           VALUES ($1, $2, $3) RETURNING id, name, created_at`,
          [teamId, vaultName, cloudUser.userId]
        );
        return res.json({ success: true, sharedVault: rows[0] });
      } catch (err: any) {
        console.error('[teams/shared-vault]', err.message);
        return res.status(500).json({ error: 'Failed to create shared vault' });
      }
    }

    if (action === 'shared-vault' && req.method === 'GET') {
      try {
        const { rows } = await db.query(
          `SELECT id, name, created_by, created_at FROM team_shared_vaults
           WHERE team_id = $1 ORDER BY created_at DESC`,
          [teamId]
        );
        return res.json({ success: true, sharedVaults: rows });
      } catch (err: any) {
        console.error('[teams/shared-vault list]', err.message);
        return res.status(500).json({ error: 'Failed to list shared vaults' });
      }
    }
  }

  return res.status(404).json({ error: "endpoint not found", path });
}
