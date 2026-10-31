import express, { Router, Response } from 'express';
import { db } from './db.js';
import { AuthService, requireAuth, requireAdmin, sanitizeUser, AuthenticatedRequest } from './services/auth.js';
import { VerificationService } from './services/verification.js';
import { syncService } from './services/syncService.js';
import { snapshotService } from './services/snapshotService.js';
import { leetcodeConnector } from './connectors/leetcode.js';
import { codeforcesConnector } from './connectors/codeforces.js';
import { Platform } from './types.js';

export const apiRouter = Router();

// --- Actuator Health Check ---
apiRouter.get('/actuator/health', (_req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// --- Public System Config ---
apiRouter.get('/config', (_req, res) => {
  res.json({});
});

// --- Authentication Endpoints ---
apiRouter.post('/auth/signup', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const passwordHash = AuthService.hashPassword(password);
    const user = db.createUser(name.trim(), email.trim(), passwordHash, 'USER');
    const token = AuthService.createSession(user.id);

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('codetrack_session', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: sanitizeUser(user), token });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = db.findUserByEmail(email.trim());
    if (!user || !AuthService.comparePassword(password, user.passwordHash, user.email)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = AuthService.createSession(user.id);
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('codetrack_session', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: sanitizeUser(user), token });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/auth/logout', (req: AuthenticatedRequest, res) => {
  const token = req.cookies?.codetrack_session;
  if (token) AuthService.destroySession(token);
  res.clearCookie('codetrack_session');
  res.json({ message: 'Logged out successfully.' });
});

apiRouter.get('/auth/me', (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  const links = db.getLinksForUser(req.user.id);
  res.json({ user: sanitizeUser(req.user), links });
});

// --- Platform Linking & Verification ---
apiRouter.get('/platforms', requireAuth, (req: AuthenticatedRequest, res) => {
  const links = db.getLinksForUser(req.user!.id);
  res.json({ links });
});

apiRouter.post('/platforms/link', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { platform, username } = req.body;
    if (!platform || !username) {
      res.status(400).json({ error: 'Platform and username are required.' });
      return;
    }
    if (platform !== 'LEETCODE' && platform !== 'CODEFORCES') {
      res.status(400).json({ error: 'Platform must be LEETCODE or CODEFORCES.' });
      return;
    }

    const link = await VerificationService.linkAccount(req.user!.id, platform, username);
    res.json({ link, message: `Account added. Verification code: ${link.verificationCode}` });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/platforms/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { platform, simulateVerification } = req.body;
    if (!platform) {
      res.status(400).json({ error: 'Platform is required.' });
      return;
    }

    const result = await VerificationService.verifyAccount(
      req.user!.id,
      platform,
      Boolean(simulateVerification)
    );
    res.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ error: error.message });
  }
});

apiRouter.delete('/platforms/:platform', requireAuth, (req: AuthenticatedRequest, res) => {
  const platform = req.params.platform.toUpperCase() as Platform;
  VerificationService.unlinkAccount(req.user!.id, platform);
  res.json({ message: `Unlinked ${platform} account.` });
});

