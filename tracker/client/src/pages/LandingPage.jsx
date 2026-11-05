import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Code2, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  BarChart3, 
  ExternalLink 
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section style={{
        padding: '5rem 1.25rem 4rem',
        textAlign: 'center',
        maxWidth: '850px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '9999px',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          color: 'var(--accent-cyan)',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1.5rem',
        }}>
          <Zap size={14} /> Full-Stack Competitive Programming & Problem Tracker
        </div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 5vw, 3.8rem)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.03em',
          marginBottom: '1.25rem',
        }}>
          Track your coding journey across <br />
          <span style={{
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            LeetCode & Codeforces
          </span>
        </h1>

        <p style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: '2rem',
          maxWidth: '640px',
          margin: '0 auto 2rem',
        }}>
          Sync your verified submissions with zero manual hassle, practice curated problems, 
          and track rating trends and daily streaks with cryptographic ownership verification.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/signup" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '1rem' }}>
            Get Started Free
          </Link>
          <Link to="/login" className="btn btn-secondary" style={{ padding: '12px 24px', fontSize: '1rem' }}>
            Sign In to CodeTrack
          </Link>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="container" style={{ paddingBottom: '4rem' }}>
        <div className="grid-3">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)',
            }}>
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Ownership Verification</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Prove profile ownership with temporary cryptographic codes placed in public bio fields. Unverified accounts cannot sync.
            </p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-green)',
            }}>
              <CheckCircle2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>One-Click Practice & Sync</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Open problems directly in a new tab. When accepted, click Sync to verify against your live public submission history.
            </p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-purple)',
            }}>
              <TrendingUp size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Interactive Analytics</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Visualize rating histories, daily 365-day heatmaps, topic-wise strengths and weaknesses, and difficulty distributions with Chart.js.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
