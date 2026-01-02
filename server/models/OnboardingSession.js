const mongoose = require('mongoose');

/**
 * Onboarding Game Session - User-Based Version
 * 
 * Each user gets ONE onboarding session when they first register.
 * This replaces sessionId with userId for the AURA extension.
 */

const onboardingSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Each user can only have one onboarding session
    index: true,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  completedAt: {
    type: Date,
  },
  
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'abandoned'],
    default: 'in_progress',
    index: true,
  },
  
  // Device info (for context)
  device: {
    pointerPrimary: {
      type: String,
      enum: ['mouse', 'touchpad', 'touch', 'pen', 'unknown'],
      default: 'unknown',
      index: true,
    },
    os: String,
    browser: String,
    userAgent: String,
  },
  
  screen: {
    width: Number,
    height: Number,
    dpr: Number,
  },
  
  // Game configuration
  game: {
    gameVersion: { type: String, default: '1.0.0' },
    metricsVersion: { type: String, default: 'aura-v1' },
    roundCount: { type: Number, default: 3 },
    columns: { type: Number, default: 5 },
    bubbleRadiusPx: Number,
    bubbleTTLms: Number,
  },
  
  // Performance quality signals
  perf: {
    samplingHzTarget: { type: Number, default: 60 },
    samplingHzEstimated: Number,
    avgFrameMs: Number,
    p95FrameMs: Number,
    droppedFrames: Number,
    inputLagMsEstimate: Number,
  },
  
  // Completed modules
  completedModules: [{
    moduleName: String,
    completedAt: Date,
  }],
  
  // Overall game score
  overallScore: {
    motorScore: Number,
    literacyScore: Number,
    visionScore: Number,
    totalScore: Number,
  },
});

// Auto-expire after 1 year
onboardingSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

// Virtual fields to get all related data
onboardingSessionSchema.virtual('motorResults', {
  ref: 'OnboardingMotorResult',
  localField: 'userId',
  foreignField: 'userId',
});

onboardingSessionSchema.virtual('literacyResult', {
  ref: 'OnboardingLiteracyResult',
  localField: 'userId',
  foreignField: 'userId',
  justOne: true,
});

onboardingSessionSchema.virtual('visionResult', {
  ref: 'OnboardingVisionResult',
  localField: 'userId',
  foreignField: 'userId',
  justOne: true,
});

// Method to mark as completed
onboardingSessionSchema.methods.complete = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  
  // Calculate overall scores
  const [motorResult, literacyResult, visionResult] = await Promise.all([
    mongoose.model('OnboardingMotorResult').findOne({ userId: this.userId }),
    mongoose.model('OnboardingLiteracyResult').findOne({ userId: this.userId }),
    mongoose.model('OnboardingVisionResult').findOne({ userId: this.userId }),
  ]);
  
  this.overallScore = {
    motorScore: motorResult?.overallScore || 0,
    literacyScore: literacyResult?.score?.computerLiteracyScore || 0,
    visionScore: visionResult?.overallScore || 0,
    totalScore: 0,
  };
  
  // Calculate total (weighted average)
  const scores = [
    motorResult?.overallScore || 0,
    literacyResult?.score?.computerLiteracyScore || 0,
    visionResult?.overallScore || 0,
  ];
  this.overallScore.totalScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  await this.save();
  return this;
};

// Enable virtuals in JSON output
onboardingSessionSchema.set('toJSON', { virtuals: true });
onboardingSessionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('OnboardingSession', onboardingSessionSchema);

