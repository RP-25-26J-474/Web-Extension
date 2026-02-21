/**
 * Verification Script for AURA Extension
 * 
 * This script verifies that:
 * 1. Aggregated interactions are being stored in MongoDB
 * 2. Global interactions are being stored in MongoDB
 * 
 * Run this in the Chrome Extension Service Worker console or as a standalone script
 */

const VERIFY_CONFIG = {
  API_BASE_URL: 'http://localhost:3000/api',
  CHECK_INTERVAL: 5000, // Check every 5 seconds
  TEST_DURATION: 60000, // Run for 60 seconds
};

class ExtensionVerifier {
  constructor() {
    this.startTime = Date.now();
    this.results = {
      aggregatedBatches: { checked: 0, found: 0, errors: [] },
      globalInteractions: { checked: 0, found: 0, errors: [] },
    };
  }

  /**
   * Main verification loop
   */
  async run() {
    console.log('🔍 Starting AURA Extension Verification...');
    console.log('⏱️ Test duration:', VERIFY_CONFIG.TEST_DURATION / 1000, 'seconds');
    console.log('');
    
    // Get auth token
    const authToken = await this.getAuthToken();
    if (!authToken) {
      console.error('❌ No authentication token found. Please log in first.');
      return;
    }
    
    console.log('✅ Authentication token found');
    console.log('');
    
    // Run checks periodically
    const intervalId = setInterval(async () => {
      await this.checkAll(authToken);
      
      // Stop after test duration
      if (Date.now() - this.startTime > VERIFY_CONFIG.TEST_DURATION) {
        clearInterval(intervalId);
        this.printFinalReport();
      }
    }, VERIFY_CONFIG.CHECK_INTERVAL);
    
    // Run first check immediately
    await this.checkAll(authToken);
  }

