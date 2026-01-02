// API Configuration
const API_CONFIG = {
  BASE_URL: 'http://localhost:3000/api',
  // Change this to your production URL when deploying
  // BASE_URL: 'https://your-server.com/api',
  
  // Onboarding game URL (sensecheck)
  ONBOARDING_GAME_URL: 'http://localhost:5173',
  // Production: 'https://your-sensecheck-app.vercel.app',
  
  ENDPOINTS: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    UPDATE_SETTINGS: '/auth/settings',
    // Unified interaction storage (uses GlobalInteractionBucket)
    SAVE_INTERACTIONS: '/onboarding/global/interactions',
    GET_INTERACTIONS: '/onboarding/global/interactions',
    GET_RECENT: '/onboarding/global/interactions/recent',
    CLEAR_INTERACTIONS: '/onboarding/global/interactions/clear',
    GET_STATS: '/stats',
    ONBOARDING_STATUS: '/onboarding/status',
  },
  
  // Batch size for sending interactions
  BATCH_SIZE: 50,
  
  // Interval for syncing (in milliseconds)
  SYNC_INTERVAL: 30000 // 30 seconds
};

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
}

