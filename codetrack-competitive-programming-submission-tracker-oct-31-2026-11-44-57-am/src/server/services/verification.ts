import crypto from 'crypto';
import { db } from '../db.js';
import { Platform, PlatformLink } from '../types.js';
import { leetcodeConnector } from '../connectors/leetcode.js';
import { codeforcesConnector } from '../connectors/codeforces.js';
import { snapshotService } from './snapshotService.js';

export class VerificationService {
  public static generateCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Avoid 0, O, 1, I for clarity
    let code = 'CT-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return code;
  }

  public static async linkAccount(userId: string, platform: Platform, username: string): Promise<PlatformLink> {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      throw new Error('Username is required.');
    }

    const verifiedByOther = await db.findVerifiedLinkByUsername(platform, cleanUsername);
    if (verifiedByOther && verifiedByOther.userId !== userId) {
      throw new Error(`The ${platform} account '${cleanUsername}' has already been verified by another user.`);
    }

    const connector = platform === 'LEETCODE' ? leetcodeConnector : codeforcesConnector;
    let exists = false;
    try {
      exists = await connector.validateAccount(cleanUsername);
    } catch (err: unknown) {
      const error = err as Error;
      throw new Error(`Could not validate ${platform} account: ${error.message}`);
    }

    if (!exists) {
      throw new Error(`The ${platform} user '${cleanUsername}' was not found. Please verify the handle/username.`);
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const link: PlatformLink = {
      id: 'link_' + Math.random().toString(36).substring(2, 9),
      userId,
      platform,
      username: cleanUsername,
      verificationCode: code,
      codeExpiresAt: expiresAt,
      verified: false
    };

    await db.saveLink(link);
    return link;
  }

  public static async verifyAccount(
    userId: string,
    platform: Platform,
    simulateVerification = false
  ): Promise<{ verified: boolean; message: string; link: PlatformLink }> {
    const link = await db.getLink(userId, platform);
    if (!link) {
      throw new Error(`No ${platform} link found for this user. Please start by adding your username.`);
    }

    if (link.verified) {
      return { verified: true, message: `Account already verified.`, link };
    }

    if (!link.verificationCode || !link.codeExpiresAt) {
      throw new Error('No active verification code found. Please generate a new code.');
    }

    if (new Date() > new Date(link.codeExpiresAt)) {
      throw new Error('Verification code has expired (30-minute limit). Please generate a new code.');
    }

    const verifiedByOther = await db.findVerifiedLinkByUsername(platform, link.username);
    if (verifiedByOther && verifiedByOther.userId !== userId) {
      throw new Error(`The ${platform} account '${link.username}' has already been claimed and verified by another user.`);
    }

    const connector = platform === 'LEETCODE' ? leetcodeConnector : codeforcesConnector;
    const profile = await connector.fetchProfile(link.username);

    const codeToFind = link.verificationCode.toUpperCase();
    const found =
      simulateVerification ||
      profile.fieldsForVerification.some(text => text.toUpperCase().includes(codeToFind));

    if (!found) {
      const targetFields =
        platform === 'LEETCODE'
          ? 'your LeetCode Profile "Summary" (aboutMe) or "Real Name"'
          : 'your Codeforces Profile "Organization", "First Name", or "City"';
      return {
        verified: false,
        message: `Verification code '${link.verificationCode}' was not found in ${targetFields}. Please save your profile on ${platform} and click Verify again.`,
        link
      };
    }

    link.verified = true;
    link.verifiedAt = new Date().toISOString();
    await db.saveLink(link);

    try {
      await snapshotService.recordSnapshotForUserPlatform(userId, platform);
      if (platform === 'CODEFORCES') {
        await snapshotService.backfillCodeforcesHistory(userId, link.username);
      }
    } catch (snapErr) {
      console.warn(`Initial snapshot failed after verification:`, snapErr);
    }

    return {
      verified: true,
      message: `Successfully verified and linked ${platform} account '${link.username}'! You may now remove the code from your profile if you wish.`,
      link
    };
  }

  public static async unlinkAccount(userId: string, platform: Platform): Promise<void> {
    await db.removeLink(userId, platform);
  }
}
