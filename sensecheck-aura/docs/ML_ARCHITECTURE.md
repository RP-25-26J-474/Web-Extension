# ML-Ready Architecture for Motor Skills Assessment

## Overview

The database schema has been restructured to support machine learning model training. The new architecture separates data by granularity, prevents feature leakage, and enables both classical ML and sequence modeling.

---

## Why the Schema Changed

### Previous Issues
The original `InteractionBucket` mixed multiple granularities:
- **Per-sample data** (pointer positions)
- **Per-attempt data** (bubble clicks)
- **Per-round totals** (aggregated metrics)

This caused:
- ❌ Feature leakage (aggregated stats in raw data)
- ❌ Duplication
- ❌ Inefficient queries
- ❌ Difficulty computing ML features

### New Approach
**Bucket by dataset layer:**
- Raw pointer traces → `MotorPointerTraceBucket`
- Attempt-level features → `MotorAttemptBucket`
- Aggregated round/session features → `MotorRoundSummary` / `MotorSessionSummary`

---

## Schema Architecture

```
┌────────────────────────────────────────┐
│        SessionMeta (1/session)         │
│  - Device metadata                     │
│  - Game configuration                  │
│  - Performance metrics                 │
│  - Demographics (privacy-preserving)   │
└────────────┬───────────────────────────┘
             │
             ├──────────────────────────────────┐
             │                                  │
             ▼                                  ▼
┌────────────────────────────┐    ┌────────────────────────────┐
│  Global InteractionBucket  │    │  MotorPointerTraceBucket   │
│  (bucketed, ~1000/bucket)  │    │  (bucketed, ~5000/bucket)  │
│  - UI interactions         │    │  - Downsampled 30-60Hz     │
│  - Navigation events       │    │  - Round-segmented         │
│  - TTL: 90 days            │    │  - Normalized coordinates  │
│                            │    │  - TTL: 90 days            │
└────────────────────────────┘    └────────────────────────────┘
                                              │
                                              │
                                              ▼
                                  ┌────────────────────────────┐
                                  │   MotorAttemptBucket       │
                                  │   (bucketed, ~2000/bucket) │
                                  │   - One record/bubble      │
                                  │   - Computed features      │
                                  │   - TTL: 90 days           │
                                  └────────────┬───────────────┘
                                               │
                                               │
                        ┌──────────────────────┼──────────────────────┐
                        ▼                      ▼                      ▼
              ┌──────────────────┐   ┌──────────────────┐  ┌──────────────────┐
              │ MotorRoundSummary│   │MotorRoundSummary │  │MotorRoundSummary │
              │    (Round 1)     │   │    (Round 2)     │  │    (Round 3)     │
              │  - Aggregated    │   │  - Aggregated    │  │  - Aggregated    │
              │    features      │   │    features      │  │    features      │
              │  - NO TTL        │   │  - NO TTL        │  │  - NO TTL        │
              └──────────────────┘   └──────────────────┘  └──────────────────┘
                        │                      │                      │
                        └──────────────────────┴──────────────────────┘
                                               │
                                               ▼
                                  ┌────────────────────────────┐
                                  │  MotorSessionSummary       │
                                  │  (1/session)               │
                                  │  - Cross-round features    │
                                  │  - Label (for training)    │
                                  │  - NO TTL (keep long-term) │
                                  └────────────────────────────┘
```

---

## Collections

### 1. SessionMeta
**Purpose:** Store all session-level metadata  
**Bucketed:** No (1 document per session)  
**TTL:** 365 days

**Key Fields:**
- `participantId`: Anonymized stable identifier
- `device`: Pointer type (mouse/touch/pen), OS, browser
- `screen`: Dimensions, DPR
- `game`: Version, difficulty, bubble config
- `perf`: Frame rate, sampling Hz, input lag
- `userInfo`: Age bucket, gender

**Why:** Needed for normalization, feature interpretation, and preventing "slow device" == impaired.

---

### 2. GlobalInteractionBucket
**Purpose:** Store UI/navigation interactions  
**Bucketed:** Yes (~1000 interactions/bucket)  
**TTL:** 90 days

