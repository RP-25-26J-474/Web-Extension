const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const OnboardingSession = require('../models/OnboardingSession');
const OnboardingMotorResult = require('../models/OnboardingMotorResult');
const OnboardingLiteracyResult = require('../models/OnboardingLiteracyResult');
const OnboardingVisionResult = require('../models/OnboardingVisionResult');
const MotorPointerTraceBucket = require('../models/MotorPointerTraceBucket');
const MotorAttemptBucket = require('../models/MotorAttemptBucket');
const { MotorRoundSummary, MotorSessionSummary, computeRoundFeatures, computeSessionFeatures } = require('../models/MotorSummary');
const User = require('../models/User');
const { buildMotorFeatureRow } = require('../utils/mlFeatureBuilder');
const ImpairmentProfile = require('../models/ImpairmentProfile');

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

function getFirstFinite(...values) {
  for (const value of values) {
    const finite = toFiniteNumber(value);
    if (finite != null) {
      return finite;
    }
  }
  return null;
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

function buildDeviceContext(session) {
  const device = session?.device || {};
  const screen = session?.screen || {};
  const userAgent = device.userAgent || session?.userAgent || null;

  return {
    os: device.os || parseOS(userAgent) || null,
    browser: device.browser || parseBrowser(userAgent) || null,
    screen_w: screen.width ?? null,
    screen_h: screen.height ?? null,
    dpr: getFirstFinite(screen.dpr, screen.pixelRatio, session?.devicePixelRatio),
  };
}

// Check if user has completed onboarding
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const session = await OnboardingSession.findOne({ userId: req.userId });
    
    if (!session) {
      return res.json({
        completed: false,
        hasSession: false,
      });
    }
    
    res.json({
      completed: session.status === 'completed',
      hasSession: true,
      status: session.status,
      completedModules: session.completedModules,
      overallScore: session.overallScore,
    });
    
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({ error: 'Failed to get onboarding status' });
  }
});

// Start onboarding session
router.post('/start', authMiddleware, async (req, res) => {
  try {
    // First, check if session already exists for this user
    let session = await OnboardingSession.findOne({ userId: req.userId });
    
    if (session) {
      // Session exists - update with any new context (viewport, perf, etc.)
      const viewportWidth = req.body?.viewportWidth ?? req.body?.viewport?.width;
      const viewportHeight = req.body?.viewportHeight ?? req.body?.viewport?.height;
      const highContrastMode = req.body?.highContrastMode;
      const reducedMotionPreference = req.body?.reducedMotionPreference;
      const perf = req.body?.perf;
      const updates = {};
      if (toFiniteNumber(viewportWidth) != null) updates.viewportWidth = viewportWidth;
      if (toFiniteNumber(viewportHeight) != null) updates.viewportHeight = viewportHeight;
      if (typeof highContrastMode === 'boolean') updates.highContrastMode = highContrastMode;
      if (typeof reducedMotionPreference === 'boolean') updates.reducedMotionPreference = reducedMotionPreference;
      if (perf && typeof perf === 'object') updates.perf = { ...session.perf, ...perf };
      if (Object.keys(updates).length > 0) {
        await OnboardingSession.findOneAndUpdate({ userId: req.userId }, { $set: updates });
      }
      return res.json({
        message: 'Onboarding session already exists',
        session,
        isNew: false,
      });
    }
    
    // No session exists - create a new one
    const { game, perf } = req.body || {};
    const incomingDevice = req.body?.device || {};
    const incomingScreen = req.body?.screen || {};
    const userAgent = incomingDevice.userAgent || req.get('user-agent') || null;
    const viewportWidth = req.body?.viewportWidth ?? req.body?.viewport?.width;
    const viewportHeight = req.body?.viewportHeight ?? req.body?.viewport?.height;
    const highContrastMode = req.body?.highContrastMode ?? false;
    const reducedMotionPreference = req.body?.reducedMotionPreference ?? false;

    const device = {
      ...incomingDevice,
      userAgent,
      os: incomingDevice.os || parseOS(userAgent),
      browser: incomingDevice.browser || parseBrowser(userAgent),
    };
    const screen = {
      ...incomingScreen,
      width: toFiniteNumber(incomingScreen.width),
      height: toFiniteNumber(incomingScreen.height),
      dpr: getFirstFinite(
        incomingScreen.dpr,
        incomingScreen.pixelRatio,
        incomingScreen.devicePixelRatio,
      ),
    };
    
    session = new OnboardingSession({
      userId: req.userId,
      device,
      screen,
      game,
      perf,
      viewportWidth: toFiniteNumber(viewportWidth) || null,
      viewportHeight: toFiniteNumber(viewportHeight) || null,
      highContrastMode: !!highContrastMode,
      reducedMotionPreference: !!reducedMotionPreference,
      status: 'in_progress',
    });
    
    await session.save();
    
    console.log(`New onboarding session created for user ${req.userId}`);
    
    res.status(201).json({
      message: 'Onboarding session started',
      session,
      isNew: true,
    });
    
  } catch (error) {
    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      // Another request created the session - fetch and return it
      const session = await OnboardingSession.findOne({ userId: req.userId });
      return res.json({
        message: 'Onboarding session already exists',
        session,
        isNew: false,
      });
    }
    
    console.error('Start onboarding error:', error);
    res.status(500).json({ error: 'Failed to start onboarding' });
  }
});

