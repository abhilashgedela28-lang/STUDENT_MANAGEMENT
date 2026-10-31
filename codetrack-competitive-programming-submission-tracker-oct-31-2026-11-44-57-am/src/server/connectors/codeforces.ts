/**
 * Codeforces Official API Connector
 * Base URL: https://codeforces.com/api/
 *
 * Implements:
 * - user.info: fetch user profile, check verification code in organization, firstName, city
 * - user.rating: fetch contest rating history
 * - user.status: fetch full submission history, filter for verdict OK
 * - problemset.problems: cached lookup for problem details
 */

import {
  PlatformConnector,
  PlatformProfile,
  PlatformSubmission,
  PlatformStats,
  PlatformQuestionDetails,
  PlatformUnavailableException,
  RateLimitedException,
  UserNotFoundException
} from './types.js';

const CODEFORCES_API_BASE = 'https://codeforces.com/api';
const USER_AGENT = 'CodeTrack-Client/1.0 (Mozilla/5.0)';

interface CFResponse<T> {
  status: 'OK' | 'FAILED';
  comment?: string;
  result: T;
}

interface CFUser {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  organization?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
}

interface CFSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  verdict?: string;
  problem: {
    contestId?: number;
    index: string;
    name: string;
    rating?: number;
    tags: string[];
  };
}

interface CFRatingChange {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export class CodeforcesConnector implements PlatformConnector {
  private problemCache: Map<string, { name: string; rating?: number; tags: string[] }> = new Map();
  private lastProblemCacheTime = 0;

