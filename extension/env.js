// .env-like runtime configuration for the extension
// Keep all URL values centralized in this file.
(function initExtensionEnv(globalScope) {
  // =========================
  // Edit only these base URLs
  // =========================
  const API_BASE_URL = 'https://extension-backend-theta.vercel.app/api';
  const ONBOARDING_GAME_BASE_URL = 'https://onboarding-frontend-psi.vercel.app';
  const ML_BASE_URL = 'https://mlpe.auraui.org';

  function toOrigin(url) {
    try {
      return new URL(url).origin;
    } catch (e) {
      return null;
    }
  }

  function unique(items) {
    return Array.from(new Set((items || []).filter(Boolean)));
  }

  // API host permissions are centralized here and synced into manifest.json by build scripts.
  const HOST_PERMISSIONS = unique([
    `${toOrigin(API_BASE_URL)}/*`,
    `${toOrigin(ONBOARDING_GAME_BASE_URL)}/*`,
    `${toOrigin(ML_BASE_URL)}/*`,
  ]);

  // Origins allowed for extension bridge messages.
  const BRIDGE_TRUSTED_ORIGINS = unique([
    toOrigin(ONBOARDING_GAME_BASE_URL),
    toOrigin(API_BASE_URL),
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:8080',
  ]);

  const URL_ENV = {
    API_BASE_URL,
    ONBOARDING_GAME_URL: ONBOARDING_GAME_BASE_URL,
    ML_PROFILE_API_URL: `${ML_BASE_URL}/data/current-profile`,
    IMPAIRMENT_TO_ML_PROFILE_API_URL: `${ML_BASE_URL}/category/generate-profile`,
    ML_SESSION_FEEDBACK_URL: `${ML_BASE_URL}/user/trigger-update`,
    HOST_PERMISSIONS,
    BRIDGE_TRUSTED_ORIGINS,
  };

  const existing = globalScope.EXTENSION_ENV || {};
  globalScope.EXTENSION_ENV = { ...existing, ...URL_ENV };
})(typeof globalThis !== 'undefined' ? globalThis : window);