// --- Practice Section ---
apiRouter.get('/practice/problems', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { platform, difficulty, topic, status, search, page = '1', limit = '20' } = req.query;

  let problems = db.getAllProblems().filter(p => p.active);
  const userStatuses = db.getUserProblemStatuses(userId);
  const statusMap = new Map(userStatuses.map(s => [s.problemId, s]));

  // Platform filter
  if (platform && platform !== 'ALL') {
    problems = problems.filter(p => p.platform === (platform as string).toUpperCase());
  }

  // Difficulty filter
  if (difficulty && difficulty !== 'ALL') {
    problems = problems.filter(p => p.difficulty.toLowerCase() === (difficulty as string).toLowerCase());
  }

  // Topic filter
  if (topic && topic !== 'ALL') {
    const searchTopic = (topic as string).toLowerCase();
    problems = problems.filter(p => p.topics.some(t => t.toLowerCase().includes(searchTopic)));
  }

  // Search filter
  if (search) {
    const query = (search as string).toLowerCase();
    problems = problems.filter(
      p =>
        p.title.toLowerCase().includes(query) ||
        p.externalId.toLowerCase().includes(query) ||
        p.topics.some(t => t.toLowerCase().includes(query))
    );
  }

  // Status filter (UNSOLVED / SOLVED)
  if (status === 'SOLVED') {
    problems = problems.filter(p => statusMap.get(p.id)?.status === 'SOLVED');
  } else if (status === 'UNSOLVED') {
    problems = problems.filter(p => statusMap.get(p.id)?.status !== 'SOLVED');
  }

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const total = problems.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedProblems = problems.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  const enrichedProblems = paginatedProblems.map(p => {
    const userStatus = statusMap.get(p.id);
    return {
      ...p,
      userStatus: userStatus ? userStatus.status : 'UNSOLVED',
      startedAt: userStatus?.startedAt,
      solvedAt: userStatus?.solvedAt
    };
  });

  // Extract all unique topics for filter dropdown
  const allTopicsSet = new Set<string>();
  for (const prob of db.getAllProblems()) {
    prob.topics.forEach(t => allTopicsSet.add(t));
  }

  res.json({
    problems: enrichedProblems,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      totalPages
    },
    allTopics: Array.from(allTopicsSet).sort()
  });
});

apiRouter.post('/practice/solve/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const problem = db.findProblemById(req.params.id);
  if (!problem) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }

  const status = db.markStarted(req.user!.id, problem.id);
  res.json({ message: 'Problem marked as started.', status, url: problem.url });
});

apiRouter.get('/practice/cooldown', requireAuth, (req: AuthenticatedRequest, res) => {
  const remaining = syncService.getRemainingCooldown(req.user!.id);
  const today = new Date().toISOString().split('T')[0];
  const dailyCount = db.getDailySyncCount(req.user!.id, today);
  res.json({
    remainingSeconds: remaining,
    dailyCount,
    dailyLimit: 50
  });
});

apiRouter.post('/practice/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetProblemId = req.body.problemId;
    const result = await syncService.syncUserSubmissions(req.user!.id, targetProblemId);
    res.json(result);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({
      error: err.message,
      remainingSeconds: err.remainingSeconds,
      dailyLimitReached: err.dailyLimitReached
    });
  }
});

// --- Dashboard & Analytics ---
apiRouter.get('/dashboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const links = db.getLinksForUser(userId);
  const verifiedLinks = links.filter(l => l.verified);

  if (verifiedLinks.length === 0) {
    res.json({
      empty: true,
      links,
      message: 'No verified platforms linked. Visit Profile to link your accounts.'
    });
    return;
  }

  // Aggregate user problem solving status
  const userStatuses = db.getUserProblemStatuses(userId);
  const solvedProblemIds = new Set(
    userStatuses.filter(s => s.status === 'SOLVED').map(s => s.problemId)
  );

  const allProblems = db.getAllProblems();
  let solvedEasy = 0;
  let solvedMed = 0;
  let solvedHard = 0;

  for (const p of allProblems) {
    if (solvedProblemIds.has(p.id)) {
      if (p.difficulty === 'Easy') solvedEasy++;
      else if (p.difficulty === 'Medium') solvedMed++;
      else if (p.difficulty === 'Hard') solvedHard++;
    }
  }

  // Get historical snapshots
  const snapshots = db.getSnapshots(userId);

  // Collect activity dates for heatmap & streaks
  const activityDates: string[] = [];
  const calendarHeatmap: Record<string, number> = {};

  // Gather live stats if available or from snapshots
  const platformStatsList = [];
  for (const link of verifiedLinks) {
    try {
      let stats;
      if (link.platform === 'LEETCODE') {
        stats = await leetcodeConnector.fetchStats(link.username);
      } else {
        stats = await codeforcesConnector.fetchStats(link.username);
      }

      platformStatsList.push({
        platform: link.platform,
        username: link.username,
        stats
      });

      // Merge calendar heatmap
      if (stats.submissionCalendar) {
        for (const [secStr, count] of Object.entries(stats.submissionCalendar)) {
          const dStr = new Date(Number(secStr) * 1000).toISOString().split('T')[0];
          calendarHeatmap[dStr] = (calendarHeatmap[dStr] || 0) + Number(count);
          activityDates.push(dStr);
        }
      }
    } catch (e) {
      // Fall back to snapshot info
      const latestSnap = [...snapshots].reverse().find(s => s.platform === link.platform);
      platformStatsList.push({
        platform: link.platform,
        username: link.username,
        stats: {
          totalSolved: latestSnap?.totalSolved || 0,
          easy: latestSnap?.easy || 0,
          medium: latestSnap?.medium || 0,
          hard: latestSnap?.hard || 0,
          rating: latestSnap?.rating,
          contests: latestSnap?.contests || 0
        }
      });
    }
  }

  // Add practice solved dates to activity
  for (const s of userStatuses) {
    if (s.solvedAt) {
      const d = s.solvedAt.split('T')[0];
      calendarHeatmap[d] = (calendarHeatmap[d] || 0) + 1;
      activityDates.push(d);
    }
  }

  const streaks = snapshotService.calculateStreaks(activityDates);

  res.json({
    empty: false,
    links,
    platformStats: platformStatsList,
    practiceStats: {
      totalSolved: solvedProblemIds.size,
      easy: solvedEasy,
      medium: solvedMed,
      hard: solvedHard,
      totalAvailable: allProblems.length
    },
    streaks,
    snapshots,
    calendarHeatmap
  });
});

