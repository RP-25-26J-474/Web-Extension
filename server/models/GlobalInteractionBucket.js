const mongoose = require('mongoose');

/**
 * GlobalInteractionBucket - User-Based Bucketed Global Interaction Storage
 * 
 * AURA version: Uses userId instead of sessionId
 * EXACT COPY of sensecheck's GlobalInteractionBucket
 * 
 * Stores non-motor interactions (clicks, scrolls, form submissions, etc.)
 * across the entire application.
 */

const MAX_GLOBAL_INTERACTIONS_PER_BUCKET = 1000;

// Global interaction payload schema
const globalInteractionPayloadSchema = new mongoose.Schema({
  // Generic target info
  target: mongoose.Schema.Types.Mixed,
  
  // Pointer / mouse position
  position: {
    x: Number,
    y: Number,
  },
  
  screenPosition: {
    x: Number,
    y: Number,
  },
  
  // Input metadata
  button: String,
  key: String,
  code: String,
  pointerType: String,
  pointerId: Number,
  pressure: Number,
  
  // Page / context
  screen: String,
  url: String,
  title: String,
  
  // Timing
  duration: Number,
}, { _id: false });

// Global interaction schema
const globalInteractionSchema = new mongoose.Schema({
  timestamp: { 
    type: Date, 
    default: Date.now, 
    index: true 
  },
  eventType: { 
    type: String, 
    required: true 
  },
  module: String,
  
  // Global interaction payload
  data: globalInteractionPayloadSchema,
}, { _id: false });

const globalInteractionBucketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  bucketNumber: { 
    type: Number, 
    default: 1 
  },
  
  count: { 
    type: Number, 
    default: 0 
  },
  
  isFull: { 
    type: Boolean, 
    default: false 
  },
  
  firstInteractionAt: { 
    type: Date, 
    default: Date.now 
  },
  
  lastInteractionAt: { 
    type: Date, 
    default: Date.now 
  },
  
  interactions: {
    type: [globalInteractionSchema],
    default: [],
  },
}, {
  timestamps: true,
  strict: true,
});

// Indexes for efficient bucket lookup
globalInteractionBucketSchema.index({ userId: 1, bucketNumber: 1 });
globalInteractionBucketSchema.index({ userId: 1, isFull: 1 });

// TTL: Raw global interaction data expires after 1 year
globalInteractionBucketSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year

// Static method to add interactions to appropriate bucket
globalInteractionBucketSchema.statics.addInteractions = async function(userId, interactionsArray) {
  if (!Array.isArray(interactionsArray) || interactionsArray.length === 0) {
    throw new Error('interactionsArray must be a non-empty array');
  }
  
  // Find current active bucket
  let bucket = await this.findOne({
    userId,
    isFull: false,
  }).sort({ bucketNumber: -1 });
  
  // Create new bucket if needed
  if (!bucket) {
    bucket = await this.create({
      userId,
      bucketNumber: 1,
      count: 0,
      interactions: [],
    });
  }
  
  // Add interactions, creating new buckets as needed
  for (const interaction of interactionsArray) {
    // Check if current bucket is full
    if (bucket.count >= MAX_GLOBAL_INTERACTIONS_PER_BUCKET) {
      bucket.isFull = true;
      await bucket.save();
      
      // Create new bucket
      bucket = await this.create({
        userId,
        bucketNumber: bucket.bucketNumber + 1,
        count: 0,
        interactions: [],
      });
    }
    
    // Add interaction
    bucket.interactions.push(interaction);
    bucket.count = bucket.interactions.length;
    bucket.lastInteractionAt = new Date();
  }
  
  await bucket.save();
  return bucket;
};

// Static method to get all interactions for a user
globalInteractionBucketSchema.statics.getUserInteractions = async function(userId) {
  const buckets = await this.find({ userId }).sort({ bucketNumber: 1 });
  
  // Flatten all interactions from all buckets
  const allInteractions = [];
  for (const bucket of buckets) {
    allInteractions.push(...bucket.interactions);
  }
  
  return allInteractions;
};

module.exports = mongoose.model('GlobalInteractionBucket', globalInteractionBucketSchema);

