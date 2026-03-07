# Dummy ML Profile API

Simple mock server for testing AURA extension ML profile integration.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/profile` | Daily personalized profile fetch |
| POST | `/api/profile-from-impairment` | Initial profile when impairment is created (onboarding) |

Both require `Authorization: Bearer {token}` header.

## Run

```bash
cd dummy-ml-profile
npm install
npm start
```

Runs on **http://localhost:4000** by default. Set `PORT` env var to change.

## Configure Extension

Update `extension/config.module.js`:

```javascript
ML_PROFILE_API_URL: 'http://localhost:4000/api/profile',
IMPAIRMENT_TO_ML_PROFILE_API_URL: 'http://localhost:4000/api/profile-from-impairment',
```

Add to `extension/manifest.json` → `host_permissions`:

```
"http://localhost:4000/*"
```

## Test Flow

1. Start this server: `npm start`
2. Start AURA API server (port 3000) and sensecheck (port 5173)
3. Register in extension → complete onboarding → initial profile is fetched from POST
4. Daily alarm or `FETCH_ML_PERSONALIZED_PROFILE` → profile from GET
