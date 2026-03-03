# AURA Web-Extension Monorepo

A full-stack interaction research platform composed of:

- A browser extension (`extension/`) that captures user interactions and syncs aggregated behavioral windows.
- An onboarding game (`sensecheck-aura/client/`) that measures vision, motor, and literacy signals.
- A Node/Express backend (`server/`) with JWT auth, MongoDB storage, onboarding APIs, aggregation APIs, and ML proxy routes.
- A Python ML stack (`ml/`) for model training and serving.

This README reflects the current code in this repository as of March 2026.

## 1. Repository layout

```text
Web-Extension/
|-- extension/                    # Browser extension (Manifest V3)
|   |-- manifest.json
|   |-- background.js             # Service worker
|   |-- content.js                # Event capture + extension bridge
|   |-- interaction-aggregator.js # 10s windows, 30s flush
|   |-- popup.html
|   |-- popup.js                  # Auth, consent, onboarding launch
|   |-- api-client.js
|   |-- config.js
|   |-- config.module.js
|   `-- build-extension.ps1
|
|-- server/                       # Node.js + Express + MongoDB API
|   |-- server.js
|   |-- routes/
|   |   |-- auth.js
|   |   |-- interactions.js
|   |   |-- onboarding.js
|   |   |-- ml.js
|   |   `-- stats.js
|   |-- middleware/auth.js
|   |-- models/                   # User, onboarding, bucket, summary schemas
|   |-- utils/                    # Feature extraction + ML feature builder
|   `-- scripts/                  # CSV export / profile scoring helpers
|
|-- sensecheck-aura/
|   |-- client/                   # React + Vite onboarding game
|   |   `-- src/
|   |       |-- components/game/  # Unified 4-challenge flow
|   |       |-- modules/          # Legacy module pages kept for compatibility
|   |       |-- utils/            # AURA integration, motor/global tracking
|   |       |-- state/store.js    # Zustand store
|   |       `-- App.jsx
|   `-- docs/                     # Some docs are legacy from older architecture
|
|-- ml/
|   |-- training/                 # Training/evaluation/scoring scripts
|   |-- serving/                  # FastAPI scoring service
|   `-- model_registry/           # Saved model artifacts (v1.0.0)
|
|-- onboarding/                   # Legacy onboarding assets/questions
|-- package.json                  # Root Jest/tooling scripts
|-- jest.config.js
|-- jest.setup.js
`-- test-aggregation.js           # Aggregation logic smoke tests
```

## 2. Core capabilities

### Extension

- User registration/login against backend JWT auth.
- Consent-gated tracking state.
- Captures a broad interaction set from all pages via `content.js`:
  - Click, double click, right click, mouse down/up/move, scroll.
  - Touch start/move/end/cancel, swipe, pinch.
  - Drag/drop events.
  - Keyboard events (character keys masked as `[CHAR]`).
  - Zoom signals (`browser_zoom`, `wheel_zoom`, `keyboard_zoom`, `visual_viewport_zoom`).
- Builds 10-second aggregated interaction windows and syncs batches every 30 seconds.
- Sends aggregated batches to `POST /api/interactions/aggregated-batches` after onboarding is complete.
- Extension <-> web app bridge via `window.postMessage` ping/pong contracts (`AURA_EXT_*`).
- Daily ML personalized profile fetch using Chrome alarms.

### Onboarding game

- Unified game flow (`/play`) with 4 sequential challenge phases:
  1. Color challenge (Ishihara-style plates).
  2. Visual acuity challenge (distance-calibrated shrinking target numbers).
  3. Motor challenge (3-wave bubble/fog game with pointer telemetry).
  4. Knowledge quiz (15 literacy questions).
- In AURA mode (`?mode=aura&token=...&userId=...`), posts results directly to backend onboarding routes.
- Motor challenge sends:
  - Raw pointer samples (`/onboarding/motor/trace`)
  - Attempt objects (`/onboarding/motor/attempts`)
  - Round/session summary compute triggers
- Builds and saves impairment profile payloads.

### Backend

- JWT auth and user settings (`consentGiven`, `trackingEnabled`).
- Raw interaction storage + stats counters.
- Aggregated interaction batch ingestion and query APIs.
- Onboarding APIs for start/status/results and module completion.
- Motor bucket architecture + server-side feature extraction:
  - Pointer traces
  - Attempt-level features
  - Round summaries
  - Session summaries
- ML proxy route (`/api/ml/motor-score`) to Python service.
- Impairment profile storage/refresh logic.

### ML stack

- Feature table export from MongoDB to CSV.
- Model training (XGBoost regression with PCA-derived target).
- Holdout evaluation with bootstrap CI.
- Per-user/per-session scoring CLI.
- FastAPI scoring service (`POST /score/motor`).

## 3. End-to-end flow

1. User logs in/registers in extension popup.
2. User gives consent.
3. Extension opens onboarding game with token/userId.
4. Game posts vision/motor/literacy outputs to backend.
5. Backend computes summaries and impairment profile; ML score can be proxied.
6. Game signals onboarding complete.
7. Extension enables post-onboarding aggregated tracking.
8. Aggregated windows are flushed to backend and available for analytics/ML ingestion.

