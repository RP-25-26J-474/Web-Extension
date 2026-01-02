const mongoose = require('mongoose');

/**
 * Onboarding Literacy Result - User-Based
 * 
 * Computer literacy quiz results per user.
 * Adapted from sensecheck's literacy test.
 */

const questionResponseSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
  },
  question: String,
  userAnswer: {
    type: String,
    required: true,
  },
  correctAnswer: String,
  isCorrect: Boolean,
  responseTime: Number, // milliseconds
  focusShifts: Number,
  hoverEvents: [{
    option: String,
    duration: Number,
    timestamp: Date,
  }],
  interactions: [{
    eventType: String,
    timestamp: Date,
    target: String,
  }],
}, { _id: false });

const onboardingLiteracyResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One literacy result per user
    index: true,
  },
  
  completedAt: {
    type: Date,
    default: Date.now,
  },
  
  responses: [questionResponseSchema],
  
  // Computed Scores
  score: {
    correctAnswers: Number,
    totalQuestions: Number,
    percentage: Number,
    timeFactor: Number, // bonus/penalty based on speed
    computerLiteracyScore: Number, // CLS = correct + timeFactor
  },
  
  // Performance Metrics
  metrics: {
    totalTime: Number, // milliseconds
    averageResponseTime: Number,
    totalFocusShifts: Number,
    totalHoverEvents: Number,
  },
  
  // Category Breakdown
  categoryScores: [{
    category: String, // e.g., "icons", "terminology", "navigation"
    correct: Number,
    total: Number,
  }],
});

// Auto-expire results after 1 year
onboardingLiteracyResultSchema.index({ completedAt: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('OnboardingLiteracyResult', onboardingLiteracyResultSchema);

