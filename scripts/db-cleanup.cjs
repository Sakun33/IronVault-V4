#!/usr/bin/env node
/**
 * Production DB cleanup.
 *
 * Keeps:
 *   - saketsuman1312@gmail.com (and only the cloud vault named "Saket 1")
 *   - saraswatitarun@gmail.com (and all data)
 *   - any rows in admin_users (separate table, unaffected)
 *
 * Deletes everything else from:
 *   cloud_vaults, entitlements, extension_sessions, vault_activity,
 *   auth_verification_codes, crm_users
 *
 * Wrapped in a single BEGIN/COMMIT transaction so it can be rolled back if
 * any step errors. Pass --apply to actually commit; without it, runs as a
 * dry-run and rolls back.
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
const KEEP_EMAILS = ['saketsuman1312@gmail.com', 'saraswatitarun@gmail.com'];
const KEEP_VAULT_FOR_SAKET = 'Saket 1';

(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  console.log(APPLY ? '\n*** APPLY MODE — changes will be committed ***\n' : '\n*** DRY RUN — will roll back at end ***\n');

  try {
    await c.query('BEGIN');

    // 1. resolve KEEP user ids
    const keep = await c.query(
      `SELECT id, email FROM crm_users WHERE email = ANY($1)`,
      [KEEP_EMAILS]
    );
    console.log('--- KEEP users ---');
    for (const r of keep.rows) console.log(`  ${r.id}  ${r.email}`);
    if (keep.rows.length !== KEEP_EMAILS.length) {
      console.log(`  WARNING: only ${keep.rows.length}/${KEEP_EMAILS.length} keep emails matched`);
    }
    const keepIds = keep.rows.map(r => r.id);
    const saketRow = keep.rows.find(r => r.email === 'saketsuman1312@gmail.com');
    const saketId = saketRow ? saketRow.id : null;

    // 2. resolve DELETE user ids
    const del = await c.query(
      `SELECT id, email FROM crm_users WHERE NOT (email = ANY($1))`,
      [KEEP_EMAILS]
    );
    console.log(`\n--- DELETE users (${del.rows.length}) ---`);
    for (const r of del.rows) console.log(`  ${r.id}  ${r.email}`);
    const delIds = del.rows.map(r => r.id);
    const delEmails = del.rows.map(r => r.email);

    // 3. cloud_vaults — delete those owned by deleted users + saket's non-"Saket 1" vaults
    let cv1 = { rowCount: 0 }, cv2 = { rowCount: 0 };
    if (delIds.length > 0) {
      cv1 = await c.query(
        `DELETE FROM cloud_vaults WHERE user_id = ANY($1)`,
        [delIds]
      );
    }
    if (saketId) {
      cv2 = await c.query(
        `DELETE FROM cloud_vaults WHERE user_id = $1 AND vault_name <> $2`,
        [saketId, KEEP_VAULT_FOR_SAKET]
      );
    }
    console.log(`\ncloud_vaults: deleted ${cv1.rowCount} (other users) + ${cv2.rowCount} (saket non-"${KEEP_VAULT_FOR_SAKET}")`);

    // 4. entitlements
    const ent = delIds.length
      ? await c.query(`DELETE FROM entitlements WHERE user_id = ANY($1)`, [delIds])
      : { rowCount: 0 };
    console.log(`entitlements: deleted ${ent.rowCount}`);

    // 5. extension_sessions
    const ext = delIds.length
      ? await c.query(`DELETE FROM extension_sessions WHERE user_id = ANY($1)`, [delIds])
      : { rowCount: 0 };
    console.log(`extension_sessions: deleted ${ext.rowCount}`);

    // 6. vault_activity
    const va = delIds.length
      ? await c.query(`DELETE FROM vault_activity WHERE user_id = ANY($1)`, [delIds])
      : { rowCount: 0 };
    console.log(`vault_activity: deleted ${va.rowCount}`);

    // 7. auth_verification_codes (keyed by email)
    const avc = delEmails.length
      ? await c.query(`DELETE FROM auth_verification_codes WHERE email = ANY($1)`, [delEmails])
      : { rowCount: 0 };
    console.log(`auth_verification_codes: deleted ${avc.rowCount}`);

    // 8. finally crm_users
    const usr = delIds.length
      ? await c.query(`DELETE FROM crm_users WHERE id = ANY($1)`, [delIds])
      : { rowCount: 0 };
    console.log(`crm_users: deleted ${usr.rowCount}`);

    if (APPLY) {
      await c.query('COMMIT');
      console.log('\n*** COMMITTED ***');
    } else {
      await c.query('ROLLBACK');
      console.log('\n*** ROLLED BACK (dry run) ***  — re-run with --apply to commit');
    }

    // post-state read (uses the committed state if APPLY, else the rolled-back state)
    const after = await c.query(
      `SELECT email, account_status FROM crm_users ORDER BY email`
    );
    console.log(`\nremaining crm_users (${after.rows.length}):`);
    for (const r of after.rows) console.log(`  ${r.email.padEnd(40)} status=${r.account_status || 'n/a'}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR — rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
