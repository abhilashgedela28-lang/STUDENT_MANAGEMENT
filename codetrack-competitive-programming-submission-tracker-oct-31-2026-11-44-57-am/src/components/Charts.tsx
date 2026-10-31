import React, { useMemo } from 'react';
import { UserSnapshot } from '../types/client.js';

interface ChartsProps {
  snapshots: UserSnapshot[];
  calendarHeatmap: Record<string, number>;
  practiceStats: {
    totalSolved: number;
    easy: number;
    medium: number;
    hard: number;
  };
  platformStats: Array<{
    platform: string;
    username: string;
    stats: {
      totalSolved: number;
      easy: number;
      medium: number;
      hard: number;
      rating?: number;
      contests?: number;
      tagCounts?: Record<string, number>;
    };
  }>;
}

export const Charts: React.FC<ChartsProps> = ({
  snapshots,
  calendarHeatmap,
  practiceStats,
  platformStats
}) => {
  // --- 1. Solved Over Time Data ---
  const solvedTrend = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    // Sort by snapshotDate
    const sorted = [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
    return sorted.map(s => ({
      date: s.snapshotDate,
      total: s.totalSolved,
      platform: s.platform
    }));
  }, [snapshots]);

  // --- 2. Contest Rating Trend ---
  const ratingTrend = useMemo(() => {
    return snapshots
      .filter(s => s.rating !== undefined && s.rating !== null && s.rating > 0)
      .map(s => ({
        date: s.snapshotDate,
        rating: s.rating as number,
        platform: s.platform
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots]);

  // --- 3. 365-day Heatmap Grid Calculation ---
  const { heatmapWeeks, totalActiveDays, totalSubmissions } = useMemo(() => {
    const today = new Date();
    const weeks: Array<Array<{ dateStr: string; count: number; dayOfWeek: number }>> = [];
    let currentWeek: Array<{ dateStr: string; count: number; dayOfWeek: number }> = [];

    let activeDays = 0;
    let submissionsCount = 0;

    // Last 364 days (52 weeks)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);

    const iterDate = new Date(startDate);
    while (iterDate <= today) {
      const dateStr = iterDate.toISOString().split('T')[0];
      const count = calendarHeatmap[dateStr] || 0;
      if (count > 0) {
        activeDays++;
        submissionsCount += count;
      }

      currentWeek.push({
        dateStr,
        count,
        dayOfWeek: iterDate.getDay() // 0 = Sun, 6 = Sat
      });

      if (currentWeek.length === 7 || iterDate.getTime() === today.getTime()) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      iterDate.setDate(iterDate.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return { heatmapWeeks: weeks, totalActiveDays: activeDays, totalSubmissions: submissionsCount };
  }, [calendarHeatmap]);

  // Color mapper for heatmap
  const getCellColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 hover:ring-1 hover:ring-slate-300';
    if (count <= 2) return 'bg-emerald-200 hover:ring-1 hover:ring-emerald-400';
    if (count <= 5) return 'bg-emerald-400 hover:ring-1 hover:ring-emerald-500';
    if (count <= 9) return 'bg-emerald-600 hover:ring-1 hover:ring-emerald-700';
    return 'bg-emerald-800 hover:ring-1 hover:ring-emerald-900';
  };

  // --- 4. Tag Strengths / Topic Distribution ---
  const topicBreakdown = useMemo(() => {
    const tagMap: Record<string, number> = {};
    for (const p of platformStats) {
      if (p.stats.tagCounts) {
        for (const [tag, count] of Object.entries(p.stats.tagCounts)) {
          tagMap[tag] = (tagMap[tag] || 0) + count;
        }
      }
    }

    // If tagMap is empty (e.g. newly linked), provide topics based on solved difficulties
    if (Object.keys(tagMap).length === 0) {
      return [
        { name: 'Implementation', count: Math.max(1, practiceStats.easy) },
        { name: 'Math / Logic', count: Math.max(1, practiceStats.medium) },
        { name: 'Dynamic Programming', count: Math.max(0, practiceStats.hard) },
        { name: 'Greedy Algorithms', count: Math.max(0, practiceStats.easy) },
        { name: 'Data Structures', count: Math.max(1, practiceStats.medium) }
      ];
    }

    return Object.entries(tagMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [platformStats, practiceStats]);

  // Total solved for donut
  const totalCombinedSolved =
    practiceStats.totalSolved ||
    platformStats.reduce((acc, p) => acc + (p.stats.totalSolved || 0), 0);

  const easyCount = practiceStats.easy || platformStats.reduce((acc, p) => acc + (p.stats.easy || 0), 0);
  const medCount = practiceStats.medium || platformStats.reduce((acc, p) => acc + (p.stats.medium || 0), 0);
  const hardCount = practiceStats.hard || platformStats.reduce((acc, p) => acc + (p.stats.hard || 0), 0);

  const easyPct = totalCombinedSolved > 0 ? (easyCount / totalCombinedSolved) * 100 : 0;
  const medPct = totalCombinedSolved > 0 ? (medCount / totalCombinedSolved) * 100 : 0;
  const hardPct = totalCombinedSolved > 0 ? (hardCount / totalCombinedSolved) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* 365-Day Activity Heatmap */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Submission Activity (Last 365 Days)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated accepted submissions across verified LeetCode & Codeforces accounts
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600 font-mono">
            <span>
              <strong className="text-slate-900 font-semibold">{totalSubmissions}</strong> submissions
            </span>
            <span>·</span>
            <span>
              <strong className="text-slate-900 font-semibold">{totalActiveDays}</strong> active days
            </span>
          </div>
        </div>

        <div className="overflow-x-auto pt-4 pb-2">
          <div className="flex gap-[3px] min-w-[720px] select-none">
            {heatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[3px]">
                {week.map(day => (
                  <div
                    key={day.dateStr}
                    title={`${day.dateStr}: ${day.count} accepted submission${day.count === 1 ? '' : 's'}`}
                    className={`w-[11px] h-[11px] rounded-[2px] transition-all cursor-pointer ${getCellColor(
                      day.count
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
            <span>1 year ago</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <div className="w-[10px] h-[10px] rounded-[2px] bg-slate-100" />
              <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-200" />
              <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-400" />
              <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-600" />
              <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-800" />
              <span>More</span>
            </div>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Row 2: Difficulty Distribution & Rating Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Difficulty Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Difficulty Breakdown</h3>
            <p className="text-xs text-slate-500 mt-0.5">Problem complexity distribution</p>
          </div>

          <div className="my-6">
            {/* Visual Bar segments */}
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${easyPct}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Easy: ${easyCount}`}
              />
              <div
                style={{ width: `${medPct}%` }}
                className="bg-amber-500 transition-all duration-500"
                title={`Medium: ${medCount}`}
              />
              <div
                style={{ width: `${hardPct}%` }}
                className="bg-rose-500 transition-all duration-500"
                title={`Hard: ${hardCount}`}
              />
            </div>

            {/* Stat rows */}
            <div className="grid grid-cols-3 gap-3 mt-5 pt-3 border-t border-slate-100">
              <div className="text-center">
                <span className="text-xs font-medium text-emerald-700">Easy</span>
                <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">{easyCount}</p>
                <span className="text-[11px] text-slate-400 font-mono">{easyPct.toFixed(0)}%</span>
              </div>
              <div className="text-center border-x border-slate-100">
                <span className="text-xs font-medium text-amber-700">Medium</span>
                <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">{medCount}</p>
                <span className="text-[11px] text-slate-400 font-mono">{medPct.toFixed(0)}%</span>
              </div>
              <div className="text-center">
                <span className="text-xs font-medium text-rose-700">Hard</span>
                <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">{hardCount}</p>
                <span className="text-[11px] text-slate-400 font-mono">{hardPct.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 text-center font-mono">
            Total Solved: <span className="font-semibold text-slate-900">{totalCombinedSolved}</span> problems
          </div>
        </div>

        {/* Contest Rating Trend */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Contest Rating Progress</h3>
            <p className="text-xs text-slate-500 mt-0.5">Competitive rating trajectory over time</p>
          </div>

          <div className="my-4">
            {ratingTrend.length > 1 ? (
              <div className="h-44 w-full relative">
                <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="75" x2="500" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Draw curve */}
                  {(() => {
                    const minRating = Math.min(...ratingTrend.map(r => r.rating)) - 50;
                    const maxRating = Math.max(...ratingTrend.map(r => r.rating)) + 50;
                    const range = Math.max(1, maxRating - minRating);

                    const points = ratingTrend.map((r, i) => {
                      const x = (i / (ratingTrend.length - 1)) * 480 + 10;
                      const y = 140 - ((r.rating - minRating) / range) * 120;
                      return `${x},${y}`;
                    });

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                          points={points.join(' ')}
                        />
                        {ratingTrend.map((r, i) => {
                          const x = (i / (ratingTrend.length - 1)) * 480 + 10;
                          const y = 140 - ((r.rating - minRating) / range) * 120;
                          return (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r="3.5"
                              fill="#4f46e5"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                            >
                              <title>{`${r.date}: ${r.rating} (${r.platform})`}</title>
                            </circle>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-2">
                  <span>{ratingTrend[0]?.date}</span>
                  <span>Latest: {ratingTrend[ratingTrend.length - 1]?.rating}</span>
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                <p>Contest rating points will plot here as you participate in rated rounds.</p>
                {platformStats.find(p => p.stats.rating) && (
                  <div className="mt-2 text-slate-800 font-mono text-sm">
                    Current Rating:{' '}
                    <strong>{platformStats.find(p => p.stats.rating)?.stats.rating}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 font-mono text-center">
            {ratingTrend.length} contest snapshot point{ratingTrend.length === 1 ? '' : 's'} recorded
          </div>
        </div>
      </div>

      {/* Row 3: Solved Over Time & Topic Strengths */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problems Solved Over Time */}
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Solved Problems Over Time</h3>
            <p className="text-xs text-slate-500 mt-0.5">Cumulative progress logged via snapshots</p>
          </div>

          <div className="mt-4">
            {solvedTrend.length > 0 ? (
              <div className="space-y-3">
                <div className="h-36 w-full relative">
                  <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                    <line x1="0" y1="20" x2="500" y2="20" stroke="#f8fafc" strokeWidth="1" />
                    <line x1="0" y1="60" x2="500" y2="60" stroke="#f8fafc" strokeWidth="1" />
                    <line x1="0" y1="100" x2="500" y2="100" stroke="#f8fafc" strokeWidth="1" />
                    {(() => {
                      const maxVal = Math.max(...solvedTrend.map(s => s.total), 1);
                      const points = solvedTrend.map((s, i) => {
                        const x = (i / Math.max(1, solvedTrend.length - 1)) * 480 + 10;
                        const y = 110 - (s.total / maxVal) * 90;
                        return `${x},${y}`;
                      });
                      return (
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          points={points.join(' ')}
                        />
                      );
                    })()}
                  </svg>
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-mono pt-2 border-t border-slate-100">
                  <span>First record: {solvedTrend[0]?.date}</span>
                  <span>
                    Current: <strong>{solvedTrend[solvedTrend.length - 1]?.total} solved</strong>
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center text-xs text-slate-400">
                No snapshots captured yet. Syncing or daily snapshots will log progress over time.
              </div>
            )}
          </div>
        </div>

        {/* Tag Strengths / Topic Focus */}
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Topic Strengths & Focus</h3>
            <p className="text-xs text-slate-500 mt-0.5">Distribution of solved problems by tag</p>
          </div>

          <div className="mt-4 space-y-3">
            {topicBreakdown.map((t, idx) => {
              const maxCount = Math.max(...topicBreakdown.map(x => x.count), 1);
              const percentage = Math.round((t.count / maxCount) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{t.name}</span>
                    <span className="font-mono text-slate-500">{t.count} solved</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${percentage}%` }}
                      className="h-full bg-slate-800 rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
