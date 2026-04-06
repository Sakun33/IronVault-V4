import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || process.env.ADMIN_PORT || 3001;

// JSON file for persistent storage (survives server restarts)
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'admin-data.json');

function loadData(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data.customers?.length) customers = data.customers;
      if (data.tickets?.length) tickets = data.tickets;
      if (data.ticketResponses?.length) ticketResponses = data.ticketResponses;
      if (data.notifications?.length) notifications = data.notifications;
      if (data.plans?.length) plans = data.plans;
      if (data.customerNotes?.length) customerNotes = data.customerNotes;
      if (data.adminLogs?.length) adminLogs = data.adminLogs;
      if (data.admins?.length) admins = data.admins;
      console.log(`📂 Loaded persistent data: ${customers.length} customers, ${tickets.length} tickets`);
    }
  } catch (err) {
    console.warn('⚠️ Could not load data file, starting fresh:', (err as Error).message);
  }
}

function saveData(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = {
      customers,
      tickets,
      ticketResponses,
      notifications,
      plans,
      customerNotes,
      adminLogs,
      admins,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Failed to save data:', (err as Error).message);
  }
}

// In-memory database for demo purposes
interface Customer {
  id: number;
  email: string;
  name: string;
  phone?: string;
  region?: string;
  plan_name?: string;
  subscription_plan?: string;
  status: string;
  created_at: string;
  last_active: string;
  total_spent?: number;
  vault_created?: boolean;
  source?: string;
}

interface Admin {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
}

interface SupportTicket {
  id: number;
  customer_email: string;
  customer_name: string;
  subject: string;
  message: string;
  category: 'bug' | 'feature' | 'question' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  responses?: TicketResponse[];
}

interface TicketResponse {
  id: number;
  ticket_id: number;
  message: string;
  is_admin: boolean;
  created_at: string;
  created_by: string;
}

interface Notification {
  id: number;
  type: 'customer_signup' | 'ticket_created' | 'ticket_updated' | 'system';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

// Empty customer array - ready for real customer signups
let customers: Customer[] = [];

// Empty tickets array - ready for real support tickets
let tickets: SupportTicket[] = [];
let ticketResponses: TicketResponse[] = [];

// Notifications array - synced with real events
let notifications: Notification[] = [];

// Plans for subscription management
interface Plan {
  plan_id: number;
  name: string;
  price: number;
  billing_cycle: 'monthly' | 'yearly' | 'lifetime';
  features?: string;
  is_active: boolean;
  customer_count?: number;
}

let plans: Plan[] = [
  { plan_id: 1, name: 'Free', price: 0, billing_cycle: 'monthly', is_active: true, customer_count: 0 },
  { plan_id: 2, name: 'Pro Monthly', price: 9.99, billing_cycle: 'monthly', is_active: true, customer_count: 0 },
  { plan_id: 3, name: 'Pro Yearly', price: 95.99, billing_cycle: 'yearly', is_active: true, customer_count: 0 },
  { plan_id: 4, name: 'Lifetime', price: 299.99, billing_cycle: 'lifetime', is_active: true, customer_count: 0 },
];

// Helper function to create notifications
function createNotification(
  type: Notification['type'],
  title: string,
  message: string,
  link?: string
): void {
  const notification: Notification = {
    id: notifications.length + 1,
    type,
    title,
    message,
    link,
    read: false,
    created_at: new Date().toISOString()
  };
  notifications.unshift(notification); // Add to beginning
  console.log('🔔 Notification created:', notification.title);
  saveData();
}

let admins: Admin[] = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@securevault.com',
    password_hash: '$2b$10$zxD4TzxZ2mJ9LGA3qJQy4uKus6wa.6nv8JTiTbZBJt52APQDmqUDi', // admin123
    role: 'super_admin',
    is_active: true
  }
];

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://admin.ironvault.app',
    'https://ironvault.app',
    'https://www.ironvault.app',
    'capacitor://localhost',
    'ionic://localhost',
    'https://frontend-rt7pbzj34-saket-sumans-projects-1f5ede07.vercel.app',
    'https://frontend-fcp0ztrkw-saket-sumans-projects-1f5ede07.vercel.app',
    'https://frontend-g4chvvp0l-saket-sumans-projects-1f5ede07.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Auth middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'admin-secret', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    customers: customers.length,
    admins: admins.length
  });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt:', { body: req.body, username: req.body?.username, hasPassword: !!req.body?.password });
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const admin = admins.find(a => a.username === username && a.is_active);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'admin-secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current admin user (session restoration)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const admin = admins.find(a => a.id === (req as any).user?.id && a.is_active);
    if (!admin) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Customers list
