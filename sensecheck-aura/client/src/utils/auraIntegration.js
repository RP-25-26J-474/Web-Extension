// AURA Integration for Sensecheck Game
// This file enables sensecheck to work with AURA's backend and user system

// Message types for extension ↔ web page bridge
const AURA_PING_TIMEOUT_MS = 1000;

class AuraIntegration {
  constructor() {
    this.userId = null;
    this.token = null;
    this.isAuraMode = false;
    this.extensionPresent = false;
    this.auraAPI = 'http://localhost:3000/api/onboarding';
    
    // Request queue to prevent ERR_INSUFFICIENT_RESOURCES
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.MAX_CONCURRENT_REQUESTS = 2; // Browser allows 6, we use 2 to be safe
    this.activeRequests = 0;
    
    this.initialize();
    this.setupExtensionListener();
  }
  
  /** Listen for extension PONG and user updates (login/logout from extension) */
  setupExtensionListener() {
    if (typeof window === 'undefined') return;
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== 'aura-extension') return;
      if (data.type === 'AURA_EXT_PONG') {
        this.extensionPresent = data.extensionPresent === true;
        if (data.loggedIn && data.token) {
          this.token = data.token;
          // userId not broadcast; use token for API calls
          if (!this.isAuraMode) {
            console.log('🔗 AURA extension detected with logged-in user');
          }
        }
      } else if (data.type === 'AURA_EXT_TOKEN_PONG') {
        if (data.token) {
          this.token = data.token;
          this.extensionPresent = true;
          if (!this.isAuraMode) {
            console.log('🔗 AURA token received (from extension)');
          }
        }
      } else if (data.type === 'AURA_USER_UPDATE') {
        if (data.loggedIn && data.token) {
          this.token = data.token;
          this.extensionPresent = true;
          // userId not broadcast; use token for API calls
          console.log('🔗 AURA user logged in (from extension)');
        } else {
          this.userId = null;
          this.token = null;
          this.isAuraMode = false;
          console.log('🔗 AURA user logged out (from extension)');
        }
      }
    });
  }
  
  /**
   * Ping the AURA extension to detect if it's installed.
   * Returns { present: boolean, loggedIn: boolean, user?: { userId, email, name } }.
   * Resolves with present: false if no PONG within timeout.
   */
  checkExtension() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ present: false, loggedIn: false, user: null });
      }, AURA_PING_TIMEOUT_MS);
      const handler = (event) => {
        if (event.source !== window) return;
        if (event.data?.type === 'AURA_EXT_PONG' && event.data?.source === 'aura-extension') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve({
            present: event.data.extensionPresent === true,
            loggedIn: event.data.loggedIn === true,
            token: event.data.token ?? null,
            user: event.data.user ?? null,
          });
        }
      };
      window.addEventListener('message', handler);
      window.postMessage({ type: 'AURA_EXT_PING', source: 'aura-web' }, '*');
    });
  }
  
  /** Check if AURA extension is installed (convenience method) */
  isExtensionPresent() {
    return this.extensionPresent;
  }

  /**
   * Token-only ping-pong: request just the auth token from the extension.
   * Returns { token: string | null }. Resolves with token: null if no PONG within timeout.
   */
  checkToken() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ token: null });
      }, AURA_PING_TIMEOUT_MS);
      const handler = (event) => {
        if (event.source !== window) return;
        if (event.data?.type === 'AURA_EXT_TOKEN_PONG' && event.data?.source === 'aura-extension') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve({ token: event.data.token ?? null });
        }
      };
      window.addEventListener('message', handler);
      window.postMessage({ type: 'AURA_EXT_TOKEN_PING', source: 'aura-web' }, '*');
    });
  }
  
  initialize() {
    // Check URL params first (for initial load from extension)
    const params = new URLSearchParams(window.location.search);
    let userId = params.get('userId');
    let token = params.get('token');
    let mode = params.get('mode');
    
    // If URL params exist, store them in sessionStorage for persistence across navigation
    if (userId && token) {
      sessionStorage.setItem('aura_userId', userId);
      sessionStorage.setItem('aura_token', token);
      sessionStorage.setItem('aura_mode', mode || 'aura');
      console.log('🔑 AURA credentials stored in session');
    } else {
      // Try to restore from sessionStorage (for after React Router navigation)
      userId = sessionStorage.getItem('aura_userId');
      token = sessionStorage.getItem('aura_token');
      mode = sessionStorage.getItem('aura_mode');
      if (userId && token) {
        console.log('🔑 AURA credentials restored from session');
      }
    }
    
    this.userId = userId;
    this.token = token;
    this.isAuraMode = mode === 'aura';
    
    if (this.isAuraMode && (!this.userId || !this.token)) {
      console.error('AURA mode enabled but missing userId or token');
      this.showError('Invalid onboarding link. Please register again.');
    }
    
    console.log('🌟 AURA Integration initialized:', {
      isAuraMode: this.isAuraMode,
      userId: this.userId ? 'present' : 'missing',
      token: this.token ? 'present' : 'missing',
    });
  }
  
  showError(message) {
    alert(message);
  }
  
  // Check if running in AURA mode
  isEnabled() {
    return this.isAuraMode && this.userId && this.token;
  }
  
  // Get the auth token (for API calls)
  getToken() {
    return this.token;
  }
  
  // Get userId (replaces sessionId in AURA mode)
  getUserId() {
    return this.userId;
  }
  
  // Queued API call - prevents too many concurrent requests
  async callAuraAPI(endpoint, data) {
    if (!this.isEnabled()) {
      throw new Error('Not in AURA mode');
    }
    
    // Add to queue and wait for turn
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        endpoint,
        data,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }
  
  // Process queued requests with concurrency limit
  async processQueue() {
    // Already at max concurrent requests
    if (this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
      return;
    }
    
    // Nothing in queue
    if (this.requestQueue.length === 0) {
      return;
    }
    
    // Get next request from queue
    const { endpoint, data, resolve, reject } = this.requestQueue.shift();
    this.activeRequests++;
    
    try {
      const response = await fetch(`${this.auraAPI}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'API call failed' }));
        throw new Error(error.error || 'API call failed');
      }
      
      const result = await response.json();
      resolve(result);
    } catch (error) {
      console.error(`AURA API error (${endpoint}):`, error.message);
      reject(error);
    } finally {
      this.activeRequests--;
      // Process next request in queue
      this.processQueue();
    }
  }
  
  // Start onboarding session
  async startSession(deviceInfo) {
    if (!this.isEnabled()) return null;
    
    console.log('🚀 Starting AURA onboarding session');
    
    return await this.callAuraAPI('start', {
      device: deviceInfo.device,
      screen: deviceInfo.screen,
      game: deviceInfo.game,
      perf: deviceInfo.perf,
      viewportWidth: deviceInfo.viewportWidth,
      viewportHeight: deviceInfo.viewportHeight,
      highContrastMode: deviceInfo.highContrastMode,
      reducedMotionPreference: deviceInfo.reducedMotionPreference,
    });
  }
  
  // ========== BUCKET-BASED MOTOR SKILLS METHODS (Sensecheck-Compatible) ==========
  
  // Save pointer trace samples (raw pointer data)
  async savePointerSamples(samples) {
    if (!this.isEnabled()) return null;
    
    console.log(`🖱️ Saving ${samples.length} pointer samples to AURA`);
    
    return await this.callAuraAPI('motor/trace', { samples });
  }
  
  // Save motor attempts (will trigger automatic feature extraction)
  async saveMotorAttempts(attempts) {
    if (!this.isEnabled()) return null;
    
    console.log(`🎯 Saving ${attempts.length} motor attempts to AURA`);
    
    return await this.callAuraAPI('motor/attempts', { attempts });
  }
  
  // Compute and save round summary
  async computeRoundSummary(round) {
    if (!this.isEnabled()) return null;
    
    console.log(`📊 Computing round ${round} summary`);
    
    return await this.callAuraAPI('motor/summary/round', { round });
  }
  
  // Compute and save session summary (all rounds). Optional perf/viewport for ML feature vector.
  async computeSessionSummary(opts = {}) {
    if (!this.isEnabled()) return null;
    
    console.log('📈 Computing session summary');
    
    const body = {};
    if (opts.perf && typeof opts.perf === 'object') body.perf = opts.perf;
    if (opts.viewportWidth != null) body.viewportWidth = opts.viewportWidth;
    if (opts.viewportHeight != null) body.viewportHeight = opts.viewportHeight;
    if (typeof opts.highContrastMode === 'boolean') body.highContrastMode = opts.highContrastMode;
    if (typeof opts.reducedMotionPreference === 'boolean') body.reducedMotionPreference = opts.reducedMotionPreference;
    return await this.callAuraAPI('motor/summary/session', body);
  }
  
  // ========== LEGACY METHODS (kept for backward compatibility) ==========
  
  // Save motor skills results (legacy - use bucket methods above instead)
  async saveMotorResults(attempts, roundSummaries, overallMetrics) {
    if (!this.isEnabled()) return null;
    
    console.log('💪 Saving motor skills results to AURA (legacy method)');
    
    return await this.callAuraAPI('motor', {
      attempts,
      roundSummaries,
      overallMetrics,
    });
  }
  
  // Save literacy results
  async saveLiteracyResults(responses, score, metrics, categoryScores) {
    if (!this.isEnabled()) return null;
    
    console.log('📚 Saving literacy results to AURA');
    
    return await this.callAuraAPI('literacy', {
      responses,
      score,
      metrics,
      categoryScores,
    });
  }
  
  // Save vision results
  async saveVisionResults(colorBlindness, visualAcuity, testConditions) {
    if (!this.isEnabled()) return null;
    
    console.log('👁️ Saving vision results to AURA');
    
    return await this.callAuraAPI('vision', {
      colorBlindness,
      visualAcuity,
      testConditions,
    });
  }
  
  // Complete onboarding
  async completeOnboarding() {
    if (!this.isEnabled()) return null;
    
    console.log('✅ Completing AURA onboarding');
    
    const result = await this.callAuraAPI('complete', {});
    
    // Notify extension (if opened from extension)
    if (window.opener) {
      window.opener.postMessage({
        type: 'AURA_ONBOARDING_COMPLETE',
        overallScore: result.overallScore,
      }, '*');
    }
    
    // Also post to window so content script (on same page) can relay to extension background
    window.postMessage({ type: 'AURA_ONBOARDING_COMPLETE', overallScore: result?.overallScore }, '*');
    
    return result;
  }

  /**
   * Call ML motor-score for impairment profile. Call right after motor game completes.
   * Fetches feature vector from server, then POSTs to ML service.
   */
  async callMotorScore() {
    if (!this.isEnabled()) return null;
    
    const apiBase = this.auraAPI.replace('/onboarding', '');
    try {
      const fvRes = await fetch(`${apiBase}/onboarding/motor/feature-vector`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!fvRes.ok) {
        console.warn('Motor feature vector not ready:', fvRes.status);
        return null;
      }
      const { data: featureRow } = await fvRes.json();
      if (!featureRow) return null;
      
      const scoreRes = await fetch(`${apiBase}/ml/motor-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(featureRow),
      });
      if (!scoreRes.ok) {
        console.warn('ML motor-score failed:', scoreRes.status);
        return null;
      }
      const result = await scoreRes.json();
      console.log('✅ ML motor-score called, impairment profile updated:', result?.motor_profile);
      return result;
    } catch (err) {
      console.error('callMotorScore error:', err);
      return null;
    }
  }
  
  // Redirect back to extension or show completion message
  redirectToExtension() {
    if (window.opener) {
      // Opened from extension - close tab and notify
      window.opener.postMessage({ type: 'AURA_ONBOARDING_COMPLETE' }, '*');
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      // Opened directly - show message
      alert('Onboarding completed! You can now close this tab and return to the AURA extension.');
    }
  }
}

// Create global instance
const auraIntegration = new AuraIntegration();

// Export for ES modules
export default auraIntegration;

// Also make available globally
if (typeof window !== 'undefined') {
  window.auraIntegration = auraIntegration;
}