## 4. Prerequisites

- Node.js 18+ (Node 18+ required because backend uses global `fetch`).
- npm.
- MongoDB instance (local or remote).
- Chrome/Edge (and optionally Firefox for manual extension loading).
- Optional for ML pipeline:
  - Python 3.10+
  - `pip`

## 5. Environment configuration

### 5.1 Backend (`server/.env`)

Required:

```env
MONGODB_URI=mongodb://localhost:27017/aura
JWT_SECRET=replace-with-strong-secret
PORT=3000
NODE_ENV=development
```

Optional integration variables:

```env
ML_SERVICE_URL=http://localhost:8000/score/motor
ML_ENGINE_INGEST_URL=
ML_ENGINE_API_KEY=
PROD_MONGO_URI=
IMPAIRMENT_PROFILES_COLLECTION=impairmentprofiles
PYTHON=
```

### 5.2 Onboarding client (`sensecheck-aura/client/.env`)

```env
VITE_API_URL=http://localhost:3000/api
```

### 5.3 Extension config files

Update both files:

- `extension/config.js`
- `extension/config.module.js`

Set at least:

- `BASE_URL` (backend API root, e.g. `http://localhost:3000/api`)
- `ONBOARDING_GAME_URL` (frontend root, e.g. `http://localhost:5173`)
- `ML_PROFILE_API_URL` if you have a real personalized-profile endpoint.

## 6. Local setup and run

### 6.1 Backend

```bash
cd server
npm install
npm start
```

Dev mode:

```bash
npm run dev
```

API base becomes `http://localhost:3000/api`.

### 6.2 Onboarding game

```bash
cd sensecheck-aura/client
npm install
npm run dev
```

Default Vite URL is `http://localhost:5173`.

### 6.3 Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `extension/` directory.

For Firefox temporary load, use `about:debugging` and load `extension/manifest.json`.

### 6.4 Root test tooling

```bash
npm install
npm test
```

Available root scripts:

- `npm test`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run test:extension`
- `npm run test:server`
- `npm run test:client`
- `npm run test:verbose`

Note: there are few project-owned `*.test.*` files currently; coverage config is present but test coverage is limited.

## 7. API reference (current backend)

Base URL: `/api`

### 7.1 Auth (`/auth`)

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `PUT /auth/profile`
- `PUT /auth/settings`

`register` currently validates: `email`, `password` (>=6), `name`, `age` (1-120), `gender` (`male|female|other|prefer-not-to-say`).

### 7.2 Interactions (`/interactions`)

Raw interaction endpoints:

- `POST /interactions/batch`
- `GET /interactions`
- `GET /interactions/recent`
- `DELETE /interactions/clear`

Aggregated endpoints:

- `POST /interactions/aggregated-batches`
- `GET /interactions/aggregated-batches/last-24h`
- `GET /interactions/aggregated-batches?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /interactions/aggregated-stats?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /interactions/aggregated-batches/export?start=YYYY-MM-DD&end=YYYY-MM-DD`

Aggregated batch schema includes:

- `batch_id`, `captured_at`
- `page_context: { domain, route, app_type }`
- `events_agg: { click_count, misclick_rate, avg_click_interval_ms, avg_dwell_ms, rage_clicks, zoom_events, scroll_speed_px_s }`
- `_profiler: { sampling_hz, input_lag_ms_est }`


### 7.5 Onboarding (`/onboarding`)

Session and status:

- `GET /onboarding/status`
- `POST /onboarding/start`
- `POST /onboarding/complete`
- `GET /onboarding/results`
- `GET /onboarding/session/:sessionId` (sensecheck-compatible response shape)
- `POST /onboarding/module-complete`

Motor (bucket pipeline):

- `POST /onboarding/motor/trace`
- `POST /onboarding/motor/attempts`
- `POST /onboarding/motor/summary/round`
- `POST /onboarding/motor/summary/session`
- `GET /onboarding/motor/feature-vector`

Legacy motor:

- `POST /onboarding/motor`

Vision/literacy:

- `POST /onboarding/vision`
- `POST /onboarding/literacy`

Impairment profile:

- `POST /onboarding/impairment-profile`
- `GET /onboarding/impairment-profile`

### 7.6 ML (`/ml`)

- `POST /ml/motor-score`

This route proxies scoring to `ML_SERVICE_URL` and updates motor impairment fields in `impairmentprofiles`.

## 8. MongoDB models and retention

### Core auth/tracking models

- `User` (`users`)
- `Stats` (`stats`)
- `Interaction` (`interactions`)
  - TTL: 30 days via `expiresAt`

### Onboarding models

- `OnboardingSession` (`onboardingsessions`)
  - Unique per user
  - TTL: 1 year
- `OnboardingMotorResult` (legacy)
  - TTL: 1 year
- `OnboardingLiteracyResult`
  - TTL: 1 year
- `OnboardingVisionResult`
  - TTL: 1 year

### Motor bucket and summary models

- `MotorPointerTraceBucket`
  - ~5000 samples/bucket
  - TTL: 1 year
- `MotorAttemptBucket`
  - ~2000 attempts/bucket
  - TTL: 1 year
- `MotorRoundSummary`
  - No TTL
- `MotorSessionSummary`
  - No TTL

### Aggregated and profile models

- `AggregatedInteractionBatch`
  - TTL: 2 years
- `ImpairmentProfile` (`impairmentprofiles` collection)
  - No TTL index defined in current schema

## 9. ML pipeline details

### 9.1 Export motor feature table from MongoDB

Script: `server/scripts/export-ml-csv.js`

- Reads sessions + attempt buckets.
- Builds one row per session with round metrics and deltas.
- Outputs `ml/datasets/final/motor_sessions.csv`.
- Uses `PROD_MONGO_URI`.

### 9.2 Train model artifacts

```bash
cd ml/training
pip install -r requirements.txt
python train_motor_model_v2.py --csv ..\datasets\final\motor_sessions.csv --outdir ..\model_registry\motor\1.0.0
```

Artifacts include:

- `preprocess/pca_scaler_motor.joblib`
- `preprocess/pca_pc1_motor.joblib`
- `preprocess/pc1_sorted.npy`
- `preprocess/impute_medians.json`
- `models/modelB1_reg_motor_only.joblib`
- `models/modelB2_reg_motor_plus_context.joblib`
- `reports/training_report.json`

### 9.3 Holdout evaluation

```bash
python evaluate_holdout.py --csv ..\datasets\final\motor_sessions.csv --outdir ..\model_registry\motor\1.0.0
```

Produces holdout metrics and prediction CSV in `reports/`.

### 9.4 Score one user/session from CSV

```bash
python score_one_session.py --csv ..\datasets\final\motor_sessions.csv --outdir ..\model_registry\motor\1.0.0 --userId <user-id>
```

### 9.5 Run FastAPI scoring service

```bash
cd ml/serving
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Health:

