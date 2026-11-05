/**
 * LeetCodeConnector
 * 
 * NOTE & DISCLAIMER:
 * LeetCode does not have an official public REST API. This connector communicates with
 * LeetCode's public GraphQL endpoint (https://leetcode.com/graphql) using browser-like
 * headers (User-Agent, Referer). This endpoint is unofficial and may change its schema
 * or rate-limiting policies in the future. All queries and schema fields are isolated
 * within this class so changes do not propagate across the application.
 */

const axios = require('axios');
const Bottleneck = require('bottleneck');
const PlatformConnector = require('./PlatformConnector');
const {
  PlatformUnavailableError,
  RateLimitedError,
  UserNotFoundError,
  MalformedResponseError,
} = require('./errors');
const config = require('../config/config');

// Application-wide limiter: spaced at least 1000ms (1 second) apart
const leetcodeLimiter = new Bottleneck({
  minTime: 1000,
  maxConcurrent: 1,
});

class LeetCodeConnector extends PlatformConnector {
  constructor(endpoint = 'https://leetcode.com/graphql') {
    super('LEETCODE');
    this.endpoint = endpoint;
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: config.httpReadTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': config.browserUserAgent,
      },
    });
  }

  /**
   * Execute GraphQL query with automatic 1-retry on network error and typed exception mapping.
   */
  async executeGraphQL(query, variables = {}, retried = false) {
    return leetcodeLimiter.schedule(async () => {
      try {
        const response = await this.client.post('', { query, variables });

        if (response.status === 429) {
          throw new RateLimitedError('LEETCODE', 60);
        }

        if (response.data && response.data.errors && response.data.errors.length > 0) {
          const errMsg = response.data.errors[0].message || '';
          if (errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('too many requests')) {
            throw new RateLimitedError('LEETCODE', 60);
          }
          if (errMsg.toLowerCase().includes('does not exist') || errMsg.toLowerCase().includes('user not found')) {
            throw new UserNotFoundError('LEETCODE', variables.username || 'unknown');
          }
          // Some queries return null data with non-fatal errors; check if data exists
          if (!response.data.data) {
            throw new MalformedResponseError('LEETCODE', errMsg);
          }
        }

        return response.data.data;
      } catch (err) {
        if (err instanceof RateLimitedError || err instanceof UserNotFoundError || err instanceof MalformedResponseError) {
          throw err;
        }

        if (err.response) {
          if (err.response.status === 429) {
            throw new RateLimitedError('LEETCODE', 60);
          }
          if (err.response.status === 404) {
            throw new UserNotFoundError('LEETCODE', variables.username || 'unknown');
          }
          if (err.response.status >= 500) {
            if (!retried) {
              return this.executeGraphQL(query, variables, true);
            }
            throw new PlatformUnavailableError('LEETCODE', err);
          }
        }

        // Network / Timeout errors (e.g. ECONNABORTED, ENOTFOUND, ETIMEDOUT)
        if (!retried && (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET')) {
          return this.executeGraphQL(query, variables, true);
        }

        throw new PlatformUnavailableError('LEETCODE', err);
      }
    });
  }

  async userExists(username) {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
        }
      }
    `;
    try {
      const data = await this.executeGraphQL(query, { username });
      return !!(data && data.matchedUser && data.matchedUser.username);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return false;
      }
      throw err;
    }
  }

  async getProfileForVerification(username) {
    const query = `
      query getVerificationProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            aboutMe
          }
        }
      }
    `;
    const data = await this.executeGraphQL(query, { username });
    if (!data || !data.matchedUser) {
      throw new UserNotFoundError('LEETCODE', username);
    }
    const profile = data.matchedUser.profile || {};
    return {
      realName: profile.realName || '',
      aboutMe: profile.aboutMe || '',
    };
  }

  async getUserStats(username) {
    const query = `
      query getUserStats($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            aboutMe
            ranking
          }
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
          submissionCalendar
        }
        userContestRanking(username: $username) {
          attendedContestsCount
          rating
          globalRanking
        }
      }
    `;

    const data = await this.executeGraphQL(query, { username });
    if (!data || !data.matchedUser) {
      throw new UserNotFoundError('LEETCODE', username);
    }

    const { matchedUser, userContestRanking } = data;
    const acSubmissions = matchedUser.submitStats?.acSubmissionNum || [];

    let totalSolved = 0;
    let easy = 0;
    let medium = 0;
    let hard = 0;

    for (const item of acSubmissions) {
      if (item.difficulty === 'All') totalSolved = item.count;
      else if (item.difficulty === 'Easy') easy = item.count;
      else if (item.difficulty === 'Medium') medium = item.count;
      else if (item.difficulty === 'Hard') hard = item.count;
    }

    let submissionCalendar = {};
    if (matchedUser.submissionCalendar) {
      try {
        submissionCalendar = typeof matchedUser.submissionCalendar === 'string'
          ? JSON.parse(matchedUser.submissionCalendar)
          : matchedUser.submissionCalendar;
      } catch (e) {
        submissionCalendar = {};
      }
    }

    const rating = userContestRanking ? Math.round(userContestRanking.rating || 0) : 0;
    const contests = userContestRanking ? (userContestRanking.attendedContestsCount || 0) : 0;
    const globalRanking = userContestRanking ? (userContestRanking.globalRanking || matchedUser.profile?.ranking || 0) : (matchedUser.profile?.ranking || 0);

    return {
      totalSolved,
      easy,
      medium,
      hard,
      rating,
      contests,
      details: {
        globalRanking,
        submissionCalendar,
      },
    };
  }

  async getAcceptedSubmissions(username, limit = 20) {
    const query = `
      query getRecentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          title
          titleSlug
          timestamp
        }
      }
    `;

    const data = await this.executeGraphQL(query, { username, limit });
    if (!data || !data.recentAcSubmissionList) {
      return [];
    }

    return data.recentAcSubmissionList.map(item => ({
      externalId: item.titleSlug,
      title: item.title,
      timestamp: parseInt(item.timestamp, 10) * 1000, // convert sec to ms
    }));
  }

  async getProblemMetadata(titleSlug) {
    const query = `
      query getQuestionDetails($titleSlug: String!) {
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

    const data = await this.executeGraphQL(query, { titleSlug });
    if (!data || !data.question) {
      throw new MalformedResponseError('LEETCODE', `Problem '${titleSlug}' not found.`);
    }

    const { question } = data;
    return {
      title: question.title,
      difficulty: question.difficulty, // 'Easy', 'Medium', 'Hard'
      topics: (question.topicTags || []).map(tag => tag.name),
      url: `https://leetcode.com/problems/${titleSlug}/`,
    };
  }
}

module.exports = LeetCodeConnector;
