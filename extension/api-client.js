// API Helper Functions for Extension
class APIClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.token = null;
  }

  formatErrorMessage(data, response) {
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors
        .map((entry) => {
          const field = entry?.path || entry?.param || 'field';
          const message = entry?.msg || 'Invalid value';
          return `${field}: ${message}`;
        })
        .join(', ');
    }

    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }

    if (data?.error && typeof data.error === 'object') {
      if (typeof data.error.message === 'string' && data.error.message.trim()) {
        return data.error.message.trim();
      }
      return JSON.stringify(data.error);
    }

    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }

    if (data?.message && typeof data.message === 'object') {
      return JSON.stringify(data.message);
    }

    if (typeof data?.raw === 'string' && data.raw.trim()) {
      return data.raw.trim().slice(0, 200);
    }

    if (data && typeof data === 'object') {
      return JSON.stringify(data).slice(0, 200);
    }

    return `Request failed with status ${response.status}`;
  }

  async setToken(token) {
    this.token = token;
    let userId = null;
    try {
      const userData = await this.getCurrentUser();
      if (userData && userData.user && userData.user._id) {
        userId = userData.user._id;
      }
    } catch (error) {
      console.error('Failed to fetch and store userId:', error);
    }
    await chrome.storage.local.set({
      authToken: token,
      ...(userId && { userId }),
    });
    if (userId) console.log('✅ User ID stored:', userId);
  }

  async getToken() {
    if (!this.token) {
      const result = await chrome.storage.local.get(['authToken']);
      this.token = result.authToken;
    }
    return this.token;
  }

  async clearToken() {
    this.token = null;
    await chrome.storage.local.remove(['authToken', 'userId']);
  }

  async request(endpoint, options = {}) {
    const token = await this.getToken();
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const requestUrl = `${this.baseURL}${endpoint}`;
      const response = await fetch(requestUrl, {
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type') || '';
      const rawBody = await response.text();
      let data = null;

      if (rawBody) {
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(rawBody);
          } catch (parseError) {
            throw new Error(`Invalid JSON response (${response.status} ${response.statusText}): ${rawBody.slice(0, 160)}`);
          }
        } else {
          data = { raw: rawBody };
        }
      }

      if (!response.ok) {
        const message = this.formatErrorMessage(data, response);
        const error = new Error(String(message).slice(0, 300));
        error.status = response.status;
        error.endpoint = endpoint;
        error.url = requestUrl;
        error.responseBody = data;
        throw error;
      }

      if (data == null) {
        return {};
      }

      return data;
    } catch (error) {
      console.error('API Request error:', error);
      throw error;
    }
  }

  // Auth methods
  async register(email, password, name, age, gender) {
    const data = await this.request(API_CONFIG.ENDPOINTS.REGISTER, {
      method: 'POST',
      body: JSON.stringify({ email, password, name, age, gender })
    });
    
    if (data.token) {
      await this.setToken(data.token);
    }
    
    return data;
  }

  async login(email, password) {
    const data = await this.request(API_CONFIG.ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (data.token) {
      await this.setToken(data.token);
    }
    
    return data;
  }

  async logout() {
    try {
      await this.request(API_CONFIG.ENDPOINTS.LOGOUT, { method: 'POST' });
    } finally {
      await this.clearToken();
    }
  }

  async getCurrentUser() {
    return await this.request(API_CONFIG.ENDPOINTS.ME);
  }

  async updateSettings(consentGiven, trackingEnabled) {
    return await this.request(API_CONFIG.ENDPOINTS.UPDATE_SETTINGS, {
      method: 'PUT',
      body: JSON.stringify({ consentGiven, trackingEnabled })
    });
  }

  // Interaction methods (global interactions removed – use aggregated batches only)
  async getStats() {
    return await this.request(API_CONFIG.ENDPOINTS.GET_STATS);
  }
  
  // Onboarding methods
  async getOnboardingStatus() {
    return await this.request(API_CONFIG.ENDPOINTS.ONBOARDING_STATUS);
  }

  async getImpairmentProfile() {
    return await this.request(API_CONFIG.ENDPOINTS.IMPAIRMENT_PROFILE);
  }

  async computeMotorSessionSummary() {
    return await this.request(API_CONFIG.ENDPOINTS.ONBOARDING_MOTOR_SESSION_SUMMARY, {
      method: 'POST'
    });
  }

  async getMotorFeatureVector() {
    return await this.request(API_CONFIG.ENDPOINTS.ONBOARDING_MOTOR_FEATURE_VECTOR);
  }

  async getMotorScore(sessionFeatures) {
    return await this.request(API_CONFIG.ENDPOINTS.ML_MOTOR_SCORE, {
      method: 'POST',
      body: JSON.stringify(sessionFeatures || {})
    });
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.APIClient = APIClient;
}

