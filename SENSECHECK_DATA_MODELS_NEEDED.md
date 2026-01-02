# CRITICAL UPDATE NEEDED: Full Sensecheck Data Models

## ⚠️ Current Problem

The AURA backend has **simplified models** that don't match sensecheck's detailed data structure. The original sensecheck uses sophisticated bucket-based models with extensive motor tracking data.

## 📊 What Sensecheck Actually Tracks

### Original Sensecheck (Session-Based)

```
sessionId → Multiple buckets of detailed data
├── MotorPointerTraceBucket (5000 samples per bucket)
│   └── [{round, tms, x, y, isDown, pointerType, pressure}]
│
├── MotorAttemptBucket (2000 attempts per bucket)
│   └── [{round, bubbleId, target, click, timing, spatial, kinematics, fitts}]
│       ├── timing: {reactionTimeMs, movementTimeMs, interTapMs}
│       ├── spatial: {errorDistNorm, pathLengthNorm, straightness}
│       ├── kinematics: {meanSpeed, peakSpeed, jerkRMS, submovementCount}
│       └── fitts: {D, W, ID, throughput}
│
├── MotorRoundSummary (per-round aggregated features)
│   └── {counts, features, featureVersion}
│
├── MotorSessionSummary (overall statistics)
│   └── {features, label, score}
│
└── GlobalInteractionBucket (1000 interactions per bucket)
    └── [{timestamp, eventType, module, data}]
```

### 🎯 What AURA Needs (User-Based)

Same structure as above, but using `userId` instead of `sessionId`.

---

## 📝 Required Models for AURA Backend

### 1. ✅ MotorPointerTraceBucket.js (DONE)
**Location**: `D:\Ext\server\models\MotorPointerTraceBucket.js`
- Stores raw pointer samples (x, y, timestamps)
- User-based (userId instead of sessionId)
- Bucket size: 5000 samples
- TTL: 1 year

### 2. ❌ MotorAttemptBucket.js (NEEDED)
**What it should do**:
- Store detailed attempt-level features for each bubble
- Includes kinematics, Fitts law metrics, reaction times
- Uses `featureExtraction.js` to compute features from pointer samples
- Bucket size: 2000 attempts
- User-based (userId instead of sessionId)

**Structure**:
```javascript
{
  userId: ObjectId,
  bucketNumber: Number,
  count: Number,
  isFull: Boolean,
  attempts: [{
    round: Number,
    attemptId: String,
    bubbleId: String,
    spawnTms: Number,
    target: {x, y, radius},
    click: {hit, missType, tms, x, y},
    timing: {reactionTimeMs, movementTimeMs, interTapMs},
    spatial: {errorDistNorm, pathLengthNorm, straightness},
    kinematics: {meanSpeed, peakSpeed, jerkRMS, submovementCount, overshootCount},
    fitts: {D, W, ID, throughput}
  }]
}
```

### 3. ❌ MotorRoundSummary.js (NEEDED)
**What it should do**:
- Aggregate features per round (1-3)
- Computed from MotorAttemptBucket data
- User-based

**Structure**:
```javascript
{
  userId: ObjectId,
  round: Number (1-3),
  counts: {nTargets, nHits, nMisses, hitRate},
  features: Mixed, // Aggregated stats
  featureVersion: String
}
```

### 4. ❌ MotorSessionSummary.js (NEEDED)
**What it should do**:
- Overall user motor skills summary
- Cross-round trends
- ML-ready features
- User-based

**Structure**:
```javascript
{
  userId: ObjectId,
  features: Mixed, // All aggregated features
  label: {level, score, source},
  featureVersion: String
}
```

### 5. ❌ GlobalInteractionBucket.js (NEEDED)
**What it should do**:
- Store ALL non-motor interactions during the game
- Clicks, scrolls, hovers, etc. throughout the onboarding
- User-based
- Bucket size: 1000 interactions

**Structure**:
```javascript
{
  userId: ObjectId,
  bucketNumber: Number,
  count: Number,
  isFull: Boolean,
  interactions: [{
    timestamp: Date,
    eventType: String,
    module: String,
    data: {target, position, button, key, screen, url, duration, ...}
  }]
}
```

### 6. ❌ Update OnboardingMotorResult.js
**Current issue**: Too simplified, doesn't match sensecheck structure

**Should reference**:
- MotorAttemptBucket (for all attempts)
- MotorRoundSummary (for round statistics)
- MotorSessionSummary (for overall score)

Or simply **store the userId** and let the bucket models handle all the data.

---

## 🛠️ Sensecheck → AURA Conversion

| Sensecheck (Session) | AURA (User) | Status |
|---------------------|-------------|--------|
| `sessionId` (String) | `userId` (ObjectId) | ✅ Ready |
| MotorPointerTraceBucket | MotorPointerTraceBucket | ✅ **Created** |
| MotorAttemptBucket | MotorAttemptBucket | ❌ Need to create |
| MotorRoundSummary | MotorRoundSummary | ❌ Need to create |
| MotorSessionSummary | MotorSessionSummary | ❌ Need to create |
| GlobalInteractionBucket | GlobalInteractionBucket | ❌ Need to create |
| Session | OnboardingSession | ✅ Exists |
| LiteracyResult | OnboardingLiteracyResult | ✅ Exists |
| VisionResult | OnboardingVisionResult | ✅ Exists |
| featureExtraction.js | featureExtraction.js | ✅ **Copied** |

---

## 🔧 Implementation Steps

