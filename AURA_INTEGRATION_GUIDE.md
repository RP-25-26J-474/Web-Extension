# AURA Extension Integration Guide

Short guide for integrating with the AURA browser extension. Communication uses `window.postMessage` between your web app and the extension content script.

---

## Flow Overview

1. **User registers** → Token created → Broadcast only after onboarding completes (token, not user IDs).
2. **Extension detection** → Send `AURA_EXT_PING`, receive `AURA_EXT_PONG`.
3. **Initial ML profile (registration)** → When impairment profile is created (onboarding done), extension POSTs impairment JSON to one API → saves `response.profile`. The daily GET API has no data for new users yet.
4. **ML profile (login)** → On login (existing user), extension fetches immediately from the daily GET API.
5. **ML profile (24h periodic)** → Daily alarm fetches from the GET API and overwrites.
6. **Aggregated batches** → Separate component polls `GET /interactions/aggregated-batches/last-24h` every 30s (see Section 5).

---

## Integration Endpoints (Summary)

| Type | Endpoint / Message | Auth | Notes |
|------|--------------------|------|-------|
| **Bridge** | `AURA_EXT_PING` → `AURA_EXT_PONG` | No | Detect extension, get `token`, `user`, `loggedIn` |
| **Bridge** | `AURA_EXT_TOKEN_PING` → `AURA_EXT_TOKEN_PONG` | No | Token only |
| **Broadcast** | Listen for `AURA_USER_UPDATE` | No | Login/logout; `isRegistration` / `isLogin`; clear on `loggedIn: false` |
| **Profile** | `AURA_EXT_ML_PERSONALIZED_PROFILE_PING` → `…_PONG` | Yes | `available: false` when logged out |
| **Profile** | `AURA_EXT_SET_ADAPTIVE_PROFILE` → `…_ACK` | Yes | Rejected when logged out |
| **Profile** | `AURA_EXT_ADAPTIVE_PROFILE_PING` → `…_PONG` | Yes | `available: false` when logged out |
| **Profile** | `AURA_EXT_ML_FINAL_PROFILE_PING` → `…_PONG` | Yes | Adaptive if exists, else personalized |
| **API** | `GET /interactions/aggregated-batches/last-24h` | Yes | Bearer token; **primary integration endpoint** |

**Auth:** All profile ops need the user logged in. After logout, profile pings return `available: false`; `SET_ADAPTIVE_PROFILE` returns `success: false`.

---

## Prerequisites

- Page from a trusted origin (e.g. `http://localhost:3000`, `http://localhost:5173` – add in `extension/content.js` if needed).
- AURA extension installed.
- ~1s timeout for pong – if none, extension not installed or origin not trusted.

---

## 1. Extension Presence (Ping–Pong)

```javascript
window.postMessage({ type: 'AURA_EXT_PING', source: 'aura-web' }, '*');

window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.source !== 'aura-extension') return;
  if (e.data.type === 'AURA_EXT_PONG') {
    const { extensionPresent, loggedIn, token, user } = e.data;
    // token: use for API calls (Bearer)
  }
});
```

---

## 2. Token Only

```javascript
window.postMessage({ type: 'AURA_EXT_TOKEN_PING', source: 'aura-web' }, '*');
// Listen for AURA_EXT_TOKEN_PONG → event.data.token
```

---

## 3. Login / Logout Broadcast

- **Login:** Broadcast when existing user logs in (`isLogin: true`).
- **Registration:** Broadcast only after onboarding completes (`isRegistration: true`, `onboardingComplete: true`).

```javascript
window.addEventListener('message', (e) => {
  if (e.data?.type === 'AURA_USER_UPDATE' && e.data?.source === 'aura-extension') {
    if (e.data.loggedIn) {
      // e.data.token, e.data.user, e.data.isRegistration, e.data.isLogin
    } else {
      // Logged out – clear state
    }
  }
});
```

---

## 4. ML Profiles

