# Development Guide

## Getting Started

### Prerequisites
- Node.js >= 18.x
- MongoDB >= 5.x
- npm or yarn
- Git

### Initial Setup

1. **Clone and Install**
```bash
git clone <repository-url>
cd sensecheck
npm run install-all
```

2. **Environment Configuration**

Create `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sensecheck
NODE_ENV=development
```

Create `client/.env` (optional):
```env
VITE_API_URL=http://localhost:5000/api
```

3. **Start MongoDB**
```bash
# Local MongoDB
mongod

# Or use MongoDB Atlas (cloud)
# Update MONGODB_URI in server/.env
```

4. **Run Development Servers**
```bash
# From root directory - runs both frontend and backend
npm run dev

# Or run separately:
# Terminal 1:
cd server && node server.js

# Terminal 2:
cd client && npm run dev
```

---

## Project Structure Explained

### Client Structure
```
client/src/
├── components/          # Reusable UI components
│   ├── Layout.jsx       # Page wrapper with header/footer
│   ├── ProgressBar.jsx  # Progress indicator
│   └── LoadingSpinner.jsx
├── modules/             # Game modules
│   ├── Visual/
│   │   ├── ColorBlindnessTest.jsx
│   │   └── VisualAcuityTest.jsx
│   ├── Motor/
│   │   └── MotorSkillsGame.jsx
│   └── Literacy/
│       └── LiteracyQuiz.jsx
├── pages/               # Route pages
│   ├── Home.jsx
│   └── Results.jsx
├── hooks/               # Custom React hooks
│   ├── useInteractionTracking.js
│   └── useDeviceInfo.js
├── state/               # State management
│   └── store.js         # Zustand store
├── utils/               # Utilities
│   ├── api.js
│   ├── colorBlindnessAnalysis.js
│   ├── visualAcuityCalculations.js
│   └── literacyQuestions.js
└── resources/           # Images and assets
```

### Server Structure
```
server/
├── server.js            # Entry point
├── routes/              # API routes
├── controllers/         # Business logic
├── models/              # Database schemas
├── services/            # External services
│   └── logging/
├── middleware/          # Express middleware
└── logs/                # Winston log files (generated)
```

---

## Development Workflow

### Adding a New Feature

1. **Frontend Component**
```jsx
// client/src/components/NewComponent.jsx
import { useState } from 'react';

const NewComponent = () => {
  return <div>New Component</div>;
};

export default NewComponent;
```

2. **Add to Routes** (if needed)
```jsx
// client/src/App.jsx
import NewComponent from './components/NewComponent';

<Route path="/new" element={<NewComponent />} />
```

3. **Backend Endpoint** (if needed)
```javascript
// server/routes/new.js
import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'New endpoint' });
});

export default router;
```

4. **Add Route to Server**
```javascript
// server/server.js
import newRoutes from './routes/new.js';
app.use('/api/new', newRoutes);
```

---

## Coding Standards

### Frontend (React)

**Component Structure:**
```jsx
import { useState, useEffect } from 'react';
import useStore from '../state/store';

const ComponentName = ({ prop1, prop2 }) => {
  // Hooks first
  const [state, setState] = useState(initial);
  const storeValue = useStore((state) => state.value);

  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);

  // Event handlers
  const handleClick = () => {
    // Handler logic
  };

  // Render
  return (
    <div className="component-class">
      {/* JSX */}
    </div>
  );
};

export default ComponentName;
```

**Naming Conventions:**
- Components: PascalCase (`MyComponent.jsx`)
- Hooks: camelCase with 'use' prefix (`useMyHook.js`)
- Utilities: camelCase (`myUtility.js`)
- Constants: UPPER_SNAKE_CASE

**Styling:**
- Use TailwindCSS utility classes
- Create reusable classes in `index.css` with `@layer components`
- Avoid inline styles unless dynamic

### Backend (Node.js)