**Data Structure:**
```javascript
{
  eventType: "click" | "scroll" | "keypress" | ...,
  timestamp: Date,
  module: String,
  data: {
    position: { x, y },
    target: {...},
    url, screen, ...
  }
}
```

---

### 3. MotorPointerTraceBucket
**Purpose:** Store raw pointer movement  
**Bucketed:** Yes (~5000 samples/bucket)  
**TTL:** 90 days

**Sample Schema:**
```javascript
{
  round: 1-3,
  tms: Number,        // ms since round start
  x: Number,          // normalized 0..1
  y: Number,          // normalized 0..1
  isDown: Boolean,
  pointerType: "mouse" | "touch" | "pen",
  pointerId: Number,
  pressure: Number    // optional
}
```

**Use Cases:**
- Tremor detection (spectral analysis)
- Movement trajectory analysis
- Sequence models (LSTM/Transformer)

---

### 4. MotorAttemptBucket ⭐ MOST IMPORTANT
**Purpose:** Store attempt-level features (PRIMARY for ML training)  
**Bucketed:** Yes (~2000 attempts/bucket)  
**TTL:** 90 days

**Attempt Schema:**
```javascript
{
  round: 1-3,
  attemptId: String,
  bubbleId: String,
  
  // Target
  spawnTms, despawnTms, ttlMs,
  column, speedNorm,
  target: { x, y, radius },
  
  // Outcome
  click: {
    clicked, hit, missType,
    tms, x, y
  },
  
  // Derived features (computed server-side)
  timing: {
    reactionTimeMs,
    movementTimeMs,
    interTapMs
  },
  spatial: {
    errorDistNorm,
    pathLengthNorm,
    directDistNorm,
    straightness
  },
  kinematics: {
    meanSpeed, peakSpeed, speedVar,
    meanAccel, peakAccel,
    jerkRMS,
    submovementCount,
    overshootCount
  },
  fitts: {
    D, W, ID,
    throughput
  }
}
```

**Feature Extraction:** See [`server/utils/featureExtraction.js`](../server/utils/featureExtraction.js)

---

### 5. MotorRoundSummary
**Purpose:** Aggregated features per round  
**Bucketed:** No (1 doc per session per round)  
**TTL:** None (keep for research)

**Schema:**
```javascript
{
  sessionId, participantId, round,
  
  counts: {
    nTargets, nHits, nMisses,
    hitRate
  },
  
  features: {
    reactionTime_mean, reactionTime_std,
    movementTime_mean, movementTime_std,
    throughput_mean, throughput_std,
    jerkRMS_mean, jerkRMS_std,
    submovementCount_mean,
    overshootCount_mean,
    ...
  },
  
  featureVersion: "v1"
}
```

**Computed:** Server-side via `computeRoundFeatures(sessionId, round)`

---

### 6. MotorSessionSummary
**Purpose:** Session-level features + labels for ML training  
**Bucketed:** No (1 doc per session)  
**TTL:** None (keep for research)

**Schema:**
```javascript
{
  sessionId, participantId,
  
  features: {
    // Per-round features prefixed r1_, r2_, r3_
    r1_hitRate, r2_hitRate, r3_hitRate,
    r1_throughput_mean, r2_throughput_mean, ...
    
    // Cross-round trends
    hitRate_trend,
    throughput_trend,
    ...
  },
  
  label: {
    level: "normal" | "mild" | "moderate" | "severe",
    score: Number,
    source: "self_report" | "percentile" | "clinician" | "hybrid",
    version: Number
  },
  
  featureVersion: "v1"
}
```

**Computed:** Server-side via `computeSessionFeatures(sessionId)`

---

## Feature Extraction

### Exact Formulas Implemented

**File:** `server/utils/featureExtraction.js`

#### 1. Velocity
```javascript
dt_i = t[i] - t[i-1]
v_i = (p[i] - p[i-1]) / dt_i
speed_i = ||v_i||
```

#### 2. Acceleration
```javascript
a_i = (v[i] - v[i-1]) / dt_i
acc_i = ||a_i||
```

#### 3. Jerk & jerkRMS
```javascript
j_i = (a[i] - a[i-1]) / dt_i
jerk_i = ||j_i||
jerkRMS = sqrt(mean(jerk_i^2))
```

