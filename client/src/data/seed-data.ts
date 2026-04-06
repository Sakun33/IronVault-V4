// Seed data for IronVault app - 15 users with comprehensive vault data

export interface SeedUser {
  email: string;
  name: string;
  masterPassword: string;
  plan: 'free' | 'premium' | 'lifetime';
  passwords: SeedPassword[];
  subscriptions: SeedSubscription[];
  notes: SeedNote[];
  expenses: SeedExpense[];
  reminders: SeedReminder[];
  investments: SeedInvestment[];
}

export interface SeedPassword {
  name: string;
  url: string;
  username: string;
  password: string;
  category: string;
  notes?: string;
}

export interface SeedSubscription {
  name: string;
  plan: string;
  cost: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'weekly';
  category: string;
  isActive: boolean;
}

export interface SeedNote {
  title: string;
  content: string;
  notebook: string;
  tags: string[];
  isPinned: boolean;
}

export interface SeedExpense {
  title: string;
  amount: number;
  currency: string;
  category: string;
  tags: string[];
  isRecurring: boolean;
}

export interface SeedReminder {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  daysFromNow: number;
}

export interface SeedInvestment {
  name: string;
  type: string;
  institution: string;
  purchasePrice: number;
  quantity: number;
  currency: string;
}

// 15 Test Users with comprehensive data
export const seedUsers: SeedUser[] = [
  {
    email: 'john.smith@example.com',
    name: 'John Smith',
    masterPassword: 'TestPass123!',
    plan: 'premium',
    passwords: [
      { name: 'Gmail', url: 'https://gmail.com', username: 'john.smith@gmail.com', password: 'GmailPass2024!', category: 'Email' },
      { name: 'Netflix', url: 'https://netflix.com', username: 'johnsmith', password: 'NetflixSecure#1', category: 'Entertainment' },
      { name: 'Amazon', url: 'https://amazon.com', username: 'john.smith@gmail.com', password: 'AmazonShop$99', category: 'Shopping' },
      { name: 'Bank of America', url: 'https://bankofamerica.com', username: 'jsmith_boa', password: 'BankSecure@2024', category: 'Finance' },
      { name: 'LinkedIn', url: 'https://linkedin.com', username: 'johnsmith', password: 'LinkedPro!123', category: 'Work' },
    ],
    subscriptions: [
      { name: 'Netflix', plan: 'Premium', cost: 22.99, currency: 'USD', billingCycle: 'monthly', category: 'Streaming', isActive: true },
      { name: 'Spotify', plan: 'Family', cost: 16.99, currency: 'USD', billingCycle: 'monthly', category: 'Music', isActive: true },
      { name: 'Adobe Creative Cloud', plan: 'All Apps', cost: 54.99, currency: 'USD', billingCycle: 'monthly', category: 'Software', isActive: true },
    ],
    notes: [
      { title: 'Project Ideas 2025', content: '# Project Ideas\n\n- Mobile app for fitness tracking\n- AI-powered recipe generator\n- Home automation dashboard', notebook: 'Work', tags: ['ideas', 'projects'], isPinned: true },
      { title: 'Meeting Notes - Q4 Review', content: '## Q4 Review Meeting\n\n**Date:** Dec 15, 2024\n\n### Key Points:\n- Revenue up 15%\n- New product launch successful', notebook: 'Work', tags: ['meeting', 'quarterly'], isPinned: false },
    ],
    expenses: [
      { title: 'Grocery Shopping', amount: 156.78, currency: 'USD', category: 'Food & Dining', tags: ['groceries'], isRecurring: false },
      { title: 'Electric Bill', amount: 89.50, currency: 'USD', category: 'Bills & Utilities', tags: ['utilities'], isRecurring: true },
      { title: 'Gas Station', amount: 45.00, currency: 'USD', category: 'Transportation', tags: ['fuel'], isRecurring: false },
    ],
    reminders: [
      { title: 'Pay Credit Card', description: 'Pay Chase credit card bill', priority: 'high', category: 'Bills & Payments', daysFromNow: 5 },
      { title: 'Doctor Appointment', description: 'Annual checkup at Dr. Wilson', priority: 'medium', category: 'Healthcare', daysFromNow: 14 },
    ],
    investments: [
      { name: 'Apple Inc.', type: 'stocks', institution: 'Fidelity', purchasePrice: 175.50, quantity: 50, currency: 'USD' },
      { name: 'S&P 500 ETF', type: 'mutual_fund', institution: 'Vanguard', purchasePrice: 450.00, quantity: 20, currency: 'USD' },
    ],
  },
  {
    email: 'emma.wilson@example.com',
    name: 'Emma Wilson',
    masterPassword: 'EmmaSecure456!',
    plan: 'lifetime',
    passwords: [
      { name: 'iCloud', url: 'https://icloud.com', username: 'emma.wilson@icloud.com', password: 'iCloud$ecure2024', category: 'Personal' },
      { name: 'Twitter/X', url: 'https://x.com', username: '@emmawilson', password: 'TweetSafe!789', category: 'Social Media' },
      { name: 'Shopify Admin', url: 'https://admin.shopify.com', username: 'emma@myboutique.com', password: 'ShopAdmin#2024', category: 'Work' },
      { name: 'PayPal', url: 'https://paypal.com', username: 'emma.wilson@gmail.com', password: 'PayPalBiz@99', category: 'Finance' },
      { name: 'Dropbox', url: 'https://dropbox.com', username: 'emma.wilson', password: 'DropBox!Cloud1', category: 'Cloud Storage' },
      { name: 'Slack', url: 'https://slack.com', username: 'emma@startup.io', password: 'SlackTeam#22', category: 'Work' },
    ],
    subscriptions: [
      { name: 'Shopify', plan: 'Basic', cost: 39.00, currency: 'USD', billingCycle: 'monthly', category: 'Software', isActive: true },
      { name: 'Canva Pro', plan: 'Annual', cost: 119.99, currency: 'USD', billingCycle: 'yearly', category: 'Software', isActive: true },
      { name: 'Disney+', plan: 'Premium', cost: 13.99, currency: 'USD', billingCycle: 'monthly', category: 'Streaming', isActive: true },
      { name: 'Notion', plan: 'Personal Pro', cost: 8.00, currency: 'USD', billingCycle: 'monthly', category: 'Productivity', isActive: true },
    ],
    notes: [
      { title: 'Business Plan Draft', content: '# My Boutique Business Plan\n\n## Vision\nCreate a sustainable fashion brand...\n\n## Goals\n1. Launch online store\n2. Reach 1000 customers', notebook: 'Business', tags: ['business', 'planning'], isPinned: true },
      { title: 'Social Media Calendar', content: '## December Content\n\n- Week 1: Holiday collection launch\n- Week 2: Customer testimonials\n- Week 3: Behind the scenes', notebook: 'Marketing', tags: ['social', 'content'], isPinned: false },
      { title: 'Supplier Contacts', content: '### Fabric Suppliers\n\n1. **TextileCo** - Contact: Sarah\n2. **EcoFabrics** - Contact: Mike', notebook: 'Business', tags: ['contacts', 'suppliers'], isPinned: true },
    ],
    expenses: [
      { title: 'Inventory Purchase', amount: 2500.00, currency: 'USD', category: 'Business', tags: ['inventory', 'stock'], isRecurring: false },
      { title: 'Facebook Ads', amount: 350.00, currency: 'USD', category: 'Business', tags: ['marketing', 'ads'], isRecurring: true },
      { title: 'Shipping Supplies', amount: 89.99, currency: 'USD', category: 'Business', tags: ['shipping'], isRecurring: false },
    ],
    reminders: [
      { title: 'Restock Inventory', description: 'Order new spring collection items', priority: 'high', category: 'Work', daysFromNow: 7 },
      { title: 'Tax Filing Deadline', description: 'Submit quarterly tax documents', priority: 'urgent', category: 'Bills & Payments', daysFromNow: 21 },
      { title: 'Website Update', description: 'Update homepage banner for new year', priority: 'medium', category: 'Work', daysFromNow: 10 },
    ],
    investments: [
      { name: 'Tesla Inc.', type: 'stocks', institution: 'Robinhood', purchasePrice: 245.00, quantity: 15, currency: 'USD' },
      { name: 'Bitcoin', type: 'crypto', institution: 'Coinbase', purchasePrice: 42000.00, quantity: 0.5, currency: 'USD' },
      { name: 'High Yield Savings', type: 'fixed_deposit', institution: 'Marcus', purchasePrice: 10000.00, quantity: 1, currency: 'USD' },
    ],
  },
  {
    email: 'michael.chen@example.com',
    name: 'Michael Chen',
    masterPassword: 'MikeChen#789!',
    plan: 'premium',
    passwords: [
      { name: 'GitHub', url: 'https://github.com', username: 'michaelchen', password: 'GitHubDev@2024', category: 'Work' },
      { name: 'AWS Console', url: 'https://aws.amazon.com', username: 'mchen@techcorp.com', password: 'AWSCloud#Secure1', category: 'Work' },
      { name: 'Steam', url: 'https://store.steampowered.com', username: 'mikechen_gaming', password: 'SteamGamer!99', category: 'Gaming' },
      { name: 'Figma', url: 'https://figma.com', username: 'michael@design.io', password: 'FigmaDesign#1', category: 'Work' },
    ],
    subscriptions: [
      { name: 'GitHub Pro', plan: 'Pro', cost: 4.00, currency: 'USD', billingCycle: 'monthly', category: 'Software', isActive: true },
      { name: 'AWS', plan: 'Pay-as-you-go', cost: 150.00, currency: 'USD', billingCycle: 'monthly', category: 'Cloud Storage', isActive: true },
      { name: 'JetBrains', plan: 'All Products', cost: 249.00, currency: 'USD', billingCycle: 'yearly', category: 'Software', isActive: true },
    ],
    notes: [
      { title: 'API Documentation', content: '# REST API v2.0\n\n## Endpoints\n\n### GET /users\nReturns list of users...\n\n### POST /auth/login\nAuthenticate user...', notebook: 'Projects', tags: ['api', 'docs'], isPinned: true },
      { title: 'Code Review Checklist', content: '## Before Merging\n\n- [ ] Unit tests pass\n- [ ] Code follows style guide\n- [ ] No security vulnerabilities\n- [ ] Documentation updated', notebook: 'Work', tags: ['checklist', 'code'], isPinned: false },
    ],
    expenses: [
      { title: 'New Mechanical Keyboard', amount: 189.99, currency: 'USD', category: 'Shopping', tags: ['tech', 'peripherals'], isRecurring: false },
      { title: 'Coffee Subscription', amount: 35.00, currency: 'USD', category: 'Food & Dining', tags: ['coffee'], isRecurring: true },
    ],
    reminders: [
      { title: 'Deploy v2.0 Release', description: 'Push new version to production', priority: 'high', category: 'Work', daysFromNow: 3 },
      { title: 'Renew Domain', description: 'Renew techblog.dev domain', priority: 'medium', category: 'Bills & Payments', daysFromNow: 30 },
    ],
    investments: [
      { name: 'NVIDIA Corp.', type: 'stocks', institution: 'TD Ameritrade', purchasePrice: 485.00, quantity: 25, currency: 'USD' },
      { name: 'Ethereum', type: 'crypto', institution: 'Kraken', purchasePrice: 2200.00, quantity: 3, currency: 'USD' },
    ],
  },
  {
    email: 'sarah.johnson@example.com',
    name: 'Sarah Johnson',
    masterPassword: 'SarahJ#2024!',
    plan: 'free',
    passwords: [
      { name: 'Facebook', url: 'https://facebook.com', username: 'sarah.johnson@gmail.com', password: 'FBSocial#123', category: 'Social Media' },
      { name: 'Instagram', url: 'https://instagram.com', username: '@sarahjohnson', password: 'InstaPhoto!456', category: 'Social Media' },
      { name: 'Pinterest', url: 'https://pinterest.com', username: 'sarahj_pins', password: 'PinBoard#789', category: 'Social Media' },
    ],
    subscriptions: [
      { name: 'YouTube Premium', plan: 'Individual', cost: 13.99, currency: 'USD', billingCycle: 'monthly', category: 'Streaming', isActive: true },
      { name: 'Peloton', plan: 'Digital', cost: 12.99, currency: 'USD', billingCycle: 'monthly', category: 'Fitness', isActive: true },
    ],
    notes: [
      { title: 'Workout Schedule', content: '# Weekly Workout Plan\n\n- Monday: Strength\n- Tuesday: Cardio\n- Wednesday: Rest\n- Thursday: HIIT\n- Friday: Yoga', notebook: 'Personal', tags: ['fitness', 'health'], isPinned: true },
    ],
    expenses: [
      { title: 'Gym Membership', amount: 45.00, currency: 'USD', category: 'Personal Care', tags: ['fitness'], isRecurring: true },
      { title: 'Organic Groceries', amount: 178.50, currency: 'USD', category: 'Food & Dining', tags: ['groceries', 'organic'], isRecurring: false },
    ],
    reminders: [
      { title: 'Book Yoga Retreat', description: 'Book weekend yoga retreat in Vermont', priority: 'low', category: 'Personal', daysFromNow: 45 },
    ],
    investments: [],
  },
  {
    email: 'david.brown@example.com',
    name: 'David Brown',
    masterPassword: 'DaveBrown!567',
    plan: 'premium',
    passwords: [
      { name: 'Schwab', url: 'https://schwab.com', username: 'dbrown_invest', password: 'SchwabTrade#1', category: 'Finance' },
      { name: 'Robinhood', url: 'https://robinhood.com', username: 'david.brown@gmail.com', password: 'RobinInvest!99', category: 'Finance' },
      { name: 'TurboTax', url: 'https://turbotax.com', username: 'dbrown', password: 'TaxTime#2024', category: 'Finance' },
      { name: 'Mint', url: 'https://mint.com', username: 'david.brown', password: 'MintBudget@1', category: 'Finance' },
      { name: 'Zillow', url: 'https://zillow.com', username: 'dbrown_realestate', password: 'ZillowHome#22', category: 'Personal' },
    ],
    subscriptions: [
      { name: 'Wall Street Journal', plan: 'Digital', cost: 39.99, currency: 'USD', billingCycle: 'monthly', category: 'News', isActive: true },
      { name: 'Bloomberg', plan: 'Professional', cost: 34.99, currency: 'USD', billingCycle: 'monthly', category: 'News', isActive: true },
      { name: 'Seeking Alpha', plan: 'Premium', cost: 19.99, currency: 'USD', billingCycle: 'monthly', category: 'Finance', isActive: true },
    ],
    notes: [
      { title: 'Investment Strategy 2025', content: '# Portfolio Strategy\n\n## Asset Allocation\n- 60% Stocks\n- 25% Bonds\n- 15% Alternative\n\n## Goals\n- Retirement fund: $2M by 2040', notebook: 'Finance', tags: ['investing', 'strategy'], isPinned: true },
      { title: 'Tax Deductions Tracker', content: '## 2024 Deductions\n\n1. Home office: $1,500\n2. Charitable donations: $3,000\n3. Investment losses: $2,500', notebook: 'Finance', tags: ['taxes', 'deductions'], isPinned: false },
    ],
    expenses: [
      { title: 'Stock Trading Fees', amount: 25.00, currency: 'USD', category: 'Investments', tags: ['trading'], isRecurring: true },
      { title: 'Financial Advisor', amount: 250.00, currency: 'USD', category: 'Business', tags: ['advisor'], isRecurring: true },
    ],
    reminders: [
      { title: 'Quarterly Portfolio Review', description: 'Review and rebalance investment portfolio', priority: 'high', category: 'Bills & Payments', daysFromNow: 15 },
      { title: 'IRA Contribution', description: 'Max out IRA contribution before deadline', priority: 'urgent', category: 'Bills & Payments', daysFromNow: 90 },
    ],
    investments: [
      { name: 'Vanguard Total Stock', type: 'mutual_fund', institution: 'Vanguard', purchasePrice: 225.00, quantity: 100, currency: 'USD' },
      { name: 'Microsoft Corp.', type: 'stocks', institution: 'Schwab', purchasePrice: 375.00, quantity: 40, currency: 'USD' },
      { name: 'Treasury Bonds', type: 'bonds', institution: 'Treasury Direct', purchasePrice: 1000.00, quantity: 10, currency: 'USD' },
      { name: 'Real Estate REIT', type: 'real_estate', institution: 'Fidelity', purchasePrice: 85.00, quantity: 50, currency: 'USD' },
    ],
  },
  {
    email: 'lisa.anderson@example.com',
    name: 'Lisa Anderson',
    masterPassword: 'LisaA#Secure1',
    plan: 'premium',
    passwords: [
      { name: 'Workday', url: 'https://workday.com', username: 'landerson@corp.com', password: 'WorkdayHR#2024', category: 'Work' },
      { name: 'Salesforce', url: 'https://salesforce.com', username: 'lisa.anderson@sales.com', password: 'SalesForce!CRM', category: 'Work' },
      { name: 'HubSpot', url: 'https://hubspot.com', username: 'landerson', password: 'HubSpotMkt#1', category: 'Work' },
    ],
    subscriptions: [
      { name: 'Salesforce', plan: 'Enterprise', cost: 150.00, currency: 'USD', billingCycle: 'monthly', category: 'Software', isActive: true },
      { name: 'HubSpot', plan: 'Professional', cost: 800.00, currency: 'USD', billingCycle: 'monthly', category: 'Software', isActive: true },
      { name: 'Zoom', plan: 'Business', cost: 19.99, currency: 'USD', billingCycle: 'monthly', category: 'Software', isActive: true },
    ],
    notes: [
      { title: 'Sales Pipeline Q4', content: '# Q4 Sales Pipeline\n\n| Deal | Value | Stage |\n|------|-------|-------|\n| Acme Corp | $50K | Negotiation |\n| TechStart | $25K | Proposal |', notebook: 'Sales', tags: ['pipeline', 'q4'], isPinned: true },
    ],
    expenses: [
      { title: 'Client Dinner', amount: 285.00, currency: 'USD', category: 'Business', tags: ['entertainment', 'clients'], isRecurring: false },
      { title: 'Conference Registration', amount: 599.00, currency: 'USD', category: 'Education', tags: ['conference'], isRecurring: false },
    ],
    reminders: [
      { title: 'Client Follow-up', description: 'Follow up with Acme Corp on proposal', priority: 'high', category: 'Work', daysFromNow: 2 },
    ],
    investments: [
      { name: 'Company Stock Options', type: 'stocks', institution: 'E*Trade', purchasePrice: 45.00, quantity: 500, currency: 'USD' },
    ],
  },
  {
    email: 'james.taylor@example.com',
    name: 'James Taylor',
    masterPassword: 'JamesT!Pass99',
    plan: 'free',
    passwords: [
      { name: 'Reddit', url: 'https://reddit.com', username: 'jamestaylor_reddit', password: 'RedditUser#1', category: 'Social Media' },
      { name: 'Discord', url: 'https://discord.com', username: 'JamesT#1234', password: 'DiscordChat!99', category: 'Social Media' },
    ],
    subscriptions: [
      { name: 'Xbox Game Pass', plan: 'Ultimate', cost: 16.99, currency: 'USD', billingCycle: 'monthly', category: 'Gaming', isActive: true },
      { name: 'Twitch', plan: 'Turbo', cost: 8.99, currency: 'USD', billingCycle: 'monthly', category: 'Streaming', isActive: true },
    ],
    notes: [
      { title: 'Gaming Wishlist', content: '# Games to Play\n\n- [ ] Elden Ring DLC\n- [ ] Final Fantasy XVI\n- [x] Baldurs Gate 3', notebook: 'Personal', tags: ['gaming', 'wishlist'], isPinned: false },
    ],
    expenses: [
      { title: 'Gaming Chair', amount: 299.99, currency: 'USD', category: 'Shopping', tags: ['gaming', 'furniture'], isRecurring: false },
    ],
    reminders: [
      { title: 'Game Release', description: 'GTA 6 release date', priority: 'low', category: 'Personal', daysFromNow: 180 },
    ],
    investments: [],
  },
  {
    email: 'jennifer.martinez@example.com',
    name: 'Jennifer Martinez',
    masterPassword: 'JenM#Secure2024',
    plan: 'premium',
    passwords: [
      { name: 'Etsy Shop', url: 'https://etsy.com', username: 'jmartinez_crafts', password: 'EtsyCraft!Shop1', category: 'Work' },
      { name: 'Square', url: 'https://squareup.com', username: 'jennifer@crafts.com', password: 'SquarePay#2024', category: 'Finance' },
      { name: 'Mailchimp', url: 'https://mailchimp.com', username: 'jmartinez', password: 'MailChimp!Email', category: 'Work' },
      { name: 'Quickbooks', url: 'https://quickbooks.com', username: 'jennifer.martinez', password: 'QuickBooks#Biz1', category: 'Finance' },
    ],
    subscriptions: [
      { name: 'Etsy Plus', plan: 'Plus', cost: 10.00, currency: 'USD', billingCycle: 'monthly', category: 'Software', isActive: true },
      { name: 'Mailchimp', plan: 'Standard', cost: 20.00, currency: 'USD', billingCycle: 'monthly', category: 'Software', isActive: true },
      { name: 'Quickbooks', plan: 'Simple Start', cost: 30.00, currency: 'USD', billingCycle: 'monthly', category: 'Software', isActive: true },
    ],
    notes: [
      { title: 'Product Ideas', content: '# New Product Line\n\n## Spring Collection\n- Floral patterns\n- Pastel colors\n- Eco-friendly materials', notebook: 'Business', tags: ['products', 'ideas'], isPinned: true },
      { title: 'Pricing Guide', content: '## Pricing Formula\n\nMaterials + Labor + Overhead + Profit Margin (30%)', notebook: 'Business', tags: ['pricing'], isPinned: false },
    ],
    expenses: [
      { title: 'Craft Supplies', amount: 450.00, currency: 'USD', category: 'Business', tags: ['supplies', 'materials'], isRecurring: false },
      { title: 'Etsy Fees', amount: 85.00, currency: 'USD', category: 'Business', tags: ['fees', 'platform'], isRecurring: true },
    ],
    reminders: [
      { title: 'Craft Fair Registration', description: 'Register for spring craft fair', priority: 'medium', category: 'Work', daysFromNow: 60 },
    ],
    investments: [
      { name: 'Business Savings', type: 'fixed_deposit', institution: 'Chase', purchasePrice: 15000.00, quantity: 1, currency: 'USD' },
    ],
  },
  {
    email: 'robert.garcia@example.com',
    name: 'Robert Garcia',
    masterPassword: 'RobG#Pass2024!',
    plan: 'lifetime',
    passwords: [
      { name: 'Duolingo', url: 'https://duolingo.com', username: 'robertg', password: 'DuoLingo!Learn1', category: 'Education' },
      { name: 'Coursera', url: 'https://coursera.org', username: 'robert.garcia@gmail.com', password: 'Coursera#Study', category: 'Education' },
      { name: 'LinkedIn Learning', url: 'https://linkedin.com/learning', username: 'rgarcia', password: 'LinkedLearn!99', category: 'Education' },
      { name: 'Udemy', url: 'https://udemy.com', username: 'robert_garcia', password: 'UdemyCourse#1', category: 'Education' },
    ],
    subscriptions: [
      { name: 'Duolingo Plus', plan: 'Family', cost: 12.99, currency: 'USD', billingCycle: 'monthly', category: 'Education', isActive: true },
      { name: 'Coursera Plus', plan: 'Annual', cost: 399.00, currency: 'USD', billingCycle: 'yearly', category: 'Education', isActive: true },
      { name: 'MasterClass', plan: 'Annual', cost: 180.00, currency: 'USD', billingCycle: 'yearly', category: 'Education', isActive: true },
    ],
    notes: [
      { title: 'Spanish Vocabulary', content: '# Spanish Words\n\n- Casa = House\n- Perro = Dog\n- Libro = Book\n- Agua = Water', notebook: 'Languages', tags: ['spanish', 'vocabulary'], isPinned: true },
      { title: 'Course Progress', content: '## Completed Courses\n\n1. Machine Learning - Stanford\n2. Data Science - IBM\n3. Python for Everyone', notebook: 'Education', tags: ['courses', 'progress'], isPinned: false },
    ],
    expenses: [
      { title: 'Online Course', amount: 49.99, currency: 'USD', category: 'Education', tags: ['course', 'udemy'], isRecurring: false },
      { title: 'Books', amount: 75.00, currency: 'USD', category: 'Education', tags: ['books', 'learning'], isRecurring: false },
    ],
    reminders: [
      { title: 'Complete Spanish Module', description: 'Finish Duolingo Unit 5', priority: 'medium', category: 'Education', daysFromNow: 7 },
      { title: 'Certificate Exam', description: 'Take AWS certification exam', priority: 'high', category: 'Education', daysFromNow: 30 },
    ],
    investments: [
      { name: 'Education Savings', type: 'fixed_deposit', institution: 'Ally Bank', purchasePrice: 5000.00, quantity: 1, currency: 'USD' },
    ],
  },
  {
    email: 'emily.davis@example.com',
    name: 'Emily Davis',
    masterPassword: 'EmilyD#2024Safe',
    plan: 'premium',
    passwords: [
      { name: 'Airbnb', url: 'https://airbnb.com', username: 'emily.davis@gmail.com', password: 'AirbnbTravel!1', category: 'Travel' },
      { name: 'Delta Airlines', url: 'https://delta.com', username: 'emily_davis', password: 'DeltaFly#2024', category: 'Travel' },
      { name: 'Marriott', url: 'https://marriott.com', username: 'edavis_rewards', password: 'MarriottStay!99', category: 'Travel' },
      { name: 'Expedia', url: 'https://expedia.com', username: 'emily.davis', password: 'ExpediaBook#1', category: 'Travel' },
    ],
    subscriptions: [
      { name: 'Clear', plan: 'Plus', cost: 189.00, currency: 'USD', billingCycle: 'yearly', category: 'Travel', isActive: true },
      { name: 'Global Entry', plan: 'Standard', cost: 100.00, currency: 'USD', billingCycle: 'yearly', category: 'Travel', isActive: true },
    ],
    notes: [
      { title: 'Travel Bucket List', content: '# Places to Visit\n\n## Europe\n- [ ] Paris, France\n- [ ] Rome, Italy\n- [x] Barcelona, Spain\n\n## Asia\n- [ ] Tokyo, Japan\n- [ ] Bangkok, Thailand', notebook: 'Travel', tags: ['bucketlist', 'travel'], isPinned: true },
      { title: 'Packing Checklist', content: '## Essential Items\n\n- [ ] Passport\n- [ ] Phone charger\n- [ ] Medications\n- [ ] Travel adapter', notebook: 'Travel', tags: ['packing', 'checklist'], isPinned: false },
    ],
    expenses: [
      { title: 'Flight to Paris', amount: 850.00, currency: 'USD', category: 'Travel', tags: ['flight', 'vacation'], isRecurring: false },
      { title: 'Travel Insurance', amount: 125.00, currency: 'USD', category: 'Travel', tags: ['insurance'], isRecurring: false },
    ],
    reminders: [
      { title: 'Book Hotel', description: 'Book hotel for Italy trip', priority: 'high', category: 'Travel', daysFromNow: 14 },
      { title: 'Renew Passport', description: 'Passport expires in 6 months', priority: 'medium', category: 'Personal', daysFromNow: 120 },
    ],
    investments: [
      { name: 'Travel Fund', type: 'fixed_deposit', institution: 'Capital One', purchasePrice: 8000.00, quantity: 1, currency: 'USD' },
    ],
  },
  {
    email: 'william.miller@example.com',
    name: 'William Miller',
    masterPassword: 'WillM#Secure99',
    plan: 'free',
    passwords: [
      { name: 'Indeed', url: 'https://indeed.com', username: 'william.miller@gmail.com', password: 'IndeedJob#1', category: 'Work' },
      { name: 'Glassdoor', url: 'https://glassdoor.com', username: 'wmiller', password: 'GlassDoor!Jobs', category: 'Work' },
    ],
    subscriptions: [
      { name: 'LinkedIn Premium', plan: 'Career', cost: 29.99, currency: 'USD', billingCycle: 'monthly', category: 'Work', isActive: true },
    ],
    notes: [
      { title: 'Job Applications', content: '# Applications Sent\n\n| Company | Position | Status |\n|---------|----------|--------|\n| Google | SWE | Applied |\n| Meta | PM | Interview |', notebook: 'Job Search', tags: ['jobs', 'applications'], isPinned: true },
    ],
    expenses: [
      { title: 'Resume Service', amount: 150.00, currency: 'USD', category: 'Business', tags: ['resume', 'career'], isRecurring: false },
    ],
    reminders: [
      { title: 'Interview Prep', description: 'Prepare for Meta interview', priority: 'urgent', category: 'Work', daysFromNow: 3 },
    ],
    investments: [],
  },
  {
    email: 'sophia.lee@example.com',
    name: 'Sophia Lee',
    masterPassword: 'SophiaL#2024!',
    plan: 'premium',
    passwords: [
      { name: 'Notion', url: 'https://notion.so', username: 'sophia.lee@gmail.com', password: 'NotionWork#1', category: 'Productivity' },
      { name: 'Asana', url: 'https://asana.com', username: 'slee@startup.com', password: 'AsanaTask!99', category: 'Work' },
      { name: 'Monday.com', url: 'https://monday.com', username: 'sophia', password: 'MondayPM#2024', category: 'Work' },
      { name: 'Miro', url: 'https://miro.com', username: 'sophia.lee', password: 'MiroBoard!1', category: 'Work' },
    ],
    subscriptions: [
      { name: 'Notion', plan: 'Team', cost: 10.00, currency: 'USD', billingCycle: 'monthly', category: 'Productivity', isActive: true },
      { name: 'Asana', plan: 'Premium', cost: 13.49, currency: 'USD', billingCycle: 'monthly', category: 'Productivity', isActive: true },
      { name: 'Miro', plan: 'Team', cost: 10.00, currency: 'USD', billingCycle: 'monthly', category: 'Productivity', isActive: true },
    ],
    notes: [
      { title: 'Sprint Planning', content: '# Sprint 24 Goals\n\n## Priority 1\n- User authentication\n- Dashboard redesign\n\n## Priority 2\n- Analytics integration', notebook: 'Work', tags: ['sprint', 'planning'], isPinned: true },
    ],
    expenses: [
      { title: 'Coworking Space', amount: 350.00, currency: 'USD', category: 'Business', tags: ['office', 'coworking'], isRecurring: true },
    ],
    reminders: [
      { title: 'Sprint Review', description: 'Present sprint deliverables', priority: 'high', category: 'Work', daysFromNow: 7 },
    ],
    investments: [
      { name: 'Amazon Stock', type: 'stocks', institution: 'Webull', purchasePrice: 185.00, quantity: 30, currency: 'USD' },
    ],
  },
  {
    email: 'daniel.kim@example.com',
    name: 'Daniel Kim',
    masterPassword: 'DanielK!Pass123',
    plan: 'lifetime',
    passwords: [
      { name: 'Binance', url: 'https://binance.com', username: 'dkim_crypto', password: 'BinanceTrade#1', category: 'Finance' },
      { name: 'Coinbase', url: 'https://coinbase.com', username: 'daniel.kim@gmail.com', password: 'CoinBase!Secure', category: 'Finance' },
      { name: 'Kraken', url: 'https://kraken.com', username: 'danielk', password: 'KrakenExchange#99', category: 'Finance' },
      { name: 'MetaMask', url: 'https://metamask.io', username: 'dkim_wallet', password: 'MetaMask!Web3', category: 'Finance' },
    ],
    subscriptions: [
      { name: 'TradingView', plan: 'Pro', cost: 14.95, currency: 'USD', billingCycle: 'monthly', category: 'Finance', isActive: true },
      { name: 'CoinGecko', plan: 'Premium', cost: 9.99, currency: 'USD', billingCycle: 'monthly', category: 'Finance', isActive: true },
    ],
    notes: [
      { title: 'Crypto Portfolio', content: '# Holdings\n\n| Coin | Amount | Entry Price |\n|------|--------|-------------|\n| BTC | 1.5 | $35,000 |\n| ETH | 10 | $2,100 |\n| SOL | 50 | $95 |', notebook: 'Crypto', tags: ['portfolio', 'crypto'], isPinned: true },
      { title: 'DeFi Strategies', content: '## Yield Farming\n\n- AAVE: 5% APY\n- Compound: 4.5% APY\n- Uniswap LP: Variable', notebook: 'Crypto', tags: ['defi', 'yield'], isPinned: false },
    ],
    expenses: [
      { title: 'Trading Fees', amount: 150.00, currency: 'USD', category: 'Investments', tags: ['crypto', 'fees'], isRecurring: true },
      { title: 'Hardware Wallet', amount: 149.00, currency: 'USD', category: 'Shopping', tags: ['crypto', 'security'], isRecurring: false },
    ],
    reminders: [
      { title: 'Token Unlock', description: 'Check SOL staking rewards', priority: 'medium', category: 'Bills & Payments', daysFromNow: 14 },
    ],
    investments: [
      { name: 'Bitcoin', type: 'crypto', institution: 'Coinbase', purchasePrice: 35000.00, quantity: 1.5, currency: 'USD' },
      { name: 'Ethereum', type: 'crypto', institution: 'Coinbase', purchasePrice: 2100.00, quantity: 10, currency: 'USD' },
      { name: 'Solana', type: 'crypto', institution: 'Binance', purchasePrice: 95.00, quantity: 50, currency: 'USD' },
    ],
  },
  {
    email: 'olivia.white@example.com',
    name: 'Olivia White',
    masterPassword: 'OliviaW#Secure1',
    plan: 'premium',
    passwords: [
      { name: 'Headspace', url: 'https://headspace.com', username: 'olivia.white@gmail.com', password: 'Headspace!Mind1', category: 'Personal' },
      { name: 'MyFitnessPal', url: 'https://myfitnesspal.com', username: 'oliviawhite', password: 'FitnessPal#2024', category: 'Personal' },
      { name: 'Noom', url: 'https://noom.com', username: 'owhite', password: 'NoomHealth!99', category: 'Personal' },
    ],
    subscriptions: [
      { name: 'Headspace', plan: 'Annual', cost: 69.99, currency: 'USD', billingCycle: 'yearly', category: 'Fitness', isActive: true },
      { name: 'Noom', plan: 'Monthly', cost: 59.00, currency: 'USD', billingCycle: 'monthly', category: 'Fitness', isActive: true },
      { name: 'Calm', plan: 'Annual', cost: 69.99, currency: 'USD', billingCycle: 'yearly', category: 'Fitness', isActive: true },
    ],
    notes: [
      { title: 'Meal Plan', content: '# Weekly Meal Plan\n\n## Monday\n- Breakfast: Oatmeal\n- Lunch: Salad\n- Dinner: Grilled salmon', notebook: 'Health', tags: ['meals', 'nutrition'], isPinned: true },
      { title: 'Meditation Log', content: '## December Progress\n\n- Sessions: 25/31\n- Avg duration: 15 min\n- Streak: 12 days', notebook: 'Health', tags: ['meditation', 'mindfulness'], isPinned: false },
    ],
    expenses: [
      { title: 'Organic Meal Delivery', amount: 200.00, currency: 'USD', category: 'Food & Dining', tags: ['meals', 'healthy'], isRecurring: true },
      { title: 'Yoga Mat', amount: 45.00, currency: 'USD', category: 'Personal Care', tags: ['yoga', 'fitness'], isRecurring: false },
    ],
    reminders: [
      { title: 'Health Checkup', description: 'Annual wellness exam', priority: 'medium', category: 'Healthcare', daysFromNow: 30 },
    ],
    investments: [
      { name: 'Health Savings', type: 'fixed_deposit', institution: 'Fidelity', purchasePrice: 3000.00, quantity: 1, currency: 'USD' },
    ],
  },
  {
    email: 'alex.muller@example.com',
    name: 'Alexander Müller',
    masterPassword: 'AlexM#Germany24',
    plan: 'premium',
    passwords: [
      { name: 'Deutsche Bank', url: 'https://deutsche-bank.de', username: 'amuller_db', password: 'DeutscheBank#Secure1', category: 'Finance' },
      { name: 'SAP', url: 'https://sap.com', username: 'alex.muller@corp.de', password: 'SAPWork!2024', category: 'Work' },
      { name: 'Xing', url: 'https://xing.com', username: 'alexander_muller', password: 'XingPro#99', category: 'Work' },
      { name: 'Spotify DE', url: 'https://spotify.com', username: 'alexmuller', password: 'SpotifyMusic!1', category: 'Entertainment' },
    ],
    subscriptions: [
      { name: 'Spotify', plan: 'Premium', cost: 9.99, currency: 'EUR', billingCycle: 'monthly', category: 'Music', isActive: true },
      { name: 'ZEIT Online', plan: 'Digital', cost: 4.99, currency: 'EUR', billingCycle: 'monthly', category: 'News', isActive: true },
      { name: 'Handelsblatt', plan: 'Premium', cost: 14.99, currency: 'EUR', billingCycle: 'monthly', category: 'News', isActive: true },
    ],
    notes: [
      { title: 'German Tax Notes', content: '# Steuerliche Notizen\n\n## Wichtige Termine\n- Steuererklärung: 31. Juli\n- Vorauszahlung: Vierteljährlich', notebook: 'Finance', tags: ['taxes', 'germany'], isPinned: true },
    ],
    expenses: [
      { title: 'Krankenversicherung', amount: 450.00, currency: 'EUR', category: 'Healthcare', tags: ['insurance', 'health'], isRecurring: true },
      { title: 'Bahncard', amount: 234.00, currency: 'EUR', category: 'Transportation', tags: ['train', 'travel'], isRecurring: true },
    ],
    reminders: [
      { title: 'Steuererklärung', description: 'Submit annual tax return', priority: 'high', category: 'Bills & Payments', daysFromNow: 45 },
    ],
    investments: [
      { name: 'DAX ETF', type: 'mutual_fund', institution: 'Trade Republic', purchasePrice: 145.00, quantity: 40, currency: 'EUR' },
      { name: 'Deutsche Telekom', type: 'stocks', institution: 'Comdirect', purchasePrice: 22.50, quantity: 100, currency: 'EUR' },
    ],
  },
];

// Export function to get user count
export const getUserCount = () => seedUsers.length;

// Export function to get total data counts
export const getDataSummary = () => {
  let totalPasswords = 0;
  let totalSubscriptions = 0;
  let totalNotes = 0;
  let totalExpenses = 0;
  let totalReminders = 0;
  let totalInvestments = 0;

  seedUsers.forEach(user => {
    totalPasswords += user.passwords.length;
    totalSubscriptions += user.subscriptions.length;
    totalNotes += user.notes.length;
    totalExpenses += user.expenses.length;
    totalReminders += user.reminders.length;
    totalInvestments += user.investments.length;
  });

  return {
    users: seedUsers.length,
    passwords: totalPasswords,
    subscriptions: totalSubscriptions,
    notes: totalNotes,
    expenses: totalExpenses,
    reminders: totalReminders,
    investments: totalInvestments,
  };
};

console.log('Seed Data Summary:', getDataSummary());
