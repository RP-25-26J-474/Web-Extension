const express = require('express');
const router = express.Router();
const Stats = require('../models/Stats');
const authMiddleware = require('../middleware/auth');

// Get user stats
router.get('/', authMiddleware, async (req, res) => {
  try {
    let stats = await Stats.findOne({ userId: req.userId });
    
    // Create stats if they don't exist
    if (!stats) {
      stats = new Stats({ userId: req.userId });
      await stats.save();
    }
    
    res.json({ stats });
    
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;

