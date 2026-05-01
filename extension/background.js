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
const REGISTRATION_FLOW_STATE_KEY = 'registrationFlowState';
const ONBOARDING_COMPLETED_KEY = 'onboardingCompleted';

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[AURA Background] Extension installed:', details.reason);
  
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
  console.log('[AURA Background] Extension startup; initializing aggregator');
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
      console.log('[AURA Background] Authenticated session detected; initializing aggregator for userId:', result.userId);
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
            await chrome.storage.local.set({ [ONBOARDING_COMPLETED_KEY]: true });
            console.log('[AURA Background] Onboarding already complete; aggregated tracking enabled');
            fetchMlPersonalizedProfile();
          }
        }
      } catch (e) {
        console.debug('[AURA Background] Could not fetch onboarding status:', e.message);
      }
    } else {
      console.log('[AURA Background] No auth token found; aggregator will initialize after login');
    }
  } catch (error) {
    console.error('[AURA Background] Failed to initialize aggregator:', error);
  }
}

// Sync current extension profile to ML engine before storage is cleared on logout/browser close.
// Sends required user/session fields to /user/trigger-update and includes feedback overrides when available.
async function syncProfileBeforeLogout(userId) {
  const mlFeedbackUrl = API_CONFIG.ML_SESSION_FEEDBACK_URL || 'https://mlpe.auraui.org/user/trigger-update';
  try {
    const stored = await chrome.storage.local.get([
      'AURA_EXT_ML_PERSONALIZED_PROFILE',
      'AURA_EXT_ADAPTIVE_OPTIMIZED_PROFILE',
    ]);

    const mlStored = stored.AURA_EXT_ML_PERSONALIZED_PROFILE;
    const adaptive = stored.AURA_EXT_ADAPTIVE_OPTIMIZED_PROFILE;

    // /user/trigger-update requires user_id; feedback fields are optional.
    const baseProfile = (mlStored && typeof mlStored === 'object' ? mlStored.profile : null) || {};
    const baseVersion = mlStored?.metadata?.version ?? null;
    const currentProfile = adaptive && typeof adaptive === 'object' ? adaptive : null;

    // Build feedback_overrides only when adaptive profile is present.
    const feedbackOverrides = [];
    if (currentProfile) {
      for (const [attr, baseVal] of Object.entries(baseProfile)) {
        const newVal = currentProfile[attr];
        if (newVal === undefined || newVal === null) continue;
        if (String(newVal) === String(baseVal)) continue;
        feedbackOverrides.push({ attribute: attr, old_value: baseVal, new_value: newVal });
      }
      if (feedbackOverrides.length === 0) {
        console.debug('[AURA Background] No adaptive profile overrides detected; syncing user/session only');
      }
    } else {
      console.debug('[AURA Background] Adaptive profile missing at logout; syncing user/session without overrides');
    }

    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const payload = {
      user_id: userId,
      session_id: `sess_${today}_${userId}`,
      sent_at: new Date().toISOString(),
    };
    if (baseVersion !== null && baseVersion !== undefined) {
      payload.base_profile_version = baseVersion;
    }
    if (feedbackOverrides.length > 0) {
      payload.feedback_overrides = feedbackOverrides;
    }

    console.log('[AURA] Syncing profile changes to ML engine on logout:', payload);
    const mlFeedbackRes = await fetch(mlFeedbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!mlFeedbackRes.ok) {
      throw new Error(`ML session-feedback API returned ${mlFeedbackRes.status}`);
    }

    console.log(`[AURA Background] Sent ${feedbackOverrides.length} profile change(s) to ML engine`);
  } catch (e) {
    console.debug(`[AURA Background] Could not sync profile changes to ML engine on logout (${mlFeedbackUrl}):`, e.message);
  }
}

const LOGOUT_SYNC_DEDUP_WINDOW_MS = 15000;
let lastLogoutSync = { userId: null, at: 0 };

function normalizeUserId(userId) {
  if (userId === null || userId === undefined) return null;
  const normalized = String(userId).trim();
  return normalized || null;
}