**File Naming:**
- Models: PascalCase (`Session.js`)
- Routes: camelCase (`logs.js`)
- Controllers: camelCase (`logController.js`)

**Error Handling:**
```javascript
try {
  // Logic
} catch (error) {
  logger.error('Error description:', error);
  res.status(500).json({ 
    success: false, 
    error: 'User-friendly message' 
  });
}
```

**Async/Await:**
```javascript
export const myFunction = async (req, res) => {
  try {
    const result = await someAsyncOperation();
    res.json({ success: true, data: result });
  } catch (error) {
    // Handle error
  }
};
```

---

## Testing

### Manual Testing Checklist

**Color Blindness Test:**
- [ ] All 4 plates display correctly
- [ ] Input accepts numbers and "nothing"
- [ ] Progress bar updates
- [ ] Results calculated correctly
- [ ] Data saved to backend

**Visual Acuity Test:**
- [ ] Numbers decrease in size
- [ ] Retry mechanism works
- [ ] Test ends at correct size
- [ ] Snellen calculation accurate
- [ ] Data saved to backend

**Motor Skills Game:**
- [ ] Bubbles spawn in correct columns
- [ ] Animation smooth at all speeds
- [ ] Click detection accurate
- [ ] All 3 rounds complete
- [ ] Interactions logged

**Literacy Quiz:**
- [ ] All questions display
- [ ] Options selectable
- [ ] Hover tracking works
- [ ] Score calculated correctly
- [ ] Category breakdown accurate

### API Testing with cURL

```bash
# Health check
curl http://localhost:5000/api/health

# Create session
curl -X POST http://localhost:5000/api/results/session \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test_123","deviceType":"desktop"}'

# Log interaction
curl -X POST http://localhost:5000/api/logs/interaction \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test_123","module":"colorBlindness","eventType":"click"}'

# Get results
curl http://localhost:5000/api/results/session/test_123
```

---

## Debugging

### Frontend Debugging

**React DevTools:**
- Install React DevTools browser extension
- Inspect component state and props
- Track re-renders

**Zustand DevTools:**
```javascript
// Add to store.js for debugging
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools((set, get) => ({
    // Store definition
  }))
);
```

**Console Logging:**
```javascript
console.log('Debug:', variable);
console.table(array);
console.group('Group Name');
console.groupEnd();
```

### Backend Debugging

**Winston Logs:**
```bash
# Watch logs in real-time
tail -f server/logs/application-*.log
tail -f server/logs/interactions-*.log
tail -f server/logs/error-*.log
```

**MongoDB Queries:**
```bash
# Connect to MongoDB
mongosh sensecheck

# View collections
show collections

# Query sessions
db.sessions.find().pretty()

# Count interactions
db.interactionlogs.countDocuments()

# Find by sessionId
db.visionresults.findOne({sessionId: "session_123"})
```

---

## Common Issues

### MongoDB Connection Fails
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Ensure MongoDB is running
```bash
mongod
# or
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution:** Kill process or use different port
```bash
# Find process
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change PORT in .env
```

### CORS Errors
```
Access to fetch at 'http://localhost:5000' has been blocked by CORS policy
```
**Solution:** Ensure backend CORS is configured
```javascript
// server/server.js
app.use(cors());
```

---

## Build and Deploy

### Frontend Build
```bash
cd client
npm run build
# Output in client/dist/
```

### Backend Production
```bash
cd server
NODE_ENV=production node server.js
```

### Environment Variables for Production
```env
# server/.env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/sensecheck
NODE_ENV=production
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/new-feature

# Create pull request on GitHub
```

**Commit Message Convention:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

---

## Performance Monitoring

### Frontend Performance
- Use React DevTools Profiler
- Monitor component render times
- Check for unnecessary re-renders

### Backend Performance
- Monitor Winston logs for slow queries
- Check MongoDB query performance
- Use `console.time()` for timing

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Update documentation
6. Submit a pull request

For major changes, please open an issue first to discuss what you would like to change.

