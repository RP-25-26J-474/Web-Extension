// MIGRATION SCRIPT: Enable Tracking for Existing User
// =====================================================
// 
// This script is for users who:
// - Registered before the consent flow was fixed
// - Completed the onboarding game
// - But tracking is still disabled
//
// Run this in the Chrome Extension Service Worker console:
// 1. Go to chrome://extensions/
// 2. Find AURA extension
// 3. Click "service worker"
// 4. Copy and paste this entire script
// 5. Press Enter

(async () => {
  console.log('\n🔧 MIGRATION: Enabling Tracking for Existing User\n' + '='.repeat(60));
  
  // Check current state
  const current = await chrome.storage.local.get(['userId', 'authToken', 'trackingEnabled', 'consentGiven']);
  
  console.log('\n📋 Current State:');
  console.log('  User ID:', current.userId || '❌ NOT SET');
  console.log('  Auth Token:', current.authToken ? '✅ Present' : '❌ Missing');
  console.log('  Tracking Enabled:', current.trackingEnabled ? '✅' : '❌');
  console.log('  Consent Given:', current.consentGiven ? '✅' : '❌');
  
  if (!current.authToken || !current.userId) {
    console.error('\n❌ ABORT: You must be logged in first!');
    console.log('   Please login to the extension and try again.');
    return;
  }
  
  if (current.trackingEnabled && current.consentGiven) {
    console.log('\n✅ Good news! Tracking is already enabled.');
    console.log('   No migration needed.');
    
    // Verify aggregator is initialized
    if (typeof interactionAggregator !== 'undefined') {
      if (interactionAggregator.userId) {
        console.log('   Aggregator: ✅ Initialized with user', interactionAggregator.userId);
      } else {
        console.log('   Aggregator: ⚠️ Needs userId');
        interactionAggregator.userId = current.userId;
        interactionAggregator.initialize();
        console.log('   Aggregator: ✅ Now initialized');
      }
    }
    return;
  }
  
  console.log('\n📤 Step 1: Updating server settings...');
  
  try {
    // Update server
    const response = await fetch('http://localhost:3000/api/auth/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${current.authToken}`
      },
      body: JSON.stringify({
        consentGiven: true,
        trackingEnabled: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('✅ Server updated successfully');
    console.log('   User:', data.user.name, '(' + data.user.email + ')');
    
  } catch (error) {
    console.error('❌ Failed to update server:', error.message);
    console.log('\n⚠️ Continuing with local-only update...');
  }
  
  console.log('\n💾 Step 2: Updating local storage...');
  
  await chrome.storage.local.set({
    trackingEnabled: true,
    consentGiven: true
  });
  
  console.log('✅ Local storage updated');
  
  console.log('\n🚀 Step 3: Initializing aggregator...');
  
  if (typeof interactionAggregator !== 'undefined') {
    interactionAggregator.userId = current.userId;
    interactionAggregator.initialize();
    console.log('✅ Aggregator initialized for user:', current.userId);
  } else {
    console.warn('⚠️ Aggregator not found. It will initialize on next reload.');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ MIGRATION COMPLETE!\n');
  console.log('📋 Final State:');
  
  const final = await chrome.storage.local.get(['userId', 'trackingEnabled', 'consentGiven']);
  console.log('  User ID:', final.userId);
  console.log('  Tracking Enabled:', final.trackingEnabled ? '✅' : '❌');
  console.log('  Consent Given:', final.consentGiven ? '✅' : '❌');
  console.log('  Aggregator:', typeof interactionAggregator !== 'undefined' && interactionAggregator.userId ? '✅ Ready' : '⚠️ Will init on reload');
  
  console.log('\n🎉 You can now start tracking interactions!');
  console.log('💡 Open a new tab and interact with web pages to test.');
  console.log('📊 Watch this console for aggregation logs.');
  console.log('='.repeat(60) + '\n');
})();

