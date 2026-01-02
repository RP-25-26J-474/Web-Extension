# Sensecheck API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Currently, no authentication is required. Sessions are identified by `sessionId`.

---

## Endpoints

### Health Check
Check if the API is running.

**GET** `/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-24T10:30:00.000Z",
  "environment": "development"
}
```

---

## Session Management

### Create/Update Session
Initialize or update a session with device information.

**POST** `/results/session`

**Request Body:**
```json
{
  "sessionId": "session_12345",
  "userAgent": "Mozilla/5.0...",
  "screenResolution": {
    "width": 1920,
    "height": 1080
  },
  "deviceType": "desktop"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "sessionId": "session_12345",
    "createdAt": "2024-11-24T10:30:00.000Z",
    ...
  }
}
```

---

## Interaction Logging (Bucket Pattern) 🆕

### Overview
The new bucket-based API provides efficient session-based interaction storage using MongoDB bucket pattern with enforced schema relationships.

### Schema Relationship
```
Session ──────< InteractionBucket
  sessionId ←──── sessionId (validated, indexed)
```

**Important:** 
- A session must be created first before logging interactions
- InteractionBuckets validate that the session exists
- Returns 404 error if session doesn't exist
- Deleting a session automatically deletes all its interaction buckets

### Log Single Interaction to Bucket
Record a single interaction (global or motor) to appropriate bucket.

**POST** `/interactions/log`

**Request Body:**
```json
{
  "sessionId": "session_12345",
  "interactionType": "global",
  "eventType": "click",
  "timestamp": "2024-11-24T10:30:00.000Z",
  "target": {
    "tag": "button",
    "id": "start-button",
    "class": "btn-primary",
    "text": "Start"
  },
  "position": { "x": 450, "y": 320 }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bucketNumber": 1,
    "count": 5
  }
}
```

### Log Batch Interactions to Bucket
Record multiple interactions in a single request.

**POST** `/interactions/batch`

**Request Body:**
```json
{
  "sessionId": "session_12345",
  "interactionType": "motor",
  "interactions": [
    {
      "eventType": "bubble_spawn",
      "timestamp": "2024-11-24T10:30:00.000Z",
      "bubbleId": "bubble_1",
      "column": 2,
      "round": 1
    },
    {
      "eventType": "bubble_hit",
      "timestamp": "2024-11-24T10:30:01.500Z",
      "bubbleId": "bubble_1",
      "reactionTime": 1500
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 2
  }
}
```

### Get Session Interactions
Retrieve all interactions for a session, optionally filtered by type.

**GET** `/interactions/session/:sessionId?type=global|motor`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_12345",
    "interactionType": "all",
    "count": 150,
    "interactions": [
      {
        "eventType": "click",
        "timestamp": "2024-11-24T10:30:00.000Z",
        ...
      }
    ]
  }
}
```

### Get Session Interaction Statistics
Get comprehensive statistics about session interactions.

**GET** `/interactions/session/:sessionId/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_12345",
    "global": {
      "bucketCount": 2,
      "interactionCount": 150,
      "buckets": [
        {
          "bucketNumber": 1,
          "count": 100,
          "isFull": true,
          "timeRange": {
            "first": "2024-11-24T10:30:00.000Z",
            "last": "2024-11-24T10:35:00.000Z"
          }
        }
      ]
    },
    "motor": {
      "bucketCount": 1,
      "interactionCount": 75,
      "buckets": [...]
    },
    "total": 225
  }
}
```

### Get Session Buckets
Get bucket metadata without interaction data (for performance).

**GET** `/interactions/session/:sessionId/buckets?type=global|motor`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_12345",
    "interactionType": "all",
    "bucketCount": 3,
    "buckets": [
      {
        "bucketNumber": 1,
        "count": 1000,
        "isFull": true,
        "firstInteractionAt": "2024-11-24T10:30:00.000Z",
        "lastInteractionAt": "2024-11-24T10:35:00.000Z"
      }
    ]
  }
}
```

### Delete Session Interactions (Testing Only)
Remove all interactions for a session.

**DELETE** `/interactions/session/:sessionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "deletedCount": 3
  }
}
```

---

## Legacy Interaction Logging

> **Note:** These endpoints are maintained for backwards compatibility.
> New implementations should use the bucket-based API above.

### Log Single Interaction
Record a single user interaction event.

**POST** `/logs/interaction`