// --- Admin Panel Endpoints ---
apiRouter.post('/admin/problems/preview', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    const trimmed = url.trim();
    let platform: Platform | null = null;
    let externalId = '';

    if (trimmed.includes('leetcode.com')) {
      platform = 'LEETCODE';
      const match = trimmed.match(/\/problems\/([^/?#]+)/);
      if (!match) {
        res.status(400).json({ error: 'Invalid LeetCode problem URL format. Expected: https://leetcode.com/problems/<slug>/' });
        return;
      }
      externalId = match[1];
    } else if (trimmed.includes('codeforces.com')) {
      platform = 'CODEFORCES';
      // Match /problemset/problem/<id>/<idx> or /contest/<id>/problem/<idx>
      const match1 = trimmed.match(/\/problemset\/problem\/(\d+)\/([a-zA-Z0-9]+)/);
      const match2 = trimmed.match(/\/contest\/(\d+)\/problem\/([a-zA-Z0-9]+)/);
      const match = match1 || match2;
      if (!match) {
        res.status(400).json({ error: 'Invalid Codeforces problem URL format. Expected: /problemset/problem/<id>/<idx> or /contest/<id>/problem/<idx>' });
        return;
      }
      externalId = `${match[1]}_${match[2].toUpperCase()}`;
    } else {
      res.status(400).json({ error: 'Unsupported URL. Must be a LeetCode or Codeforces URL.' });
      return;
    }

    // Check if already exists in DB
    const existing = db.findProblemByExternalId(platform, externalId);
    if (existing) {
      res.status(400).json({ error: `Problem already exists in CodeTrack (${platform}: ${existing.title})` });
      return;
    }

    // Auto-fetch details
    let title = externalId;
    let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
    let topics: string[] = [];

    try {
      if (platform === 'LEETCODE') {
        const details = await leetcodeConnector.fetchQuestion(externalId);
        if (details) {
          title = details.title;
          difficulty = details.difficulty;
          topics = details.topics;
        }
      } else {
        const details = await codeforcesConnector.fetchQuestion(externalId);
        if (details) {
          title = details.title;
          difficulty = details.difficulty;
          topics = details.topics;
        }
      }
    } catch {
      // Allow fallback if platform fetch had issue
    }

    res.json({
      platform,
      externalId,
      title,
      url: trimmed,
      difficulty,
      topics
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/admin/problems', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { platform, externalId, title, url, difficulty, topics, active = true } = req.body;
    if (!platform || !externalId || !title || !url || !difficulty) {
      res.status(400).json({ error: 'Missing required problem fields.' });
      return;
    }

    const problem = db.addProblem({
      platform,
      externalId,
      title: title.trim(),
      url: url.trim(),
      difficulty,
      topics: Array.isArray(topics) ? topics : [],
      active: Boolean(active),
      createdBy: req.user!.id
    });

    res.json({ problem, message: 'Problem added successfully.' });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/admin/problems/bulk', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) {
    res.status(400).json({ error: 'List of URLs is required.' });
    return;
  }

  const added: any[] = [];
  const duplicates: string[] = [];
  const failed: { url: string; reason: string }[] = [];

  for (const rawUrl of urls) {
    const trimmed = String(rawUrl).trim();
    if (!trimmed) continue;

    let platform: Platform | null = null;
    let externalId = '';

    if (trimmed.includes('leetcode.com')) {
      platform = 'LEETCODE';
      const m = trimmed.match(/\/problems\/([^/?#]+)/);
      if (m) externalId = m[1];
    } else if (trimmed.includes('codeforces.com')) {
      platform = 'CODEFORCES';
      const m1 = trimmed.match(/\/problemset\/problem\/(\d+)\/([a-zA-Z0-9]+)/);
      const m2 = trimmed.match(/\/contest\/(\d+)\/problem\/([a-zA-Z0-9]+)/);
      const m = m1 || m2;
      if (m) externalId = `${m[1]}_${m[2].toUpperCase()}`;
    }

    if (!platform || !externalId) {
      failed.push({ url: trimmed, reason: 'Unrecognized URL pattern' });
      continue;
    }

    if (db.findProblemByExternalId(platform, externalId)) {
      duplicates.push(trimmed);
      continue;
    }

    try {
      let title = externalId;
      let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
      let topics: string[] = ['Algorithms'];

      if (platform === 'LEETCODE') {
        const details = await leetcodeConnector.fetchQuestion(externalId);
        if (details) {
          title = details.title;
          difficulty = details.difficulty;
          topics = details.topics;
        }
      } else {
        const details = await codeforcesConnector.fetchQuestion(externalId);
        if (details) {
          title = details.title;
          difficulty = details.difficulty;
          topics = details.topics;
        }
      }

      const problem = db.addProblem({
        platform,
        externalId,
        title,
        url: trimmed,
        difficulty,
        topics,
        active: true,
        createdBy: req.user!.id
      });
      added.push(problem);
    } catch (err: unknown) {
      const error = err as Error;
      failed.push({ url: trimmed, reason: error.message });
    }
  }

  res.json({
    summary: {
      total: urls.length,
      addedCount: added.length,
      duplicatesCount: duplicates.length,
      failedCount: failed.length
    },
    added,
    duplicates,
    failed
  });
});

apiRouter.put('/admin/problems/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, difficulty, topics, active, url } = req.body;
    const updated = db.updateProblem(req.params.id, {
      title,
      difficulty,
      topics,
      active,
      url
    });
    res.json({ problem: updated, message: 'Problem updated successfully.' });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ error: error.message });
  }
});

apiRouter.patch('/admin/problems/:id/toggle', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const problem = db.findProblemById(req.params.id);
    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }
    const updated = db.updateProblem(problem.id, { active: !problem.active });
    res.json({ problem: updated, message: `Problem is now ${updated.active ? 'active' : 'inactive'}.` });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ error: error.message });
  }
});

apiRouter.delete('/admin/problems/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  db.deleteProblem(req.params.id);
  res.json({ message: 'Problem deleted successfully.' });
});

apiRouter.get('/admin/users', requireAdmin, (_req: AuthenticatedRequest, res) => {
  const users = db.getAllUsers().map(u => {
    const links = db.getLinksForUser(u.id);
    const statuses = db.getUserProblemStatuses(u.id);
    const solvedCount = statuses.filter(s => s.status === 'SOLVED').length;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      links: links.map(l => ({
        platform: l.platform,
        username: l.username,
        verified: l.verified,
        lastSyncedAt: l.lastSyncedAt
      })),
      solvedCount
    };
  });

  res.json({ users });
});

apiRouter.post('/admin/snapshots/run', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await snapshotService.runSnapshotsForAllVerifiedUsers();
    res.json({ message: `Snapshot completed. Processed ${result.processedUsers} accounts with ${result.errors} errors.` });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});
