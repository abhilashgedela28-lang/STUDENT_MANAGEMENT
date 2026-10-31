export type Platform = 'LEETCODE' | 'CODEFORCES';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type ProblemStatus = 'UNSOLVED' | 'STARTED' | 'SOLVED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

export interface PlatformLink {
  id: string;
  userId: string;
  platform: Platform;
  username: string;
  verificationCode?: string;
  codeExpiresAt?: string;
  verified: boolean;
  verifiedAt?: string;
  lastSyncedAt?: string;
}

export interface Problem {
  id: string;
  platform: Platform;
  externalId: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  topics: string[];
  active: boolean;
  userStatus: ProblemStatus;
  startedAt?: string;
  solvedAt?: string;
}

export interface UserSnapshot {
  id: string;
  userId: string;
  platform: Platform;
  snapshotDate: string;
  totalSolved: number;
  easy: number;
  medium: number;
  hard: number;
  rating?: number;
  contests?: number;
}

export interface DashboardData {
  empty: boolean;
  links: PlatformLink[];
  platformStats: Array<{
    platform: Platform;
    username: string;
    stats: {
      totalSolved: number;
      easy: number;
      medium: number;
      hard: number;
      rating?: number;
      contests?: number;
      submissionCalendar?: Record<string, number>;
      tagCounts?: Record<string, number>;
    };
  }>;
  practiceStats: {
    totalSolved: number;
    easy: number;
    medium: number;
    hard: number;
    totalAvailable: number;
  };
  streaks: {
    currentStreak: number;
    longestStreak: number;
  };
  snapshots: UserSnapshot[];
  calendarHeatmap: Record<string, number>;
}
