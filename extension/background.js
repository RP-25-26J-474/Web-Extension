// Background Service Worker - Processes and stores interaction data
// Handles data from content scripts and manages storage

// Import config and aggregator as ES modules
import { API_CONFIG } from './config.module.js';
import { interactionAggregator } from './interaction-aggregator.js';

// Expose for Service Worker console (verify-tracking-e2e.js, debugging)
if (typeof globalThis !== 'undefined') {
  globalThis.interactionAggregator = interactionAggregator;
}

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

// Broadcast message to all tabs (content scripts) - for user login/logout notification
function broadcastToAllTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore: tab may not have content script (e.g. chrome://, extension pages)
        });
      }
    });
  });
}

// Initialize aggregator with userId; also sync onboardingCompleted from API if logged in
async function initializeAggregator() {
  try {
    const result = await chrome.storage.local.get(['userId', 'authToken']);
    if (result.authToken) {
      console.log('🔐 User authenticated, initializing aggregator with userId:', result.userId);
      await interactionAggregator.initialize();
      scheduleMlProfileFetch();
      // Check onboarding status – only fetch from daily GET API when onboarding complete (login/existing user)
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/onboarding/status`, {
          headers: { Authorization: `Bearer ${result.authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.completed) {
            await chrome.storage.local.set({ onboardingCompleted: true });
            console.log('✅ Onboarding already complete – aggregated/global tracking enabled');
            fetchMlPersonalizedProfile();
          }
        }
      } catch (e) {
        console.debug('Could not fetch onboarding status:', e.message);
      }
    } else {
      console.log('ℹ️ No authentication token found - aggregator will initialize after login');
    }
  } catch (error) {
    console.error('Failed to initialize aggregator:', error);
  }
}

// Listen for authentication changes to initialize aggregator and broadcast to tabs
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace !== 'local' || !changes.authToken) return;
  const { oldValue, newValue } = changes.authToken;
  if (newValue && !oldValue) {
    console.log('✅ User logged in - initializing aggregator');
    await initializeAggregator();
    scheduleMlProfileFetch();
  } else if (!newValue && oldValue) {
    console.log('👋 User logged out - broadcasting to tabs');
    if (interactionAggregator) interactionAggregator.userId = null;
    broadcastToAllTabs({ type: 'USER_LOGGED_OUT' });
    cancelMlProfileFetch();
    await chrome.storage.local.remove(['userId', 'AURA_EXT_ML_PERSONALIZED_PROFILE', 'AURA_EXT_ADAPTIVE_OPTIMIZED_PROFILE']);
  }
});

// ========== ML PERSONALIZED PROFILE – Daily fetch ==========
// When token exists, fetch profile from separate ML component daily.
// Stored as AURA_EXT_ML_PERSONALIZED_PROFILE (no backend in extension – fetches from external API).
const ML_PROFILE_ALARM = 'aura-ml-profile-daily';

function scheduleMlProfileFetch() {
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.create(ML_PROFILE_ALARM, { periodInMinutes: 24 * 60 }); // daily
    console.log('ML profile daily fetch scheduled');
  }
}

function cancelMlProfileFetch() {
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.clear(ML_PROFILE_ALARM).then(() => {
      console.log('ML profile daily fetch cancelled');
    });
  }
}