async function syncProfileBeforeLogoutOnce(userId, source) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return;

  const now = Date.now();
  if (
    lastLogoutSync.userId === normalizedUserId &&
    now - lastLogoutSync.at < LOGOUT_SYNC_DEDUP_WINDOW_MS
  ) {
    console.debug(`[AURA Background] Skipping duplicate logout sync from ${source} for user ${normalizedUserId}`);
    return;
  }

  lastLogoutSync = { userId: normalizedUserId, at: now };
  await syncProfileBeforeLogout(normalizedUserId);
}

// Listen for authentication changes to initialize aggregator and broadcast to tabs
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace !== 'local' || !changes.authToken) return;
  const { oldValue, newValue } = changes.authToken;
  if (newValue && !oldValue) {
    console.log('[AURA Background] User logged in; initializing aggregator');
    await initializeAggregator();
    scheduleMlProfileFetch();
  } else if (!newValue && oldValue) {
    console.log('[AURA Background] User logged out; broadcasting to tabs');
    // Prefer old userId from this storage event in case authToken and userId were
    // removed together by the popup logout path.
    const changedUserId = changes.userId?.oldValue ?? null;
    const { userId: storedUserId } = await chrome.storage.local.get(['userId']);
    const logoutUserId = storedUserId ?? changedUserId;
    await syncProfileBeforeLogoutOnce(logoutUserId, 'storage.onChanged');
    if (interactionAggregator) interactionAggregator.userId = null;
    broadcastToAllTabs({ type: 'USER_LOGGED_OUT' });
    cancelMlProfileFetch();
    await chrome.storage.local.remove(['userId', 'AURA_EXT_ML_PERSONALIZED_PROFILE', 'AURA_EXT_ADAPTIVE_OPTIMIZED_PROFILE']);
  }
});

// Sync profile diff to ML engine when the browser (or extension) is about to be suspended/closed
chrome.runtime.onSuspend.addListener(() => {
  chrome.storage.local.get(['userId'])
    .then(({ userId }) => {
      if (!userId) return;
      // Fire-and-forget â€” service worker may be terminated before this resolves
      syncProfileBeforeLogoutOnce(userId, 'runtime.onSuspend').catch(() => {});
    });
});
// MV3: onSuspend is not guaranteed to fire before the service worker is killed.
// windows.onRemoved fires reliably when a window closes (including the last window = browser close).
// When the last window closes, remaining.length === 0, so we sync once.
chrome.windows.onRemoved.addListener(() => {
  chrome.windows.getAll().then((remaining) => {
    if (remaining.length > 0) return; // other windows still open, session not ending
    chrome.storage.local.get(['userId']).then(({ userId }) => {
      if (!userId) return;
      syncProfileBeforeLogoutOnce(userId, 'windows.onRemoved').catch(() => {});
    });
  });
});
// ========== ML PERSONALIZED PROFILE â€“ Daily fetch ==========
// For logged-in users, fetch profile from separate ML component daily using user_id.
// Stored as AURA_EXT_ML_PERSONALIZED_PROFILE (no backend in extension â€“ fetches from external API).
const ML_PROFILE_ALARM = 'aura-ml-profile-daily';

function scheduleMlProfileFetch() {
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.create(ML_PROFILE_ALARM, { periodInMinutes: 24 * 60 }); // daily
  }
}

function cancelMlProfileFetch() {
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.clear(ML_PROFILE_ALARM).then(() => {
    });
  }
}