// ========== MOTOR SKILLS BUCKET-BASED ENDPOINTS (Sensecheck-Compatible) ==========

// Log pointer trace samples
router.post('/motor/trace', authMiddleware, async (req, res) => {
  try {
    const { samples } = req.body;
    
    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Samples array is required',
      });
    }
    
    const bucket = await MotorPointerTraceBucket.addSamples(req.userId, samples);
    
    res.json({
      success: true,
      data: {
        bucketNumber: bucket.bucketNumber,
        totalSamples: bucket.count,
      },
    });
    
  } catch (error) {
    console.error('Error logging pointer samples:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Log motor attempts (with automatic feature extraction)
router.post('/motor/attempts', authMiddleware, async (req, res) => {
  try {
    const { attempts } = req.body;
    
    if (!Array.isArray(attempts) || attempts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Attempts array is required',
      });
    }
    
    const bucket = await MotorAttemptBucket.addAttempts(req.userId, attempts);
    
    res.json({
      success: true,
      data: {
        bucketNumber: bucket.bucketNumber,
        totalAttempts: bucket.count,
      },
    });
    
  } catch (error) {
    console.error('Error logging motor attempts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Compute and save round summary
router.post('/motor/summary/round', authMiddleware, async (req, res) => {
  try {
    const { round } = req.body;
    
    if (!round || round < 1 || round > 3) {
      return res.status(400).json({
        success: false,
        error: 'Round must be 1, 2, or 3',
      });
    }
    
    // Compute features from attempts
    const features = await computeRoundFeatures(req.userId, round);
    
    if (!features) {
      return res.status(404).json({
        success: false,
        error: `No attempts found for round ${round}`,
      });
    }
    
    // Save or update round summary
    const summary = await MotorRoundSummary.findOneAndUpdate(
      { userId: req.userId, round },
      {
        counts: {
          nTargets: features.nAttempts,
          nHits: features.nHits,
          nMisses: features.nMisses,
          hitRate: features.hitRate,
        },
        features,
      },
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      data: summary,
    });
    
  } catch (error) {
    console.error('Error computing round summary:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Compute and save session summary
router.post('/motor/summary/session', authMiddleware, async (req, res) => {
  try {
    // Update session with perf/viewport/accessibility if provided
    const { perf, viewportWidth, viewportHeight, highContrastMode, reducedMotionPreference } = req.body || {};
    const updates = {};
    if (perf && typeof perf === 'object') {
      updates['perf.samplingHzEstimated'] = perf.samplingHzEstimated;
      updates['perf.avgFrameMs'] = perf.avgFrameMs;
      updates['perf.p95FrameMs'] = perf.p95FrameMs;
      updates['perf.droppedFrames'] = perf.droppedFrames;
      updates['perf.inputLagMsEstimate'] = perf.inputLagMsEstimate;
    }
    if (viewportWidth != null) updates.viewportWidth = toFiniteNumber(viewportWidth) || null;
    if (viewportHeight != null) updates.viewportHeight = toFiniteNumber(viewportHeight) || null;
    if (typeof highContrastMode === 'boolean') updates.highContrastMode = highContrastMode;
    if (typeof reducedMotionPreference === 'boolean') updates.reducedMotionPreference = reducedMotionPreference;
    if (Object.keys(updates).length > 0) {
      await OnboardingSession.findOneAndUpdate({ userId: req.userId }, { $set: updates });
    }

    // Compute features from all rounds
    const features = await computeSessionFeatures(req.userId);
    
    // Save or update session summary
    const summary = await MotorSessionSummary.findOneAndUpdate(
      { userId: req.userId },
      { features },
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      data: summary,
    });
    
  } catch (error) {
    console.error('Error computing session summary:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Build full ML feature vector for motor model scoring
router.get('/motor/feature-vector', authMiddleware, async (req, res) => {
  try {
    const session = await OnboardingSession.findOne({ userId: req.userId });
    
    if (!session) {
      return res.status(404).json({ error: 'Onboarding session not found' });
    }
    
    const [user, attempts] = await Promise.all([
      User.findById(req.userId),
      MotorAttemptBucket.getUserAttempts(req.userId),
    ]);
    
    const row = buildMotorFeatureRow({ session, user, attempts });
    
    res.json({
      success: true,
      data: row,
    });

    console.log('Feature vector:', row);
    
  } catch (error) {
    console.error('Error building motor feature vector:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ========== LEGACY ENDPOINT (kept for backward compatibility) ==========

// Save motor skills result
router.post('/motor', authMiddleware, async (req, res) => {
  try {
    const { attempts, roundSummaries, overallMetrics } = req.body;
    
    // Create or update motor result
    let motorResult = await OnboardingMotorResult.findOne({ userId: req.userId });
    
    if (!motorResult) {
      motorResult = new OnboardingMotorResult({
        userId: req.userId,
        attempts,
        roundSummaries,
        overallMetrics,
      });
    } else {
      motorResult.attempts = attempts;
      motorResult.roundSummaries = roundSummaries;
      motorResult.overallMetrics = overallMetrics;
    }
    
    // Calculate score
    motorResult.calculateScore();
    await motorResult.save();
    
    // Update session completed modules
    await OnboardingSession.findOneAndUpdate(
      { userId: req.userId },
      {
        $addToSet: {
          completedModules: {
            moduleName: 'motor',
            completedAt: new Date(),
          },
        },
      }
    );
    
    res.json({
      message: 'Motor skills result saved',
      score: motorResult.overallScore,
    });
    
  } catch (error) {
    console.error('Save motor result error:', error);
    res.status(500).json({ error: 'Failed to save motor result' });
  }
});

// Save literacy result
router.post('/literacy', authMiddleware, async (req, res) => {
  try {
    const { responses, score, metrics, categoryScores } = req.body;
    
    // Normalize score: client may send a number (0-1 decimal), numeric string, or full object
    let scoreObj = score;
    const numericScore = typeof score === 'number' ? score : (typeof score === 'string' ? parseFloat(score) : null);
    if (Number.isFinite(numericScore) && (typeof score !== 'object' || score === null)) {
      const correctAnswers = metrics?.correctAnswers ?? 0;
      const totalQuestions = metrics?.totalQuestions ?? 1;
      const percentage = totalQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : Math.round(numericScore * 100);
      scoreObj = {
        correctAnswers,
        totalQuestions,
        percentage,
        timeFactor: metrics?.timeFactor ?? 0,
        computerLiteracyScore: Math.round(numericScore * 100),
      };
    } else if (typeof score !== 'object' || score === null || !score.correctAnswers) {
      // Fallback: build minimal valid object
      const correctAnswers = metrics?.correctAnswers ?? 0;
      const totalQuestions = metrics?.totalQuestions ?? 1;
      scoreObj = {
        correctAnswers,
        totalQuestions,
        percentage: totalQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
        timeFactor: metrics?.timeFactor ?? 0,
        computerLiteracyScore: correctAnswers + (metrics?.timeFactor ?? 0),
      };
    }
    
    // Create or update literacy result
    let literacyResult = await OnboardingLiteracyResult.findOne({ userId: req.userId });
    
    if (!literacyResult) {
      literacyResult = new OnboardingLiteracyResult({
        userId: req.userId,
        responses,
        score: scoreObj,
        metrics,
        categoryScores,
      });
    } else {
      literacyResult.responses = responses;
      literacyResult.score = scoreObj;
      literacyResult.metrics = metrics;
      literacyResult.categoryScores = categoryScores;
    }
    
    await literacyResult.save();
    
    // Update session completed modules
    await OnboardingSession.findOneAndUpdate(
      { userId: req.userId },
      {
        $addToSet: {
          completedModules: {
            moduleName: 'literacy',
            completedAt: new Date(),
          },
        },
      }
    );
    
    res.json({
      message: 'Literacy result saved',
      score: literacyResult.score?.computerLiteracyScore ?? literacyResult.score?.percentage ?? 0,
    });
    
  } catch (error) {
    console.error('Save literacy result error:', error);
    res.status(500).json({ error: 'Failed to save literacy result' });
  }
});

// Save vision result
router.post('/vision', authMiddleware, async (req, res) => {
  try {
    const { colorBlindness, visualAcuity, testConditions } = req.body;
    
    // Create or update vision result
    let visionResult = await OnboardingVisionResult.findOne({ userId: req.userId });
    
    if (!visionResult) {
      visionResult = new OnboardingVisionResult({
        userId: req.userId,
        colorBlindness: colorBlindness || {},
        visualAcuity: visualAcuity || {},
        testConditions: testConditions || {},
      });
    } else {
      // Merge updates – don't overwrite with undefined/null (e.g. VisualAcuity saves after ColorBlindness)
      if (colorBlindness != null && typeof colorBlindness === 'object') visionResult.colorBlindness = colorBlindness;
      if (visualAcuity != null && typeof visualAcuity === 'object') visionResult.visualAcuity = visualAcuity;
      if (testConditions != null && typeof testConditions === 'object') visionResult.testConditions = testConditions;
    }
    
    // Calculate score
    visionResult.calculateScore();
    await visionResult.save();
    
    // Update session completed modules
    await OnboardingSession.findOneAndUpdate(
      { userId: req.userId },
      {
        $addToSet: {
          completedModules: {
            moduleName: 'vision',
            completedAt: new Date(),
          },
        },
      }
    );
    
    res.json({
      message: 'Vision result saved',
      score: visionResult.overallScore,
    });
    
  } catch (error) {
    console.error('Save vision result error:', error);
    res.status(500).json({ error: 'Failed to save vision result' });
  }
});

// Complete onboarding
router.post('/complete', authMiddleware, async (req, res) => {
  try {
    const session = await OnboardingSession.findOne({ userId: req.userId });
    
    if (!session) {
      return res.status(404).json({ error: 'Onboarding session not found' });
    }
    
    if (session.status === 'completed') {
      return res.json({
        message: 'Onboarding already completed',
        overallScore: session.overallScore,
      });
    }
    
    // Mark as completed and calculate overall scores
    await session.complete();
    
    res.json({
      message: 'Onboarding completed successfully',
      overallScore: session.overallScore,
    });
    
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// Get onboarding results
router.get('/results', authMiddleware, async (req, res) => {
  try {
    const [session, motor, literacy, vision] = await Promise.all([
      OnboardingSession.findOne({ userId: req.userId }),
      OnboardingMotorResult.findOne({ userId: req.userId }),
      OnboardingLiteracyResult.findOne({ userId: req.userId }),
      OnboardingVisionResult.findOne({ userId: req.userId }),
    ]);
    
    if (!session) {
      return res.status(404).json({ error: 'Onboarding session not found' });
    }
    
    res.json({
      session,
      results: {
        motor,
        literacy,
        vision,
      },
    });
    
  } catch (error) {
    console.error('Get onboarding results error:', error);
    res.status(500).json({ error: 'Failed to get onboarding results' });
  }
});

// Save impairment profile (POST from client after game completion)
router.post('/impairment-profile', authMiddleware, async (req, res) => {
  try {
    const {
      impairment_probs,
      onboarding_metrics,
      device_context,
    } = req.body;
    
    // Validation
    if (!impairment_probs || !onboarding_metrics || !device_context) {
      return res.status(400).json({ error: 'Missing required profile data' });
    }
    
    // Get session for session_id
    const session = await OnboardingSession.findOne({ userId: req.userId });
    
    // Save or update the profile
    const updatedProfile = await ImpairmentProfile.findOneAndUpdate(
      { user_id: String(req.userId) },
      {
        $set: {
          user_id: String(req.userId),
          session_id: session?._id ? String(session._id) : '',
          captured_at: new Date(),
          impairment_probs,
          onboarding_metrics,
          device_context,
        },
      },
      { upsert: true, new: true }
    );
    
    console.log('✅ Impairment profile saved:', {
      userId: req.userId,
      profileId: updatedProfile._id,
    });
    
    res.json({ 
      success: true, 
      message: 'Impairment profile saved successfully',
      data: updatedProfile 
    });
    
  } catch (error) {
    console.error('Save impairment profile error:', error);
    res.status(500).json({ error: 'Failed to save impairment profile' });
  }
});

// Get impairment profile (normalized scores + stored motor impairment)
router.get('/impairment-profile', authMiddleware, async (req, res) => {
  try {
    const [profile, session, motorResult, literacyResult, visionResult] = await Promise.all([
      ImpairmentProfile.findOne({ user_id: String(req.userId) }),
      OnboardingSession.findOne({ userId: req.userId }),
      OnboardingMotorResult.findOne({ userId: req.userId }),
      OnboardingLiteracyResult.findOne({ userId: req.userId }),
      OnboardingVisionResult.findOne({ userId: req.userId }),
    ]);

    const visionLossScore = visionResult?.overallScore;
    const colorBlindnessScore = visionResult?.colorBlindness?.colorVisionScore;
    const literacyScore = literacyResult?.score?.computerLiteracyScore;
    const existingHitRate = toFiniteNumber(profile?.onboarding_metrics?.hit_rate);
    const overallHitRate = toFiniteNumber(motorResult?.overallMetrics?.overallHitRate);
    const hitRate = overallHitRate ?? existingHitRate ?? null;
    const existingAvgReaction = toFiniteNumber(profile?.onboarding_metrics?.avg_reaction_ms);
    const overallAvgReaction = toFiniteNumber(motorResult?.overallMetrics?.avgReactionTime);
    const attemptsAvgReaction = mean(
      Array.isArray(motorResult?.attempts)
        ? motorResult.attempts.map(attempt => attempt?.timing?.reactionTimeMs)
        : []
    );
    const avgReactionMs = existingAvgReaction ?? overallAvgReaction ?? attemptsAvgReaction ?? null;

    const motorExisting = profile?.impairment_probs?.motor || {};
    const inaccurateClick = motorExisting.inaccurate_click ?? (
      hitRate != null ? Number((1 - hitRate).toFixed(4)) : null
    );
    const impairment_probs = {
      vision: {
        vision_loss: Number.isFinite(visionLossScore) ? visionLossScore / 100 : null,
        color_blindness: Number.isFinite(colorBlindnessScore) ? colorBlindnessScore / 100 : null,
      },
      motor: {
        delayed_reaction: motorExisting.delayed_reaction ?? null,
        inaccurate_click: inaccurateClick,
        motor_impairment: motorExisting.motor_impairment ?? null,
      },
      literacy: Number.isFinite(literacyScore) ? literacyScore / 100 : null,
    };

    const onboarding_metrics = {
      avg_reaction_ms: avgReactionMs,
      hit_rate: hitRate,
    };

    const updatedProfile = await ImpairmentProfile.findOneAndUpdate(
      { user_id: String(req.userId) },
      {
        $set: {
          user_id: String(req.userId),
          session_id: session?._id ? String(session._id) : '',
          captured_at: new Date(),
          impairment_probs,
          onboarding_metrics,
          device_context: buildDeviceContext(session),
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: updatedProfile });
  } catch (error) {
    console.error('Get impairment profile error:', error);
    res.status(500).json({ error: 'Failed to get impairment profile' });
  }
});

// ========== SENSECHECK-COMPATIBLE ENDPOINTS ==========
// These endpoints match the format expected by sensecheck-aura client

// Get session data (sensecheck-compatible)
router.get('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const session = await OnboardingSession.findOne({ userId: req.userId });
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    res.json({
      success: true,
      data: {
        session: {
          sessionId: req.userId,
          completedModules: session.completedModules || [],
          status: session.status,
          createdAt: session.createdAt,
        },
      },
    });
    
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get session' 
    });
  }
});

// Update module completion (sensecheck-compatible)
router.post('/module-complete', authMiddleware, async (req, res) => {
  try {
    const { moduleName } = req.body;
    
    if (!moduleName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Module name is required' 
      });
    }
    
    // Map sensecheck module names to AURA module names
    const moduleNameMap = {
      'perception': 'vision',
      'reaction': 'motor',
      'knowledge': 'literacy',
      // Also accept direct names
      'vision': 'vision',
      'motor': 'motor',
      'literacy': 'literacy',
    };
    
    const mappedModuleName = moduleNameMap[moduleName] || moduleName;
    
    // Find or create session
    let session = await OnboardingSession.findOne({ userId: req.userId });
    
    if (!session) {
      // Create session if it doesn't exist
      session = new OnboardingSession({
        userId: req.userId,
        status: 'in_progress',
      });
    }
    
    // Check if module already completed
    const alreadyCompleted = session.completedModules.some(
      m => m.moduleName === mappedModuleName || m.moduleName === moduleName
    );
    
    if (!alreadyCompleted) {
      session.completedModules.push({
        moduleName: mappedModuleName,
        completedAt: new Date(),
      });
    }
    
    await session.save();
    
    console.log(`Module completed: ${moduleName} (mapped to ${mappedModuleName}) for user ${req.userId}`);
    
    res.json({
      success: true,
      data: {
        session: {
          sessionId: req.userId,
          completedModules: session.completedModules,
          status: session.status,
        },
      },
    });
    
  } catch (error) {
    console.error('Update module completion error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update module completion' 
    });
  }
});

module.exports = router;

