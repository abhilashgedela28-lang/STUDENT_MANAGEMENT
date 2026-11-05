const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['LEETCODE', 'CODEFORCES'],
    required: true,
  },
  externalId: {
    type: String,
    required: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
  },
  difficulty: {
    type: String,
    required: true,
    trim: true,
  },
  topics: {
    type: [String],
    default: [],
  },
  active: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

problemSchema.index({ platform: 1, externalId: 1 }, { unique: true });
problemSchema.index({ platform: 1, difficulty: 1, active: 1 });
problemSchema.index({ topics: 1 });

module.exports = mongoose.model('Problem', problemSchema);
