/**
 * URL Sanitizer for Page Context (GDPR-Compliant)
 *
 * Reduces identifiability of page URLs while preserving useful context for
 * personalization (e.g. site type, general path category). Aligns with:
 * - GDPR data minimization
 * - Common analytics practice (GA, Matomo, Firefox referrer stripping)
 *
 * Transformations:
 * - Domain: Strip "www." prefix; keep hostname for site identification
 * - Route: Remove query string and fragment; keep first 2 path segments;
 *   replace UUIDs and long numeric IDs with :id placeholder
 */

const UUID_REGEX = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_NUMERIC_ID_REGEX = /\/\d{5,}/g;
const MAX_PATH_SEGMENTS = 2;

/**
 * Sanitize a URL into a GDPR-compliant page context.
 *
 * @param {string} urlString - Full URL (e.g. window.location.href or interactionData.url)
 * @param {string} [appType='web'] - Application type
 * @returns {{ domain: string, route: string, app_type: string }}
 */
export function sanitizePageContext(urlString, appType = 'web') {
  const fallback = { domain: 'unknown', route: '/', app_type: appType };

  if (!urlString || typeof urlString !== 'string') {
    return fallback;
  }

  try {
    const url = new URL(urlString);

    // Domain: strip www. prefix (common subdomain)
    let domain = url.hostname || 'unknown';
    if (domain.toLowerCase().startsWith('www.')) {
      domain = domain.slice(4);
    }
    if (!domain) domain = 'unknown';

    // Route: pathname only (no query, no fragment); sanitize and truncate
    let path = url.pathname || '/';
    if (path !== '/') {
      // Replace UUIDs with :id
      path = path.replace(UUID_REGEX, '/:id');
      // Replace long numeric IDs (e.g. /12345, /98765432)
      path = path.replace(LONG_NUMERIC_ID_REGEX, '/:id');
      // Keep first N segments
      const segments = path.split('/').filter(Boolean).slice(0, MAX_PATH_SEGMENTS);
      path = '/' + segments.join('/');
    }

    return {
      domain,
      route: path || '/',
      app_type: appType,
    };
  } catch {
    return fallback;
  }
}
