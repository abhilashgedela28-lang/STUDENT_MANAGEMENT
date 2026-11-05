const mongoose = require('mongoose');

const userProblemStatusSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true,
  },
  status: {
    type: String,
    enum: ['UNSOLVED', 'STARTED', 'SOLVED'],
    default: 'UNSOLVED',
  },
  startedAt: {
    type: Date,
  },
  solvedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

userProblemStatusSchema.index({ user: 1, problem: 1 }, { unique: true });
userProblemStatusSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('UserProblemStatus', userProblemStatusSchema);
