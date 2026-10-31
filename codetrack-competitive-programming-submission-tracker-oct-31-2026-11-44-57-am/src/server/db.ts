import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  PlatformLink,
  Problem,
  UserProblemStatus,
  UserSnapshot,
  SyncLog,
  DailySyncCounter,
  Platform,
  Difficulty
} from './types.js';

interface DatabaseSchema {
  users: User[];
  platformLinks: PlatformLink[];
  problems: Problem[];
  userProblemStatus: UserProblemStatus[];
  userSnapshots: UserSnapshot[];
  syncLogs: SyncLog[];
  dailySyncCounters: DailySyncCounter[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'codetrack.json');

const INITIAL_PROBLEMS: Omit<Problem, 'id' | 'createdAt'>[] = [
  // 10 LeetCode starter problems
  {
    platform: 'LEETCODE',
    externalId: 'two-sum',
    title: 'Two Sum',
    url: 'https://leetcode.com/problems/two-sum/',
    difficulty: 'Easy',
    topics: ['Array', 'Hash Table'],
    active: true,
  },
  {
    platform: 'LEETCODE',
    externalId: 'valid-parentheses',
    title: 'Valid Parentheses',
    url: 'https://leetcode.com/problems/valid-parentheses/',
    difficulty: 'Easy',
    topics: ['String', 'Stack'],
    active: true,
  },
  {
    platform: 'LEETCODE',
    externalId: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    url: 'https://leetcode.com/problems/merge-two-sorted-lists/',
    difficulty: 'Easy',
    topics: ['Linked List', 'Recursion'],
    active: true,
  },
  {
    platform: 'LEETCODE',
    externalId: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
    difficulty: 'Easy',
    topics: ['Array', 'Dynamic Programming'],
    active: true,
  },
  {
    platform: 'LEETCODE',
    externalId: 'invert-binary-tree',
    title: 'Invert Binary Tree',
    url: 'https://leetcode.com/problems/invert-binary-tree/',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'],
    active: true,
  },
  {
    platform: 'LEETCODE',
    externalId: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
    difficulty: 'Medium',
    topics: ['Hash Table', 'Sliding Window', 'String'],
    active: true,
  },
  {
    platform: 'LEETCODE',
    externalId: '3sum',
    title: '3Sum',
    url: 'https://leetcode.com/problems/3sum/',
    difficulty: 'Medium',
    topics: ['Array', 'Two Pointers', 'Sorting'],
    active: true,
  },
  {
    platform: 'LEETCODE',
    externalId: 'container-with-most-water',
    title: 'Container With Most Water',
    url: 'https://leetcode.com/problems/container-with-most-water/',
    difficulty: 'Medium',
    topics: ['Array', 'Two Pointers', 'Greedy'],
    active: true,
  },
  {
    platform: 'LEETCODE',
    externalId: 'group-anagrams',
    title: 'Group Anagrams',
    url: 'https://leetcode.com/problems/group-anagrams/',
    difficulty: 'Medium',
    topics: ['Array', 'Hash Table', 'String', 'Sorting'],
    active: true,
  },
  {
    platform: 'LEETCODE',
    externalId: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    url: 'https://leetcode.com/problems/trapping-rain-water/',
    difficulty: 'Hard',
    topics: ['Array', 'Two Pointers', 'Dynamic Programming', 'Stack', 'Monotonic Stack'],
    active: true,
  },

  // 10 Codeforces starter problems
  {
    platform: 'CODEFORCES',
    externalId: '4_A',
    title: 'Watermelon',
    url: 'https://codeforces.com/problemset/problem/4/A',
    difficulty: 'Easy',
    topics: ['brute force', 'math'],
    active: true,
  },
  {
    platform: 'CODEFORCES',
    externalId: '71_A',
    title: 'Way Too Long Words',
    url: 'https://codeforces.com/problemset/problem/71/A',
    difficulty: 'Easy',
    topics: ['strings'],
    active: true,
  },
  {
    platform: 'CODEFORCES',
    externalId: '231_A',
    title: 'Team',
    url: 'https://codeforces.com/problemset/problem/231/A',
    difficulty: 'Easy',
    topics: ['brute force', 'greedy'],
    active: true,
  },
  {
    platform: 'CODEFORCES',
    externalId: '158_A',
    title: 'Next Round',
    url: 'https://codeforces.com/problemset/problem/158/A',
    difficulty: 'Easy',
    topics: ['special problem', 'implementation'],
    active: true,
  },
  {
    platform: 'CODEFORCES',
    externalId: '263_A',
    title: 'Beautiful Matrix',
    url: 'https://codeforces.com/problemset/problem/263/A',
    difficulty: 'Easy',
    topics: ['implementation'],
    active: true,
  },
  {
    platform: 'CODEFORCES',
    externalId: '1_A',
    title: 'Theatre Square',
    url: 'https://codeforces.com/problemset/problem/1/A',
    difficulty: 'Medium',
    topics: ['math'],
    active: true,
  },
  {
    platform: 'CODEFORCES',
    externalId: '118_A',
    title: 'String Task',
    url: 'https://codeforces.com/problemset/problem/118/A',
    difficulty: 'Medium',
    topics: ['implementation', 'strings'],
    active: true,
  },
  {
    platform: 'CODEFORCES',
    externalId: '96_A',
    title: 'Football',
    url: 'https://codeforces.com/problemset/problem/96/A',
    difficulty: 'Medium',
    topics: ['implementation', 'strings'],
    active: true,
  },
  {
    platform: 'CODEFORCES',
    externalId: '69_A',
    title: 'Young Physicist',
    url: 'https://codeforces.com/problemset/problem/69/A',
    difficulty: 'Medium',
    topics: ['math', 'implementation'],
    active: true,
  },
  {
    platform: 'CODEFORCES',
    externalId: '479_A',
    title: 'Expression',
    url: 'https://codeforces.com/problemset/problem/479/A',
    difficulty: 'Hard',
    topics: ['brute force', 'math'],
    active: true,
  },
];

class Database {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = {
      users: [],
      platformLinks: [],
      problems: [],
      userProblemStatus: [],
      userSnapshots: [],
      syncLogs: [],
      dailySyncCounters: []
    };
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
      } catch (err) {
        console.error('Failed to parse database file, resetting:', err);
      }
    }

    this.seedDefaultAdmin();
    this.seedStarterProblems();
    this.flush();
  }

  private seedDefaultAdmin() {
    const configuredEmail = (process.env.ADMIN_EMAIL || '24pa1a4501@vishnu.edu.in').toLowerCase();
    const adminEmails = Array.from(new Set([
      configuredEmail,
      '24pa1a4501@vishnu.edu.in',
      'abhilashgedela28@gmail.com'
    ])).filter(Boolean);

    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const passwordHash = bcrypt.hashSync(adminPassword, 10);

    for (const email of adminEmails) {
      const cleanEmail = email.toLowerCase();
      const existing = this.data.users.find(u => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        existing.role = 'ADMIN';
        existing.passwordHash = passwordHash;
        console.log(`[CodeTrack] Verified administrator role for: ${cleanEmail}`);
      } else {
        const admin: User = {
          id: 'user_admin_' + Math.random().toString(36).substring(2, 9),
          name: cleanEmail.includes('vishnu') ? 'Abhilash (Admin)' : 'Abhilash Gedela',
          email: cleanEmail,
          passwordHash,
          role: 'ADMIN',
          createdAt: new Date().toISOString()
        };
        this.data.users.push(admin);
        console.log(`[CodeTrack] Seeded administrator user: ${cleanEmail}`);
      }
    }

    // Remove dummy admin placeholder
    this.data.users = this.data.users.filter(u => u.email !== 'admin@codetrack.dev');
  }

  private seedStarterProblems() {
    for (const starter of INITIAL_PROBLEMS) {
      const exists = this.data.problems.some(
        p => p.platform === starter.platform && p.externalId.toLowerCase() === starter.externalId.toLowerCase()
      );
      if (!exists) {
        this.data.problems.push({
          ...starter,
          id: 'prob_' + Math.random().toString(36).substring(2, 9),
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  public flush() {
    try {
      const tempPath = DATA_FILE + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DATA_FILE);
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  public scheduleFlush() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.flush();
      this.saveTimeout = null;
    }, 100);
  }

  // --- Users ---
  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public getAllUsers(): User[] {
    return this.data.users;
  }

  public createUser(name: string, email: string, passwordHash: string, role: 'USER' | 'ADMIN' = 'USER'): User {
    if (this.findUserByEmail(email)) {
      throw new Error('Email is already registered');
    }
    const user: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(user);
    this.flush();
    return user;
  }

  // --- Platform Links ---
  public getLinksForUser(userId: string): PlatformLink[] {
    return this.data.platformLinks.filter(l => l.userId === userId);
  }

  public getLink(userId: string, platform: Platform): PlatformLink | undefined {
    return this.data.platformLinks.find(l => l.userId === userId && l.platform === platform);
  }

  public findVerifiedLinkByUsername(platform: Platform, username: string): PlatformLink | undefined {
    return this.data.platformLinks.find(
      l => l.platform === platform && l.verified && l.username.toLowerCase() === username.toLowerCase()
    );
  }

  public saveLink(link: PlatformLink) {
    const idx = this.data.platformLinks.findIndex(l => l.userId === link.userId && l.platform === link.platform);
    if (idx >= 0) {
      this.data.platformLinks[idx] = link;
    } else {
      this.data.platformLinks.push(link);
    }
    this.flush();
  }

  public removeLink(userId: string, platform: Platform) {
    this.data.platformLinks = this.data.platformLinks.filter(
      l => !(l.userId === userId && l.platform === platform)
    );
    this.flush();
  }

  // --- Problems ---
  public getAllProblems(): Problem[] {
    return this.data.problems;
  }

  public findProblemById(id: string): Problem | undefined {
    return this.data.problems.find(p => p.id === id);
  }

  public findProblemByExternalId(platform: Platform, externalId: string): Problem | undefined {
    return this.data.problems.find(
      p => p.platform === platform && p.externalId.toLowerCase() === externalId.toLowerCase()
    );
  }

  public addProblem(problem: Omit<Problem, 'id' | 'createdAt'>): Problem {
    const existing = this.findProblemByExternalId(problem.platform, problem.externalId);
    if (existing) {
      throw new Error(`Problem already exists for ${problem.platform} with identifier ${problem.externalId}`);
    }
    const newProblem: Problem = {
      ...problem,
      id: 'prob_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString()
    };
    this.data.problems.push(newProblem);
    this.flush();
    return newProblem;
  }

  public updateProblem(id: string, updates: Partial<Problem>): Problem {
    const idx = this.data.problems.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Problem not found');
    this.data.problems[idx] = { ...this.data.problems[idx], ...updates };
    this.flush();
    return this.data.problems[idx];
  }

  public deleteProblem(id: string) {
    this.data.problems = this.data.problems.filter(p => p.id !== id);
    this.data.userProblemStatus = this.data.userProblemStatus.filter(s => s.problemId !== id);
    this.flush();
  }

  // --- User Problem Status ---
  public getUserProblemStatuses(userId: string): UserProblemStatus[] {
    return this.data.userProblemStatus.filter(s => s.userId === userId);
  }

  public getProblemStatus(userId: string, problemId: string): UserProblemStatus | undefined {
    return this.data.userProblemStatus.find(s => s.userId === userId && s.problemId === problemId);
  }

  public markStarted(userId: string, problemId: string): UserProblemStatus {
    let status = this.getProblemStatus(userId, problemId);
    if (!status) {
      status = {
        id: 'ups_' + Math.random().toString(36).substring(2, 9),
        userId,
        problemId,
        status: 'STARTED',
        startedAt: new Date().toISOString()
      };
      this.data.userProblemStatus.push(status);
    } else if (status.status !== 'SOLVED') {
      status.status = 'STARTED';
      if (!status.startedAt) status.startedAt = new Date().toISOString();
    }
    this.flush();
    return status;
  }

  public markSolved(userId: string, problemId: string, solvedAt?: string): UserProblemStatus {
    let status = this.getProblemStatus(userId, problemId);
    const resolvedTime = solvedAt || new Date().toISOString();
    if (!status) {
      status = {
        id: 'ups_' + Math.random().toString(36).substring(2, 9),
        userId,
        problemId,
        status: 'SOLVED',
        startedAt: resolvedTime,
        solvedAt: resolvedTime
      };
      this.data.userProblemStatus.push(status);
    } else {
      status.status = 'SOLVED';
      status.solvedAt = resolvedTime;
      if (!status.startedAt) status.startedAt = resolvedTime;
    }
    this.flush();
    return status;
  }

  // --- Snapshots ---
  public getSnapshots(userId: string): UserSnapshot[] {
    return this.data.userSnapshots
      .filter(s => s.userId === userId)
      .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  }

  public saveSnapshot(snapshot: Omit<UserSnapshot, 'id' | 'createdAt'>): UserSnapshot {
    const idx = this.data.userSnapshots.findIndex(
      s => s.userId === snapshot.userId && s.platform === snapshot.platform && s.snapshotDate === snapshot.snapshotDate
    );
    if (idx >= 0) {
      this.data.userSnapshots[idx] = {
        ...this.data.userSnapshots[idx],
        ...snapshot
      };
      this.flush();
      return this.data.userSnapshots[idx];
    } else {
      const newSnap: UserSnapshot = {
        ...snapshot,
        id: 'snap_' + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString()
      };
      this.data.userSnapshots.push(newSnap);
      this.flush();
      return newSnap;
    }
  }

  // --- Daily Sync Counter ---
  public getDailySyncCount(userId: string, day: string): number {
    const entry = this.data.dailySyncCounters.find(c => c.userId === userId && c.day === day);
    return entry ? entry.count : 0;
  }

  public incrementDailySyncCount(userId: string, day: string): number {
    const entry = this.data.dailySyncCounters.find(c => c.userId === userId && c.day === day);
    if (entry) {
      entry.count += 1;
      this.flush();
      return entry.count;
    } else {
      this.data.dailySyncCounters.push({ userId, day, count: 1 });
      this.flush();
      return 1;
    }
  }

  // --- Sync Logs ---
  public addSyncLog(log: Omit<SyncLog, 'id'>) {
    const newLog: SyncLog = {
      ...log,
      id: 'log_' + Math.random().toString(36).substring(2, 9)
    };
    this.data.syncLogs.push(newLog);
    // Keep last 1000 logs
    if (this.data.syncLogs.length > 1000) {
      this.data.syncLogs = this.data.syncLogs.slice(-1000);
    }
    this.flush();
  }
}

export const db = new Database();
