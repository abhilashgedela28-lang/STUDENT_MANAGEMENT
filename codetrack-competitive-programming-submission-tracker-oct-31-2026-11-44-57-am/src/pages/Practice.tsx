import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Problem, Platform, Difficulty } from '../types/client.js';
import { ExternalLink, RefreshCw, CheckCircle2, Clock, AlertCircle, Search, Filter, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../utils/api.js';

interface PracticeProps {
  onNavigate: (tab: string) => void;
}

export const Practice: React.FC<PracticeProps> = ({ onNavigate }) => {
  const { links } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncTargetId, setSyncTargetId] = useState<string | null>(null);

  // Filters
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');
  const [selectedTopic, setSelectedTopic] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalProblems, setTotalProblems] = useState<number>(0);

  // Rate Limiting & Cooldowns
  const [remainingCooldown, setRemainingCooldown] = useState<number>(0);
  const [dailySyncCount, setDailySyncCount] = useState<number>(0);
  const [dailyLimit, setDailyLimit] = useState<number>(50);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const verifiedLeetcode = links.find(l => l.platform === 'LEETCODE' && l.verified);
  const verifiedCodeforces = links.find(l => l.platform === 'CODEFORCES' && l.verified);
  const hasAnyVerified = Boolean(verifiedLeetcode || verifiedCodeforces);

  // Fetch Cooldown status
  const fetchCooldown = async () => {
    try {
      const res = await apiFetch('/api/practice/cooldown');
      if (res.ok) {
        const data = await res.json();
        setDailySyncCount(data.dailyCount || 0);
        setDailyLimit(data.dailyLimit || 50);
        if (data.remainingSeconds > 0) {
          startCountdown(data.remainingSeconds);
        }
      }
    } catch {
      // ignore
    }
  };

  const startCountdown = (seconds: number) => {
    setRemainingCooldown(seconds);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setRemainingCooldown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    fetchCooldown();
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const loadProblems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20'
      });
      if (selectedPlatform !== 'ALL') params.set('platform', selectedPlatform);
      if (selectedDifficulty !== 'ALL') params.set('difficulty', selectedDifficulty);
      if (selectedTopic !== 'ALL') params.set('topic', selectedTopic);
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await apiFetch(`/api/practice/problems?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProblems(data.problems);
        setTotalPages(data.pagination.totalPages);
        setTotalProblems(data.pagination.total);
        if (data.allTopics) setAllTopics(data.allTopics);
      }
    } catch (err) {
      console.error('Error fetching problems:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProblems();
  }, [selectedPlatform, selectedDifficulty, selectedTopic, selectedStatus, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadProblems();
  };

  const handleSolve = async (problem: Problem) => {
    // Open real problem URL in new tab immediately
    window.open(problem.url, '_blank', 'noopener,noreferrer');

    // Record 'started' status in database
    try {
      await apiFetch(`/api/practice/solve/${problem.id}`, { method: 'POST' });
      setProblems(prev =>
        prev.map(p =>
          p.id === problem.id && p.userStatus !== 'SOLVED'
            ? { ...p, userStatus: 'STARTED', startedAt: new Date().toISOString() }
            : p
        )
      );
    } catch (err) {
      console.warn('Failed to record started timestamp:', err);
    }
  };

  const handleSync = async (problemId?: string) => {
    if (!hasAnyVerified) {
      setToastMessage({
        type: 'info',
        text: 'You must link and verify your LeetCode or Codeforces account in your Profile before syncing.'
      });
      return;
    }

    if (remainingCooldown > 0) {
      setToastMessage({
        type: 'error',
        text: `Sync rate limit: Please wait ${remainingCooldown}s before syncing again.`
      });
      return;
    }

    setSyncing(true);
    setSyncTargetId(problemId || null);

    try {
      const res = await apiFetch('/api/practice/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.remainingSeconds) {
          startCountdown(data.remainingSeconds);
        }
        throw new Error(data.error || 'Sync failed.');
      }

      setToastMessage({
        type: 'success',
        text: data.message
      });

      if (data.remainingCooldown) {
        startCountdown(data.remainingCooldown);
      }
      setDailySyncCount(prev => prev + 1);

      // Reload problems to reflect newly solved statuses
      await loadProblems();
    } catch (err: unknown) {
      const error = err as Error;
      setToastMessage({
        type: 'error',
        text: error.message
      });
    } finally {
      setSyncing(false);
      setSyncTargetId(null);
    }
  };

  const difficultyBadge = (diff: Difficulty) => {
    switch (diff) {
      case 'Easy':
        return <span className="text-emerald-700 font-medium text-xs">Easy</span>;
      case 'Medium':
        return <span className="text-amber-700 font-medium text-xs">Medium</span>;
      case 'Hard':
        return <span className="text-rose-700 font-medium text-xs">Hard</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Practice Problems</h1>
          <p className="text-xs text-slate-500 mt-1">
            Solve problems on LeetCode and Codeforces, then sync your accepted submissions.
          </p>
        </div>

        {/* Sync All action and Cooldown Counter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-500 font-mono hidden sm:block">
            Daily Syncs: <strong className="text-slate-800">{dailySyncCount}</strong>/{dailyLimit}
          </div>
          <button
            onClick={() => handleSync()}
            disabled={syncing || remainingCooldown > 0}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-xs whitespace-nowrap ${
              remainingCooldown > 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing
              ? 'Syncing Submissions...'
              : remainingCooldown > 0
              ? `Cooldown (${remainingCooldown}s)`
              : 'Sync All Problems'}
          </button>
        </div>
      </div>

      {/* Unverified Warning Banner if no verified account */}
      {!hasAnyVerified && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Platform verification required:</strong> Link and verify your LeetCode or Codeforces account to enable submission checking.
            </span>
          </div>
          <button
            onClick={() => onNavigate('profile')}
            className="px-3 py-1.5 font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md whitespace-nowrap self-start sm:self-auto"
          >
            Go to Profile
          </button>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search problem title, slug, or topics..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Platform Filter */}
          <select
            value={selectedPlatform}
            onChange={e => {
              setSelectedPlatform(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">All Platforms</option>
            <option value="LEETCODE">LeetCode</option>
            <option value="CODEFORCES">Codeforces</option>
          </select>

          {/* Difficulty Filter */}
          <select
            value={selectedDifficulty}
            onChange={e => {
              setSelectedDifficulty(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNSOLVED">Unsolved Only</option>
            <option value="SOLVED">Solved Only</option>
          </select>

          {/* Topic Filter */}
          <select
            value={selectedTopic}
            onChange={e => {
              setSelectedTopic(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 max-w-[180px] truncate"
          >
            <option value="ALL">All Topics</option>
            {allTopics.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <span className="ml-auto text-slate-400 font-mono">
            {totalProblems} problem{totalProblems === 1 ? '' : 's'} found
          </span>
        </div>
      </div>

      {/* Problem Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Status</th>
                <th className="py-3 px-4">Problem</th>
                <th className="py-3 px-3 w-28">Platform</th>
                <th className="py-3 px-3 w-24">Difficulty</th>
                <th className="py-3 px-4 hidden md:table-cell">Topics</th>
                <th className="py-3 px-4 w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-500" />
                    Loading practice problem set...
                  </td>
                </tr>
              ) : problems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No problems match your selected criteria.
                  </td>
                </tr>
              ) : (
                problems.map(problem => {
                  const isSolved = problem.userStatus === 'SOLVED';
                  const isStarted = problem.userStatus === 'STARTED';
                  const isPlatformVerified =
                    problem.platform === 'LEETCODE' ? Boolean(verifiedLeetcode) : Boolean(verifiedCodeforces);

                  return (
                    <tr
                      key={problem.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSolved ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Status Icon */}
                      <td className="py-3 px-4 text-center">
                        {isSolved ? (
                          <div title={`Solved on ${new Date(problem.solvedAt!).toLocaleDateString()}`}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                          </div>
                        ) : isStarted ? (
                          <div title="Started">
                            <Clock className="w-4 h-4 text-amber-500 mx-auto" />
                          </div>
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full border border-slate-300 mx-auto" />
                        )}
                      </td>

                      {/* Problem Title & External Link */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <a
                            href={problem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center gap-1"
                          >
                            <span>{problem.title}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                          </a>
                        </div>
                        {isSolved && problem.solvedAt && (
                          <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                            Solved on {new Date(problem.solvedAt).toLocaleDateString()}
                          </div>
                        )}
                        {!isSolved && isStarted && problem.startedAt && (
                          <div className="text-[11px] text-amber-600 font-mono mt-0.5">
                            Started on {new Date(problem.startedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Platform */}
                      <td className="py-3 px-3">
                        <span className="font-mono text-slate-600 text-[11px]">
                          {problem.platform === 'LEETCODE' ? 'LeetCode' : 'Codeforces'}
                        </span>
                      </td>

                      {/* Difficulty */}
                      <td className="py-3 px-3">{difficultyBadge(problem.difficulty)}</td>

                      {/* Topics (unboxed text with typographic separators) */}
                      <td className="py-3 px-4 hidden md:table-cell text-slate-500">
                        {problem.topics.slice(0, 3).map((topic, i) => (
                          <span key={topic}>
                            {i > 0 && <span className="mx-1 text-slate-300">·</span>}
                            <span>{topic}</span>
                          </span>
                        ))}
                        {problem.topics.length > 3 && (
                          <span className="text-slate-400 text-[11px] ml-1">
                            +{problem.topics.length - 3}
                          </span>
                        )}
                      </td>

                      {/* Actions: Solve (target=_blank) & Sync */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSolve(problem)}
                            title="Open problem in new tab and mark started"
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>Solve</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>

                          <button
                            onClick={() => handleSync(problem.id)}
                            disabled={isSolved || syncing || remainingCooldown > 0}
                            title={
                              isSolved
                                ? 'Already solved'
                                : !isPlatformVerified
                                ? `Verify your ${problem.platform} account in Profile to sync`
                                : remainingCooldown > 0
                                ? `Cooldown (${remainingCooldown}s remaining)`
                                : 'Check accepted submission status'
                            }
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
                              isSolved
                                ? 'text-emerald-700 bg-emerald-50 cursor-default border border-emerald-200'
                                : !isPlatformVerified
                                ? 'text-slate-400 bg-slate-50 border border-slate-200 cursor-not-allowed'
                                : remainingCooldown > 0
                                ? 'text-slate-400 bg-slate-100 cursor-not-allowed border border-slate-200'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                syncing && syncTargetId === problem.id ? 'animate-spin' : ''
                              }`}
                            />
                            <span>{isSolved ? 'Solved' : 'Sync'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 text-slate-700 font-medium"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 text-slate-700 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Helpful note about LeetCode public submissions limit */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">Note on LeetCode Sync:</strong> LeetCode makes the latest ~20 accepted submissions publicly readable without personal session credentials. If a problem was solved long ago, re-submitting an accepted solution will immediately bring it to the top of your recent list for synchronization.
      </div>
    </div>
  );
};
