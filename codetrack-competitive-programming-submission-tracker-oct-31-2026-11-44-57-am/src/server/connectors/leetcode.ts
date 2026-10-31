/**
 * LeetCode Platform Connector
 *
 * NOTE ON LEETCODE API:
 * LeetCode does not have an official public REST API for user profile and submission retrieval.
 * This connector interacts with LeetCode's public GraphQL endpoint at https://leetcode.com/graphql.
 * Because this endpoint is unofficial, LeetCode may alter schema definitions, require Cloudflare challenges,
 * or rate-limit automated requests. Proper headers (User-Agent, Referer) and timeouts are enforced.
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

const LEETCODE_GRAPHQL_ENDPOINT = 'https://leetcode.com/graphql';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class LeetCodeConnector implements PlatformConnector {
  private async executeGraphQL<T>(query: string, variables: Record<string, unknown>, retry = true): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s read timeout

    try {
      const response = await fetch(LEETCODE_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
          Referer: 'https://leetcode.com',
          Origin: 'https://leetcode.com'
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new RateLimitedException('LeetCode rate limit reached. Please wait a moment.');
      }

      if (response.status >= 500) {
        throw new PlatformUnavailableException(`LeetCode server error (HTTP ${response.status})`);
      }

      if (!response.ok) {
        throw new PlatformUnavailableException(`LeetCode request failed with status HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.errors && json.errors.length > 0) {
        const errMsg = json.errors[0]?.message || 'GraphQL error';
        if (errMsg.toLowerCase().includes('rate') || errMsg.toLowerCase().includes('limit')) {
          throw new RateLimitedException(errMsg);
        }
        if (errMsg.toLowerCase().includes('not exist') || errMsg.toLowerCase().includes('user does not exist')) {
          throw new UserNotFoundException(`LeetCode user not found: ${variables.username}`);
        }
      }

      return json.data as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof RateLimitedException || err instanceof UserNotFoundException) {
        throw err;
      }

      // Retry once on network error if enabled
      if (retry) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.executeGraphQL<T>(query, variables, false);
      }

      const error = err as Error;
      if (error.name === 'AbortError') {
        throw new PlatformUnavailableException('LeetCode connection timed out.');
      }
      throw new PlatformUnavailableException(`Could not reach LeetCode: ${error.message}`);
    }
  }

  public async validateAccount(username: string): Promise<boolean> {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
        }
      }
    `;

    try {
      const data = await this.executeGraphQL<{ matchedUser: { username: string } | null }>(query, { username });
      return Boolean(data?.matchedUser?.username);
    } catch (err) {
      if (err instanceof UserNotFoundException) return false;
      throw err;
    }
  }

  public async fetchProfile(username: string): Promise<PlatformProfile> {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            aboutMe
            ranking
          }
        }
      }
    `;

    const data = await this.executeGraphQL<{
      matchedUser: {
        username: string;
        profile: {
          realName: string | null;
          aboutMe: string | null;
          ranking: number | null;
        } | null;
      } | null;
    }>(query, { username });

    if (!data?.matchedUser) {
      throw new UserNotFoundException(`LeetCode user '${username}' does not exist.`);
    }

    const profile = data.matchedUser.profile;
    const fieldsForVerification: string[] = [];
    if (profile?.aboutMe) fieldsForVerification.push(profile.aboutMe);
    if (profile?.realName) fieldsForVerification.push(profile.realName);

    return {
      username: data.matchedUser.username,
      fieldsForVerification,
      ranking: profile?.ranking || undefined,
      realName: profile?.realName || undefined
    };
  }

  public async fetchRecentSubmissions(username: string): Promise<PlatformSubmission[]> {
    const query = `
      query recentAcSubmissions($username: String!) {
        recentAcSubmissionList(username: $username, limit: 20) {
          title
          titleSlug
          timestamp
        }
      }
    `;

    const data = await this.executeGraphQL<{
      recentAcSubmissionList: Array<{
        title: string;
        titleSlug: string;
        timestamp: string | number;
      }> | null;
    }>(query, { username });

    if (!data?.recentAcSubmissionList) {
      return [];
    }

    return data.recentAcSubmissionList.map(sub => ({
      id: `${sub.titleSlug}_${sub.timestamp}`,
      title: sub.title,
      identifier: sub.titleSlug,
      timestamp: Number(sub.timestamp),
      verdict: 'ACCEPTED'
    }));
  }

  public async fetchStats(username: string): Promise<PlatformStats> {
    const query = `
      query getUserStats($username: String!) {
        matchedUser(username: $username) {
          username
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
          submissionCalendar
        }
        userContestRanking(username: $username) {
          rating
          attendedContestsCount
          globalRanking
        }
      }
    `;

    const data = await this.executeGraphQL<{
      matchedUser: {
        username: string;
        submitStats: {
          acSubmissionNum: Array<{ difficulty: string; count: number }>;
        };
        submissionCalendar: string; // JSON string mapping timestamp -> submission count
      } | null;
      userContestRanking: {
        rating: number | null;
        attendedContestsCount: number | null;
        globalRanking: number | null;
      } | null;
    }>(query, { username });

    if (!data?.matchedUser) {
      throw new UserNotFoundException(`LeetCode user '${username}' not found.`);
    }

    let totalSolved = 0;
    let easy = 0;
    let medium = 0;
    let hard = 0;

    const acList = data.matchedUser.submitStats?.acSubmissionNum || [];
    for (const item of acList) {
      if (item.difficulty === 'All') totalSolved = item.count;
      else if (item.difficulty === 'Easy') easy = item.count;
      else if (item.difficulty === 'Medium') medium = item.count;
      else if (item.difficulty === 'Hard') hard = item.count;
    }

    let calendar: Record<string, number> = {};
    if (data.matchedUser.submissionCalendar) {
      try {
        calendar = JSON.parse(data.matchedUser.submissionCalendar);
      } catch {
        calendar = {};
      }
    }

    return {
      totalSolved,
      easy,
      medium,
      hard,
      rating: data.userContestRanking?.rating ? Math.round(data.userContestRanking.rating) : undefined,
      contests: data.userContestRanking?.attendedContestsCount || 0,
      submissionCalendar: calendar
    };
  }

  public async fetchQuestion(titleSlug: string): Promise<PlatformQuestionDetails | null> {
    const query = `
      query getQuestion($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          title
          difficulty
          topicTags {
            name
            slug
          }
        }
      }
    `;

    try {
      const data = await this.executeGraphQL<{
        question: {
          title: string;
          difficulty: string;
          topicTags: Array<{ name: string; slug: string }>;
        } | null;
      }>(query, { titleSlug });

      if (!data?.question) return null;

      let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
      if (data.question.difficulty === 'Easy') difficulty = 'Easy';
      else if (data.question.difficulty === 'Hard') difficulty = 'Hard';

      return {
        title: data.question.title,
        difficulty,
        topics: data.question.topicTags.map(t => t.name)
      };
    } catch {
      return null;
    }
  }
}

export const leetcodeConnector = new LeetCodeConnector();
