# Age & Gender Fields Added to User Registration

## ✅ Changes Made

### 1. Backend - User Model (`server/models/User.js`)
**Added fields:**
```javascript
age: {
  type: Number,
  required: true,
  min: 1,
  max: 120
},
gender: {
  type: String,
  required: true,
  enum: ['male', 'female', 'other', 'prefer-not-to-say'],
  lowercase: true
}
```

### 2. Backend - Auth Routes (`server/routes/auth.js`)
**Updated registration endpoint:**
- Added validation for `age` and `gender` fields
- Age must be between 1-120
- Gender must be one of: 'male', 'female', 'other', 'prefer-not-to-say'

**Example registration request:**
```javascript
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "age": 25,
  "gender": "male"
}
```

### 3. Frontend - Extension Popup HTML (`extension/popup.html`)
**Added form fields:**
```html
<div class="form-row">
  <div class="form-group">
    <label for="registerAge">Age</label>
    <input type="number" id="registerAge" placeholder="25" min="1" max="120" required>
  </div>
  
  <div class="form-group">
    <label for="registerGender">Gender</label>
    <select id="registerGender" required>
      <option value="">Select</option>
      <option value="male">Male</option>
      <option value="female">Female</option>
      <option value="other">Other</option>
      <option value="prefer-not-to-say">Prefer not to say</option>
    </select>
  </div>
</div>
```

### 4. Frontend - Extension CSS (`extension/popup.css`)
**Added styles:**
- `.form-row` - Flexbox layout for side-by-side fields
- Updated `.form-group` to support both `input` and `select` elements
- Consistent styling with green theme (#1FB854)

### 5. Frontend - Popup JavaScript (`extension/popup.js`)
**Updated `handleRegister()` function:**
- Captures age and gender from form
- Validates age is between 1-120
- Passes age and gender to API client

### 6. Frontend - API Client (`extension/api-client.js`)
**Updated `register()` method:**
```javascript
async register(email, password, name, age, gender) {
  const data = await this.request(API_CONFIG.ENDPOINTS.REGISTER, {
    method: 'POST',
    body: JSON.stringify({ email, password, name, age, gender })
  });
  // ...
}
```

---

## 🎯 Benefits for Onboarding Game

Now that age and gender are collected during registration:

1. **Demographic Analysis**: Assessment results can be analyzed by age group and gender
2. **Personalization**: Game difficulty or content can be adjusted based on age
3. **Research Value**: More comprehensive user profiling for ML models
4. **Statistical Insights**: Compare performance across demographics

---

## 📊 Database Structure

**User Document Example:**
```javascript
{
  _id: ObjectId("..."),
  email: "user@example.com",
  password: "$2a$10$...", // hashed
  name: "John Doe",
  age: 25,
  gender: "male",
  consentGiven: false,
  trackingEnabled: false,
  createdAt: ISODate("2026-01-02T..."),
  lastLogin: null
}
```

---

## 🔒 Privacy Considerations

- ✅ Age stored as number (not birthdate for privacy)
- ✅ Gender options include "Prefer not to say"
- ✅ Data only used for assessment analytics
- ✅ No PII beyond what's necessary

---

## ✅ Testing Checklist

- [ ] Backend validates age range (1-120)
- [ ] Backend validates gender enum values
- [ ] Frontend displays age and gender fields
- [ ] Frontend validates form inputs
- [ ] Registration succeeds with age & gender
- [ ] User object includes age & gender
- [ ] Onboarding game can access user demographics

---

## 📝 Migration Notes

**For existing users in database:**

If you have existing users without age/gender, you'll need to handle them:

**Option 1: Make fields optional temporarily**
```javascript
age: { type: Number, min: 1, max: 120 },
gender: { type: String, enum: [...] }
```

**Option 2: Set default values**
```javascript
age: { type: Number, default: null, min: 1, max: 120 },
gender: { type: String, default: 'prefer-not-to-say', enum: [...] }
```

**Option 3: Prompt existing users to update profile**
- Add a profile update UI
- Require age/gender before onboarding

---

**Implementation Date:** January 2, 2026  
**Status:** ✅ Complete  
**Files Modified:** 6 files (3 backend, 3 frontend)

