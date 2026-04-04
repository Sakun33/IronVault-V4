// Quick Test Data Generator - Run in Browser Console
// Generates realistic test data for import testing

console.log('🚀 Starting Quick Test Data Generator...');

// Generate comprehensive data
const generateQuickData = () => {
  const passwords = Array.from({ length: 20 }, (_, i) => ({
    id: `pwd_${i + 1}`,
    name: ['google.com', 'facebook.com', 'github.com', 'amazon.com', 'netflix.com'][i % 5],
    username: ['john.doe', 'jane.smith', 'mike.wilson'][i % 3],
    password: ['MySecure123!', 'Password2024#', 'SecurePass456$'][i % 3],
    url: `https://${['google.com', 'facebook.com', 'github.com', 'amazon.com', 'netflix.com'][i % 5]}`,
    notes: `Account ${i + 1}`,
    tags: ['work', 'personal', 'social'][i % 3],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  const subscriptions = Array.from({ length: 15 }, (_, i) => {
    const services = [
      { name: 'Netflix', price: 15.99 },
      { name: 'Spotify', price: 9.99 },
      { name: 'Adobe CC', price: 52.99 },
      { name: 'Microsoft 365', price: 6.99 },
      { name: 'Amazon Prime', price: 14.99 }
    ];
    const service = services[i % services.length];
    return {
      id: `sub_${i + 1}`,
      name: service.name,
      category: 'entertainment',
      price: service.price,
      currency: 'USD',
      billingCycle: 'monthly',
      status: 'active',
      startDate: new Date().toISOString(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      notes: `Subscription for ${service.name}`,
      tags: ['subscription'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  const notes = Array.from({ length: 20 }, (_, i) => ({
    id: `note_${i + 1}`,
    title: `Note ${i + 1}`,
    content: `This is note content ${i + 1} with some details.`,
    type: 'text',
    category: 'personal',
    tags: ['note'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  const expenses = Array.from({ length: 25 }, (_, i) => ({
    id: `exp_${i + 1}`,
    amount: Math.round((Math.random() * 100 + 10) * 100) / 100,
    currency: 'USD',
    category: ['food', 'transportation', 'entertainment', 'shopping'][i % 4],
    description: `Expense ${i + 1}`,
    merchant: ['Walmart', 'Amazon', 'Starbucks', 'Uber'][i % 4],
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['expense'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  const investments = Array.from({ length: 10 }, (_, i) => {
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
    const symbol = symbols[i % symbols.length];
    const price = Math.round((Math.random() * 500 + 50) * 100) / 100;
    return {
      id: `inv_${i + 1}`,
      name: `${symbol} Stock`,
      type: 'stocks',
      institution: 'Robinhood',
      ticker: symbol,
      purchaseDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      purchasePrice: price,
      quantity: Math.round((Math.random() * 10 + 1) * 100) / 100,
      currentPrice: Math.round((price * (0.9 + Math.random() * 0.2)) * 100) / 100,
      currentValue: Math.round((price * (0.9 + Math.random() * 0.2) * (Math.random() * 10 + 1)) * 100) / 100,
      currency: 'USD',
      notes: `Investment in ${symbol}`,
      tags: ['investment'],
      isActive: true,
      fees: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  const investmentGoals = Array.from({ length: 8 }, (_, i) => ({
    id: `goal_${i + 1}`,
    name: ['Retirement', 'House', 'Vacation', 'Education'][i % 4],
    type: ['retirement', 'home_purchase', 'vacation', 'education'][i % 4],
    targetAmount: Math.round((Math.random() * 100000 + 10000) * 100) / 100,
    currentAmount: Math.round((Math.random() * 50000) * 100) / 100,
    targetDate: new Date(Date.now() + Math.random() * 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    monthlyContribution: Math.round((Math.random() * 1000 + 100) * 100) / 100,
    currency: 'USD',
    notes: `Goal for ${['Retirement', 'House', 'Vacation', 'Education'][i % 4]}`,
    tags: ['goal'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  const reminders = Array.from({ length: 15 }, (_, i) => ({
    id: `rem_${i + 1}`,
    title: `Reminder ${i + 1}`,
    description: `Description for reminder ${i + 1}`,
    dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    priority: ['low', 'medium', 'high'][i % 3],
    category: 'personal',
    isCompleted: false,
    tags: ['reminder'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  return {
    passwords,
    subscriptions,
    notes,
    expenses,
    investments,
    investmentGoals,
    reminders
  };
};

// Generate and download the data
const data = generateQuickData();
const jsonData = JSON.stringify(data, null, 2);

// Create and download JSON file
const blob = new Blob([jsonData], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'quick-test-data.json';
a.click();

console.log('✅ Quick test data generated!');
console.log('📊 Data summary:', {
  passwords: data.passwords.length,
  subscriptions: data.subscriptions.length,
  notes: data.notes.length,
  expenses: data.expenses.length,
  investments: data.investments.length,
  investmentGoals: data.investmentGoals.length,
  reminders: data.reminders.length
});
console.log('📁 File downloaded: quick-test-data.json');
console.log('💡 Use the Import/Export feature to import this file into your vault!');

// Also make data available globally for testing
window.quickTestData = data;
console.log('🔧 Data also available as window.quickTestData for testing');
