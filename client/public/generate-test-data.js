// Comprehensive Data Generator for Import Testing
// Generates realistic data for all sections except bank and documents

const generatePasswords = (count = 50) => {
  const websites = [
    'google.com', 'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
    'github.com', 'stackoverflow.com', 'amazon.com', 'netflix.com', 'spotify.com',
    'microsoft.com', 'apple.com', 'dropbox.com', 'slack.com', 'zoom.us',
    'paypal.com', 'stripe.com', 'shopify.com', 'wordpress.com', 'medium.com',
    'reddit.com', 'youtube.com', 'twitch.tv', 'discord.com', 'telegram.org',
    'whatsapp.com', 'signal.org', 'protonmail.com', 'tutanota.com', 'bitwarden.com',
    '1password.com', 'lastpass.com', 'dashlane.com', 'keeper.com', 'roboform.com',
    'bankofamerica.com', 'chase.com', 'wellsfargo.com', 'citibank.com', 'usbank.com',
    'capitalone.com', 'discover.com', 'amex.com', 'visa.com', 'mastercard.com',
    'uber.com', 'lyft.com', 'airbnb.com', 'booking.com', 'expedia.com'
  ];

  const usernames = [
    'john.doe', 'jane.smith', 'mike.wilson', 'sarah.johnson', 'david.brown',
    'lisa.garcia', 'robert.miller', 'jennifer.davis', 'william.rodriguez', 'mary.martinez',
    'james.hernandez', 'patricia.lopez', 'richard.gonzalez', 'linda.clark', 'charles.lewis',
    'barbara.lee', 'joseph.walker', 'elizabeth.hall', 'thomas.allen', 'jessica.young',
    'christopher.king', 'sarah.wright', 'daniel.scott', 'nancy.torres', 'matthew.nguyen',
    'karen.hill', 'anthony.flores', 'betty.green', 'mark.adams', 'helen.nelson'
  ];

  const passwords = [
    'MySecure123!', 'Password2024#', 'SecurePass456$', 'MyVault789@', 'StrongPass123%',
    'SafeKey2024^', 'ProtectMe456&', 'VaultPass789*', 'SecureLogin123+', 'MyPassword456=',
    'SafeVault789-', 'ProtectKey123_', 'SecureData456.', 'MyAccount789,', 'VaultLogin123;',
    'SafePass456:', 'ProtectMe789!', 'SecureKey123@', 'MyVault456#', 'SafeLogin789$',
    'ProtectData123%', 'SecureAccount456^', 'MyVaultPass789&', 'SafeKeyLogin123*', 'ProtectVault456+',
    'SecureMe789=', 'MySafePass123-', 'VaultProtect456_', 'SafeAccount789.', 'ProtectLogin123,',
    'SecureVault456;', 'MySafeKey789:', 'VaultData123!', 'SafeProtect456@', 'MyLogin789#',
    'SecureAccount123$', 'VaultSafe456%', 'ProtectLogin789^', 'MySecureData123&', 'SafeVault456*',
    'ProtectAccount789+', 'SecureLogin123=', 'MyVaultKey456-', 'SafeProtect789_', 'VaultSecure123.',
    'MyAccount456,', 'SafeLogin789;', 'ProtectVault123:', 'SecureMe456!', 'MySafeAccount789@'
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `pwd_${i + 1}`,
    name: websites[i % websites.length],
    username: usernames[i % usernames.length],
    password: passwords[i % passwords.length],
    url: `https://${websites[i % websites.length]}`,
    notes: `Account for ${websites[i % websites.length]}`,
    tags: ['work', 'personal', 'social', 'finance', 'entertainment'][i % 5],
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }));
};

