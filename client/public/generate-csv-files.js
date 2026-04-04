// CSV Data Generator for Import Testing
// Creates individual CSV files for each section

const generatePasswordsCSV = () => {
  const headers = ['name', 'username', 'password', 'url', 'notes', 'tags'];
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
    'lisa.garcia', 'robert.miller', 'jennifer.davis', 'william.rodriguez', 'mary.martinez'
  ];

  const passwords = [
    'MySecure123!', 'Password2024#', 'SecurePass456$', 'MyVault789@', 'StrongPass123%',
    'SafeKey2024^', 'ProtectMe456&', 'VaultPass789*', 'SecureLogin123+', 'MyPassword456='
  ];

  const rows = [];
  for (let i = 0; i < 50; i++) {
    const website = websites[i % websites.length];
    const username = usernames[i % usernames.length];
    const password = passwords[i % passwords.length];
    const tag = ['work', 'personal', 'social', 'finance', 'entertainment'][i % 5];
    
    rows.push([
      website,
      username,
      password,
      `https://${website}`,
      `Account for ${website}`,
      tag
    ]);
  }

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const generateSubscriptionsCSV = () => {
  const headers = ['name', 'category', 'price', 'currency', 'billingCycle', 'status', 'notes', 'tags'];
  const services = [
    ['Netflix', 'entertainment', '15.99', 'USD', 'monthly', 'active'],
    ['Spotify Premium', 'entertainment', '9.99', 'USD', 'monthly', 'active'],
    ['Adobe Creative Cloud', 'software', '52.99', 'USD', 'monthly', 'active'],
    ['Microsoft 365', 'software', '6.99', 'USD', 'monthly', 'active'],
    ['Amazon Prime', 'shopping', '14.99', 'USD', 'yearly', 'active'],
    ['YouTube Premium', 'entertainment', '11.99', 'USD', 'monthly', 'active'],
    ['Disney+', 'entertainment', '7.99', 'USD', 'monthly', 'active'],
    ['HBO Max', 'entertainment', '14.99', 'USD', 'monthly', 'active'],
    ['Apple Music', 'entertainment', '9.99', 'USD', 'monthly', 'active'],
    ['Dropbox Plus', 'storage', '9.99', 'USD', 'monthly', 'active'],
    ['Google One', 'storage', '1.99', 'USD', 'monthly', 'active'],
    ['iCloud+', 'storage', '0.99', 'USD', 'monthly', 'active'],
    ['Slack Pro', 'productivity', '6.67', 'USD', 'monthly', 'active'],
    ['Zoom Pro', 'productivity', '14.99', 'USD', 'monthly', 'active'],
    ['Canva Pro', 'design', '12.99', 'USD', 'monthly', 'active'],
    ['Figma Professional', 'design', '12.00', 'USD', 'monthly', 'active'],
    ['Notion Pro', 'productivity', '8.00', 'USD', 'monthly', 'active'],
    ['Evernote Premium', 'productivity', '7.99', 'USD', 'monthly', 'active'],
    ['Grammarly Premium', 'productivity', '12.00', 'USD', 'monthly', 'active'],
    ['LastPass Premium', 'security', '3.00', 'USD', 'monthly', 'active'],
    ['1Password', 'security', '2.99', 'USD', 'monthly', 'active'],
    ['Dashlane Premium', 'security', '4.99', 'USD', 'monthly', 'active'],
    ['NordVPN', 'security', '3.71', 'USD', 'monthly', 'active'],
    ['ExpressVPN', 'security', '8.32', 'USD', 'monthly', 'active'],
    ['Surfshark', 'security', '2.49', 'USD', 'monthly', 'active'],
    ['Headspace', 'wellness', '12.99', 'USD', 'monthly', 'active'],
    ['Calm', 'wellness', '14.99', 'USD', 'monthly', 'active'],
    ['MyFitnessPal Premium', 'fitness', '9.99', 'USD', 'monthly', 'active'],
    ['Strava Premium', 'fitness', '5.00', 'USD', 'monthly', 'active'],
    ['Peloton App', 'fitness', '12.99', 'USD', 'monthly', 'active']
  ];

  const rows = services.map(service => [
    service[0], // name
    service[1], // category
    service[2], // price
    service[3], // currency
    service[4], // billingCycle
    service[5], // status
    `Subscription for ${service[0]}`, // notes
    `${service[1]},subscription` // tags
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const generateNotesCSV = () => {
  const headers = ['title', 'content', 'type', 'category', 'tags'];
  const notes = [
    ['Project Planning Meeting', '# Project Planning Meeting\n\n## Agenda\n- Review current progress\n- Discuss next milestones\n- Assign tasks\n\n## Action Items\n- [ ] Update project timeline\n- [ ] Review budget allocation\n- [ ] Schedule next meeting', 'markdown', 'work', 'work,meeting'],
    ['Shopping List', '- Milk\n- Bread\n- Eggs\n- Apples\n- Chicken\n- Rice\n- Vegetables\n- Coffee', 'text', 'personal', 'personal,shopping'],
    ['Code Snippet - API Call', '```javascript\nconst fetchUserData = async (userId) => {\n  try {\n    const response = await fetch(`/api/users/${userId}`);\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error(\'Error fetching user:\', error);\n  }\n};\n```', 'code', 'work', 'work,code'],
    ['Weekly Tasks', '- [ ] Complete project proposal\n- [ ] Review team feedback\n- [ ] Update documentation\n- [ ] Schedule client meeting\n- [ ] Prepare presentation\n- [ ] Submit expense report', 'checklist', 'work', 'work,tasks'],
    ['Learning Notes - React Hooks', '# React Hooks Notes\n\n## useState\nUsed for managing component state.\n\n## useEffect\nHandles side effects in functional components.\n\n## useCallback\nMemoizes functions to prevent unnecessary re-renders.\n\n## useMemo\nMemoizes computed values.', 'markdown', 'learning', 'learning,react'],
    ['Meeting Notes - Q4 Planning', '# Q4 Planning Meeting\n\n## Key Points\n- Revenue targets: $2M\n- New product launch: December\n- Team expansion: 5 new hires\n\n## Next Steps\n- [ ] Finalize budget\n- [ ] Set up hiring process\n- [ ] Create launch timeline', 'markdown', 'work', 'work,planning'],
    ['Personal Goals 2024', '- [ ] Learn Spanish\n- [ ] Read 24 books\n- [ ] Run a marathon\n- [ ] Travel to 3 countries\n- [ ] Start a side project\n- [ ] Improve work-life balance', 'checklist', 'personal', 'personal,goals'],
    ['Recipe - Chocolate Cake', '## Chocolate Cake Recipe\n\n### Ingredients\n- 2 cups flour\n- 1 cup sugar\n- 1/2 cup cocoa powder\n- 1 tsp baking soda\n- 1/2 tsp salt\n- 1 cup water\n- 1/3 cup oil\n- 1 tsp vanilla\n\n### Instructions\n1. Mix dry ingredients\n2. Add wet ingredients\n3. Bake at 350°F for 30 minutes', 'markdown', 'personal', 'personal,recipe'],
    ['Book Notes - Atomic Habits', '# Atomic Habits by James Clear\n\n## Key Concepts\n- Small changes compound over time\n- Focus on systems, not goals\n- Environment shapes behavior\n- Identity-based habits\n\n## Action Items\n- [ ] Start with 1% improvements\n- [ ] Design environment for success\n- [ ] Track habits daily', 'markdown', 'learning', 'learning,books'],
    ['Travel Itinerary - Japan', '# Japan Travel Itinerary\n\n## Day 1: Tokyo\n- Arrive at Narita Airport\n- Check into hotel\n- Explore Shibuya\n- Dinner at local restaurant\n\n## Day 2: Tokyo\n- Visit Senso-ji Temple\n- Explore Asakusa\n- Lunch at Tsukiji Market\n- Evening in Ginza\n\n## Day 3: Kyoto\n- Take Shinkansen to Kyoto\n- Visit Fushimi Inari Shrine\n- Explore Gion district\n- Traditional kaiseki dinner', 'markdown', 'personal', 'personal,travel']
  ];

  const rows = notes.map(note => [
    note[0], // title
    `"${note[1].replace(/"/g, '""')}"`, // content (escaped)
    note[2], // type
    note[3], // category
    note[4]  // tags
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const generateExpensesCSV = () => {
  const headers = ['amount', 'currency', 'category', 'description', 'merchant', 'date', 'tags'];
  const expenses = [
    [25.99, 'USD', 'food', 'Grocery shopping', 'Walmart', '2024-01-15', 'food,expense'],
    [45.50, 'USD', 'transportation', 'Gas station', 'Shell', '2024-01-14', 'transportation,expense'],
    [12.99, 'USD', 'food', 'Coffee break', 'Starbucks', '2024-01-13', 'food,expense'],
    [89.99, 'USD', 'shopping', 'Online purchase', 'Amazon', '2024-01-12', 'shopping,expense'],
    [15.99, 'USD', 'entertainment', 'Movie tickets', 'AMC Theaters', '2024-01-11', 'entertainment,expense'],
    [8.50, 'USD', 'transportation', 'Ride share', 'Uber', '2024-01-10', 'transportation,expense'],
    [120.00, 'USD', 'utilities', 'Phone bill', 'Verizon', '2024-01-09', 'utilities,expense'],
    [65.00, 'USD', 'utilities', 'Internet bill', 'Comcast', '2024-01-08', 'utilities,expense'],
    [150.00, 'USD', 'healthcare', 'Doctor visit', 'City Medical', '2024-01-07', 'healthcare,expense'],
    [35.99, 'USD', 'shopping', 'Clothing purchase', 'Target', '2024-01-06', 'shopping,expense'],
    [22.50, 'USD', 'food', 'Lunch', 'Subway', '2024-01-05', 'food,expense'],
    [299.99, 'USD', 'shopping', 'Electronics', 'Best Buy', '2024-01-04', 'shopping,expense'],
    [18.75, 'USD', 'food', 'Dinner', 'McDonald\'s', '2024-01-03', 'food,expense'],
    [45.00, 'USD', 'entertainment', 'Concert tickets', 'Ticketmaster', '2024-01-02', 'entertainment,expense'],
    [12.99, 'USD', 'subscriptions', 'Netflix subscription', 'Netflix', '2024-01-01', 'subscriptions,expense'],
    [9.99, 'USD', 'subscriptions', 'Spotify Premium', 'Spotify', '2024-01-01', 'subscriptions,expense'],
    [52.99, 'USD', 'subscriptions', 'Adobe Creative Cloud', 'Adobe', '2024-01-01', 'subscriptions,expense'],
    [6.99, 'USD', 'subscriptions', 'Microsoft 365', 'Microsoft', '2024-01-01', 'subscriptions,expense'],
    [14.99, 'USD', 'subscriptions', 'Amazon Prime', 'Amazon', '2024-01-01', 'subscriptions,expense'],
    [11.99, 'USD', 'subscriptions', 'YouTube Premium', 'Google', '2024-01-01', 'subscriptions,expense']
  ];

  const rows = expenses.map(expense => [
    expense[0], // amount
    expense[1], // currency
    expense[2], // category
    expense[3], // description
    expense[4], // merchant
    expense[5], // date
    expense[6]  // tags
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const generateInvestmentsCSV = () => {
  const headers = ['name', 'type', 'institution', 'ticker', 'purchaseDate', 'purchasePrice', 'quantity', 'currentPrice', 'currentValue', 'currency', 'notes', 'tags'];
  const investments = [
    ['Apple Inc.', 'stocks', 'Robinhood', 'AAPL', '2024-01-15', '150.00', '10', '175.00', '1750.00', 'USD', 'Tech stock investment', 'stocks,investment'],
    ['S&P 500 Index Fund', 'mutual_fund', 'Vanguard', 'VTSAX', '2024-01-01', '100.00', '100', '108.00', '10800.00', 'USD', 'Diversified index fund', 'mutual_fund,investment'],
    ['Bitcoin', 'crypto', 'Coinbase', 'BTC', '2024-02-01', '40000.00', '0.05', '50000.00', '2500.00', 'USD', 'Cryptocurrency investment', 'crypto,investment'],
    ['Microsoft Corporation', 'stocks', 'Fidelity', 'MSFT', '2024-01-20', '380.00', '5', '420.00', '2100.00', 'USD', 'Tech stock investment', 'stocks,investment'],
    ['Ethereum', 'crypto', 'Binance', 'ETH', '2024-02-15', '2500.00', '2', '3000.00', '6000.00', 'USD', 'Cryptocurrency investment', 'crypto,investment'],
    ['Total Stock Market ETF', 'etf', 'Charles Schwab', 'VTI', '2024-01-10', '200.00', '50', '210.00', '10500.00', 'USD', 'Broad market ETF', 'etf,investment'],
    ['Tesla Inc.', 'stocks', 'TD Ameritrade', 'TSLA', '2024-01-25', '200.00', '5', '180.00', '900.00', 'USD', 'Electric vehicle stock', 'stocks,investment'],
    ['Google Alphabet', 'stocks', 'Robinhood', 'GOOGL', '2024-01-30', '140.00', '10', '155.00', '1550.00', 'USD', 'Tech stock investment', 'stocks,investment'],
    ['Amazon.com Inc.', 'stocks', 'Fidelity', 'AMZN', '2024-02-05', '160.00', '5', '170.00', '850.00', 'USD', 'E-commerce stock', 'stocks,investment'],
    ['Meta Platforms', 'stocks', 'Charles Schwab', 'META', '2024-02-10', '300.00', '3', '350.00', '1050.00', 'USD', 'Social media stock', 'stocks,investment'],
    ['Cardano', 'crypto', 'Coinbase', 'ADA', '2024-02-20', '0.50', '1000', '0.60', '600.00', 'USD', 'Cryptocurrency investment', 'crypto,investment'],
    ['Solana', 'crypto', 'Binance', 'SOL', '2024-02-25', '100.00', '10', '120.00', '1200.00', 'USD', 'Cryptocurrency investment', 'crypto,investment'],
    ['Total Bond Market Fund', 'mutual_fund', 'Vanguard', 'BND', '2024-01-05', '80.00', '100', '82.00', '8200.00', 'USD', 'Bond fund investment', 'mutual_fund,investment'],
    ['International Stock ETF', 'etf', 'Fidelity', 'VEA', '2024-01-12', '50.00', '200', '52.00', '10400.00', 'USD', 'International equity ETF', 'etf,investment'],
    ['Real Estate Investment Trust', 'real_estate', 'Charles Schwab', 'VNQ', '2024-01-18', '90.00', '50', '95.00', '4750.00', 'USD', 'REIT investment', 'real_estate,investment']
  ];

  const rows = investments.map(investment => [
    investment[0], // name
    investment[1], // type
    investment[2], // institution
    investment[3], // ticker
    investment[4], // purchaseDate
    investment[5], // purchasePrice
    investment[6], // quantity
    investment[7], // currentPrice
    investment[8], // currentValue
    investment[9], // currency
    investment[10], // notes
    investment[11] // tags
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const generateInvestmentGoalsCSV = () => {
  const headers = ['name', 'type', 'targetAmount', 'currentAmount', 'targetDate', 'monthlyContribution', 'currency', 'notes', 'tags'];
  const goals = [
    ['Retirement Fund', 'retirement', '1000000', '150000', '2045-12-31', '2000', 'USD', 'Goal for comfortable retirement', 'retirement,goal'],
    ['Children\'s Education', 'education', '100000', '25000', '2030-06-01', '500', 'USD', 'College fund for kids', 'education,goal'],
    ['House Down Payment', 'home_purchase', '80000', '15000', '2026-12-31', '1500', 'USD', 'Down payment for first home', 'home_purchase,goal'],
    ['Dream Vacation', 'vacation', '15000', '5000', '2025-06-01', '300', 'USD', 'European vacation fund', 'vacation,goal'],
    ['Emergency Fund', 'emergency_fund', '25000', '8000', '2024-12-31', '1000', 'USD', '6 months of expenses', 'emergency_fund,goal'],
    ['Car Purchase', 'other', '30000', '10000', '2025-03-01', '800', 'USD', 'New car fund', 'other,goal'],
    ['Wedding Fund', 'other', '20000', '5000', '2025-09-01', '600', 'USD', 'Wedding expenses', 'other,goal'],
    ['Business Investment', 'other', '50000', '10000', '2026-06-01', '1000', 'USD', 'Startup investment', 'other,goal'],
    ['Travel Fund', 'vacation', '12000', '3000', '2025-12-01', '400', 'USD', 'Annual travel budget', 'vacation,goal'],
    ['Home Renovation', 'home_purchase', '40000', '8000', '2025-08-01', '1200', 'USD', 'Kitchen renovation', 'home_purchase,goal'],
    ['Debt Payoff', 'debt_payment', '15000', '5000', '2024-12-31', '800', 'USD', 'Credit card debt elimination', 'debt_payment,goal'],
    ['Investment Portfolio', 'other', '200000', '50000', '2030-12-31', '1500', 'USD', 'Diversified investment portfolio', 'other,goal'],
    ['College Fund', 'education', '80000', '20000', '2028-06-01', '600', 'USD', 'Graduate school fund', 'education,goal'],
    ['Medical Fund', 'emergency_fund', '10000', '2000', '2024-12-31', '400', 'USD', 'Medical emergency fund', 'emergency_fund,goal'],
    ['Charitable Giving', 'other', '5000', '1000', '2024-12-31', '200', 'USD', 'Annual charitable donations', 'other,goal']
  ];

  const rows = goals.map(goal => [
    goal[0], // name
    goal[1], // type
    goal[2], // targetAmount
    goal[3], // currentAmount
    goal[4], // targetDate
    goal[5], // monthlyContribution
    goal[6], // currency
    goal[7], // notes
    goal[8]  // tags
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const generateRemindersCSV = () => {
  const headers = ['title', 'description', 'dueDate', 'priority', 'category', 'isCompleted', 'tags'];
  const reminders = [
    ['Doctor Appointment', 'Annual checkup with Dr. Smith', '2024-02-15', 'high', 'health', 'false', 'health,reminder'],
    ['Pay Credit Card Bill', 'Monthly credit card payment due', '2024-02-10', 'high', 'finance', 'false', 'finance,reminder'],
    ['Submit Expense Report', 'Q1 expense report submission', '2024-02-28', 'medium', 'work', 'false', 'work,reminder'],
    ['Call Mom', 'Weekly call to check in', '2024-02-12', 'medium', 'family', 'false', 'family,reminder'],
    ['Grocery Shopping', 'Weekly grocery shopping trip', '2024-02-08', 'low', 'personal', 'false', 'personal,reminder'],
    ['Car Service', '6-month car maintenance', '2024-02-20', 'medium', 'personal', 'false', 'personal,reminder'],
    ['Dentist Checkup', 'Regular dental cleaning', '2024-03-01', 'medium', 'health', 'false', 'health,reminder'],
    ['Project Deadline', 'Client project delivery', '2024-02-25', 'urgent', 'work', 'false', 'work,reminder'],
    ['Team Meeting', 'Weekly team standup', '2024-02-09', 'medium', 'work', 'false', 'work,reminder'],
    ['Birthday Party', 'Friend\'s birthday celebration', '2024-02-14', 'low', 'personal', 'false', 'personal,reminder'],
    ['Tax Filing', 'Annual tax return submission', '2024-04-15', 'high', 'finance', 'false', 'finance,reminder'],
    ['Insurance Renewal', 'Auto insurance renewal', '2024-03-15', 'medium', 'finance', 'false', 'finance,reminder'],
    ['Gym Workout', 'Regular gym session', '2024-02-11', 'low', 'health', 'false', 'health,reminder'],
    ['Book Flight', 'Book vacation flight', '2024-02-20', 'medium', 'personal', 'false', 'personal,reminder'],
    ['Hotel Booking', 'Reserve hotel for vacation', '2024-02-22', 'medium', 'personal', 'false', 'personal,reminder'],
    ['Conference Call', 'Client conference call', '2024-02-13', 'high', 'work', 'false', 'work,reminder'],
    ['Client Meeting', 'In-person client meeting', '2024-02-16', 'high', 'work', 'false', 'work,reminder'],
    ['Performance Review', 'Annual performance review', '2024-03-01', 'high', 'work', 'false', 'work,reminder'],
    ['Budget Review', 'Monthly budget analysis', '2024-02-29', 'medium', 'finance', 'false', 'finance,reminder'],
    ['Investment Review', 'Quarterly portfolio review', '2024-03-31', 'medium', 'finance', 'false', 'finance,reminder'],
    ['Vaccination', 'Annual flu vaccination', '2024-02-18', 'medium', 'health', 'false', 'health,reminder'],
    ['Eye Exam', 'Annual eye examination', '2024-03-10', 'low', 'health', 'false', 'health,reminder'],
    ['Haircut', 'Regular haircut appointment', '2024-02-14', 'low', 'personal', 'false', 'personal,reminder'],
    ['Dry Cleaning', 'Pick up dry cleaning', '2024-02-09', 'low', 'personal', 'false', 'personal,reminder'],
    ['Pet Vet Visit', 'Annual pet checkup', '2024-02-28', 'medium', 'personal', 'false', 'personal,reminder'],
    ['Home Maintenance', 'Quarterly home maintenance', '2024-03-15', 'medium', 'personal', 'false', 'personal,reminder'],
    ['Garden Care', 'Spring garden preparation', '2024-03-01', 'low', 'personal', 'false', 'personal,reminder'],
    ['Library Books', 'Return library books', '2024-02-12', 'low', 'personal', 'false', 'personal,reminder'],
    ['Subscription Renewal', 'Annual subscription renewals', '2024-02-25', 'medium', 'finance', 'false', 'finance,reminder'],
    ['Password Update', 'Quarterly password updates', '2024-03-31', 'medium', 'personal', 'false', 'personal,reminder'],
    ['Backup Data', 'Monthly data backup', '2024-02-29', 'medium', 'personal', 'false', 'personal,reminder'],
    ['Update Software', 'Software updates check', '2024-02-15', 'low', 'personal', 'false', 'personal,reminder'],
    ['Clean House', 'Weekly house cleaning', '2024-02-10', 'low', 'personal', 'false', 'personal,reminder'],
    ['Laundry', 'Weekly laundry day', '2024-02-11', 'low', 'personal', 'false', 'personal,reminder'],
    ['Meal Prep', 'Weekly meal preparation', '2024-02-12', 'low', 'personal', 'false', 'personal,reminder']
  ];

  const rows = reminders.map(reminder => [
    reminder[0], // title
    reminder[1], // description
    reminder[2], // dueDate
    reminder[3], // priority
    reminder[4], // category
    reminder[5], // isCompleted
    reminder[6]  // tags
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

// Generate and download all CSV files
const csvFiles = {
  'passwords': generatePasswordsCSV(),
  'subscriptions': generateSubscriptionsCSV(),
  'notes': generateNotesCSV(),
  'expenses': generateExpensesCSV(),
  'investments': generateInvestmentsCSV(),
  'investment-goals': generateInvestmentGoalsCSV(),
  'reminders': generateRemindersCSV()
};

// Download each CSV file
Object.entries(csvFiles).forEach(([filename, content]) => {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sample-${filename}.csv`;
  a.click();
});

console.log('✅ All CSV files generated and downloaded!');
console.log('📁 Files created:');
Object.keys(csvFiles).forEach(filename => {
  console.log(`   - sample-${filename}.csv`);
});

// Also create the comprehensive JSON file
const comprehensiveData = {
  passwords: generatePasswords(50),
  subscriptions: generateSubscriptions(30),
  notes: generateNotes(40),
  expenses: generateExpenses(60),
  investments: generateInvestments(25),
  investmentGoals: generateInvestmentGoals(15),
  reminders: generateReminders(35)
};

const jsonData = JSON.stringify(comprehensiveData, null, 2);
const jsonBlob = new Blob([jsonData], { type: 'application/json' });
const jsonUrl = URL.createObjectURL(jsonBlob);
const jsonA = document.createElement('a');
jsonA.href = jsonUrl;
jsonA.download = 'comprehensive-test-data.json';
jsonA.click();

console.log('📁 Also created: comprehensive-test-data.json');
console.log('📊 Total items:', Object.values(comprehensiveData).reduce((sum, arr) => sum + arr.length, 0));
