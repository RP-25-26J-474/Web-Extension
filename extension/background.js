// Background Service Worker - Processes and stores interaction data
// Handles data from content scripts and manages storage

const MAX_INTERACTIONS_STORED = 1000; // Limit stored interactions
const EXPORT_BATCH_SIZE = 100;

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Interaction Tracker installed:', details.reason);
  
  // Set default values on install
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
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INTERACTION') {
    handleInteraction(message.data, sender.tab);
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open
});

// Handle and store interaction data
async function handleInteraction(data, tab) {
  try {
    const result = await chrome.storage.local.get(['interactions', 'stats', 'trackingEnabled']);
    
    if (!result.trackingEnabled) {
      return; // Don't store if tracking is disabled
    }
    
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
    
    // Update badge with total count
    updateBadge(stats.totalInteractions);
    
  } catch (error) {
    console.error('Failed to handle interaction:', error);
  }
}

// Update extension badge
function updateBadge(count) {
  if (count > 0) {
    const text = count > 999 ? '999+' : count.toString();
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Clear old data periodically (every 24 hours)
setInterval(async () => {
  try {
    const result = await chrome.storage.local.get(['interactions']);
    let interactions = result.interactions || [];
    
    // Remove interactions older than 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    interactions = interactions.filter(i => i.timestamp > sevenDaysAgo);
    
    await chrome.storage.local.set({ interactions });
    console.log('Cleaned up old interactions');
  } catch (error) {
    console.error('Failed to clean up old data:', error);
  }
}, 24 * 60 * 60 * 1000); // Run every 24 hours

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATS') {
    chrome.storage.local.get(['stats', 'interactions']).then(result => {
      sendResponse({ 
        stats: result.stats, 
        recentCount: result.interactions?.length || 0 
      });
    });
    return true;
  }
  
  if (message.type === 'CLEAR_DATA') {
    clearAllData().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'EXPORT_DATA') {
    chrome.storage.local.get(['interactions']).then(result => {
      sendResponse({ interactions: result.interactions || [] });
    });
    return true;
  }
  
  if (message.type === 'TOGGLE_TRACKING') {
    toggleTracking(message.enabled).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'SET_CONSENT') {
    chrome.storage.local.set({ 
      consentGiven: message.consent,
      trackingEnabled: message.consent // Enable tracking when consent is given
    }).then(() => {
      if (message.consent) {
        updateBadge(0);
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'UPDATE_CONFIG') {
    chrome.storage.local.set({ trackingConfig: message.config }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

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
  
  if (!enabled) {
    chrome.action.setBadgeText({ text: '' });
  }
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
  
  updateBadge(0);
}

// Initialize badge on startup
chrome.storage.local.get(['stats']).then(result => {
  if (result.stats) {
    updateBadge(result.stats.totalInteractions);
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

// Listen for messages from onboarding game (via window.postMessage)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ONBOARDING_COMPLETE') {
    console.log('🎉 Onboarding completed!');
    
    // Clear the onboarding tab ID
    chrome.storage.local.remove('onboardingTabId');
    
    // Close the tab if it's still open
    if (sender.tab?.id) {
      chrome.tabs.remove(sender.tab.id).catch(() => {
        console.log('Tab already closed');
      });
    }
    
    sendResponse({ success: true });
  }
  
  return true;
});

