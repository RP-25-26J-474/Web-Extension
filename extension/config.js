// API Configuration (for regular scripts - popup, api-client)
const EXTENSION_ENV = (typeof globalThis !== 'undefined' && globalThis.EXTENSION_ENV) ? globalThis.EXTENSION_ENV : {};

function normalizeApiBaseUrl(url) {
  const fallback = 'http://api-gateway.auraui.org/api';
  if (!url) return fallback;

  const trimmed = String(url).trim().replace(/\/+$/, '');
  if (!trimmed) return fallback;

  if (/\/api$/i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}/api`;
}

const API_CONFIG = {
  BASE_URL: normalizeApiBaseUrl(EXTENSION_ENV.API_BASE_URL),
  // Gateway keeps extension backend compatibility routes under /api.
  
  // Onboarding game URL (sensecheck)
  ONBOARDING_GAME_URL: EXTENSION_ENV.ONBOARDING_GAME_URL || 'https://onboarding.auraui.org',
  // Production: 'https://your-sensecheck-app.vercel.app',

  // ML profile URLs (also used by background via module config)
  ML_PROFILE_API_URL: EXTENSION_ENV.ML_PROFILE_API_URL || 'http://api-gateway.auraui.org/api/ml-engine/data/current-profile',
  IMPAIRMENT_TO_ML_PROFILE_API_URL: EXTENSION_ENV.IMPAIRMENT_TO_ML_PROFILE_API_URL || 'http://api-gateway.auraui.org/api/ml-engine/category/generate-profile',
  ML_SESSION_FEEDBACK_URL: EXTENSION_ENV.ML_SESSION_FEEDBACK_URL || 'http://api-gateway.auraui.org/api/ml-engine/user/trigger-update',
  
  ENDPOINTS: {
    REGISTER: '/auth/register',
    RESEND_VERIFICATION: '/auth/resend-verification',
    COMPLETE_VERIFICATION: '/auth/complete-verification',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    DELETE_ACCOUNT: '/auth/account',
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
