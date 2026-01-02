const mongoose = require('mongoose');

/**
 * Onboarding Vision Result - User-Based
 * 
 * Vision tests (color blindness + visual acuity) per user.
 * Adapted from sensecheck's vision tests.
 */

const colorBlindnessPlateSchema = new mongoose.Schema({
  plateId: {
    type: Number,
    required: true,
  },
  imageName: String,
  userAnswer: {
    type: String, // Can be number or "nothing"
    required: true,
  },
  responseTime: Number, // milliseconds
  isCorrect: Boolean,
  interactions: [{
    eventType: String,
    timestamp: Date,
  }],
}, { _id: false });

const visualAcuityAttemptSchema = new mongoose.Schema({
  size: {
    type: Number,
    required: true,
  },
  number: Number,
  userAnswer: Number,
  isCorrect: Boolean,
  responseTime: Number,
  attemptNumber: Number, // 1 or 2 (for retry)
}, { _id: false });

const onboardingVisionResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One vision result per user
    index: true,
  },
  
  completedAt: {
    type: Date,
    default: Date.now,
  },
  
  // Color Blindness Test Results
  colorBlindness: {
    plates: [colorBlindnessPlateSchema],
    colorVisionScore: Number,
    diagnosis: {
      type: String,
      enum: ['Normal', 'Suspected Red-Green Deficiency', 'Inconclusive'],
    },
    totalResponseTime: Number,
  },
  
  // Visual Acuity Test Results
  visualAcuity: {
    attempts: [visualAcuityAttemptSchema],
    finalResolvedSize: Number, // in pixels
    visualAngle: Number, // in degrees
    mar: Number, // Minimum Angle of Resolution
    snellenDenominator: Number,
    snellenEstimate: String, // e.g., "20/40"
    totalResponseTime: Number,
  },
  
  // Overall vision score (0-100)
  overallScore: Number,
  
  // Metadata
  testConditions: {
    screenSize: {
      width: Number,
      height: Number,
    },
    viewingDistance: Number, // estimated or user-provided in cm
    brightness: Number,
    timeOfDay: String,
  },
});

// Auto-expire results after 1 year
onboardingVisionResultSchema.index({ completedAt: 1 }, { expireAfterSeconds: 31536000 });

// Method to calculate overall score
onboardingVisionResultSchema.methods.calculateScore = function() {
  // Color blindness: 50% of score
  const colorScore = (this.colorBlindness?.diagnosis === 'Normal' ? 50 : 25);
  
  // Visual acuity: 50% of score (based on Snellen)
  const snellen = this.visualAcuity?.snellenDenominator || 40;
  const acuityScore = Math.max(0, 50 - (snellen - 20));
  
  this.overallScore = Math.round(colorScore + acuityScore);
  return this.overallScore;
};

module.exports = mongoose.model('OnboardingVisionResult', onboardingVisionResultSchema);