#### 4. Submovement Count
- Smooth speed with moving average (window=5)
- Count local maxima where `speed[i-1] < speed[i] > speed[i+1]` and `speed[i] >= 0.15 * peakSpeed`
- More peaks → more corrections → difficulty

#### 5. Overshoot Count
- Track distance to target over time
- Count reversals: moving closer → moving away (within 2*radius of target)
- Indicates targeting difficulty

#### 6. Fitts' Law Throughput
```javascript
D = distance(start, target)
W = 2 * radius
ID = log2(D/W + 1)
throughput = ID / movementTimeSeconds
```

---

## API Endpoints

### Motor Skills (ML-Ready)

**Base:** `/api/motor`

#### Pointer Trace
- `POST /api/motor/trace` - Log pointer samples
- `GET /api/motor/trace/:sessionId?round=1` - Get samples

#### Attempts
- `POST /api/motor/attempts` - Log attempts (with computed features)
- `GET /api/motor/attempts/:sessionId?round=1` - Get attempts
- `GET /api/motor/attempts/:sessionId/stats` - Get statistics

#### Summaries
- `POST /api/motor/summary/round` - Compute round summary
- `POST /api/motor/summary/session` - Compute session summary
- `GET /api/motor/summary/round/:sessionId/:round` - Get round summary
- `GET /api/motor/summary/session/:sessionId` - Get session summary
- `PATCH /api/motor/summary/session/:sessionId/label` - Update label
- `GET /api/motor/training?labelLevel=mild&limit=1000` - Get training data

### Global Interactions

**Base:** `/api/global`

- `POST /api/global/interactions` - Log global interactions (batch)
- `GET /api/global/interactions/:sessionId` - Get all global interactions

---

## Workflow

### 1. Session Creation
```javascript
POST /api/results/session
{
  sessionId: "session_12345",
  participantId: "participant_anon_001",
  device: { pointerPrimary: "mouse", os: "Windows", browser: "Chrome" },
  screen: { width: 1920, height: 1080, dpr: 1 },
  game: {
    gameVersion: "1.0.0",
    metricsVersion: "ms-v1",
    bubbleRadiusPx: 40,
    bubbleTTLms: 3000,
    roundCount: 3,
    columns: 5
  },
  perf: { samplingHzTarget: 60, avgFrameMs: 16.7 },
  userInfo: { age: 28, gender: "Male", ageBucket: "25-34" }
}
```

### 2. During Game (Client sends periodically)
```javascript
// Pointer trace
POST /api/motor/trace
{
  sessionId: "session_12345",
  samples: [
    { round: 1, tms: 120, x: 0.42, y: 0.61, isDown: false, pointerType: "mouse" },
    { round: 1, tms: 137, x: 0.43, y: 0.60, isDown: false, pointerType: "mouse" },
    ...
  ]
}
```

### 3. After Each Attempt (Client computes OR server enriches)
```javascript
POST /api/motor/attempts
{
  sessionId: "session_12345",
  attempts: [
    {
      round: 1,
      attemptId: "r1_0001",
      bubbleId: "bubble_001",
      spawnTms: 0,
      target: { x: 0.3, y: 0.4, radius: 0.03 },
      click: { clicked: true, hit: true, missType: "hit", tms: 820, x: 0.31, y: 0.41 },
      // Server computes timing, spatial, kinematics, fitts
    }
  ]
}
```

Server-side feature extraction enriches with:
- `timing`, `spatial`, `kinematics`, `fitts`

### 4. After Each Round
```javascript
POST /api/motor/summary/round
{
  sessionId: "session_12345",
  participantId: "participant_anon_001",
  round: 1
}
```

Server computes aggregated features from attempts.

### 5. After Session Complete
```javascript
POST /api/motor/summary/session
{
  sessionId: "session_12345",
  participantId: "participant_anon_001",
  label: { // optional, can be added later
    level: "mild",
    score: 0.65,
    source: "percentile",
    version: 1
  }
}
```

Server computes cross-round features.

### 6. ML Training (Researcher)
```javascript
GET /api/motor/training?labelLevel=mild&limit=1000

// Returns array of MotorSessionSummary documents
// Ready for pandas/sklearn
```

