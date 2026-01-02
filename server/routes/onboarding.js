const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const OnboardingSession = require('../models/OnboardingSession');
const OnboardingMotorResult = require('../models/OnboardingMotorResult');
const OnboardingLiteracyResult = require('../models/OnboardingLiteracyResult');
const OnboardingVisionResult = require('../models/OnboardingVisionResult');
const MotorPointerTraceBucket = require('../models/MotorPointerTraceBucket');
const MotorAttemptBucket = require('../models/MotorAttemptBucket');
const GlobalInteractionBucket = require('../models/GlobalInteractionBucket');
const { MotorRoundSummary, MotorSessionSummary, computeRoundFeatures, computeSessionFeatures } = require('../models/MotorSummary');

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
    // Check if user already has an onboarding session
    let session = await OnboardingSession.findOne({ userId: req.userId });
    
    if (session) {
      return res.json({
        message: 'Onboarding session already exists',
        session,
      });
    }
    
    const { device, screen, game, perf } = req.body;
    
    // Create new onboarding session
    session = new OnboardingSession({
      userId: req.userId,
      device,
      screen,
      game,
      perf,
    });
    
    await session.save();
    
    res.status(201).json({
      message: 'Onboarding session started',
      session,
    });
    
  } catch (error) {
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

// Log global interactions
router.post('/global/interactions', authMiddleware, async (req, res) => {
  try {
    const { interactions } = req.body;
    
    if (!Array.isArray(interactions) || interactions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Interactions array is required',
      });
    }
    
    const bucket = await GlobalInteractionBucket.addInteractions(req.userId, interactions);
    
    res.json({
      success: true,
      data: {
        bucketNumber: bucket.bucketNumber,
        totalInteractions: bucket.count,
      },
    });
    
  } catch (error) {
    console.error('Error logging global interactions:', error);
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
    
    // Create or update literacy result
    let literacyResult = await OnboardingLiteracyResult.findOne({ userId: req.userId });
    
    if (!literacyResult) {
      literacyResult = new OnboardingLiteracyResult({
        userId: req.userId,
        responses,
        score,
        metrics,
        categoryScores,
      });
    } else {
      literacyResult.responses = responses;
      literacyResult.score = score;
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
      score: literacyResult.score.computerLiteracyScore,
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
        colorBlindness,
        visualAcuity,
        testConditions,
      });
    } else {
      visionResult.colorBlindness = colorBlindness;
      visionResult.visualAcuity = visualAcuity;
      visionResult.testConditions = testConditions;
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

module.exports = router;

