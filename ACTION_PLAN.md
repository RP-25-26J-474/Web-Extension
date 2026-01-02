# AURA Integration Action Plan 🎯

## Current Status

You're **absolutely right** - I initially created a simplified version that doesn't capture all the interactions and data that sensecheck tracks. The current AURA backend is missing critical models and data structures.

## What's Complete ✅

1. **Folder Structure**: 
   - `D:\Ext\extension\` - Extension files
   - `D:\Ext\server\` - Backend
   - `D:\Ext\sensecheck-aura\` - Onboarding game

2. **Basic Models**:
   - `User.js` - User accounts
   - `Interaction.js` - Extension interactions
   - `Stats.js` - Extension statistics
   - `OnboardingSession.js` - Session tracking
   - `OnboardingLiteracyResult.js` - Literacy quiz
   - `OnboardingVisionResult.js` - Vision tests
   - `MotorPointerTraceBucket.js` - ✅ **NEW** (user-based pointer samples)

3. **Utilities**:
   - `featureExtraction.js` - ✅ **COPIED** from sensecheck

4. **Game Integration**:
   - `auraIntegration.js` already exists in sensecheck-aura
   - Basic API calls implemented

## What's Missing ❌

### Critical Models (User-Based Versions)

1. **MotorAttemptBucket.js**
   - Stores detailed motor attempt features
   - Includes kinematics, Fitts law, reaction times
   - Uses feature extraction utils

2. **MotorRoundSummary.js**
   - Per-round aggregated statistics
   - Computed from attempts

3. **MotorSessionSummary.js**
   - Overall motor skills summary
   - Cross-round trends
   - ML-ready features

4. **GlobalInteractionBucket.js**
   - ALL non-motor interactions during game
   - Clicks, scrolls, hovers throughout onboarding

### API Routes

Current `onboarding.js` has simplified endpoints. Need to add:
- `POST /motor/trace` - Add pointer samples
- `POST /motor/attempts` - Add attempts with features
- `POST /motor/summary/round` - Compute round summary
- `POST /motor/summary/session` - Compute session summary
- `POST /global/interactions` - Add global interactions

### Client Updates

`sensecheck-aura` needs to send data in the correct bucket format:
- Pointer samples continuously
- Attempts with bubble data
- Global interactions from all modules

---

## 🚀 Recommended Approach

### Option 1: Full Implementation (Recommended) ⭐

**Why**: 
- Captures ALL data that sensecheck tracks
- ML-ready data structure
- Research-quality metrics
- User-based (permanent storage)

**Time**: 6-10 hours total

**Steps**:
1. Create 4 remaining models (2-3 hours)
2. Update API routes (1-2 hours)
3. Update sensecheck-aura client (2-3 hours)
4. Test end-to-end (1-2 hours)

### Option 2: Minimal Extension (Faster)

**Why**:
- Get something working quickly
- Add full models later if needed

**Time**: 2-4 hours

**Steps**:
1. Create only `MotorAttemptBucket` and `GlobalInteractionBucket`
2. Skip round/session summaries (can compute later)
3. Update client to send attempts and interactions

### Option 3: Keep Current (Not Recommended)

**Why**:
- Already done
- But loses most of sensecheck's value
- No detailed motor metrics

---

## 📋 Detailed Implementation Checklist

### Phase 1: Backend Models (2-3 hours)

- [ ] Create `MotorAttemptBucket.js`
  - Copy from sensecheck
  - Change `sessionId` → `userId`
  - Update all references

- [ ] Create `MotorRoundSummary.js`
  - Copy from sensecheck
  - Change `sessionId` → `userId`
  - Keep all feature computation logic

- [ ] Create `MotorSessionSummary.js`
  - Copy from sensecheck
  - Change `sessionId` → `userId`
  - Keep label/scoring logic

- [ ] Create `GlobalInteractionBucket.js`
  - Copy from sensecheck
  - Change `sessionId` → `userId`
  - Update bucket management

### Phase 2: API Routes (1-2 hours)

- [ ] Update `server/routes/onboarding.js`:
  - Add `POST /motor/trace`
  - Add `POST /motor/attempts`
  - Add `POST /motor/summary/round`
  - Add `POST /motor/summary/session`
  - Add `POST /global/interactions`

- [ ] Import all new models
- [ ] Add JWT authentication to all endpoints
- [ ] Add error handling

### Phase 3: Client Updates (2-3 hours)

- [ ] Update `sensecheck-aura/client/src/utils/auraIntegration.js`:
  - Add `savePointerSamples(samples)`
  - Add `saveMotorAttempts(attempts)`
  - Add `computeRoundSummary(round)`
  - Add `computeSessionSummary()`
  - Add `saveGlobalInteractions(interactions)`

- [ ] Update `MotorSkillsGame.jsx`:
  - Send pointer samples continuously
  - Send attempts when bubbles clicked
  - Call round summary after each round
  - Call session summary when complete

- [ ] Update `motorSkillsTracking.js`:
  - Ensure it captures all data needed for buckets
  - Format data correctly for AURA backend

- [ ] Add global interaction tracking to all modules

### Phase 4: Testing (1-2 hours)

- [ ] Test pointer sample storage
- [ ] Test attempt with feature extraction
- [ ] Test round summary computation
- [ ] Test session summary computation
- [ ] Test global interaction storage
- [ ] Verify all data is user-based (userId)
- [ ] Test full onboarding flow

---

## 📝 Quick Start Commands

### If You Want to Continue Implementation:

```bash
# I can create the remaining 4 models by copying from sensecheck
# and adapting them to be user-based instead of session-based

# Models to create:
1. D:\Ext\server\models\MotorAttemptBucket.js
2. D:\Ext\server\models\MotorRoundSummary.js
3. D:\Ext\server\models\MotorSessionSummary.js
4. D:\Ext\server\models\GlobalInteractionBucket.js

# Then update routes and client
```

### Files Already Prepared:

✅ `D:\Ext\server\models\MotorPointerTraceBucket.js` - Ready
✅ `D:\Ext\server\utils\featureExtraction.js` - Ready
✅ `D:\Ext\sensecheck-aura\client\src\utils\auraIntegration.js` - Exists (needs updates)

---

## 🎯 Your Decision Point

**Question**: Which approach do you want?

**A) Full Implementation** (Recommended)
- I'll create all 4 remaining models
- Update API routes
- Update client to send correct data
- ~6-10 hours total work

**B) Minimal Extension** (Faster)
- Create only 2 models (Attempt + GlobalInteraction)
- Basic API routes
- Simplified client updates
- ~2-4 hours total work

**C) Something else?**
- Tell me what data you specifically need
- I can prioritize those parts

---

## 💡 My Recommendation

**Go with Full Implementation (Option A)**

**Why**:
1. You said you need "all the interactions tracked in sensecheck"
2. The bucket-based system is designed for this scale of data
3. User-based (permanent) storage is more valuable than session-based
4. You'll have ML-ready data for future research
5. The work is mostly copy-paste-adapt from sensecheck (already built!)

**The original sensecheck engineers spent months designing this data structure. We can adapt it in hours.**

---

## 📞 Next Steps

**Tell me**:
1. Which option (A, B, or C)?
2. Should I continue creating the models now?
3. Any specific priorities or constraints?

I'm ready to complete the full implementation whenever you give the go-ahead! 🚀

---

**Document Created**: January 2, 2026
**Status**: Awaiting your decision
**Recommendation**: Full Implementation (Option A)

