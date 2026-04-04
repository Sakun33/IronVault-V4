// Debug script to check subscription data structure
// Run this in the browser console on the subscriptions page

console.log('🔍 Debugging Subscription Data...');

// Check if vault context is available
if (window.React && window.React.useContext) {
  console.log('✅ React context available');
} else {
  console.log('❌ React context not available');
}

// Try to access the vault data directly
if (window.vaultStorage) {
  console.log('✅ Vault storage available');
  
  // Get all subscriptions
  window.vaultStorage.getAllSubscriptions().then(subscriptions => {
    console.log('📊 Subscription Data:', subscriptions);
    console.log('📊 Subscription Count:', subscriptions.length);
    
    if (subscriptions.length > 0) {
      console.log('📊 First Subscription:', subscriptions[0]);
      console.log('📊 All Subscription Fields:', Object.keys(subscriptions[0]));
      
      // Check active subscriptions
      const activeSubs = subscriptions.filter(s => s.isActive);
      console.log('📊 Active Subscriptions:', activeSubs.length);
      console.log('📊 Active Subscriptions Data:', activeSubs);
      
      // Check costs
      const totalCost = subscriptions.reduce((sum, s) => sum + (s.cost || 0), 0);
      console.log('📊 Total Cost:', totalCost);
      
      // Check each subscription's isActive status
      subscriptions.forEach((sub, index) => {
        console.log(`📊 Subscription ${index + 1}:`, {
          name: sub.name,
          cost: sub.cost,
          isActive: sub.isActive,
          billingCycle: sub.billingCycle
        });
      });
    } else {
      console.log('❌ No subscriptions found');
    }
  }).catch(error => {
    console.error('❌ Error getting subscriptions:', error);
  });
} else {
  console.log('❌ Vault storage not available');
}

// Check if the page has loaded the data
setTimeout(() => {
  console.log('🔍 Checking page data after 2 seconds...');
  
  // Look for subscription elements in the DOM
  const subscriptionElements = document.querySelectorAll('[data-testid*="subscription"], .subscription-item, [class*="subscription"]');
  console.log('📊 Subscription DOM Elements:', subscriptionElements.length);
  
  // Look for the summary cards
  const summaryCards = document.querySelectorAll('[class*="grid-cols-3"] [class*="text-2xl"]');
  console.log('📊 Summary Cards:', summaryCards);
  summaryCards.forEach((card, index) => {
    console.log(`📊 Summary Card ${index + 1}:`, card.textContent);
  });
}, 2000);
