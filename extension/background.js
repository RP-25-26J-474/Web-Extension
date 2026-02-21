// Background Service Worker - Processes and stores interaction data
// Handles data from content scripts and manages storage

// Import config and aggregator as ES modules
import { API_CONFIG } from './config.module.js';
import { interactionAggregator } from './interaction-aggregator.js';

const MAX_INTERACTIONS_STORED = 1000; // Limit stored interactions
const EXPORT_BATCH_SIZE = 100;

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Interaction Tracker installed:', details.reason);
  
  // Set default values on install - ALL tracking enabled by default
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      consentGiven: false,
      trackingEnabled: false,
      trackingConfig: {
        clicks: true,
        keystrokes: true,
        mouseMovements: true,
        pageViews: true,
        doubleClicks: true,
        rightClicks: true,
        mouseHovers: true,
        dragAndDrop: true,
        touchEvents: true,
        zoomEvents: true
      },
      interactions: []
    });
  }
  
  // Ensure tracking config always has all options enabled (for upgrades)
  const result = await chrome.storage.local.get(['trackingConfig']);
  if (!result.trackingConfig) {
    await chrome.storage.local.set({
      trackingConfig: {
        clicks: true,
        keystrokes: true,
        mouseMovements: true,
        pageViews: true,
        doubleClicks: true,
        rightClicks: true,
        mouseHovers: true,
        dragAndDrop: true,
        touchEvents: true,
        zoomEvents: true
      }
    });
  }
  
  // Initialize aggregator
  await initializeAggregator();
});

// Initialize aggregator on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension startup - initializing aggregator');
  await initializeAggregator();
});

// Initialize aggregator with userId
async function initializeAggregator() {
  try {
    const result = await chrome.storage.local.get(['userId', 'authToken']);
    if (result.authToken) {
      console.log('🔐 User authenticated, initializing aggregator with userId:', result.userId);
      await interactionAggregator.initialize();
    } else {
      console.log('ℹ️ No authentication token found - aggregator will initialize after login');
    }
  } catch (error) {
    console.error('Failed to initialize aggregator:', error);
  }
}

// Listen for authentication changes to initialize aggregator
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local' && changes.authToken) {
    if (changes.authToken.newValue && !changes.authToken.oldValue) {
      console.log('✅ User logged in - initializing aggregator');
      await initializeAggregator();
    }
  }
});

