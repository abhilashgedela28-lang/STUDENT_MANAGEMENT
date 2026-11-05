/**
 * CodeforcesConnector
 * 
 * Official Codeforces REST API (https://codeforces.com/api/)
 * Enforces global outgoing throttle of at least 2.1 seconds between requests,
 * timeouts, automatic 1-retry, and typed error handling.
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

// Application-wide limiter: spaced at least 2100ms (2.1 seconds) apart
const codeforcesLimiter = new Bottleneck({
  minTime: 2100,
  maxConcurrent: 1,
});

class CodeforcesConnector extends PlatformConnector {
  constructor(endpoint = 'https://codeforces.com/api') {
    super('CODEFORCES');
    this.endpoint = endpoint;
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: config.httpReadTimeoutMs,
      headers: {
        'User-Agent': config.browserUserAgent,
      },
    });
  }

  /**
   * Helper to execute API requests with throttle, retry and error mapping.
   */
  async requestApi(path, params = {}, retried = false) {
    return codeforcesLimiter.schedule(async () => {
      try {
        const response = await this.client.get(path, { params });
        const data = response.data;

        if (data.status !== 'OK') {
          const comment = (data.comment || '').toLowerCase();
          if (comment.includes('not found') || comment.includes('handles: user')) {
            throw new UserNotFoundError('CODEFORCES', params.handle || params.handles || 'unknown');
          }
          if (comment.includes('limit') || comment.includes('call limit')) {
            throw new RateLimitedError('CODEFORCES', 60);
          }
          throw new MalformedResponseError('CODEFORCES', data.comment || 'Status not OK');
        }

        return data.result;
      } catch (err) {
        if (err instanceof RateLimitedError || err instanceof UserNotFoundError || err instanceof MalformedResponseError) {
          throw err;
        }

        if (err.response) {
          if (err.response.status === 429) {
            throw new RateLimitedError('CODEFORCES', 60);
          }
          if (err.response.status === 400 && err.response.data && err.response.data.comment) {
            const comment = err.response.data.comment.toLowerCase();
            if (comment.includes('not found') || comment.includes('handles: user')) {
              throw new UserNotFoundError('CODEFORCES', params.handle || params.handles || 'unknown');
            }
          }
          if (err.response.status >= 500) {
            if (!retried) {
              return this.requestApi(path, params, true);
            }
            throw new PlatformUnavailableError('CODEFORCES', err);
          }
        }

        // Retry on network/socket timeouts
        if (!retried && (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET')) {
          return this.requestApi(path, params, true);
        }

        throw new PlatformUnavailableError('CODEFORCES', err);
      }
    });
  }

  async userExists(handle) {
    try {
      const result = await this.requestApi('/user.info', { handles: handle });
      return Array.isArray(result) && result.length > 0;
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return false;
      }
      throw err;
    }
  }

  async getProfileForVerification(handle) {
    const result = await this.requestApi('/user.info', { handles: handle });
    if (!Array.isArray(result) || result.length === 0) {
      throw new UserNotFoundError('CODEFORCES', handle);
    }
    const info = result[0];
    return {
      organization: info.organization || '',
      firstName: info.firstName || '',
      city: info.city || '',
    };
  }

  async getUserStats(handle) {
    // 1. Get user.info
    const infoList = await this.requestApi('/user.info', { handles: handle });
    if (!infoList || infoList.length === 0) {
      throw new UserNotFoundError('CODEFORCES', handle);
    }
    const info = infoList[0];

    // 2. Get user.rating (contest history)
    let ratingHistory = [];
    try {
      ratingHistory = await this.requestApi('/user.rating', { handle });
    } catch (err) {
      if (!(err instanceof UserNotFoundError)) {
        console.warn(`[Codeforces] Failed to fetch rating history for ${handle}: ${err.message}`);
      }
    }

    // 3. Get user.status (submission history to count unique problems solved)
    const submissions = await this.requestApi('/user.status', { handle, from: 1, count: 1000 });
    
    // Group solved problems by unique contestId + index
    const solvedSet = new Set();
    const tagCounts = {};
    let easy = 0;   // Rating <= 1200
    let medium = 0; // Rating 1300 - 1800
    let hard = 0;   // Rating >= 1900

    for (const sub of (submissions || [])) {
      if (sub.verdict === 'OK' && sub.problem) {
        const key = `${sub.problem.contestId || ''}${sub.problem.index}`;
        if (!solvedSet.has(key)) {
          solvedSet.add(key);

          const r = sub.problem.rating;
          if (r) {
            if (r <= 1200) easy++;
            else if (r <= 1800) medium++;
            else hard++;
          } else {
            easy++;
          }

          if (Array.isArray(sub.problem.tags)) {
            for (const tag of sub.problem.tags) {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
          }
        }
      }
    }

    return {
      totalSolved: solvedSet.size,
      easy,
      medium,
      hard,
      rating: info.rating || 0,
      contests: ratingHistory.length,
      details: {
        maxRating: info.maxRating || 0,
        rank: info.rank || 'unrated',
        maxRank: info.maxRank || 'unrated',
        tagCounts,
        ratingHistory: ratingHistory.map(r => ({
          contestId: r.contestId,
          contestName: r.contestName,
          rank: r.rank,
          rating: r.newRating,
          date: new Date(r.ratingUpdateTimeSeconds * 1000).toISOString(),
        })),
      },
    };
  }

  async getAcceptedSubmissions(handle) {
    const submissions = await this.requestApi('/user.status', { handle, from: 1, count: 500 });
    const accepted = [];
    const seen = new Set();

    for (const sub of (submissions || [])) {
      if (sub.verdict === 'OK' && sub.problem) {
        const externalId = `${sub.problem.contestId}${sub.problem.index}`;
        if (!seen.has(externalId)) {
          seen.add(externalId);
          accepted.push({
            externalId,
            title: sub.problem.name || externalId,
            timestamp: (sub.creationTimeSeconds || 0) * 1000,
          });
        }
      }
    }

    return accepted;
  }

  async getProblemMetadata(contestIdAndIndex) {
    // Parse contestId and index: e.g. "1920A" or "4A"
    const match = String(contestIdAndIndex).trim().match(/^(\d+)([A-Za-z0-9]+)$/);
    if (!match) {
      throw new MalformedResponseError('CODEFORCES', `Invalid Codeforces problem identifier: ${contestIdAndIndex}`);
    }

    const contestId = parseInt(match[1], 10);
    const index = match[2].toUpperCase();

    // Fetch problemset
    const problemset = await this.requestApi('/problemset.problems');
    const problems = problemset.problems || [];
    const target = problems.find(p => p.contestId === contestId && p.index.toUpperCase() === index);

    if (!target) {
      // Fallback metadata if not in recent problemset
      return {
        title: `Codeforces Problem ${contestId}${index}`,
        difficulty: 'Medium',
        topics: ['Implementation'],
        url: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
      };
    }

    let diffLabel = 'Medium';
    if (target.rating) {
      if (target.rating <= 1200) diffLabel = `Easy (${target.rating})`;
      else if (target.rating <= 1800) diffLabel = `Medium (${target.rating})`;
      else diffLabel = `Hard (${target.rating})`;
    }

    return {
      title: target.name || `Problem ${contestId}${index}`,
      difficulty: diffLabel,
      topics: target.tags || [],
      url: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    };
  }
}

module.exports = CodeforcesConnector;
