import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { DashboardData } from '../types/client.js';
import { Charts } from '../components/Charts.js';
import { Flame, Trophy, CheckCircle2, RefreshCw, Link as LinkIcon, ExternalLink, Code2 } from 'lucide-react';
import { apiFetch } from '../utils/api.js';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setError(null);
      const res = await apiFetch('/api/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load dashboard data');
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-28 bg-slate-200 rounded-xl"></div>
            <div className="h-28 bg-slate-200 rounded-xl"></div>
            <div className="h-28 bg-slate-200 rounded-xl"></div>
            <div className="h-28 bg-slate-200 rounded-xl"></div>
          </div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (data?.empty || !data || data.links.filter(l => l.verified).length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <LinkIcon className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">No Verified Platforms Linked Yet</h2>
        <p className="text-slate-600 mt-2 max-w-md mx-auto text-sm leading-relaxed">
          Link your LeetCode or Codeforces account and complete ownership verification to unlock real-time submission syncing, activity heatmaps, and rating analytics.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => onNavigate('profile')}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            Go to Profile & Link Platforms
          </button>
          <button
            onClick={() => onNavigate('practice')}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Explore Practice Problems
          </button>
        </div>
      </div>
    );
  }

  // Calculate summary figures
  const leetcodeLink = data.links.find(l => l.platform === 'LEETCODE' && l.verified);
  const codeforcesLink = data.links.find(l => l.platform === 'CODEFORCES' && l.verified);

  const lcStats = data.platformStats.find(p => p.platform === 'LEETCODE')?.stats;
  const cfStats = data.platformStats.find(p => p.platform === 'CODEFORCES')?.stats;

  const totalOverallSolved = (lcStats?.totalSolved || 0) + (cfStats?.totalSolved || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header with Title and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Personal Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Tracking profile for <span className="font-semibold text-slate-700">{user?.name}</span> ({user?.email})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-slate-900' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Stats'}</span>
          </button>
          <button
            onClick={() => onNavigate('practice')}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Practice Problems</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* KPI Stat Cards (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Solved */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Solved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-bold font-mono text-slate-900">{totalOverallSolved}</span>
            <span className="text-xs text-slate-500 ml-1.5">across platforms</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-2 border-t border-slate-100 font-mono">
            <span>LC: {lcStats?.totalSolved || 0}</span>
            <span>·</span>
            <span>CF: {cfStats?.totalSolved || 0}</span>
            <span>·</span>
            <span>Practice: {data.practiceStats.totalSolved}</span>
          </div>
        </div>

        {/* Card 2: Current Streak */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Current Streak</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-bold font-mono text-slate-900">{data.streaks.currentStreak}</span>
            <span className="text-xs text-slate-500 ml-1.5">consecutive days</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 font-mono">
            Longest recorded: <strong className="text-slate-800">{data.streaks.longestStreak} days</strong>
          </div>
        </div>

        {/* Card 3: Codeforces Rating */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Codeforces Rating</span>
            <Trophy className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-bold font-mono text-slate-900">
              {cfStats?.rating ? cfStats.rating : 'Unrated'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 font-mono">
            {codeforcesLink ? (
              <span>Handle: <strong className="text-slate-800">{codeforcesLink.username}</strong></span>
            ) : (
              <span className="text-slate-400">Not linked</span>
            )}
          </div>
        </div>

        {/* Card 4: LeetCode Ranking */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>LeetCode Contest</span>
            <Trophy className="w-4 h-4 text-amber-600" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-bold font-mono text-slate-900">
              {lcStats?.rating ? lcStats.rating : lcStats ? 'Active' : 'Unrated'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 font-mono">
            {leetcodeLink ? (
              <span>Contests: <strong className="text-slate-800">{lcStats?.contests || 0}</strong></span>
            ) : (
              <span className="text-slate-400">Not linked</span>
            )}
          </div>
        </div>
      </div>

      {/* Linked Accounts Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-900">LeetCode:</span>
            {leetcodeLink ? (
              <a
                href={`https://leetcode.com/${leetcodeLink.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-indigo-600 font-mono flex items-center gap-1"
              >
                {leetcodeLink.username}
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ) : (
              <span className="text-slate-400">Unlinked</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-900">Codeforces:</span>
            {codeforcesLink ? (
              <a
                href={`https://codeforces.com/profile/${codeforcesLink.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-indigo-600 font-mono flex items-center gap-1"
              >
                {codeforcesLink.username}
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ) : (
              <span className="text-slate-400">Unlinked</span>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Last synced:{' '}
          {leetcodeLink?.lastSyncedAt || codeforcesLink?.lastSyncedAt
            ? new Date(
                (leetcodeLink?.lastSyncedAt || codeforcesLink?.lastSyncedAt)!
              ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Never'}
        </div>
      </div>

      {/* Interactive Charts & Deep Analytics */}
      <Charts
        snapshots={data.snapshots}
        calendarHeatmap={data.calendarHeatmap}
        practiceStats={data.practiceStats}
        platformStats={data.platformStats}
      />
    </div>
  );
};
