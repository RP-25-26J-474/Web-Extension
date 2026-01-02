const mongoose = require('mongoose');

/**
 * MotorAttemptBucket - User-Based Bucketed Attempt-Level Features
 * 
 * AURA version: Uses userId instead of sessionId
 * EXACT COPY of sensecheck's MotorAttemptBucket
 * 
 * Stores one record per bubble attempt with computed features.
 * This is the PRIMARY collection for ML training.
 * 
 * Each attempt includes:
 * - Target properties (spawn, position, size)
 * - Click outcome (hit/miss, position, timing)
 * - Derived features (kinematics, spatial, Fitts)
 */

const MAX_ATTEMPTS_PER_BUCKET = 2000;

const motorAttemptSchema = new mongoose.Schema({
  round: { 
    type: Number, 
    min: 1, 
    max: 3, 
    required: true,
    index: true,
  },
  attemptId: { 
    type: String, 
    required: true 
  }, // unique within user
  bubbleId: { 
    type: String, 
    required: true 
  },
  
  // ===== Target properties =====
  spawnTms: { 
    type: Number, 
    required: true 
  },
  despawnTms: { type: Number }, // if timed out
  ttlMs: { type: Number },       // bubble lifetime
  column: Number,
  speedNorm: Number,             // normalized speed
  
  target: {
    x: { type: Number, required: true },        // xNorm (0..1)
    y: { type: Number, required: true },        // yNorm (0..1)
    radius: { type: Number, required: true },   // radiusNorm
  },
  
  // ===== Input outcome =====
  click: {
    clicked: { type: Boolean, default: false },
    hit: { type: Boolean, default: false },
    missType: { 
      type: String, 
      enum: ['hit', 'bubble_miss', 'stage_miss', 'timeout', 'unknown'], 
      default: 'unknown' 
    },
    tms: Number,
    x: Number, // xNorm
    y: Number, // yNorm
  },
  
  // ===== Derived timing =====
  timing: {
    reactionTimeMs: Number,  // spawn -> first click attempt
    movementTimeMs: Number,  // first movement after spawn -> click
    interTapMs: Number,      // previous click -> this click
  },
  
  // ===== Derived geometry =====
  spatial: {
    errorDistNorm: Number,    // distance(click, target)/radius
    pathLengthNorm: Number,   // sum step lengths
    directDistNorm: Number,   // distance(start, target)
    straightness: Number,     // direct/path
  },
  
  // ===== Derived kinematics =====
  kinematics: {
    meanSpeed: Number,
    peakSpeed: Number,
    speedVar: Number,
    meanAccel: Number,
    peakAccel: Number,
    jerkRMS: Number,
    submovementCount: Number,
    overshootCount: Number,
  },
  
  // ===== Fitts' law =====
  fitts: {
    D: Number,          // directDistNorm
    W: Number,          // target diameter norm (2*radius)
    ID: Number,         // log2(D/W + 1)
    throughput: Number, // ID / movementTimeSeconds
  },
}, { _id: false });

const motorAttemptBucketSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, 
    index: true,
  },
  
  bucketNumber: { 
    type: Number, 
    required: true, 
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
  
  attempts: { 
    type: [motorAttemptSchema], 
    default: [] 
  },
}, { 
  timestamps: true,
  strict: true,
});

// Indexes for efficient bucket lookup
motorAttemptBucketSchema.index({ userId: 1, bucketNumber: 1 });
motorAttemptBucketSchema.index({ userId: 1, isFull: 1 });

// TTL: Raw attempt data expires after 1 year
motorAttemptBucketSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year

