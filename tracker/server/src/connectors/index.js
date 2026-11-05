const LeetCodeConnector = require('./LeetCodeConnector');
const CodeforcesConnector = require('./CodeforcesConnector');
const {
  PlatformError,
  PlatformUnavailableError,
  RateLimitedError,
  UserNotFoundError,
  MalformedResponseError,
} = require('./errors');

const leetCodeConnector = new LeetCodeConnector();
const codeforcesConnector = new CodeforcesConnector();

function getConnector(platform) {
  const norm = String(platform).toUpperCase();
  if (norm === 'LEETCODE') return leetCodeConnector;
  if (norm === 'CODEFORCES') return codeforcesConnector;
  throw new Error(`Unsupported platform: ${platform}`);
}

module.exports = {
  getConnector,
  leetCodeConnector,
  codeforcesConnector,
  PlatformError,
  PlatformUnavailableError,
  RateLimitedError,
  UserNotFoundError,
  MalformedResponseError,
};
