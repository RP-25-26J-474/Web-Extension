# Database Schema Relationships

## Overview
Sensecheck uses MongoDB with Mongoose ODM to maintain referential integrity between sessions and interaction data through a bucket pattern implementation.

---

## Schema Diagram

```
┌─────────────────────────────────────┐
│           Session                    │
│                                      │
│  sessionId: String (unique, indexed) │
│  userInfo: Object                    │
│  completedModules: Array             │
│  deviceMetrics: Object               │
│  status: String                      │
│  createdAt: Date                     │
└──────────────┬───────────────────────┘
               │
               │ 1:Many
               │
               ▼
┌─────────────────────────────────────┐
│      InteractionBucket               │
│                                      │
│  sessionId: String (ref, validated)  │
│  interactionType: 'global'|'motor'   │
│  bucketNumber: Number                │
│  count: Number                       │
│  isFull: Boolean                     │
│  interactions: Array (up to 1000)    │
│  firstInteractionAt: Date            │
│  lastInteractionAt: Date             │
└──────────────────────────────────────┘
```

---

## Relationships

### Session → InteractionBucket (One-to-Many)

**Type:** One Session can have many InteractionBuckets

**Implementation:**
- `InteractionBucket.sessionId` references `Session.sessionId`
- Index on `sessionId` for efficient lookups
- Pre-save validation ensures session exists
- Cascade delete on session removal

**Fields:**
```javascript
// Session Model
sessionId: String (unique, indexed)

// InteractionBucket Model
sessionId: String (indexed, validated against Session)
```

---

## Validation & Integrity

### Pre-Save Validation
When creating an `InteractionBucket`, the system validates that the referenced session exists:

```javascript
// In InteractionBucket schema
interactionBucketSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('sessionId')) {
    const Session = mongoose.model('Session');
    const sessionExists = await Session.findOne({ sessionId: this.sessionId });
    
    if (!sessionExists) {
      return next(new Error('Session does not exist'));
    }
  }
  next();
});
```

### Static Method Validation
The `addInteraction` static method also validates session existence:

```javascript
InteractionBucket.addInteraction = async function(sessionId, type, data) {
  const Session = mongoose.model('Session');
  const session = await Session.findOne({ sessionId });
  
  if (!session) {
    throw new Error('Session does not exist');
  }
  
  // Continue with bucket creation/update...
};
```

### API Error Handling
The API returns appropriate error codes:
- **404 Not Found:** When session doesn't exist
- **400 Bad Request:** Invalid data or missing required fields
- **500 Server Error:** Other database/server errors

---

## Virtual Fields

### Session Virtuals

**interactionBuckets** - Access all buckets for this session
```javascript
sessionSchema.virtual('interactionBuckets', {
  ref: 'InteractionBucket',
  localField: 'sessionId',
  foreignField: 'sessionId',
});

// Usage
const session = await Session.findOne({ sessionId }).populate('interactionBuckets');
console.log(session.interactionBuckets); // Array of InteractionBucket documents
```

### InteractionBucket Virtuals

**sessionDetails** - Access session information from bucket
```javascript
interactionBucketSchema.virtual('sessionDetails', {
  ref: 'Session',
  localField: 'sessionId',
  foreignField: 'sessionId',
  justOne: true,
});

// Usage
const bucket = await InteractionBucket.findOne().populate('sessionDetails');
console.log(bucket.sessionDetails); // Session document
```

---

## Helper Methods

### Session Methods

**getInteractionStats()**
```javascript
const stats = await session.getInteractionStats();
// Returns: { global: {...}, motor: {...}, total: Number }
```

**getAllInteractions(type)**
```javascript
const globalInteractions = await session.getAllInteractions('global');
const motorInteractions = await session.getAllInteractions('motor');
const allInteractions = await session.getAllInteractions(); // Both types
```

**deleteInteractionBuckets()**
```javascript
const deletedCount = await session.deleteInteractionBuckets();
// Deletes all buckets associated with this session
```

### InteractionBucket Static Methods

**addInteraction(sessionId, type, data)**
```javascript
const bucket = await InteractionBucket.addInteraction(
  'session_12345',
  'global',
  { eventType: 'click', ... }
);
```

