const mongoose = require('mongoose');

const platformLinkSchema = new mongoose.Schema({
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
  username: {
    type: String,
    required: true,
    trim: true,
  },
  usernameLower: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  verificationCode: {
    type: String,
  },
  codeExpiresAt: {
    type: Date,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedAt: {
    type: Date,
  },
  lastSyncedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

platformLinkSchema.pre('validate', function(next) {
  if (this.username) {
    this.usernameLower = this.username.toLowerCase();
  }
  next();
});

// A user can only have one link per platform
platformLinkSchema.index({ user: 1, platform: 1 }, { unique: true });

// A username verified by another user cannot be verified again (partial unique index)
platformLinkSchema.index(
  { platform: 1, usernameLower: 1 },
  { unique: true, partialFilterExpression: { verified: true } }
);

module.exports = mongoose.model('PlatformLink', platformLinkSchema);