async function fetchMlPersonalizedProfile() {
  try {
    const result = await chrome.storage.local.get(['authToken', 'userId']);
    if (!result.authToken) return;

    const url = API_CONFIG.ML_PROFILE_API_URL || 'https://ml-profile.example.com/api/profile';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${result.authToken}` },
    });
    if (!res.ok) throw new Error(`ML profile API returned ${res.status}`);
    const json = await res.json();
    // Only store if we have a valid profile (daily GET API has no data for new users until ~24h)
    const profile = json?.profile ?? json;
    if (!profile || typeof profile !== 'object') {
      console.debug('Daily ML profile API did not return valid profile, skipping store');
      return;
    }
    // Preserve full structure { user_id, metadata, profile, profile_changes } from daily API
    const toStore = json.profile != null ? json : { user_id: result.userId ?? 'unknown', metadata: {}, profile, profile_changes: null };
    await chrome.storage.local.set({ AURA_EXT_ML_PERSONALIZED_PROFILE: toStore });
    console.log('ML personalized profile fetched and stored (from daily API)');
  } catch (e) {
    console.debug('Could not fetch ML personalized profile:', e.message);
  }
}

if (typeof chrome !== 'undefined' && chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ML_PROFILE_ALARM) {
      fetchMlPersonalizedProfile();
    }
  });
}

// ========== ML PERSONALIZED PROFILE – Initial fetch on registration ==========
// When impairment profile is created (onboarding completes), POST impairment JSON to
// separate component API and save response.profile as AURA_EXT_ML_PERSONALIZED_PROFILE.
// This runs once; daily fetch (fetchMlPersonalizedProfile) handles periodic updates.
async function fetchInitialMlProfileFromImpairment() {
  try {
    const result = await chrome.storage.local.get(['authToken', 'userId']);
    if (!result.authToken || !result.userId) return;

    const impairmentRes = await fetch(`${API_CONFIG.BASE_URL}/onboarding/impairment-profile`, {
      headers: { Authorization: `Bearer ${result.authToken}` },
    });
    if (!impairmentRes.ok) {
      console.debug('Could not fetch impairment profile for initial ML:', impairmentRes.status);
      return;
    }
    const impairmentData = await impairmentRes.json();
    const impairmentProfile = impairmentData?.data ?? impairmentData;

    const url = API_CONFIG.IMPAIRMENT_TO_ML_PROFILE_API_URL || 'https://impairment-to-ml.example.com/api/profile-from-impairment';
    const mlRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${result.authToken}`,
      },
      body: JSON.stringify(impairmentProfile),
    });
    if (!mlRes.ok) throw new Error(`Impairment-to-ML API returned ${mlRes.status}`);
    const mlJson = await mlRes.json();
    const profile = mlJson?.profile;
    if (!profile || typeof profile !== 'object') {
      console.debug('Impairment-to-ML API did not return profile');
      return;
    }
    const toStore = { user_id: result.userId, metadata: { origin: 'impairment', created_at: new Date().toISOString() }, profile, profile_changes: null };
    await chrome.storage.local.set({ AURA_EXT_ML_PERSONALIZED_PROFILE: toStore });
    console.log('Initial ML personalized profile from impairment stored');
  } catch (e) {
    console.debug('Could not fetch initial ML profile from impairment:', e.message);
  }
}

