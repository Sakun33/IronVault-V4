import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SENDPULSE_SMTP_HOST || 'smtp-pulse.com';
const SMTP_USER = process.env.SENDPULSE_SMTP_USER;
const SMTP_PASS = process.env.SENDPULSE_SMTP_PASSWORD;
const FROM = process.env.EMAIL_FROM || 'IronVault <noreply@ironvault.app>';
const APP_URL = process.env.APP_URL || 'https://www.ironvault.app';

export const smtpConfigured = !!(SMTP_USER && SMTP_PASS);

function createTransport() {
  if (!smtpConfigured) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const transport = createTransport();
  if (!transport) {
    console.warn('[email] SMTP not configured — skipping email to', to);
    return false;
  }
  try {
    await transport.sendMail({ from: FROM, to, subject, html });
    console.log('[email] Sent:', subject, '→', to);
    return true;
  } catch (err: any) {
    console.error('[email] Failed to send to', to, ':', err.message);
    return false;
  }
}

// ── Email templates ────────────────────────────────────────────────────────────

function shell(content: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f13;color:#e2e8f0;margin:0;padding:32px">
<div style="max-width:480px;margin:0 auto;background:#1a1a24;border-radius:16px;padding:32px;border:1px solid #2a2a3a">
${content}
<hr style="border:none;border-top:1px solid #2a2a3a;margin:24px 0 16px">
<p style="color:#64748b;font-size:11px;text-align:center;margin:0">© 2026 IronVault · <a href="mailto:subsafeironvault@gmail.com" style="color:#6366f1">subsafeironvault@gmail.com</a></p>
</div>
</body></html>`;
}

function icon(emoji: string, color: string) {
  return `<div style="text-align:center;margin-bottom:20px"><div style="display:inline-block;background:${color};border-radius:12px;padding:14px 18px"><span style="font-size:26px">${emoji}</span></div></div>`;
}

function heading(text: string) {
  return `<h1 style="font-size:22px;font-weight:700;margin:0 0 10px;text-align:center">${text}</h1>`;
}

function body(text: string) {
  return `<p style="color:#94a3b8;font-size:14px;line-height:1.7;text-align:center;margin:0 0 22px">${text}</p>`;
}

function cta(href: string, label: string) {
  return `<a href="${href}" style="display:block;text-align:center;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px">${label}</a>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to IronVault 🛡',
    html: shell(`
      ${icon('🛡', 'rgba(99,102,241,.15)')}
      ${heading(`Welcome to IronVault, ${name || 'there'}!`)}
      ${body('Your secure vault is ready. All your data is AES-256 encrypted and stored locally on your device.')}
      <div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:16px;margin-bottom:22px">
        <p style="font-size:12px;color:#64748b;margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Getting started</p>
        <ul style="margin:0;padding-left:18px;color:#e2e8f0;font-size:13px;line-height:2.1">
          <li>Create your first vault and master password</li>
          <li>Add passwords, notes, and reminders</li>
          <li>Track subscriptions and expenses</li>
        </ul>
      </div>
      ${cta(APP_URL, 'Open IronVault')}
    `),
  };
}

export function passwordResetEmail(resetLink: string): { subject: string; html: string } {
  return {
    subject: 'Reset your IronVault password',
    html: shell(`
      ${icon('🔑', 'rgba(239,68,68,.1)')}
      ${heading('Reset your password')}
      ${body('Click the button below to set a new password. This link expires in <strong style="color:#e2e8f0">1 hour</strong>.')}
      ${cta(resetLink, 'Reset Password')}
      <p style="color:#64748b;font-size:12px;text-align:center;margin-top:14px">If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#64748b;font-size:11px;text-align:center;margin-top:6px;word-break:break-all">
        <a href="${resetLink}" style="color:#6366f1">${resetLink}</a>
      </p>
    `),
  };
}

export function ticketConfirmationEmail(subject: string, ticketId: string | number): { subject: string; html: string } {
  return {
    subject: `[IronVault Support] Ticket received: ${subject}`,
    html: shell(`
      ${icon('✅', 'rgba(34,197,94,.1)')}
      ${heading('We received your ticket')}
      ${body('Our support team will get back to you within 24 hours.')}
      <div style="background:rgba(255,255,255,.04);border:1px solid #2a2a3a;border-radius:12px;padding:16px;margin-bottom:22px">
        <p style="font-size:11px;color:#64748b;margin:0 0 4px">Ticket #${ticketId}</p>
        <p style="font-size:14px;font-weight:600;margin:0;color:#e2e8f0">${subject}</p>
      </div>
      <a href="mailto:subsafeironvault@gmail.com" style="display:block;text-align:center;background:rgba(99,102,241,.12);color:#6366f1;text-decoration:none;border-radius:10px;padding:13px 24px;font-weight:600;font-size:14px;border:1px solid rgba(99,102,241,.25)">Reply via Email</a>
    `),
  };
}

export function planUpgradeEmail(plan: string): { subject: string; html: string } {
  const label = plan === 'lifetime' ? 'Lifetime' : plan === 'family' ? 'Family' : 'Pro';
  return {
    subject: `You're now on IronVault ${label} ⭐`,
    html: shell(`
      ${icon('⭐', 'rgba(245,158,11,.1)')}
      ${heading(`Welcome to ${label}!`)}
      ${body(`Your IronVault account has been upgraded to <strong style="color:#e2e8f0">${label}</strong>. All premium features are now unlocked.`)}
      ${cta(APP_URL, 'Open IronVault')}
    `),
  };
}
