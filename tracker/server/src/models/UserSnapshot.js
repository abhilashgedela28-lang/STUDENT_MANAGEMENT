const mongoose = require('mongoose');

const userSnapshotSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  platform: {
    type: String,
    enum: ['LEETCODE', 'CODEFORCES'],
    required: true,
  },
  snapshotDate: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  totalSolved: {
    type: Number,
    default: 0,
  },
  easy: {
    type: Number,
    default: 0,
  },
  medium: {
    type: Number,
    default: 0,
  },
  hard: {
    type: Number,
    default: 0,
  },
  rating: {
    type: Number,
    default: 0,
  },
  contests: {
    type: Number,
    default: 0,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

userSnapshotSchema.index({ user: 1, platform: 1, snapshotDate: 1 }, { unique: true });
userSnapshotSchema.index({ user: 1, snapshotDate: 1 });

module.exports = mongoose.model('UserSnapshot', userSnapshotSchema);
