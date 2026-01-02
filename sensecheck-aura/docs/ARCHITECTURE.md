# Sensecheck Architecture

## System Overview

Sensecheck is a full-stack MERN application designed for sensory and cognitive assessment through interactive web-based tests.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React 18 + Vite                                      │  │
│  │  • Konva.js (Canvas animations)                       │  │
│  │  • TailwindCSS (Styling)                             │  │
│  │  • Zustand (State management)                         │  │
│  │  • React Router (Navigation)                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓ HTTP/REST                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         SERVER                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Node.js + Express                                    │  │
│  │  • REST API endpoints                                 │  │
│  │  • Winston logging                                    │  │
│  │  • Request validation                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────┐         ┌─────────────────────────┐  │
│  │   MongoDB        │         │   File System (Logs)    │  │
│  │   • Sessions     │         │   • application.log     │  │
│  │   • Interactions │         │   • interactions.log    │  │
│  │   • Results      │         │   • errors.log          │  │
│  └──────────────────┘         └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Component Hierarchy

```
App
├── Router
│   ├── Home
│   │   └── Module Cards
│   ├── ColorBlindnessTest
│   │   ├── Layout
│   │   ├── ProgressBar
│   │   └── Interaction Tracking
│   ├── VisualAcuityTest
│   │   ├── Layout
│   │   └── Interaction Tracking
│   ├── MotorSkillsGame
│   │   ├── Layout
│   │   ├── Konva Stage/Layer
│   │   └── Interaction Tracking
│   ├── LiteracyQuiz
│   │   ├── Layout
│   │   ├── ProgressBar
│   │   └── Interaction Tracking
│   └── Results
│       └── Layout
```

### State Management (Zustand)

**Global Store Structure:**
```javascript
{
  sessionId: string,
  sessionStartTime: number,
  currentModule: string | null,
  completedModules: Array<{name, completedAt}>,
  
  colorBlindnessResults: {
    plates: Array,
    currentPlate: number,
    completed: boolean
  },
  
  visualAcuityResults: {
    attempts: Array,
    currentSize: number,
    completed: boolean
  },
  
  motorSkillsData: {
    currentRound: number,
    interactions: Array,
    completed: boolean
  },
  
  literacyResults: {
    responses: Array,
    currentQuestion: number,
    completed: boolean
  }
}
```

### Custom Hooks

**useInteractionTracking**
- Tracks user interactions (clicks, hovers, focus, touch)
- Batches requests to backend
- Module-specific tracking
- Returns tracking utilities

**useDeviceInfo**
- Detects device type (desktop/mobile/tablet)
- Screen resolution
- Touch support
- User agent

---

## Backend Architecture

### Folder Structure

```
server/
├── server.js              # Entry point
├── routes/                # API routes
│   ├── logs.js           # Interaction logging routes
│   └── results.js        # Results management routes
├── controllers/           # Route handlers
│   ├── logController.js
│   └── resultsController.js
├── models/               # Mongoose schemas
│   ├── Session.js
│   ├── InteractionLog.js
│   ├── VisionResult.js
│   └── LiteracyResult.js
├── services/             # Business logic
│   └── logging/
│       └── logger.js     # Winston configuration
├── middleware/           # Express middleware
│   ├── requestLogger.js
│   └── errorHandler.js
└── utils/                # Utilities
```

### Database Schema

**Session Collection**
```javascript
{
  sessionId: String (unique, indexed),
  createdAt: Date (indexed, TTL 7 days),
  userAgent: String,
  screenResolution: {width, height},
  deviceType: String,
  completedModules: [{moduleName, completedAt}],
  status: String (enum)
}
```

**InteractionLog Collection**
```javascript
{
  sessionId: String (indexed),
  module: String (enum, indexed),
  eventType: String,
  timestamp: Date (indexed, TTL 90 days),
  coordinates: {x, y},
  target: {id, type, value},
  metadata: Mixed,
  responseTime: Number,
  duration: Number
}
```

**VisionResult Collection**
```javascript
{
  sessionId: String (indexed),
  completedAt: Date (TTL 1 year),
  colorBlindness: {
    plates: Array,
    colorVisionScore: Number,
    diagnosis: String (enum),
    totalResponseTime: Number
  },
  visualAcuity: {
    attempts: Array,
    finalResolvedSize: Number,
    visualAngle: Number,
    mar: Number,
    snellenDenominator: Number,
    snellenEstimate: String
  },
  testConditions: Object
}
```

**LiteracyResult Collection**
```javascript
{
  sessionId: String (indexed),
  completedAt: Date (TTL 1 year),
  responses: Array,
  score: {
    correctAnswers: Number,
    totalQuestions: Number,
    percentage: Number,
    timeFactor: Number,
    computerLiteracyScore: Number
  },
  metrics: {
    totalTime: Number,
    averageResponseTime: Number,
    totalFocusShifts: Number,
    totalHoverEvents: Number
  },
  categoryScores: Array
}
```

### Logging System

**Winston Configuration**
- Daily rotating files
- Separate logs for:
  - Application logs (`application-YYYY-MM-DD.log`)
  - Errors (`error-YYYY-MM-DD.log`)
  - Interactions (`interactions-YYYY-MM-DD.log`)
  - Exceptions (`exceptions-YYYY-MM-DD.log`)
  - Rejections (`rejections-YYYY-MM-DD.log`)

**Log Retention:**
- Application logs: 14 days
- Error logs: 30 days
- Interaction logs: 30 days
- Max size per file: 20-50MB

---

## Data Flow

### 1. Session Initialization
```
User visits → Generate sessionId → Store in sessionStorage
              ↓
         POST /api/results/session
              ↓
         Create Session in MongoDB
```

### 2. Module Interaction
```
User interacts → Track event locally
                 ↓
            useInteractionTracking hook
                 ↓
            POST /api/logs/interaction (async)
                 ↓
            Batch in memory → Flush to MongoDB
                 ↓
            Log to Winston (interactions.log)
```

### 3. Results Submission
```
Module complete → Calculate scores/metrics
                  ↓
             POST /api/results/{vision|literacy}
                  ↓
             Store in MongoDB + Winston log
                  ↓
             Update session completedModules
```

### 4. Results Retrieval
```
Navigate to /results → GET /api/results/session/:sessionId
                       ↓
                  Fetch from MongoDB
                       ↓
                  Display formatted results
```

---

## Performance Optimizations

### Frontend
- Component code splitting with React Router
- Zustand for lightweight state management
- Debounced/throttled mouse tracking
- Konva.js for efficient canvas rendering

### Backend
- Async batch processing for interactions
- MongoDB indexing on frequently queried fields
- TTL indexes for automatic data expiration
- Connection pooling with Mongoose

---

## Security Considerations

- No personal information collected
- Session-based identification only
- CORS enabled for cross-origin requests
- Input validation on all endpoints
- MongoDB injection prevention via Mongoose

---

## Scalability

**Horizontal Scaling:**
- Stateless API design
- Session data in MongoDB (shared state)
- Load balancer compatible

**Database Scaling:**
- MongoDB replica sets for redundancy
- Sharding by sessionId if needed
- Indexes for query optimization

**Future Enhancements:**
- Redis for session caching
- Message queue for interaction batching
- CDN for static assets
- WebSocket for real-time updates

