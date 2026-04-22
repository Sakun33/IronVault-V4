// SendPulse email service — uses REST API via native fetch (no dependencies)
// Required env vars:
//   SENDPULSE_CLIENT_ID   — numeric API User ID from SendPulse Profile → API
//   SENDPULSE_API_KEY     — API Secret from SendPulse Profile → API
//   EMAIL_FROM_ADDRESS    — sender address (default: noreply@ironvault.app)
//   EMAIL_FROM_NAME       — sender name (default: IronVault)
//   APP_URL               — app base URL (default: https://www.ironvault.app)

const CLIENT_ID = process.env.SENDPULSE_CLIENT_ID;
const API_KEY = process.env.SENDPULSE_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'noreply@ironvault.app';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'IronVault';
const APP_URL = process.env.APP_URL || 'https://www.ironvault.app';

export const emailConfigured = !!(CLIENT_ID && API_KEY);

// In-memory token cache (refreshed per cold start — Vercel functions are short-lived)
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string | null> {
  if (!CLIENT_ID || !API_KEY) return null;
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  try {
    const res = await fetch('https://api.sendpulse.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: API_KEY,
      }),
    });
    if (!res.ok) {
      console.warn('[email] SendPulse OAuth failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json() as { access_token: string; expires_in?: number };
    _cachedToken = data.access_token;
    _tokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    return _cachedToken;
  } catch (err: any) {
    console.error('[email] OAuth error:', err.message);
    return null;
  }
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) {
    console.warn('[email] SendPulse not configured — skipping email to', to);
    return false;
  }
  try {
    const res = await fetch('https://api.sendpulse.com/smtp/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: {
          subject,
          from: { name: FROM_NAME, email: FROM_ADDRESS },
          to: [{ email: to }],
          html,
        },
      }),
    });
    if (!res.ok) {
      console.error('[email] SendPulse send failed:', res.status, await res.text());
      return false;
    }
    console.log('[email] Sent via SendPulse:', subject, '→', to);
    return true;
  } catch (err: any) {
    console.error('[email] Send error:', err.message);
    return false;
  }
}

// ── Email templates ────────────────────────────────────────────────────────────

function layout(icon: string, iconBg: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:480px;margin:0 auto;background:#1a1a24;border-radius:16px;padding:36px;border:1px solid #2a2a3a">
  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:${iconBg}">
      <span style="font-size:26px">${icon}</span>
    </div>
  </div>
  ${content}
  <hr style="border:none;border-top:1px solid #2a2a3a;margin:28px 0 18px">
  <p style="margin:0;text-align:center;font-size:11px;color:#475569">
    © 2026 IronVault &nbsp;·&nbsp;
    <a href="mailto:subsafeironvault@gmail.com" style="color:#6366f1;text-decoration:none">subsafeironvault@gmail.com</a>
  </p>
</div>
</body></html>`;
}

function h1(text: string) { return `<h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#f1f5f9;text-align:center">${text}</h1>`; }
function p(text: string)  { return `<p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#94a3b8;text-align:center">${text}</p>`; }
function btn(url: string, label: string) {
  return `<a href="${url}" style="display:block;text-align:center;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px">${label}</a>`;
}
function card(inner: string) {
  return `<div style="background:rgba(255,255,255,.04);border:1px solid #2a2a3a;border-radius:12px;padding:16px;margin-bottom:22px">${inner}</div>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to IronVault 🛡',
    html: layout('🛡', 'rgba(99,102,241,.15)', `
      ${h1(`Welcome to IronVault, ${name || 'there'}!`)}
      ${p('Your secure vault is ready. All your data is AES-256 encrypted and stored locally on your device.')}
      ${card(`
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Getting started</p>
        <ul style="margin:0;padding-left:18px;color:#e2e8f0;font-size:13px;line-height:2.2">
          <li>Create your first vault and master password</li>
          <li>Add passwords, notes, and reminders</li>
          <li>Track subscriptions and expenses</li>
        </ul>
      `)}
      ${btn(APP_URL, 'Open IronVault')}
    `),
  };
}

export function passwordResetEmail(resetLink: string): { subject: string; html: string } {
  return {
    subject: 'Reset your IronVault password',
    html: layout('🔑', 'rgba(239,68,68,.1)', `
      ${h1('Reset your password')}
      ${p('Click the button below to set a new password. This link expires in <strong style="color:#e2e8f0">1 hour</strong>.')}
      ${btn(resetLink, 'Reset Password')}
      <p style="margin:14px 0 0;text-align:center;font-size:12px;color:#64748b">
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="margin:8px 0 0;text-align:center;font-size:11px;word-break:break-all">
        <a href="${resetLink}" style="color:#6366f1">${resetLink}</a>
      </p>
    `),
  };
}

export function ticketConfirmationEmail(subject: string, ticketId: string | number): { subject: string; html: string } {
  return {
    subject: `[IronVault Support] Ticket received: ${subject}`,
    html: layout('✅', 'rgba(34,197,94,.1)', `
      ${h1('We received your ticket')}
      ${p('Our support team will get back to you within 24 hours.')}
      ${card(`
        <p style="margin:0 0 4px;font-size:11px;color:#64748b">Ticket #${ticketId}</p>
        <p style="margin:0;font-size:14px;font-weight:600;color:#f1f5f9">${subject}</p>
      `)}
      <a href="mailto:subsafeironvault@gmail.com" style="display:block;text-align:center;background:rgba(99,102,241,.12);color:#6366f1;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px;border:1px solid rgba(99,102,241,.25)">Reply via Email</a>
    `),
  };
}

export function ticketReplyEmail(ticketId: string | number, replyPreview: string): { subject: string; html: string } {
  return {
    subject: `[IronVault Support] Update on ticket #${ticketId}`,
    html: layout('💬', 'rgba(99,102,241,.15)', `
      ${h1('New reply on your ticket')}
      ${p(`There's a new response on support ticket <strong style="color:#e2e8f0">#${ticketId}</strong>.`)}
      ${card(`<p style="margin:0;font-size:13px;color:#94a3b8;font-style:italic">"${replyPreview.slice(0, 200)}${replyPreview.length > 200 ? '…' : ''}"</p>`)}
      <a href="mailto:subsafeironvault@gmail.com" style="display:block;text-align:center;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px">Reply</a>
    `),
  };
}

export function ticketClosedEmail(ticketId: string | number): { subject: string; html: string } {
  return {
    subject: `[IronVault Support] Ticket #${ticketId} resolved`,
    html: layout('✔️', 'rgba(34,197,94,.1)', `
      ${h1('Ticket resolved')}
      ${p(`Support ticket <strong style="color:#e2e8f0">#${ticketId}</strong> has been marked as resolved. If you need further assistance, just reply to this email.`)}
      <a href="mailto:subsafeironvault@gmail.com" style="display:block;text-align:center;background:rgba(99,102,241,.12);color:#6366f1;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px;border:1px solid rgba(99,102,241,.25)">Contact Support Again</a>
    `),
  };
}

export function planUpgradeEmail(plan: string): { subject: string; html: string } {
  const label = plan === 'lifetime' ? 'Lifetime' : plan === 'family' ? 'Family' : 'Pro';
  return {
    subject: `You're now on IronVault ${label} ⭐`,
    html: layout('⭐', 'rgba(245,158,11,.1)', `
      ${h1(`Welcome to ${label}!`)}
      ${p(`Your IronVault account has been upgraded to <strong style="color:#e2e8f0">${label}</strong>. All premium features are now unlocked.`)}
      ${btn(APP_URL, 'Open IronVault')}
    `),
  };
}
