export class PlatformUnavailableException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformUnavailableException';
  }
}

export class RateLimitedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitedException';
  }
}

export class UserNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserNotFoundException';
  }
}

export interface PlatformProfile {
  username: string;
  fieldsForVerification: string[]; // text strings extracted to search verification code in
  ranking?: number;
  realName?: string;
}

export interface PlatformSubmission {
  id: string;
  title: string;
  identifier: string; // LeetCode slug, Codeforces contestId_index (e.g., "4_A")
  timestamp: number; // Unix timestamp in seconds
  verdict: 'OK' | 'ACCEPTED';
}

export interface PlatformStats {
  totalSolved: number;
  easy: number;
  medium: number;
  hard: number;
  rating?: number;
  contests?: number;
  submissionCalendar?: Record<string, number>; // epoch seconds -> count
  tagCounts?: Record<string, number>;
}

export interface PlatformQuestionDetails {
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topics: string[];
}

export interface PlatformConnector {
  validateAccount(username: string): Promise<boolean>;
  fetchProfile(username: string): Promise<PlatformProfile>;
  fetchRecentSubmissions(username: string): Promise<PlatformSubmission[]>;
  fetchStats(username: string): Promise<PlatformStats>;
  fetchQuestion(identifier: string): Promise<PlatformQuestionDetails | null>;
}
