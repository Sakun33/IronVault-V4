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

(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  try {
    const tables = [
      'cloud_vaults', 'entitlements', 'extension_sessions', 'vault_activity',
      'auth_verification_codes', 'password_reset_tokens', 'customers',
      'billing_events', 'family_invites', 'tickets', 'ticket_replies',
      'shared_links', 'plan_audit_log', 'deletion_requests', 'audit_log',
    ];
    for (const t of tables) {
      const cols = (await c.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [t]
      )).rows.map(r => r.column_name);
      console.log(`\n${t}: ${cols.join(', ')}`);
    }
  } finally { await c.end(); }
})().catch(e => { console.error(e); process.exit(1); });
