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
    console.log('=== crm_users (id, email) ===');
    for (const r of (await c.query(`SELECT id, email FROM crm_users ORDER BY email`)).rows) {
      console.log(`  ${r.id}  ${r.email}`);
    }
    console.log('\n=== customers (id, email, plan_type) ===');
    for (const r of (await c.query(`SELECT id, email, plan_type FROM customers ORDER BY email`)).rows) {
      console.log(`  ${r.id}  ${r.email}  ${r.plan_type}`);
    }
    console.log('\n=== tickets (customer_id, customer_email) — first 5 ===');
    for (const r of (await c.query(`SELECT id, customer_id, customer_email FROM tickets ORDER BY created_at DESC LIMIT 5`)).rows) {
      console.log(`  ticket=${r.id}  customer_id=${r.customer_id}  email=${r.customer_email}`);
    }
    console.log('\n=== admin_users ===');
    for (const r of (await c.query(`SELECT * FROM admin_users`)).rows) {
      console.log(`  ${JSON.stringify(r)}`);
    }
    console.log('\n=== admin_users columns ===');
    for (const r of (await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'admin_users' ORDER BY ordinal_position`)).rows) {
      console.log(`  ${r.column_name.padEnd(20)} ${r.data_type}`);
    }
  } finally { await c.end(); }
})().catch(e => { console.error(e); process.exit(1); });
