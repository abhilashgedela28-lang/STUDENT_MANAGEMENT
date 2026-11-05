import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  Filter, 
  Clock, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  ShieldAlert 
} from 'lucide-react';

export default function PracticePage() {
  const [problems, setProblems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [allTopics, setAllTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState('ALL');
  const [topicFilter, setTopicFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state & cooldown
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [perProblemLoading, setPerProblemLoading] = useState({});

  useEffect(() => {
    fetchProblems();
  }, [page, platformFilter, difficultyFilter, topicFilter, statusFilter]);

  // Live countdown timer for rate limiting
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/practice', {
        params: {
          page,
          limit: 20,
          platform: platformFilter,
          difficulty: difficultyFilter,
          topic: topicFilter,
          status: statusFilter,
          search: searchQuery,
        },
      });

      if (res.data.success) {
        setProblems(res.data.problems);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setAllTopics(res.data.allTopics || []);
        if (res.data.cooldownRemaining > 0) {
          setCooldownSeconds(res.data.cooldownRemaining);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProblems();
  };

  const handleSolveClick = async (problem) => {
    // Open in new tab immediately
    window.open(problem.url, '_blank', 'noopener,noreferrer');

    // Record 'STARTED' in background if not already solved
    if (problem.status !== 'SOLVED') {
      try {
        await api.post(`/practice/${problem.id}/solve`);
        setProblems((prev) =>
          prev.map((p) => (p.id === problem.id ? { ...p, status: 'STARTED' } : p))
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSyncAll = async () => {
    if (cooldownSeconds > 0) return;

    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);

    try {
      const res = await api.post('/practice/sync', { platform: 'ALL' });
      const newly = res.data.newlySolved || 0;
      setSyncMessage(`Sync complete! Checked ${res.data.problemsChecked} problems. Newly verified solved: ${newly}.`);
      setCooldownSeconds(45); // start 45s cooldown
      await fetchProblems();
    } catch (err) {
      if (err.response?.status === 429) {
        const secs = err.response.data.remainingSeconds || 45;
        setCooldownSeconds(secs);
        setSyncError(err.response.data.message || `Sync cooldown active. Please wait ${secs}s.`);
      } else {
        setSyncError(err.response?.data?.message || 'Sync failed. Try again in a minute.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncSingleProblem = async (problem) => {
    if (cooldownSeconds > 0) return;

    setPerProblemLoading((prev) => ({ ...prev, [problem.id]: true }));
    setSyncMessage(null);
    setSyncError(null);

    try {
      const res = await api.post('/practice/sync', {
        platform: problem.platform,
        problemId: problem.id,
      });

      const resItem = res.data.results?.find((r) => r.problemId === problem.id);
      if (resItem?.status === 'SOLVED') {
        setSyncMessage(`Awesome! "${problem.title}" is verified solved!`);
      } else {
        setSyncMessage(resItem?.message || `Checked ${problem.title}. No accepted submission found yet.`);
      }

      setCooldownSeconds(45);
      await fetchProblems();
    } catch (err) {
      if (err.response?.status === 429) {
        const secs = err.response.data.remainingSeconds || 45;
        setCooldownSeconds(secs);
        setSyncError(err.response.data.message || `Please wait ${secs}s before syncing again.`);
      } else {
        setSyncError(err.response?.data?.message || 'Sync failed. Try again in a minute.');
      }
    } finally {
      setPerProblemLoading((prev) => ({ ...prev, [problem.id]: false }));
    }
  };

  return (
    <div className="container">
      {/* Header with Title and Sync All Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Practice Problems
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Solve curated problems, then click Sync to automatically verify accepted submissions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleSyncAll}
            disabled={syncing || cooldownSeconds > 0}
            className="btn btn-primary"
            style={{ padding: '10px 20px', minWidth: '160px' }}
          >
            {syncing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Syncing...
              </>
            ) : cooldownSeconds > 0 ? (
              <>
                <Clock size={16} />
                Cooldown: {cooldownSeconds}s
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Sync All Problems
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync Alerts */}
      {syncMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <CheckCircle2 size={18} />
          <span>{syncMessage}</span>
        </div>
      )}

      {syncError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} />
            <span>{syncError}</span>
          </div>
          {syncError.includes('Profile') && (
            <Link to="/profile" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
              Go to Profile
            </Link>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          alignItems: 'center',
        }}>
          {/* Platform Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              PLATFORM
            </label>
            <select
              value={platformFilter}
              onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            >
              <option value="ALL">All Platforms</option>
              <option value="LEETCODE">LeetCode</option>
              <option value="CODEFORCES">Codeforces</option>
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              DIFFICULTY
            </label>
            <select
              value={difficultyFilter}
              onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            >
              <option value="ALL">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {/* Topic Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              TOPIC
            </label>
            <select
              value={topicFilter}
              onChange={(e) => { setTopicFilter(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            >
              <option value="ALL">All Topics</option>
              {allTopics.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              STATUS
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SOLVED">Solved</option>
              <option value="STARTED">Started</option>
              <option value="UNSOLVED">Unsolved</option>
            </select>
          </div>

          {/* Search Box */}
          <div style={{ gridColumn: 'span 1' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              SEARCH
            </label>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Search title or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%' }}
              />
              <button type="submit" className="btn btn-secondary" style={{ padding: '0 12px' }}>
                <Search size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Problems List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <p>Loading problems...</p>
          </div>
        ) : problems.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No problems found.</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Try adjusting your filter settings or search query.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px' }}>Platform</th>
                  <th style={{ padding: '14px 18px' }}>Problem Title</th>
                  <th style={{ padding: '14px 18px' }}>Difficulty</th>
                  <th style={{ padding: '14px 18px' }}>Topics</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p) => {
                  const isSolved = p.status === 'SOLVED';
                  const isStarted = p.status === 'STARTED';
                  const diffLower = (p.difficulty || '').toLowerCase();
                  const diffBadgeClass = diffLower.includes('easy')
                    ? 'badge-easy'
                    : diffLower.includes('hard')
                    ? 'badge-hard'
                    : 'badge-medium';

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Status */}
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        {isSolved ? (
                          <span className="badge badge-solved">
                            <CheckCircle2 size={12} /> Solved
                          </span>
                        ) : isStarted ? (
                          <span className="badge badge-started">
                            <Clock size={12} /> Started
                          </span>
                        ) : (
                          <span className="badge badge-unsolved">Unsolved</span>
                        )}
                      </td>

                      {/* Platform */}
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <span className={`badge ${p.platform === 'LEETCODE' ? 'badge-leetcode' : 'badge-codeforces'}`}>
                          {p.platform === 'LEETCODE' ? 'LeetCode' : 'Codeforces'}
                        </span>
                      </td>

                      {/* Title & External ID */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {p.externalId}
                        </div>
                      </td>

                      {/* Difficulty */}
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <span className={`badge ${diffBadgeClass}`}>
                          {p.difficulty}
                        </span>
                      </td>

                      {/* Topics */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '240px' }}>
                          {(p.topics || []).slice(0, 3).map((t) => (
                            <span
                              key={t}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleSolveClick(p)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                            title="Open problem in a new tab"
                          >
                            <ExternalLink size={14} /> Solve
                          </button>

                          <button
                            onClick={() => handleSyncSingleProblem(p)}
                            disabled={!p.isPlatformVerified || cooldownSeconds > 0 || perProblemLoading[p.id]}
                            className={`btn ${isSolved ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                            title={!p.isPlatformVerified ? `Link and verify your ${p.platform} account on Profile to sync` : 'Sync this problem'}
                          >
                            {perProblemLoading[p.id] ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <RefreshCw size={13} />
                            )}
                            {isSolved ? 'Re-sync' : 'Sync'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(0, 0, 0, 0.1)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}>
            <div>
              Showing {problems.length} of {total} problems (Page {page} of {totalPages})
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="btn btn-secondary"
                style={{ padding: '6px 10px' }}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="btn btn-secondary"
                style={{ padding: '6px 10px' }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
