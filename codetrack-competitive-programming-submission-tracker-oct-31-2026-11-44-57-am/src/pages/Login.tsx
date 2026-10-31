import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Terminal, LogIn, AlertCircle } from 'lucide-react';

interface LoginProps {
  onNavigate: (tab: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      onNavigate('dashboard');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto font-bold shadow-xs">
            <Terminal className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Sign in to CodeTrack</h2>
          <p className="text-xs text-slate-500">
            Track competitive programming submissions and analytics
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          Don't have an account?{' '}
          <button
            onClick={() => onNavigate('signup')}
            className="text-slate-900 font-semibold hover:underline"
          >
            Sign up here
          </button>
        </div>
      </div>
    </div>
  );
};
