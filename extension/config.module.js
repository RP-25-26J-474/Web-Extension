import './env.js';

const EXTENSION_ENV = (typeof globalThis !== 'undefined' && globalThis.EXTENSION_ENV) ? globalThis.EXTENSION_ENV : {};

// API Configuration (ES6 module version for service worker)
export const API_CONFIG = {
  BASE_URL: EXTENSION_ENV.API_BASE_URL || 'http://localhost:3000/api',
  // Change this to your production URL when deploying
  // BASE_URL: 'https://your-server.com/api',
  
  // Onboarding game URL (sensecheck)
  ONBOARDING_GAME_URL: EXTENSION_ENV.ONBOARDING_GAME_URL || 'http://localhost:5173',
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
  // Daily profile fetch endpoint (expects user_id query param)
  // Example call: /data/current-profile?user_id=<mongo_user_id>
  ML_PROFILE_API_URL: EXTENSION_ENV.ML_PROFILE_API_URL || 'http://localhost:8000/data/current-profile',

  // ===== IMPAIRMENT → ML PROFILE – Initial fetch on registration =====
  // For local testing: use dummy-ml-profile POST endpoint. Extension POSTs impairment JSON
  // when onboarding completes; receives { profile } in response.
  // Production: replace with actual API.
  IMPAIRMENT_TO_ML_PROFILE_API_URL: EXTENSION_ENV.IMPAIRMENT_TO_ML_PROFILE_API_URL || 'http://localhost:8000/category/generate-profile',

  // ===== SESSION FEEDBACK – Sends profile diff to ML engine on logout / browser close =====
  // Compares AURA_EXT_ML_PERSONALIZED_PROFILE (base) vs AURA_EXT_ADAPTIVE_OPTIMIZED_PROFILE (current)
  // and POSTs the changes so the ML engine can learn from user feedback.
  ML_SESSION_FEEDBACK_URL: EXTENSION_ENV.ML_SESSION_FEEDBACK_URL || 'http://localhost:8000/user/trigger-update',
};



