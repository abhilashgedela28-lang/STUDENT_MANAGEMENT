import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Platform } from '../types/client.js';
import { CheckCircle2, Clock, Copy, Check, ExternalLink, Trash2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiFetch } from '../utils/api.js';

export const Profile: React.FC = () => {
  const { user, links, refreshUser } = useAuth();

  // Form states
  const [lcUsername, setLcUsername] = useState('');
  const [cfUsername, setCfUsername] = useState('');

  const [loadingPlatform, setLoadingPlatform] = useState<Platform | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const leetcodeLink = links.find(l => l.platform === 'LEETCODE');
  const codeforcesLink = links.find(l => l.platform === 'CODEFORCES');

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleLink = async (platform: Platform) => {
    const username = platform === 'LEETCODE' ? lcUsername.trim() : cfUsername.trim();
    if (!username) {
      setMessage({ type: 'error', text: `Please enter your ${platform} handle/username.` });
      return;
    }

    setLoadingPlatform(platform);
    setMessage(null);

    try {
      const res = await apiFetch('/api/platforms/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, username })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate linking.');

      setMessage({
        type: 'success',
        text: `Account validated! Verification code generated: ${data.link.verificationCode}. Please follow the steps below to verify.`
      });

      if (platform === 'LEETCODE') setLcUsername('');
      else setCfUsername('');

      await refreshUser();
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleVerify = async (platform: Platform, simulateVerification = false) => {
    setLoadingPlatform(platform);
    setMessage(null);

    try {
      const res = await apiFetch('/api/platforms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, simulateVerification })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');

      if (data.verified) {
        setMessage({
          type: 'success',
          text: data.message
        });
      } else {
        setMessage({
          type: 'error',
          text: data.message
        });
      }

      await refreshUser();
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleUnlink = async (platform: Platform) => {
    if (!confirm(`Are you sure you want to unlink your ${platform} account?`)) return;

    setLoadingPlatform(platform);
    setMessage(null);

    try {
      const res = await apiFetch(`/api/platforms/${platform}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unlink account.');

      setMessage({ type: 'info', text: `Unlinked ${platform} account.` });
      await refreshUser();
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingPlatform(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Title */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Linking & Ownership Verification</h1>
        <p className="text-xs text-slate-500 mt-1">
          Prove ownership of your competitive programming profiles to prevent impersonation and enable dynamic submission syncing.
        </p>
      </div>

      {/* User summary card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="text-slate-400 font-medium">Logged in as:</span>{' '}
          <strong className="text-slate-900">{user?.name}</strong>{' '}
          <span className="text-slate-500">({user?.email})</span>
        </div>
        <div className="text-slate-500 font-mono">
          Account Role: <strong className="text-slate-800">{user?.role}</strong>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : message.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Linking Section: 2 Platform Cards */}
      <div className="space-y-6">
        {/* Card 1: LeetCode */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
                LC
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">LeetCode</h3>
                <p className="text-xs text-slate-500">Official GraphQL endpoint verification</p>
              </div>
            </div>

            {leetcodeLink?.verified ? (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified ({leetcodeLink.username})
              </span>
            ) : leetcodeLink ? (
              <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Pending Verification
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-medium">Not Linked</span>
            )}
          </div>

          {!leetcodeLink ? (
            /* Input form when not linked */
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter LeetCode username (e.g., neal_wu)"
                value={lcUsername}
                onChange={e => setLcUsername(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
              />
              <button
                onClick={() => handleLink('LEETCODE')}
                disabled={loadingPlatform === 'LEETCODE'}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shadow-xs"
              >
                {loadingPlatform === 'LEETCODE' ? 'Validating...' : 'Link Account'}
              </button>
            </div>
          ) : leetcodeLink.verified ? (
            /* Verified state */
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-600">
                Verified on:{' '}
                <strong className="text-slate-800">
                  {leetcodeLink.verifiedAt ? new Date(leetcodeLink.verifiedAt).toLocaleDateString() : 'Active'}
                </strong>
                {leetcodeLink.lastSyncedAt && (
                  <span className="ml-2 text-slate-400 font-mono">
                    (Last synced: {new Date(leetcodeLink.lastSyncedAt).toLocaleTimeString()})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`https://leetcode.com/${leetcodeLink.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>View LeetCode Profile</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => handleUnlink('LEETCODE')}
                  disabled={loadingPlatform === 'LEETCODE'}
                  className="text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 hover:bg-rose-50 px-2 py-1 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Unlink</span>
                </button>
              </div>
            </div>
          ) : (
            /* Pending verification instructions */
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Verification Steps for LeetCode:</span>
                  <span className="text-[11px] text-amber-700 font-mono">Expires in 30 mins</span>
                </div>

                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    1. Copy your personal verification code below:
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-white border border-slate-300 font-mono font-bold text-slate-900 rounded text-sm select-all">
                      {leetcodeLink.verificationCode}
                    </span>
                    <button
                      onClick={() => handleCopy(leetcodeLink.verificationCode!)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs text-slate-700 font-medium flex items-center gap-1"
                    >
                      {copiedCode === leetcodeLink.verificationCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p>
                    2. Go to your LeetCode profile settings and paste this code into your{' '}
                    <strong className="text-slate-900">Summary (aboutMe)</strong> or{' '}
                    <strong className="text-slate-900">Real Name</strong> field:
                  </p>
                  <div>
                    <a
                      href="https://leetcode.com/profile/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
                    >
                      <span>Open LeetCode Profile Settings</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p>
                    3. Save changes on LeetCode, then click the button below to confirm ownership:
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleUnlink('LEETCODE')}
                  disabled={loadingPlatform === 'LEETCODE'}
                  className="text-xs text-slate-500 hover:text-rose-600"
                >
                  Cancel & Unlink
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerify('LEETCODE', true)}
                    disabled={loadingPlatform === 'LEETCODE'}
                    title="Simulate successful profile verification for testing without changing your bio"
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Quick Verify (Demo Mode)
                  </button>
                  <button
                    onClick={() => handleVerify('LEETCODE', false)}
                    disabled={loadingPlatform === 'LEETCODE'}
                    className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{loadingPlatform === 'LEETCODE' ? 'Verifying...' : 'Verify LeetCode Account'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Codeforces */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                CF
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Codeforces</h3>
                <p className="text-xs text-slate-500">Official Codeforces REST API verification</p>
              </div>
            </div>

            {codeforcesLink?.verified ? (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified ({codeforcesLink.username})
              </span>
            ) : codeforcesLink ? (
              <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Pending Verification
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-medium">Not Linked</span>
            )}
          </div>

          {!codeforcesLink ? (
            /* Input form when not linked */
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter Codeforces handle (e.g., tourist)"
                value={cfUsername}
                onChange={e => setCfUsername(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
              />
              <button
                onClick={() => handleLink('CODEFORCES')}
                disabled={loadingPlatform === 'CODEFORCES'}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shadow-xs"
              >
                {loadingPlatform === 'CODEFORCES' ? 'Validating...' : 'Link Account'}
              </button>
            </div>
          ) : codeforcesLink.verified ? (
            /* Verified state */
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-600">
                Verified on:{' '}
                <strong className="text-slate-800">
                  {codeforcesLink.verifiedAt ? new Date(codeforcesLink.verifiedAt).toLocaleDateString() : 'Active'}
                </strong>
                {codeforcesLink.lastSyncedAt && (
                  <span className="ml-2 text-slate-400 font-mono">
                    (Last synced: {new Date(codeforcesLink.lastSyncedAt).toLocaleTimeString()})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`https://codeforces.com/profile/${codeforcesLink.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>View Codeforces Profile</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => handleUnlink('CODEFORCES')}
                  disabled={loadingPlatform === 'CODEFORCES'}
                  className="text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 hover:bg-rose-50 px-2 py-1 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Unlink</span>
                </button>
              </div>
            </div>
          ) : (
            /* Pending verification instructions */
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Verification Steps for Codeforces:</span>
                  <span className="text-[11px] text-amber-700 font-mono">Expires in 30 mins</span>
                </div>

                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    1. Copy your personal verification code below:
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-white border border-slate-300 font-mono font-bold text-slate-900 rounded text-sm select-all">
                      {codeforcesLink.verificationCode}
                    </span>
                    <button
                      onClick={() => handleCopy(codeforcesLink.verificationCode!)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs text-slate-700 font-medium flex items-center gap-1"
                    >
                      {copiedCode === codeforcesLink.verificationCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p>
                    2. Go to your Codeforces profile settings and paste this code into your{' '}
                    <strong className="text-slate-900">Organization</strong>,{' '}
                    <strong className="text-slate-900">First Name</strong>, or{' '}
                    <strong className="text-slate-900">City</strong> field:
                  </p>
                  <div>
                    <a
                      href="https://codeforces.com/settings/social"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
                    >
                      <span>Open Codeforces Settings</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p>
                    3. Save changes on Codeforces, then click the button below to confirm ownership:
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleUnlink('CODEFORCES')}
                  disabled={loadingPlatform === 'CODEFORCES'}
                  className="text-xs text-slate-500 hover:text-rose-600"
                >
                  Cancel & Unlink
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerify('CODEFORCES', true)}
                    disabled={loadingPlatform === 'CODEFORCES'}
                    title="Simulate successful profile verification for testing without changing your bio"
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Quick Verify (Demo Mode)
                  </button>
                  <button
                    onClick={() => handleVerify('CODEFORCES', false)}
                    disabled={loadingPlatform === 'CODEFORCES'}
                    className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{loadingPlatform === 'CODEFORCES' ? 'Verifying...' : 'Verify Codeforces Account'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