app.get('/api/customers', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', status = '', plan = '' } = req.query;
    
    let filteredCustomers = [...customers];

    if (search) {
      const searchLower = search.toString().toLowerCase();
      filteredCustomers = filteredCustomers.filter(c => 
        c.email.toLowerCase().includes(searchLower) || 
        c.name.toLowerCase().includes(searchLower)
      );
    }

    if (status) {
      filteredCustomers = filteredCustomers.filter(c => c.status === status);
    }

    if (plan) {
      const planLower = plan.toString().toLowerCase().replace(/\s+/g, '_');
      const planAlt = plan.toString().toLowerCase().replace(/_/g, ' ');
      filteredCustomers = filteredCustomers.filter(c => {
        const pn = (c.plan_name || '').toLowerCase();
        return pn.includes(planLower) || pn.includes(planAlt) || planLower.includes(pn.replace(/\s+/g, '_'));
      });
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

    res.json({
      customers: paginatedCustomers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredCustomers.length,
        pages: Math.ceil(filteredCustomers.length / Number(limit))
      }
    });
  } catch (error) {
    console.error('Customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Dashboard analytics
app.get('/api/dashboard/analytics', authenticateToken, (req, res) => {
  try {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.status === 'active').length;
    const toLower = (p: string | undefined) => (p || '').toLowerCase();
    const proCustomers = customers.filter(c => toLower(c.plan_name).includes('pro') || toLower(c.plan_name).includes('premium')).length;
    const freeCustomers = customers.filter(c => toLower(c.plan_name) === 'free' || !c.plan_name).length;
    
    const regionStats = customers.reduce((acc, customer) => {
      const r = customer.region || 'unknown';
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const planStats = customers.reduce((acc, customer) => {
      const pn = customer.plan_name || 'free';
      acc[pn] = (acc[pn] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Generate daily activity for chart (last 7 days)
    const dailyActivity: Array<{ date: string; users: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = customers.filter(c => {
        const created = new Date(c.created_at).toISOString().slice(0, 10);
        const lastActive = new Date(c.last_active).toISOString().slice(0, 10);
        return created <= dateStr && lastActive >= dateStr;
      }).length;
      dailyActivity.push({ date: dateStr, users: count });
    }

    res.json({
      totalCustomers,
      activeCustomers,
      proCustomers,
      freeCustomers,
      regionStats,
      planStats,
      recentCustomers: customers.slice(-10),
      dailyActivity
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Dashboard KPIs - NEW ENDPOINT
app.get('/api/dashboard/kpis', authenticateToken, (req, res) => {
  try {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.status === 'active').length;
    
    // Calculate MRR (Monthly Recurring Revenue)
    const proMonthly = customers.filter(c => c.plan_name === 'Pro Monthly').length * 9.99;
    const proYearly = customers.filter(c => c.plan_name === 'Pro Yearly').length * 8.33; // $99/year = $8.33/month
    const mrr = proMonthly + proYearly;
    
    // Calculate total revenue (including lifetime)
    const lifetimeRevenue = customers.filter(c => c.plan_name === 'Lifetime').length * 299;
    const totalRevenue = mrr * 12 + lifetimeRevenue;
    
    // Calculate new signups (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newSignups = customers.filter(c => new Date(c.created_at) > oneDayAgo).length;
    
    // Calculate churn rate (simplified)
    const inactiveCustomers = customers.filter(c => c.status === 'inactive').length;
    const churnRate = totalCustomers > 0 ? (inactiveCustomers / totalCustomers) * 100 : 0;
    
    res.json({
      totalCustomers,
      activeCustomers,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      newSignups,
      churnRate: parseFloat(churnRate.toFixed(2)),
      mrr: parseFloat(mrr.toFixed(2))
    });
  } catch (error) {
    console.error('KPIs error:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// Recent activity feed
app.get('/api/dashboard/recent-activity', authenticateToken, (req, res) => {
  try {
    const recentCustomers = customers
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(c => ({
        type: 'customer_signup',
        description: `New customer: ${c.name}`,
        email: c.email,
        timestamp: c.created_at
      }));
    
    res.json(recentCustomers);
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// Customer details
app.get('/api/customers/:id', authenticateToken, (req, res) => {
  try {
    const customer = customers.find(c => c.id === Number(req.params.id));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Customer detail error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Update customer
app.put('/api/customers/:id', authenticateToken, (req, res) => {
  try {
    const customerIndex = customers.findIndex(c => c.id === Number(req.params.id));
    if (customerIndex === -1) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    customers[customerIndex] = {
      ...customers[customerIndex],
      ...req.body,
      id: customers[customerIndex].id // Preserve ID
    };
    saveData();
    res.json(customers[customerIndex]);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Create customer
app.post('/api/customers', authenticateToken, (req, res) => {
  try {
    const { name, email, phone, region, plan_name, status } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    const newCustomer: Customer = {
      id: customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1,
      name,
      email,
      phone: phone || '',
      region: region || 'US',
      plan_name: plan_name || 'Free',
      status: status || 'active',
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      total_spent: 0,
      vault_created: false,
      source: 'admin',
    };
    customers.push(newCustomer);
    saveData();
    res.status(201).json(newCustomer);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// ====================================
// PLANS ENDPOINTS
// ====================================

app.get('/api/plans', authenticateToken, (req, res) => {
  try {
    // Sync customer_count from actual customers
    const plansWithCount = plans.map(p => {
      const count = customers.filter(c => {
        const pn = (c.plan_name || '').toLowerCase();
        const planName = p.name.toLowerCase();
        return pn.includes(planName) || (planName === 'free' && (!pn || pn === 'free'));
      }).length;
      return { ...p, customer_count: count };
    });
    res.json(plansWithCount);
  } catch (error) {
    console.error('Plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

app.post('/api/plans', authenticateToken, (req, res) => {
  try {
    const { name, price, billing_cycle = 'monthly', features, is_active = true } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    const newPlan: Plan = {
      plan_id: plans.length + 1,
      name,
      price: parseFloat(price),
      billing_cycle: billing_cycle || 'monthly',
      features: features || '',
      is_active: is_active !== false,
      customer_count: 0
    };
    plans.push(newPlan);
    saveData();
    res.status(201).json(newPlan);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

app.get('/api/plans/:id', authenticateToken, (req, res) => {
  try {
    const plan = plans.find(p => p.plan_id === parseInt(req.params.id));
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

app.put('/api/plans/:id', authenticateToken, (req, res) => {
  try {
    const idx = plans.findIndex(p => p.plan_id === parseInt(req.params.id));
    if (idx < 0) return res.status(404).json({ error: 'Plan not found' });
    const { name, price, billing_cycle, features, is_active } = req.body;
    if (name) plans[idx].name = name;
    if (price !== undefined) plans[idx].price = parseFloat(price);
    if (billing_cycle) plans[idx].billing_cycle = billing_cycle;
    if (features !== undefined) plans[idx].features = features;
    if (is_active !== undefined) plans[idx].is_active = is_active;
    saveData();
    res.json(plans[idx]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

app.delete('/api/plans/:id', authenticateToken, (req, res) => {
  try {
    const idx = plans.findIndex(p => p.plan_id === parseInt(req.params.id));
    if (idx < 0) return res.status(404).json({ error: 'Plan not found' });
    plans.splice(idx, 1);
    saveData();
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// ====================================
// ADMINS & AUDIT LOGS
// ====================================

app.get('/api/admins', authenticateToken, (req, res) => {
  try {
    const result = admins.map(a => ({
      id: a.id,
      username: a.username,
      email: a.email,
      role: a.role,
      is_active: a.is_active,
      last_login: null,
      created_at: new Date().toISOString()
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

app.post('/api/admins', authenticateToken, async (req, res) => {
  try {
    const { username, email, password, role = 'admin' } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (admins.some(a => a.username === username)) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const newAdmin: Admin = {
      id: admins.length + 1,
      username,
      email,
      password_hash: hash,
      role,
      is_active: true
    };
    admins.push(newAdmin);
    saveData();
    res.status(201).json({
      id: newAdmin.id,
      username: newAdmin.username,
      email: newAdmin.email,
      role: newAdmin.role,
      is_active: newAdmin.is_active
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// In-memory audit logs (append-only)
let adminLogs: Array<{ log_id: number; admin_id: number; username: string; action: string; resource?: string; resource_id?: number; details?: any; ip_address?: string; created_at: string }> = [];

// Customer notes (persistent per customer)
interface CustomerNote {
  id: number;
  customer_id: number;
  content: string;
  author: string;
  created_at: string;
}
let customerNotes: CustomerNote[] = [];

app.get('/api/admin-logs', authenticateToken, (req, res) => {
  try {
    res.json({ logs: adminLogs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Customer journey tracking
app.get('/api/customers/:id/journey', authenticateToken, (req, res) => {
  try {
    const customer = customers.find(c => c.id === Number(req.params.id));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Generate mock journey events
    const journey = [
      {
        event: 'Account Created',
        timestamp: customer.created_at,
        details: `Signed up with ${customer.email}`,
        status: 'completed'
      },
      {
        event: 'Plan Selected',
        timestamp: customer.created_at,
        details: `Chose ${customer.plan_name} plan`,
        status: 'completed'
      },
      {
        event: 'First Login',
        timestamp: customer.created_at,
        details: 'User logged in for the first time',
        status: 'completed'
      },
      {
        event: 'Last Active',
        timestamp: customer.last_active,
        details: 'Most recent activity',
        status: customer.status === 'active' ? 'completed' : 'inactive'
      }
    ];
    
    res.json(journey);
  } catch (error) {
    console.error('Customer journey error:', error);
    res.status(500).json({ error: 'Failed to fetch customer journey' });
  }
});

// Customer queries/tickets
app.get('/api/customers/:id/tickets', authenticateToken, (req, res) => {
  try {
    const customer = customers.find(c => c.id === Number(req.params.id));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Return actual tickets for this customer (by email)
    const customerTickets = tickets
      .filter(t => t.customer_email?.toLowerCase() === customer.email?.toLowerCase())
      .map(t => ({
        id: String(t.id),
        subject: t.subject,
        status: t.status === 'in_progress' ? 'pending' : t.status,
        priority: t.priority,
        created_at: t.created_at,
        updated_at: t.updated_at
      }));
    
    res.json(customerTickets);
  } catch (error) {
    console.error('Customer tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch customer tickets' });
  }
});

// Customer notes/interactions
app.get('/api/customers/:id/notes', authenticateToken, (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const notes = customerNotes
      .filter(n => n.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(n => ({ id: n.id, content: n.content, author: n.author, created_at: n.created_at }));
    
    res.json(notes);
  } catch (error) {
    console.error('Customer notes error:', error);
    res.status(500).json({ error: 'Failed to fetch customer notes' });
  }
});

// Add note to customer
app.post('/api/customers/:id/notes', authenticateToken, (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const newNote: CustomerNote = {
      id: customerNotes.length + 1,
      customer_id: customerId,
      content: req.body.content || '',
      author: req.body.author || (req as any).user?.username || 'Admin',
      created_at: new Date().toISOString()
    };
    customerNotes.push(newNote);
    saveData();
    res.status(201).json({
      id: newNote.id,
      content: newNote.content,
      author: newNote.author,
      created_at: newNote.created_at
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Customer communication history
app.get('/api/customers/:id/communications', authenticateToken, (req, res) => {
  try {
    const customer = customers.find(c => c.id === Number(req.params.id));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Mock communications
    const communications = [
      {
        id: 1,
        type: 'email',
        subject: 'Welcome to SecureVault',
        status: 'sent',
        timestamp: customer.created_at
      },
      {
        id: 2,
        type: 'email',
        subject: 'Your subscription is active',
        status: 'delivered',
        timestamp: customer.created_at
      },
      {
        id: 3,
        type: 'notification',
        subject: 'New feature available',
        status: 'read',
        timestamp: customer.last_active
      }
    ];
    
    res.json(communications);
  } catch (error) {
    console.error('Communications error:', error);
    res.status(500).json({ error: 'Failed to fetch communications' });
  }
});

// ====================================
// PUBLIC CUSTOMER REGISTRATION ENDPOINT
// ====================================
// This endpoint is called from the main app (ironvault.app) when users create a vault
// No authentication required - this is the public signup API
app.post('/api/public/customers/register', async (req, res) => {
  try {
    console.log('📝 New customer registration:', req.body);
    
    const {
      email,
      name,
      phone,
      subscription_plan = 'free',
      vault_created = true,
      source = 'web_app'
    } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if customer already exists
    const existingCustomer = customers.find(c => c.email === email);
    if (existingCustomer) {
      return res.status(200).json({ 
        message: 'Customer already registered',
        customer: existingCustomer 
      });
    }

    // Create new customer
    const newCustomer: Customer = {
      id: customers.length + 1,
      email: email,
      name: name || email.split('@')[0],
      phone: phone || undefined,
      region: 'US', // Default region
      plan_name: subscription_plan === 'free' ? 'Free' : subscription_plan,
      subscription_plan: subscription_plan,
      status: 'active',
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      total_spent: 0,
      vault_created: vault_created,
      source: source
    };

    customers.push(newCustomer);
    saveData();
    
    // Create notification for new customer signup
    createNotification(
      'customer_signup',
      'New Customer Signup',
      `${newCustomer.name || newCustomer.email} just signed up`,
      `/customers/${newCustomer.id}`
    );
    
    console.log('✅ Customer registered successfully:', newCustomer.email);
    
    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customer: newCustomer
    });
  } catch (error) {
    console.error('❌ Customer registration error:', error);
    res.status(500).json({ error: 'Failed to register customer' });
  }
});

// ====================================
// PUBLIC CUSTOMER UPDATE ENDPOINT
// ====================================
// Update existing customer profile
app.post('/api/public/customers/update', async (req, res) => {
  try {
    console.log('🔄 Customer profile update:', req.body);
    
    const { email, name, phone } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find and update existing customer
    const customerIndex = customers.findIndex(c => c.email === email);
    
    if (customerIndex >= 0) {
      customers[customerIndex] = {
        ...customers[customerIndex],
        name: name || customers[customerIndex].name,
        phone: phone !== undefined ? phone : customers[customerIndex].phone,
        last_active: new Date().toISOString()
      };
      saveData();
      console.log('✅ Customer updated:', customers[customerIndex].email);
      
      return res.json({
        success: true,
        message: 'Profile updated successfully',
        customer: customers[customerIndex]
      });
    } else {
      return res.status(404).json({ error: 'Customer not found' });
    }
  } catch (error) {
    console.error('❌ Customer update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ====================================
// SUPPORT TICKETS ENDPOINTS
// ====================================

// Transform ticket to frontend format (ticket_id, description)
function toFrontendTicket(t: SupportTicket) {
  return {
    ticket_id: t.id,
    customer_id: null,
    customer_email: t.customer_email,
    customer_name: t.customer_name,
    subject: t.subject,
    description: t.message,
    status: t.status === 'in_progress' ? 'pending' : t.status,
    priority: t.priority,
    created_at: t.created_at,
    updated_at: t.updated_at
  };
}

// Get all tickets (Admin)
app.get('/api/tickets', authenticateToken, (req, res) => {
  try {
    const { status, priority, search } = req.query;
    
    let filteredTickets = [...tickets];
    
    if (status && status !== 'all') {
      const matchStatus = (status as string) === 'pending' ? 'in_progress' : (status as string);
      filteredTickets = filteredTickets.filter(t => t.status === matchStatus);
    }
    
    if (priority && priority !== 'all') {
      filteredTickets = filteredTickets.filter(t => t.priority === priority);
    }
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredTickets = filteredTickets.filter(t => 
        t.subject.toLowerCase().includes(searchLower) ||
        t.customer_email.toLowerCase().includes(searchLower) ||
        t.customer_name.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by created_at descending
    filteredTickets.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    res.json({ tickets: filteredTickets.map(toFrontendTicket) });
  } catch (error) {
    console.error('❌ Fetch tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Create ticket (Admin - from support UI)
app.post('/api/tickets', authenticateToken, (req, res) => {
  try {
    const { subject, description, priority = 'medium', customer_id } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }
    const customer = customer_id ? customers.find(c => c.id === customer_id) : null;
    const newTicket: SupportTicket = {
      id: tickets.length + 1,
      customer_email: customer?.email || 'internal@admin',
      customer_name: customer?.name || 'Internal',
      subject,
      message: description,
      category: 'other',
      priority: priority || 'medium',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      responses: []
    };
    tickets.push(newTicket);
    saveData();
    createNotification('ticket_created', 'New Support Ticket', `${newTicket.subject}`, `/support?ticket=${newTicket.id}`);
    res.status(201).json(toFrontendTicket(newTicket));
  } catch (error) {
    console.error('❌ Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Get single ticket by ID (Admin)
app.get('/api/tickets/:id', authenticateToken, (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const ticket = tickets.find(t => t.id === ticketId);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Add responses to ticket
    const responses = ticketResponses.filter(r => r.ticket_id === ticketId);
    const ticketWithResponses = { ...ticket, responses };
    
    res.json(ticketWithResponses);
  } catch (error) {
    console.error('❌ Fetch ticket error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create ticket (Public - from customer)
app.post('/api/public/tickets/create', async (req, res) => {
  try {
    const { customer_email, customer_name, subject, message, category = 'question', priority = 'medium' } = req.body;
    
    if (!customer_email || !subject || !message) {
      return res.status(400).json({ error: 'Email, subject, and message are required' });
    }
    
    const newTicket: SupportTicket = {
      id: tickets.length + 1,
      customer_email,
      customer_name: customer_name || customer_email.split('@')[0],
      subject,
      message,
      category,
      priority,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      responses: []
    };
    
    tickets.push(newTicket);
    saveData();
    
    // Create notification for new ticket
    const priorityEmoji = priority === 'critical' ? '🔴' : priority === 'high' ? '🟠' : '🟡';
    createNotification(
      'ticket_created',
      `${priorityEmoji} New Support Ticket`,
      `${newTicket.customer_name}: ${newTicket.subject}`,
      `/support?ticket=${newTicket.id}`
    );
    
    console.log('✅ Support ticket created:', newTicket.id, '-', newTicket.subject);
    
    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket: newTicket
    });
  } catch (error) {
    console.error('❌ Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Update ticket (Admin) - full update
app.put('/api/tickets/:id', authenticateToken, (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (ticketIndex < 0) return res.status(404).json({ error: 'Ticket not found' });
    let { status, priority, subject, description } = req.body;
    if (status) {
      tickets[ticketIndex].status = status === 'pending' ? 'in_progress' : status;
    }
    if (priority) tickets[ticketIndex].priority = priority;
    if (subject) tickets[ticketIndex].subject = subject;
    if (description) tickets[ticketIndex].message = description;
    tickets[ticketIndex].updated_at = new Date().toISOString();
    saveData();
    res.json(toFrontendTicket(tickets[ticketIndex]));
  } catch (error) {
    console.error('❌ Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Close ticket (Admin)
app.post('/api/tickets/:id/close', authenticateToken, (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (ticketIndex < 0) return res.status(404).json({ error: 'Ticket not found' });
    tickets[ticketIndex].status = 'closed';
    tickets[ticketIndex].updated_at = new Date().toISOString();
    saveData();
    res.json(toFrontendTicket(tickets[ticketIndex]));
  } catch (error) {
    console.error('❌ Close ticket error:', error);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
});

// Update ticket status (Admin)
app.patch('/api/tickets/:id/status', authenticateToken, (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    let { status } = req.body;
    status = status === 'pending' ? 'in_progress' : status;
    
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    
    if (ticketIndex < 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    tickets[ticketIndex].status = status;
    tickets[ticketIndex].updated_at = new Date().toISOString();
    saveData();
    console.log('✅ Ticket status updated:', ticketId, '->', status);
    
    res.json({
      success: true,
      message: 'Ticket status updated',
      ticket: toFrontendTicket(tickets[ticketIndex])
    });
  } catch (error) {
    console.error('❌ Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Add response to ticket (Admin)
app.post('/api/tickets/:id/responses', authenticateToken, (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { message } = req.body;
    const adminUser = (req as any).user;
    
    const ticket = tickets.find(t => t.id === ticketId);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const newResponse: TicketResponse = {
      id: ticketResponses.length + 1,
      ticket_id: ticketId,
      message,
      is_admin: true,
      created_at: new Date().toISOString(),
      created_by: adminUser.username || 'admin'
    };
    
    ticketResponses.push(newResponse);
    
    // Update ticket status to in_progress if it was open
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (tickets[ticketIndex].status === 'open') {
      tickets[ticketIndex].status = 'in_progress';
    }
    tickets[ticketIndex].updated_at = new Date().toISOString();
    saveData();
    console.log('✅ Response added to ticket:', ticketId);
    
    res.status(201).json({
      success: true,
      message: 'Response added successfully',
      response: newResponse
    });
  } catch (error) {
    console.error('❌ Add response error:', error);
    res.status(500).json({ error: 'Failed to add response' });
  }
});

// Get ticket stats (Admin)
app.get('/api/tickets/stats', authenticateToken, (req, res) => {
  try {
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length,
      by_priority: {
        low: tickets.filter(t => t.priority === 'low').length,
        medium: tickets.filter(t => t.priority === 'medium').length,
        high: tickets.filter(t => t.priority === 'high').length,
        critical: tickets.filter(t => t.priority === 'critical').length
      },
      by_category: {
        bug: tickets.filter(t => t.category === 'bug').length,
        feature: tickets.filter(t => t.category === 'feature').length,
        question: tickets.filter(t => t.category === 'question').length,
        other: tickets.filter(t => t.category === 'other').length
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Ticket stats error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket stats' });
  }
});

// ====================================
// NOTIFICATIONS ENDPOINTS
// ====================================

// Get all notifications (Admin)
app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    const { unread_only } = req.query;
    
    let filteredNotifications = [...notifications];
    
    if (unread_only === 'true') {
      filteredNotifications = filteredNotifications.filter(n => !n.read);
    }
    
    // Sort by created_at descending (newest first)
    filteredNotifications.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    res.json(filteredNotifications);
  } catch (error) {
    console.error('❌ Fetch notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread notification count (Admin)
app.get('/api/notifications/count', authenticateToken, (req, res) => {
  try {
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ count: unreadCount });
  } catch (error) {
    console.error('❌ Notification count error:', error);
    res.status(500).json({ error: 'Failed to fetch notification count' });
  }
});

// Mark notification as read (Admin)
app.patch('/api/notifications/:id/read', authenticateToken, (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    notification.read = true;
    saveData();
    res.json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('❌ Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read (Admin)
app.patch('/api/notifications/read-all', authenticateToken, (req, res) => {
  try {
    notifications.forEach(n => n.read = true);
    saveData();
    res.json({
      success: true,
      message: 'All notifications marked as read',
      count: notifications.length
    });
  } catch (error) {
    console.error('❌ Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// ====================================
// PUBLIC CRM ENDPOINTS (No Auth Required)
// ====================================

// Register customer from mobile app (Public endpoint)
app.post('/api/crm/register', (req, res) => {
  try {
    console.log('📝 CRM Registration request:', req.body);
    
    const {
      email,
      fullName,
      country,
      phone,
      marketingConsent,
      supportConsent,
      platform,
      appVersion,
      selectedPlan,
      vaultCreatedAt
    } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and full name are required' 
      });
    }

    // Check if customer already exists
    const existingCustomer = customers.find(c => c.email === email);
    if (existingCustomer) {
      console.log('ℹ️ Customer already exists:', email);
      return res.json({
        success: true,
        message: 'Customer already registered',
        userId: existingCustomer.id.toString(),
        entitlement: {
          plan: existingCustomer.plan_name || 'Free',
          status: existingCustomer.status,
          trialActive: false
        }
      });
    }

    // Create new customer
    const newCustomer: Customer = {
      id: customers.length + 1,
      email,
      name: fullName,
      phone: phone || undefined,
      region: country || 'US',
      plan_name: selectedPlan || 'Free',
      subscription_plan: selectedPlan || 'Free',
      status: 'active',
      created_at: vaultCreatedAt || new Date().toISOString(),
      last_active: new Date().toISOString(),
      total_spent: 0,
      vault_created: true,
      source: platform || 'web'
    };

    customers.push(newCustomer);
    saveData();
    
    // Create notification for admin
    createNotification(
      'customer_signup',
      'New Customer Signup',
      `${fullName} (${email}) just created a vault on ${platform || 'web'}`,
      `/customers/${newCustomer.id}`
    );

    console.log('✅ Customer registered:', newCustomer);

    res.json({
      success: true,
      message: 'Customer registered successfully',
      userId: newCustomer.id.toString(),
      entitlement: {
        plan: newCustomer.plan_name,
        status: 'active',
        trialActive: false
      }
    });
  } catch (error) {
    console.error('❌ CRM registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Registration failed' 
    });
  }
});

// Get customer entitlement (Public endpoint)
app.get('/api/crm/entitlement/:userId', (req, res) => {
  try {
    const customer = customers.find(c => c.id === Number(req.params.userId));
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      entitlement: {
        plan: customer.plan_name || 'Free',
        status: customer.status,
        trialActive: false
      }
    });
  } catch (error) {
    console.error('❌ Entitlement fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch entitlement' });
  }
});

// Start server - load persisted data first
loadData();

app.listen(PORT, () => {
  console.log(`🚀 Admin Console API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log(`👥 Customers endpoint: http://localhost:${PORT}/api/customers`);
  console.log(`📈 Dashboard analytics: http://localhost:${PORT}/api/dashboard/analytics`);
  console.log(`📊 Total customers loaded: ${customers.length}`);
});
