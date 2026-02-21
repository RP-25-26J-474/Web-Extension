const express = require('express');
const router = express.Router();
const Interaction = require('../models/Interaction');
const Stats = require('../models/Stats');
const AggregatedInteractionBatch = require('../models/AggregatedInteractionBatch');
const authMiddleware = require('../middleware/auth');

// Save interactions (batch)
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { interactions } = req.body;
    
    if (!Array.isArray(interactions) || interactions.length === 0) {
      return res.status(400).json({ error: 'Invalid interactions data' });
    }
    
    // Add userId to each interaction
    const interactionsWithUser = interactions.map(interaction => ({
      ...interaction,
      userId: req.userId
    }));
    
    // Insert interactions
    const saved = await Interaction.insertMany(interactionsWithUser);
    
    // Update stats
    const stats = await Stats.findOne({ userId: req.userId });
    if (stats) {
      stats.totalInteractions += interactions.length;
      
      // Update individual counters
      interactions.forEach(interaction => {
        switch (interaction.type) {
          case 'click':
            stats.clicks++;
            break;
          case 'double_click':
            stats.doubleClicks++;
            break;
          case 'right_click':
            stats.rightClicks++;
            break;
          case 'keypress':
            stats.keystrokes++;
            break;
          case 'mouse_move':
          case 'scroll':
            stats.mouseMovements++;
            break;
          case 'mouse_enter':
          case 'mouse_leave':
            stats.mouseHovers++;
            break;
          case 'page_view':
            stats.pageViews++;
            break;
          case 'drag_start':
          case 'drag_end':
          case 'drop':
            stats.dragAndDrop++;
            break;
          case 'touch_start':
          case 'touch_move':
          case 'touch_end':
          case 'swipe':
          case 'pinch':
            stats.touchEvents++;
            break;
          case 'browser_zoom':
          case 'wheel_zoom':
          case 'keyboard_zoom':
          case 'visual_viewport_zoom':
            stats.zoomEvents++;
            break;
        }
      });
      
      stats.lastUpdated = new Date();
      await stats.save();
    }
    
    res.json({
      message: 'Interactions saved successfully',
      count: saved.length
    });
    
  } catch (error) {
    console.error('Save interactions error:', error);
    res.status(500).json({ error: 'Failed to save interactions' });
  }
});

// Get user's interactions (paginated)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const interactions = await Interaction.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip);
    
    const total = await Interaction.countDocuments({ userId: req.userId });
    
    res.json({
      interactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get interactions error:', error);
    res.status(500).json({ error: 'Failed to get interactions' });
  }
});

// Get recent interactions
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const interactions = await Interaction.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(limit);
    
    res.json({ interactions });
    
  } catch (error) {
    console.error('Get recent interactions error:', error);
    res.status(500).json({ error: 'Failed to get recent interactions' });
  }
});

// Clear all user interactions
router.delete('/clear', authMiddleware, async (req, res) => {
  try {
    await Interaction.deleteMany({ userId: req.userId });
    
    // Reset stats
    const stats = await Stats.findOne({ userId: req.userId });
    if (stats) {
      stats.totalInteractions = 0;
      stats.clicks = 0;
      stats.doubleClicks = 0;
      stats.rightClicks = 0;
      stats.keystrokes = 0;
      stats.mouseMovements = 0;
      stats.mouseHovers = 0;
      stats.pageViews = 0;
      stats.dragAndDrop = 0;
      stats.touchEvents = 0;
      stats.zoomEvents = 0;
      stats.lastUpdated = new Date();
      await stats.save();
    }
    
    res.json({ message: 'All interactions cleared successfully' });
    
  } catch (error) {
    console.error('Clear interactions error:', error);
    res.status(500).json({ error: 'Failed to clear interactions' });
  }
});

// ===== AGGREGATED BATCHES ENDPOINTS =====

/**
 * Save aggregated interaction batches (10-second windows)
 * POST /api/interactions/aggregated-batches
 * 
 * Body: {
 *   batches: [
 *     {
 *       batch_id: "b_1_1234567890",
 *       captured_at: "2025-10-06T11:25:00Z",
 *       page_context: { domain: "example.com", route: "/checkout", app_type: "web" },
 *       events_agg: { click_count: 24, misclick_rate: 0.08, ... },
 *       raw_samples_optional: [],
 *       _profiler: { sampling_hz: 30, input_lag_ms_est: 34 }
 *     },
 *     ...
 *   ]
 * }
 */
router.post('/aggregated-batches', authMiddleware, async (req, res) => {
  try {
    const { batches } = req.body;
    
    console.log(`📊 Received aggregated batches request:`, {
      userId: req.userId,
      batchCount: batches?.length || 0,
    });
    
    if (!Array.isArray(batches) || batches.length === 0) {
      console.warn('⚠️ Invalid batches data:', { batches });
      return res.status(400).json({ error: 'Invalid batches data' });
    }
    
    // Validate batch structure
    for (const batch of batches) {
      if (!batch.batch_id || !batch.captured_at || !batch.page_context || !batch.events_agg || !batch._profiler) {
        console.error('❌ Invalid batch structure:', batch);
        return res.status(400).json({ error: 'Invalid batch structure' });
      }
    }
    
    console.log(`💾 Inserting ${batches.length} aggregated batches for user ${req.userId}`);
    
    // Insert batches
    const result = await AggregatedInteractionBatch.bulkInsertBatches(req.userId, batches);
    
    const count = result.length || result.insertedCount || batches.length;
    console.log(`✅ Successfully saved ${count} aggregated batches`);
    
    res.json({
      message: 'Aggregated batches saved successfully',
      count,
    });
    
  } catch (error) {
    console.error('❌ Save aggregated batches error:', error);
    res.status(500).json({ error: 'Failed to save aggregated batches', details: error.message });
  }
});

/**
 * Get aggregated batches for a user in a time range
 * GET /api/interactions/aggregated-batches?start=2025-01-01&end=2025-12-31
 */
router.get('/aggregated-batches', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query parameters required' });
    }
    
    const batches = await AggregatedInteractionBatch.getUserBatches(req.userId, start, end);
    
    res.json({
      batches,
      count: batches.length,
    });
    
  } catch (error) {
    console.error('Get aggregated batches error:', error);
    res.status(500).json({ error: 'Failed to get aggregated batches' });
  }
});

/**
 * Get aggregated statistics for a user
 * GET /api/interactions/aggregated-stats?start=2025-01-01&end=2025-12-31
 */
router.get('/aggregated-stats', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query parameters required' });
    }
    
    const stats = await AggregatedInteractionBatch.getUserAggregatedStats(req.userId, start, end);
    
    if (!stats) {
      return res.json({ message: 'No data found for the specified period' });
    }
    
    res.json({ stats });
    
  } catch (error) {
    console.error('Get aggregated stats error:', error);
    res.status(500).json({ error: 'Failed to get aggregated stats' });
  }
});

/**
 * Export aggregated batches as JSON
 * GET /api/interactions/aggregated-batches/export?start=2025-01-01&end=2025-12-31
 */
router.get('/aggregated-batches/export', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query parameters required' });
    }
    
    const batches = await AggregatedInteractionBatch.getUserBatches(req.userId, start, end);
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="aggregated-batches-${start}-${end}.json"`);
    
    res.json(batches);
    
  } catch (error) {
    console.error('Export aggregated batches error:', error);
    res.status(500).json({ error: 'Failed to export aggregated batches' });
  }
});

module.exports = router;

