const NodeCache = require('node-cache');
const PlatformLink = require('../models/PlatformLink');
const Problem = require('../models/Problem');
const UserProblemStatus = require('../models/UserProblemStatus');
const DailySyncCounter = require('../models/DailySyncCounter');
const SyncLog = require('../models/SyncLog');
const { getConnector } = require('../connectors');
const { PlatformError } = require('../connectors/errors');
const snapshotService = require('./snapshotService');
const config = require('../config/config');

// 90-second cache of fetched submission lists per (platform + username)
const submissionListCache = new NodeCache({ stdTTL: 90, checkperiod: 30 });

// In-memory active sync locks per userId to prevent double-click race conditions
const activeSyncLocks = new Set();

class SyncService {
  /**
   * Perform synchronized check for a user across one or all platforms.
   * @param {string} userId
   * @param {string} targetPlatform - 'LEETCODE' | 'CODEFORCES' | 'ALL'
   * @param {string} [specificProblemId] - optional single problem ID
   */
  async syncUserProblems(userId, targetPlatform = 'ALL', specificProblemId = null) {
    const today = new Date().toISOString().split('T')[0];

    // 1. Lock check: prevent concurrent syncs for the same user
    if (activeSyncLocks.has(userId.toString())) {
      const err = new Error('A sync is already in progress for your account. Please wait.');
      err.statusCode = 409;
      throw err;
    }

    try {
      activeSyncLocks.add(userId.toString());

      // 2. Daily cap check (50 syncs per day)
      let dailyCounter = await DailySyncCounter.findOne({ user: userId, day: today });
      if (!dailyCounter) {
        dailyCounter = new DailySyncCounter({ user: userId, day: today, count: 0 });
      }

      if (dailyCounter.count >= config.syncDailyCap) {
        const err = new Error(`Daily sync quota reached (${config.syncDailyCap}/${config.syncDailyCap}). Try again tomorrow.`);
        err.statusCode = 429;
        throw err;
      }

      // 3. Find verified platform links
      const linkQuery = { user: userId, verified: true };
      if (targetPlatform !== 'ALL') {
        linkQuery.platform = targetPlatform;
      }
      const verifiedLinks = await PlatformLink.find(linkQuery);

      if (verifiedLinks.length === 0) {
        const err = new Error(
          targetPlatform !== 'ALL'
            ? `You have not linked and verified your ${targetPlatform} account yet. Please visit your Profile to link it.`
            : 'No verified platform accounts found. Please link and verify your LeetCode or Codeforces account first.'
        );
        err.statusCode = 400;
        err.requiresLink = true;
        throw err;
      }

      // 4. Cooldown check (45 seconds per user)
      const now = Date.now();
      let mostRecentSync = 0;
      for (const link of verifiedLinks) {
        if (link.lastSyncedAt) {
          const t = new Date(link.lastSyncedAt).getTime();
          if (t > mostRecentSync) mostRecentSync = t;
        }
      }

      const cooldownMs = config.syncCooldownSeconds * 1000;
      if (mostRecentSync > 0 && (now - mostRecentSync) < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - (now - mostRecentSync)) / 1000);
        const err = new Error(`Sync cooldown active. Please wait ${remainingSeconds}s before syncing again.`);
        err.statusCode = 429;
        err.remainingSeconds = remainingSeconds;
        throw err;
      }

      // 5. Gather problems to check
      let problemQuery = { active: true };
      if (targetPlatform !== 'ALL') {
        problemQuery.platform = targetPlatform;
      }
      if (specificProblemId) {
        problemQuery._id = specificProblemId;
      }

      const problems = await Problem.find(problemQuery);
      if (problems.length === 0) {
        return {
          success: true,
          message: 'No active problems to check.',
          problemsChecked: 0,
          newlySolved: 0,
        };
      }

      // Get user's current problem statuses
      const existingStatuses = await UserProblemStatus.find({
        user: userId,
        problem: { $in: problems.map(p => p._id) },
      });
      const statusMap = new Map();
      existingStatuses.forEach(s => statusMap.set(s.problem.toString(), s));

      let totalChecked = 0;
      let newlySolved = 0;
      const resultsByProblem = [];
      const platformErrors = [];

