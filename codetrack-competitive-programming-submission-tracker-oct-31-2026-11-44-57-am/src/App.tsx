import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Dashboard } from './pages/Dashboard.js';
import { Practice } from './pages/Practice.js';
import { Profile } from './pages/Profile.js';
import { Admin } from './pages/Admin.js';
import { Login } from './pages/Login.js';
import { Signup } from './pages/Signup.js';
import { Terminal } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  useEffect(() => {
    // If not logged in and on a protected tab, redirect to login
    if (!loading) {
      if (!user && (currentTab === 'dashboard' || currentTab === 'practice' || currentTab === 'profile' || currentTab === 'admin')) {
        setCurrentTab('login');
      } else if (user && (currentTab === 'login' || currentTab === 'signup')) {
        setCurrentTab('dashboard');
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center animate-pulse">
          <Terminal className="w-5 h-5 text-emerald-400" />
        </div>
        <p className="text-xs text-slate-500 font-mono mt-3">Loading CodeTrack engine...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col selection:bg-slate-900 selection:text-white">
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />

      <main className="flex-1">
        {currentTab === 'dashboard' && <Dashboard onNavigate={setCurrentTab} />}
        {currentTab === 'practice' && <Practice onNavigate={setCurrentTab} />}
        {currentTab === 'profile' && <Profile />}
        {currentTab === 'admin' && <Admin />}
        {currentTab === 'login' && <Login onNavigate={setCurrentTab} />}
        {currentTab === 'signup' && <Signup onNavigate={setCurrentTab} />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span>CodeTrack</span>
            <span className="text-slate-400 font-normal">· Competitive Programming & Submission Tracker</span>
          </div>
          <div className="text-slate-400 font-mono text-[11px]">
            Spring Boot / MERN Architecture · LeetCode & Codeforces Connectors
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
