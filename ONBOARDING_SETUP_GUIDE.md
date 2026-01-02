# 🎮 Onboarding Game Integration - Complete Setup Guide

## ✅ What's Been Done

### 1. Extension Side (AURA)
- ✅ Updated `config.js` - Added `ONBOARDING_GAME_URL`
- ✅ Updated `api-client.js` - Added `getOnboardingStatus()` method
- ✅ Updated `popup.js` - Added onboarding check, prompt, and game launcher
- ✅ Updated `popup.css` - Added onboarding prompt styling
- ✅ Backend models & API routes ready

### 2. Sensecheck Side
- ✅ Created `auraIntegration.js` in `D:\New\sensecheck\client\src\utils\`

---

## 🔧 Setup Steps

### Step 1: Update Sensecheck to Support AURA Mode

#### A. Import AURA Integration
In `D:\New\sensecheck\client\src\App.jsx`:

```javascript
import { useEffect } from 'react';
import auraIntegration from './utils/auraIntegration';

function App() {
  useEffect(() => {
    // Initialize AURA integration on app load
    if (auraIntegration.isEnabled()) {
      console.log('🌟 Running in AURA mode');
      
      // Start AURA session
      const deviceInfo = {
        device: {
          pointerPrimary: 'mouse', // Detect this
          os: navigator.platform,
          browser: navigator.userAgent,
        },
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          dpr: window.devicePixelRatio,
        },
        game: {
          gameVersion: '1.0.0',
          metricsVersion: 'aura-v1',
          roundCount: 3,
          columns: 5,
          bubbleRadiusPx: 40,
          bubbleTTLms: 3000,
        },
        perf: {
          samplingHzTarget: 60,
        },
      };
      
      auraIntegration.startSession(deviceInfo)
        .catch(err => console.error('Failed to start AURA session:', err));
    }
  }, []);
  
  // ... rest of App component
}
```

#### B. Update Motor Skills Game
In `D:\New\sensecheck\client\src\modules\Motor\MotorSkillsGame.jsx`:

Find where results are saved and add:

```javascript
// After motor skills complete
const handleGameComplete = async (gameData) => {
  // Original sensecheck save
  await saveMotorResults(sessionId, gameData);
  
  // AURA mode save
  if (auraIntegration.isEnabled()) {
    try {
      await auraIntegration.saveMotorResults(
        gameData.attempts,
        gameData.roundSummaries,
        gameData.overallMetrics
      );
      console.log('✅ Motor results saved to AURA');
    } catch (error) {
      console.error('Failed to save to AURA:', error);
    }
  }
  
  // Navigate to next test
  navigate('/knowledge/literacy');
};
```

#### C. Update Literacy Quiz
In `D:\New\sensecheck\client\src\modules\Literacy\LiteracyQuiz.jsx`:

```javascript
const handleQuizComplete = async () => {
  // Calculate scores
  const score = calculateLiteracyScore(responses);
  const categoryScores = calculateCategoryScores(responses);
  const metrics = {
    totalTime,
    averageResponseTime,
    totalFocusShifts,
    totalHoverEvents,
  };
  
  // Original sensecheck save
  await saveLiteracyResults(sessionId, { responses, score, metrics, categoryScores });
  
  // AURA mode save
  if (auraIntegration.isEnabled()) {
    try {
      await auraIntegration.saveLiteracyResults(responses, score, metrics, categoryScores);
      console.log('✅ Literacy results saved to AURA');
    } catch (error) {
      console.error('Failed to save to AURA:', error);
    }
  }
  
  navigate('/perception/color-blindness');
};
```

#### D. Update Vision Tests
In `D:\New\sensecheck\client\src\modules\Visual\VisualAcuityTest.jsx`:

```javascript
const handleAllTestsComplete = async () => {
  // Assuming you have both color blindness and visual acuity results
  const visionData = {
    colorBlindness: {
      plates: colorBlindnessResults,
      colorVisionScore: calculateColorScore(),
      diagnosis: determineDiagnosis(),
      totalResponseTime: getTotalTime(),
    },
    visualAcuity: {
      attempts: visualAcuityAttempts,
      finalResolvedSize,
      visualAngle,
      mar,
      snellenDenominator,
      snellenEstimate,
      totalResponseTime,
    },
    testConditions: {
      screenSize: { width: window.screen.width, height: window.screen.height },
      viewingDistance: estimatedDistance,
      brightness: getBrightness(),
      timeOfDay: new Date().toISOString(),
    },
  };
  
  // Original sensecheck save
  await saveVisionResults(sessionId, visionData);
  
  // AURA mode save
  if (auraIntegration.isEnabled()) {
    try {
      await auraIntegration.saveVisionResults(
        visionData.colorBlindness,
        visionData.visualAcuity,
        visionData.testConditions
      );
      console.log('✅ Vision results saved to AURA');
      
      // Complete onboarding
      const result = await auraIntegration.completeOnboarding();
      console.log('🎉 AURA Onboarding complete!', result);
      
      // Redirect back to extension
      auraIntegration.redirectToExtension();
    } catch (error) {
      console.error('Failed to save to AURA:', error);
    }
  } else {
    // Normal flow
    navigate('/complete');
  }
};
```

#### E. Update Complete Page
In `D:\New\sensecheck\client\src\pages\Complete.jsx`:

```javascript
import { useEffect } from 'react';
import auraIntegration from '../utils/auraIntegration';