**Request Body:**
```json
{
  "sessionId": "session_12345",
  "module": "colorBlindness",
  "eventType": "click",
  "timestamp": "2024-11-24T10:30:00.000Z",
  "coordinates": {
    "x": 450,
    "y": 320
  },
  "target": {
    "id": "answer-input",
    "type": "INPUT",
    "value": "12"
  },
  "metadata": {
    "plateId": 1
  },
  "responseTime": 2500
}
```

**Response:**
```json
{
  "success": true,
  "message": "Interaction logged",
  "batchSize": 5
}
```

### Log Interaction Batch
Record multiple interactions at once.

**POST** `/logs/batch`

**Request Body:**
```json
{
  "interactions": [
    {
      "sessionId": "session_12345",
      "module": "motorSkills",
      "eventType": "bubble_clicked",
      ...
    },
    ...
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "25 interactions logged"
}
```

### Get Session Interactions
Retrieve all interactions for a session.

**GET** `/logs/session/:sessionId`

**Query Parameters:**
- `module` (optional): Filter by module name
- `startTime` (optional): Filter by start timestamp
- `endTime` (optional): Filter by end timestamp

**Response:**
```json
{
  "success": true,
  "count": 150,
  "interactions": [...]
}
```

---

## Results Management

### Save Vision Test Results
Store results from color blindness and visual acuity tests.

**POST** `/results/vision`

**Request Body:**
```json
{
  "sessionId": "session_12345",
  "colorBlindness": {
    "plates": [
      {
        "plateId": 1,
        "imageName": "ishihara_1.jpg",
        "userAnswer": "12",
        "responseTime": 3000,
        "isCorrect": true
      }
    ],
    "colorVisionScore": 75,
    "diagnosis": "Normal",
    "totalResponseTime": 12000
  },
  "visualAcuity": {
    "attempts": [...],
    "finalResolvedSize": 40,
    "visualAngle": "0.5",
    "mar": "30",
    "snellenDenominator": 40,
    "snellenEstimate": "20/40"
  },
  "testConditions": {
    "screenSize": {
      "width": 1920,
      "height": 1080
    },
    "viewingDistance": 50
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vision results saved",
  "data": {...}
}
```

### Save Literacy Test Results
Store results from computer literacy quiz.

**POST** `/results/literacy`

**Request Body:**
```json
{
  "sessionId": "session_12345",
  "responses": [
    {
      "questionId": "q1",
      "question": "What does this symbol represent? 💾",
      "userAnswer": "Save",
      "correctAnswer": "Save",
      "isCorrect": true,
      "responseTime": 5000,
      "focusShifts": 2,
      "hoverEvents": [...]
    }
  ],
  "score": {
    "correctAnswers": 12,
    "totalQuestions": 15,
    "percentage": 80,
    "timeFactor": 5,
    "computerLiteracyScore": 17
  },
  "metrics": {
    "totalTime": 75000,
    "averageResponseTime": 5000,
    "totalFocusShifts": 30,
    "totalHoverEvents": 45
  },
  "categoryScores": [
    {
      "category": "icons",
      "correct": 4,
      "total": 4,
      "percentage": 100
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Literacy results saved",
  "data": {...}
}
```

### Get Session Results
Retrieve all results for a session.

**GET** `/results/session/:sessionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {...},
    "visionResult": {...},
    "literacyResult": {...}
  }
}
```

---

## Module Types

- `colorBlindness` - Color blindness test (Ishihara plates)
- `visualAcuity` - Visual acuity test (decreasing numbers)
- `motorSkills` - Bubble-pop motor skills game
- `literacy` - Computer literacy quiz

---

## Event Types

### Common Events
- `click` - Mouse click
- `hover` - Mouse hover
- `focus` - Element focus
- `blur` - Element blur
- `mousemove` - Mouse movement
- `input_change` - Input value change

### Module-Specific Events

#### Color Blindness
- `plate_shown` - Plate displayed
- `plate_submitted` - Answer submitted

#### Visual Acuity
- `number_shown` - Number displayed
- `attempt_submitted` - Answer submitted

#### Motor Skills
- `bubble_spawned` - Bubble created
- `bubble_clicked` - Bubble successfully clicked
- `bubble_missed` - Bubble escaped
- `bubble_hit` - Bubble popped
- `stage_clicked_miss` - Click missed all bubbles

#### Literacy
- `question_shown` - Question displayed
- `question_submitted` - Answer submitted

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

---

## Data Retention

- Interaction logs: 90 days
- Session data: 7 days
- Results: 1 year

All data is automatically expired using MongoDB TTL indexes.

