# AURA Onboarding Game 🎮

**Unleash the Future of UI**

An interactive onboarding assessment game for the AURA Interaction Tracker Extension. This game evaluates users across three key dimensions: perception, motor skills, and cognitive ability.

---

## 🌟 What is this?

This is a **modified version of Sensecheck** specifically designed for the AURA Extension. When users register for the first time in the AURA Extension, they are prompted to complete this onboarding game, which:

- **Evaluates** user capabilities across vision, motor skills, and computer literacy
- **Collects** user-based data (linked to userId, not sessionId)
- **Saves** all results to the AURA backend (MongoDB)
- **Completes** the onboarding flow for personalized tracking

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  AURA Extension (Chrome/Firefox)            │
│  - User registers                           │
│  - Receives JWT token                       │
│  └─> Opens: http://localhost:5173?         │
│      mode=aura&userId=XXX&token=YYY        │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  AURA Onboarding Game (This Project)       │
│  - Perception Lab (vision tests)            │
│  - Reaction Lab (motor skills)              │
│  - Knowledge Console (literacy quiz)        │
│  └─> Saves to AURA Backend                 │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  AURA Backend (D:\Ext\server)              │
│  - POST /api/onboarding/start              │
│  - POST /api/onboarding/motor              │
│  - POST /api/onboarding/literacy           │
│  - POST /api/onboarding/vision             │
│  - POST /api/onboarding/complete           │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  MongoDB                                    │
│  - OnboardingSessions (userId-based)       │
│  - OnboardingMotorResults                  │
│  - OnboardingLiteracyResults               │
│  - OnboardingVisionResults                 │
└─────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- AURA Extension backend running on `http://localhost:3000`

### Installation

```bash
# Navigate to the client directory
cd D:\Ext\sensecheck-aura\client

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will be available at `http://localhost:5173`

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
# AURA Backend URL
VITE_API_URL=http://localhost:3000/api
```

### AURA Integration

The game automatically detects if it's launched from the AURA Extension by checking URL parameters:

- `mode=aura` - Enables AURA mode
- `userId=XXX` - User ID from AURA backend
- `token=YYY` - JWT authentication token

**Example URL:**
```
http://localhost:5173?mode=aura&userId=507f1f77bcf86cd799439011&token=eyJhbGc...
```

---

## 🎯 Game Modules

### 1. **Perception Lab** 👁️
- **Color Blindness Test**: Ishihara plate recognition
- **Visual Acuity Test**: Letter size identification

### 2. **Reaction Lab** ⚡
- **Motor Skills Game**: 3-round bubble-popping game
- Tracks reaction time, accuracy, speed, and movement patterns

### 3. **Knowledge Console** 📚
- **Computer Literacy Quiz**: 10 questions across:
  - Basic Computer Skills
  - Internet & Email
  - Digital Security
  - Software Applications

---

## 📊 Data Flow

### 1. Session Initialization
```javascript
// Automatic on app load (App.jsx)
auraIntegration.startSession({
  device: { userAgent, platform, vendor },
  screen: { width, height, pixelRatio },
  game: { canvasWidth, canvasHeight },
  perf: { memory }
});
```

### 2. Module Completion
Each module automatically saves results to AURA backend:

```javascript
// Motor Skills
auraIntegration.saveMotorResults(attempts, roundSummaries, overallMetrics);

// Literacy
auraIntegration.saveLiteracyResults(responses, score, metrics, categoryScores);

// Vision
auraIntegration.saveVisionResults(colorBlindness, visualAcuity, testConditions);
```

### 3. Onboarding Completion
```javascript
// Automatic on Complete page
auraIntegration.completeOnboarding();
auraIntegration.redirectToExtension(); // Closes tab
```

---

## 🛠️ Development

### Project Structure

```
D:\Ext\sensecheck-aura\
├── client\
│   ├── src\
│   │   ├── App.jsx                      # Main app with AURA session init
│   │   ├── components\                  # Reusable UI components
│   │   ├── modules\
│   │   │   ├── Motor\                   # Motor skills game
│   │   │   ├── Visual\                  # Vision tests
│   │   │   └── Literacy\                # Literacy quiz
│   │   ├── pages\
│   │   │   ├── Home.jsx                 # Module selection
│   │   │   └── Complete.jsx             # Completion + AURA redirect
│   │   ├── state\
│   │   │   └── store.js                 # Zustand store (userId-based)
│   │   ├── utils\
│   │   │   ├── auraIntegration.js       # ⭐ AURA backend client
│   │   │   └── api.js                   # Original sensecheck API (optional)
│   │   └── resources\                   # Images, Ishihara plates
│   ├── package.json
│   └── .env.example
└── README.md (this file)
```

### Key Files

- **`auraIntegration.js`**: Core AURA integration logic
- **`store.js`**: Modified to use `userId` instead of `sessionId` in AURA mode
- **`App.jsx`**: Initializes AURA session on mount
- **Module files**: Save results to AURA backend after completion

---

## 🔐 Authentication

The game uses JWT tokens passed via URL parameters. All API calls to the AURA backend include:

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

## 🎨 Branding

This game uses AURA branding:
- **Primary Color**: `#1FB854` (Green)
- **Logo**: AURA logo from `resources/logo.png`
- **Tagline**: "Unleash the Future of UI"

---

## 📦 Building for Production

```bash
npm run build
```

Outputs to `client/dist/`. Can be deployed to any static hosting service (Vercel, Netlify, etc.).

---

## 🆚 Differences from Original Sensecheck

| Aspect | Original Sensecheck | AURA Version |
|--------|-------------------|--------------|
| **Session ID** | Generated UUID | User ID from AURA |
| **Backend** | Standalone server | AURA Extension backend |
| **Data Storage** | Session-based (temporary) | User-based (permanent) |
| **Mode Detection** | N/A | URL params (`mode=aura`) |
| **Completion** | Redirects to home | Closes tab, returns to extension |
| **Branding** | Sensecheck | AURA |

---

## 🐛 Troubleshooting

### Game not connecting to AURA backend?
- Check that AURA backend is running: `http://localhost:3000`
- Verify `.env` has correct `VITE_API_URL`
- Check browser console for errors

### Missing userId/token in URL?
- The extension should automatically include these when opening the game
- Manually test: `http://localhost:5173?mode=aura&userId=test123&token=test456`

### Results not saving?
- Check backend server logs
- Verify JWT token is valid (not expired)
- Check network tab for API call failures

---

## 📝 Notes

- The original Sensecheck backend (`D:\New\sensecheck\server`) is **not used** in AURA mode
- All data is saved to AURA backend only
- Standalone mode (without URL params) still works for testing

---

## 🤝 Contributing

This is part of the AURA Extension project. See main extension README for contribution guidelines.

---

## 📄 License

MIT License - See LICENSE file

---

**Made with ❤️ by AURA - Unleash the Future of UI**

*Date: January 2, 2026*
