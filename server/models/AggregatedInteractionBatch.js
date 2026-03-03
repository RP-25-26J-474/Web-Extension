const mongoose = require('mongoose');

/**
 * AggregatedInteractionBatch - 10-second windowed interaction metrics
 * 
 * Stores pre-aggregated interaction statistics collected every 10 seconds.
 * Batches are flushed every 30 seconds from client to server.
 * 
 * This is optimized for ML feature extraction and analysis without
 * needing to process raw events.
 */

const pageContextSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
  },
  route: {
    type: String,
    required: true,
  },
  app_type: {
    type: String,
    enum: ['web', 'extension', 'mobile'],
    default: 'web',
  },
}, { _id: false });

const eventsAggSchema = new mongoose.Schema({
  click_count: {
    type: Number,
    default: 0,
  },
  misclick_rate: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  avg_click_interval_ms: {
    type: Number,
    default: 0,
  },
  avg_dwell_ms: {
    type: Number,
    default: 0,
  },
  rage_clicks: {
    type: Number,
    default: 0,
  },
  zoom_events: {
    type: Number,
    default: 0,
  },
  scroll_speed_px_s: {
    type: Number,
    default: 0,
  },
}, { _id: false });

const profilerSchema = new mongoose.Schema({
  sampling_hz: {
    type: Number,
    default: 30,
  },
  input_lag_ms_est: {
    type: Number,
    default: 0,
  },
}, { _id: false });

const aggregatedInteractionBatchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  batch_id: {
    type: String,
    required: true,
    unique: true,
  },
  
  captured_at: {
    type: Date,
    required: true,
    index: true,
  },
  
  page_context: {
    type: pageContextSchema,
    required: true,
  },
  
  events_agg: {
    type: eventsAggSchema,
    required: true,
  },
  
  raw_samples_optional: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  
  _profiler: {
    type: profilerSchema,
    required: true,
  },
}, {
  timestamps: true,
  strict: true,
});

// Indexes for efficient queries
aggregatedInteractionBatchSchema.index({ userId: 1, captured_at: -1 });
aggregatedInteractionBatchSchema.index({ userId: 1, 'page_context.domain': 1 });
aggregatedInteractionBatchSchema.index({ captured_at: 1 });

// TTL: Aggregated data expires after 2 years
aggregatedInteractionBatchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

/**
 * Static method to bulk insert batches
 */
aggregatedInteractionBatchSchema.statics.bulkInsertBatches = async function(userId, batches) {
  if (!Array.isArray(batches) || batches.length === 0) {
    throw new Error('batches must be a non-empty array');
  }
  
  // Transform batches to match schema
  const documents = batches.map(batch => ({
    userId,
    batch_id: batch.batch_id,
    captured_at: new Date(batch.captured_at),
    page_context: batch.page_context,
    events_agg: batch.events_agg,
    raw_samples_optional: batch.raw_samples_optional || [],
    _profiler: batch._profiler,
  }));
  
  // Use insertMany for efficient bulk insert (ignore duplicates)
  const result = await this.insertMany(documents, { 
    ordered: false, // Continue on duplicate key errors
    lean: true,
  }).catch(err => {
    // Handle duplicate key errors gracefully
    if (err.code === 11000) {
      console.warn(`⚠️ Some batches already exist (duplicates ignored)`);
      return { insertedCount: err.result?.nInserted || 0 };
    }
    throw err;
  });
  
  return result;
};

/**
 * Static method to get batches for a user in a time range
 * startDate, endDate: YYYY-MM-DD strings
 * endDate is inclusive (includes full day) - new Date("2025-03-01") is midnight,
 * so we use < start of next day to include all batches on endDate.
 */
aggregatedInteractionBatchSchema.statics.getUserBatches = async function(userId, startDate, endDate) {
  const start = new Date(startDate);
  const endExclusive = new Date(new Date(endDate).getTime() + 86400000); // start of next day
  
  const query = {
    userId,
    captured_at: {
      $gte: start,
      $lt: endExclusive,
    },
  };
  
  return this.find(query).sort({ captured_at: 1 }).lean();
};

/**
 * Static method to get batches for a user in the last 24 hours
 * Used by external components for integration (e.g. ML pipeline, dashboard).
 */
aggregatedInteractionBatchSchema.statics.getUserBatchesLast24h = async function(userId) {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const query = {
    userId,
    captured_at: {
      $gte: twentyFourHoursAgo,
      $lte: now,
    },
  };

  return this.find(query).sort({ captured_at: 1 }).lean();
};

/**
 * Static method to get aggregated statistics for a user
 */
aggregatedInteractionBatchSchema.statics.getUserAggregatedStats = async function(userId, startDate, endDate) {
  const batches = await this.getUserBatches(userId, startDate, endDate);
  
  if (batches.length === 0) {
    return null;
  }
  
  // Compute overall statistics
  const totalClicks = batches.reduce((sum, b) => sum + b.events_agg.click_count, 0);
  const avgMisclickRate = batches.reduce((sum, b) => sum + b.events_agg.misclick_rate, 0) / batches.length;
  const avgClickInterval = batches.reduce((sum, b) => sum + b.events_agg.avg_click_interval_ms, 0) / batches.length;
  const avgDwell = batches.reduce((sum, b) => sum + b.events_agg.avg_dwell_ms, 0) / batches.length;
  const totalRageClicks = batches.reduce((sum, b) => sum + b.events_agg.rage_clicks, 0);
  const totalZoomEvents = batches.reduce((sum, b) => sum + b.events_agg.zoom_events, 0);
  const avgScrollSpeed = batches.reduce((sum, b) => sum + b.events_agg.scroll_speed_px_s, 0) / batches.length;
  const avgSamplingHz = batches.reduce((sum, b) => sum + b._profiler.sampling_hz, 0) / batches.length;
  const avgInputLag = batches.reduce((sum, b) => sum + b._profiler.input_lag_ms_est, 0) / batches.length;
  
  return {
    userId,
    period: { start: startDate, end: endDate },
    batchCount: batches.length,
    totalClicks,
    avgMisclickRate: parseFloat(avgMisclickRate.toFixed(3)),
    avgClickInterval: Math.round(avgClickInterval),
    avgDwell: Math.round(avgDwell),
    totalRageClicks,
    totalZoomEvents,
    avgScrollSpeed: Math.round(avgScrollSpeed),
    avgSamplingHz: Math.round(avgSamplingHz),
    avgInputLag: Math.round(avgInputLag),
  };
};

module.exports = mongoose.model('AggregatedInteractionBatch', aggregatedInteractionBatchSchema);

