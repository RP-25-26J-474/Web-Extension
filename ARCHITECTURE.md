# AURA System Architecture 🏗️

## Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AURA INTERACTION TRACKER                        │
│                      Browser Extension (Manifest V3)                    │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   popup.html     │  │   content.js     │  │  background.js   │   │
│  │   popup.js       │  │   (injected)     │  │  (service worker)│   │
│  │   popup.css      │  │                  │  │                  │   │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤   │
│  │ • Login/Register │  │ • Track clicks   │  │ • Process data   │   │
│  │ • Statistics     │  │ • Track scrolls  │  │ • Send to API    │   │
│  │ • Settings       │  │ • Track moves    │  │ • Store locally  │   │
│  │ • Start game btn │  │ • Track hovers   │  │ • Open game tab  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
    ┌───────────────────────────┐  ┌───────────────────────────┐
    │   User Registers          │  │  Tracking Interactions    │
    │   POST /api/auth/register │  │  POST /api/interactions/  │
    └───────────────────────────┘  │       batch               │
                │                   └───────────────────────────┘
                ▼
    ┌───────────────────────────┐
    │   Onboarding Prompt       │
    │   "Complete onboarding    │
    │    game to continue"      │
    └───────────────────────────┘
                │
                │ Opens new tab with:
                │ http://localhost:5173?
                │   mode=aura&
                │   userId=507f...&
                │   token=eyJhbGc...
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     AURA ONBOARDING GAME (React)                        │
│                      D:\Ext\sensecheck-aura\                           │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                        App.jsx (Entry)                           │ │
│  │  • Reads URL params (userId, token, mode)                        │ │
│  │  • Calls auraIntegration.startSession()                          │ │
│  │  • Routes to game modules                                        │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ Perception Lab │  │ Reaction Lab   │  │ Knowledge      │         │
│  │                │  │                │  │ Console        │         │
│  ├────────────────┤  ├────────────────┤  ├────────────────┤         │
│  │ • Color        │  │ • Motor Skills │  │ • Literacy     │         │
│  │   Blindness    │  │   Game         │  │   Quiz         │         │
│  │   Test         │  │   (3 rounds)   │  │   (10 Qs)      │         │
│  │                │  │                │  │                │         │
│  │ • Visual       │  │ • Bubble       │  │ • Categories:  │         │
│  │   Acuity       │  │   Popping      │  │   - Basic      │         │
│  │   Test         │  │ • Reaction     │  │   - Internet   │         │
│  │                │  │   Time         │  │   - Security   │         │
│  │                │  │ • Accuracy     │  │   - Software   │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
│         │                     │                    │                  │
│         │                     │                    │                  │
│         │                     │                    │                  │
│  ┌──────┴─────────────────────┴────────────────────┴───────────────┐ │
│  │            auraIntegration.js (API Client)                       │ │
│  │  • saveVisionResults()                                           │ │
│  │  • saveMotorResults()                                            │ │
│  │  • saveLiteracyResults()                                         │ │
│  │  • completeOnboarding()                                          │ │
│  │  • redirectToExtension()                                         │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ All API calls
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AURA BACKEND (Node.js/Express)                       │
│                         D:\Ext\server\                                  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                      server.js (Main)                            │ │
│  │  • Express app                                                   │ │
│  │  • CORS enabled                                                  │ │
│  │  • MongoDB connected                                             │ │
│  │  • Routes mounted                                                │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ Routes         │  │ Middleware     │  │ Models         │         │
│  ├────────────────┤  ├────────────────┤  ├────────────────┤         │
│  │ • auth.js      │  │ • auth.js      │  │ • User.js      │         │
│  │ • interactions │  │   (JWT verify) │  │ • Interaction  │         │
│  │   .js          │  │                │  │ • Stats.js     │         │
│  │ • stats.js     │  │                │  │ • Onboarding   │         │
│  │ • onboarding   │  │                │  │   Session.js   │         │
│  │   .js          │  │                │  │ • Onboarding   │         │
│  │                │  │                │  │   MotorResult  │         │
│  │                │  │                │  │ • Onboarding   │         │
│  │                │  │                │  │   LiteracyRes  │         │
│  │                │  │                │  │ • Onboarding   │         │
│  │                │  │                │  │   VisionResult │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Mongoose ORM
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          MongoDB Database                               │
│                        mongodb://localhost:27017/aura                   │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ users          │  │ interactions   │  │ stats          │         │
│  ├────────────────┤  ├────────────────┤  ├────────────────┤         │
│  │ _id            │  │ userId         │  │ userId         │         │
│  │ email          │  │ type           │  │ clicks         │         │
│  │ password       │  │ url            │  │ scrolls        │         │
│  │ name           │  │ pageTitle      │  │ mouseMoves     │         │
│  │ consentGiven   │  │ timestamp      │  │ ...            │         │
│  │ trackingEnabled│  │ coordinates    │  │                │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
│                                                                         │
│  ┌────────────────────────┐  ┌────────────────────────┐              │
│  │ onboardingsessions     │  │ onboardingmotorresults │              │
│  ├────────────────────────┤  ├────────────────────────┤              │
│  │ userId                 │  │ userId                 │              │
│  │ status                 │  │ attempts[]             │              │
│  │ startedAt              │  │ roundSummaries[]       │              │
│  │ completedAt            │  │ overallMetrics         │              │
│  │ completionProgress     │  │ overallScore           │              │
│  └────────────────────────┘  └────────────────────────┘              │
│                                                                         │
│  ┌──────────────────────────┐  ┌──────────────────────────┐         │
│  │ onboardingliteracyresults│  │ onboardingvisionresults  │         │
│  ├──────────────────────────┤  ├──────────────────────────┤         │
│  │ userId                   │  │ userId                   │         │
│  │ responses[]              │  │ colorBlindness{}         │         │
│  │ score                    │  │ visualAcuity{}           │         │
│  │ categoryScores           │  │ testConditions           │         │
│  │ metrics                  │  │ overallScore             │         │
│  └──────────────────────────┘  └──────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Request Flow Examples

