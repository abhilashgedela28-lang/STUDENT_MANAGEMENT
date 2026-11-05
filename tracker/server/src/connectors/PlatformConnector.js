/**
 * Abstract base class for Platform Connectors.
 * Enforces unified interface across LeetCode, Codeforces, and any future platform.
 */
class PlatformConnector {
  constructor(name) {
    if (this.constructor === PlatformConnector) {
      throw new Error('PlatformConnector is an abstract class and cannot be instantiated directly.');
    }
    this.name = name;
  }

  /**
   * Check if a user exists on the platform.
   * @param {string} username
   * @returns {Promise<boolean>}
   */
  async userExists(username) {
    throw new Error('Method userExists() must be implemented.');
  }

  /**
   * Fetch user's public profile fields to verify ownership code.
   * @param {string} username
   * @returns {Promise<{ aboutMe?: string, realName?: string, organization?: string, city?: string, firstName?: string }>}
   */
  async getProfileForVerification(username) {
    throw new Error('Method getProfileForVerification() must be implemented.');
  }

  /**
   * Fetch full user profile & statistics for snapshot / dashboard.
   * @param {string} username
   * @returns {Promise<{ totalSolved: number, easy: number, medium: number, hard: number, rating: number, contests: number, details: any }>}
   */
  async getUserStats(username) {
    throw new Error('Method getUserStats() must be implemented.');
  }

  /**
   * Fetch recent/all accepted submissions to match against problem list.
   * @param {string} username
   * @returns {Promise<Array<{ externalId: string, timestamp: number, title?: string }>>}
   */
  async getAcceptedSubmissions(username) {
    throw new Error('Method getAcceptedSubmissions() must be implemented.');
  }

  /**
   * Fetch question metadata by externalId (slug or contestId+index).
   * @param {string} externalId
   * @returns {Promise<{ title: string, difficulty: string, topics: string[], url: string }>}
   */
  async getProblemMetadata(externalId) {
    throw new Error('Method getProblemMetadata() must be implemented.');
  }
}

module.exports = PlatformConnector;
