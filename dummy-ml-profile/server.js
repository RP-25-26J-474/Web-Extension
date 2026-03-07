/**
 * Dummy ML Profile API – for testing AURA extension integration
 *
 * Implements two endpoints:
 * 1. GET /api/profile – daily fetch (ML_PROFILE_API_URL)
 * 2. POST /api/profile-from-impairment – initial profile on registration (IMPAIRMENT_TO_ML_PROFILE_API_URL)
 *
 * Run: npm start
 * Default port: 4000
 * Configure extension/config.module.js to use:
 *   ML_PROFILE_API_URL: 'http://localhost:4000/api/profile'
 *   IMPAIRMENT_TO_ML_PROFILE_API_URL: 'http://localhost:4000/api/profile-from-impairment'
 * Add http://localhost:4000/* to extension/manifest.json host_permissions
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Simple Bearer extraction – any token is accepted for testing
function getToken(req) {
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

// Mock personalized profile (daily fetch response)
const MOCK_PERSONALIZED = {
  user_id: 'u_mock',
  metadata: {
    origin: 'user',
    created_at: new Date().toISOString(),
    confidence_overall: 0.7631,
    version: 6,
  },
  profile: {
    font_size: 17,
    line_height: 1.695901820011972,
    contrast_mode: 'normal',
    primary_color: '#1a73e8',
    primary_color_content: '#ffffff',
    secondary_color: '#1a73e8',
    secondary_color_content: '#ffffff',
    accent_color: '#e37400',
    accent_color_content: '#ffffff',
    theme: 'light',
    element_spacing_x: 7,
    element_spacing_y: 4,
    element_padding_x: 8,
    element_padding_y: 8,
    reduced_motion: true,
    target_size: 32,
    tooltip_assist: true,
    layout_simplification: true,
  },
  profile_changes: {
    changed: ['font_size', 'line_height', 'target_size'],
    new: { font_size: 17, line_height: 1.695901820011972, target_size: 32 },
    old: { font_size: 11, line_height: 1.6, target_size: 28 },
  },
};

// Mock profile from impairment (simplified shape for AURA_EXT_SET_ADAPTIVE_PROFILE)
const MOCK_PROFILE_FROM_IMPAIRMENT = {
  theme: 'light',
  font_size: 18,
  line_height: 1.7,
  contrast_mode: 'high',
  element_spacing: 'wide',
  target_size: 48,
  reduced_motion: false,
  tooltip_assist: true,
  layout_simplification: false,
};

// 1. GET /api/profile – daily personalized profile fetch
app.get('/api/profile', (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization: Bearer token' });
  }
  console.log('[GET /api/profile] Returning mock personalized profile');
  res.json(MOCK_PERSONALIZED);
});

// 2. POST /api/profile-from-impairment – initial profile when onboarding completes
app.post('/api/profile-from-impairment', (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization: Bearer token' });
  }
  const impairment = req.body;
  console.log('[POST /api/profile-from-impairment] Received impairment profile:', JSON.stringify(impairment).slice(0, 200) + '...');
  res.json({ profile: MOCK_PROFILE_FROM_IMPAIRMENT });
});

app.listen(PORT, () => {
  console.log(`\n🧪 Dummy ML Profile API running at http://localhost:${PORT}`);
  console.log('  GET  /api/profile              – daily personalized profile');
  console.log('  POST /api/profile-from-impairment – initial profile from impairment\n');
});
