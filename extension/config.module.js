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
    IMPAIRMENT_PROFILE: '/onboarding/impairment-profile',
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
  //   Integration: GET last 24h of batches for the user (use this for ML pipeline, dashboard):
  //   const res = await fetch(`${API_CONFIG.BASE_URL}/interactions/aggregated-batches/last-24h`, {
  //     headers: { Authorization: `Bearer ${token}` }
  //   });
  //   const data = await res.json(); // { batches: [...], count: N }
  //   Poll every 30 seconds (SYNC_INTERVAL) to stay in sync with extension push.
  //
  //   For custom date range: GET /interactions/aggregated-batches?start=YYYY-MM-DD&end=YYYY-MM-DD
  AGGREGATED_BATCHES_GET: '/interactions/aggregated-batches',

  // ===== ML PERSONALIZED PROFILE – Daily fetch from separate component =====
  // Dummy URL – replace with actual ML profile API when integrated.
  // When token exists, extension fetches this daily and stores as AURA_EXT_ML_PERSONALIZED_PROFILE.
  ML_PROFILE_API_URL: 'https://ml-profile.example.com/api/profile',
};



