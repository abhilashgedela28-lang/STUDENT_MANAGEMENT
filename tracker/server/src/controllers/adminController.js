const Problem = require('../models/Problem');
const User = require('../models/User');
const PlatformLink = require('../models/PlatformLink');
const { getConnector } = require('../connectors');
const snapshotService = require('../services/snapshotService');

/**
 * Parse problem URL to extract platform and externalId.
 * Supports:
 * - LeetCode: https://leetcode.com/problems/<titleSlug>/...
 * - Codeforces: https://codeforces.com/problemset/problem/<contestId>/<index>
 * - Codeforces contest: https://codeforces.com/contest/<contestId>/problem/<index>
 */
function parseProblemUrl(rawUrl) {
  const url = String(rawUrl).trim();

  // LeetCode matching
  const lcMatch = url.match(/leetcode\.com\/problems\/([a-zA-Z0-9_-]+)/i);
  if (lcMatch) {
    return {
      platform: 'LEETCODE',
      externalId: lcMatch[1].toLowerCase(),
      cleanUrl: `https://leetcode.com/problems/${lcMatch[1].toLowerCase()}/`,
    };
  }

  // Codeforces problemset matching
  const cfMatch1 = url.match(/codeforces\.com\/problemset\/problem\/(\d+)\/([a-zA-Z0-9]+)/i);
  if (cfMatch1) {
    const contestId = cfMatch1[1];
    const index = cfMatch1[2].toUpperCase();
    return {
      platform: 'CODEFORCES',
      externalId: `${contestId}${index}`,
      cleanUrl: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    };
  }

  // Codeforces contest matching
  const cfMatch2 = url.match(/codeforces\.com\/contest\/(\d+)\/problem\/([a-zA-Z0-9]+)/i);
  if (cfMatch2) {
    const contestId = cfMatch2[1];
    const index = cfMatch2[2].toUpperCase();
    return {
      platform: 'CODEFORCES',
      externalId: `${contestId}${index}`,
      cleanUrl: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    };
  }

  return null;
}

