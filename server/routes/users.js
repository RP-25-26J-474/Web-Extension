const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');

const PUBLIC_USER_FIELDS =
  '_id name email age gender consentGiven trackingEnabled createdAt lastLogin';

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function normalizeUser(user) {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    age: user.age,
    gender: user.gender,
    consentGiven: user.consentGiven,
    trackingEnabled: user.trackingEnabled,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
}

router.get('/', async (req, res) => {
  try {
    const hasLimit = req.query.limit != null;
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = hasLimit ? parsePositiveInt(req.query.limit, 100, 500) : null;
    const skip = limit == null ? 0 : (page - 1) * limit;

    let usersQuery = User.find({})
      .select(PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    if (limit != null) {
      usersQuery = usersQuery.skip(skip).limit(limit);
    }

    const [users, total] = await Promise.all([
      usersQuery,
      User.countDocuments({}),
    ]);

    res.json({
      users: users.map(normalizeUser),
      pagination: {
        page,
        limit: limit ?? total,
        total,
        pages: limit == null ? 1 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await User.findById(userId).select(PUBLIC_USER_FIELDS).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: normalizeUser(user) });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
