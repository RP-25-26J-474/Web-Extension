const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const OnboardingSession = require('../models/OnboardingSession');
const OnboardingMotorResult = require('../models/OnboardingMotorResult');
const OnboardingLiteracyResult = require('../models/OnboardingLiteracyResult');
const OnboardingVisionResult = require('../models/OnboardingVisionResult');

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

