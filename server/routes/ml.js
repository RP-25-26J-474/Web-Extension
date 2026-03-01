const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const OnboardingSession = require('../models/OnboardingSession');
const OnboardingMotorResult = require('../models/OnboardingMotorResult');
const ImpairmentProfile = require('../models/ImpairmentProfile');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000/score/motor';

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function mean(values) {
  const finiteValues = values
    .map(toFiniteNumber)
    .filter(v => v != null);

  if (finiteValues.length === 0) {
    return null;
  }

  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function parseOS(userAgent) {
  if (!userAgent) return null;

  const ua = String(userAgent).toLowerCase();

  if (ua.includes('windows nt 10')) return 'Windows 10/11';
  if (ua.includes('windows nt 6.3')) return 'Windows 8.1';
  if (ua.includes('windows nt 6.2')) return 'Windows 8';
  if (ua.includes('windows nt 6.1')) return 'Windows 7';
  if (ua.includes('windows')) return 'Windows';

  if (ua.includes('mac os x')) {
    const match = ua.match(/mac os x (\d+[._]\d+)/);
    if (match) return `macOS ${match[1].replace('_', '.')}`;
    return 'macOS';
  }

  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  if (ua.includes('android')) {
    const match = ua.match(/android (\d+(\.\d+)?)/);
    if (match) return `Android ${match[1]}`;
    return 'Android';
  }

  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('cros')) return 'ChromeOS';

  return null;
}

function parseBrowser(userAgent) {
  if (!userAgent) return null;

  const ua = String(userAgent).toLowerCase();

  if (ua.includes('edg/')) {
    const match = String(userAgent).match(/Edg\/(\d+)/);
    return match ? `Edge ${match[1]}` : 'Edge';
  }

  if (ua.includes('opr/') || ua.includes('opera')) {
    const match = String(userAgent).match(/OPR\/(\d+)/i);
    return match ? `Opera ${match[1]}` : 'Opera';
  }

  if (ua.includes('chrome') && !ua.includes('chromium')) {
    const match = String(userAgent).match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }

  if (ua.includes('safari') && !ua.includes('chrome')) {
    const match = String(userAgent).match(/Version\/(\d+)/);
    return match ? `Safari ${match[1]}` : 'Safari';
  }

  if (ua.includes('firefox')) {
    const match = String(userAgent).match(/Firefox\/(\d+)/i);
    return match ? `Firefox ${match[1]}` : 'Firefox';
  }

  if (ua.includes('msie') || ua.includes('trident')) return 'Internet Explorer';

  return null;
}

function getFirstFinite(...values) {
  for (const value of values) {
    const finite = toFiniteNumber(value);
    if (finite != null) {
      return finite;
    }
  }
  return null;
}

function deriveMotorSummaryFromResult(motorResult) {
  const overallMetrics = motorResult?.overallMetrics || {};

  const totalTargets = toFiniteNumber(overallMetrics.totalTargets);
  const totalHits = toFiniteNumber(overallMetrics.totalHits);
  if (totalTargets != null && totalTargets > 0 && totalHits != null) {
    return {
      hitRate: totalHits / totalTargets,
      avgReactionMs: toFiniteNumber(overallMetrics.avgReactionTime),
    };
  }

  const overallHitRate = toFiniteNumber(overallMetrics.overallHitRate);
  if (overallHitRate != null) {
    return {
      hitRate: overallHitRate,
      avgReactionMs: toFiniteNumber(overallMetrics.avgReactionTime),
    };
  }

  const roundSummaries = Array.isArray(motorResult?.roundSummaries) ? motorResult.roundSummaries : [];
  const roundTargets = roundSummaries.reduce((sum, round) => {
    const nTargets = toFiniteNumber(round?.nTargets);
    return nTargets != null ? sum + nTargets : sum;
  }, 0);
  const roundHits = roundSummaries.reduce((sum, round) => {
    const nHits = toFiniteNumber(round?.nHits);
    return nHits != null ? sum + nHits : sum;
  }, 0);
  const weightedReactionSum = roundSummaries.reduce((sum, round) => {
    const nTargets = toFiniteNumber(round?.nTargets);
    const avgReaction = toFiniteNumber(round?.avgReactionTime);
    if (nTargets == null || nTargets <= 0 || avgReaction == null) {
      return sum;
    }
    return sum + (avgReaction * nTargets);
  }, 0);
  const weightedReactionCount = roundSummaries.reduce((sum, round) => {
    const nTargets = toFiniteNumber(round?.nTargets);
    const avgReaction = toFiniteNumber(round?.avgReactionTime);
    if (nTargets == null || nTargets <= 0 || avgReaction == null) {
      return sum;
    }
    return sum + nTargets;
  }, 0);

  if (roundTargets > 0) {
    return {
      hitRate: roundHits / roundTargets,
      avgReactionMs: weightedReactionCount > 0 ? weightedReactionSum / weightedReactionCount : null,
    };
  }

  const attempts = Array.isArray(motorResult?.attempts) ? motorResult.attempts : [];
  if (attempts.length > 0) {
    const hits = attempts.filter(attempt => attempt?.click?.hit === true).length;
    const reactionTimes = attempts
      .map(attempt => toFiniteNumber(attempt?.timing?.reactionTimeMs))
      .filter(v => v != null);

    return {
      hitRate: hits / attempts.length,
      avgReactionMs: reactionTimes.length > 0 ? mean(reactionTimes) : null,
    };
  }

  return {
    hitRate: null,
    avgReactionMs: null,
  };
}

function deriveMotorSummaryFromPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      hitRate: null,
      avgReactionMs: null,
    };
  }

  const directTargets = toFiniteNumber(payload.nTargets);
  const directHits = toFiniteNumber(payload.nHits);
  if (directTargets != null && directTargets > 0 && directHits != null) {
    return {
      hitRate: directHits / directTargets,
      avgReactionMs: getFirstFinite(payload.avgReactionTime, payload.avg_reaction_ms, payload.reactionTime_mean),
    };
  }

  const roundTargets = [payload.r1_nTargets, payload.r2_nTargets, payload.r3_nTargets]
    .map(toFiniteNumber)
    .filter(v => v != null);
  const roundHits = [payload.r1_nHits, payload.r2_nHits, payload.r3_nHits]
    .map(toFiniteNumber)
    .filter(v => v != null);

  const totalTargets = roundTargets.reduce((sum, value) => sum + value, 0);
  const totalHits = roundHits.reduce((sum, value) => sum + value, 0);

  const roundReactionMeans = [
    { nTargets: toFiniteNumber(payload.r1_nTargets), mean: toFiniteNumber(payload.r1_reactionTime_mean) },
    { nTargets: toFiniteNumber(payload.r2_nTargets), mean: toFiniteNumber(payload.r2_reactionTime_mean) },
    { nTargets: toFiniteNumber(payload.r3_nTargets), mean: toFiniteNumber(payload.r3_reactionTime_mean) },
  ];

  const weightedReaction = roundReactionMeans.reduce((sum, round) => {
    if (round.nTargets == null || round.nTargets <= 0 || round.mean == null) {
      return sum;
    }
    return sum + (round.mean * round.nTargets);
  }, 0);
  const weightedCount = roundReactionMeans.reduce((sum, round) => {
    if (round.nTargets == null || round.nTargets <= 0 || round.mean == null) {
      return sum;
    }
    return sum + round.nTargets;
  }, 0);

  const hitRate = totalTargets > 0
    ? totalHits / totalTargets
    : getFirstFinite(payload.hitRate, payload.overallHitRate, payload.hit_rate);

  return {
    hitRate,
    avgReactionMs: weightedCount > 0
      ? weightedReaction / weightedCount
      : getFirstFinite(payload.avgReactionTime, payload.avg_reaction_ms, payload.reactionTime_mean),
  };
}

function buildOnboardingMetrics({ motorResult, payload }) {
  const fromResult = deriveMotorSummaryFromResult(motorResult);
  const fromPayload = deriveMotorSummaryFromPayload(payload);

  const hitRate = fromResult.hitRate ?? fromPayload.hitRate ?? null;
  const avgReactionMs = fromResult.avgReactionMs ?? fromPayload.avgReactionMs ?? null;

  return {
    avg_reaction_ms: avgReactionMs,
    hit_rate: hitRate,
  };
}

function buildDeviceContext(session, payload) {
  const device = session?.device || {};
  const screen = session?.screen || {};
  const userAgent = device.userAgent || session?.userAgent || payload?.userAgent || null;

  const os = device.os
    || payload?.device_os
    || payload?.os
    || parseOS(userAgent)
    || null;
  const browser = device.browser
    || payload?.device_browser
    || payload?.browser
    || parseBrowser(userAgent)
    || null;
  const dpr = getFirstFinite(
    screen.dpr,
    screen.pixelRatio,
    session?.devicePixelRatio,
    payload?.screen_dpr,
    payload?.dpr,
    payload?.devicePixelRatio,
    payload?.screen?.dpr,
    payload?.screen?.pixelRatio
  );

  return {
    os,
    browser,
    screen_w: screen.width ?? payload?.screen_width ?? payload?.screen_w ?? null,
    screen_h: screen.height ?? payload?.screen_height ?? payload?.screen_h ?? null,
    dpr: dpr ?? 1,
  };
}

// Proxy ML scoring to the internal Python service
// Impairment profile is created ONLY during registration/onboarding. Do NOT call ML on login.
router.post('/motor-score', authMiddleware, async (req, res) => {
  try {
    if (typeof fetch !== 'function') {
      return res.status(500).json({ error: 'Fetch not available in this Node.js version' });
    }

    // Guard: if impairment profile already exists (created at registration), skip ML - do not re-score on login
    const existingProfile = await ImpairmentProfile.findOne({
      user_id: String(req.userId),
      'impairment_probs.motor.motor_impairment': { $exists: true, $ne: null },
    });
    if (existingProfile) {
      console.log('⏭️ Impairment profile already exists – skipping ML (no re-score on login)');
      return res.json({
        motor_profile: existingProfile.impairment_probs?.motor || {},
        skipped: true,
        reason: 'profile_already_created',
      });
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
    const onboardingMetrics = buildOnboardingMetrics({ motorResult, payload });
    const inaccurateClick = onboardingMetrics.hit_rate != null
      ? Number((1 - onboardingMetrics.hit_rate).toFixed(4))
      : null;
    const motorImpairment = {
      delayed_reaction: motorProfile.latent_score ?? null,
      inaccurate_click: inaccurateClick,
      motor_impairment: motorProfile.impairment_score ?? null,
    };

    const profileUpdate = {
      user_id: String(req.userId),
      session_id: result.sessionId || payload.sessionId || (session?._id ? String(session._id) : ''),
      captured_at: new Date(),
      onboarding_metrics: onboardingMetrics,
      device_context: buildDeviceContext(session, payload),
    };

    await ImpairmentProfile.findOneAndUpdate(
      { user_id: String(req.userId) },
      {
        $set: {
          ...profileUpdate,
          'impairment_probs.motor': motorImpairment,
        },
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
