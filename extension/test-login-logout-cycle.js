// TEST SCRIPT: Login/Logout Cycle
// ================================
//
// This script tests that tracking settings persist through logout/login
//
// Run this in the Chrome Extension Service Worker console

(async () => {
  console.log('\n🧪 TESTING LOGIN/LOGOUT CYCLE\n' + '='.repeat(60));
  
  // Check current state
  const initial = await chrome.storage.local.get(['userId', 'authToken', 'trackingEnabled', 'consentGiven']);
  
  console.log('\n📋 Initial State:');
  console.log('  User ID:', initial.userId || '❌');
  console.log('  Auth Token:', initial.authToken ? '✅' : '❌');
  console.log('  Tracking Enabled:', initial.trackingEnabled ? '✅' : '❌');
  console.log('  Consent Given:', initial.consentGiven ? '✅' : '❌');
  
  if (!initial.authToken) {
    console.log('\n⚠️ Please login first, then run this test again.');
    return;
  }
  
  if (!initial.trackingEnabled || !initial.consentGiven) {
    console.log('\n⚠️ Tracking not enabled. Expected state:');
    console.log('   - Run the migration script first (enable-tracking-for-existing-user.js)');
    console.log('   - OR click "I Understand" in the consent section');
    return;
  }
  
  console.log('\n✅ Good! Tracking is currently enabled.');
  console.log('\n📝 TEST INSTRUCTIONS:');
  console.log('   1. Click the extension icon');
  console.log('   2. Click "Logout"');
  console.log('   3. Login again with same credentials');
  console.log('   4. Come back here and run this check:');
  console.log('');
  console.log('   (async () => {');
  console.log('     const s = await chrome.storage.local.get(["trackingEnabled", "consentGiven"]);');
  console.log('     console.log("After Login:");');
  console.log('     console.log("  Tracking:", s.trackingEnabled ? "✅ ENABLED" : "❌ DISABLED");');
  console.log('     console.log("  Consent:", s.consentGiven ? "✅ GIVEN" : "❌ NOT GIVEN");');
  console.log('   })();');
  console.log('');
  console.log('   Expected: Both should be ✅');
  console.log('='.repeat(60) + '\n');
})();