### 1. User Registration Flow
```
Extension (popup.js)
  │
  │ User fills form:
  │   - Name: "John Doe"
  │   - Email: "john@example.com"
  │   - Password: "secure123"
  │
  │ apiClient.register(name, email, password)
  │
  ▼
POST http://localhost:3000/api/auth/register
  │
  │ Headers:
  │   Content-Type: application/json
  │
  │ Body:
  │   { name, email, password }
  │
  ▼
Backend (routes/auth.js)
  │
  │ • Hash password with bcrypt
  │ • Create User document
  │ • Generate JWT token
  │ • Return { token, user }
  │
  ▼
MongoDB (users collection)
  │
  │ Insert:
  │   { _id, email, password (hashed), name,
  │     consentGiven: false, trackingEnabled: false,
  │     createdAt }
  │
  ▼
Extension (popup.js)
  │
  │ • Store token in localStorage
  │ • Show onboarding prompt
  │
  └─> showOnboardingPrompt()
```

### 2. Onboarding Game Flow
```
Extension (popup.js)
  │
  │ User clicks "Start Onboarding Game"
  │
  │ startOnboardingGame()
  │   - Get token from storage
  │   - Get userId from current user
  │   - Build URL with params
  │
  ▼
chrome.tabs.create({
  url: "http://localhost:5173?mode=aura&userId=507f...&token=eyJ..."
})
  │
  ▼
Onboarding Game (App.jsx)
  │
  │ useEffect(() => {
  │   auraIntegration.initialize()
  │     - Parse URL params
  │     - Store userId, token, isAuraMode
  │
  │   auraIntegration.startSession(deviceInfo)
  │ })
  │
  ▼
POST http://localhost:3000/api/onboarding/start
  │
  │ Headers:
  │   Authorization: Bearer eyJ...
  │
  │ Body:
  │   { device, screen, game, perf }
  │
  ▼
Backend (routes/onboarding.js)
  │
  │ • Verify JWT token (extract userId)
  │ • Create/update OnboardingSession
  │ • Return { session }
  │
  ▼
MongoDB (onboardingsessions)
  │
  │ Upsert:
  │   { userId, status: "in_progress", startedAt,
  │     device, screen, game, perf,
  │     completionProgress: { motor: false, ... } }
  │
  ▼
User completes modules...
  │
  ├─> Literacy Module completes
  │   └─> auraIntegration.saveLiteracyResults()
  │       └─> POST /api/onboarding/literacy
  │           └─> MongoDB: onboardingliteracyresults
  │
  ├─> Motor Module completes
  │   └─> auraIntegration.saveMotorResults()
  │       └─> POST /api/onboarding/motor
  │           └─> MongoDB: onboardingmotorresults
  │
  └─> Vision Module completes
      └─> auraIntegration.saveVisionResults()
          └─> POST /api/onboarding/vision
              └─> MongoDB: onboardingvisionresults
  │
  ▼
Complete page (Complete.jsx)
  │
  │ auraIntegration.completeOnboarding()
  │
  ▼
POST http://localhost:3000/api/onboarding/complete
  │
  ▼
Backend
  │
  │ • Update session status: "completed"
  │ • Calculate overall score
  │ • Return { overallScore }
  │
  ▼
Game (Complete.jsx)
  │
  │ auraIntegration.redirectToExtension()
  │   - window.opener.postMessage("complete")
  │   - setTimeout(() => window.close(), 2000)
  │
  ▼
Extension
  │
  │ • Onboarding complete!
  │ • User can now enable tracking
```

