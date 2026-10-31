import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
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

const getDatabaseUrl = (): string => {
  const raw = process.env.DB_URL || process.env.DATABASE_URL || 'postgresql://codetrack:codetrack@localhost:5432/codetrack';
  if (raw.startsWith('jdbc:postgresql://')) {
    return raw.replace(/^jdbc:postgresql:\/\//i, 'postgresql://');
  }
  return raw;
};

const DATABASE_URL = getDatabaseUrl();

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase.com') || DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10
});

const INITIAL_PROBLEMS: Omit<Problem, 'id' | 'createdAt'>[] = [
  { platform: 'LEETCODE', externalId: 'two-sum', title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/', difficulty: 'Easy', topics: ['Array', 'Hash Table'], active: true },
  { platform: 'LEETCODE', externalId: 'valid-parentheses', title: 'Valid Parentheses', url: 'https://leetcode.com/problems/valid-parentheses/', difficulty: 'Easy', topics: ['String', 'Stack'], active: true },
  { platform: 'LEETCODE', externalId: 'merge-two-sorted-lists', title: 'Merge Two Sorted Lists', url: 'https://leetcode.com/problems/merge-two-sorted-lists/', difficulty: 'Easy', topics: ['Linked List', 'Recursion'], active: true },
  { platform: 'LEETCODE', externalId: 'best-time-to-buy-and-sell-stock', title: 'Best Time to Buy and Sell Stock', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/', difficulty: 'Easy', topics: ['Array', 'Dynamic Programming'], active: true },
  { platform: 'LEETCODE', externalId: 'invert-binary-tree', title: 'Invert Binary Tree', url: 'https://leetcode.com/problems/invert-binary-tree/', difficulty: 'Easy', topics: ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'], active: true },
  { platform: 'LEETCODE', externalId: 'longest-substring-without-repeating-characters', title: 'Longest Substring Without Repeating Characters', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', difficulty: 'Medium', topics: ['Hash Table', 'Sliding Window', 'String'], active: true },
  { platform: 'LEETCODE', externalId: '3sum', title: '3Sum', url: 'https://leetcode.com/problems/3sum/', difficulty: 'Medium', topics: ['Array', 'Two Pointers', 'Sorting'], active: true },
  { platform: 'LEETCODE', externalId: 'container-with-most-water', title: 'Container With Most Water', url: 'https://leetcode.com/problems/container-with-most-water/', difficulty: 'Medium', topics: ['Array', 'Two Pointers', 'Greedy'], active: true },
  { platform: 'LEETCODE', externalId: 'group-anagrams', title: 'Group Anagrams', url: 'https://leetcode.com/problems/group-anagrams/', difficulty: 'Medium', topics: ['Array', 'Hash Table', 'String', 'Sorting'], active: true },
  { platform: 'LEETCODE', externalId: 'trapping-rain-water', title: 'Trapping Rain Water', url: 'https://leetcode.com/problems/trapping-rain-water/', difficulty: 'Hard', topics: ['Array', 'Two Pointers', 'Dynamic Programming', 'Stack', 'Monotonic Stack'], active: true },
  { platform: 'CODEFORCES', externalId: '4_A', title: 'Watermelon', url: 'https://codeforces.com/problemset/problem/4/A', difficulty: 'Easy', topics: ['brute force', 'math'], active: true },
  { platform: 'CODEFORCES', externalId: '71_A', title: 'Way Too Long Words', url: 'https://codeforces.com/problemset/problem/71/A', difficulty: 'Easy', topics: ['strings'], active: true },
  { platform: 'CODEFORCES', externalId: '231_A', title: 'Team', url: 'https://codeforces.com/problemset/problem/231/A', difficulty: 'Easy', topics: ['brute force', 'greedy'], active: true },
  { platform: 'CODEFORCES', externalId: '158_A', title: 'Next Round', url: 'https://codeforces.com/problemset/problem/158/A', difficulty: 'Easy', topics: ['special problem', 'implementation'], active: true },
  { platform: 'CODEFORCES', externalId: '263_A', title: 'Beautiful Matrix', url: 'https://codeforces.com/problemset/problem/263/A', difficulty: 'Easy', topics: ['implementation'], active: true },
  { platform: 'CODEFORCES', externalId: '1_A', title: 'Theatre Square', url: 'https://codeforces.com/problemset/problem/1/A', difficulty: 'Medium', topics: ['math'], active: true },
  { platform: 'CODEFORCES', externalId: '118_A', title: 'String Task', url: 'https://codeforces.com/problemset/problem/118/A', difficulty: 'Medium', topics: ['implementation', 'strings'], active: true },
  { platform: 'CODEFORCES', externalId: '96_A', title: 'Football', url: 'https://codeforces.com/problemset/problem/96/A', difficulty: 'Medium', topics: ['implementation', 'strings'], active: true },
  { platform: 'CODEFORCES', externalId: '69_A', title: 'Young Physicist', url: 'https://codeforces.com/problemset/problem/69/A', difficulty: 'Medium', topics: ['math', 'implementation'], active: true },
  { platform: 'CODEFORCES', externalId: '479_A', title: 'Expression', url: 'https://codeforces.com/problemset/problem/479/A', difficulty: 'Hard', topics: ['brute force', 'math'], active: true },
];

const parseTopics = (value: string | string[] | null | undefined): string[] => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to comma split
  }

  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const serializeTopics = (topics: string[]): string => JSON.stringify(topics);

const rowToUser = (row: any): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  passwordHash: row.password_hash,
  role: row.role,
  createdAt: row.created_at
});

const rowToPlatformLink = (row: any): PlatformLink => ({
  id: row.id,
  userId: row.user_id,
  platform: row.platform,
  username: row.username,
  verificationCode: row.verification_code ?? undefined,
  codeExpiresAt: row.code_expires_at ?? undefined,
  verified: row.verified,
  verifiedAt: row.verified_at ?? undefined,
  lastSyncedAt: row.last_synced_at ?? undefined,
});

const rowToProblem = (row: any): Problem => ({
  id: row.id,
  platform: row.platform,
  externalId: row.external_id,
  title: row.title,
  url: row.url,
  difficulty: row.difficulty as Difficulty,
  topics: parseTopics(row.topics),
  active: row.active,
  createdBy: row.created_by ?? undefined,
  createdAt: row.created_at,
});

const rowToUserProblemStatus = (row: any): UserProblemStatus => ({
  id: row.id,
  userId: row.user_id,
  problemId: row.problem_id,
  status: row.status,
  startedAt: row.started_at ?? undefined,
  solvedAt: row.solved_at ?? undefined,
});

const rowToUserSnapshot = (row: any): UserSnapshot => ({
  id: row.id,
  userId: row.user_id,
  platform: row.platform,
  snapshotDate: row.snapshot_date,
  totalSolved: Number(row.total_solved),
  easy: Number(row.easy),
  medium: Number(row.medium),
  hard: Number(row.hard),
  rating: row.rating ?? undefined,
  contests: row.contests ?? undefined,
  createdAt: row.created_at,
});

const rowToSyncLog = (row: any): SyncLog => ({
  id: row.id,
  userId: row.user_id,
  requestedAt: row.requested_at,
  result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result
});

class Database {
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.init();
  }

  private async query<T extends Record<string, any> = any>(text: string, params: any[] = []): Promise<{ rows: T[] }> {
    return pool.query<T>(text, params);
  }

  private async init() {
    await this.ensureSchema();
    await this.seedDefaultAdmin();
    await this.seedStarterProblems();
  }

  private async ensureSchema() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'USER',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS platform_links (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(32) NOT NULL,
        username VARCHAR(255) NOT NULL,
        verification_code VARCHAR(32),
        code_expires_at TIMESTAMPTZ,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        verified_at TIMESTAMPTZ,
        last_synced_at TIMESTAMPTZ,
        CONSTRAINT uq_user_platform UNIQUE(user_id, platform)
      );
    `);

    await this.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_links_verified_username
      ON platform_links(platform, lower(username))
      WHERE verified = true;
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS problems (
        id VARCHAR(64) PRIMARY KEY,
        platform VARCHAR(32) NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        difficulty VARCHAR(32) NOT NULL,
        topics TEXT NOT NULL DEFAULT '[]',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_platform_external_id UNIQUE(platform, external_id)
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS user_problem_status (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        problem_id VARCHAR(64) NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        status VARCHAR(32) NOT NULL,
        started_at TIMESTAMPTZ,
        solved_at TIMESTAMPTZ,
        CONSTRAINT uq_user_problem UNIQUE(user_id, problem_id)
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS user_snapshots (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(32) NOT NULL,
        snapshot_date DATE NOT NULL,
        total_solved INT NOT NULL DEFAULT 0,
        easy INT NOT NULL DEFAULT 0,
        medium INT NOT NULL DEFAULT 0,
        hard INT NOT NULL DEFAULT 0,
        rating INT,
        contests INT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_user_platform_snapshot_date UNIQUE(user_id, platform, snapshot_date)
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_at TIMESTAMPTZ DEFAULT NOW(),
        result JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS daily_sync_counter (
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day DATE NOT NULL,
        count INT NOT NULL DEFAULT 0,
        PRIMARY KEY(user_id, day)
      );
    `);

    await this.query(`CREATE INDEX IF NOT EXISTS idx_platform_links_user ON platform_links(user_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_user_problem_status_user ON user_problem_status(user_id);`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_user_snapshots_user_platform ON user_snapshots(user_id, platform);`);
    await this.query(`CREATE INDEX IF NOT EXISTS idx_problems_platform_active ON problems(platform, active);`);
  }

  private async seedDefaultAdmin() {
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
      const existing = await this.findUserByEmail(cleanEmail);
      if (existing) {
        await this.query(
          `UPDATE users SET role = 'ADMIN', password_hash = $1 WHERE lower(email) = lower($2)`,
          [passwordHash, cleanEmail]
        );
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
        await this.createUser(admin.name, admin.email, admin.passwordHash, 'ADMIN');
        console.log(`[CodeTrack] Seeded administrator user: ${cleanEmail}`);
      }
    }

    await this.query(`DELETE FROM users WHERE lower(email) = lower('admin@codetrack.dev')`);
  }

  private async seedStarterProblems() {
    for (const starter of INITIAL_PROBLEMS) {
      const exists = await this.query(
        `SELECT 1 FROM problems WHERE platform = $1 AND lower(external_id) = lower($2) LIMIT 1`,
        [starter.platform, starter.externalId]
      );
      if (exists.rows.length === 0) {
        await this.addProblem(starter);
      }
    }
  }

  public async findUserByEmail(email: string): Promise<User | undefined> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1`, [email]);
    return result.rows[0] ? rowToUser(result.rows[0]) : undefined;
  }

  public async findUserById(id: string): Promise<User | undefined> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]);
    return result.rows[0] ? rowToUser(result.rows[0]) : undefined;
  }

  public async getAllUsers(): Promise<User[]> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM users ORDER BY created_at ASC`);
    return result.rows.map(rowToUser);
  }

  public async createUser(name: string, email: string, passwordHash: string, role: 'USER' | 'ADMIN' = 'USER'): Promise<User> {
    await this.readyPromise;
    if (await this.findUserByEmail(email)) {
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

    await this.query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [user.id, user.name, user.email, user.passwordHash, user.role]
    );
    return user;
  }

  public async getLinksForUser(userId: string): Promise<PlatformLink[]> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM platform_links WHERE user_id = $1 ORDER BY platform ASC`, [userId]);
    return result.rows.map(rowToPlatformLink);
  }

  public async getLink(userId: string, platform: Platform): Promise<PlatformLink | undefined> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM platform_links WHERE user_id = $1 AND platform = $2 LIMIT 1`, [userId, platform]);
    return result.rows[0] ? rowToPlatformLink(result.rows[0]) : undefined;
  }

  public async findVerifiedLinkByUsername(platform: Platform, username: string): Promise<PlatformLink | undefined> {
    await this.readyPromise;
    const result = await this.query(
      `SELECT * FROM platform_links WHERE platform = $1 AND verified = true AND lower(username) = lower($2) LIMIT 1`,
      [platform, username]
    );
    return result.rows[0] ? rowToPlatformLink(result.rows[0]) : undefined;
  }

  public async saveLink(link: PlatformLink): Promise<void> {
    await this.readyPromise;
    await this.query(
      `INSERT INTO platform_links (id, user_id, platform, username, verification_code, code_expires_at, verified, verified_at, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, platform)
       DO UPDATE SET username = EXCLUDED.username,
                     verification_code = EXCLUDED.verification_code,
                     code_expires_at = EXCLUDED.code_expires_at,
                     verified = EXCLUDED.verified,
                     verified_at = EXCLUDED.verified_at,
                     last_synced_at = EXCLUDED.last_synced_at`,
      [
        link.id,
        link.userId,
        link.platform,
        link.username,
        link.verificationCode ?? null,
        link.codeExpiresAt ?? null,
        link.verified,
        link.verifiedAt ?? null,
        link.lastSyncedAt ?? null
      ]
    );
  }

  public async removeLink(userId: string, platform: Platform): Promise<void> {
    await this.readyPromise;
    await this.query(`DELETE FROM platform_links WHERE user_id = $1 AND platform = $2`, [userId, platform]);
  }

  public async getAllProblems(): Promise<Problem[]> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM problems ORDER BY created_at ASC`);
    return result.rows.map(rowToProblem);
  }

  public async findProblemById(id: string): Promise<Problem | undefined> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM problems WHERE id = $1 LIMIT 1`, [id]);
    return result.rows[0] ? rowToProblem(result.rows[0]) : undefined;
  }

  public async findProblemByExternalId(platform: Platform, externalId: string): Promise<Problem | undefined> {
    await this.readyPromise;
    const result = await this.query(
      `SELECT * FROM problems WHERE platform = $1 AND lower(external_id) = lower($2) LIMIT 1`,
      [platform, externalId]
    );
    return result.rows[0] ? rowToProblem(result.rows[0]) : undefined;
  }

  public async addProblem(problem: Omit<Problem, 'id' | 'createdAt'>): Promise<Problem> {
    await this.readyPromise;
    const existing = await this.findProblemByExternalId(problem.platform, problem.externalId);
    if (existing) {
      throw new Error(`Problem already exists for ${problem.platform} with identifier ${problem.externalId}`);
    }

    const newProblem: Problem = {
      ...problem,
      id: 'prob_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };

    await this.query(
      `INSERT INTO problems (id, platform, external_id, title, url, difficulty, topics, active, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [newProblem.id, newProblem.platform, newProblem.externalId, newProblem.title, newProblem.url, newProblem.difficulty, serializeTopics(newProblem.topics), newProblem.active, newProblem.createdBy ?? null]
    );

    return newProblem;
  }

  public async updateProblem(id: string, updates: Partial<Problem>): Promise<Problem> {
    await this.readyPromise;
    const existing = await this.findProblemById(id);
    if (!existing) throw new Error('Problem not found');

    const current = { ...existing, ...updates };
    await this.query(
      `UPDATE problems SET
         title = $2,
         url = $3,
         difficulty = $4,
         topics = $5,
         active = $6,
         created_by = $7
       WHERE id = $1`,
      [id, current.title, current.url, current.difficulty, serializeTopics(current.topics), current.active, current.createdBy ?? null]
    );

    const updated = await this.findProblemById(id);
    if (!updated) throw new Error('Problem not found after update');
    return updated;
  }

  public async deleteProblem(id: string): Promise<void> {
    await this.readyPromise;
    await this.query(`DELETE FROM user_problem_status WHERE problem_id = $1`, [id]);
    await this.query(`DELETE FROM problems WHERE id = $1`, [id]);
  }

  public async getUserProblemStatuses(userId: string): Promise<UserProblemStatus[]> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM user_problem_status WHERE user_id = $1 ORDER BY started_at ASC NULLS LAST`, [userId]);
    return result.rows.map(rowToUserProblemStatus);
  }

  public async getProblemStatus(userId: string, problemId: string): Promise<UserProblemStatus | undefined> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM user_problem_status WHERE user_id = $1 AND problem_id = $2 LIMIT 1`, [userId, problemId]);
    return result.rows[0] ? rowToUserProblemStatus(result.rows[0]) : undefined;
  }

  public async markStarted(userId: string, problemId: string): Promise<UserProblemStatus> {
    await this.readyPromise;
    const status = await this.getProblemStatus(userId, problemId);

    if (!status) {
      const newStatus: UserProblemStatus = {
        id: 'ups_' + Math.random().toString(36).substring(2, 9),
        userId,
        problemId,
        status: 'STARTED',
        startedAt: new Date().toISOString(),
      };
      await this.query(
        `INSERT INTO user_problem_status (id, user_id, problem_id, status, started_at, solved_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newStatus.id, userId, problemId, newStatus.status, newStatus.startedAt, null]
      );
      return newStatus;
    }

    if (status.status !== 'SOLVED') {
      const startedAt = status.startedAt || new Date().toISOString();
      await this.query(
        `UPDATE user_problem_status SET status = 'STARTED', started_at = COALESCE(started_at, $3) WHERE user_id = $1 AND problem_id = $2`,
        [userId, problemId, startedAt]
      );
      return { ...status, status: 'STARTED', startedAt };
    }

    return status;
  }

  public async markSolved(userId: string, problemId: string, solvedAt?: string): Promise<UserProblemStatus> {
    await this.readyPromise;
    const resolvedTime = solvedAt || new Date().toISOString();
    const status = await this.getProblemStatus(userId, problemId);

    if (!status) {
      const newStatus: UserProblemStatus = {
        id: 'ups_' + Math.random().toString(36).substring(2, 9),
        userId,
        problemId,
        status: 'SOLVED',
        startedAt: resolvedTime,
        solvedAt: resolvedTime,
      };
      await this.query(
        `INSERT INTO user_problem_status (id, user_id, problem_id, status, started_at, solved_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newStatus.id, userId, problemId, newStatus.status, newStatus.startedAt, newStatus.solvedAt]
      );
      return newStatus;
    }

    await this.query(
      `UPDATE user_problem_status SET status = 'SOLVED', solved_at = $3, started_at = COALESCE(started_at, $3) WHERE user_id = $1 AND problem_id = $2`,
      [userId, problemId, resolvedTime]
    );

    return { ...status, status: 'SOLVED', startedAt: status.startedAt || resolvedTime, solvedAt: resolvedTime };
  }

  public async getSnapshots(userId: string): Promise<UserSnapshot[]> {
    await this.readyPromise;
    const result = await this.query(`SELECT * FROM user_snapshots WHERE user_id = $1 ORDER BY snapshot_date ASC`, [userId]);
    return result.rows.map(rowToUserSnapshot);
  }

  public async saveSnapshot(snapshot: Omit<UserSnapshot, 'id' | 'createdAt'>): Promise<UserSnapshot> {
    await this.readyPromise;
    const newSnap: UserSnapshot = {
      ...snapshot,
      id: 'snap_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };

    await this.query(
      `INSERT INTO user_snapshots (id, user_id, platform, snapshot_date, total_solved, easy, medium, hard, rating, contests, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (user_id, platform, snapshot_date)
       DO UPDATE SET total_solved = EXCLUDED.total_solved,
                     easy = EXCLUDED.easy,
                     medium = EXCLUDED.medium,
                     hard = EXCLUDED.hard,
                     rating = EXCLUDED.rating,
                     contests = EXCLUDED.contests`,
      [newSnap.id, newSnap.userId, newSnap.platform, newSnap.snapshotDate, newSnap.totalSolved, newSnap.easy, newSnap.medium, newSnap.hard, newSnap.rating ?? null, newSnap.contests ?? null]
    );

    return newSnap;
  }

  public async getDailySyncCount(userId: string, day: string): Promise<number> {
    await this.readyPromise;
    const result = await this.query(`SELECT count FROM daily_sync_counter WHERE user_id = $1 AND day = $2 LIMIT 1`, [userId, day]);
    return result.rows[0]?.count ?? 0;
  }

  public async incrementDailySyncCount(userId: string, day: string): Promise<number> {
    await this.readyPromise;
    const current = await this.getDailySyncCount(userId, day);
    const next = current + 1;

    await this.query(
      `INSERT INTO daily_sync_counter (user_id, day, count)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, day)
       DO UPDATE SET count = EXCLUDED.count`,
      [userId, day, next]
    );

    return next;
  }

  public async addSyncLog(log: Omit<SyncLog, 'id'>): Promise<void> {
    await this.readyPromise;
    const newLog: SyncLog = {
      ...log,
      id: 'log_' + Math.random().toString(36).substring(2, 9),
    };

    await this.query(
      `INSERT INTO sync_log (id, user_id, requested_at, result)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [newLog.id, newLog.userId, newLog.requestedAt, JSON.stringify(newLog.result)]
    );
  }
}

export const db = new Database();
