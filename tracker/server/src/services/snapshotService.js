const UserSnapshot = require('../models/UserSnapshot');
const PlatformLink = require('../models/PlatformLink');
const { getConnector } = require('../connectors');

class SnapshotService {
  /**
   * Take a single snapshot for a verified link on a specific date.
   */
  async recordSnapshotForLink(link, snapshotDate = null) {
    if (!link.verified) return null;

    const dateStr = snapshotDate || new Date().toISOString().split('T')[0];

    try {
      const connector = getConnector(link.platform);
      const stats = await connector.getUserStats(link.username);

      const snapshot = await UserSnapshot.findOneAndUpdate(
        {
          user: link.user,
          platform: link.platform,
          snapshotDate: dateStr,
        },
        {
          totalSolved: stats.totalSolved || 0,
          easy: stats.easy || 0,
          medium: stats.medium || 0,
          hard: stats.hard || 0,
          rating: stats.rating || 0,
          contests: stats.contests || 0,
          details: stats.details || {},
        },
        { upsert: true, new: true }
      );

      return snapshot;
    } catch (err) {
      console.error(`[Snapshot] Error snapshotting ${link.platform} for user ${link.user} (${link.username}): ${err.message}`);
      return null;
    }
  }

  /**
   * Backfill Codeforces history on first link so user has instant chart data on Day 1.
   */
  async backfillCodeforcesHistory(link) {
    if (link.platform !== 'CODEFORCES') return;

    try {
      const connector = getConnector('CODEFORCES');
      const stats = await connector.getUserStats(link.username);
      const ratingHistory = stats.details?.ratingHistory || [];

      // Create snapshot entries for past contest dates
      for (const contest of ratingHistory) {
        if (!contest.date) continue;
        const dateStr = contest.date.split('T')[0];

        await UserSnapshot.findOneAndUpdate(
          {
            user: link.user,
            platform: 'CODEFORCES',
            snapshotDate: dateStr,
          },
          {
            rating: contest.rating,
            contests: 1,
            details: { contestName: contest.contestName, rank: contest.rank },
          },
          { upsert: true }
        );
      }

      // Also record today's full snapshot
      await this.recordSnapshotForLink(link);
    } catch (err) {
      console.warn(`[Snapshot] Could not backfill Codeforces history for ${link.username}: ${err.message}`);
    }
  }

  /**
   * Run snapshot job across all verified platform links (triggered by cron or admin).
   */
  async snapshotAllVerifiedUsers() {
    console.log('[Snapshot Scheduler] Starting batch snapshot of all verified links...');
    const verifiedLinks = await PlatformLink.find({ verified: true });
    let successCount = 0;
    let failCount = 0;

    for (const link of verifiedLinks) {
      try {
        const snap = await this.recordSnapshotForLink(link);
        if (snap) successCount++;
        else failCount++;
      } catch (err) {
        failCount++;
      }
    }

    console.log(`[Snapshot Scheduler] Completed batch snapshot: ${successCount} succeeded, ${failCount} failed.`);
    return { successCount, failCount, total: verifiedLinks.length };
  }
}

module.exports = new SnapshotService();