// SINGLE message listener for all messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Content script interactions
  if (message.type === 'INTERACTION') {
    handleInteraction(message.data, sender.tab);
    sendResponse({ success: true });
    return false;
  }
  
  // Get stats (aggregated batches only – no raw interactions)
  if (message.type === 'GET_STATS') {
    chrome.storage.local.get(['aggregatedBatches']).then(result => {
      sendResponse({ stats: null, recentCount: result.aggregatedBatches?.length || 0 });
    });
    return true;
  }
  
  // Clear data
  if (message.type === 'CLEAR_DATA') {
    clearAllData().then(() => sendResponse({ success: true }));
    return true;
  }
  
  // Export data (aggregated batches only – raw interactions removed)
  if (message.type === 'EXPORT_DATA') {
    chrome.storage.local.get(['aggregatedBatches']).then(result => {
      sendResponse({ interactions: result.aggregatedBatches || [] });
    });
    return true;
  }
  
  // Sync to server (removed – global interactions deprecated, use aggregated batches only)
  if (message.type === 'SYNC_TO_SERVER') {
    sendResponse({ success: true, synced: 0 });
    return false;
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
  
  // Initialize tracking (called when user gives consent or logs in with tracking enabled)
  if (message.type === 'INIT_TRACKING') {
    chrome.storage.local.get(['userId']).then(result => {
      if (result.userId && interactionAggregator) {
        interactionAggregator.userId = result.userId;
        interactionAggregator.initialize();
        console.log('✅ Tracking initialized for user:', result.userId);
        // Sync tracking state to all content scripts so they start capturing
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_TRACKING', enabled: true }).catch(() => {});
            }
          });
        });
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
  
  // Onboarding complete – impairment profile saved; enable tracking and broadcast user registered
  if (message.type === 'ONBOARDING_COMPLETE') {
    console.log('🎉 Onboarding completed! Impairment profile saved.');
    chrome.storage.local.remove('onboardingTabId');
    chrome.storage.local.set({ onboardingCompleted: true }).then(() => {
      console.log('✅ Onboarding completed – aggregated tracking now enabled');
    });
    // Fetch initial ML profile from impairment (POST impairment to separate API, save response.profile)
    fetchInitialMlProfileFromImpairment();
    // Broadcast user registered (impairment profile created) so tabs can refresh ML profile, etc.
    chrome.storage.local.get(['authToken', 'userId', 'userProfile']).then((result) => {
      if (result.authToken && result.userId) {
        broadcastToAllTabs({
          type: 'USER_LOGGED_IN',
          token: result.authToken,
          userId: result.userId,
          user: result.userProfile ? { email: result.userProfile.email, name: result.userProfile.name } : null,
          onboardingComplete: true,
          source: 'registration',
        });
      }
    });
    // Do not auto-close tab – user closes it manually
    sendResponse({ success: true });
    return false;
  }
  
  // Page unload sync (removed – global interactions deprecated)
  if (message.type === 'PAGE_UNLOAD_SYNC') {
    sendResponse({ success: true });
    return false;
  }
  
  // Broadcast token (not userId) on login/register to all tabs (for React app, dashboard, etc.)
  // Also sync tracking state to content scripts so existing tabs start tracking when user logs in with tracking enabled
  if (message.type === 'BROADCAST_USER_LOGIN') {
    broadcastToAllTabs({
      type: 'USER_LOGGED_IN',
      token: message.token,
      userId: message.userId,
      user: message.user,
      source: message.source || 'login',
    });
    chrome.storage.local.get(['trackingEnabled', 'consentGiven']).then((result) => {
      if (result.trackingEnabled && result.consentGiven) {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_TRACKING', enabled: true }).catch(() => {});
            }
          });
        });
      }
    });
    sendResponse({ success: true });
    return false;
  }
  if (message.type === 'BROADCAST_USER_LOGOUT') {
    // Reset aggregator userId immediately so no further batches use stale user
    if (interactionAggregator) interactionAggregator.userId = null;
    // Explicitly clear auth data and ML profiles so logout is reliable even if popup closes early
    chrome.storage.local.remove([
      'authToken',
      'userId',
      'AURA_EXT_ML_PERSONALIZED_PROFILE',
      'AURA_EXT_ADAPTIVE_OPTIMIZED_PROFILE',
    ]).then(() => {
      cancelMlProfileFetch();
      broadcastToAllTabs({ type: 'USER_LOGGED_OUT' });
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_TRACKING', enabled: false }).catch(() => {});
          }
        });
      });
    });
    sendResponse({ success: true });
    return false;
  }

  // Explicit fetch of ML personalized profile (called on login/register from popup)
  if (message.type === 'FETCH_ML_PERSONALIZED_PROFILE') {
    fetchMlPersonalizedProfile().then(() => sendResponse({ success: true }));
    return true;
  }

  // SET_ADAPTIVE_PROFILE_REQUEST – handled in background for authoritative auth check
  // Content script forwards here; background is source of truth for logout state
  if (message.type === 'SET_ADAPTIVE_PROFILE_REQUEST') {
    const profile = message.profile;
    if (!profile || typeof profile !== 'object') {
      sendResponse({ success: false, error: 'Invalid profile' });
      return false;
    }
    chrome.storage.local.get(['authToken', 'userId']).then((result) => {
      const hasAuth = !!(result.authToken && result.userId &&
        String(result.authToken).trim() !== '' &&
        String(result.userId).trim() !== '');
      if (!hasAuth) {
        sendResponse({ success: false, error: 'User must be logged in' });
        return;
      }
      chrome.storage.local.set({ AURA_EXT_ADAPTIVE_OPTIMIZED_PROFILE: profile })
        .then(() => {
          // Broadcast to ALL tabs so every open page picks up the updated profile
          broadcastToAllTabs({
            type: 'AURA_EXT_PROFILE_CHANGED',
            profile,
            source: message.source || 'adaptive-update'
          });
          sendResponse({ success: true });
        })
        .catch((err) => sendResponse({ success: false, error: err?.message || 'Storage failed' }));
    });
    return true;
  }

  return false;
});

// Handle and store interaction data
async function handleInteraction(data, tab) {
  try {
    const result = await chrome.storage.local.get(['trackingEnabled', 'userId', 'onboardingCompleted']);
    
    if (!result.trackingEnabled) {
      return; // Don't store if tracking is disabled
    }

    // Do NOT track aggregated batches or global interactions until onboarding is complete
    if (!result.onboardingCompleted) {
      return;
    }
    
    // ===== NEW: Feed to aggregator for 10-second windowing =====
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
      
      try {
        interactionAggregator.trackEvent(eventWithUrl);
      } catch (err) {
        console.error('❌ Aggregator trackEvent failed:', err);
      }
    } else {
      console.warn('⚠️ InteractionAggregator not available');
    }
    // ===========================================================
    // Aggregated batches only – no global interactions/buckets
  } catch (error) {
    console.error('Failed to handle interaction:', error);
  }
}

// Update extension badge (disabled - not needed)
function updateBadge(pendingCount) {
  // Badge display removed - no visual indicator needed
  return;
}

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

// Clear all stored data (aggregated batches handled by interaction-aggregator)
async function clearAllData() {
  // No interactions/stats to clear – aggregated batches only
}

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


// Sync when browser is about to suspend – aggregated batches handled by interaction-aggregator

