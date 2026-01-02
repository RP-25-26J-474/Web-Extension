// AURA Integration for Sensecheck Game
// This file enables sensecheck to work with AURA's backend and user system

class AuraIntegration {
  constructor() {
    this.userId = null;
    this.token = null;
    this.isAuraMode = false;
    this.auraAPI = 'http://localhost:3000/api/onboarding';
    
    this.initialize();
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
  
  // API call helper
  async callAuraAPI(endpoint, data) {
    if (!this.isEnabled()) {
      throw new Error('Not in AURA mode');
    }
    
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
        const error = await response.json();
        throw new Error(error.error || 'API call failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`AURA API error (${endpoint}):`, error);
      throw error;
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
  
  // Compute and save session summary (all rounds)
  async computeSessionSummary() {
    if (!this.isEnabled()) return null;
    
    console.log('📈 Computing session summary');
    
    return await this.callAuraAPI('motor/summary/session', {});
  }
  
  // Save global interactions (clicks, scrolls, etc. from all modules)
  async saveGlobalInteractions(interactions) {
    if (!this.isEnabled()) return null;
    
    console.log(`🌍 Saving ${interactions.length} global interactions to AURA`);
    
    return await this.callAuraAPI('global/interactions', { interactions });
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
    
    return result;
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

