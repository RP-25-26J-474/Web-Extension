const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  totalInteractions: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  doubleClicks: {
    type: Number,
    default: 0
  },
  rightClicks: {
    type: Number,
    default: 0
  },
  keystrokes: {
    type: Number,
    default: 0
  },
  mouseMovements: {
    type: Number,
    default: 0
  },
  mouseHovers: {
    type: Number,
    default: 0
  },
  pageViews: {
    type: Number,
    default: 0
  },
  dragAndDrop: {
    type: Number,
    default: 0
  },
  touchEvents: {
    type: Number,
    default: 0
  },
  zoomEvents: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Stats', statsSchema);