async function fetchMlPersonalizedProfile() {
  try {
    const result = await chrome.storage.local.get(['userId', 'authToken']);
    let userId = result.userId;

    // Fallback for sessions where token exists but userId was not persisted yet.
    if (!userId && result.authToken) {
      try {
        const meRes = await fetch(`${API_CONFIG.BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${result.authToken}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          userId = me?.user?._id || me?.user?.id || null;
          if (userId) {
            await chrome.storage.local.set({ userId });
          }
        }
      } catch (e) {
        console.debug('[AURA Background] Could not hydrate userId before ML profile fetch:', e.message);
      }
    }

    if (!userId) {
      console.debug('[AURA Background] Skipping ML personalized profile fetch; missing userId');
      return;
    }

    const baseUrl = API_CONFIG.ML_PROFILE_API_URL || 'http://localhost:8000/data/current-profile';
    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${separator}user_id=${encodeURIComponent(userId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ML profile API returned ${res.status}`);
    const json = await res.json();
    // Only store if we have a valid profile (daily GET API has no data for new users until ~24h)
    const profile = json?.profile ?? json;
    if (!profile || typeof profile !== 'object') {
      console.debug('[AURA Background] Daily ML profile API did not return valid profile; skipping store');
      return;
    }
    // Preserve full structure { user_id, metadata, profile, profile_changes } from daily API
    const toStore = json.profile != null ? json : { user_id: userId ?? 'unknown', metadata: {}, profile, profile_changes: null };
    await chrome.storage.local.set({ AURA_EXT_ML_PERSONALIZED_PROFILE: toStore });
  } catch (e) {
    console.debug('[AURA Background] Could not fetch ML personalized profile:', e.message);
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
      console.debug('[AURA Background] Could not fetch impairment profile for initial ML:', impairmentRes.status);
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
      console.debug('[AURA Background] Impairment-to-ML API did not return profile');
      return;
    }
    const toStore = { user_id: result.userId, metadata: { origin: 'impairment', created_at: new Date().toISOString() }, profile, profile_changes: null };
    await chrome.storage.local.set({ AURA_EXT_ML_PERSONALIZED_PROFILE: toStore });
    console.log('[AURA Background] Initial ML personalized profile from impairment stored');
  } catch (e) {
    console.debug('[AURA Background] Could not fetch initial ML profile from impairment:', e.message);
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
        console.log('[AURA Background] Tracking initialized for user:', result.userId);
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
        console.warn('[AURA Background] Cannot initialize tracking; missing userId');
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
    (async () => {
      try {
        console.log('[AURA Background] Onboarding completed; impairment profile saved');
        await chrome.storage.local.remove(['onboardingTabId', REGISTRATION_FLOW_STATE_KEY]);
        await chrome.storage.local.set({ [ONBOARDING_COMPLETED_KEY]: true });
        console.log('[AURA Background] Onboarding completed; aggregated tracking enabled');

        // Fetch initial ML profile from impairment (POST impairment to separate API, save response.profile)
        await fetchInitialMlProfileFromImpairment();

        // Broadcast user registered (impairment profile created) so tabs can refresh ML profile, etc.
        const result = await chrome.storage.local.get(['authToken', 'userId', 'userProfile']);
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

        sendResponse({ success: true });
      } catch (error) {
        console.error('[AURA Background] Failed to finalize onboarding:', error);
        sendResponse({ success: false, error: error?.message || 'Failed to finalize onboarding' });
      }
    })();
    return true;
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
    // Use storage userId when present; otherwise accept explicit fallback from popup.
    chrome.storage.local.get(['userId']).then(async ({ userId }) => {
      const logoutUserId = userId ?? message.userId ?? null;
      await syncProfileBeforeLogoutOnce(logoutUserId, 'BROADCAST_USER_LOGOUT');
      return chrome.storage.local.remove([
        'authToken',
        'userId',
        'AURA_EXT_ML_PERSONALIZED_PROFILE',
        'AURA_EXT_ADAPTIVE_OPTIMIZED_PROFILE',
      ]);
    }).then(() => {
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
        console.log('[AURA Background] Aggregator userId set:', result.userId);
      }
      
      // Track event in aggregator WITH URL from tab
      const eventWithUrl = {
        ...data,
        url: tab?.url
      };
      
      try {
        interactionAggregator.trackEvent(eventWithUrl);
      } catch (err) {
        console.error('[AURA Background] Aggregator trackEvent failed:', err);
      }
    } else {
      console.warn('[AURA Background] InteractionAggregator not available');
    }
    // ===========================================================
    // Aggregated batches only – no global interactions/buckets
  } catch (error) {
    console.error('[AURA Background] Failed to handle interaction:', error);
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
      console.log('[AURA Background] Onboarding tab closed:', tabId);
      
      // Clear the stored tab ID
      await chrome.storage.local.remove('onboardingTabId');
      
      // Note: The popup will check onboarding status when it reopens
      // No need to do anything else here
    }
  } catch (error) {
    console.error('[AURA Background] Error handling tab removal:', error);
  }
});


// Sync when browser is about to suspend – aggregated batches handled by interaction-aggregator