- `GET /health`

Scoring:

- `POST /score/motor`

## 10. Extension bridge events (web app integration)

From web page to extension/content script:

- `AURA_EXT_PING` -> `AURA_EXT_PONG`
- `AURA_EXT_TOKEN_PING` -> `AURA_EXT_TOKEN_PONG`
- `AURA_EXT_ML_PERSONALIZED_PROFILE_PING` -> `..._PONG`
- `AURA_EXT_ADAPTIVE_PROFILE_PING` -> `..._PONG`
- `AURA_EXT_ML_FINAL_PROFILE_PING` -> `..._PONG`
- `AURA_EXT_SET_ADAPTIVE_PROFILE` -> `..._ACK`
- `AURA_ONBOARDING_COMPLETE` (relayed to background)

Trusted origins are hardcoded in `extension/content.js` and should be updated for production domains.

## 11. Build and packaging

### Extension package helper

`extension/build-extension.ps1` creates a `build/` folder.

### Important note

Current `build-extension.ps1` does not copy all runtime dependencies used by current extension code (for example `config.js`, `config.module.js`, `api-client.js`, `interaction-aggregator.js`). If you distribute from `build/`, update this script first.

### Onboarding frontend production build

```bash
cd sensecheck-aura/client
npm run build
npm run preview
```

## 12. Known legacy/mismatch notes

- `sensecheck-aura/docs/*` includes legacy architecture/API docs that do not fully match this repository's active backend routes.
- `sensecheck-aura/package.json` includes scripts that assume a `sensecheck-aura/server` folder, which is not present in this repo. Run `sensecheck-aura/client` directly.
- `sensecheck-aura/client/src/utils/api.js` still exposes some legacy helper functions/endpoints not used by the main AURA flow.
- Root `popup.js` is a legacy copy; active extension popup logic lives in `extension/popup.js`.
- Some files contain old branding references or outdated comments; behavior should be verified against active code paths.

## 13. Troubleshooting

### Backend fails to start

- Verify `server/.env` exists and `MONGODB_URI`, `JWT_SECRET` are set.
- Confirm MongoDB is reachable.
- Ensure Node version is >=18.

### Extension login works but tracking does not sync

- Confirm onboarding completed flag is set (tracking sync is gated by onboarding completion).
- Check `BASE_URL` in both extension config files.
- Inspect service worker logs in extension devtools.

### Onboarding game opens but API calls fail

- Ensure token is present in URL query (`token=...&mode=aura&userId=...`).
- Ensure `VITE_API_URL` points to backend `/api`.
- Check backend CORS and auth errors in server logs.

### ML proxy returns errors

- Start FastAPI service on configured `ML_SERVICE_URL`.
- Verify model artifacts exist under `ml/model_registry/motor/1.0.0`.

## 14. Security and privacy notes

- Passwords are bcrypt-hashed in backend.
- JWT auth protects all user data endpoints.
- Character keys are masked in content-script keypress tracking.
- Tracking requires explicit user consent.
- TTL indexes prune high-volume telemetry collections over time.

## 15. License

- `extension/LICENSE` contains MIT license text for extension code.
- Root package also declares MIT in `package.json`.

