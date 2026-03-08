// .env-like runtime configuration for the extension
// Keep all URL values centralized in this file.
(function initExtensionEnv(globalScope) {
  // =========================
  // Edit only these base URLs
  // =========================
  const API_BASE_URL = 'http://localhost:3000/api';
  const ONBOARDING_GAME_BASE_URL = 'http://localhost:5173';
  const ML_BASE_URL = 'http://localhost:8000';

  const URL_ENV = {
    API_BASE_URL,
    ONBOARDING_GAME_URL: ONBOARDING_GAME_BASE_URL,
    ML_PROFILE_API_URL: `${ML_BASE_URL}/data/current-profile`,
    IMPAIRMENT_TO_ML_PROFILE_API_URL: `${ML_BASE_URL}/category/generate-profile`,
  };

  const existing = globalScope.EXTENSION_ENV || {};
  globalScope.EXTENSION_ENV = { ...existing, ...URL_ENV };
})(typeof globalThis !== 'undefined' ? globalThis : window);
