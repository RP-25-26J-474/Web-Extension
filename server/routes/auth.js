const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const Stats = require('../models/Stats');
const authMiddleware = require('../middleware/auth');
const emailService = require('../services/emailService');
const EMAIL_NORMALIZATION_OPTIONS = { gmail_remove_dots: false };
const REQUIRE_EMAIL_VERIFICATION = String(process.env.REQUIRE_EMAIL_VERIFICATION ?? 'false').toLowerCase() === 'true';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Register new user (requires email verification before login/onboarding)
router.post('/register', [
  body('email').isEmail().normalizeEmail(EMAIL_NORMALIZATION_OPTIONS),
  body('password').isLength({ min: 6 }),
  body('name').trim().notEmpty(),
  body('age').isInt({ min: 18, max: 120 }),
  body('gender').isIn(['male', 'female', 'other', 'prefer-not-to-say'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, age, gender } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    if (!REQUIRE_EMAIL_VERIFICATION) {
      const user = new User({
        email,
        password,
        name,
        age,
        gender,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        verificationCompleteCode: null,
        verificationCompleteCodeExpires: null
      });

      await user.save();

      const stats = new Stats({ userId: user._id });
      await stats.save();

      const token = generateToken(user._id);
      return res.status(201).json({
        message: 'User registered successfully',
        user: user.toJSON(),
        token
      });
    }

    const token = emailService.generateVerificationToken();
    const expires = emailService.getVerificationExpiry();

    const user = new User({
      email,
      password,
      name,
      age,
      gender,
      emailVerified: false,
      emailVerificationToken: token,
      emailVerificationExpires: expires
    });

    await user.save();

    const stats = new Stats({ userId: user._id });
    await stats.save();

    const verificationUrl = emailService.buildVerificationUrl(token);
    await emailService.sendVerificationEmail(email, verificationUrl);

    res.status(201).json({
      message: 'Please verify your email before continuing. Check your inbox for the verification link.',
      requiresVerification: true,
      email
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Verify email via link (GET for email clients)
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send(renderVerificationPage(req, false, 'Missing verification token'));
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).send(renderVerificationPage(req, false, 'Invalid or expired verification link'));
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    // Generate 6-digit code so extension can complete registration without login
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    user.verificationCompleteCode = code;
    user.verificationCompleteCodeExpires = codeExpires;
    await user.save();

    res.send(renderVerificationPage(req, true, code));
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).send(renderVerificationPage(req, false, 'Verification failed'));
  }
});

function renderVerificationPage(req, success, codeOrError) {
  const baseUrl = emailService.getBaseUrl();
  const logoUrl = `${baseUrl}/logo.png`;
  const title = success ? 'Email Verified!' : 'Verification Failed';
  const isSuccess = success;
  let bodyContent = '';
  if (success && codeOrError) {
    bodyContent = `
    <p class="verify-instruction">Return to the AURA extension and enter this code to continue:</p>
    <p class="verify-code">${codeOrError}</p>
    <p class="verify-expiry">Code expires in 10 minutes. You can close this tab after entering it.</p>`;
  } else if (success) {
    bodyContent = '<p class="verify-instruction">Return to the AURA extension and click Continue.</p>';
  } else {
    bodyContent = `<p class="verify-error">${codeOrError || 'Something went wrong.'}</p>`;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} – AURA</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 50%,#f8fafc 100%);padding:24px}
    .card{max-width:420px;width:100%;background:#fff;border-radius:16px;padding:40px 32px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.08);border:1px solid rgba(139,197,63,0.2)}
    .logo{margin-bottom:24px;height:56px;width:auto}
    h1{font-size:1.5rem;font-weight:700;margin-bottom:16px;color:${isSuccess ? '#16a34a' : '#dc2626'}}
    .verify-instruction{color:#475569;line-height:1.6;margin-bottom:20px;font-size:1rem}
    .verify-code{font-size:2rem;font-weight:700;letter-spacing:0.4em;color:#16a34a;margin:20px 0;font-variant-numeric:tabular-nums}
    .verify-expiry{font-size:0.875rem;color:#64748b;margin-top:8px}
    .verify-error{color:#dc2626;line-height:1.6}
  </style>
</head>
<body>
  <div class="card">
    <img src="${logoUrl}" alt="AURA" class="logo" onerror="this.style.display='none'">
    <h1>${title}</h1>
    ${bodyContent}
  </div>
</body>
</html>`;
}

// Login (requires verified email for email/password users)
router.post('/login', [
  body('email').isEmail().normalizeEmail(EMAIL_NORMALIZATION_OPTIONS),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Require verification for users who went through email registration (have token/expiry set)
    // Legacy users (no verification token) are treated as pre-verified
    const isLegacyUser = !user.emailVerificationToken && !user.emailVerificationExpires;
    if (REQUIRE_EMAIL_VERIFICATION && !user.emailVerified && !isLegacyUser) {
      return res.status(403).json({
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Complete verification with code (no login – continues registration flow)
router.post('/complete-verification', [
  body('email').isEmail().normalizeEmail(EMAIL_NORMALIZATION_OPTIONS),
  body('code').isLength({ min: 6, max: 6 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or code' });
    }

    if (!user.emailVerified) {
      return res.status(400).json({ error: 'Email not verified yet. Click the link in your email first.' });
    }

    if (user.verificationCompleteCode !== code || !user.verificationCompleteCodeExpires || user.verificationCompleteCodeExpires < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired code. Request a new verification email.' });
    }

    user.verificationCompleteCode = null;
    user.verificationCompleteCodeExpires = null;
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      message: 'Verification complete. Welcome!',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    console.error('Complete verification error:', error);
    res.status(500).json({ error: 'Failed to complete verification' });
  }
});

// Resend verification email
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail(EMAIL_NORMALIZATION_OPTIONS)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'No account found with this email' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified. You can log in.' });
    }

    const token = emailService.generateVerificationToken();
    const expires = emailService.getVerificationExpiry();

    user.emailVerificationToken = token;
    user.emailVerificationExpires = expires;
    await user.save();

    const verificationUrl = emailService.buildVerificationUrl(token);
    await emailService.sendVerificationEmail(email, verificationUrl);

    res.json({
      message: 'Verification email sent. Check your inbox.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({ user: req.user.toJSON() });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (name) req.user.name = name;
    
    await req.user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: req.user.toJSON()
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update consent and tracking settings
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { consentGiven, trackingEnabled } = req.body;
    
    if (consentGiven !== undefined) req.user.consentGiven = consentGiven;
    if (trackingEnabled !== undefined) req.user.trackingEnabled = trackingEnabled;
    
    await req.user.save();
    
    res.json({
      message: 'Settings updated successfully',
      user: req.user.toJSON()
    });
    
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Validate userId exists (used by Optimization Engine to verify users without exposing personal data)
router.get('/validate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ valid: false, error: 'userId is required' });
    }
    const user = await User.findById(userId).select('_id');
    res.json({ valid: !!user });
  } catch (error) {
    // Invalid ObjectId format or DB error
    res.json({ valid: false });
  }
});

// Logout (client-side token removal, but we log it)
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;

