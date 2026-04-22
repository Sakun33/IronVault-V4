import { db } from './services/database.service';
import bcrypt from 'bcrypt';

async function setupDatabase() {
  console.log('🚀 Setting up Admin Console Database...\n');

  try {
    // Create tables
    console.log('📋 Creating tables...');
    
    // Drop existing tables if they exist (for clean setup)
    await db.query(`DROP TABLE IF EXISTS admin_logs CASCADE`);
    await db.query(`DROP TABLE IF EXISTS analytics CASCADE`);
    await db.query(`DROP TABLE IF EXISTS support_tickets CASCADE`);
    await db.query(`DROP TABLE IF EXISTS notifications CASCADE`);
    await db.query(`DROP TABLE IF EXISTS promotions CASCADE`);
    await db.query(`DROP TABLE IF EXISTS subscriptions CASCADE`);
    await db.query(`DROP TABLE IF EXISTS plans CASCADE`);
    await db.query(`DROP TABLE IF EXISTS customers CASCADE`);
    await db.query(`DROP TABLE IF EXISTS admins CASCADE`);
    
    // Create admins table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ admins table created');

    // Create customers table
    await db.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(100),
        region VARCHAR(50),
        plan_id INTEGER,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP
      )
    `);
    console.log('✅ customers table created');

    // Create plans table
    await db.query(`
      CREATE TABLE IF NOT EXISTS plans (
        plan_id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        billing_cycle VARCHAR(20) NOT NULL,
        features TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ plans table created');

    // Create subscriptions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        sub_id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        plan_id INTEGER REFERENCES plans(plan_id),
        start_date TIMESTAMP NOT NULL,
        next_renewal TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ subscriptions table created');

    // Create promotions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS promotions (
        promo_id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        percent_off DECIMAL(5,2),
        amount_off DECIMAL(10,2),
        valid_from TIMESTAMP NOT NULL,
        valid_to TIMESTAMP NOT NULL,
        description TEXT,
        usage_limit INTEGER,
        usage_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ promotions table created');

    // Create notifications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notif_id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        target_group VARCHAR(50),
        schedule_at TIMESTAMP,
        sent_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ notifications table created');

    // Create support_tickets table
    await db.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        ticket_id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        subject VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        priority VARCHAR(10) DEFAULT 'medium',
        assigned_to INTEGER REFERENCES admins(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ support_tickets table created');

    // Create analytics table
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics (
        record_id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        metric VARCHAR(100) NOT NULL,
        value DECIMAL(15,2) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ analytics table created');

    // Create admin_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        log_id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES admins(id),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(50),
        resource_id INTEGER,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ admin_logs table created');

    // Insert admin user with properly hashed password
    console.log('\n👤 Creating admin user...');
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    await db.query(`
      INSERT INTO admins (username, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE SET password_hash = $3
    `, ['admin', 'admin@ironvault.app', passwordHash, 'super_admin', true]);
    console.log('✅ Admin user created (username: admin)');

    // Insert plans
    console.log('\n📦 Creating subscription plans...');
    await db.query(`
      INSERT INTO plans (name, price, billing_cycle, features) VALUES 
      ('Free', 0.00, 'monthly', '50 passwords, 10 subscriptions, 10 notes, 10 reminders'),
      ('Pro Monthly', 3.99, 'monthly', 'Unlimited passwords, subscriptions, notes, reminders, bank statements, investments'),
      ('Pro Yearly', 24.99, 'yearly', 'Unlimited passwords, subscriptions, notes, reminders, bank statements, investments'),
      ('Lifetime', 49.99, 'lifetime', 'Unlimited everything, priority support, all future features')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Plans created');

    // Create 15 test customers with various data
    console.log('\n👥 Creating test customers...');
    const customers = [
      { name: 'John Smith', email: 'john.smith@example.com', region: 'US', status: 'active' },
      { name: 'Emma Wilson', email: 'emma.wilson@example.com', region: 'UK', status: 'active' },
      { name: 'Michael Chen', email: 'michael.chen@example.com', region: 'SG', status: 'active' },
      { name: 'Sarah Johnson', email: 'sarah.j@example.com', region: 'US', status: 'active' },
      { name: 'David Brown', email: 'david.brown@example.com', region: 'CA', status: 'active' },
      { name: 'Lisa Anderson', email: 'lisa.anderson@example.com', region: 'AU', status: 'active' },
      { name: 'James Taylor', email: 'james.t@example.com', region: 'UK', status: 'inactive' },
      { name: 'Jennifer Martinez', email: 'jennifer.m@example.com', region: 'US', status: 'active' },
      { name: 'Robert Garcia', email: 'robert.garcia@example.com', region: 'ES', status: 'active' },
      { name: 'Emily Davis', email: 'emily.davis@example.com', region: 'US', status: 'active' },
      { name: 'William Miller', email: 'william.m@example.com', region: 'DE', status: 'suspended' },
      { name: 'Sophia Lee', email: 'sophia.lee@example.com', region: 'KR', status: 'active' },
      { name: 'Daniel Kim', email: 'daniel.kim@example.com', region: 'KR', status: 'active' },
      { name: 'Olivia White', email: 'olivia.white@example.com', region: 'UK', status: 'active' },
      { name: 'Alexander Müller', email: 'alex.muller@example.com', region: 'DE', status: 'active' }
    ];

    for (const customer of customers) {
      const daysAgo = Math.floor(Math.random() * 365);
      const planId = Math.floor(Math.random() * 4) + 1;
      
      await db.query(`
        INSERT INTO customers (name, email, region, plan_id, status, created_at, last_active)
        VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${daysAgo} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')
        ON CONFLICT (email) DO NOTHING
      `, [customer.name, customer.email, customer.region, planId, customer.status]);
    }
    console.log('✅ 15 test customers created');

    // Create subscriptions for customers
    console.log('\n💳 Creating subscriptions...');
    const custResult = await db.query('SELECT id, plan_id FROM customers');
    for (const cust of custResult.rows) {
      if (cust.plan_id) {
        const startDays = Math.floor(Math.random() * 180);
        await db.query(`
          INSERT INTO subscriptions (customer_id, plan_id, start_date, next_renewal, status)
          VALUES ($1, $2, NOW() - INTERVAL '${startDays} days', NOW() + INTERVAL '${30 - (startDays % 30)} days', 'active')
          ON CONFLICT DO NOTHING
        `, [cust.id, cust.plan_id]);
      }
    }
    console.log('✅ Subscriptions created');

    // Create support tickets
    console.log('\n🎫 Creating support tickets...');
    const tickets = [
      { subject: 'Cannot sync vault across devices', description: 'I am unable to sync my vault data between my iPhone and MacBook.', priority: 'high' },
      { subject: 'Password generator not working', description: 'The password generator seems to be broken on the web app.', priority: 'medium' },
      { subject: 'Billing inquiry', description: 'I was charged twice for my subscription this month.', priority: 'urgent' },
      { subject: 'Feature request: Dark mode', description: 'Would love to see a dark mode option in the app.', priority: 'low' },
      { subject: 'Account recovery help', description: 'I forgot my master password and need help recovering my account.', priority: 'high' },
      { subject: 'Export data not working', description: 'When I try to export my data, the file is empty.', priority: 'medium' },
      { subject: 'App crashes on startup', description: 'The iOS app crashes immediately after opening.', priority: 'urgent' },
      { subject: 'Two-factor authentication setup', description: 'Need help setting up 2FA for my account.', priority: 'medium' }
    ];

    const customerIds = custResult.rows.map(c => c.id);
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const customerId = customerIds[i % customerIds.length];
      const statuses = ['open', 'pending', 'resolved', 'closed'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      await db.query(`
        INSERT INTO support_tickets (customer_id, subject, description, status, priority)
        VALUES ($1, $2, $3, $4, $5)
      `, [customerId, ticket.subject, ticket.description, status, ticket.priority]);
    }
    console.log('✅ 8 support tickets created');

    // Create promotions
    console.log('\n🎁 Creating promotions...');
    await db.query(`
      INSERT INTO promotions (code, percent_off, valid_from, valid_to, description, usage_limit, is_active) VALUES 
      ('WELCOME20', 20, NOW(), NOW() + INTERVAL '90 days', '20% off for new users', 1000, true),
      ('YEARLY50', 50, NOW(), NOW() + INTERVAL '30 days', '50% off yearly plans', 500, true),
      ('BLACKFRIDAY', 40, NOW(), NOW() + INTERVAL '7 days', 'Black Friday special', 2000, true)
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Promotions created');

    // Create analytics data
    console.log('\n📊 Creating analytics data...');
    const metrics = ['logins', 'passwords_created', 'subscriptions_added', 'notes_created', 'exports'];
    for (const custId of customerIds) {
      for (const metric of metrics) {
        const value = Math.floor(Math.random() * 100);
        await db.query(`
          INSERT INTO analytics (customer_id, metric, value, timestamp)
          VALUES ($1, $2, $3, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')
        `, [custId, metric, value]);
      }
    }
    console.log('✅ Analytics data created');

    console.log('\n✨ Database setup complete!');
    console.log('\n📋 Summary:');
    console.log('   - Admin user: admin / admin123');
    console.log('   - 15 test customers created');
    console.log('   - 4 subscription plans');
    console.log('   - 8 support tickets');
    console.log('   - 3 promotions');
    console.log('   - Analytics data for all customers');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await db.close();
    process.exit(0);
  }
}

setupDatabase();