// Static method to add attempts to appropriate bucket
motorAttemptBucketSchema.statics.addAttempts = async function(userId, attemptsArray) {
  if (!Array.isArray(attemptsArray) || attemptsArray.length === 0) {
    throw new Error('attemptsArray must be a non-empty array');
  }
  
  // Get pointer samples for feature extraction
  const MotorPointerTraceBucket = mongoose.model('MotorPointerTraceBucket');
  const allSamples = await MotorPointerTraceBucket.getUserSamples(userId);
  
  console.log(`\n📊 Processing ${attemptsArray.length} attempts with ${allSamples.length} pointer samples`);
  
  // Debug: Show first attempt structure
  if (attemptsArray.length > 0) {
    const sample = attemptsArray[0];
    console.log(`   Sample attempt structure:`, {
      round: sample.round,
      bubbleId: sample.bubbleId,
      column: sample.column,
      spawnTms: sample.spawnTms,
      clickTms: sample.click?.tms,
      hasTarget: !!sample.target,
      targetCoords: sample.target ? `(${sample.target.x.toFixed(3)}, ${sample.target.y.toFixed(3)})` : 'N/A'
    });
  }
  
  // Debug: Show pointer sample time range
  if (allSamples.length > 0) {
    const sortedSamples = [...allSamples].sort((a, b) => a.tms - b.tms);
    console.log(`   Pointer sample time range: ${sortedSamples[0].tms} to ${sortedSamples[sortedSamples.length-1].tms}`);
  }
  
  // Import feature extraction
  const { extractAttemptFeatures } = require('../utils/featureExtraction.js');
  
  // Enrich attempts with computed features
  const enrichedAttempts = attemptsArray.map((attempt, idx) => {
    // Get previous click time for inter-tap interval
    const prevClickTms = idx > 0 ? attemptsArray[idx - 1].click?.tms : null;
    
    // Extract features if we have pointer data and the attempt was clicked
    let features = {};
    if (allSamples.length > 0 && attempt.click?.clicked) {
      try {
        features = extractAttemptFeatures({
          samples: allSamples,
          spawnTms: attempt.spawnTms,
          clickTms: attempt.click.tms,
          target: attempt.target,
          prevClickTms,
        });
      } catch (err) {
        console.error(`Error extracting features for attempt ${attempt.attemptId}:`, err.message);
        // Continue with empty features if extraction fails
        features = {
          timing: {},
          spatial: {},
          kinematics: {},
          fitts: {},
        };
      }
    } else {
      // Missed bubble or no pointer data
      features = {
        timing: {
          reactionTimeMs: null,
          movementTimeMs: null,
          interTapMs: prevClickTms ? (attempt.despawnTms || Date.now()) - prevClickTms : null,
        },
        spatial: {},
        kinematics: {},
        fitts: {},
      };
    }
    
    // Merge attempt with computed features
    return {
      ...attempt,
      ...features,
    };
  });
  
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
      attempts: [],
    });
  }
  
  // Add enriched attempts, creating new buckets as needed
  for (const attempt of enrichedAttempts) {
    // Check if current bucket is full
    if (bucket.count >= MAX_ATTEMPTS_PER_BUCKET) {
      bucket.isFull = true;
      await bucket.save();
      
      // Create new bucket
      bucket = await this.create({
        userId,
        bucketNumber: bucket.bucketNumber + 1,
        count: 0,
        attempts: [],
      });
    }
    
    // Add enriched attempt
    bucket.attempts.push(attempt);
    bucket.count = bucket.attempts.length;
  }
  
  await bucket.save();
  return bucket;
};

// Static method to get all attempts for a user
motorAttemptBucketSchema.statics.getUserAttempts = async function(userId, round = null) {
  const buckets = await this.find({ userId }).sort({ bucketNumber: 1 });
  
  // Flatten all attempts from all buckets
  const allAttempts = [];
  for (const bucket of buckets) {
    if (round !== null) {
      // Filter by round
      allAttempts.push(...bucket.attempts.filter(a => a.round === round));
    } else {
      allAttempts.push(...bucket.attempts);
    }
  }
  
  return allAttempts;
};

// Static method to get attempt statistics
motorAttemptBucketSchema.statics.getUserStats = async function(userId) {
  const allAttempts = await this.getUserAttempts(userId);
  
  const byRound = {
    1: allAttempts.filter(a => a.round === 1),
    2: allAttempts.filter(a => a.round === 2),
    3: allAttempts.filter(a => a.round === 3),
  };
  
  const stats = {
    userId,
    total: allAttempts.length,
    rounds: {},
  };
  
  for (const [round, attempts] of Object.entries(byRound)) {
    const hits = attempts.filter(a => a.click.hit);
    stats.rounds[round] = {
      totalAttempts: attempts.length,
      hits: hits.length,
      misses: attempts.length - hits.length,
      hitRate: attempts.length > 0 ? (hits.length / attempts.length) : 0,
      avgReactionTime: attempts.length > 0 
        ? attempts.reduce((sum, a) => sum + (a.timing.reactionTimeMs || 0), 0) / attempts.length
        : null,
      avgMovementTime: attempts.length > 0
        ? attempts.reduce((sum, a) => sum + (a.timing.movementTimeMs || 0), 0) / attempts.length
        : null,
      avgThroughput: hits.length > 0
        ? hits.reduce((sum, a) => sum + (a.fitts.throughput || 0), 0) / hits.length
        : null,
    };
  }
  
  return stats;
};

module.exports = mongoose.model('MotorAttemptBucket', motorAttemptBucketSchema);