### Step 1: Create Missing Models
1. ✅ MotorPointerTraceBucket.js (DONE)
2. ❌ MotorAttemptBucket.js
3. ❌ MotorRoundSummary.js
4. ❌ MotorSessionSummary.js
5. ❌ GlobalInteractionBucket.js

### Step 2: Update API Routes
Create endpoints to match sensecheck's structure:
- `POST /api/onboarding/motor/trace` - Add pointer samples
- `POST /api/onboarding/motor/attempts` - Add attempts (with feature extraction)
- `POST /api/onboarding/motor/summary/round` - Compute round summary
- `POST /api/onboarding/motor/summary/session` - Compute session summary
- `POST /api/onboarding/global/interactions` - Add global interactions

### Step 3: Update sensecheck-aura Client
Update the game to send data in the correct format:

**MotorSkillsGame.jsx** needs to send:
1. **Pointer samples** continuously during game:
   ```javascript
   auraIntegration.savePointerSamples(samplesArray)
   ```

2. **Attempts** when bubbles are clicked/missed:
   ```javascript
   auraIntegration.saveMotorAttempts(attemptsArray)
   ```

3. **Round summary** after each round completes:
   ```javascript
   auraIntegration.computeRoundSummary(userId, round)
   ```

4. **Session summary** when all 3 rounds complete:
   ```javascript
   auraIntegration.computeSessionSummary(userId)
   ```

**All modules** should send:
```javascript
auraIntegration.saveGlobalInteractions(interactionsArray)
```

---

## 📦 File Structure After Completion

```
D:\Ext\server\
├── models\
│   ├── User.js ✅
│   ├── Interaction.js ✅
│   ├── Stats.js ✅
│   ├── OnboardingSession.js ✅
│   ├── OnboardingLiteracyResult.js ✅
│   ├── OnboardingVisionResult.js ✅
│   ├── MotorPointerTraceBucket.js ✅ NEW
│   ├── MotorAttemptBucket.js ❌ NEEDED
│   ├── MotorRoundSummary.js ❌ NEEDED
│   ├── MotorSessionSummary.js ❌ NEEDED
│   └── GlobalInteractionBucket.js ❌ NEEDED
│
├── utils\
│   └── featureExtraction.js ✅ COPIED
│
└── routes\
    ├── auth.js ✅
    ├── interactions.js ✅
    ├── stats.js ✅
    └── onboarding.js ❌ NEEDS UPDATE (add motor endpoints)
```

---

## 🎯 Quick Reference: API Endpoints Needed

### Current (Simplified):
- `POST /api/onboarding/motor` - Save simplified motor results
- `POST /api/onboarding/literacy` - Save literacy results
- `POST /api/onboarding/vision` - Save vision results

### Needed (Full Sensecheck Match):
- `POST /api/onboarding/motor/trace` - Add pointer samples
- `POST /api/onboarding/motor/attempts` - Add enriched attempts
- `POST /api/onboarding/motor/summary/round` - Compute round features
- `POST /api/onboarding/motor/summary/session` - Compute session features
- `POST /api/onboarding/global/interactions` - Add global interactions
- `POST /api/onboarding/literacy` - ✅ (keep as is)
- `POST /api/onboarding/vision` - ✅ (keep as is)

---

## 🚀 Benefits of Full Implementation

1. **ML-Ready Data**: Exact same format as sensecheck for machine learning
2. **Research Compatibility**: Can use same analysis tools as original sensecheck
3. **Detailed Insights**: Kinematics, Fitts law, movement trajectories
4. **Bucket Performance**: Efficient storage for large datasets
5. **Feature Extraction**: Automatic computation of 50+ motor features

---

## 📊 Data Volume Estimates

Per user onboarding (3 rounds of motor skills):
- **PointerSamples**: ~3000-5000 samples (1-2 buckets)
- **Attempts**: ~60-90 attempts (1 bucket)
- **RoundSummaries**: 3 documents
- **SessionSummary**: 1 document
- **GlobalInteractions**: ~500-1000 events (1-2 buckets)

**Total**: ~8-10 documents per user for complete onboarding data

---

## ⏰ Time Estimate

To fully implement all missing models and routes:
- **Models**: ~2-3 hours (copy & adapt from sensecheck)
- **Routes**: ~1-2 hours (backend API endpoints)
- **Client Updates**: ~2-3 hours (update sensecheck-aura to send correct data)
- **Testing**: ~1-2 hours

**Total**: 6-10 hours of development

---

## 🎯 Recommendation

**Option A: Full Implementation** ⭐ RECOMMENDED
- Implement all models exactly like sensecheck
- Full compatibility with original research
- ML-ready data structure
- Best for long-term research goals

**Option B: Hybrid Approach**
- Keep simplified OnboardingMotorResult
- Add only MotorAttemptBucket for detailed attempts
- Skip round/session summaries (compute on-demand)
- Faster to implement, less storage

**Option C: Current State** (NOT RECOMMENDED)
- Keep simplified structure
- Lose all detailed motor metrics
- No ML compatibility
- Missing most of sensecheck's value

---

## 📝 Next Steps

1. **Decide**: Full implementation vs. hybrid
2. **Create models**: Copy & adapt remaining 4 models
3. **Update routes**: Add motor tracking endpoints
4. **Update client**: Send data in correct format
5. **Test**: Ensure data flows correctly

---

**Status**: In progress (1/6 models complete, utils copied)
**Priority**: HIGH - Current simplified version doesn't capture the data quality needed
**Timeline**: Should complete in 1-2 development sessions

---

**Created**: January 2, 2026
**Last Updated**: In Progress

