// API Configuration (for regular scripts - popup, api-client)
// For local dev: use http://localhost:3000/api
// For Vercel: use https://extension-backend-theta.vercel.app/api
const API_CONFIG = {
  BASE_URL: 'https://extension-backend-theta.vercel.app/api',
  // Local: 'http://localhost:3000/api',
  
  // Onboarding game URL (sensecheck)
  ONBOARDING_GAME_URL: 'http://localhost:5173',
  // Production: 'https://your-sensecheck-app.vercel.app',
  
  ENDPOINTS: {
    REGISTER: '/auth/register',
    RESEND_VERIFICATION: '/auth/resend-verification',
    COMPLETE_VERIFICATION: '/auth/complete-verification',
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
  SYNC_INTERVAL: 30000 // 30 seconds
};

// Make available globally
if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
}