  /**
   * Get auth token from chrome storage
   */
  async getAuthToken() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(['authToken']);
      return result.authToken;
    }
    // Fallback for non-extension context
    const token = prompt('Enter your auth token:');
    return token;
  }

  /**
   * Check all verification points
   */
  async checkAll(authToken) {
    console.log(`\n📊 Check #${this.results.aggregatedBatches.checked + 1} (${Math.floor((Date.now() - this.startTime) / 1000)}s elapsed)`);
    console.log('═'.repeat(60));
    
    await Promise.all([
      this.checkAggregatedBatches(authToken),
      this.checkGlobalInteractions(authToken),
      this.checkLocalStorage(),
    ]);
  }

  /**
   * Check aggregated batches in MongoDB
   */
  async checkAggregatedBatches(authToken) {
    this.results.aggregatedBatches.checked++;
    
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const start = today.toISOString().split('T')[0];
      const end = tomorrow.toISOString().split('T')[0];
      
      const response = await fetch(
        `${VERIFY_CONFIG.API_BASE_URL}/interactions/aggregated-batches?start=${start}&end=${end}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const count = data.count || data.batches?.length || 0;
      
      if (count > 0) {
        this.results.aggregatedBatches.found += count;
        console.log(`✅ Aggregated Batches: ${count} found (Total: ${this.results.aggregatedBatches.found})`);
        
        // Show sample if available
        if (data.batches && data.batches.length > 0) {
          const latest = data.batches[data.batches.length - 1];
          console.log(`   Latest batch:`, {
            batch_id: latest.batch_id,
            captured_at: latest.captured_at,
            click_count: latest.events_agg?.click_count,
            domain: latest.page_context?.domain,
          });
        }
      } else {
        console.log(`⚠️  Aggregated Batches: None found yet`);
      }
      
    } catch (error) {
      this.results.aggregatedBatches.errors.push(error.message);
      console.error(`❌ Aggregated Batches Error:`, error.message);
    }
  }

  /**
   * Check global interactions in MongoDB
   */
  async checkGlobalInteractions(authToken) {
    this.results.globalInteractions.checked++;
    
    try {
      const response = await fetch(
        `${VERIFY_CONFIG.API_BASE_URL}/onboarding/global/interactions?page=1&limit=10`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const count = data.data?.pagination?.total || 0;
      
      if (count > 0) {
        this.results.globalInteractions.found = count;
        console.log(`✅ Global Interactions: ${count} total`);
        
        // Show sample if available
        if (data.data?.interactions && data.data.interactions.length > 0) {
          const latest = data.data.interactions[data.data.interactions.length - 1];
          console.log(`   Latest interaction:`, {
            type: latest.eventType,
            module: latest.module,
            timestamp: latest.timestamp,
          });
        }
      } else {
        console.log(`⚠️  Global Interactions: None found yet`);
      }
      
    } catch (error) {
      this.results.globalInteractions.errors.push(error.message);
      console.error(`❌ Global Interactions Error:`, error.message);
    }
  }

  /**
   * Check local chrome storage
   */
  async checkLocalStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get([
          'interactions',
          'aggregatedBatches',
          'trackingEnabled',
          'userId'
        ]);
        
        console.log(`📦 Local Storage:`);
        console.log(`   Tracking Enabled: ${result.trackingEnabled ? '✅' : '❌'}`);
        console.log(`   User ID: ${result.userId || 'Not set'}`);
        console.log(`   Raw Interactions: ${result.interactions?.length || 0}`);
        console.log(`   Aggregated Batches (pending): ${result.aggregatedBatches?.length || 0}`);
        
      } catch (error) {
        console.error(`❌ Local Storage Error:`, error.message);
      }
    } else {
      console.log(`ℹ️  Local Storage: Not available (not running in extension context)`);
    }
  }

  /**
   * Print final report
   */
  printFinalReport() {
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('📋 FINAL VERIFICATION REPORT');
    console.log('═'.repeat(60));
    console.log('');
    
    console.log('Aggregated Batches:');
    console.log(`  Checks performed: ${this.results.aggregatedBatches.checked}`);
    console.log(`  Total found: ${this.results.aggregatedBatches.found}`);
    console.log(`  Errors: ${this.results.aggregatedBatches.errors.length}`);
    if (this.results.aggregatedBatches.errors.length > 0) {
      console.log(`  Error messages:`, this.results.aggregatedBatches.errors);
    }
    console.log('');
    
    console.log('Global Interactions:');
    console.log(`  Checks performed: ${this.results.globalInteractions.checked}`);
    console.log(`  Total found: ${this.results.globalInteractions.found}`);
    console.log(`  Errors: ${this.results.globalInteractions.errors.length}`);
    if (this.results.globalInteractions.errors.length > 0) {
      console.log(`  Error messages:`, this.results.globalInteractions.errors);
    }
    console.log('');
    
    // Overall status
    const aggregatedOK = this.results.aggregatedBatches.found > 0;
    const globalOK = this.results.globalInteractions.found > 0;
    
    if (aggregatedOK && globalOK) {
      console.log('✅ PASS: Both aggregated batches and global interactions are being stored!');
    } else if (aggregatedOK) {
      console.log('⚠️  PARTIAL: Aggregated batches OK, but global interactions not found');
    } else if (globalOK) {
      console.log('⚠️  PARTIAL: Global interactions OK, but aggregated batches not found');
    } else {
      console.log('❌ FAIL: Neither aggregated batches nor global interactions are being stored');
      console.log('');
      console.log('Troubleshooting:');
      console.log('1. Check if tracking is enabled (extension icon → settings)');
      console.log('2. Make sure you are logged in');
      console.log('3. Use the extension on various web pages for at least 30 seconds');
      console.log('4. Check service worker console for errors');
      console.log('5. Check server logs for incoming requests');
    }
    
    console.log('');
    console.log('═'.repeat(60));
  }
}

// Auto-run if in extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('🚀 Running in Chrome Extension context');
  const verifier = new ExtensionVerifier();
  verifier.run();
} else {
  console.log('ℹ️  To run this script:');
  console.log('1. Open chrome://extensions/');
  console.log('2. Click "service worker" link under AURA extension');
  console.log('3. Paste this entire script into the console');
  console.log('4. Press Enter');
  console.log('');
  console.log('Or create a verifier instance manually:');
  console.log('  const verifier = new ExtensionVerifier();');
  console.log('  verifier.run();');
}

// Export for manual use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExtensionVerifier };
}