// SINGLE message listener for all messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Content script interactions
  if (message.type === 'INTERACTION') {
    handleInteraction(message.data, sender.tab);
    sendResponse({ success: true });
    return false;
  }
  
  // Get stats
  if (message.type === 'GET_STATS') {
    chrome.storage.local.get(['stats', 'interactions']).then(result => {
      sendResponse({ stats: result.stats, recentCount: result.interactions?.length || 0 });
    });
    return true;
  }
  
  // Clear data
  if (message.type === 'CLEAR_DATA') {
    clearAllData().then(() => sendResponse({ success: true }));
    return true;
  }
  
  // Export data
  if (message.type === 'EXPORT_DATA') {
    chrome.storage.local.get(['interactions']).then(result => {
      sendResponse({ interactions: result.interactions || [] });
    });
    return true;
  }
  
  // Sync to server
  if (message.type === 'SYNC_TO_SERVER') {
    syncInteractionsToServer().then(result => sendResponse(result));
    return true;
  }
  
  // Toggle tracking
  if (message.type === 'TOGGLE_TRACKING') {
    toggleTracking(message.enabled).then(() => sendResponse({ success: true }));
    return true;
  }
  
  // Set consent
  if (message.type === 'SET_CONSENT') {
    const storageUpdate = { 
      consentGiven: message.consent,
      trackingEnabled: message.consent
    };
    if (message.consent) {
      storageUpdate.trackingConfig = {
        clicks: true, keystrokes: true, mouseMovements: true,
        pageViews: true, doubleClicks: true, rightClicks: true,
        mouseHovers: true, dragAndDrop: true, touchEvents: true, zoomEvents: true
      };
    }
    chrome.storage.local.set(storageUpdate).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Initialize tracking (called when user gives consent)
  if (message.type === 'INIT_TRACKING') {
    chrome.storage.local.get(['userId']).then(result => {
      if (result.userId && interactionAggregator) {
        interactionAggregator.userId = result.userId;
        interactionAggregator.initialize();
        console.log('✅ Tracking initialized for user:', result.userId);
        sendResponse({ success: true, userId: result.userId });
      } else {
        console.warn('⚠️ Cannot initialize tracking: missing userId');
        sendResponse({ success: false, error: 'Missing userId' });
      }
    });
    return true;
  }
  
  // Update config
  if (message.type === 'UPDATE_CONFIG') {
    chrome.storage.local.set({ trackingConfig: message.config }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Onboarding complete
  if (message.type === 'ONBOARDING_COMPLETE') {
    console.log('🎉 Onboarding completed!');
    chrome.storage.local.remove('onboardingTabId');
    if (sender.tab?.id) {
      chrome.tabs.remove(sender.tab.id).catch(() => {});
    }
    sendResponse({ success: true });
    return false;
  }
  
  // Page unload sync
  if (message.type === 'PAGE_UNLOAD_SYNC') {
    syncInteractionsToServer().then(result => sendResponse(result));
    return true;
  }
  
  return false;
});

// Handle and store interaction data
async function handleInteraction(data, tab) {
  try {
    const result = await chrome.storage.local.get(['interactions', 'stats', 'trackingEnabled', 'userId']);
    
    if (!result.trackingEnabled) {
      return; // Don't store if tracking is disabled
    }
    
    // ===== NEW: Feed to aggregator for 10-second windowing =====
    console.log('🔍 DEBUG: Checking aggregator...', {
      aggregatorExists: typeof interactionAggregator !== 'undefined',
      hasUserId: !!interactionAggregator?.userId,
      eventType: data.type,
      tabUrl: tab?.url,
    });
    
    if (typeof interactionAggregator !== 'undefined') {
      // Ensure aggregator has userId
      if (!interactionAggregator.userId && result.userId) {
        interactionAggregator.userId = result.userId;
        console.log('📋 Set aggregator userId:', result.userId);
      }
      
      // Track event in aggregator WITH URL from tab
      const eventWithUrl = {
        ...data,
        url: tab?.url
      };
      
      console.log('📊 Sending to aggregator:', eventWithUrl.type, 'on', eventWithUrl.url);
      
      try {
        interactionAggregator.trackEvent(eventWithUrl);
        console.log('✅ Aggregator received event');
      } catch (err) {
        console.error('❌ Aggregator trackEvent failed:', err);
      }
    } else {
      console.warn('⚠️ InteractionAggregator not available');
    }
    // ===========================================================
    
    let interactions = result.interactions || [];
    let stats = result.stats || {
      totalInteractions: 0,
      clicks: 0,
      keystrokes: 0,
      mouseMovements: 0,
      pageViews: 0,
      doubleClicks: 0,
      rightClicks: 0,
      mouseHovers: 0,
      dragAndDrop: 0,
      touchEvents: 0,
      zoomEvents: 0
    };
    
    // Add tab information
    const interaction = {
      ...data,
      tabId: tab?.id,
      tabUrl: tab?.url
    };
    
    // Add to interactions array
    interactions.push(interaction);
    
    // Limit stored interactions (FIFO)
    if (interactions.length > MAX_INTERACTIONS_STORED) {
      interactions = interactions.slice(-MAX_INTERACTIONS_STORED);
    }
    
    // Update statistics
    stats.totalInteractions++;
    switch (data.type) {
      case 'click':
      case 'mouse_down':
      case 'mouse_up':
        stats.clicks++;
        break;
      case 'keypress':
        stats.keystrokes++;
        break;
      case 'mouse_move':
      case 'scroll':
        stats.mouseMovements++;
        break;
      case 'page_view':
      case 'page_unload':
        stats.pageViews++;
        break;
      case 'double_click':
        stats.doubleClicks++;
        break;
      case 'right_click':
        stats.rightClicks++;
        break;
      case 'mouse_enter':
      case 'mouse_leave':
        stats.mouseHovers++;
        break;
      case 'drag_start':
      case 'drag_end':
      case 'drag_over':
      case 'drop':
        stats.dragAndDrop++;
        break;
      case 'touch_start':
      case 'touch_move':
      case 'touch_end':
      case 'touch_cancel':
      case 'swipe':
      case 'pinch':
        stats.touchEvents++;
        break;
      case 'browser_zoom':
      case 'wheel_zoom':
      case 'keyboard_zoom':
      case 'visual_viewport_zoom':
        stats.zoomEvents++;
        break;
    }
    
    // Store updated data
    await chrome.storage.local.set({ interactions, stats });
    
    // Trigger immediate sync if buffer reaches threshold (50 interactions)
    const SYNC_THRESHOLD = 50;
    if (interactions.length >= SYNC_THRESHOLD) {
      console.log(`📊 Buffer threshold reached (${interactions.length}), triggering immediate sync...`);
      syncInteractionsToServer().catch(err => console.error('Threshold sync failed:', err));
    }
    
  } catch (error) {
    console.error('Failed to handle interaction:', error);
  }
}

// Update extension badge (disabled - not needed)
function updateBadge(pendingCount) {
  // Badge display removed - no visual indicator needed
  return;
}

// Auto-sync interactions to server (every 30 seconds)
setInterval(async () => {
  try {
    const result = await chrome.storage.local.get(['interactions', 'authToken', 'trackingEnabled']);
    
    // Only sync if tracking is enabled and user is logged in
    if (!result.trackingEnabled || !result.authToken) {
      return;
  }
    
    const interactions = result.interactions || [];
    
    if (interactions.length === 0) {
      return; // Nothing to sync
    }
    
    console.log(`🔄 Auto-syncing ${interactions.length} interactions...`);
    
    // Sync and flush
    const syncResult = await syncInteractionsToServer();
    
    if (syncResult.success && syncResult.synced > 0) {
      console.log(`✅ Auto-synced ${syncResult.synced} interactions`);
    }
  } catch (error) {
    console.error('Auto-sync failed:', error);
  }
}, API_CONFIG?.SYNC_INTERVAL || 30000); // Sync every 30 seconds


// Toggle tracking on/off
async function toggleTracking(enabled) {
  await chrome.storage.local.set({ trackingEnabled: enabled });
  
  // Notify all tabs
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_TRACKING',
      enabled: enabled
    }).catch(() => {
      // Ignore errors for tabs that don't have content script
    });
  });
  
  // Badge updates removed - not needed
}

