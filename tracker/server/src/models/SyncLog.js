const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  platform: {
    type: String,
    enum: ['LEETCODE', 'CODEFORCES', 'ALL'],
    required: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  result: {
    type: String,
    enum: ['SUCCESS', 'RATE_LIMITED', 'FAILED', 'PARTIAL', 'COOLDOWN'],
    required: true,
  },
  message: {
    type: String,
  },
  problemsChecked: {
    type: Number,
    default: 0,
  },
  problemsSolved: {
    type: Number,
    default: 0,
  },
});

syncLogSchema.index({ user: 1, requestedAt: -1 });

module.exports = mongoose.model('SyncLog', syncLogSchema);