### 3. Interaction Tracking Flow
```
User browses website
  │
  │ Clicks a button
  │
  ▼
Content Script (content.js)
  │
  │ Event listener fires:
  │   document.addEventListener('click', ...)
  │
  │ trackClick(event)
  │   - Extract: coordinates, element, timestamp
  │   - Check: isTrackingEnabled, hasConsent
  │
  │ chrome.runtime.sendMessage({
  │   type: 'INTERACTION',
  │   data: { type: 'click', ... }
  │ })
  │
  ▼
Background Script (background.js)
  │
  │ chrome.runtime.onMessage.addListener()
  │
  │ handleInteraction(data)
  │   - Add to buffer
  │   - Increment stats.clicks
  │   - Check buffer size (50 interactions)
  │
  │ Buffer full → sendToBackend()
  │
  ▼
POST http://localhost:3000/api/interactions/batch
  │
  │ Headers:
  │   Authorization: Bearer eyJ...
  │
  │ Body:
  │   { interactions: [...50 interactions] }
  │
  ▼
Backend (routes/interactions.js)
  │
  │ • Verify JWT token
  │ • Save interactions
  │ • Update user stats
  │
  ▼
MongoDB
  │
  ├─> interactions collection
  │   └─> Insert 50 documents
  │
  └─> stats collection
      └─> Update: { $inc: { clicks: 50 } }
```

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                         │
├─────────────────────────────────────────────────────────────┤
│ • Extension: Vanilla JS (no framework)                      │
│ • Onboarding Game: React 18 + Vite                          │
│ • State Management: Zustand                                 │
│ • Routing: React Router v6                                  │
│ • Canvas: React Konva (motor skills game)                   │
│ • Styling: Tailwind CSS + Custom CSS                        │
│ • HTTP Client: Axios (game), fetch (extension)              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Backend Layer                          │
├─────────────────────────────────────────────────────────────┤
│ • Runtime: Node.js 18+                                      │
│ • Framework: Express.js                                     │
│ • Database ORM: Mongoose                                    │
│ • Authentication: JWT (jsonwebtoken)                        │
│ • Password Hashing: bcryptjs                                │
│ • CORS: cors middleware                                     │
│ • Environment: dotenv                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                         │
├─────────────────────────────────────────────────────────────┤
│ • Database: MongoDB                                         │
│ • Collections: 7 (users, interactions, stats, 4 onboarding)│
│ • Indexes: userId, email (unique), timestamps               │
│ • TTL: onboarding results expire after 1 year              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Extension Layer                        │
├─────────────────────────────────────────────────────────────┤
│ • Manifest: V3 (service_worker for Chrome/Edge)            │
│ • Manifest: V3 (scripts for Firefox)                        │
│ • Content Script: Injected into all pages                   │
│ • Background: Service worker (event-driven)                 │
│ • Popup: Browser action UI                                  │
│ • Storage: chrome.storage.local + localStorage              │
│ • Permissions: storage, activeTab, <all_urls>              │
└─────────────────────────────────────────────────────────────┘
```

---

## Port Configuration

| Service | Port | URL |
|---------|------|-----|
| Backend Server | 3000 | `http://localhost:3000` |
| Onboarding Game | 5173 | `http://localhost:5173` |
| MongoDB | 27017 | `mongodb://localhost:27017/aura` |

---

## API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `POST /logout` - Logout user
- `GET /me` - Get current user
- `PUT /settings` - Update user settings (consent, tracking)

### Interactions (`/api/interactions`)
- `POST /batch` - Save batch of interactions
- `GET /` - Get all user interactions
- `GET /recent?limit=10` - Get recent interactions
- `DELETE /clear` - Clear all user interactions

### Statistics (`/api/stats`)
- `GET /` - Get user statistics

### Onboarding (`/api/onboarding`)
- `GET /status` - Check onboarding completion status
- `POST /start` - Start onboarding session
- `POST /motor` - Save motor skills results
- `POST /literacy` - Save literacy results
- `POST /vision` - Save vision results
- `POST /complete` - Complete onboarding
- `GET /results` - Get onboarding results

---

**Made with ❤️ by AURA - Unleash the Future of UI**

*Architecture documented: January 2, 2026*