const generateSubscriptions = (count = 30) => {
  const services = [
    { name: 'Netflix', category: 'entertainment', price: 15.99, currency: 'USD' },
    { name: 'Spotify Premium', category: 'entertainment', price: 9.99, currency: 'USD' },
    { name: 'Adobe Creative Cloud', category: 'software', price: 52.99, currency: 'USD' },
    { name: 'Microsoft 365', category: 'software', price: 6.99, currency: 'USD' },
    { name: 'Amazon Prime', category: 'shopping', price: 14.99, currency: 'USD' },
    { name: 'YouTube Premium', category: 'entertainment', price: 11.99, currency: 'USD' },
    { name: 'Disney+', category: 'entertainment', price: 7.99, currency: 'USD' },
    { name: 'HBO Max', category: 'entertainment', price: 14.99, currency: 'USD' },
    { name: 'Apple Music', category: 'entertainment', price: 9.99, currency: 'USD' },
    { name: 'Dropbox Plus', category: 'storage', price: 9.99, currency: 'USD' },
    { name: 'Google One', category: 'storage', price: 1.99, currency: 'USD' },
    { name: 'iCloud+', category: 'storage', price: 0.99, currency: 'USD' },
    { name: 'Slack Pro', category: 'productivity', price: 6.67, currency: 'USD' },
    { name: 'Zoom Pro', category: 'productivity', price: 14.99, currency: 'USD' },
    { name: 'Canva Pro', category: 'design', price: 12.99, currency: 'USD' },
    { name: 'Figma Professional', category: 'design', price: 12.00, currency: 'USD' },
    { name: 'Notion Pro', category: 'productivity', price: 8.00, currency: 'USD' },
    { name: 'Evernote Premium', category: 'productivity', price: 7.99, currency: 'USD' },
    { name: 'Grammarly Premium', category: 'productivity', price: 12.00, currency: 'USD' },
    { name: 'LastPass Premium', category: 'security', price: 3.00, currency: 'USD' },
    { name: '1Password', category: 'security', price: 2.99, currency: 'USD' },
    { name: 'Dashlane Premium', category: 'security', price: 4.99, currency: 'USD' },
    { name: 'NordVPN', category: 'security', price: 3.71, currency: 'USD' },
    { name: 'ExpressVPN', category: 'security', price: 8.32, currency: 'USD' },
    { name: 'Surfshark', category: 'security', price: 2.49, currency: 'USD' },
    { name: 'Headspace', category: 'wellness', price: 12.99, currency: 'USD' },
    { name: 'Calm', category: 'wellness', price: 14.99, currency: 'USD' },
    { name: 'MyFitnessPal Premium', category: 'fitness', price: 9.99, currency: 'USD' },
    { name: 'Strava Premium', category: 'fitness', price: 5.00, currency: 'USD' },
    { name: 'Peloton App', category: 'fitness', price: 12.99, currency: 'USD' }
  ];

  const billingCycles = ['monthly', 'yearly', 'quarterly'];
  const statuses = ['active', 'cancelled', 'paused', 'expired'];

  return Array.from({ length: count }, (_, i) => {
    const service = services[i % services.length];
    const startDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
    const nextBilling = new Date(startDate);
    nextBilling.setMonth(nextBilling.getMonth() + (service.name.includes('yearly') ? 12 : 1));
    
    return {
      id: `sub_${i + 1}`,
      name: service.name,
      category: service.category,
      price: service.price,
      currency: service.currency,
      billingCycle: billingCycles[i % billingCycles.length],
      status: statuses[i % statuses.length],
      startDate: startDate.toISOString(),
      nextBillingDate: nextBilling.toISOString(),
      notes: `Subscription for ${service.name}`,
      tags: [service.category, 'subscription'],
      createdAt: startDate.toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
};

const generateNotes = (count = 40) => {
  const noteTypes = ['text', 'markdown', 'checklist', 'code'];
  const categories = ['work', 'personal', 'ideas', 'meetings', 'projects', 'learning'];

  const sampleNotes = [
    {
      title: 'Project Planning Meeting',
      content: '# Project Planning Meeting\n\n## Agenda\n- Review current progress\n- Discuss next milestones\n- Assign tasks\n\n## Action Items\n- [ ] Update project timeline\n- [ ] Review budget allocation\n- [ ] Schedule next meeting',
      type: 'markdown'
    },
    {
      title: 'Shopping List',
      content: '- Milk\n- Bread\n- Eggs\n- Apples\n- Chicken\n- Rice\n- Vegetables\n- Coffee',
      type: 'text'
    },
    {
      title: 'Code Snippet - API Call',
      content: '```javascript\nconst fetchUserData = async (userId) => {\n  try {\n    const response = await fetch(`/api/users/${userId}`);\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error(\'Error fetching user:\', error);\n  }\n};\n```',
      type: 'code'
    },
    {
      title: 'Weekly Tasks',
      content: '- [ ] Complete project proposal\n- [ ] Review team feedback\n- [ ] Update documentation\n- [ ] Schedule client meeting\n- [ ] Prepare presentation\n- [ ] Submit expense report',
      type: 'checklist'
    },
    {
      title: 'Learning Notes - React Hooks',
      content: '# React Hooks Notes\n\n## useState\nUsed for managing component state.\n\n## useEffect\nHandles side effects in functional components.\n\n## useCallback\nMemoizes functions to prevent unnecessary re-renders.\n\n## useMemo\nMemoizes computed values.',
      type: 'markdown'
    }
  ];

  return Array.from({ length: count }, (_, i) => {
    const note = sampleNotes[i % sampleNotes.length];
    return {
      id: `note_${i + 1}`,
      title: `${note.title} ${i + 1}`,
      content: note.content,
      type: note.type,
      category: categories[i % categories.length],
      tags: [categories[i % categories.length], 'note'],
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
};

const generateExpenses = (count = 60) => {
  const categories = [
    'food', 'transportation', 'entertainment', 'shopping', 'utilities',
    'healthcare', 'education', 'travel', 'subscriptions', 'other'
  ];

  const merchants = [
    'Walmart', 'Target', 'Amazon', 'Starbucks', 'McDonald\'s', 'Subway',
    'Uber', 'Lyft', 'Shell', 'Exxon', 'BP', 'Chevron',
    'Netflix', 'Spotify', 'Apple', 'Google', 'Microsoft',
    'CVS', 'Walgreens', 'Rite Aid', 'Costco', 'Sam\'s Club',
    'Home Depot', 'Lowe\'s', 'Best Buy', 'GameStop', 'Barnes & Noble',
    'Airbnb', 'Booking.com', 'Expedia', 'Delta', 'American Airlines',
    'Whole Foods', 'Trader Joe\'s', 'Safeway', 'Kroger', 'Publix'
  ];

  const descriptions = [
    'Grocery shopping', 'Gas station', 'Coffee break', 'Lunch', 'Dinner',
    'Online purchase', 'Ride share', 'Movie tickets', 'Concert tickets',
    'Book purchase', 'Software license', 'Phone bill', 'Internet bill',
    'Electricity bill', 'Water bill', 'Insurance payment', 'Doctor visit',
    'Pharmacy', 'Gym membership', 'Course enrollment', 'Flight booking',
    'Hotel stay', 'Car rental', 'Restaurant meal', 'Fast food',
    'Clothing purchase', 'Electronics', 'Home improvement', 'Garden supplies'
  ];

  return Array.from({ length: count }, (_, i) => {
    const amount = Math.round((Math.random() * 500 + 5) * 100) / 100;
    const date = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
    
    return {
      id: `exp_${i + 1}`,
      amount: amount,
      currency: 'USD',
      category: categories[i % categories.length],
      description: descriptions[i % descriptions.length],
      merchant: merchants[i % merchants.length],
      date: date.toISOString(),
      tags: [categories[i % categories.length], 'expense'],
      createdAt: date.toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
};

const generateInvestments = (count = 25) => {
  const types = ['stocks', 'mutual_fund', 'crypto', 'bonds', 'etf', 'real_estate'];
  const institutions = ['Vanguard', 'Fidelity', 'Charles Schwab', 'TD Ameritrade', 'Robinhood', 'Coinbase', 'Binance'];
  
  const stockSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'INTC'];
  const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM'];
  
  const mutualFunds = [
    'VTSAX', 'VTI', 'SPY', 'QQQ', 'VOO', 'VEA', 'VWO', 'BND', 'AGG', 'TLT'
  ];

  return Array.from({ length: count }, (_, i) => {
    const type = types[i % types.length];
    const institution = institutions[i % institutions.length];
    const purchaseDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
    const purchasePrice = Math.round((Math.random() * 1000 + 10) * 100) / 100;
    const quantity = Math.round((Math.random() * 100 + 1) * 100) / 100;
    const currentPrice = Math.round((purchasePrice * (0.8 + Math.random() * 0.4)) * 100) / 100;
    const currentValue = Math.round((currentPrice * quantity) * 100) / 100;
    
    let ticker = '';
    if (type === 'stocks') {
      ticker = stockSymbols[i % stockSymbols.length];
    } else if (type === 'crypto') {
      ticker = cryptoSymbols[i % cryptoSymbols.length];
    } else if (type === 'mutual_fund' || type === 'etf') {
      ticker = mutualFunds[i % mutualFunds.length];
    }

    return {
      id: `inv_${i + 1}`,
      name: `${ticker || 'Investment'} ${i + 1}`,
      type: type,
      institution: institution,
      ticker: ticker,
      purchaseDate: purchaseDate.toISOString(),
      purchasePrice: purchasePrice,
      quantity: quantity,
      currentPrice: currentPrice,
      currentValue: currentValue,
      currency: 'USD',
      notes: `${type} investment in ${ticker || 'securities'}`,
      tags: [type, 'investment'],
      isActive: true,
      fees: Math.round(Math.random() * 50 * 100) / 100,
      createdAt: purchaseDate.toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
};

const generateInvestmentGoals = (count = 15) => {
  const goalTypes = ['retirement', 'education', 'home_purchase', 'vacation', 'emergency_fund', 'debt_payment'];
  const goalNames = [
    'Retirement Fund', 'Children\'s Education', 'House Down Payment', 'Dream Vacation',
    'Emergency Fund', 'Car Purchase', 'Wedding Fund', 'Business Investment',
    'Travel Fund', 'Home Renovation', 'Debt Payoff', 'Investment Portfolio',
    'College Fund', 'Medical Fund', 'Charitable Giving'
  ];

  return Array.from({ length: count }, (_, i) => {
    const targetAmount = Math.round((Math.random() * 500000 + 10000) * 100) / 100;
    const currentAmount = Math.round((Math.random() * targetAmount * 0.8) * 100) / 100;
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + Math.floor(Math.random() * 10) + 1);
    
    return {
      id: `goal_${i + 1}`,
      name: goalNames[i % goalNames.length],
      type: goalTypes[i % goalTypes.length],
      targetAmount: targetAmount,
      currentAmount: currentAmount,
      targetDate: targetDate.toISOString(),
      monthlyContribution: Math.round((targetAmount - currentAmount) / ((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)) * 100) / 100,
      currency: 'USD',
      notes: `Goal for ${goalNames[i % goalNames.length]}`,
      tags: [goalTypes[i % goalTypes.length], 'goal'],
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
};

const generateReminders = (count = 35) => {
  const categories = ['personal', 'work', 'health', 'finance', 'family', 'appointments'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  
  const reminderTitles = [
    'Doctor Appointment', 'Pay Credit Card Bill', 'Submit Expense Report',
    'Call Mom', 'Grocery Shopping', 'Car Service', 'Dentist Checkup',
    'Project Deadline', 'Team Meeting', 'Birthday Party', 'Tax Filing',
    'Insurance Renewal', 'Gym Workout', 'Book Flight', 'Hotel Booking',
    'Conference Call', 'Client Meeting', 'Performance Review', 'Budget Review',
    'Investment Review', 'Vaccination', 'Eye Exam', 'Haircut', 'Dry Cleaning',
    'Pet Vet Visit', 'Home Maintenance', 'Garden Care', 'Library Books',
    'Subscription Renewal', 'Password Update', 'Backup Data', 'Update Software',
    'Clean House', 'Laundry', 'Meal Prep'
  ];

  return Array.from({ length: count }, (_, i) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 30) + 1);
    
    return {
      id: `rem_${i + 1}`,
      title: reminderTitles[i % reminderTitles.length],
      description: `Reminder for ${reminderTitles[i % reminderTitles.length]}`,
      dueDate: dueDate.toISOString(),
      priority: priorities[i % priorities.length],
      category: categories[i % categories.length],
      isCompleted: Math.random() > 0.7,
      tags: [categories[i % categories.length], 'reminder'],
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
};

// Generate comprehensive data
const comprehensiveData = {
  passwords: generatePasswords(50),
  subscriptions: generateSubscriptions(30),
  notes: generateNotes(40),
  expenses: generateExpenses(60),
  investments: generateInvestments(25),
  investmentGoals: generateInvestmentGoals(15),
  reminders: generateReminders(35)
};

console.log('📊 Generated comprehensive data:', {
  passwords: comprehensiveData.passwords.length,
  subscriptions: comprehensiveData.subscriptions.length,
  notes: comprehensiveData.notes.length,
  expenses: comprehensiveData.expenses.length,
  investments: comprehensiveData.investments.length,
  investmentGoals: comprehensiveData.investmentGoals.length,
  reminders: comprehensiveData.reminders.length
});

// Export for use
window.comprehensiveData = comprehensiveData;

// Create downloadable files
const jsonData = JSON.stringify(comprehensiveData, null, 2);
const blob = new Blob([jsonData], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'comprehensive-test-data.json';
a.click();

console.log('✅ Comprehensive test data generated and downloaded!');
console.log('📁 File: comprehensive-test-data.json');
console.log('📊 Total items:', Object.values(comprehensiveData).reduce((sum, arr) => sum + arr.length, 0));
