const mongoose = require('mongoose');

/**
 * MotorPointerTraceBucket - User-Based Bucketed Pointer Trace Storage
 * 
 * AURA version: Uses userId instead of sessionId
 * Based on sensecheck's MotorPointerTraceBucket
 * 
 * Stores downsampled pointer samples (30-60Hz) for motor skills assessment.
 * Used for:
 * - Movement trajectory analysis
 * - Velocity/acceleration profiles
 * - Tremor detection
 * - Spectral analysis
 * - Sequence models (LSTM/Transformer)
 */

const MAX_TRACE_SAMPLES_PER_BUCKET = 5000;

const pointerSampleSchema = new mongoose.Schema({
  round: { 
    type: Number, 
    min: 1, 
    max: 3, 
    required: true 
  },
  tms: { 
    type: Number, 
    required: true 
  }, // ms since round start
  x: { 
    type: Number, 
    required: true 
  },   // normalized 0..1
  y: { 
    type: Number, 
    required: true 
  },   // normalized 0..1
  isDown: { 
    type: Boolean, 
    default: false 
  },
  pointerType: { 
    type: String, 
    enum: ['mouse', 'touch', 'pen', 'unknown'], 
    default: 'unknown' 
  },
  pointerId: { type: Number }, // important for touch
  pressure: { type: Number },  // optional
}, { _id: false });

const motorPointerTraceBucketSchema = new mongoose.Schema({
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
  
  firstTms: { 
    type: Number, 
    default: 0 
  },
  
  lastTms: { 
    type: Number, 
    default: 0 
  },
  
  samples: { 
    type: [pointerSampleSchema], 
    default: [] 
  },
}, { 
  timestamps: true,
  strict: true,
});

// Indexes for efficient bucket lookup
motorPointerTraceBucketSchema.index({ userId: 1, bucketNumber: 1 });
motorPointerTraceBucketSchema.index({ userId: 1, isFull: 1 });

// TTL: Raw trace data expires after 1 year
motorPointerTraceBucketSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year

// Static method to add pointer samples to appropriate bucket
motorPointerTraceBucketSchema.statics.addSamples = async function(userId, samplesArray) {
  if (!Array.isArray(samplesArray) || samplesArray.length === 0) {
    throw new Error('samplesArray must be a non-empty array');
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
      samples: [],
    });
  }
  
  // Add samples, creating new buckets as needed
  for (const sample of samplesArray) {
    // Check if current bucket is full
    if (bucket.count >= MAX_TRACE_SAMPLES_PER_BUCKET) {
      bucket.isFull = true;
      await bucket.save();
      
      // Create new bucket
      bucket = await this.create({
        userId,
        bucketNumber: bucket.bucketNumber + 1,
        count: 0,
        samples: [],
      });
    }
    
    // Add sample
    bucket.samples.push(sample);
    bucket.count = bucket.samples.length;
    
    // Update time range
    if (bucket.firstTms === 0) {
      bucket.firstTms = sample.tms;
    }
    bucket.lastTms = sample.tms;
  }
  
  await bucket.save();
  return bucket;
};

// Static method to get all samples for a user
motorPointerTraceBucketSchema.statics.getUserSamples = async function(userId, round = null) {
  const buckets = await this.find({ userId }).sort({ bucketNumber: 1 });
  
  // Flatten all samples from all buckets
  const allSamples = [];
  for (const bucket of buckets) {
    if (round !== null) {
      // Filter by round
      allSamples.push(...bucket.samples.filter(s => s.round === round));
    } else {
      allSamples.push(...bucket.samples);
    }
  }
  
  return allSamples;
};

// Static method to get samples for a specific time range
motorPointerTraceBucketSchema.statics.getSamplesInRange = async function(userId, startTms, endTms, round = null) {
  const allSamples = await this.getUserSamples(userId, round);
  return allSamples.filter(s => s.tms >= startTms && s.tms <= endTms);
};

module.exports = mongoose.model('MotorPointerTraceBucket', motorPointerTraceBucketSchema);

