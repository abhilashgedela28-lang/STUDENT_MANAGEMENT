import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Problem, Platform, Difficulty } from '../types/client.js';
import { PlusCircle, Layers, Users, Play, Trash2, CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { apiFetch } from '../utils/api.js';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  links: Array<{
    platform: Platform;
    username: string;
    verified: boolean;
    lastSyncedAt?: string;
  }>;
  solvedCount: number;
}

export const Admin: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'add' | 'bulk' | 'problems' | 'users'>('add');

  // Single Add form
  const [singleUrl, setSingleUrl] = useState('');
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    platform: Platform;
    externalId: string;
    title: string;
    url: string;
    difficulty: Difficulty;
    topics: string[];
  } | null>(null);

  // Bulk Add form
  const [bulkUrls, setBulkUrls] = useState('');
  const [processingBulk, setProcessingBulk] = useState(false);
  const [bulkReport, setBulkReport] = useState<{
    summary: { total: number; addedCount: number; duplicatesCount: number; failedCount: number };
    added: any[];
    duplicates: string[];
    failed: { url: string; reason: string }[];
  } | null>(null);

  // Problems list
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [problemSearch, setProblemSearch] = useState('');

  // Users list
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [runningSnapshot, setRunningSnapshot] = useState(false);

  // Status message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'problems') loadAllProblems();
    if (activeTab === 'users') loadAllUsers();
  }, [activeTab]);

  const loadAllProblems = async () => {
    setLoadingProblems(true);
    try {
      const res = await apiFetch('/api/practice/problems?limit=100');
      if (res.ok) {
        const data = await res.json();
        setProblems(data.problems);
      }
    } catch {
      // ignore
    } finally {
      setLoadingProblems(false);
    }
  };

  const loadAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiFetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      // ignore
    } finally {
      setLoadingUsers(false);
    }
  };

  // Preview URL
  const handlePreview = async () => {
    if (!singleUrl.trim()) return;
    setFetchingPreview(true);
    setMessage(null);
    setPreviewData(null);

    try {
      const res = await apiFetch('/api/admin/problems/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: singleUrl.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch problem preview.');

      setPreviewData(data);
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message });
    } finally {
      setFetchingPreview(false);
    }
  };

  // Save Single Problem
  const handleSaveProblem = async () => {
    if (!previewData) return;
    setMessage(null);

    try {
      const res = await apiFetch('/api/admin/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save problem.');

      setMessage({ type: 'success', text: `Problem '${previewData.title}' added successfully!` });
      setPreviewData(null);
      setSingleUrl('');
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message });
    }
  };

  // Process Bulk
  const handleBulkSubmit = async () => {
    const urls = bulkUrls
      .split('\n')
      .map(u => u.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setMessage({ type: 'error', text: 'Please enter at least one URL.' });
      return;
    }

    setProcessingBulk(true);
    setMessage(null);
    setBulkReport(null);

    try {
      const res = await apiFetch('/api/admin/problems/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk processing failed.');

      setBulkReport(data);
      setMessage({
        type: 'success',
        text: `Processed ${urls.length} URLs: ${data.summary.addedCount} added, ${data.summary.duplicatesCount} duplicates, ${data.summary.failedCount} failed.`
      });
      setBulkUrls('');
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message });
    } finally {
      setProcessingBulk(false);
    }
  };

  // Toggle active problem
  const handleToggleActive = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/problems/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        setProblems(prev => prev.map(p => (p.id === id ? { ...p, active: !p.active } : p)));
      }
    } catch {
      // ignore
    }
  };

  // Delete problem
  const handleDeleteProblem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this problem?')) return;
    try {
      const res = await apiFetch(`/api/admin/problems/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProblems(prev => prev.filter(p => p.id !== id));
        setMessage({ type: 'success', text: 'Problem deleted.' });
      }
    } catch {
      // ignore
    }
  };

  // Run Snapshots
  const handleRunSnapshots = async () => {
    setRunningSnapshot(true);
    setMessage(null);
    try {
      const res = await apiFetch('/api/admin/snapshots/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Snapshot job failed.');
      setMessage({ type: 'success', text: data.message });
      await loadAllUsers();
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message });
    } finally {
      setRunningSnapshot(false);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="max-w-md mx-auto py-16 text-center text-xs">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-900">Administrator Access Required</h2>
        <p className="text-slate-500 mt-1">You must be logged in as an administrator to view this console.</p>
      </div>
    );
  }

  const filteredProblems = problems.filter(
    p =>
      p.title.toLowerCase().includes(problemSearch.toLowerCase()) ||
      p.externalId.toLowerCase().includes(problemSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Console</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage practice problem catalog, monitor registered users, and trigger snapshot jobs.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-medium gap-6">
        <button
          onClick={() => setActiveTab('add')}
          className={`pb-3 flex items-center gap-1.5 transition-colors ${
            activeTab === 'add'
              ? 'border-b-2 border-slate-900 text-slate-900 font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add by URL</span>
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`pb-3 flex items-center gap-1.5 transition-colors ${
            activeTab === 'bulk'
              ? 'border-b-2 border-slate-900 text-slate-900 font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Bulk Import</span>
        </button>
        <button
          onClick={() => setActiveTab('problems')}
          className={`pb-3 flex items-center gap-1.5 transition-colors ${
            activeTab === 'problems'
              ? 'border-b-2 border-slate-900 text-slate-900 font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Problem Catalog ({problems.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 flex items-center gap-1.5 transition-colors ${
            activeTab === 'users'
              ? 'border-b-2 border-slate-900 text-slate-900 font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users & Snapshots</span>
        </button>
      </div>

      {/* Toast Alert */}
      {message && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: Add by URL */}
      {activeTab === 'add' && (
        <div className="max-w-2xl bg-white p-6 rounded-xl border border-slate-200 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Add Problem from URL</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste a LeetCode problem URL or Codeforces problem URL. The platform, slug, title, difficulty, and topics will be auto-detected.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. https://leetcode.com/problems/climbing-stairs/ or https://codeforces.com/contest/1/problem/A"
              value={singleUrl}
              onChange={e => setSingleUrl(e.target.value)}
              className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
            />
            <button
              onClick={handlePreview}
              disabled={fetchingPreview || !singleUrl.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shadow-xs"
            >
              {fetchingPreview ? 'Inspecting...' : 'Fetch Details'}
            </button>
          </div>

          {previewData && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3 pt-4">
              <h4 className="text-xs font-semibold text-slate-800">Review & Save Problem:</h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-500 font-medium">Platform</label>
                  <p className="font-semibold text-slate-900 mt-0.5">{previewData.platform}</p>
                </div>
                <div>
                  <label className="text-slate-500 font-medium">External ID</label>
                  <p className="font-mono text-slate-800 mt-0.5">{previewData.externalId}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium">Title</label>
                <input
                  type="text"
                  value={previewData.title}
                  onChange={e => setPreviewData({ ...previewData, title: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs border border-slate-200 rounded bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-500 font-medium">Difficulty</label>
                  <select
                    value={previewData.difficulty}
                    onChange={e =>
                      setPreviewData({
                        ...previewData,
                        difficulty: e.target.value as Difficulty
                      })
                    }
                    className="w-full mt-1 px-3 py-1.5 text-xs border border-slate-200 rounded bg-white"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 font-medium">Topics (comma separated)</label>
                  <input
                    type="text"
                    value={previewData.topics.join(', ')}
                    onChange={e =>
                      setPreviewData({
                        ...previewData,
                        topics: e.target.value
                          .split(',')
                          .map(t => t.trim())
                          .filter(Boolean)
                      })
                    }
                    className="w-full mt-1 px-3 py-1.5 text-xs border border-slate-200 rounded bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setPreviewData(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProblem}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs"
                >
                  Confirm & Add Problem
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Bulk Import */}
      {activeTab === 'bulk' && (
        <div className="max-w-3xl bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Bulk Import Problems</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter one problem URL per line. CodeTrack will parse each URL, check for duplicates, and auto-fetch metadata.
            </p>
          </div>

          <textarea
            rows={8}
            placeholder={`https://leetcode.com/problems/subsets/
https://leetcode.com/problems/word-search/
https://codeforces.com/problemset/problem/1352/A
https://codeforces.com/problemset/problem/580/A`}
            value={bulkUrls}
            onChange={e => setBulkUrls(e.target.value)}
            className="w-full p-3 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
          />

          <div className="flex justify-end">
            <button
              onClick={handleBulkSubmit}
              disabled={processingBulk || !bulkUrls.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shadow-xs"
            >
              {processingBulk ? 'Importing Batch...' : 'Process Batch Import'}
            </button>
          </div>

          {bulkReport && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
              <h4 className="font-semibold text-slate-800">Batch Report:</h4>
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-200 font-mono">
                <span className="text-emerald-700">Added: {bulkReport.summary.addedCount}</span>
                <span className="text-amber-700">Duplicates: {bulkReport.summary.duplicatesCount}</span>
                <span className="text-rose-700">Failed: {bulkReport.summary.failedCount}</span>
              </div>
              {bulkReport.failed.length > 0 && (
                <div className="space-y-1 text-rose-700">
                  <p className="font-medium">Failed URLs:</p>
                  {bulkReport.failed.map((f, i) => (
                    <div key={i} className="text-[11px] font-mono">
                      {f.url} — {f.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Problem Management */}
      {activeTab === 'problems' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-4">
          <div className="flex items-center justify-between gap-4">
            <input
              type="text"
              placeholder="Search catalog by title or identifier..."
              value={problemSearch}
              onChange={e => setProblemSearch(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-md w-72 bg-slate-50"
            />
            <span className="text-xs text-slate-500 font-mono">
              Showing {filteredProblems.length} of {problems.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3">Title</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3">Difficulty</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProblems.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-slate-900 hover:underline flex items-center gap-1"
                      >
                        {p.title}
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                      <span className="text-[11px] text-slate-400 font-mono">{p.externalId}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{p.platform}</td>
                    <td className="py-2.5 px-3">{p.difficulty}</td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleActive(p.id)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          p.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteProblem(p.id)}
                        className="text-rose-600 hover:text-rose-800 p-1"
                        title="Delete problem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Users & Snapshots */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Registered Users</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Passwords are fully hashed and cannot be viewed.
              </p>
            </div>
            <button
              onClick={handleRunSnapshots}
              disabled={runningSnapshot}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 shadow-xs whitespace-nowrap"
            >
              <Play className={`w-3.5 h-3.5 ${runningSnapshot ? 'animate-spin' : ''}`} />
              <span>{runningSnapshot ? 'Running Snapshot Job...' : 'Trigger Snapshots Now'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Linked Platforms</th>
                  <th className="py-2.5 px-3">Practice Solved</th>
                  <th className="py-2.5 px-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{u.email}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          u.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {u.links.length === 0 ? (
                        <span className="text-slate-400">None</span>
                      ) : (
                        <div className="space-y-0.5">
                          {u.links.map(l => (
                            <div key={l.platform} className="text-[11px] font-mono">
                              <strong>{l.platform}:</strong> {l.username}{' '}
                              {l.verified ? (
                                <span className="text-emerald-600 font-semibold">(Verified)</span>
                              ) : (
                                <span className="text-amber-600">(Unverified)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                      {u.solvedCount}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
