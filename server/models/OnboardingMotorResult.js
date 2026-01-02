const mongoose = require('mongoose');

/**
 * Onboarding Motor Skills Results - User-Based
 * 
 * Stores motor skills game data per user (not session).
 * Adapted from sensecheck's motor tracking.
 */

const motorAttemptSchema = new mongoose.Schema({
  round: { type: Number, min: 1, max: 3 },
  attemptIndex: Number,
  targetId: String,
  
  // Timing
  timing: {
    reactionTimeMs: Number,
    movementTimeMs: Number,
    interTapMs: Number,
    spawnTs: Number,
    clickTs: Number,
  },
  
  // Click data
  click: {
    hit: Boolean,
    x: Number,
    y: Number,
    pressure: Number,
  },
  
  // Spatial metrics (normalized by bubble radius)
  spatial: {
    errorDistNorm: Number,
    pathLengthNorm: Number,
    straightness: Number,
    initialDirection: Number,
  },
  
  // Kinematics
  kinematics: {
    meanSpeed: Number,
    peakSpeed: Number,
    jerkRMS: Number,
    submovementCount: Number,
    overshootCount: Number,
  },
  
  // Fitts law metrics
  fitts: {
    ID: Number, // Index of Difficulty
    throughput: Number,
    effectiveWidth: Number,
  },
}, { _id: false });

const onboardingMotorResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One motor result per user
    index: true,
  },
  
  completedAt: {
    type: Date,
    default: Date.now,
  },
  
  // All attempts across all rounds
  attempts: [motorAttemptSchema],
  
  // Per-round summaries
  roundSummaries: [{
    round: Number,
    nTargets: Number,
    nHits: Number,
    nMisses: Number,
    hitRate: Number,
    avgReactionTime: Number,
    avgMovementTime: Number,
    avgThroughput: Number,
  }],
  
  // Overall metrics
  overallMetrics: {
    totalTargets: Number,
    totalHits: Number,
    totalMisses: Number,
    overallHitRate: Number,
    avgReactionTime: Number,
    avgMovementTime: Number,
    avgThroughput: Number,
    consistency: Number, // Variation across rounds
  },
  
  // Overall score (0-100)
  overallScore: Number,
});

// Auto-expire after 1 year
onboardingMotorResultSchema.index({ completedAt: 1 }, { expireAfterSeconds: 31536000 });

// Method to calculate overall score
onboardingMotorResultSchema.methods.calculateScore = function() {
  const metrics = this.overallMetrics;
  
  // Score factors:
  // - Hit rate (40%)
  // - Speed (reaction + movement) (30%)
  // - Throughput (30%)
  
  const hitRateScore = (metrics.overallHitRate || 0) * 40;
  
  // Speed score (inverse - faster is better)
  const avgTime = (metrics.avgReactionTime || 500) + (metrics.avgMovementTime || 500);
  const speedScore = Math.max(0, 30 - (avgTime / 1000) * 3);
  
  // Throughput score (higher is better)
  const throughputScore = Math.min(30, (metrics.avgThroughput || 0) * 3);
  
  this.overallScore = Math.round(hitRateScore + speedScore + throughputScore);
  return this.overallScore;
};

module.exports = mongoose.model('OnboardingMotorResult', onboardingMotorResultSchema);

