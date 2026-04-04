// Comprehensive Data Generator - Creates 200+ items for each section
// Run this in the browser console at http://localhost:5173

console.log('🚀 Starting comprehensive data generation...');

async function generateComprehensiveData() {
    try {
        // Check if vault storage is available
        if (!window.vaultStorage) {
            throw new Error('Vault storage not available. Please make sure you are logged in.');
        }

        console.log('✅ Vault storage found, starting data generation...');

        // Generate comprehensive data for each section
        const data = {
            passwords: generatePasswords(200),
            subscriptions: generateSubscriptions(200),
            notes: generateNotes(200),
            expenses: generateExpenses(200),
            investments: generateInvestments(200),
            investmentGoals: generateInvestmentGoals(200),
            bankTransactions: generateBankTransactions(200),
            reminders: generateReminders(200)
        };

        console.log('📊 Generated data:', Object.keys(data).map(key => `${key}: ${data[key].length} items`));

        // Import the data
        console.log('📤 Importing comprehensive data...');
        await window.vaultStorage.importVault(JSON.stringify(data));
        
        console.log('✅ Comprehensive data imported successfully!');
        console.log('📋 Total items imported:', Object.values(data).reduce((sum, arr) => sum + arr.length, 0));
        
        // Refresh the page to see the new data
        console.log('🔄 Refreshing page to display new data...');
        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (error) {
        console.error('❌ Data generation failed:', error);
        alert('Data generation failed: ' + error.message);
    }
}

// Generate 200+ realistic passwords
function generatePasswords(count) {
    const passwords = [];
    const domains = [
        'gmail.com', 'outlook.com', 'yahoo.com', 'apple.com', 'microsoft.com',
        'amazon.com', 'netflix.com', 'spotify.com', 'facebook.com', 'twitter.com',
        'linkedin.com', 'github.com', 'stackoverflow.com', 'reddit.com', 'youtube.com',
        'instagram.com', 'tiktok.com', 'discord.com', 'slack.com', 'zoom.us',
        'dropbox.com', 'google.com', 'adobe.com', 'salesforce.com', 'shopify.com',
        'stripe.com', 'paypal.com', 'venmo.com', 'uber.com', 'lyft.com',
        'airbnb.com', 'booking.com', 'expedia.com', 'tripadvisor.com', 'kayak.com',
        'bankofamerica.com', 'chase.com', 'wellsfargo.com', 'citibank.com', 'usbank.com',
        'fidelity.com', 'vanguard.com', 'schwab.com', 'etrade.com', 'robinhood.com',
        'coinbase.com', 'binance.com', 'kraken.com', 'gemini.com', 'bitfinex.com'
    ];

    const categories = ['Social Media', 'Banking', 'Shopping', 'Entertainment', 'Work', 'Crypto', 'Travel', 'Education'];
    const strengths = ['Weak', 'Medium', 'Strong', 'Very Strong'];

    for (let i = 0; i < count; i++) {
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const strength = strengths[Math.floor(Math.random() * strengths.length)];
        
        passwords.push({
            id: `pwd-${i + 1}`,
            name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Account`,
            url: `https://${domain}`,
            username: `user${i + 1}@${domain}`,
            password: generateRandomPassword(),
            category: category,
            strength: strength,
            lastUsed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
            notes: `Account for ${domain} - ${category.toLowerCase()} service`,
            tags: [category.toLowerCase(), domain.split('.')[0]]
        });
    }
    return passwords;
}

// Generate 200+ realistic subscriptions
function generateSubscriptions(count) {
    const subscriptions = [];
    const services = [
        'Netflix', 'Spotify', 'Amazon Prime', 'Disney+', 'Hulu', 'HBO Max', 'Apple Music',
        'YouTube Premium', 'Adobe Creative Cloud', 'Microsoft 365', 'Google Workspace',
        'Slack', 'Zoom Pro', 'Dropbox', 'OneDrive', 'iCloud', 'LastPass', '1Password',
        'Grammarly', 'Canva Pro', 'Figma', 'Sketch', 'Notion', 'Evernote', 'Todoist',
        'Trello', 'Asana', 'Monday.com', 'Salesforce', 'HubSpot', 'Mailchimp',
        'Shopify', 'WooCommerce', 'Squarespace', 'Wix', 'WordPress', 'Ghost',
        'Patreon', 'Substack', 'Medium', 'LinkedIn Premium', 'Coursera', 'Udemy',
        'MasterClass', 'Skillshare', 'Pluralsight', 'Codecademy', 'DataCamp',
        'Gym Membership', 'Peloton', 'Nike Training Club', 'MyFitnessPal Premium',
        'Headspace', 'Calm', 'Insight Timer', 'Audible', 'Kindle Unlimited'
    ];

    const categories = ['Entertainment', 'Productivity', 'Education', 'Fitness', 'Business', 'Design', 'Development'];
    const frequencies = ['monthly', 'yearly', 'quarterly'];

    for (let i = 0; i < count; i++) {
        const service = services[Math.floor(Math.random() * services.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const frequency = frequencies[Math.floor(Math.random() * frequencies.length)];
        const amount = Math.round((Math.random() * 50 + 5) * 100) / 100;
        
        subscriptions.push({
            id: `sub-${i + 1}`,
            name: service,
            category: category,
            amount: amount,
            currency: 'USD',
            frequency: frequency,
            nextBillingDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
            startDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            isActive: Math.random() > 0.1,
            autoRenew: Math.random() > 0.2,
            notes: `${service} subscription for ${category.toLowerCase()} needs`,
            tags: [category.toLowerCase(), service.toLowerCase().replace(/\s+/g, '-')],
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    return subscriptions;
}

// Generate 200+ realistic notes
function generateNotes(count) {
    const notes = [];
    const titles = [
        'Meeting Notes', 'Project Ideas', 'Shopping List', 'Travel Plans', 'Recipe Collection',
        'Book Summary', 'Learning Notes', 'Workout Plan', 'Budget Planning', 'Gift Ideas',
        'Home Improvement', 'Career Goals', 'Health Tips', 'Investment Research', 'Tech Reviews',
        'Creative Writing', 'Journal Entry', 'Study Notes', 'Conference Notes', 'Webinar Summary'
    ];

    const notebooks = ['Personal', 'Work', 'Learning', 'Finance', 'Health', 'Travel', 'Creative', 'Research'];
    const categories = ['Personal', 'Work', 'Finance', 'Health', 'Education', 'Creative', 'Planning'];

    for (let i = 0; i < count; i++) {
        const title = titles[Math.floor(Math.random() * titles.length)];
        const notebook = notebooks[Math.floor(Math.random() * notebooks.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        
        notes.push({
            id: `note-${i + 1}`,
            title: `${title} ${i + 1}`,
            content: generateNoteContent(title),
            notebook: notebook,
            category: category,
            tags: [category.toLowerCase(), notebook.toLowerCase()],
            createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
            isPinned: Math.random() > 0.8,
            isArchived: Math.random() > 0.9
        });
    }
    return notes;
}

// Generate 200+ realistic expenses
function generateExpenses(count) {
    const expenses = [];
    const descriptions = [
        'Grocery Shopping', 'Gas Station', 'Restaurant Meal', 'Coffee Shop', 'Online Purchase',
        'Utility Bill', 'Phone Bill', 'Internet Bill', 'Insurance Payment', 'Medical Expense',
        'Transportation', 'Entertainment', 'Clothing', 'Home Improvement', 'Education',
        'Travel Expense', 'Gift Purchase', 'Subscription Fee', 'Bank Fee', 'ATM Withdrawal'
    ];

    const categories = ['Food & Dining', 'Transportation', 'Shopping', 'Bills & Utilities', 'Healthcare', 'Entertainment', 'Education', 'Travel'];
    const paymentMethods = ['Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'PayPal', 'Apple Pay', 'Google Pay'];

    for (let i = 0; i < count; i++) {
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        const amount = Math.round((Math.random() * 500 + 10) * 100) / 100;
        
        expenses.push({
            id: `exp-${i + 1}`,
            description: `${description} ${i + 1}`,
            amount: amount,
            category: category,
            date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
            paymentMethod: paymentMethod,
            currency: 'USD',
            tags: [category.toLowerCase(), paymentMethod.toLowerCase().replace(/\s+/g, '-')],
            createdAt: new Date(),
            updatedAt: new Date(),
            isRecurring: Math.random() > 0.7,
            receipt: Math.random() > 0.5 ? `receipt-${i + 1}.jpg` : null
        });
    }
    return expenses;
}

// Generate 200+ realistic investments
function generateInvestments(count) {
    const investments = [];
    const stockNames = [
        'Apple Inc.', 'Microsoft Corp.', 'Google (Alphabet)', 'Amazon.com Inc.', 'Tesla Inc.',
        'Meta Platforms', 'NVIDIA Corp.', 'Berkshire Hathaway', 'Johnson & Johnson', 'JPMorgan Chase',
        'Visa Inc.', 'Mastercard Inc.', 'Procter & Gamble', 'Coca-Cola Co.', 'Walt Disney Co.',
        'Netflix Inc.', 'PayPal Holdings', 'Adobe Inc.', 'Salesforce Inc.', 'Oracle Corp.',
        'Intel Corp.', 'Cisco Systems', 'IBM Corp.', 'AT&T Inc.', 'Verizon Communications',
        'Goldman Sachs', 'Bank of America', 'Wells Fargo', 'Citigroup Inc.', 'American Express'
    ];

    const types = ['stocks', 'mutual_fund', 'bonds', 'crypto', 'etf', 'real_estate'];
    const institutions = ['Fidelity', 'Vanguard', 'Charles Schwab', 'E*TRADE', 'Robinhood', 'TD Ameritrade', 'Interactive Brokers'];

    for (let i = 0; i < count; i++) {
        const stockName = stockNames[Math.floor(Math.random() * stockNames.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        const institution = institutions[Math.floor(Math.random() * institutions.length)];
        const purchasePrice = Math.round((Math.random() * 500 + 50) * 100) / 100;
        const currentPrice = purchasePrice * (0.8 + Math.random() * 0.4);
        const quantity = Math.round((Math.random() * 100 + 1) * 100) / 100;
        
        investments.push({
            id: `inv-${i + 1}`,
            name: stockName,
            type: type,
            institution: institution,
            ticker: generateTicker(stockName),
            purchaseDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            purchasePrice: purchasePrice,
            quantity: quantity,
            currentPrice: currentPrice,
            currentValue: currentPrice * quantity,
            currency: 'USD',
            notes: `Investment in ${stockName} via ${institution}`,
            tags: [type, institution.toLowerCase()],
            isActive: Math.random() > 0.1,
            fees: Math.round(Math.random() * 10 * 100) / 100,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    return investments;
}

// Generate 200+ realistic investment goals
function generateInvestmentGoals(count) {
    const goals = [];
    const goalNames = [
        'Retirement Fund', 'Emergency Fund', 'Home Purchase', 'Education Fund', 'Vacation Fund',
        'Car Purchase', 'Wedding Fund', 'Business Investment', 'Real Estate Investment', 'Travel Fund',
        'Healthcare Fund', 'Charity Fund', 'Technology Upgrade', 'Home Renovation', 'Child Education',
        'Early Retirement', 'Financial Independence', 'Debt Payoff', 'Investment Portfolio', 'Wealth Building'
    ];

    const categories = ['retirement', 'emergency', 'education', 'purchase', 'investment', 'travel', 'healthcare'];
    const priorities = ['low', 'medium', 'high', 'critical'];

    for (let i = 0; i < count; i++) {
        const goalName = goalNames[Math.floor(Math.random() * goalNames.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const targetAmount = Math.round((Math.random() * 1000000 + 10000) * 100) / 100;
        const currentAmount = Math.round((Math.random() * targetAmount) * 100) / 100;
        
        goals.push({
            id: `goal-${i + 1}`,
            name: `${goalName} ${i + 1}`,
            category: category,
            targetAmount: targetAmount,
            currentAmount: currentAmount,
            targetDate: new Date(Date.now() + Math.random() * 5 * 365 * 24 * 60 * 60 * 1000),
            priority: priority,
            monthlyContribution: Math.round((Math.random() * 2000 + 100) * 100) / 100,
            notes: `Goal: ${goalName} - ${category} category`,
            tags: [category, priority],
            isActive: Math.random() > 0.1,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    return goals;
}

// Generate 200+ realistic bank transactions
function generateBankTransactions(count) {
    const transactions = [];
    const descriptions = [
        'Salary Deposit', 'ATM Withdrawal', 'Online Transfer', 'Check Deposit', 'Direct Deposit',
        'Credit Card Payment', 'Utility Payment', 'Rent Payment', 'Grocery Store', 'Gas Station',
        'Restaurant Payment', 'Online Purchase', 'Subscription Fee', 'Insurance Payment', 'Medical Bill',
        'Investment Transfer', 'Loan Payment', 'Tax Payment', 'Refund', 'Interest Payment'
    ];

    const types = ['credit', 'debit'];
    const categories = ['Income', 'Expense', 'Transfer', 'Investment', 'Bill Payment'];

    for (let i = 0; i < count; i++) {
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const amount = Math.round((Math.random() * 5000 + 10) * 100) / 100;
        
        transactions.push({
            id: `bt-${i + 1}`,
            date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
            description: `${description} ${i + 1}`,
            amount: type === 'credit' ? amount : -amount,
            type: type,
            category: category,
            account: `Account ${Math.floor(Math.random() * 3) + 1}`,
            balance: Math.round((Math.random() * 50000 + 1000) * 100) / 100,
            tags: [category.toLowerCase(), type],
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    return transactions;
}

// Generate 200+ realistic reminders
function generateReminders(count) {
    const reminders = [];
    const titles = [
        'Pay Bills', 'Call Doctor', 'Schedule Meeting', 'Buy Groceries', 'Submit Report',
        'Renew License', 'Update Password', 'Backup Data', 'Review Budget', 'Plan Vacation',
        'Exercise', 'Read Book', 'Learn New Skill', 'Call Family', 'Clean House',
        'Car Maintenance', 'Tax Preparation', 'Insurance Review', 'Investment Check', 'Health Checkup'
    ];

    const priorities = ['low', 'medium', 'high', 'urgent'];
    const categories = ['Personal', 'Work', 'Health', 'Finance', 'Home', 'Education'];

    for (let i = 0; i < count; i++) {
        const title = titles[Math.floor(Math.random() * titles.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const dueDate = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000);
        
        reminders.push({
            id: `reminder-${i + 1}`,
            title: `${title} ${i + 1}`,
            description: `Reminder to ${title.toLowerCase()} - ${category} task`,
            dueDate: dueDate,
            priority: priority,
            category: category,
            isCompleted: Math.random() > 0.7,
            tags: [category.toLowerCase(), priority],
            createdAt: new Date(),
            updatedAt: new Date(),
            reminderTime: new Date(dueDate.getTime() - Math.random() * 24 * 60 * 60 * 1000)
        });
    }
    return reminders;
}

// Helper functions
function generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function generateTicker(name) {
    return name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().substring(0, 4);
}

function generateNoteContent(title) {
    const contents = {
        'Meeting Notes': `# Meeting Notes\n\n## Agenda\n- Item 1\n- Item 2\n- Item 3\n\n## Action Items\n- [ ] Task 1\n- [ ] Task 2\n\n## Next Steps\n- Follow up on decisions\n- Schedule next meeting`,
        'Project Ideas': `# Project Ideas\n\n## Current Projects\n- Project A: Description\n- Project B: Description\n\n## Future Ideas\n- Idea 1: Description\n- Idea 2: Description\n\n## Resources Needed\n- Resource 1\n- Resource 2`,
        'Shopping List': `# Shopping List\n\n## Groceries\n- [ ] Milk\n- [ ] Bread\n- [ ] Eggs\n- [ ] Vegetables\n\n## Household Items\n- [ ] Cleaning supplies\n- [ ] Paper towels\n- [ ] Laundry detergent`,
        'Travel Plans': `# Travel Plans\n\n## Destination\n- Location: [Destination]\n- Dates: [Start] - [End]\n- Budget: $[Amount]\n\n## Itinerary\n- Day 1: [Activity]\n- Day 2: [Activity]\n- Day 3: [Activity]\n\n## Packing List\n- [ ] Clothes\n- [ ] Toiletries\n- [ ] Documents`
    };
    
    return contents[title] || `# ${title}\n\nThis is a note about ${title.toLowerCase()}.\n\n## Details\n- Important point 1\n- Important point 2\n- Important point 3\n\n## Notes\nAdditional information and thoughts about this topic.`;
}

// Run the data generation
generateComprehensiveData();

console.log('📋 Comprehensive data generation script loaded. Check console for progress...');