  private async fetchAPI<T>(endpoint: string, params: Record<string, string> = {}, retry = true): Promise<T> {
    const url = new URL(`${CODEFORCES_API_BASE}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': USER_AGENT
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new RateLimitedException('Codeforces rate limit exceeded. Please wait a few seconds.');
      }

      if (response.status >= 500) {
        throw new PlatformUnavailableException(`Codeforces API server error (HTTP ${response.status})`);
      }

      const json = (await response.json()) as CFResponse<T>;

      if (json.status !== 'OK') {
        const comment = json.comment || 'Codeforces API error';
        if (comment.toLowerCase().includes('not found') || comment.toLowerCase().includes('no such handle')) {
          throw new UserNotFoundException(comment);
        }
        if (comment.toLowerCase().includes('rate limit') || comment.toLowerCase().includes('call limit')) {
          throw new RateLimitedException(comment);
        }
        throw new PlatformUnavailableException(comment);
      }

      return json.result;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof RateLimitedException || err instanceof UserNotFoundException) {
        throw err;
      }

      if (retry) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        return this.fetchAPI<T>(endpoint, params, false);
      }

      const error = err as Error;
      if (error.name === 'AbortError') {
        throw new PlatformUnavailableException('Codeforces request timed out.');
      }
      throw new PlatformUnavailableException(`Could not reach Codeforces: ${error.message}`);
    }
  }

  public async validateAccount(username: string): Promise<boolean> {
    try {
      const users = await this.fetchAPI<CFUser[]>('user.info', { handles: username });
      return users && users.length > 0;
    } catch (err) {
      if (err instanceof UserNotFoundException) return false;
      throw err;
    }
  }

  public async fetchProfile(username: string): Promise<PlatformProfile> {
    const users = await this.fetchAPI<CFUser[]>('user.info', { handles: username });
    if (!users || users.length === 0) {
      throw new UserNotFoundException(`Codeforces user '${username}' not found.`);
    }

    const user = users[0];
    const fieldsForVerification: string[] = [];
    if (user.organization) fieldsForVerification.push(user.organization);
    if (user.firstName) fieldsForVerification.push(user.firstName);
    if (user.city) fieldsForVerification.push(user.city);
    if (user.lastName) fieldsForVerification.push(user.lastName);

    return {
      username: user.handle,
      fieldsForVerification,
      ranking: user.rating,
      realName: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined
    };
  }

  public async fetchRecentSubmissions(username: string): Promise<PlatformSubmission[]> {
    // Fetch user submissions (count 1000 to cover comprehensive history)
    const submissions = await this.fetchAPI<CFSubmission[]>('user.status', {
      handle: username,
      from: '1',
      count: '1000'
    });

    const acceptedSubmissions: PlatformSubmission[] = [];
    const seenProblems = new Set<string>();

    for (const sub of submissions) {
      if (sub.verdict === 'OK' && sub.problem.contestId) {
        const identifier = `${sub.problem.contestId}_${sub.problem.index.toUpperCase()}`;
        if (!seenProblems.has(identifier)) {
          seenProblems.add(identifier);
          acceptedSubmissions.push({
            id: String(sub.id),
            title: sub.problem.name,
            identifier,
            timestamp: sub.creationTimeSeconds,
            verdict: 'OK'
          });
        }
      }
    }

    return acceptedSubmissions;
  }

  public async fetchRatingHistory(username: string): Promise<CFRatingChange[]> {
    try {
      return await this.fetchAPI<CFRatingChange[]>('user.rating', { handle: username });
    } catch {
      return [];
    }
  }

  public async fetchStats(username: string): Promise<PlatformStats> {
    const [userInfo, submissions, ratingHistory] = await Promise.all([
      this.fetchProfile(username),
      this.fetchRecentSubmissions(username).catch(() => []),
      this.fetchRatingHistory(username)
    ]);

    // Categorize difficulty and tags
    let easy = 0;
    let medium = 0;
    let hard = 0;
    const tagCounts: Record<string, number> = {};
    const submissionCalendar: Record<string, number> = {};

    for (const sub of submissions) {
      // populate calendar day buckets
      const daySeconds = Math.floor(sub.timestamp / 86400) * 86400;
      submissionCalendar[daySeconds] = (submissionCalendar[daySeconds] || 0) + 1;

      // Check rating of problem from cache if known or default estimate
      // In Codeforces: index A/B is usually Easy, C/D Medium, E+ Hard
      const parts = sub.identifier.split('_');
      const index = parts[1] || 'A';
      if (index === 'A' || index === 'B') easy++;
      else if (index === 'C' || index === 'D') medium++;
      else hard++;
    }

    return {
      totalSolved: submissions.length,
      easy,
      medium,
      hard,
      rating: userInfo.ranking,
      contests: ratingHistory.length,
      submissionCalendar,
      tagCounts
    };
  }

  public async fetchQuestion(identifier: string): Promise<PlatformQuestionDetails | null> {
    // identifier format e.g. "4_A" or contestId + index
    const parts = identifier.split('_');
    if (parts.length !== 2) return null;

    const contestId = parts[0];
    const index = parts[1].toUpperCase();

    // Refresh problem cache if empty or older than 1 hour
    if (this.problemCache.size === 0 || Date.now() - this.lastProblemCacheTime > 3600000) {
      try {
        const result = await this.fetchAPI<{
          problems: Array<{ contestId?: number; index: string; name: string; rating?: number; tags: string[] }>;
        }>('problemset.problems');
        for (const p of result.problems) {
          if (p.contestId) {
            this.problemCache.set(`${p.contestId}_${p.index.toUpperCase()}`, {
              name: p.name,
              rating: p.rating,
              tags: p.tags
            });
          }
        }
        this.lastProblemCacheTime = Date.now();
      } catch {
        // Fall back to direct query if problemset fetch fails
      }
    }

    const cached = this.problemCache.get(`${contestId}_${index}`);
    if (cached) {
      let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
      if (cached.rating) {
        if (cached.rating <= 1200) difficulty = 'Easy';
        else if (cached.rating >= 1900) difficulty = 'Hard';
      } else {
        if (index === 'A' || index === 'B') difficulty = 'Easy';
        else if (['E', 'F', 'G', 'H'].includes(index)) difficulty = 'Hard';
      }

      return {
        title: cached.name,
        difficulty,
        topics: cached.tags.length > 0 ? cached.tags : ['implementation']
      };
    }

    // Default fallback if not found in cache
    return {
      title: `Problem ${contestId}${index}`,
      difficulty: index === 'A' || index === 'B' ? 'Easy' : index === 'C' || index === 'D' ? 'Medium' : 'Hard',
      topics: ['implementation']
    };
  }
}

export const codeforcesConnector = new CodeforcesConnector();
