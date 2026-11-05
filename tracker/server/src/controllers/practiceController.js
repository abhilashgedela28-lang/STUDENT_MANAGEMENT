const Problem = require('../models/Problem');
const UserProblemStatus = require('../models/UserProblemStatus');
const PlatformLink = require('../models/PlatformLink');
const syncService = require('../services/syncService');

// GET /api/practice - List problems with filters and pagination
exports.getProblems = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const { platform, difficulty, topic, status, search } = req.query;

    const query = { active: true };
    if (platform && platform !== 'ALL') {
      query.platform = platform.toUpperCase();
    }
    if (difficulty && difficulty !== 'ALL') {
      // Regex match for difficulty (handles "Easy", "Medium (1400)", etc.)
      query.difficulty = new RegExp(`^${difficulty}`, 'i');
    }
    if (topic && topic !== 'ALL') {
      query.topics = topic;
    }
    if (search) {
      const s = search.trim();
      query.$or = [
        { title: new RegExp(s, 'i') },
        { externalId: new RegExp(s, 'i') },
      ];
    }

    // Retrieve user statuses
    const userStatuses = await UserProblemStatus.find({ user: req.user._id });
    const userStatusMap = new Map();
    userStatuses.forEach(s => userStatusMap.set(s.problem.toString(), s));

    let problems = await Problem.find(query).sort({ createdAt: -1 });

    // Filter by user solve status if requested
    if (status && status !== 'ALL') {
      problems = problems.filter(p => {
        const s = userStatusMap.get(p._id.toString());
        const currentStatus = s ? s.status : 'UNSOLVED';
        return currentStatus === status.toUpperCase();
      });
    }

    const total = problems.length;
    const paginatedProblems = problems.slice(skip, skip + limit);

    // Get verified links for UI guidance
    const links = await PlatformLink.find({ user: req.user._id, verified: true });
    const verifiedPlatforms = links.map(l => l.platform);

    const cooldownRemaining = await syncService.getSyncCooldownRemaining(req.user._id);

    const items = paginatedProblems.map(p => {
      const s = userStatusMap.get(p._id.toString());
      return {
        id: p._id,
        platform: p.platform,
        externalId: p.externalId,
        title: p.title,
        url: p.url,
        difficulty: p.difficulty,
        topics: p.topics,
        status: s ? s.status : 'UNSOLVED',
        startedAt: s ? s.startedAt : null,
        solvedAt: s ? s.solvedAt : null,
        isPlatformVerified: verifiedPlatforms.includes(p.platform),
      };
    });

    // Also get all distinct topics for filter dropdown
    const allTopics = await Problem.distinct('topics', { active: true });

    res.json({
      success: true,
      problems: items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      allTopics,
      cooldownRemaining,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/practice/:id/solve - Mark problem as STARTED when user clicks Solve
exports.startProblem = async (req, res, next) => {
  const tryStart = async (retried = false) => {
    try {
      const problemId = req.params.id;
      const problem = await Problem.findById(problemId);
      if (!problem) {
        return res.status(404).json({ success: false, message: 'Problem not found.' });
      }

      let status = await UserProblemStatus.findOne({ user: req.user._id, problem: problemId });
      if (!status) {
        status = await UserProblemStatus.create({
          user: req.user._id,
          problem: problemId,
          status: 'STARTED',
          startedAt: new Date(),
        });
      } else if (status.status === 'UNSOLVED') {
        status.status = 'STARTED';
        status.startedAt = status.startedAt || new Date();
        await status.save();
      }

      return res.json({
        success: true,
        url: problem.url,
        status: status.status,
        startedAt: status.startedAt,
      });
    } catch (err) {
      if (!retried && (err.name === 'MongoNetworkError' || err.message?.includes('ECONNRESET'))) {
        await new Promise(r => setTimeout(r, 600));
        return tryStart(true);
      }
      throw err;
    }
  };

  try {
    await tryStart();
  } catch (err) {
    next(err);
  }
};

// POST /api/practice/sync - Sync problem(s)
exports.syncProblems = async (req, res, next) => {
  try {
    const { platform = 'ALL', problemId = null } = req.body;
    const result = await syncService.syncUserProblems(req.user._id, platform, problemId);
    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        remainingSeconds: err.remainingSeconds || null,
        requiresLink: err.requiresLink || false,
      });
    }
    next(err);
  }
};