function Complete() {
  useEffect(() => {
    if (auraIntegration.isEnabled()) {
      // Show AURA-specific completion message
      setTimeout(() => {
        auraIntegration.redirectToExtension();
      }, 3000);
    }
  }, []);
  
  return (
    <div>
      {auraIntegration.isEnabled() ? (
        <>
          <h1>🎉 Onboarding Complete!</h1>
          <p>Redirecting back to AURA extension...</p>
          <p>You can close this tab if it doesn't close automatically.</p>
        </>
      ) : (
        <>
          <h1>Assessment Complete!</h1>
          {/* Normal sensecheck completion UI */}
        </>
      )}
    </div>
  );
}
```

---

### Step 2: Configure CORS for AURA Backend

In `D:\Ext\server\server.js`, ensure CORS allows sensecheck origin:

```javascript
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'chrome-extension://',
      'moz-extension://',
      'http://localhost:5173', // Sensecheck dev
      'https://your-sensecheck-app.vercel.app', // Production
    ];
    
    if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in development
    }
  },
  credentials: true
}));
```

---

### Step 3: Test the Integration

#### Terminal 1: Start AURA Backend
```bash
cd D:\Ext\server
npm start
```

#### Terminal 2: Start Sensecheck
```bash
cd D:\New\sensecheck\client
npm run dev
```

#### Terminal 3: Load Extension
```
1. Open chrome://extensions/
2. Ensure manifest is Chrome version (has service_worker)
3. Load unpacked extension from D:\Ext
4. Click extension icon
```

---

### Step 4: Test Flow

1. **Register** a new user in AURA extension
2. **Login** - Should show onboarding prompt
3. **Click "Start Onboarding Game"**
4. **New tab opens** with sensecheck game (URL has userId, token, mode=aura)
5. **Complete** motor skills → literacy → vision tests
6. **Tab closes** automatically and returns to extension
7. **Extension** now shows consent screen
8. **Accept consent** and start tracking!

---

## 🔍 Debugging

### Check if AURA Mode is Active
In sensecheck console:
```javascript
auraIntegration.isEnabled() // Should return true
auraIntegration.getUserId() // Should show user ID
```

### Check API Calls
In sensecheck console:
```javascript
// Should see console logs:
// 🌟 AURA Integration initialized
// 🚀 Starting AURA onboarding session
// 💪 Saving motor skills results to AURA
// 📚 Saving literacy results to AURA
// 👁️ Saving vision results to AURA
// ✅ Completing AURA onboarding
```

### Common Issues

**Issue: Game doesn't open**
- Check `API_CONFIG.ONBOARDING_GAME_URL` in config.js
- Ensure sensecheck is running on that port

**Issue: "Invalid onboarding link"**
- Check if userId and token are in URL
- Verify user is logged in to extension

**Issue: API calls fail**
- Check CORS settings in server.js
- Verify backend is running
- Check auth token is valid

---

## 📦 Production Deployment

### 1. Deploy Sensecheck
```bash
cd D:\New\sensecheck\client
npm run build

# Deploy to Vercel/Netlify
vercel --prod
```

### 2. Update Extension Config
In `config.js`:
```javascript
ONBOARDING_GAME_URL: 'https://your-sensecheck-app.vercel.app',
```

### 3. Update Backend CORS
Add production sensecheck URL to allowed origins

---

## ✅ Checklist

- [ ] `auraIntegration.js` created in sensecheck
- [ ] App.jsx updated to initialize AURA mode
- [ ] Motor skills game saves to AURA
- [ ] Literacy quiz saves to AURA
- [ ] Vision tests save to AURA
- [ ] Complete page redirects to extension
- [ ] CORS configured in backend
- [ ] Both servers running
- [ ] Extension loaded in Chrome
- [ ] Test registration → onboarding flow
- [ ] Verify data saved in MongoDB

---

**Made with ❤️ by AURA - Unleash the Future of UI**

