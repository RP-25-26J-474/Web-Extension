const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  url: {
    type: String,
    required: true
  },
  pageTitle: String,
  
  // Element information
  elementTag: String,
  elementId: String,
  elementClass: String,
  elementText: String,
  
  // Position information
  x: Number,
  y: Number,
  
  // Keyboard information
  key: String,
  code: String,
  
  // Touch information
  touchCount: Number,
  
  // Drag/Drop information
  dragType: String,
  
  // Zoom information
  scale: Number,
  zoomLevel: Number,
  action: String,
  
  // Swipe information
  direction: String,
  distance: Number,
  
  // Scroll information
  scrollY: Number,
  scrollX: Number,
  
  // Additional metadata
  metadata: mongoose.Schema.Types.Mixed,
  
  // Auto-delete after 30 days
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    index: true
  }
});

// Create TTL index for auto-deletion
interactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for user queries
interactionSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Interaction', interactionSchema);