---

## TTL Strategy

| Collection | TTL | Reason |
|---|---|---|
| `SessionMeta` | 365 days | Metadata needed for longitudinal analysis |
| `GlobalInteractionBucket` | 90 days | Raw telemetry, large volume |
| `MotorPointerTraceBucket` | 90 days | Raw telemetry, large volume |
| `MotorAttemptBucket` | 90 days | Raw features, can recompute summaries |
| `MotorRoundSummary` | None | Derived, needed for research |
| `MotorSessionSummary` | None | ML training data, keep indefinitely |

---

## Indexing Strategy

### SessionMeta
```javascript
{ sessionId: 1 } unique
{ participantId: 1, createdAt: 1 }
{ status: 1 }
{ 'userInfo.ageBucket': 1 }
{ 'device.pointerPrimary': 1 }
```

### MotorPointerTraceBucket
```javascript
{ sessionId: 1, bucketNumber: 1 }
{ sessionId: 1, isFull: 1 }
{ createdAt: 1 } // TTL index
```

### MotorAttemptBucket
```javascript
{ sessionId: 1, bucketNumber: 1 }
{ sessionId: 1, isFull: 1 }
{ createdAt: 1 } // TTL index
```

### MotorRoundSummary
```javascript
{ sessionId: 1, round: 1 } unique
{ participantId: 1, createdAt: 1 }
```

### MotorSessionSummary
```javascript
{ sessionId: 1 } unique
{ participantId: 1, createdAt: 1 }
{ 'label.level': 1 } // For stratified sampling
```

---

## Migration from Old Schema

The old `InteractionBucket` with mixed `global`/`motor` types is still supported (legacy API at `/api/interactions`).

**For new implementations:**
1. Use `/api/motor/*` for motor skills data
2. Use `/api/global/*` for global interactions
3. Compute features server-side using `extractAttemptFeatures()`
4. Generate summaries after each round/session

**Migration script** (if needed):
- Read old `InteractionBucket` documents
- Parse `motor` interactions
- Extract attempts and traces
- Recompute features
- Store in new collections

---

## Best Practices

### 1. Always create session first
```javascript
// ✅ Correct
await createSession({...});
await logMotorAttempts({...});

// ❌ Wrong (will get 404)
await logMotorAttempts({...});
```

### 2. Normalize coordinates client-side
```javascript
const minDim = Math.min(screenWidth, screenHeight);
const xNorm = x / screenWidth;
const yNorm = y / screenHeight;
const radiusNorm = bubbleRadiusPx / minDim;
```

### 3. Downsample pointer traces
- Target: 30-60 Hz (not raw 120+ Hz)
- Reduces storage and noise
- Still captures movement dynamics

### 4. Batch operations
- Don't send 1 request per sample
- Batch 10-50 samples/attempts per request
- Use periodic flush (e.g., every 2 seconds)

### 5. Compute summaries server-side
- Don't send aggregated features from client
- Server has access to all attempts and can compute consistently
- Use `POST /api/motor/summary/round` and `/session`

### 6. Label data progressively
- Initial save: `label.level = "unknown"`
- Update later via `PATCH /api/motor/summary/session/:sessionId/label`
- Allows collecting data before labeling

---

## Next Steps

1. ✅ Backend schema and API implemented
2. ⏳ Update client to send data in new format
3. ⏳ Implement client-side normalization
4. ⏳ Test feature extraction pipeline
5. ⏳ Verify summaries compute correctly
6. ⏳ Export training data to pandas/sklearn
7. ⏳ Train initial ML models

---

## Summary

**Key Improvements:**
- ✅ Separated data by granularity (traces, attempts, summaries)
- ✅ Prevented feature leakage
- ✅ Implemented exact kinematic formulas
- ✅ Efficient bucketing strategy
- ✅ TTL for raw data, permanent storage for summaries
- ✅ Proper indexing for ML queries
- ✅ Server-side feature computation
- ✅ Label management for supervised learning

**Ready for:**
- Classical ML (Random Forest, XGBoost on summaries)
- Sequence models (LSTM/Transformer on traces)
- Longitudinal analysis (participant tracking)
- Real-time inference (load summary, predict)


