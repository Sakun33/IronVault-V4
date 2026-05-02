#!/usr/bin/env node
/**
 * Sweep orphaned rows from secondary tables.
 *
 * Keep references to: saketsuman1312@gmail.com, saraswatitarun@gmail.com.
 *
 * Schema notes (verified via information_schema):
 *   - customers, password_reset_tokens, auth_verification_codes  → keyed by email
 *   - family_invites                                              → owner_email, invitee_email
 *   - tickets, plan_audit_log                                     → customer_email
 *   - billing_events, vault_activity, extension_sessions          → user_id (FK crm_users.id)
 *   - ticket_replies                                              → ticket_id (cascades from tickets)
 *   - shared_links                                                → has NO user_id; token-only
 *
 * Pass --apply to commit.
 */
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

const APPLY = process.argv.includes('--apply');
const KEEP = ['saketsuman1312@gmail.com', 'saraswatitarun@gmail.com'];

(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  console.log(APPLY ? '\n*** APPLY MODE ***\n' : '\n*** DRY RUN — will roll back ***\n');

  const ops = [
    // [label, sql, params]
    ['customers (by email)',
      `DELETE FROM customers WHERE NOT (email = ANY($1))`, [KEEP]],
    ['password_reset_tokens (by email)',
      `DELETE FROM password_reset_tokens WHERE NOT (email = ANY($1))`, [KEEP]],
    ['auth_verification_codes (by email)',
      `DELETE FROM auth_verification_codes WHERE NOT (email = ANY($1))`, [KEEP]],
    ['family_invites (both sides off keep list)',
      `DELETE FROM family_invites
        WHERE NOT (owner_email = ANY($1)) AND NOT (invitee_email = ANY($1))`, [KEEP]],
    ['plan_audit_log (by customer_email)',
      `DELETE FROM plan_audit_log WHERE NOT (customer_email = ANY($1))`, [KEEP]],
    ['tickets (by customer_email)',
      `DELETE FROM tickets WHERE NOT (customer_email = ANY($1))`, [KEEP]],
    ['ticket_replies (orphaned by ticket_id)',
      `DELETE FROM ticket_replies WHERE ticket_id NOT IN (SELECT id FROM tickets)`, []],
    // crm_users.id is varchar; some FK columns are uuid → cast both sides to text
    ['billing_events (orphaned user_id)',
      `DELETE FROM billing_events WHERE user_id IS NULL OR user_id::text NOT IN (SELECT id::text FROM crm_users)`, []],
    ['vault_activity (orphaned user_id)',
      `DELETE FROM vault_activity WHERE user_id IS NULL OR user_id::text NOT IN (SELECT id::text FROM crm_users)`, []],
    ['extension_sessions (orphaned user_id)',
      `DELETE FROM extension_sessions WHERE user_id IS NULL OR user_id::text NOT IN (SELECT id::text FROM crm_users)`, []],
  ];

  try {
    await c.query('BEGIN');
    for (const [label, sql, params] of ops) {
      try {
        const r = await c.query(sql, params);
        console.log(`  deleted ${String(r.rowCount).padStart(5)}  ${label}`);
      } catch (e) {
        console.log(`  ERROR  on ${label}: ${e.message}`);
        throw e;
      }
    }
    if (APPLY) {
      await c.query('COMMIT');
      console.log('\n*** COMMITTED ***');
    } else {
      await c.query('ROLLBACK');
      console.log('\n*** ROLLED BACK (dry run) ***  — re-run with --apply to commit');
    }

    // post-state row counts (from current DB state)
    const tables = [
      'crm_users', 'cloud_vaults', 'entitlements', 'extension_sessions',
      'vault_activity', 'auth_verification_codes', 'password_reset_tokens',
      'customers', 'billing_events', 'family_invites', 'tickets',
      'ticket_replies', 'plan_audit_log', 'shared_links',
    ];
    console.log('\n=== row counts after ===');
    for (const t of tables) {
      const r = await c.query(`SELECT COUNT(*)::int n FROM "${t}"`);
      console.log(`  ${t.padEnd(28)} ${r.rows[0].n}`);
    }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('\nERROR — rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
