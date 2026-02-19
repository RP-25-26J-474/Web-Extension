const mongoose = require('mongoose');

/**
 * Impairment Profile - Stores onboarding impairment probabilities and context.
 * Keeps snake_case keys to align with existing exports/scripts.
 */
const impairmentProfileSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  session_id: {
    type: String,
    index: true,
  },
  captured_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
  impairment_probs: {
    vision: {
      vision_loss: Number,
      color_blindness: Number,
    },
    motor: {
      delayed_reaction: Number,
      inaccurate_click: Number,
      motor_impairment: Number,
    },
    literacy: Number,
  },
  onboarding_metrics: {
    avg_reaction_ms: Number,
    hit_rate: Number,
  },
  device_context: {
    os: String,
    browser: String,
    screen_w: Number,
    screen_h: Number,
    dpr: Number,
  },
}, {
  timestamps: true,
  strict: true,
});

module.exports = mongoose.model('ImpairmentProfile', impairmentProfileSchema, 'impairmentprofiles');
