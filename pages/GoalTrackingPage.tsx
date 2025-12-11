import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutLog, WorkoutPlan, UserGoal, PersonalRecord } from '../types';
import { TrophyIcon, TargetIcon, TrendingUpIcon, FlameIcon, CheckIcon } from '../components/icons';
import { getAllPRs } from '../services/prService';
import { useCountUp } from '../hooks/useAnimations';
import { cn } from '../lib/utils';
import LogbookPage from './LogbookPage';

/* ═══════════════════════════════════════════════════════════════
   GOAL TRACKING PAGE - Premium Redesign v2

   Design Philosophy:
   - Celebrate achievements, not just show them
   - Visual progress that motivates
   - Intelligent insights about performance
   - Make PRs feel special
   ═══════════════════════════════════════════════════════════════ */

interface GoalTrackingPageProps {
  logs: WorkoutLog[];
  plan: WorkoutPlan;
  userGoals?: UserGoal[];
  onDeleteLog?: (logId: string) => Promise<void>;
}

// Get motivational message based on progress
function getMotivationalMessage(percent: number): string {
  if (percent >= 100) return "You did it! Time for a new challenge.";
  if (percent >= 80) return "Almost there — don't stop now!";
  if (percent >= 60) return "Past halfway. Momentum is building.";
  if (percent >= 40) return "Solid progress. Keep pushing.";
  if (percent >= 20) return "Great start. Stay consistent.";
  return "Every journey starts with one step.";
}

