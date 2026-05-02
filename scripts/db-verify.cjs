#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.production'), 'utf-8')
  .split('\n').filter(l => l && !l.startsWith('#'))
  .reduce((acc, line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) acc[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/\\n$/, '');
    return acc;
  }, {});

const KEEP = ['saketsuman1312@gmail.com', 'saraswatitarun@gmail.com'];

(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  try {
    const rows = (sql) => c.query(sql).then(r => r.rows);

    console.log('=== crm_users ===');
    for (const r of await rows(`SELECT email FROM crm_users ORDER BY email`)) console.log('  ' + r.email);

    console.log('\n=== customers ===');
    for (const r of await rows(`SELECT email, plan_type FROM customers ORDER BY email`)) console.log(`  ${r.email}  plan=${r.plan_type}`);

    console.log('\n=== cloud_vaults ===');
    for (const r of await rows(`SELECT u.email, cv.vault_name FROM cloud_vaults cv JOIN crm_users u ON u.id = cv.user_id ORDER BY u.email`)) {
      console.log(`  ${r.email}  "${r.vault_name}"`);
    }

    console.log('\n=== entitlements (with email) ===');
    for (const r of await rows(`SELECT u.email, e.plan, e.status FROM entitlements e JOIN crm_users u ON u.id = e.user_id ORDER BY u.email`)) {
      console.log(`  ${r.email}  plan=${r.plan}  status=${r.status}`);
    }

    console.log('\n=== tickets (sample) ===');
    for (const r of await rows(`SELECT customer_email, status, created_at FROM tickets ORDER BY created_at DESC LIMIT 20`)) {
      const offList = !KEEP.includes(r.customer_email);
      console.log(`  ${offList ? '!! ' : '   '}${r.customer_email}  status=${r.status}`);
    }

    console.log('\n=== family_invites ===');
    for (const r of await rows(`SELECT owner_email, invitee_email, status FROM family_invites ORDER BY created_at`)) {
      console.log(`  owner=${r.owner_email}  invitee=${r.invitee_email}  status=${r.status}`);
    }

    console.log('\n=== password_reset_tokens by email count ===');
    for (const r of await rows(`SELECT email, COUNT(*)::int n FROM password_reset_tokens GROUP BY email ORDER BY n DESC`)) {
      console.log(`  ${String(r.n).padStart(4)}  ${r.email}`);
    }

    console.log('\n=== extension_sessions by email count (joined to crm_users) ===');
    for (const r of await rows(`SELECT u.email, COUNT(*)::int n FROM extension_sessions e LEFT JOIN crm_users u ON u.id::text = e.user_id::text GROUP BY u.email ORDER BY n DESC`)) {
      console.log(`  ${String(r.n).padStart(4)}  ${r.email || '(orphan)'}`);
    }

    console.log('\n=== vault_activity by email ===');
    for (const r of await rows(`SELECT u.email, COUNT(*)::int n FROM vault_activity v LEFT JOIN crm_users u ON u.id::text = v.user_id::text GROUP BY u.email ORDER BY n DESC`)) {
      console.log(`  ${String(r.n).padStart(4)}  ${r.email || '(orphan)'}`);
    }

    console.log('\n=== shared_links (no user FK; just count) ===');
    const sl = (await rows(`SELECT COUNT(*)::int n FROM shared_links`))[0].n;
    console.log(`  ${sl} link(s) — these have no owner column, can be left alone or pruned by expires_at`);
  } finally { await c.end(); }
})().catch(e => { console.error(e); process.exit(1); });
