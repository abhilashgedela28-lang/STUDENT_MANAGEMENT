import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  ShieldCheck, 
  Link as LinkIcon, 
  Unlink, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Copy, 
  ExternalLink, 
  RefreshCw 
} from 'lucide-react';

export default function ProfilePage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('LEETCODE'); // 'LEETCODE' | 'CODEFORCES'

  // Input handles
  const [usernameInput, setUsernameInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const res = await api.get('/profile/links');
      if (res.data.success) {
        setLinks(res.data.links);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getLink = (platform) => links.find((l) => l.platform === platform);

  const handleInitiateLink = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setActionLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await api.post('/profile/link', {
        platform: activeTab,
        username: usernameInput.trim(),
      });
      setMessage(res.data.message);
      setUsernameInput('');
      await fetchLinks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate account linking.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async (platform) => {
    setActionLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await api.post('/profile/verify', { platform });
      setMessage(res.data.message);
      await fetchLinks();
    } catch (err) {
      setError(err.response?.data?.message || 'Verification check failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlink = async (platform) => {
    if (!window.confirm(`Are you sure you want to unlink your ${platform} account?`)) return;

    setActionLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await api.delete('/profile/unlink', { data: { platform } });
      setMessage(res.data.message);
      await fetchLinks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unlink account.');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`Copied "${text}" to clipboard!`);
  };

  const currentLink = getLink(activeTab);

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Platform Profiles & Ownership Verification
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Connect your LeetCode and Codeforces profiles by verifying account ownership via cryptographic code.
        </p>
      </div>

      {message && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <CheckCircle size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Platform Switcher Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '1.5rem',
      }}>
        {['LEETCODE', 'CODEFORCES'].map((platform) => {
          const l = getLink(platform);
          const isSelected = activeTab === platform;
          return (
            <button
              key={platform}
              onClick={() => { setActiveTab(platform); setMessage(null); setError(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'transparent',
                borderBottom: isSelected ? '2px solid var(--accent-blue)' : '2px solid transparent',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              <span>{platform === 'LEETCODE' ? 'LeetCode' : 'Codeforces'}</span>
              {l?.verified && (
                <span className="badge badge-solved" style={{ fontSize: '0.65rem' }}>Verified</span>
              )}
              {l && !l.verified && (
                <span className="badge badge-started" style={{ fontSize: '0.65rem' }}>Pending</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Link/Verification Card */}
      <div className="card">
        {currentLink?.verified ? (
          /* Verified State */
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              paddingBottom: '1.5rem',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-green)',
                }}>
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      {currentLink.username}
                    </h3>
                    <span className="badge badge-solved">Verified Owner</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                    Linked on {new Date(currentLink.verifiedAt).toLocaleDateString()}
                    {currentLink.lastSyncedAt && ` • Last Synced ${new Date(currentLink.lastSyncedAt).toLocaleString()}`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={activeTab === 'LEETCODE' ? `https://leetcode.com/u/${currentLink.username}/` : `https://codeforces.com/profile/${currentLink.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px' }}
                >
                  <ExternalLink size={16} /> View Profile
                </a>
                <button
                  onClick={() => handleUnlink(activeTab)}
                  disabled={actionLoading}
                  className="btn btn-danger"
                  style={{ padding: '8px 14px' }}
                >
                  <Unlink size={16} /> Unlink
                </button>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <p>
                Your {activeTab} account is actively linked and verified. Any accepted submissions 
                synced in the <strong>Practice</strong> section will be counted and reflected in your <strong>Dashboard</strong>.
              </p>
            </div>
          </div>
        ) : currentLink && !currentLink.verified ? (
          /* Pending Verification State */
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
            }}>
              <div>
                <span className="badge badge-started" style={{ marginBottom: '6px' }}>Verification Pending</span>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                  Verify Ownership of "{currentLink.username}"
                </h3>
              </div>
              <button
                onClick={() => handleUnlink(activeTab)}
                disabled={actionLoading}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                Cancel / Change Handle
              </button>
            </div>

            {/* Verification Code Box */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '2px dashed var(--accent-blue)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                YOUR UNIQUE VERIFICATION CODE
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                margin: '10px 0',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '2rem',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: 'var(--accent-cyan)',
                }}>
                  {currentLink.verificationCode}
                </span>
                <button
                  onClick={() => copyToClipboard(currentLink.verificationCode)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px' }}
                  title="Copy code"
                >
                  <Copy size={16} /> Copy
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                Code expires in 30 minutes from generation.
              </p>
            </div>

            {/* Step by step instructions */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: 'var(--radius-sm)',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>
                Instructions to Verify:
              </h4>
              <ol style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {activeTab === 'LEETCODE' ? (
                  <>
                    <li>Copy your verification code: <code>{currentLink.verificationCode}</code></li>
                    <li>Go to your <a href="https://leetcode.com/profile/" target="_blank" rel="noopener noreferrer">LeetCode Profile Settings <ExternalLink size={12} style={{ display: 'inline' }} /></a>.</li>
                    <li>Paste the code into your <strong>Summary (About Me)</strong> or <strong>Real Name</strong> field and save changes.</li>
                    <li>Click the <strong>"Verify Ownership"</strong> button below. (Once verified, you may delete the code from your profile).</li>
                  </>
                ) : (
                  <>
                    <li>Copy your verification code: <code>{currentLink.verificationCode}</code></li>
                    <li>Go to your <a href="https://codeforces.com/settings/social" target="_blank" rel="noopener noreferrer">Codeforces Social Settings <ExternalLink size={12} style={{ display: 'inline' }} /></a>.</li>
                    <li>Paste the code into your <strong>Organization</strong>, <strong>First name</strong>, or <strong>City</strong> field and save changes.</li>
                    <li>Click the <strong>"Verify Ownership"</strong> button below. (Once verified, you may remove the code).</li>
                  </>
                )}
              </ol>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={() => handleVerify(activeTab)}
                disabled={actionLoading}
                className="btn btn-primary"
                style={{ padding: '10px 24px' }}
              >
                {actionLoading ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                Verify Ownership Now
              </button>
            </div>
          </div>
        ) : (
          /* Unlinked State: Form to link handle */
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                Link {activeTab === 'LEETCODE' ? 'LeetCode Account' : 'Codeforces Handle'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                Enter your public handle to generate an ownership verification challenge code.
              </p>
            </div>

            <form onSubmit={handleInitiateLink} style={{ maxWidth: '480px' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  {activeTab === 'LEETCODE' ? 'LeetCode Username' : 'Codeforces Handle'}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder={activeTab === 'LEETCODE' ? 'e.g. tourist, neetcode' : 'e.g. tourist, petr'}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    disabled={actionLoading || !usernameInput.trim()}
                    className="btn btn-primary"
                  >
                    <LinkIcon size={16} />
                    {actionLoading ? 'Checking...' : 'Link Handle'}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <p>
                  • We check that the profile exists before generating the verification code.<br />
                  • Accounts already claimed and verified by another user cannot be linked again.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
