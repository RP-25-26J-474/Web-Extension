const express = require('express');
const router = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL;

// Proxy ML scoring to the internal Python service
router.post('/motor-score', async (req, res) => {
  try {
    if (typeof fetch !== 'function') {
      return res.status(500).json({ error: 'Fetch not available in this Node.js version' });
    }

    const response = await fetch(ML_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || 'ML service error' });
    }

    const result = await response.json();
    return res.json(result);
  } catch (error) {
    console.error('ML proxy error:', error);
    return res.status(500).json({ error: 'Failed to reach ML service' });
  }
});

module.exports = router;
