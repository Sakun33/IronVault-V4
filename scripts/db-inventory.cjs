#!/usr/bin/env node
/**
 * READ-ONLY inventory of prod DB. Prints: user list, per-user vault counts,
 * and per-table row counts. NO DELETIONS.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.production');
const env = fs.readFileSync(envPath, 'utf-8')
  .split('\n')
  .filter(l => l && !l.startsWith('#'))
  .reduce((acc, line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) acc[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/\\n$/, '');
    return acc;
  }, {});

const DATABASE_URL = env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.production');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    // ── crm_users schema ─────────────────────────────────────────────────────
    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'crm_users'
      ORDER BY ordinal_position
    `);
    console.log('\n=== crm_users columns ===');
    for (const c of cols.rows) console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}`);

    // ── all users (use only columns that exist) ──────────────────────────────
    const colNames = cols.rows.map(c => c.column_name);
    const select = ['id', 'email']
      .concat(['full_name', 'name', 'display_name'].filter(c => colNames.includes(c)))
      .concat(['plan', 'plan_name', 'plan_type'].filter(c => colNames.includes(c)))
      .concat(['created_at'].filter(c => colNames.includes(c)));
    const users = await client.query(
      `SELECT ${select.join(', ')} FROM crm_users ORDER BY ${colNames.includes('created_at') ? 'created_at ASC' : 'id ASC'}`
    );
    console.log(`\n=== crm_users (${users.rows.length} total) ===`);
    for (const u of users.rows) {
      const planVal = u.plan_name || u.plan || u.plan_type || 'n/a';
      const nameVal = u.full_name || u.name || u.display_name || '';
      console.log(`  ${String(u.id).padEnd(38)}  ${String(u.email).padEnd(40)}  plan=${String(planVal).padEnd(15)}  name=${nameVal}`);
    }

    // ── cloud_vaults schema ──────────────────────────────────────────────────
    const cvCols = (await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'cloud_vaults' ORDER BY ordinal_position`
    )).rows.map(r => r.column_name);
    console.log('\n=== cloud_vaults columns ===');
    console.log(`  ${cvCols.join(', ')}`);

    // ── cloud vaults per user (use only columns that exist) ──────────────────
    const userIdCol = cvCols.includes('user_id') ? 'user_id' : (cvCols.includes('crm_user_id') ? 'crm_user_id' : null);
    const nameCol = cvCols.includes('vault_name') ? 'vault_name' : (cvCols.includes('name') ? 'name' : null);
    if (!userIdCol) {
      console.log('\n(cloud_vaults has no user_id column, skipping per-user listing)');
    } else {
      const vaults = await client.query(`
        SELECT cv.${userIdCol} AS user_id, u.email, cv.id AS vault_id, cv.${nameCol || 'id'} AS vault_name
        FROM cloud_vaults cv
        LEFT JOIN crm_users u ON u.id = cv.${userIdCol}
        ORDER BY u.email NULLS FIRST, cv.id ASC
      `);
      console.log(`\n=== cloud_vaults (${vaults.rows.length} total) ===`);
      let curEmail = null;
      for (const v of vaults.rows) {
        if (v.email !== curEmail) {
          console.log(`  ── ${v.email || '(orphan)'}`);
          curEmail = v.email;
        }
        console.log(`     ${v.vault_id}  "${v.vault_name}"`);
      }
    }

    // ── all tables + row counts ──────────────────────────────────────────────
    const allTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('\n=== all tables + row counts ===');
    for (const t of allTables.rows.map(r => r.table_name)) {
      try {
        const r = await client.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
        console.log(`  ${t.padEnd(32)} ${r.rows[0].n}`);
      } catch (e) {
        console.log(`  ${t.padEnd(32)} (err: ${e.message})`);
      }
    }

    // ── vault counts per user ────────────────────────────────────────────────
    if (userIdCol) {
      const counts = await client.query(`
        SELECT u.email, COUNT(cv.id)::int AS vault_count
        FROM crm_users u
        LEFT JOIN cloud_vaults cv ON cv.${userIdCol} = u.id
        GROUP BY u.email
        ORDER BY COUNT(cv.id) DESC, u.email ASC
      `);
      console.log('\n=== vault count per user (sorted desc) ===');
      for (const r of counts.rows) {
        console.log(`  ${String(r.vault_count).padStart(4)} vaults  ${r.email}`);
      }
    }
  } finally {
    await client.end();
  }
})().catch(err => { console.error(err); process.exit(1); });
