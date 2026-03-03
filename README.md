# AURA - Interaction Tracker & Onboarding System 🌟

**Unleash the Future of UI**

A Chrome extension with Node.js backend and React onboarding game for user interaction tracking and impairment profiling.

---

## 📁 Project Structure

```
D:\Ext\
├── extension\                 # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html, popup.js, popup.css
│   ├── content.js             # Interaction tracking + bridge
│   ├── background.js          # Service worker, aggregator
│   ├── config.js, config.module.js
│   ├── api-client.js, interaction-aggregator.js
│   └── icons\
│
├── server\                    # Node.js/Express + MongoDB
│   ├── server.js, routes\, models\, middleware\
│   └── .env (MongoDB, JWT)
│
├── sensecheck-aura\           # Onboarding Game (React + Vite)
│   └── client\               # Color, acuity, motor, literacy modules
│
└── docs\                      # Integration guides
    ├── AURA_INTEGRATION_GUIDE.md
    ├── EXTENSION_BRIDGE.md
    └── COMPREHENSIVE_TEST_PLAN.md
```

---

## 🚀 Quick Start

### 1. Backend

```bash
cd server && npm install
# Create .env: MONGODB_URI, JWT_SECRET, PORT=3000
npm start
```

### 2. Onboarding Game

```bash
cd sensecheck-aura/client && npm install
# Create .env: VITE_API_URL=http://localhost:3000/api
npm run dev
```

### 3. Chrome Extension

1. Open `chrome://extensions/` → **Developer mode** → **Load unpacked**
2. Select `extension` folder

---

## 🎯 User Flow

```
1. Register in extension popup
2. Accept consent → onboarding game opens
3. Complete modules: Perception, Motor, Literacy
4. Impairment profile saved → AURA_USER_UPDATE broadcast (onboardingComplete: true)
5. Extension tracks interactions (10s windows, 30s sync)
```

---

## 🔧 Key Endpoints

| Component | Endpoint / Message |
|-----------|--------------------|
| Auth | `POST /api/auth/register`, `/login`, `/logout` |
| Onboarding | `GET /onboarding/status`, `POST /impairment-profile` |
| Batches | `GET /interactions/aggregated-batches/last-24h` |
| Bridge | `AURA_EXT_PING`, `AURA_USER_UPDATE`, `AURA_EXT_ML_FINAL_PROFILE_PING` |

See `docs/AURA_INTEGRATION_GUIDE.md` for full bridge API.

---

## 📦 Build

```bash
cd extension
# PowerShell
powershell -File build-chrome.ps1
# Output: build-chrome/
```

---

## 📚 Documentation

- **docs/AURA_INTEGRATION_GUIDE.md** – Bridge API, ML profiles, auth
- **docs/EXTENSION_BRIDGE.md** – Ping-pong, trusted origins
- **docs/COMPREHENSIVE_TEST_PLAN.md** – Test cases

---

## 🔐 Configuration

| File | Key vars |
|------|----------|
| `server/.env` | `MONGODB_URI`, `JWT_SECRET`, `PORT` |
| `sensecheck-aura/client/.env` | `VITE_API_URL` |
| `extension/config.js` | `BASE_URL`, `ONBOARDING_GAME_URL` |
| `extension/config.module.js` | `ML_PROFILE_API_URL` |

---

## 🐛 Troubleshooting

- **Extension not connecting?** – Check server on port 3000, `extension/config.js` `BASE_URL`
- **Onboarding not opening?** – Game on 5173, `ONBOARDING_GAME_URL` in config
- **MongoDB error?** – `MONGODB_URI` in `server/.env`

---

**Built with ❤️ by AURA – Unleash the Future of UI** 🌟