**Personalized profile:**
- **Registration:** On onboarding complete, extension POSTs impairment JSON → gets `{ profile }` → saves. Daily GET API has no data yet.
- **Login:** Extension fetches from daily GET API immediately (existing user).
- **24h periodic:** Daily alarm fetches from GET API and overwrites.

```javascript
window.postMessage({ type: 'AURA_EXT_ML_PERSONALIZED_PROFILE_PING', source: 'aura-web' }, '*');
// AURA_EXT_ML_PERSONALIZED_PROFILE_PONG → event.data.profile, event.data.available
```

**Adaptive profile (your component):**

```javascript
window.postMessage({
  type: 'AURA_EXT_SET_ADAPTIVE_PROFILE',
  source: 'aura-web',
  profile: { theme, font_size, line_height, contrast_mode, element_spacing, target_size, reduced_motion, tooltip_assist, layout_simplification }
}, '*');
// AURA_EXT_SET_ADAPTIVE_PROFILE_ACK → event.data.success, event.data.error
```

**Final profile:** Adaptive if present, else personalized.

```javascript
window.postMessage({ type: 'AURA_EXT_ML_FINAL_PROFILE_PING', source: 'aura-web' }, '*');
// AURA_EXT_ML_FINAL_PROFILE_PONG → event.data.profile, event.data.sourceType, event.data.available
```

---

## 5. Aggregated Batches API

**Last 24h (primary integration endpoint):**

`GET {API_BASE}/interactions/aggregated-batches/last-24h`  
`Authorization: Bearer {token}`

**For a separate component (e.g. ML pipeline, dashboard) that fetches latest records every 30s:**

```javascript
// Integration: poll every 30 seconds for latest aggregated batches
const API_BASE = 'http://localhost:3000/api'; // or your server
const token = '...'; // from AURA_EXT_TOKEN_PING or AURA_EXT_PONG

const res = await fetch(
  `${API_BASE}/interactions/aggregated-batches/last-24h`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const { batches, count } = await res.json();
// Poll every 30 seconds to stay in sync with extension push
```

**Date range:**  
`GET {API_BASE}/interactions/aggregated-batches?start=YYYY-MM-DD&end=YYYY-MM-DD`

---

## Testing

- **With API server:** `http://localhost:3000/extension/test-bridge-integration.html`
- **Standalone:** `npx serve extension -p 5000` → `http://localhost:5000/test-bridge-integration.html`

---

## ⚠️ Configuration – What to Change (Dummy → Real)

All URLs below are **dummy placeholders**. Replace them before production.

| Config Key | File | Dummy Value | What to Do |
|------------|------|-------------|------------|
| `ML_PROFILE_API_URL` | `extension/config.module.js` | `https://ml-profile.example.com/api/profile` | Set to your ML profile API (daily fetch). |
| `IMPAIRMENT_TO_ML_PROFILE_API_URL` | `extension/config.module.js` | `https://impairment-to-ml.example.com/api/profile-from-impairment` | Set to your impairment→profile API (initial on registration). |

**1. Edit `extension/config.module.js`:**

```javascript
// Replace dummy URLs with your real ML component APIs
ML_PROFILE_API_URL: 'https://your-ml-service.com/api/profile',
IMPAIRMENT_TO_ML_PROFILE_API_URL: 'https://your-ml-service.com/api/profile-from-impairment',
```

**2. Edit `extension/manifest.json` → `host_permissions`:**  
Add your real API domains so the extension can fetch them.

```json
"host_permissions": [
  "https://your-ml-service.com/*",
  ...
]
```

---

## Summary Checklist

- [ ] Trusted origin in `extension/content.js` (if needed)
- [ ] `AURA_EXT_PING` on load; ~1s timeout for pong
- [ ] Listen for `AURA_USER_UPDATE`; clear state when `loggedIn: false`
- [ ] ML profiles: check `available`; `SET_ADAPTIVE_PROFILE`: check `success`
- [ ] Batches: `GET /interactions/aggregated-batches/last-24h` with Bearer token; poll every 30s
- [ ] Replace dummy URLs in `extension/config.module.js` and `host_permissions`
