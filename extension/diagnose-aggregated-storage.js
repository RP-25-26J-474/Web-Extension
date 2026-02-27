// DIAGNOSTIC: Check Why Aggregated Batches Aren't Saving to MongoDB
// ===================================================================
//
// Run this in the Chrome Extension Service Worker console

(async () => {
  console.log('\n🔍 DIAGNOSING AGGREGATED BATCH STORAGE\n' + '='.repeat(60));
  
  // Step 1: Check local storage
  const storage = await chrome.storage.local.get(['aggregatedBatches', 'authToken', 'userId', 'trackingEnabled']);
  
  console.log('\n📦 Step 1: Local Storage Check');
  console.log('  Auth Token:', storage.authToken ? '✅ Present' : '❌ Missing');
  console.log('  User ID:', storage.userId || '❌ NOT SET');
  console.log('  Tracking Enabled:', storage.trackingEnabled ? '✅' : '❌');
  console.log('  Pending Batches:', storage.aggregatedBatches?.length || 0);
  
  if (storage.aggregatedBatches?.length > 0) {
    console.log('\n📦 First pending batch:');
    console.log(JSON.stringify(storage.aggregatedBatches[0], null, 2));
  }
  
  // Step 2: Check aggregator state
  console.log('\n🔧 Step 2: Aggregator State');
  if (typeof interactionAggregator === 'undefined') {
    console.error('  ❌ Aggregator NOT LOADED');
  } else {
    console.log('  User ID:', interactionAggregator.userId || '❌ NOT SET');
    console.log('  Window Active:', interactionAggregator.windowStartTime ? '✅' : '❌');
    console.log('  Batch Queue:', interactionAggregator.batchQueue?.length || 0);
  }
  
  // Step 3: Try manual sync
  if (storage.aggregatedBatches?.length > 0 && storage.authToken) {
    console.log('\n📤 Step 3: Testing Manual Sync to Server...');
    
    try {
      const response = await fetch('http://localhost:3000/api/interactions/aggregated-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storage.authToken}`
        },
        body: JSON.stringify({ batches: storage.aggregatedBatches })
      });
      
      console.log('  Response Status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('  ✅ SUCCESS!', data);
        console.log('  Saved:', data.count, 'batches');
      } else {
        const errorText = await response.text();
        console.error('  ❌ FAILED:', errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          console.error('  Error details:', errorJson);
        } catch (e) {}
      }
    } catch (error) {
      console.error('  ❌ Network error:', error.message);
    }
  } else if (storage.aggregatedBatches?.length === 0) {
    console.log('\n⚠️  Step 3: Skipped (no pending batches)');
    console.log('   Generate some test data first:');
    console.log('   1. Open a new tab');
    console.log('   2. Click and scroll for 10+ seconds');
    console.log('   3. Run this diagnostic again');
  } else {
    console.log('\n❌ Step 3: Skipped (not authenticated)');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 TIP: Check the SERVER console for MongoDB errors');
  console.log('   Look for messages like:');
  console.log('   📊 Received aggregated batches request');
  console.log('   ✅ Successfully saved X aggregated batches to MongoDB');
  console.log('='.repeat(60) + '\n');
})();