**addInteractions(sessionId, type, dataArray)**
```javascript
await InteractionBucket.addInteractions(
  'session_12345',
  'motor',
  [{ eventType: 'bubble_hit', ... }, ...]
);
```

**getSessionInteractions(sessionId, type)**
```javascript
const interactions = await InteractionBucket.getSessionInteractions(
  'session_12345',
  'global' // Optional: 'global' or 'motor'
);
```

**getSessionStats(sessionId)**
```javascript
const stats = await InteractionBucket.getSessionStats('session_12345');
```

---

## Cascade Operations

### On Session Delete

When a session is removed, all associated interaction buckets are automatically deleted:

```javascript
sessionSchema.pre('remove', async function(next) {
  const InteractionBucket = mongoose.model('InteractionBucket');
  await InteractionBucket.deleteMany({ sessionId: this.sessionId });
  next();
});
```

**Usage:**
```javascript
const session = await Session.findOne({ sessionId: 'session_12345' });
await session.remove(); // Automatically deletes all interaction buckets
```

---

## Indexes

### Session Indexes
```javascript
{ sessionId: 1 }              // Primary lookup, unique
{ createdAt: 1 }              // TTL index (7 days)
```

### InteractionBucket Indexes
```javascript
{ sessionId: 1, interactionType: 1, bucketNumber: -1 }  // Bucket lookup
{ sessionId: 1, interactionType: 1, isFull: 1 }         // Active bucket search
```

---

## Data Flow Example

### 1. Create Session
```javascript
const session = await Session.create({
  sessionId: 'session_12345',
  userInfo: { age: 25, gender: 'Male' },
  deviceType: 'desktop'
});
```

### 2. Log Interaction (Validated)
```javascript
// ✅ This works - session exists
await InteractionBucket.addInteraction(
  'session_12345',
  'global',
  { eventType: 'click', target: {...} }
);

// ❌ This fails - session doesn't exist
await InteractionBucket.addInteraction(
  'session_99999',
  'global',
  { eventType: 'click', target: {...} }
);
// Error: Session with sessionId "session_99999" does not exist
```

### 3. Query Relationships
```javascript
// Get session with all buckets
const session = await Session.findOne({ sessionId: 'session_12345' })
  .populate('interactionBuckets');

// Get bucket with session details
const bucket = await InteractionBucket.findOne({ sessionId: 'session_12345' })
  .populate('sessionDetails');

// Get interaction statistics
const stats = await session.getInteractionStats();
```

### 4. Clean Up
```javascript
// Delete session and all its buckets
await session.remove(); // Cascades to InteractionBuckets
```

---

## Best Practices

### 1. Always Create Session First
```javascript
// ✅ Correct order
await createSession(sessionData);
await logInteraction(interactionData);

// ❌ Wrong order
await logInteraction(interactionData); // Error: Session doesn't exist
await createSession(sessionData);
```

### 2. Use Helper Methods
```javascript
// ✅ Preferred
const stats = await session.getInteractionStats();

// ❌ Manual (less efficient)
const buckets = await InteractionBucket.find({ sessionId: session.sessionId });
const stats = calculateStats(buckets);
```

### 3. Handle Validation Errors
```javascript
try {
  await InteractionBucket.addInteraction(sessionId, type, data);
} catch (error) {
  if (error.message.includes('does not exist')) {
    // Session doesn't exist - create it first or return 404
    return res.status(404).json({ error: 'Session not found' });
  }
  throw error;
}
```

### 4. Leverage Virtuals for Joins
```javascript
// Efficient population
const sessions = await Session.find()
  .populate('interactionBuckets')
  .limit(10);
```

---

## Migration Notes

If migrating from the old schema:
1. Existing `InteractionLog` and `MotorSkillsInteraction` collections are preserved
2. New data goes to `InteractionBucket` with proper relationships
3. Legacy APIs (`/api/logs/*`, `/api/motor-skills/*`) still work
4. Recommended to use new bucket API (`/api/interactions/*`)

---

## Summary

The Session ↔ InteractionBucket relationship ensures:
- ✅ **Data Integrity:** Can't create buckets without valid sessions
- ✅ **Performance:** Efficient bucketing with proper indexes
- ✅ **Maintainability:** Clean cascade deletes and helper methods
- ✅ **Flexibility:** Virtual fields for easy data access
- ✅ **Validation:** Automatic session existence checks

