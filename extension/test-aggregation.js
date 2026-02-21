// QUICK FIX TEST: Generate Test Interactions
// ===========================================
//
// Run this in the Service Worker console to test if aggregation works

(async () => {
  console.log('\n🧪 GENERATING TEST INTERACTIONS\n' + '='.repeat(60));
  
  // Check setup
  const storage = await chrome.storage.local.get(['userId', 'trackingEnabled', 'authToken']);
  
  if (!storage.trackingEnabled) {
    console.error('❌ Tracking is disabled! Enable it first.');
    return;
  }
  
  if (!storage.userId) {
    console.error('❌ No userId set! Login first.');
    return;
  }
  
  console.log('✅ Setup OK');
  console.log('   User ID:', storage.userId);
  console.log('   Tracking:', storage.trackingEnabled ? 'Enabled' : 'Disabled');
  
  // Simulate 10 click events
  console.log('\n📤 Simulating 10 click events...');
  
  for (let i = 0; i < 10; i++) {
    const testEvent = {
      type: 'click',
      x: Math.random() * 1000,
      y: Math.random() * 800,
      timestamp: Date.now(),
      elementTag: 'button',
    };
    
    // Send to handleInteraction
    await chrome.runtime.sendMessage({
      type: 'INTERACTION',
      data: testEvent
    });
    
    await new Promise(r => setTimeout(r, 100)); // 100ms delay
  }
  
  console.log('✅ Sent 10 test events');
  
  // Wait for window to close (10 seconds)
  console.log('\n⏳ Waiting 11 seconds for aggregation window to close...');
  
  await new Promise(r => setTimeout(r, 11000));
  
  // Check for batches
  const result = await chrome.storage.local.get(['aggregatedBatches']);
  console.log('\n📊 Results:');
  console.log('   Batches created:', result.aggregatedBatches?.length || 0);
  
  if (result.aggregatedBatches?.length > 0) {
    console.log('   First batch:', JSON.stringify(result.aggregatedBatches[0], null, 2));
    console.log('\n✅ SUCCESS! Aggregation is working!');
    console.log('   Now wait 30 seconds for auto-sync to server...');
  } else {
    console.log('\n❌ No batches created. Check:');
    console.log('   1. Is interactionAggregator.userId set?');
    console.log('   2. Check background.js console for errors');
  }
  
  console.log('='.repeat(60) + '\n');
})();

