# ✅ Age & Gender Flow - Complete Implementation

## 📊 Data Flow

### 1. Registration (Extension Popup)
```
User fills registration form:
  - Name
  - Email  
  - Password
  - Age ✅
  - Gender ✅

↓

POST /api/auth/register
{
  email, password, name, age, gender
}

↓

User document created in MongoDB:
{
  _id: ObjectId("..."),
  name: "John Doe",
  email: "user@example.com",
  age: 25,
  gender: "male",
  ...
}
```

### 2. Onboarding Game Start
```
Extension opens game with:
http://localhost:5173/?userId=USER_ID&token=TOKEN&mode=aura

↓

Game calls: POST /api/onboarding/start
{
  device: { userAgent, platform, ... },
  screen: { width, height, ... },
  game: { gameVersion, ... },
  perf: { samplingHzTarget, ... }
}

↓

OnboardingSession created:
{
  userId: ObjectId("..."),  // Links to User
  device: {...},
  screen: {...},
  game: {...},
  perf: {...}
  // NO age/gender here - it's in User model!
}
```

### 3. Accessing Age & Gender for Analysis

When you need age/gender for analysis, just populate the User:

```javascript
// Option 1: During onboarding session lookup
const session = await OnboardingSession
  .findOne({ userId })
  .populate('userId', 'name email age gender');

console.log(session.userId.age);     // 25
console.log(session.userId.gender);  // "male"

// Option 2: During results analysis
const motorResult = await OnboardingMotorResult
  .findOne({ userId })
  .populate('userId', 'name email age gender');

console.log(motorResult.userId.age);     // 25
console.log(motorResult.userId.gender);  // "male"

// Option 3: Get user directly
const user = await User.findById(userId);
console.log(user.age);     // 25
console.log(user.gender);  // "male"
```

---

## ✅ What Changed

### Before (Without Age/Gender in User Model)
- ❌ Age/gender might be collected during onboarding
- ❌ Stored in OnboardingSession or separate fields
- ❌ Redundant data collection

### After (With Age/Gender in User Model)
- ✅ Age/gender collected ONCE during registration
- ✅ Stored in User document
- ✅ Accessible via population when needed
- ✅ No redundant collection during onboarding

---

## 📝 Best Practices for Using Age/Gender

### 1. **Demographic Analysis**
```javascript
// Example: Analyze motor skills by age group
const results = await OnboardingMotorResult.find()
  .populate('userId', 'age gender');

const byAgeGroup = results.reduce((acc, result) => {
  const ageGroup = result.userId.age < 30 ? 'young' : 
                   result.userId.age < 50 ? 'middle' : 'senior';
  if (!acc[ageGroup]) acc[ageGroup] = [];
  acc[ageGroup].push(result.overallScore);
  return acc;
}, {});

console.log('Average scores by age:', {
  young: average(byAgeGroup.young),
  middle: average(byAgeGroup.middle),
  senior: average(byAgeGroup.senior),
});
```

### 2. **Gender-Based Comparison**
```javascript
// Example: Compare literacy scores by gender
const literacyResults = await OnboardingLiteracyResult.find()
  .populate('userId', 'gender');

const byGender = literacyResults.reduce((acc, result) => {
  const gender = result.userId.gender;
  if (!acc[gender]) acc[gender] = [];
  acc[gender].push(result.score.computerLiteracyScore);
  return acc;
}, {});

console.log('Literacy scores by gender:', byGender);
```

### 3. **Combined Demographic Filtering**
```javascript
// Example: Find users in specific demographic
const youngMales = await User.find({
  age: { $gte: 18, $lte: 30 },
  gender: 'male'
});

const theirResults = await OnboardingMotorResult.find({
  userId: { $in: youngMales.map(u => u._id) }
});
```

---

## 🗄️ Database Schema

### User Collection
```javascript
{
  _id: ObjectId("userId123"),
  name: "John Doe",
  email: "john@example.com",
  password: "$2a$10$...",
  age: 25,              // ✅ Stored here
  gender: "male",       // ✅ Stored here
  consentGiven: true,
  trackingEnabled: true,
  createdAt: ISODate("2026-01-02T..."),
  lastLogin: ISODate("2026-01-02T...")
}
```

### OnboardingSession Collection
```javascript
{
  _id: ObjectId("sessionId123"),
  userId: ObjectId("userId123"),  // ← Links to User
  status: "completed",
  device: {
    pointerPrimary: "mouse",
    os: "Windows 10",
    browser: "Chrome"
  },
  screen: { width: 1920, height: 1080, dpr: 1 },
  game: { gameVersion: "1.0.0", ... },
  perf: { samplingHzTarget: 60, ... },
  completedModules: [
    { moduleName: "perception", completedAt: ISODate("...") },
    { moduleName: "reaction", completedAt: ISODate("...") },
    { moduleName: "knowledge", completedAt: ISODate("...") }
  ],
  overallScore: {
    motorScore: 85,
    literacyScore: 90,
    visionScore: 95,
    totalScore: 90
  }
  // ❌ NO age/gender here - use populate('userId')
}
```

---

## 🎯 Query Examples

### Get full user profile with onboarding
```javascript
const user = await User.findById(userId);
const onboarding = await OnboardingSession.findOne({ userId });

console.log({
  name: user.name,
  age: user.age,
  gender: user.gender,
  onboardingComplete: onboarding.status === 'completed',
  motorScore: onboarding.overallScore.motorScore
});
```

### Get all results with demographics
```javascript
const results = await OnboardingMotorResult
  .find()
  .populate('userId', 'name age gender email');

results.forEach(result => {
  console.log(`${result.userId.name} (${result.userId.age}, ${result.userId.gender}): ${result.overallScore}`);
});
```

### Aggregate by demographics
```javascript
const stats = await User.aggregate([
  {
    $lookup: {
      from: 'onboardingsessions',
      localField: '_id',
      foreignField: 'userId',
      as: 'onboarding'
    }
  },
  {
    $match: {
      'onboarding.status': 'completed'
    }
  },
  {
    $group: {
      _id: { age: '$age', gender: '$gender' },
      count: { $sum: 1 },
      avgMotorScore: { $avg: '$onboarding.overallScore.motorScore' }
    }
  }
]);
```

---

## ✅ Benefits of This Approach

1. **No Redundancy**: Age/gender stored once in User model
2. **Single Source of Truth**: User profile is the authority
3. **Easy Analysis**: Use MongoDB population or aggregation
4. **Privacy-Friendly**: Demographic data in one secure location
5. **Flexible**: Can update user demographics without touching onboarding data

---

## 🔒 Privacy Notes

- Age stored as number (not birthdate) for privacy
- Gender options include "prefer-not-to-say"
- Demographic data only accessible via authenticated API calls
- Can be anonymized for ML training by removing User reference

---

**Implementation Date:** January 2, 2026  
**Status:** ✅ Complete  
**Location:** User model contains age/gender, OnboardingSession links via userId

