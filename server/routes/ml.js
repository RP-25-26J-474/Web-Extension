const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const OnboardingSession = require('../models/OnboardingSession');
const OnboardingMotorResult = require('../models/OnboardingMotorResult');
const ImpairmentProfile = require('../models/ImpairmentProfile');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000/score/motor';

function buildOnboardingMetrics({ motorResult, latentScore }) {
  const hitRate = motorResult?.overallMetrics?.overallHitRate ?? null;
  return {
    avg_reaction_ms: Number.isFinite(latentScore) ? latentScore : null,
    hit_rate: hitRate ?? null,
  };
}

function buildDeviceContext(session) {
  const device = session?.device || {};
  const screen = session?.screen || {};

  return {
    os: device.os || null,
    browser: device.browser || null,
    screen_w: screen.width ?? null,
    screen_h: screen.height ?? null,
    dpr: screen.dpr ?? null,
  };
}

// Proxy ML scoring to the internal Python service
router.post('/motor-score', authMiddleware, async (req, res) => {
  try {
    if (typeof fetch !== 'function') {
      return res.status(500).json({ error: 'Fetch not available in this Node.js version' });
    }

    const [session, motorResult] = await Promise.all([
      OnboardingSession.findOne({ userId: req.userId }),
      OnboardingMotorResult.findOne({ userId: req.userId }),
    ]);

    const payload = { ...(req.body || {}) };
    if (!payload.userId) {
      payload.userId = req.userId;
    }
    if (!payload.sessionId && session?._id) {
      payload.sessionId = String(session._id);
    }

    const response = await fetch(ML_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || 'ML service error' });
    }

    const result = await response.json();
    console.log('ML proxy response:', result);

    const motorProfile = result?.motor_profile || {};
    const motorImpairment = {
      delayed_reaction: motorProfile.latent_score ?? null,
      inaccurate_click: null,
      motor_impairment: motorProfile.impairment_score ?? null,
    };

    const profileUpdate = {
      user_id: String(req.userId),
      session_id: result.sessionId || payload.sessionId || (session?._id ? String(session._id) : ''),
      captured_at: new Date(),
      onboarding_metrics: buildOnboardingMetrics({
        motorResult,
        latentScore: motorProfile.latent_score,
      }),
      device_context: buildDeviceContext(session),
    };

    await ImpairmentProfile.findOneAndUpdate(
      { user_id: String(req.userId) },
      {
        $set: {
          ...profileUpdate,
          'impairment_probs.motor': motorImpairment,
        },
        $setOnInsert: { impairment_probs: {} },
      },
      { upsert: true, new: true }
    );

    return res.json(result);
  } catch (error) {
    console.error('ML proxy error:', error);
    return res.status(500).json({ error: 'Failed to reach ML service' });
  }
});

module.exports = router;
