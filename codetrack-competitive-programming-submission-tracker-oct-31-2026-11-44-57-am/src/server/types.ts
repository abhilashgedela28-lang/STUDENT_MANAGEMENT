export type Role = 'USER' | 'ADMIN';
export type Platform = 'LEETCODE' | 'CODEFORCES';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type ProblemStatus = 'STARTED' | 'SOLVED';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
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
  externalId: string; // LeetCode slug, Codeforces 'contestId_index' e.g. '4_A'
  title: string;
  url: string;
  difficulty: Difficulty;
  topics: string[];
  active: boolean;
  createdBy?: string;
  createdAt: string;
}

export interface UserProblemStatus {
  id: string;
  userId: string;
  problemId: string;
  status: ProblemStatus;
  startedAt?: string;
  solvedAt?: string;
}

export interface UserSnapshot {
  id: string;
  userId: string;
  platform: Platform;
  snapshotDate: string; // YYYY-MM-DD
  totalSolved: number;
  easy: number;
  medium: number;
  hard: number;
  rating?: number;
  contests?: number;
  createdAt: string;
}

export interface SyncLog {
  id: string;
  userId: string;
  requestedAt: string;
  result: {
    status: 'SUCCESS' | 'RATE_LIMITED' | 'FAILED';
    message: string;
    newlySolvedCount?: number;
    newlySolvedTitles?: string[];
  };
}

export interface DailySyncCounter {
  userId: string;
  day: string; // YYYY-MM-DD
  count: number;
}
