import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Terminal, LogOut, User as UserIcon, ShieldAlert } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single Brand Wordmark */}
          <div
            onClick={() => onSelectTab(user ? 'dashboard' : 'login')}
            className="flex items-center gap-2 cursor-pointer select-none shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              CodeTrack
            </span>
          </div>

          {/* Zone 2: Navigation Links (single-line, clean hover) */}
          {user ? (
            <nav className="flex items-center gap-6 sm:gap-8 text-sm font-medium">
              <button
                onClick={() => onSelectTab('dashboard')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  currentTab === 'dashboard'
                    ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onSelectTab('practice')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  currentTab === 'practice'
                    ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Practice
              </button>
              <button
                onClick={() => onSelectTab('profile')}
                className={`transition-colors whitespace-nowrap py-1 ${
                  currentTab === 'profile'
                    ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Profile & Linking
              </button>
              {user.role === 'ADMIN' && (
                <button
                  onClick={() => onSelectTab('admin')}
                  className={`transition-colors whitespace-nowrap py-1 flex items-center gap-1.5 ${
                    currentTab === 'admin'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                  Admin
                </button>
              )}
            </nav>
          ) : (
            <div className="text-xs text-slate-400 hidden sm:block">
              Competitive Programming Progress & Submission Tracking
            </div>
          )}

          {/* Zone 3: Primary Action / User Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-md">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-medium text-slate-800">{user.name}</span>
                  <span className="text-slate-400 font-mono">({user.role})</span>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectTab('login')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    currentTab === 'login'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Log in
                </button>
                <button
                  onClick={() => onSelectTab('signup')}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