      // 6. Fetch submission lists once per platform (using 90-second cache)
      for (const link of verifiedLinks) {
        const platformProblems = problems.filter(p => p.platform === link.platform);
        if (platformProblems.length === 0) continue;

        const cacheKey = `subs_${link.platform}_${link.username.toLowerCase()}`;
        let submissions = submissionListCache.get(cacheKey);

        if (!submissions) {
          try {
            const connector = getConnector(link.platform);
            submissions = await connector.getAcceptedSubmissions(link.username);
            submissionListCache.set(cacheKey, submissions);
          } catch (fetchErr) {
            console.error(`[Sync] External error fetching ${link.platform} submissions for ${link.username}:`, fetchErr.message);
            platformErrors.push({
              platform: link.platform,
              error: 'Try again in a minute.',
            });
            // Do NOT change any problem status when platform call fails!
            continue;
          }
        }

        // Map external submissions by externalId (case-insensitive for LC slugs & CF contestId+index)
        const subMap = new Map();
        for (const sub of submissions) {
          subMap.set(String(sub.externalId).toLowerCase(), sub);
        }

        // 7. Check problems against submissions
        for (const prob of platformProblems) {
          totalChecked++;
          const currentStatus = statusMap.get(prob._id.toString());
          const alreadySolved = currentStatus && currentStatus.status === 'SOLVED';

          const match = subMap.get(String(prob.externalId).toLowerCase());

          if (match) {
            const solvedDate = match.timestamp ? new Date(match.timestamp) : new Date();
            if (!alreadySolved) {
              await UserProblemStatus.findOneAndUpdate(
                { user: userId, problem: prob._id },
                {
                  status: 'SOLVED',
                  solvedAt: solvedDate,
                  startedAt: currentStatus?.startedAt || solvedDate,
                },
                { upsert: true, new: true }
              );
              newlySolved++;
              resultsByProblem.push({
                problemId: prob._id,
                title: prob.title,
                status: 'SOLVED',
                solvedAt: solvedDate,
                message: 'Solved!',
              });
            } else {
              resultsByProblem.push({
                problemId: prob._id,
                title: prob.title,
                status: 'SOLVED',
                message: 'Already solved.',
              });
            }
          } else {
            // Not found in submissions
            let note = 'Unsolved.';
            if (prob.platform === 'LEETCODE') {
              note = 'Not found in your recent accepted submissions. If you solved it long ago, solve/submit it again, then Sync.';
            }
            resultsByProblem.push({
              problemId: prob._id,
              title: prob.title,
              status: currentStatus ? currentStatus.status : 'UNSOLVED',
              message: note,
            });
          }
        }

        // Update link lastSyncedAt
        link.lastSyncedAt = new Date();
        await link.save();

        // Record progress snapshot after successful sync
        snapshotService.recordSnapshotForLink(link).catch(e => console.error(e));
      }

      // 8. Increment daily sync counter
      dailyCounter.count += 1;
      await dailyCounter.save();

      // 9. Log sync operation
      await SyncLog.create({
        user: userId,
        platform: targetPlatform,
        result: platformErrors.length > 0 && newlySolved === 0 ? 'FAILED' : (platformErrors.length > 0 ? 'PARTIAL' : 'SUCCESS'),
        message: platformErrors.length > 0 ? platformErrors.map(e => `${e.platform}: ${e.error}`).join('; ') : 'Sync completed successfully.',
        problemsChecked: totalChecked,
        problemsSolved: newlySolved,
      });

      return {
        success: true,
        problemsChecked: totalChecked,
        newlySolved,
        results: resultsByProblem,
        platformErrors: platformErrors.length > 0 ? platformErrors : null,
        remainingDailySyncs: config.syncDailyCap - dailyCounter.count,
      };
    } finally {
      activeSyncLocks.delete(userId.toString());
    }
  }

  /**
   * Get user's remaining sync cooldown in seconds.
   */
  async getSyncCooldownRemaining(userId) {
    const links = await PlatformLink.find({ user: userId, verified: true });
    if (!links || links.length === 0) return 0;

    let mostRecent = 0;
    for (const l of links) {
      if (l.lastSyncedAt) {
        const t = new Date(l.lastSyncedAt).getTime();
        if (t > mostRecent) mostRecent = t;
      }
    }

    if (mostRecent === 0) return 0;

    const cooldownMs = config.syncCooldownSeconds * 1000;
    const diff = Date.now() - mostRecent;
    if (diff < cooldownMs) {
      return Math.ceil((cooldownMs - diff) / 1000);
    }
    return 0;
  }
}

module.exports = new SyncService();
