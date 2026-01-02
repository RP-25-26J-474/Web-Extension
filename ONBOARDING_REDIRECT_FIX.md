# Onboarding Redirection Troubleshooting Guide

## ✅ Fix Applied

Updated `handleAcceptConsent()` in `popup.js` to check onboarding status and redirect to the game if not completed.

---

## 🧪 Testing Steps

### 1. Ensure Both Servers Are Running

**Backend Server:**
```bash
cd D:\Ext\server
npm start
# Should see: Server running on port 3000
```

**Sensecheck-Aura Client:**
```bash
cd D:\Ext\sensecheck-aura\client
npm run dev
# Should see: Local: http://localhost:5173/
```

### 2. Test the Registration Flow

1. **Open Extension Popup**
   - Click the AURA extension icon in your browser

2. **Register a New User**
   - Click "Register" tab
   - Fill in:
     - Full Name
     - Email
     - Password (min 6 chars)
     - Age (1-120)
     - Gender
   - Click "Create Account"

3. **Expected Flow:**
   - ✅ Registration succeeds
   - ✅ Shows "Account created successfully!" notification
   - ✅ Displays Consent section
   - ✅ Click "Accept & Enable Tracking"
   - ✅ Checks onboarding status
   - ✅ Shows onboarding prompt with "Welcome [Name]!" message
   - ✅ Click "Start Onboarding Game"
   - ✅ Opens game in new tab: `http://localhost:5173/?userId=...&token=...&mode=aura`
   - ✅ Extension popup closes

---

## 🐛 Debugging

### Check Browser Console (Extension Popup)

Look for these console logs:

```
✅ Expected Logs:
📝 Showing auth section
🔍 Checking onboarding status...
📋 Onboarding status received: {completed: false, hasSession: false}
🎮 User has not completed onboarding, showing prompt...
🎮 Showing onboarding prompt for user: {name: "...", email: "..."}
```

### Check Network Tab

1. Open DevTools → Network tab
2. During registration/consent, look for:
   - `POST /api/auth/register` → 201 Created
   - `PUT /api/auth/settings` → 200 OK
   - `GET /api/onboarding/status` → 200 OK

### Common Issues & Solutions

#### Issue 1: "Start Onboarding Game" button doesn't work
**Solution:** Check if `startOnboardingGame()` function has errors
```javascript
// Open browser console and run:
window.startOnboardingGame = async function() {
  const token = await apiClient.getToken();
  const userData = await apiClient.getCurrentUser();
  const gameUrl = `http://localhost:5173?userId=${userData.user._id}&token=${token}&mode=aura`;
  console.log('Game URL:', gameUrl);
  chrome.tabs.create({ url: gameUrl });
};
window.startOnboardingGame();
```

#### Issue 2: Game opens but shows "Invalid onboarding link"
**Check:**
- Token is being passed correctly in URL
- userId is valid
- mode=aura is present

**Test game URL directly:**
```
http://localhost:5173/?userId=USER_ID_HERE&token=TOKEN_HERE&mode=aura
```

#### Issue 3: Onboarding prompt doesn't show
**Check console for:**
```
🔍 Checking onboarding status...
📋 Onboarding status received: {...}
```

**If missing, check:**
- Backend `/api/onboarding/status` endpoint is working
- User is authenticated (token is valid)

#### Issue 4: Popup goes directly to main content
**This means user has already completed onboarding**

To reset for testing:
```bash
# In MongoDB, delete onboarding session:
db.onboardingsessions.deleteOne({ userId: ObjectId("USER_ID") })
```

---

## 🔍 Manual Test Script

Run this in the extension popup console:

```javascript
// Test onboarding flow manually
async function testOnboarding() {
  console.log('🧪 Testing onboarding flow...');
  
  // Step 1: Check onboarding status
  const status = await apiClient.getOnboardingStatus();
  console.log('1️⃣ Onboarding status:', status);
  
  // Step 2: Get current user
  const userData = await apiClient.getCurrentUser();
  console.log('2️⃣ User data:', userData);
  
  // Step 3: Build game URL
  const token = await apiClient.getToken();
  const gameUrl = `http://localhost:5173?userId=${userData.user._id}&token=${token}&mode=aura`;
  console.log('3️⃣ Game URL:', gameUrl);
  
  // Step 4: Open game
  chrome.tabs.create({ url: gameUrl }, (tab) => {
    console.log('4️⃣ ✅ Game opened in tab:', tab.id);
  });
}

// Run test
testOnboarding();
```

---

## ✅ Expected Behavior Summary

### New User Registration Flow:
```
1. User registers
   ↓
2. Show consent section
   ↓
3. User accepts consent
   ↓
4. Check onboarding status → NOT completed
   ↓
5. Show onboarding prompt
   ↓
6. User clicks "Start Onboarding Game"
   ↓
7. Open game in new tab
   ↓
8. Close extension popup
   ↓
9. User completes game
   ↓
10. Game posts completion to backend
   ↓
11. User opens extension again
   ↓
12. Check onboarding status → COMPLETED
   ↓
13. Show main content (tracking interface)
```

---

## 📊 Backend Endpoint Check

Test these endpoints manually:

```bash
# 1. Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "age": 25,
    "gender": "male"
  }'

# 2. Login (get token)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# 3. Check onboarding status (use token from login)
curl http://localhost:3000/api/onboarding/status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected response:
# {"completed": false, "hasSession": false}
```

---

## 🎯 Key Code Changes

### File: `extension/popup.js`

**Function: `handleAcceptConsent()`**
- ✅ Added onboarding status check
- ✅ Shows onboarding prompt if not completed
- ✅ Shows main content if completed
- ✅ Added detailed console logging

**Function: `showOnboardingPrompt(user)`**
- ✅ Added null-safe user name display: `${user?.name || 'User'}`
- ✅ Added logging for debugging

---

## 🔄 Next Steps After Fix

1. **Reload Extension**
   - Go to `chrome://extensions/`
   - Click reload button on AURA extension

2. **Clear Extension Data** (optional, for fresh test)
   ```javascript
   chrome.storage.local.clear();
   ```

3. **Test Registration Flow**
   - Register new user
   - Accept consent
   - Verify onboarding prompt appears
   - Click "Start Onboarding Game"
   - Verify new tab opens with game

---

**Date:** January 2, 2026  
**Status:** ✅ Fix Applied  
**Affected Files:** `extension/popup.js`

