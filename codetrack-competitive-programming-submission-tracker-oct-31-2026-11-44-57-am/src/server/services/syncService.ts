import { db } from '../db.js';
import { Platform } from '../types.js';
import { PlatformSubmission, RateLimitedException, PlatformUnavailableException } from '../connectors/types.js';
import { leetcodeConnector } from '../connectors/leetcode.js';
import { codeforcesConnector } from '../connectors/codeforces.js';
import { snapshotService } from './snapshotService.js';

interface CachedSubmissions {
  timestamp: number;
  submissions: PlatformSubmission[];
}

export class SyncService {
  // 90-second cache per (platform, username)
  private submissionCache = new Map<string, CachedSubmissions>();
  private readonly CACHE_TTL_MS = 90 * 1000;

  // Active sync locks per user to prevent concurrent double-clicks
  private activeSyncLocks = new Set<string>();

  // Global outgoing throttles
  private lastLeetCodeCall = 0;
  private lastCodeforcesCall = 0;
  private readonly LEETCODE_MIN_INTERVAL_MS = 1000; // 1.0 second
  private readonly CODEFORCES_MIN_INTERVAL_MS = 2100; // 2.1 seconds

  private async throttle(platform: Platform) {
    const now = Date.now();
    if (platform === 'LEETCODE') {
      const wait = this.LEETCODE_MIN_INTERVAL_MS - (now - this.lastLeetCodeCall);
      if (wait > 0) {
        await new Promise(res => setTimeout(res, wait));
      }
      this.lastLeetCodeCall = Date.now();
    } else {
      const wait = this.CODEFORCES_MIN_INTERVAL_MS - (now - this.lastCodeforcesCall);
      if (wait > 0) {
        await new Promise(res => setTimeout(res, wait));
      }
      this.lastCodeforcesCall = Date.now();
    }
  }

  public getRemainingCooldown(userId: string): number {
    const links = db.getLinksForUser(userId);
    let latestSync = 0;
    for (const link of links) {
      if (link.lastSyncedAt) {
        const time = new Date(link.lastSyncedAt).getTime();
        if (time > latestSync) latestSync = time;
      }
    }
    const elapsed = Date.now() - latestSync;
    const cooldownMs = 45 * 1000;
    if (elapsed < cooldownMs) {
      return Math.ceil((cooldownMs - elapsed) / 1000);
    }
    return 0;
  }

  public async syncUserSubmissions(userId: string, targetProblemId?: string): Promise<{
    success: boolean;
    totalChecked: number;
    newlySolved: string[];
    message: string;
    remainingCooldown: number;
  }> {
    // 1. Lock check to prevent concurrent double clicks
    if (this.activeSyncLocks.has(userId)) {
      throw new Error('A sync operation is already in progress for your account. Please wait.');
    }

    // 2. Cooldown check (45 seconds)
    const remainingSeconds = this.getRemainingCooldown(userId);
    if (remainingSeconds > 0) {
      const err: any = new Error(`Rate limit cooldown: Please wait ${remainingSeconds}s before syncing again.`);
      err.status = 429;
      err.remainingSeconds = remainingSeconds;
      throw err;
    }

    // 3. Daily quota check (50 syncs / day)
    const today = new Date().toISOString().split('T')[0];
    const dailyCount = db.getDailySyncCount(userId, today);
    if (dailyCount >= 50) {
      const err: any = new Error('Daily sync quota reached (50 syncs per day). Quota resets tomorrow.');
      err.status = 429;
      err.dailyLimitReached = true;
      throw err;
    }

    // Check if user has any verified links
    const userLinks = db.getLinksForUser(userId).filter(l => l.verified);
    if (userLinks.length === 0) {
      throw new Error('You do not have any verified platform accounts. Please link and verify your LeetCode or Codeforces account in your Profile first.');
    }

    // Acquire lock
    this.activeSyncLocks.add(userId);

    try {
      const nowIso = new Date().toISOString();
      const newlySolvedTitles: string[] = [];
      let totalCheckedCount = 0;

      // Get all active problems
      let problemsToCheck = db.getAllProblems().filter(p => p.active);
      if (targetProblemId) {
        problemsToCheck = problemsToCheck.filter(p => p.id === targetProblemId);
      }

      // Check per platform link
      for (const link of userLinks) {
        const platformProblems = problemsToCheck.filter(p => p.platform === link.platform);
        if (platformProblems.length === 0) continue;

        // Fetch submissions using 90s cache or fresh throttled request
        const cacheKey = `${link.platform}_${link.username.toLowerCase()}`;
        const cached = this.submissionCache.get(cacheKey);
        let submissions: PlatformSubmission[];

        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
          submissions = cached.submissions;
        } else {
          await this.throttle(link.platform);
          try {
            if (link.platform === 'LEETCODE') {
              submissions = await leetcodeConnector.fetchRecentSubmissions(link.username);
            } else {
              submissions = await codeforcesConnector.fetchRecentSubmissions(link.username);
            }
            this.submissionCache.set(cacheKey, {
              timestamp: Date.now(),
              submissions
            });
          } catch (fetchErr: unknown) {
            console.error(`Error fetching submissions for ${link.platform}:`, fetchErr);
            if (fetchErr instanceof RateLimitedException) {
              throw new Error(`${link.platform} rate limit encountered. Try again in a minute.`);
            }
            throw new Error(`Failed to contact ${link.platform}. Your problem statuses were preserved.`);
          }
        }

        // Map submissions by identifier
        const submissionMap = new Map<string, PlatformSubmission>();
        for (const sub of submissions) {
          submissionMap.set(sub.identifier.toLowerCase(), sub);
        }

        // Check each problem against the submission list
        for (const prob of platformProblems) {
          totalCheckedCount++;
          const currentStatus = db.getProblemStatus(userId, prob.id);
          if (currentStatus?.status === 'SOLVED') {
            // Already solved
            continue;
          }

          const match = submissionMap.get(prob.externalId.toLowerCase());
          if (match) {
            const solvedTime = new Date(match.timestamp * 1000).toISOString();
            db.markSolved(userId, prob.id, solvedTime);
            newlySolvedTitles.push(prob.title);
          }
        }

        // Update lastSyncedAt on link
        link.lastSyncedAt = nowIso;
        db.saveLink(link);
      }

      // Record daily counter
      db.incrementDailySyncCount(userId, today);

      // Log sync outcome
      db.addSyncLog({
        userId,
        requestedAt: nowIso,
        result: {
          status: 'SUCCESS',
          message: `Checked ${totalCheckedCount} problems, ${newlySolvedTitles.length} newly marked solved.`,
          newlySolvedCount: newlySolvedTitles.length,
          newlySolvedTitles
        }
      });

      // If new solves were detected, record an updated user snapshot
      if (newlySolvedTitles.length > 0) {
        for (const link of userLinks) {
          snapshotService.recordSnapshotForUserPlatform(userId, link.platform).catch(() => {});
        }
      }

      const message =
        newlySolvedTitles.length > 0
          ? `Synced successfully! Newly solved: ${newlySolvedTitles.join(', ')}`
          : `Sync completed. No new accepted submissions found.`;

      return {
        success: true,
        totalChecked: totalCheckedCount,
        newlySolved: newlySolvedTitles,
        message,
        remainingCooldown: 45
      };
    } finally {
      this.activeSyncLocks.delete(userId);
    }
  }
}

export const syncService = new SyncService();
