import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  PlusCircle, 
  ListPlus, 
  Settings, 
  Users, 
  Camera, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  Power, 
  ExternalLink, 
  Search, 
  RefreshCw 
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('add'); // 'add' | 'bulk' | 'problems' | 'users' | 'snapshots'
  
  // Single Add form
  const [urlInput, setUrlInput] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Bulk Add form
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkReport, setBulkReport] = useState(null);

  // Problem management
  const [problems, setProblems] = useState([]);
  const [problemSearch, setProblemSearch] = useState('');
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);

  // User management
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Snapshots
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState(null);

  // Alerts
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (activeTab === 'problems') fetchProblems();
    if (activeTab === 'users') fetchUsers();
  }, [activeTab]);

  const clearAlerts = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  // Preview URL
  const handlePreview = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    clearAlerts();
    setPreviewLoading(true);
    setPreviewData(null);

    try {
      const res = await api.post('/admin/problems/preview', { url: urlInput.trim() });
      setPreviewData(res.data);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to parse problem URL.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Save Single Problem
  const handleSaveProblem = async () => {
    if (!previewData) return;
    clearAlerts();
    setSaveLoading(true);

    try {
      await api.post('/admin/problems', previewData);
      setSuccessMsg(`Problem "${previewData.title}" added successfully!`);
      setUrlInput('');
      setPreviewData(null);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save problem.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Bulk Add
  const handleBulkAdd = async (e) => {
    e.preventDefault();
    if (!bulkUrls.trim()) return;

    clearAlerts();
    setBulkLoading(true);
    setBulkReport(null);

    try {
      const res = await api.post('/admin/problems/bulk', { urlsText: bulkUrls });
      setBulkReport(res.data.report);
      setSuccessMsg(`Bulk processing complete! Added: ${res.data.report.added.length}, Duplicates: ${res.data.report.duplicates.length}, Failed: ${res.data.report.failed.length}`);
      setBulkUrls('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to process bulk URLs.');
    } finally {
      setBulkLoading(false);
    }
  };

  // Fetch Problems
  const fetchProblems = async () => {
    setProblemsLoading(true);
    try {
      const res = await api.get('/admin/problems', { params: { search: problemSearch } });
      if (res.data.success) {
        setProblems(res.data.problems);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProblemsLoading(false);
    }
  };

  // Toggle Active
  const handleToggleActive = async (problem) => {
    try {
      await api.put(`/admin/problems/${problem._id}`, { active: !problem.active });
      setProblems((prev) =>
        prev.map((p) => (p._id === problem._id ? { ...p, active: !p.active } : p))
      );
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  // Delete Problem
  const handleDeleteProblem = async (problemId) => {
    if (!window.confirm('Are you sure you want to delete this problem?')) return;
    try {
      await api.delete(`/admin/problems/${problemId}`);
      setProblems((prev) => prev.filter((p) => p._id !== problemId));
      setSuccessMsg('Problem deleted.');
    } catch (err) {
      setErrorMsg('Failed to delete problem.');
    }
  };

  // Save Edit Problem
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingProblem) return;

    try {
      const res = await api.put(`/admin/problems/${editingProblem._id}`, editingProblem);
      setProblems((prev) =>
        prev.map((p) => (p._id === editingProblem._id ? res.data.problem : p))
      );
      setEditingProblem(null);
      setSuccessMsg('Problem updated.');
    } catch (err) {
      alert('Failed to update problem.');
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.get('/admin/users');
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Trigger Snapshots
  const handleTriggerSnapshots = async () => {
    clearAlerts();
    setSnapshotLoading(true);
    setSnapshotResult(null);

    try {
      const res = await api.post('/admin/snapshots/trigger');
      setSnapshotResult(res.data.result);
      setSuccessMsg('Snapshot job completed across all verified users!');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to trigger snapshots.');
    } finally {
      setSnapshotLoading(false);
    }
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Administration Control Panel
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Manage problem sets, user accounts, and trigger batch progress snapshots.
        </p>
      </div>

      {successMsg && (
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
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '1.5rem',
        overflowX: 'auto',
      }}>
        {[
          { id: 'add', name: 'Add by URL', icon: PlusCircle },
          { id: 'bulk', name: 'Bulk Add', icon: ListPlus },
          { id: 'problems', name: 'Manage Problems', icon: Settings },
          { id: 'users', name: 'User Directory', icon: Users },
          { id: 'snapshots', name: 'Snapshot Jobs', icon: Camera },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); clearAlerts(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'transparent',
                borderBottom: isSelected ? '2px solid var(--accent-blue)' : '2px solid transparent',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ADD SINGLE PROBLEM BY URL */}
      {activeTab === 'add' && (
        <div className="card" style={{ maxWidth: '680px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Add Problem by Paste URL
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            Paste a LeetCode problem URL or Codeforces problem URL. Platform, title, difficulty, and tags are auto-detected.
          </p>

          <form onSubmit={handlePreview} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="url"
                required
                placeholder="https://leetcode.com/problems/two-sum/ or https://codeforces.com/problemset/problem/4/A"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                disabled={previewLoading || !urlInput.trim()}
                className="btn btn-primary"
              >
                {previewLoading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                Fetch Metadata
              </button>
            </div>
          </form>

          {/* Preview & Override Form */}
          {previewData && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
            }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-cyan)' }}>
                Verify & Save Problem Metadata
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    PLATFORM & EXTERNAL ID
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-leetcode">{previewData.platform}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{previewData.externalId}</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    PROBLEM TITLE (EDITABLE)
                  </label>
                  <input
                    type="text"
                    value={previewData.title}
                    onChange={(e) => setPreviewData({ ...previewData, title: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    DIFFICULTY (EDITABLE)
                  </label>
                  <input
                    type="text"
                    value={previewData.difficulty}
                    onChange={(e) => setPreviewData({ ...previewData, difficulty: e.target.value })}
                    placeholder="Easy, Medium, Hard, or numeric rating"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    TOPICS (COMMA-SEPARATED)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(previewData.topics) ? previewData.topics.join(', ') : previewData.topics}
                    onChange={(e) => setPreviewData({ ...previewData, topics: e.target.value.split(',').map((t) => t.trim()) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    CANONICAL URL
                  </label>
                  <input
                    type="url"
                    value={previewData.url}
                    onChange={(e) => setPreviewData({ ...previewData, url: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    onClick={handleSaveProblem}
                    disabled={saveLoading}
                    className="btn btn-success"
                    style={{ padding: '10px 24px', width: '100%' }}
                  >
                    {saveLoading ? 'Saving...' : 'Confirm & Save Problem'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BULK ADD */}
      {activeTab === 'bulk' && (
        <div className="card" style={{ maxWidth: '720px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Bulk Add Problems
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            Paste multiple LeetCode or Codeforces problem URLs below, one URL per line.
          </p>

          <form onSubmit={handleBulkAdd}>
            <textarea
              rows={8}
              required
              placeholder="https://leetcode.com/problems/two-sum/&#10;https://codeforces.com/problemset/problem/4/A&#10;https://leetcode.com/problems/valid-parentheses/"
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginBottom: '1rem' }}
            />

            <button
              type="submit"
              disabled={bulkLoading || !bulkUrls.trim()}
              className="btn btn-primary"
              style={{ padding: '10px 24px' }}
            >
              {bulkLoading ? 'Processing URLs...' : 'Process & Import Problems'}
            </button>
          </form>

          {/* Bulk Report */}
          {bulkReport && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Bulk Processing Results Report:
              </h4>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <span className="badge badge-solved">Added: {bulkReport.added.length}</span>
                <span className="badge badge-started">Duplicates: {bulkReport.duplicates.length}</span>
                <span className="badge badge-hard">Failed: {bulkReport.failed.length}</span>
              </div>

              {bulkReport.failed.length > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#f87171' }}>
                  <strong>Failures:</strong>
                  <ul>
                    {bulkReport.failed.map((f, i) => (
                      <li key={i}>{f.url} — {f.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MANAGE PROBLEMS */}
      {activeTab === 'problems' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Active Problem Repository</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search problems..."
                value={problemSearch}
                onChange={(e) => setProblemSearch(e.target.value)}
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              />
              <button onClick={fetchProblems} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                <Search size={15} />
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Platform</th>
                  <th style={{ padding: '12px 16px' }}>Title & ID</th>
                  <th style={{ padding: '12px 16px' }}>Difficulty</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p) => (
                  <tr key={p._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${p.active ? 'badge-solved' : 'badge-unsolved'}`}>
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${p.platform === 'LEETCODE' ? 'badge-leetcode' : 'badge-codeforces'}`}>
                        {p.platform}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{p.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.externalId}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{p.difficulty}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => setEditingProblem(p)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="Edit Problem"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title={p.active ? 'Deactivate' : 'Activate'}
                        >
                          <Power size={13} color={p.active ? '#34d399' : '#94a3b8'} />
                        </button>
                        <button
                          onClick={() => handleDeleteProblem(p._id)}
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="Delete Problem"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit Problem Modal */}
          {editingProblem && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '1rem',
            }}>
              <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
                  Edit Problem
                </h3>
                <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Title</label>
                    <input
                      type="text"
                      value={editingProblem.title}
                      onChange={(e) => setEditingProblem({ ...editingProblem, title: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Difficulty</label>
                    <input
                      type="text"
                      value={editingProblem.difficulty}
                      onChange={(e) => setEditingProblem({ ...editingProblem, difficulty: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>URL</label>
                    <input
                      type="url"
                      value={editingProblem.url}
                      onChange={(e) => setEditingProblem({ ...editingProblem, url: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                    <button type="button" onClick={() => setEditingProblem(null)} className="btn btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: USER DIRECTORY */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Registered Users Directory</h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px' }}>User</th>
                  <th style={{ padding: '12px 16px' }}>Email</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Linked Accounts</th>
                  <th style={{ padding: '12px 16px' }}>Registered</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: '12px 16px' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge" style={{ background: u.role === 'ADMIN' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)' }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {u.platforms.length > 0 ? (
                          u.platforms.map((p, idx) => (
                            <span key={idx} className={`badge ${p.verified ? 'badge-solved' : 'badge-started'}`}>
                              {p.platform}: {p.username}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None linked</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SNAPSHOT OPERATIONS */}
      {activeTab === 'snapshots' && (
        <div className="card" style={{ maxWidth: '640px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Snapshot Job Operations
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            A background cron schedule automatically snapshots verified users daily (default 02:00 Asia/Kolkata).
            If the host was suspended or slept, you can manually trigger a full snapshot batch across all verified accounts right now.
          </p>

          <button
            onClick={handleTriggerSnapshots}
            disabled={snapshotLoading}
            className="btn btn-primary"
            style={{ padding: '11px 24px' }}
          >
            {snapshotLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Snapshotting Verified Accounts...
              </>
            ) : (
              <>
                <Camera size={16} />
                Run Snapshot Job Now
              </>
            )}
          </button>

          {snapshotResult && (
            <div style={{ marginTop: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '4px' }}>Batch Result:</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Total Accounts Checked: {snapshotResult.total}<br />
                Successfully Updated: {snapshotResult.successCount}<br />
                Failed: {snapshotResult.failCount}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