// Get days since last PR
function getDaysSinceLastPR(prs: PersonalRecord[]): number | null {
  if (prs.length === 0) return null;
  const latestPR = prs[0];
  if (!latestPR.date) return null;
  const prDate = new Date(latestPR.date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - prDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/* ───────────────────────────────────────────────────────────────
   Animated Progress Ring Component
   ─────────────────────────────────────────────────────────────── */

const ProgressRing: React.FC<{ progress: number; size?: number; strokeWidth?: number }> = ({
  progress,
  size = 120,
  strokeWidth = 8
}) => {
  const [mounted, setMounted] = useState(false);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EF4444"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? offset : circumference}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))'
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white text-3xl font-black tabular-nums">
          {Math.round(progress)}
          <span className="text-lg">%</span>
        </span>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────
   Mini Stat Card
   ─────────────────────────────────────────────────────────────── */

const MiniStat: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: boolean;
  delay?: number;
}> = ({ label, value, icon, accent, delay = 0 }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "flex-1 p-3 rounded-xl transition-all duration-500",
        accent
          ? "bg-gradient-to-br from-[#EF4444]/15 to-transparent border border-[#EF4444]/20"
          : "bg-white/[0.03] border border-white/[0.06]",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={accent ? "text-[#EF4444]" : "text-white/40"}>
          {icon}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold">
          {label}
        </span>
      </div>
      <span className={cn(
        "text-xl font-black tabular-nums",
        accent ? "text-[#EF4444]" : "text-white"
      )}>
        {value}
      </span>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────
   PR Card with Celebration
   ─────────────────────────────────────────────────────────────── */

const PRCard: React.FC<{ pr: PersonalRecord; index: number; isLatest?: boolean }> = ({
  pr,
  index,
  isLatest
}) => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100 + index * 60);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div
      className={cn(
        "p-4 rounded-xl transition-all duration-500",
        isLatest
          ? "bg-gradient-to-br from-[#EF4444]/10 via-[#EF4444]/5 to-transparent border border-[#EF4444]/30"
          : "bg-white/[0.02] border border-white/[0.06]",
        "active:scale-[0.98]",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[15px] font-bold text-white truncate">
              {pr.exercise_name}
            </p>
            {isLatest && (
              <span className="px-1.5 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] text-[9px] font-bold uppercase">
                Latest
              </span>
            )}
          </div>
          <p className="text-[18px] font-black text-[#EF4444] tabular-nums">
            {pr.weight}kg × {pr.reps}
          </p>
          {pr.previousBest && (
            <p className="text-[11px] text-white/30 mt-1 flex items-center gap-1">
              <TrendingUpIcon className="w-3 h-3" />
              Previous: {pr.previousBest.weight}kg × {pr.previousBest.reps}
            </p>
          )}
        </div>
        <div className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ml-3",
          isLatest ? "bg-[#EF4444]/20" : "bg-white/[0.04]"
        )}>
          <TrophyIcon className={cn(
            "w-5 h-5",
            isLatest ? "text-[#EF4444]" : "text-white/30"
          )} />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function GoalTrackingPage({ logs, plan, userGoals, onDeleteLog }: GoalTrackingPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'goals' | 'history'>('goals');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate comprehensive stats
  const analytics = useMemo(() => {
    const totalWorkouts = logs.length;
    const allPRs = getAllPRs(logs);
    const recentPRs = allPRs.slice(0, 6);

    // This week's workouts
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const thisWeekWorkouts = logs.filter(log => {
      const logDate = new Date(log.startTime);
      return logDate >= startOfWeek;
    }).length;

    // This month's workouts
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthWorkouts = logs.filter(log => {
      const logDate = new Date(log.startTime);
      return logDate >= startOfMonth;
    }).length;

    // Streak calculation
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedLogs = [...logs].sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    if (sortedLogs.length > 0) {
      let checkDate = new Date(today);
      for (let i = 0; i < 30; i++) {
        const hasWorkout = sortedLogs.some(log => {
          const logDate = new Date(log.startTime);
          logDate.setHours(0, 0, 0, 0);
          return logDate.getTime() === checkDate.getTime();
        });

        if (hasWorkout) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (i === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        } else {
          break;
        }
      }
    }

    // Total volume this week
    const thisWeekVolume = logs
      .filter(log => {
        const logDate = new Date(log.startTime);
        return logDate >= startOfWeek;
      })
      .reduce((total, log) => {
        return total + log.exercises.reduce((exTotal, ex) => {
          return exTotal + ex.sets.reduce((setTotal, set) => {
            if ('weight' in set && 'reps' in set) {
              const weight = typeof set.weight === 'string' ? parseFloat(set.weight) || 0 : set.weight;
              const reps = typeof set.reps === 'string' ? parseFloat(set.reps) || 0 : set.reps;
              return setTotal + (weight * reps);
            }
            return setTotal;
          }, 0);
        }, 0);
      }, 0);

    return {
      totalWorkouts,
      allPRs: recentPRs,
      thisWeekWorkouts,
      thisMonthWorkouts,
      streak,
      prCount: allPRs.length,
      thisWeekVolume: Math.round(thisWeekVolume),
      daysSinceLastPR: getDaysSinceLastPR(allPRs)
    };
  }, [logs]);

  // Default goal
  const defaultGoal: UserGoal = {
    type: 'workout_count',
    title: t('goals.defaultGoalTitle'),
    target: 30,
    current: analytics.totalWorkouts,
  };

  const activeGoals = userGoals && userGoals.length > 0 ? userGoals : [defaultGoal];
  const primaryGoal = activeGoals[0];
  const goalProgress = Math.min((primaryGoal.current / primaryGoal.target) * 100, 100);

  return (
    <div
      className={cn(
        "w-full min-h-screen bg-black",
        "px-5",
        "pt-[calc(env(safe-area-inset-top)+12px)]",
        "pb-[calc(100px+env(safe-area-inset-bottom))]"
      )}
    >
      {/* Header */}
      <header
        className={cn(
          "mb-5 transition-all duration-500",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold mb-1">
          {t('goals.yourProgress').toUpperCase()}
        </p>
        <h1
          className="text-[28px] font-black text-white leading-none"
          style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
        >
          {t('goals.title')}
        </h1>
      </header>

      {/* Tab Navigation */}
      <div
        className={cn(
          "flex gap-1 p-1 rounded-xl mb-5",
          "bg-white/[0.02] border border-white/[0.06]",
          "transition-all duration-500 delay-50",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <button
          onClick={() => setActiveTab('goals')}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all duration-200",
            activeTab === 'goals'
              ? "bg-[#EF4444] text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)]"
              : "text-white/40 active:bg-white/5"
          )}
        >
          Goals & PRs
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all duration-200",
            activeTab === 'history'
              ? "bg-[#EF4444] text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)]"
              : "text-white/40 active:bg-white/5"
          )}
        >
          History
        </button>
      </div>

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <main className="space-y-5">
          {/* Hero Goal Card with Ring */}
          <div
            className={cn(
              "rounded-2xl overflow-hidden",
              "bg-gradient-to-br from-white/[0.04] to-transparent",
              "border border-white/[0.08]",
              "transition-all duration-500 delay-100",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <div className="p-5">
              <div className="flex items-center gap-5">
                {/* Progress Ring */}
                <ProgressRing progress={goalProgress} />

                {/* Goal Info */}
                <div className="flex-1">
                  <h2 className="text-[18px] font-bold text-white leading-tight mb-1">
                    {primaryGoal.title}
                  </h2>
                  <p className="text-white/40 text-sm mb-3">
                    {primaryGoal.current} of {primaryGoal.target}
                  </p>

                  {/* Motivational message */}
                  <p className="text-[#EF4444] text-xs font-medium italic">
                    {getMotivationalMessage(goalProgress)}
                  </p>
                </div>
              </div>

              {/* Milestone markers */}
              {goalProgress < 100 && (
                <div className="mt-5 pt-4 border-t border-white/[0.06]">
                  <div className="flex justify-between items-center">
                    {[25, 50, 75, 100].map((milestone) => (
                      <div key={milestone} className="flex flex-col items-center">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center mb-1",
                          goalProgress >= milestone
                            ? "bg-[#EF4444]/20"
                            : "bg-white/[0.04]"
                        )}>
                          {goalProgress >= milestone ? (
                            <CheckIcon className="w-3 h-3 text-[#EF4444]" />
                          ) : (
                            <span className="text-[10px] text-white/30 font-bold">{milestone}</span>
                          )}
                        </div>
                        <span className="text-[9px] text-white/20">{milestone}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goal achieved celebration */}
              {goalProgress >= 100 && (
                <div className="mt-5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-center">
                  <span className="text-2xl mb-2 block">🎉</span>
                  <p className="text-[#EF4444] font-bold text-sm">
                    Goal Achieved!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <MiniStat
              label="Streak"
              value={analytics.streak}
              icon={<FlameIcon className="w-3 h-3" />}
              accent
              delay={150}
            />
            <MiniStat
              label="This Week"
              value={analytics.thisWeekWorkouts}
              icon={<TargetIcon className="w-3 h-3" />}
              delay={200}
            />
            <MiniStat
              label="Total PRs"
              value={analytics.prCount}
              icon={<TrophyIcon className="w-3 h-3" />}
              delay={250}
            />
          </div>

          {/* Volume stat */}
          {analytics.thisWeekVolume > 0 && (
            <div
              className={cn(
                "p-4 rounded-xl",
                "bg-white/[0.02] border border-white/[0.06]",
                "transition-all duration-500 delay-300",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold mb-1">
                    Week Volume
                  </p>
                  <p className="text-white text-2xl font-black tabular-nums">
                    {analytics.thisWeekVolume.toLocaleString()}
                    <span className="text-white/40 text-sm ml-1">kg</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
                  <TrendingUpIcon className="w-5 h-5 text-white/30" />
                </div>
              </div>
            </div>
          )}

          {/* Personal Records Section */}
          {analytics.allPRs.length > 0 && (
            <div
              className={cn(
                "transition-all duration-500 delay-400",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white text-[15px] font-bold flex items-center gap-2">
                  <TrophyIcon className="w-4 h-4 text-[#EF4444]" />
                  Personal Records
                </h3>
                {analytics.daysSinceLastPR !== null && analytics.daysSinceLastPR <= 7 && (
                  <span className="text-[10px] text-[#EF4444] font-bold uppercase tracking-wider">
                    New this week!
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {analytics.allPRs.map((pr, index) => (
                  <PRCard
                    key={index}
                    pr={pr}
                    index={index}
                    isLatest={index === 0}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {analytics.totalWorkouts === 0 && (
            <div
              className={cn(
                "text-center py-12 px-6 rounded-2xl",
                "bg-white/[0.02] border border-white/[0.06]",
                "transition-all duration-500 delay-200",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="w-16 h-16 rounded-2xl bg-[#EF4444]/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUpIcon className="w-8 h-8 text-[#EF4444]" />
              </div>
              <h3 className="text-[18px] font-bold text-white mb-2">
                {t('goals.startTraining')}
              </h3>
              <p className="text-[13px] text-white/40 max-w-[260px] mx-auto leading-relaxed">
                {t('goals.firstWorkoutMessage')}
              </p>
            </div>
          )}
        </main>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <LogbookPage logs={logs} onDeleteLog={onDeleteLog} />
      )}
    </div>
  );
}
