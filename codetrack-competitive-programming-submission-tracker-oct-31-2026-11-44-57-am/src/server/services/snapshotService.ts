import { db } from '../db.js';
import { Platform } from '../types.js';
import { leetcodeConnector } from '../connectors/leetcode.js';
import { codeforcesConnector } from '../connectors/codeforces.js';

export class SnapshotService {
  public async recordSnapshotForUserPlatform(userId: string, platform: Platform) {
    const link = db.getLink(userId, platform);
    if (!link || !link.verified) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const stats =
        platform === 'LEETCODE'
          ? await leetcodeConnector.fetchStats(link.username)
          : await codeforcesConnector.fetchStats(link.username);

      db.saveSnapshot({
        userId,
        platform,
        snapshotDate: today,
        totalSolved: stats.totalSolved,
        easy: stats.easy,
        medium: stats.medium,
        hard: stats.hard,
        rating: stats.rating,
        contests: stats.contests
      });
    } catch (err) {
      console.warn(`Could not record snapshot for user ${userId} on ${platform}:`, err);
    }
  }

  public async backfillCodeforcesHistory(userId: string, username: string) {
    try {
      const [submissions, ratingHistory] = await Promise.all([
        codeforcesConnector.fetchRecentSubmissions(username),
        codeforcesConnector.fetchRatingHistory(username)
      ]);

      // Group accepted submissions by date
      const dateMap = new Map<string, { total: number; easy: number; medium: number; hard: number }>();
      submissions.sort((a, b) => a.timestamp - b.timestamp);

      let cumulativeEasy = 0;
      let cumulativeMed = 0;
      let cumulativeHard = 0;

      for (const sub of submissions) {
        const dateStr = new Date(sub.timestamp * 1000).toISOString().split('T')[0];
        const parts = sub.identifier.split('_');
        const idx = parts[1] || 'A';
        if (idx === 'A' || idx === 'B') cumulativeEasy++;
        else if (idx === 'C' || idx === 'D') cumulativeMed++;
        else cumulativeHard++;

        dateMap.set(dateStr, {
          total: cumulativeEasy + cumulativeMed + cumulativeHard,
          easy: cumulativeEasy,
          medium: cumulativeMed,
          hard: cumulativeHard
        });
      }

      // Map rating changes to date
      const ratingMap = new Map<string, number>();
      for (const change of ratingHistory) {
        const dateStr = new Date(change.ratingUpdateTimeSeconds * 1000).toISOString().split('T')[0];
        ratingMap.set(dateStr, change.newRating);
      }

      // Save snapshots (sample reasonable density so we don't spam thousands of records)
      const sortedDates = Array.from(dateMap.keys()).sort();
      for (let i = 0; i < sortedDates.length; i++) {
        // Sample every 5th date or last 30 dates
        if (i % 5 === 0 || i >= sortedDates.length - 30) {
          const d = sortedDates[i];
          const data = dateMap.get(d)!;
          db.saveSnapshot({
            userId,
            platform: 'CODEFORCES',
            snapshotDate: d,
            totalSolved: data.total,
            easy: data.easy,
            medium: data.medium,
            hard: data.hard,
            rating: ratingMap.get(d)
          });
        }
      }
    } catch (err) {
      console.warn('Codeforces history backfill error:', err);
    }
  }

  public async runSnapshotsForAllVerifiedUsers(): Promise<{ processedUsers: number; errors: number }> {
    const users = db.getAllUsers();
    let processed = 0;
    let errors = 0;

    for (const u of users) {
      const links = db.getLinksForUser(u.id).filter(l => l.verified);
      for (const link of links) {
        try {
          await this.recordSnapshotForUserPlatform(u.id, link.platform);
          processed++;
        } catch {
          errors++;
        }
      }
    }

    return { processedUsers: processed, errors };
  }

  public calculateStreaks(activityDates: string[]): { currentStreak: number; longestStreak: number } {
    if (activityDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const uniqueDates = Array.from(new Set(activityDates)).sort();
    let longest = 0;
    let current = 0;
    let tempStreak = 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(uniqueDates[i - 1]).getTime();
        const curr = new Date(uniqueDates[i]).getTime();
        const diffDays = Math.round((curr - prev) / 86400000);
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longest) longest = tempStreak;
    }

    // Current streak calculation
    const hasToday = uniqueDates.includes(today);
    const hasYesterday = uniqueDates.includes(yesterday);

    if (hasToday || hasYesterday) {
      let checkDate = hasToday ? new Date(today) : new Date(yesterday);
      let count = 0;
      while (true) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (uniqueDates.includes(dStr)) {
          count++;
          checkDate = new Date(checkDate.getTime() - 86400000);
        } else {
          break;
        }
      }
      current = count;
    }

    return { currentStreak: current, longestStreak: longest };
  }
}

export const snapshotService = new SnapshotService();
