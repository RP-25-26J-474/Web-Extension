/**
 * QUICK TEST SCRIPT
 * Copy-paste this into the Chrome Extension Service Worker console
 * to immediately check if storage is working
 */

(async () => {
  console.log('\n🔍 AURA EXTENSION QUICK CHECK\n' + '='.repeat(50));
  
  // 1. Check authentication
  const storage = await chrome.storage.local.get(['authToken', 'userId', 'trackingEnabled', 'interactions', 'aggregatedBatches']);
  
  console.log('\n📋 AUTHENTICATION:');
  console.log('  Token:', storage.authToken ? '✅ Present' : '❌ Missing');
  console.log('  User ID:', storage.userId || '❌ Not set');
  console.log('  Tracking:', storage.trackingEnabled ? '✅ Enabled' : '❌ Disabled');
  
  if (!storage.authToken || !storage.userId) {
    console.log('\n⚠️  WARNING: Please login first!');
    console.log('   1. Click extension icon');
    console.log('   2. Register or login');
    console.log('   3. Run this script again');
    return;
  }
  
  // 2. Check aggregator
  console.log('\n📊 AGGREGATOR STATUS:');
  if (typeof interactionAggregator !== 'undefined') {
    console.log('  Loaded: ✅ Yes');
    console.log('  User ID:', interactionAggregator.userId || '❌ Not set');
    console.log('  Queue Size:', interactionAggregator.batchQueue?.length || 0);
    console.log('  Window Active:', interactionAggregator.windowStartTime ? '✅ Yes' : '❌ No');
  } else {
    console.log('  Loaded: ❌ Not available');
  }
  
  // 3. Check local storage
  console.log('\n💾 LOCAL STORAGE:');
  console.log('  Raw Interactions:', storage.interactions?.length || 0);
  console.log('  Pending Batches:', storage.aggregatedBatches?.length || 0);
  
  // 4. Check server connectivity
  console.log('\n🌐 SERVER CHECK:');
  try {
    const response = await fetch('http://localhost:3000/api/auth/me', {
      headers: { 'Authorization': `Bearer ${storage.authToken}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('  Server: ✅ Connected');
      console.log('  User:', data.user?.name || 'Unknown');
      console.log('  Email:', data.user?.email || 'Unknown');
    } else {
      console.log('  Server: ❌ Auth failed (' + response.status + ')');
    }
  } catch (error) {
    console.log('  Server: ❌ Not reachable');
    console.log('  Error:', error.message);
  }
  
  // 5. Test aggregation
  console.log('\n🧪 TESTING AGGREGATION:');
  if (typeof interactionAggregator !== 'undefined' && interactionAggregator.userId) {
    // Simulate some interactions
    console.log('  Simulating 5 click events...');
    for (let i = 0; i < 5; i++) {
      interactionAggregator.trackEvent({
        type: 'click',
        timestamp: Date.now(),
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        url: 'https://test.example.com/page',
        elementTag: 'button'
      });
    }
    console.log('  ✅ Test events tracked');
    console.log('  Queue size now:', interactionAggregator.batchQueue?.length || 0);
  } else {
    console.log('  ❌ Aggregator not ready');
  }
  
  // 6. Overall status
  console.log('\n' + '='.repeat(50));
  
  const ready = storage.authToken && storage.userId && storage.trackingEnabled && 
                (typeof interactionAggregator !== 'undefined' && interactionAggregator.userId);
  
  if (ready) {
    console.log('✅ READY: Extension is tracking and aggregating!');
    console.log('\n📝 NEXT STEPS:');
    console.log('   1. Browse some web pages');
    console.log('   2. Click, scroll, zoom for 30+ seconds');
    console.log('   3. Wait for "Syncing X aggregated batches to server..." message');
    console.log('   4. Check MongoDB for data');
  } else {
    console.log('❌ NOT READY: Setup incomplete');
    console.log('\n🔧 REQUIRED ACTIONS:');
    if (!storage.authToken) console.log('   - Login to the extension');
    if (!storage.userId) console.log('   - Logout and login again (to set userId)');
    if (!storage.trackingEnabled) console.log('   - Enable tracking in extension settings');
    if (typeof interactionAggregator === 'undefined') console.log('   - Reload the extension');
    if (interactionAggregator && !interactionAggregator.userId) console.log('   - Logout and login again');
  }
  
  console.log('='.repeat(50) + '\n');
})();


