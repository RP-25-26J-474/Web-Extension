// API Configuration (ES6 module version for service worker)
export const API_CONFIG = {
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
    GET_STATS: '/stats',
    ONBOARDING_STATUS: '/onboarding/status',
    ONBOARDING_MOTOR_SESSION_SUMMARY: '/onboarding/motor/summary/session',
    ONBOARDING_MOTOR_FEATURE_VECTOR: '/onboarding/motor/feature-vector',
    ML_MOTOR_SCORE: '/ml/motor-score',
  },
  
  // Batch size for sending interactions
  BATCH_SIZE: 50,
  
  // Interval for syncing (in milliseconds)
  SYNC_INTERVAL: 30000, // 30 seconds
  
  // ===== AGGREGATED BATCHES – Integration for external components =====
  // If a separate component (e.g. ML pipeline, dashboard) needs to fetch the latest
  // aggregated records every 30s, use this structure:
  //
  //   const start = new Date(Date.now() - 60000).toISOString().split('T')[0]; // e.g. "2025-02-28"
  //   const end = new Date().toISOString().split('T')[0];
  //   const res = await fetch(
  //     `${API_CONFIG.BASE_URL}/interactions/aggregated-batches?start=${start}&end=${end}`,
  //     { headers: { Authorization: `Bearer ${token}` } }
  //   );
  //   const data = await res.json(); // { batches: [...], count: N }
  //
  // Poll every 30 seconds (SYNC_INTERVAL) to stay in sync with extension push.
  AGGREGATED_BATCHES_GET: '/interactions/aggregated-batches',
};



