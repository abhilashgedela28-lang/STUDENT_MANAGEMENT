const mongoose = require('mongoose');

const dailySyncCounterSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  day: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  count: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

dailySyncCounterSchema.index({ user: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('DailySyncCounter', dailySyncCounterSchema);
