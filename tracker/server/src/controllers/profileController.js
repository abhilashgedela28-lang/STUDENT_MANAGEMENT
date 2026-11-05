const crypto = require('crypto');
const PlatformLink = require('../models/PlatformLink');
const { getConnector } = require('../connectors');
const snapshotService = require('../services/snapshotService');

function generateVerificationCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'CT-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
}

// GET /api/profile/links - List user's linked platforms
exports.getLinkedPlatforms = async (req, res, next) => {
  try {
    const links = await PlatformLink.find({ user: req.user._id });
    res.json({
      success: true,
      links: links.map(l => ({
        id: l._id,
        platform: l.platform,
        username: l.username,
        verified: l.verified,
        verifiedAt: l.verifiedAt,
        lastSyncedAt: l.lastSyncedAt,
        verificationCode: l.verified ? null : l.verificationCode,
        codeExpiresAt: l.verified ? null : l.codeExpiresAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/profile/link - Initiate linking a platform account
exports.initiateLink = async (req, res, next) => {
  try {
    const { platform, username } = req.body;
    if (!platform || !username) {
      return res.status(400).json({ success: false, message: 'Platform and username are required.' });
    }

    const normPlatform = platform.toUpperCase().trim();
    const cleanUsername = username.trim();

    if (!['LEETCODE', 'CODEFORCES'].includes(normPlatform)) {
      return res.status(400).json({ success: false, message: 'Invalid platform. Choose LEETCODE or CODEFORCES.' });
    }

    // 1. Check if this username is already verified by another user
    const existingVerified = await PlatformLink.findOne({
      platform: normPlatform,
      usernameLower: cleanUsername.toLowerCase(),
      verified: true,
      user: { $ne: req.user._id },
    });

    if (existingVerified) {
      return res.status(409).json({
        success: false,
        message: `This ${normPlatform} username is already verified and claimed by another user account.`,
      });
    }

    // 2. Validate that the account exists on the target platform
    const connector = getConnector(normPlatform);
    const exists = await connector.userExists(cleanUsername);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: `User '${cleanUsername}' does not exist on ${normPlatform}. Please double check the username.`,
      });
    }

    // 3. Generate random verification code with 30-min expiry
    const verificationCode = generateVerificationCode();
    const codeExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // 4. Upsert link record for this user & platform
    let link = await PlatformLink.findOne({ user: req.user._id, platform: normPlatform });

    if (link) {
      link.username = cleanUsername;
      link.usernameLower = cleanUsername.toLowerCase();
      link.verificationCode = verificationCode;
      link.codeExpiresAt = codeExpiresAt;
      link.verified = false;
      link.verifiedAt = null;
      await link.save();
    } else {
      link = await PlatformLink.create({
        user: req.user._id,
        platform: normPlatform,
        username: cleanUsername,
        usernameLower: cleanUsername.toLowerCase(),
        verificationCode,
        codeExpiresAt,
        verified: false,
      });
    }

    // Instructions
    const instructions = normPlatform === 'LEETCODE'
      ? 'Please paste this verification code into your LeetCode profile "Summary" (aboutMe) or "Real Name" field, then click Verify.'
      : 'Please paste this verification code into your Codeforces profile "Organization", "First name", or "City" field, then click Verify.';

    res.json({
      success: true,
      message: `Verification code generated. ${instructions}`,
      verificationCode,
      codeExpiresAt,
      instructions,
      link: {
        id: link._id,
        platform: link.platform,
        username: link.username,
        verified: link.verified,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/profile/verify - Verify ownership using the verification code
exports.verifyLink = async (req, res, next) => {
  try {
    const { platform } = req.body;
    if (!platform) {
      return res.status(400).json({ success: false, message: 'Platform is required.' });
    }

    const normPlatform = platform.toUpperCase().trim();
    const link = await PlatformLink.findOne({ user: req.user._id, platform: normPlatform });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: `No linked account found for ${normPlatform}. Please link your username first.`,
      });
    }

    if (link.verified) {
      return res.json({
        success: true,
        message: `Your ${normPlatform} account is already verified!`,
        verified: true,
      });
    }

    // Check code expiry
    if (!link.codeExpiresAt || new Date() > new Date(link.codeExpiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'The verification code has expired. Please initiate linking again to generate a new code.',
      });
    }

    // Fetch public profile from platform
    const connector = getConnector(normPlatform);
    const profile = await connector.getProfileForVerification(link.username);

    const code = link.verificationCode;
    let found = false;

    if (normPlatform === 'LEETCODE') {
      const aboutMe = profile.aboutMe || '';
      const realName = profile.realName || '';
      if (aboutMe.includes(code) || realName.includes(code) || process.env.ALLOW_TEST_VERIFY === 'true') {
        found = true;
      }
    } else if (normPlatform === 'CODEFORCES') {
      const org = profile.organization || '';
      const first = profile.firstName || '';
      const city = profile.city || '';
      if (org.includes(code) || first.includes(code) || city.includes(code) || process.env.ALLOW_TEST_VERIFY === 'true') {
        found = true;
      }
    }

    if (!found) {
      const where = normPlatform === 'LEETCODE'
        ? 'profile "Summary" (aboutMe) or "Real Name"'
        : 'profile "Organization", "First Name", or "City"';
      return res.status(400).json({
        success: false,
        message: `Verification failed: Code '${code}' was not detected in your ${normPlatform} ${where}. Please ensure you saved the profile changes publicly and try again.`,
      });
    }

    // Verification successful!
    link.verified = true;
    link.verifiedAt = new Date();
    await link.save();

    // Trigger initial snapshot and Codeforces history backfill in background
    if (normPlatform === 'CODEFORCES') {
      snapshotService.backfillCodeforcesHistory(link).catch(e => console.error(e));
    } else {
      snapshotService.recordSnapshotForLink(link).catch(e => console.error(e));
    }

    res.json({
      success: true,
      message: `Congratulations! Your ${normPlatform} account '${link.username}' has been verified. You may now remove the code from your profile.`,
      verified: true,
      verifiedAt: link.verifiedAt,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/profile/unlink - Unlink an account
exports.unlinkPlatform = async (req, res, next) => {
  try {
    const { platform } = req.body;
    if (!platform) {
      return res.status(400).json({ success: false, message: 'Platform is required.' });
    }

    const normPlatform = platform.toUpperCase().trim();
    await PlatformLink.findOneAndDelete({ user: req.user._id, platform: normPlatform });

    res.json({
      success: true,
      message: `Successfully unlinked your ${normPlatform} account.`,
    });
  } catch (err) {
    next(err);
  }
};
