import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  Trophy, 
  Flame, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  ShieldAlert, 
  ExternalLink, 
  RefreshCw 
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard');
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--accent-blue)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading analytics & progress...</p>
      </div>
    );
  }

  // Empty state when no verified accounts exist
  if (!data?.hasLinkedPlatforms) {
    return (
      <div className="container" style={{ maxWidth: '680px', textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="card" style={{ padding: '3rem 2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(59, 130, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: 'var(--accent-blue)',
          }}>
            <ShieldAlert size={34} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.75rem' }}>
            No Verified Platforms Linked Yet
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            To view your progress charts, contest rating trends, topic strengths, and streak analytics, 
            please link and verify your LeetCode or Codeforces account on your Profile.
          </p>

          <Link to="/profile" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '1rem' }}>
            Go to Profile & Link Accounts
          </Link>
        </div>
      </div>
    );
  }

  const { totals, streaks, charts, platforms, lastSyncedAt } = data;

  // Chart 1: Problems Solved Over Time (Snapshots)
  const solvedLabels = (charts?.solvedOverTime || []).map((s) => s.date);
  const solvedValues = (charts?.solvedOverTime || []).map((s) => s.totalSolved);
  const solvedChartData = {
    labels: solvedLabels.length > 0 ? solvedLabels : ['Today'],
    datasets: [
      {
        label: 'Cumulative Problems Solved',
        data: solvedValues.length > 0 ? solvedValues : [totals.totalSolved],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
      },
    ],
  };

  // Chart 2: Rating Trends (Codeforces history)
  const cfHistory = charts?.ratingTrends?.codeforces || [];
  const ratingLabels = cfHistory.map((h) => h.date ? h.date.split('T')[0] : 'Contest');
  const ratingValues = cfHistory.map((h) => h.rating);
  const ratingChartData = {
    labels: ratingLabels.length > 0 ? ratingLabels : ['Current'],
    datasets: [
      {
        label: 'Codeforces Contest Rating',
        data: ratingValues.length > 0 ? ratingValues : [charts?.ratingTrends?.codeforcesCurrent || 0],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.12)',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#8b5cf6',
      },
    ],
  };

  // Chart 3: Difficulty Breakdown Doughnut
  const diffData = {
    labels: ['Easy', 'Medium', 'Hard'],
    datasets: [
      {
        data: [totals.easy || 0, totals.medium || 0, totals.hard || 0],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0,
      },
    ],
  };

  // Chart 4: Tag-wise Strengths Bar Chart
  const tags = charts?.tagStrengths || [];
  const tagChartData = {
    labels: tags.map((t) => t.tag),
    datasets: [
      {
        label: 'Problems Solved',
        data: tags.map((t) => t.count),
        backgroundColor: 'rgba(59, 130, 246, 0.75)',
        borderRadius: 4,
      },
    ],
  };

  // Chart 5: Activity Heatmap / Last 365 Days Daily Activity
  const activityDays = Object.entries(charts?.activityHistory || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30); // show last 30 active days in bar chart for clean rendering
  const activityChartData = {
    labels: activityDays.map(([day]) => day),
    datasets: [
      {
        label: 'Submissions Solved',
        data: activityDays.map(([, count]) => count),
        backgroundColor: '#06b6d4',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { family: 'Inter' } },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
      },
    },
  };

  return (
    <div className="container">
      {/* Top Welcome & Sync Timestamp */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Coding Performance Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Aggregated metrics, contest ratings, and submission history across your verified accounts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <Clock size={15} />
          <span>
            {lastSyncedAt
              ? `Last synced: ${new Date(lastSyncedAt).toLocaleString()}`
              : 'Synced at initial verification'}
          </span>
        </div>
      </div>

      {/* Linked Platforms Status Cards */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {platforms.map((p) => (
          <div key={p.platform} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: p.platform === 'LEETCODE' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: p.platform === 'LEETCODE' ? '#fbbf24' : '#60a5fa',
                fontWeight: 700,
              }}>
                {p.platform === 'LEETCODE' ? 'LC' : 'CF'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{p.username}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.platform}</div>
              </div>
            </div>
            <div>
              {p.verified ? (
                <span className="badge badge-solved">Verified</span>
              ) : (
                <span className="badge badge-started">Unverified</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Metric Cards Row */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        {/* Total Solved */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>TOTAL SOLVED</span>
            <CheckCircle2 size={18} color="var(--accent-blue)" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 4px', color: '#ffffff' }}>
            {totals.totalSolved}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Practice Tracker Solved: {totals.internalSolvedCount}
          </div>
        </div>

        {/* Current & Longest Streak */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>DAILY STREAK</span>
            <Flame size={18} color="#f97316" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 4px', color: '#f97316' }}>
            {streaks.currentStreak} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>days</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Longest Streak: <strong>{streaks.longestStreak} days</strong>
          </div>
        </div>

        {/* Codeforces Rating */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>CODEFORCES RATING</span>
            <Trophy size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 4px', color: '#c084fc' }}>
            {charts?.ratingTrends?.codeforcesCurrent || '—'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Max: {charts?.ratingTrends?.codeforcesMax || '—'} • {charts?.ratingTrends?.codeforcesRank}
          </div>
        </div>

        {/* LeetCode Rating / Contests */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>LEETCODE RATING</span>
            <TrendingUp size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 4px', color: '#fbbf24' }}>
            {charts?.ratingTrends?.leetcodeRating || '—'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Contests Attended: {charts?.ratingTrends?.leetcodeContests || 0}
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Problems Solved Over Time */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            Problems Solved Over Time
          </h3>
          <div style={{ height: '260px' }}>
            <Line data={solvedChartData} options={chartOptions} />
          </div>
        </div>

        {/* Contest Rating Trend */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            Contest Rating Progression
          </h3>
          <div style={{ height: '260px' }}>
            <Line data={ratingChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Difficulty Breakdown Doughnut */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            Difficulty Distribution
          </h3>
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '220px', height: '220px' }}>
              <Doughnut
                data={diffData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8' } },
                  },
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '1rem', textAlign: 'center' }}>
            <div>
              <div style={{ color: '#10b981', fontWeight: 700, fontSize: '1.2rem' }}>{totals.easy}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Easy</div>
            </div>
            <div>
              <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1.2rem' }}>{totals.medium}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Medium</div>
            </div>
            <div>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.2rem' }}>{totals.hard}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hard</div>
            </div>
          </div>
        </div>

        {/* Tag Strengths / Codeforces Topics */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            Topic Strengths & Solved Tags
          </h3>
          <div style={{ height: '260px' }}>
            {tags.length > 0 ? (
              <Bar data={tagChartData} options={chartOptions} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No tag breakdown data yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Daily Submissions */}
      {activityDays.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            Daily Activity (Last 30 Active Days)
          </h3>
          <div style={{ height: '220px' }}>
            <Bar data={activityChartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
