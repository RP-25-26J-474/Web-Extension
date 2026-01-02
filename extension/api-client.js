// API Helper Functions for Extension
class APIClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.token = null;
  }

  async setToken(token) {
    this.token = token;
    await chrome.storage.local.set({ authToken: token });
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
    await chrome.storage.local.remove('authToken');
  }

  async request(endpoint, options = {}) {
    const token = await this.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
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

  // Interaction methods
  async saveInteractions(interactions) {
    return await this.request(API_CONFIG.ENDPOINTS.SAVE_INTERACTIONS, {
      method: 'POST',
      body: JSON.stringify({ interactions })
    });
  }

  async getInteractions(page = 1, limit = 50) {
    return await this.request(
      `${API_CONFIG.ENDPOINTS.GET_INTERACTIONS}?page=${page}&limit=${limit}`
    );
  }

  async getRecentInteractions(limit = 10) {
    return await this.request(
      `${API_CONFIG.ENDPOINTS.GET_RECENT}?limit=${limit}`
    );
  }

  async clearInteractions() {
    return await this.request(API_CONFIG.ENDPOINTS.CLEAR_INTERACTIONS, {
      method: 'DELETE'
    });
  }

  async getStats() {
    return await this.request(API_CONFIG.ENDPOINTS.GET_STATS);
  }
  
  // Onboarding methods
  async getOnboardingStatus() {
    return await this.request(API_CONFIG.ENDPOINTS.ONBOARDING_STATUS);
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.APIClient = APIClient;
}