// Clear all stored data
async function clearAllData() {
  await chrome.storage.local.set({
    interactions: [],
    stats: {
      totalInteractions: 0,
      clicks: 0,
      keystrokes: 0,
      mouseMovements: 0,
      pageViews: 0,
      doubleClicks: 0,
      rightClicks: 0,
      mouseHovers: 0,
      dragAndDrop: 0,
      touchEvents: 0,
      zoomEvents: 0
    }
  });
  
  // Badge updates removed - not needed
}

// Sync interactions to server (uses GlobalInteractionBucket)
// Automatically flushes local data after successful sync
async function syncInteractionsToServer() {
  try {
    const result = await chrome.storage.local.get(['interactions', 'authToken', 'stats']);
    
    if (!result.authToken) {
      console.log('⚠️ Not logged in, skipping sync');
      return { success: false, reason: 'not_logged_in' };
    }
    
    const interactions = result.interactions || [];
    
    if (interactions.length === 0) {
      return { success: true, synced: 0 };
    }
    
    console.log(`📤 Syncing ${interactions.length} interactions to server...`);
    
    // Send in batches to avoid overwhelming the server
    const BATCH_SIZE = API_CONFIG?.BATCH_SIZE || 50;
    let totalSynced = 0;
    let syncedIndices = [];
    
    for (let i = 0; i < interactions.length; i += BATCH_SIZE) {
      const batch = interactions.slice(i, i + BATCH_SIZE);
      
      // Transform to GlobalInteractionBucket format
      const transformedBatch = batch.map(interaction => ({
        eventType: interaction.type,
        module: 'extension',
        timestamp: interaction.timestamp || new Date(),
        data: {
          position: { x: interaction.x || null, y: interaction.y || null },
          screenPosition: { x: interaction.screenX || null, y: interaction.screenY || null },
          url: interaction.url,
          title: interaction.pageTitle,
          screen: 'browser',
          target: {
            tag: interaction.elementTag,
            id: interaction.elementId,
            class: interaction.elementClass,
            text: interaction.elementText,
          },
          key: interaction.key,
          code: interaction.code,
          button: interaction.button,
          touchCount: interaction.touchCount,
          scale: interaction.scale,
          zoomLevel: interaction.zoomLevel,
          direction: interaction.direction,
          distance: interaction.distance,
          scrollX: interaction.scrollX,
          scrollY: interaction.scrollY,
          dragType: interaction.dragType,
          action: interaction.action,
          metadata: interaction.metadata,
        },
      }));
      
      // Send to server
      const response = await fetch(`${API_CONFIG.BASE_URL}/onboarding/global/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.authToken}`,
        },
        body: JSON.stringify({ interactions: transformedBatch }),
      });
      
      if (response.ok) {
        totalSynced += batch.length;
        // Track which indices were synced
        for (let j = i; j < i + batch.length; j++) {
          syncedIndices.push(j);
        }
      } else {
        console.error('❌ Sync batch failed:', await response.text());
        // Stop syncing on first failure to prevent data loss
        break;
      }
    }
    
    // FLUSH: Remove synced interactions from local storage immediately
    if (totalSynced > 0) {
      // Keep only interactions that weren't synced
      const remainingInteractions = interactions.filter((_, idx) => !syncedIndices.includes(idx));
      
      // Update storage - clear synced data
      await chrome.storage.local.set({ 
        interactions: remainingInteractions,
        lastSyncTime: Date.now()
      });
      
      console.log(`✅ Synced & flushed ${totalSynced} interactions. ${remainingInteractions.length} remaining.`);
    }
    
    return { success: true, synced: totalSynced };
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return { success: false, error: error.message };
  }
}

// Initialize badge on startup and trigger initial sync
chrome.storage.local.get(['interactions', 'authToken']).then(async (result) => {
  const pendingCount = (result.interactions || []).length;
  
  // Trigger initial sync if user is logged in and has pending data
  if (result.authToken && pendingCount > 0) {
    console.log('🚀 Extension started, syncing pending interactions...');
    await syncInteractionsToServer();
  }
});

// Listen for tab removal (when onboarding game closes)
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    const result = await chrome.storage.local.get(['onboardingTabId']);
    
    if (result.onboardingTabId === tabId) {
      console.log('🎮 Onboarding tab closed:', tabId);
      
      // Clear the stored tab ID
      await chrome.storage.local.remove('onboardingTabId');
      
      // Note: The popup will check onboarding status when it reopens
      // No need to do anything else here
    }
  } catch (error) {
    console.error('Error handling tab removal:', error);
  }
});


// Sync when browser is about to suspend (for graceful shutdown)
chrome.runtime.onSuspend?.addListener(() => {
  console.log('🔄 Browser suspending, syncing data...');
  syncInteractionsToServer();
});