// POST /api/admin/problems/preview - Parse URL and auto-fetch metadata
exports.previewProblemUrl = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'Problem URL is required.' });
    }

    const parsed = parseProblemUrl(url);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported URL format. Must be a valid LeetCode or Codeforces problem URL.',
      });
    }

    // Check if problem already exists
    const existing = await Problem.findOne({ platform: parsed.platform, externalId: parsed.externalId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `This problem already exists in CodeTrack (Title: "${existing.title}").`,
        problem: existing,
      });
    }

    // Attempt auto-fetching metadata from platform
    let metadata = {
      title: parsed.externalId,
      difficulty: 'Medium',
      topics: [],
      url: parsed.cleanUrl,
    };

    try {
      const connector = getConnector(parsed.platform);
      const fetched = await connector.getProblemMetadata(parsed.externalId);
      if (fetched) {
        metadata = { ...metadata, ...fetched };
      }
    } catch (fetchErr) {
      console.warn(`[Admin Preview] Auto-fetch metadata failed for ${parsed.platform} ${parsed.externalId}: ${fetchErr.message}`);
    }

    res.json({
      success: true,
      platform: parsed.platform,
      externalId: parsed.externalId,
      url: metadata.url || parsed.cleanUrl,
      title: metadata.title,
      difficulty: metadata.difficulty,
      topics: metadata.topics,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/problems - Create a new problem
exports.createProblem = async (req, res, next) => {
  try {
    const { platform, externalId, title, url, difficulty, topics, active = true } = req.body;

    if (!platform || !externalId || !title || !url || !difficulty) {
      return res.status(400).json({
        success: false,
        message: 'Platform, externalId, title, url, and difficulty are required.',
      });
    }

    const normPlatform = platform.toUpperCase().trim();
    const existing = await Problem.findOne({ platform: normPlatform, externalId: externalId.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Problem with externalId '${externalId}' already exists for ${normPlatform}.`,
      });
    }

    const problem = await Problem.create({
      platform: normPlatform,
      externalId: externalId.trim(),
      title: title.trim(),
      url: url.trim(),
      difficulty: difficulty.trim(),
      topics: Array.isArray(topics) ? topics : (topics ? topics.split(',').map(t => t.trim()) : []),
      active: active !== false,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Problem added successfully.',
      problem,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/problems/bulk - Bulk add problems from textarea (one URL per line)
exports.bulkAddProblems = async (req, res, next) => {
  try {
    const { urlsText } = req.body;
    if (!urlsText) {
      return res.status(400).json({ success: false, message: 'Please provide URLs (one per line).' });
    }

    const lines = urlsText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const report = {
      total: lines.length,
      added: [],
      duplicates: [],
      failed: [],
    };

    for (const line of lines) {
      const parsed = parseProblemUrl(line);
      if (!parsed) {
        report.failed.push({ url: line, reason: 'Invalid or unsupported URL' });
        continue;
      }

      const existing = await Problem.findOne({ platform: parsed.platform, externalId: parsed.externalId });
      if (existing) {
        report.duplicates.push({ url: line, title: existing.title, externalId: parsed.externalId });
        continue;
      }

      try {
        const connector = getConnector(parsed.platform);
        let meta = { title: parsed.externalId, difficulty: 'Medium', topics: [] };
        try {
          const fetched = await connector.getProblemMetadata(parsed.externalId);
          if (fetched) meta = fetched;
        } catch (e) {
          // fallback meta
        }

        const prob = await Problem.create({
          platform: parsed.platform,
          externalId: parsed.externalId,
          title: meta.title || parsed.externalId,
          url: meta.url || parsed.cleanUrl,
          difficulty: meta.difficulty || 'Medium',
          topics: meta.topics || [],
          active: true,
          createdBy: req.user._id,
        });

        report.added.push({ id: prob._id, title: prob.title, platform: prob.platform });
      } catch (saveErr) {
        report.failed.push({ url: line, reason: saveErr.message });
      }
    }

    res.json({
      success: true,
      report,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/problems - List all problems for admin management
exports.listProblems = async (req, res, next) => {
  try {
    const { search, platform, difficulty } = req.query;
    const query = {};

    if (platform && platform !== 'ALL') query.platform = platform.toUpperCase();
    if (difficulty && difficulty !== 'ALL') query.difficulty = new RegExp(`^${difficulty}`, 'i');
    if (search) {
      query.$or = [
        { title: new RegExp(search.trim(), 'i') },
        { externalId: new RegExp(search.trim(), 'i') },
      ];
    }

    const problems = await Problem.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: problems.length, problems });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/problems/:id - Edit a problem
exports.updateProblem = async (req, res, next) => {
  try {
    const { title, difficulty, topics, active, url } = req.body;
    const problem = await Problem.findById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found.' });
    }

    if (title !== undefined) problem.title = title.trim();
    if (difficulty !== undefined) problem.difficulty = difficulty.trim();
    if (url !== undefined) problem.url = url.trim();
    if (active !== undefined) problem.active = active;
    if (topics !== undefined) {
      problem.topics = Array.isArray(topics) ? topics : topics.split(',').map(t => t.trim());
    }

    await problem.save();
    res.json({ success: true, message: 'Problem updated.', problem });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/problems/:id - Delete a problem
exports.deleteProblem = async (req, res, next) => {
  try {
    const problem = await Problem.findByIdAndDelete(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found.' });
    }
    res.json({ success: true, message: 'Problem deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users - List users with linked platforms
exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const userIds = users.map(u => u._id);

    const links = await PlatformLink.find({ user: { $in: userIds } });
    const linksByUser = new Map();
    links.forEach(l => {
      const uid = l.user.toString();
      if (!linksByUser.has(uid)) linksByUser.set(uid, []);
      linksByUser.get(uid).push({
        platform: l.platform,
        username: l.username,
        verified: l.verified,
        lastSyncedAt: l.lastSyncedAt,
      });
    });

    const userList = users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      platforms: linksByUser.get(u._id.toString()) || [],
    }));

    res.json({ success: true, users: userList });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/snapshots/trigger - Manually trigger snapshot job
exports.triggerSnapshot = async (req, res, next) => {
  try {
    const result = await snapshotService.snapshotAllVerifiedUsers();
    res.json({
      success: true,
      message: 'Snapshot job completed.',
      result,
    });
  } catch (err) {
    next(err);
  }
};
