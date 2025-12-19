import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutLog, WorkoutPlan, UserGoal, PersonalRecord } from '../types';
import { getAllPRs } from '../services/prService';
import { cn } from '../lib/utils';
import LogbookPage from './LogbookPage';
import { usePageBackground, BackgroundOverlay } from '../hooks/usePageBackground';

// ═══════════════════════════════════════════════════════════════════════════════
// GOAL TRACKING PAGE - Editorial Noir (Brutalist Edition)
// ═══════════════════════════════════════════════════════════════════════════════

interface GoalTrackingPageProps {
  logs: WorkoutLog[];
  plan: WorkoutPlan;
  userGoals?: UserGoal[];
  onDeleteLog?: (logId: string) => Promise<void>;
}

export default function GoalTrackingPage({ logs, plan, userGoals, onDeleteLog }: GoalTrackingPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'goals' | 'history'>('goals');
  const [mounted, setMounted] = useState(false);
  const { backgroundStyles, hasBackground } = usePageBackground('goals');

  useEffect(() => {
    setMounted(true);
  }, []);

  // ANALYTICS (Same Logic)
  const analytics = useMemo(() => {
    const totalWorkouts = logs.length;
    const allPRs = getAllPRs(logs);
    const recentPRs = allPRs.slice(0, 10); // Show more PRs in list

    // This week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const thisWeekWorkouts = logs.filter(log => new Date(log.startTime) >= startOfWeek).length;

    // Streak
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sortedLogs = [...logs].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    if (sortedLogs.length > 0) {
      let checkDate = new Date(today);
      for (let i = 0; i < 30; i++) {
        const hasWorkout = sortedLogs.some(log => {
          const logDate = new Date(log.startTime);
          logDate.setHours(0, 0, 0, 0);
          return logDate.getTime() === checkDate.getTime();
        });
        if (hasWorkout) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
        else if (i === 0) { checkDate.setDate(checkDate.getDate() - 1); }
        else break;
      }
    }
    return { totalWorkouts, allPRs: recentPRs, thisWeekWorkouts, streak, prCount: allPRs.length };
  }, [logs]);

  // Calculate Month Compliance for Graph
  const monthlyGraphData = useMemo(() => {
    // Dummy data visualization for the "Financial Report" graph look
    // Real implementation would group logs by month/week
    return [35, 45, 30, 60, 75, 50, 80, 70, 90, 85, 95, 100];
  }, [logs]);

  return (
    <div className="h-full bg-black flex flex-col pt-safe-top">
      {/* HEADER: Noir Identity */}
      <header className="px-6 py-6 border-b border-white/10 flex justify-between items-end">
        <div>
          <p className="font-mono text-[10px] text-[#525252] mb-1 tracking-widest uppercase">
            DATA ANALYTICS
          </p>
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
            STATUS
          </h1>
        </div>
        {/* Tab Switcher */}
        <div className="flex border border-white/20">
          <button
            onClick={() => setActiveTab('goals')}
            className={cn(
              "px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
              activeTab === 'goals' ? "bg-white text-black font-bold" : "text-[#737373] hover:text-white"
            )}
          >
            REPORT
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
              activeTab === 'history' ? "bg-white text-black font-bold" : "text-[#737373] hover:text-white"
            )}
          >
            ARCHIVE
          </button>
        </div>
      </header>

      {activeTab === 'goals' ? (
        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* TOP METRICS GRID (Bento) */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* BIG NUMBER 1: Streak */}
            <div className="col-span-1 p-4 border border-white/10 flex flex-col justify-between h-32 hover:bg-white/5 transition-colors group">
              <p className="font-mono text-[10px] text-[#525252] uppercase tracking-widest group-hover:text-white/60">CURRENT STREAK</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-white italic tracking-tighter">{analytics.streak}</span>
                <span className="font-mono text-xs text-[#525252]">DAYS</span>
              </div>
            </div>

            {/* BIG NUMBER 2: This Week */}
            <div className="col-span-1 p-4 border border-white/10 flex flex-col justify-between h-32 hover:bg-white/5 transition-colors group">
              <p className="font-mono text-[10px] text-[#525252] uppercase tracking-widest group-hover:text-white/60">WEEKLY VOLUME</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-white italic tracking-tighter">{analytics.thisWeekWorkouts}</span>
                <span className="font-mono text-xs text-[#525252]">SESSIONS</span>
              </div>
            </div>

            {/* BIG NUMBER 3: Total (Full Width) */}
            <div className="col-span-2 p-4 border border-white/10 flex flex-col justify-between h-24 hover:bg-white/5 transition-colors group">
              <div className="flex justify-between items-start">
                <p className="font-mono text-[10px] text-[#525252] uppercase tracking-widest group-hover:text-white/60">LIFETIME SESSIONS</p>
                <div className="text-right">
                  <span className="text-3xl font-black text-white italic tracking-tighter">{analytics.totalWorkouts}</span>
                </div>
              </div>
              {/* Abstract Graph Line */}
              <div className="flex items-end gap-1 h-8 opacity-50">
                {monthlyGraphData.map((val, i) => (
                  <div key={i} className="flex-1 bg-white hover:bg-green-500 transition-colors" style={{ height: `${val}%` }} />
                ))}
              </div>
            </div>
          </div>

          {/* PR LIST TABLE */}
          <div className="border border-white/10">
            <div className="p-3 border-b border-white/10 bg-[#0A0A0A]">
              <h3 className="font-mono text-[10px] text-white uppercase tracking-widest">PERFORMANCE RECORDS</h3>
            </div>
            {analytics.allPRs.length > 0 ? (
              <div className="divide-y divide-white/10">
                {analytics.allPRs.map((pr, i) => (
                  <div key={i} className="p-3 flex justify-between items-center group hover:bg-white text-white hover:text-black transition-colors cursor-default">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm uppercase tracking-wide">{pr.exercise_name}</span>
                      <span className="font-mono text-[9px] text-[#525252] group-hover:text-black/60 uppercase">
                        {new Date(pr.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold tracking-tighter">
                        {pr.weight}KG
                      </div>
                      <div className="font-mono text-[9px] text-[#525252] group-hover:text-black/60 tracking-wider">
                        x {pr.reps} REPS
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="font-mono text-[10px] text-[#525252]">NO DATA AVAILABLE</p>
              </div>
            )}
          </div>
        </main>
      ) : (
        /* ARCHIVE TAB (Logs) */
        <div className="flex-1 overflow-hidden">
          <LogbookPage logs={logs} onDeleteLog={onDeleteLog} />
        </div>
      )}
    </div>
  );
}
