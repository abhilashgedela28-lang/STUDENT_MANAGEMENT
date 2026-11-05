const mongoose = require('mongoose');
const PlatformLink = require('../models/PlatformLink');
const UserSnapshot = require('../models/UserSnapshot');
const UserProblemStatus = require('../models/UserProblemStatus');
const Problem = require('../models/Problem');

/**
 * Calculate current and longest streak from an array of active dates (YYYY-MM-DD)
 */
function calculateStreaks(dateStrings) {
  if (!dateStrings || dateStrings.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sortedDates = Array.from(new Set(dateStrings)).sort();
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate = null;

  for (const dateStr of sortedDates) {
    const cur = new Date(dateStr);
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((cur - prevDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
    prevDate = cur;
  }

  // Calculate current streak relative to today/yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  const lastActiveDate = new Date(sortedDates[sortedDates.length - 1]);
  lastActiveDate.setHours(0, 0, 0, 0);

  const diffFromToday = Math.round((today - lastActiveDate) / (1000 * 60 * 60 * 24));
  if (diffFromToday <= 1) {
    // Active today or yesterday: count backwards
    let checkDate = new Date(lastActiveDate);
    let idx = sortedDates.length - 1;
    while (idx >= 0) {
      const d = new Date(sortedDates[idx]);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((checkDate - d) / (1000 * 60 * 60 * 24));
      if (diff === 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
        idx--;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak };
}

// GET /api/dashboard - Complete dashboard data
exports.getDashboardData = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Linked Platforms
    const links = await PlatformLink.find({ user: userObjectId });
    const verifiedLinks = links.filter(l => l.verified);

    // 2. Latest Snapshots per platform
    const latestSnapshots = await UserSnapshot.aggregate([
      { $match: { user: userObjectId } },
      { $sort: { snapshotDate: -1 } },
      {
        $group: {
          _id: '$platform',
          latest: { $first: '$$ROOT' },
        },
      },
    ]);

    const statsByPlatform = {};
    for (const item of latestSnapshots) {
      statsByPlatform[item._id] = item.latest;
    }

    // 3. User's internal solved problems
    const solvedRecords = await UserProblemStatus.find({
      user: userObjectId,
      status: 'SOLVED',
    }).populate('problem');

    let internalEasy = 0;
    let internalMedium = 0;
    let internalHard = 0;

    for (const r of solvedRecords) {
      if (r.problem) {
        const d = (r.problem.difficulty || '').toLowerCase();
        if (d.startsWith('easy')) internalEasy++;
        else if (d.startsWith('medium')) internalMedium++;
        else internalHard++;
      }
    }

    // Combined platform totals (from snapshots or internal solved count)
    const lcStats = statsByPlatform['LEETCODE'] || {};
    const cfStats = statsByPlatform['CODEFORCES'] || {};

    const snapshotTotal = (lcStats.totalSolved || 0) + (cfStats.totalSolved || 0);
    const totalSolved = Math.max(snapshotTotal, solvedRecords.length);
    const totalEasy = Math.max((lcStats.easy || 0) + (cfStats.easy || 0), internalEasy);
    const totalMedium = Math.max((lcStats.medium || 0) + (cfStats.medium || 0), internalMedium);
    const totalHard = Math.max((lcStats.hard || 0) + (cfStats.hard || 0), internalHard);

    // 4. Snapshots time series for solved-over-time chart
    const snapshotsHistory = await UserSnapshot.find({ user: userId })
      .sort({ snapshotDate: 1 })
      .limit(100);

    const solvedOverTime = snapshotsHistory.map(s => ({
      date: s.snapshotDate,
      platform: s.platform,
      totalSolved: s.totalSolved,
      rating: s.rating,
    }));

    // 5. Contest Rating Trends
    const cfRatingHistory = cfStats.details?.ratingHistory || [];
    const ratingTrends = {
      codeforces: cfRatingHistory,
      codeforcesCurrent: cfStats.rating || 0,
      codeforcesMax: cfStats.details?.maxRating || 0,
      codeforcesRank: cfStats.details?.rank || 'Unrated',
      leetcodeRating: lcStats.rating || 0,
      leetcodeGlobalRank: lcStats.details?.globalRanking || 0,
      leetcodeContests: lcStats.contests || 0,
    };

    // 6. Codeforces Tag Strengths & Weaknesses
    const tagCounts = cfStats.details?.tagCounts || {};
    const tagArray = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    // 7. Activity Heatmap (Last 365 days)
    // Gather days from LeetCode submissionCalendar & internal solved records
    const activityMap = {};
    const activeDates = [];

    // From LeetCode submission calendar (timestamps in seconds -> count)
    const lcCalendar = lcStats.details?.submissionCalendar || {};
    for (const [timestampSec, count] of Object.entries(lcCalendar)) {
      const d = new Date(parseInt(timestampSec, 10) * 1000).toISOString().split('T')[0];
      activityMap[d] = (activityMap[d] || 0) + parseInt(count, 10);
      activeDates.push(d);
    }

    // From internal solved records
    for (const r of solvedRecords) {
      if (r.solvedAt) {
        const d = new Date(r.solvedAt).toISOString().split('T')[0];
        activityMap[d] = (activityMap[d] || 0) + 1;
        activeDates.push(d);
      }
    }

    // 8. Streak calculation
    const streaks = calculateStreaks(activeDates);

    // Most recent sync time across links
    let lastSyncedAt = null;
    for (const l of verifiedLinks) {
      if (l.lastSyncedAt && (!lastSyncedAt || new Date(l.lastSyncedAt) > new Date(lastSyncedAt))) {
        lastSyncedAt = l.lastSyncedAt;
      }
    }

    res.json({
      success: true,
      hasLinkedPlatforms: verifiedLinks.length > 0,
      platforms: links.map(l => ({
        platform: l.platform,
        username: l.username,
        verified: l.verified,
        lastSyncedAt: l.lastSyncedAt,
      })),
      totals: {
        totalSolved,
        easy: totalEasy,
        medium: totalMedium,
        hard: totalHard,
        internalSolvedCount: solvedRecords.length,
      },
      streaks,
      lastSyncedAt,
      charts: {
        solvedOverTime,
        ratingTrends,
        difficultyBreakdown: {
          easy: totalEasy,
          medium: totalMedium,
          hard: totalHard,
        },
        tagStrengths: tagArray.slice(0, 15),
        activityHistory: activityMap,
      },
    });
  } catch (err) {
    next(err);
  }
};
