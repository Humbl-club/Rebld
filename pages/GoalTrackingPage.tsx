import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutLog, WorkoutPlan, UserGoal, PersonalRecord } from '../types';
import { TrophyIcon, TargetIcon, TrendingUpIcon, FlameIcon } from '../components/icons';
import { getAllPRs } from '../services/prService';
import { useCountUp } from '../hooks/useAnimations';
import { cn } from '../lib/utils';
import LogbookPage from './LogbookPage';

/* ═══════════════════════════════════════════════════════════════
   GOAL TRACKING PAGE - Premium Redesign

   Goals and personal records tracking with premium design.
   Matches the new ZenHomePage design language.
   ═══════════════════════════════════════════════════════════════ */

interface GoalTrackingPageProps {
  logs: WorkoutLog[];
  plan: WorkoutPlan;
  userGoals?: UserGoal[];
  onDeleteLog?: (logId: string) => Promise<void>;
}

/* ───────────────────────────────────────────────────────────────
   Progress Bar Component - Premium Style
   ─────────────────────────────────────────────────────────────── */

const ProgressBar: React.FC<{ current: number; target: number; label: string; delay?: number }> = ({
  current,
  target,
  label,
  delay = 0,
}) => {
  const progress = Math.min((current / target) * 100, 100);
  const animatedCurrent = useCountUp(current, 800);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-2">
        <p className="text-[13px] font-medium text-white/60">
          {label}
        </p>
        <p className="text-[15px] font-bold text-white tabular-nums">
          {animatedCurrent} <span className="text-white/40">/</span> {target}
        </p>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
        <div
          className={cn(
            "h-full bg-gradient-to-r from-[#EF4444] to-[#F87171] rounded-full",
            "transition-all duration-1000 ease-out",
            "shadow-[0_0_12px_rgba(239,68,68,0.5)]"
          )}
          style={{
            width: mounted ? `${progress}%` : '0%',
            transitionDelay: `${delay}ms`
          }}
        />
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────
   Stat Card Component
   ─────────────────────────────────────────────────────────────── */

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  delay?: number;
}> = ({ label, value, icon, delay = 0 }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "flex-1 p-4 rounded-2xl",
        "bg-white/[0.03] border border-white/10",
        "transition-all duration-500",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[#EF4444]">
          {icon}
        </div>
        <span className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
          {label}
        </span>
      </div>
      <p className="text-2xl font-black text-white tabular-nums">
        {value}
      </p>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────
   PR Card Component - Premium Style
   ─────────────────────────────────────────────────────────────── */

const PRCard: React.FC<{ pr: PersonalRecord; index: number }> = ({ pr, index }) => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100 + index * 80);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div
      className={cn(
        "p-4 rounded-xl",
        "bg-white/[0.03] border border-white/10",
        "transition-all duration-500 active:scale-[0.98]",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white truncate">
            {pr.exercise_name}
          </p>
          <p className="text-[14px] font-bold text-[#EF4444] tabular-nums mt-0.5">
            {pr.weight}kg × {pr.reps}
          </p>
          {pr.previousBest && (
            <p className="text-[11px] text-white/40 mt-1">
              {t('goals.previousBestFormat', {
                weight: pr.previousBest.weight,
                reps: pr.previousBest.reps,
              })}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center shrink-0 ml-3">
          <TrophyIcon className="w-5 h-5 text-[#EF4444]" />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Main Goal Tracking Component
   ═══════════════════════════════════════════════════════════════ */

export default function GoalTrackingPage({ logs, plan, userGoals, onDeleteLog }: GoalTrackingPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'goals' | 'history'>('goals');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate stats
  const analytics = useMemo(() => {
    const totalWorkouts = logs.length;
    const allPRs = getAllPRs(logs);
    const recentPRs = allPRs.slice(0, 6);

    // Calculate this week's workouts
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const thisWeekWorkouts = logs.filter(log => {
      const logDate = new Date(log.startTime);
      return logDate >= startOfWeek;
    }).length;

    // Calculate current streak
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sort logs by date descending
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
          // Check yesterday if no workout today
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        } else {
          break;
        }
      }
    }

    return {
      totalWorkouts,
      allPRs: recentPRs,
      thisWeekWorkouts,
      streak,
      prCount: allPRs.length,
    };
  }, [logs]);

  // Default goal if none set
  const defaultGoal: UserGoal = {
    type: 'workout_count',
    title: t('goals.defaultGoalTitle'),
    target: 30,
    current: analytics.totalWorkouts,
  };

  const activeGoals = userGoals && userGoals.length > 0 ? userGoals : [defaultGoal];

  return (
    <div
      className={cn(
        "w-full min-h-screen",
        "px-5",
        "pt-[calc(env(safe-area-inset-top)+12px)]",
        "pb-[calc(100px+env(safe-area-inset-bottom))]",
        "bg-black"
      )}
    >
      {/* Header */}
      <header
        className={cn(
          "mb-6 transition-all duration-500",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-semibold mb-1">
          {t('goals.yourProgress').toUpperCase()}
        </p>
        <h1
          className="text-[32px] font-black text-white leading-none"
          style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
        >
          {t('goals.title')}
        </h1>
      </header>

      {/* Tab Navigation */}
      <div
        className={cn(
          "flex gap-1 p-1 rounded-2xl mb-6",
          "bg-white/[0.03] border border-white/10",
          "transition-all duration-500 delay-100",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <button
          onClick={() => setActiveTab('goals')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-[14px] font-bold transition-all duration-200",
            activeTab === 'goals'
              ? "bg-[#EF4444] text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)]"
              : "text-white/50 active:bg-white/5"
          )}
        >
          Goals & PRs
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-[14px] font-bold transition-all duration-200",
            activeTab === 'history'
              ? "bg-[#EF4444] text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)]"
              : "text-white/50 active:bg-white/5"
          )}
        >
          History
        </button>
      </div>

      {/* Goals Tab Content */}
      {activeTab === 'goals' && (
        <main className="space-y-5">
          {/* Quick Stats */}
          <div className="flex gap-3">
            <StatCard
              label="Streak"
              value={analytics.streak}
              icon={<FlameIcon className="w-4 h-4" />}
              delay={150}
            />
            <StatCard
              label="This Week"
              value={analytics.thisWeekWorkouts}
              icon={<TargetIcon className="w-4 h-4" />}
              delay={200}
            />
            <StatCard
              label="PRs"
              value={analytics.prCount}
              icon={<TrophyIcon className="w-4 h-4" />}
              delay={250}
            />
          </div>

          {/* Active Goals */}
          {activeGoals.map((goal, index) => (
            <div
              key={index}
              className={cn(
                "rounded-2xl overflow-hidden",
                "bg-white/[0.03] border border-white/10",
                "transition-all duration-500",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: `${300 + index * 100}ms` }}
            >
              {/* Goal Header */}
              <div className="p-5">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/10 flex items-center justify-center shrink-0">
                    <TargetIcon className="w-6 h-6 text-[#EF4444]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[18px] font-bold text-white leading-tight mb-1">
                      {goal.title}
                    </h2>
                    <p className="text-[14px] text-white/50">
                      {t('goals.percentComplete', {
                        percent: Math.round((goal.current / goal.target) * 100),
                      })}
                    </p>
                  </div>
                </div>

                <ProgressBar
                  current={goal.current}
                  target={goal.target}
                  label={t('goals.workoutsCompleted')}
                  delay={400}
                />

                {goal.current >= goal.target && (
                  <div className="mt-4 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30">
                    <p className="text-[14px] font-bold text-[#EF4444] text-center">
                      🎉 {t('goals.goalAchieved')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Personal Records Section */}
          {analytics.allPRs.length > 0 && (
            <div
              className={cn(
                "rounded-2xl overflow-hidden",
                "bg-white/[0.03] border border-white/10",
                "transition-all duration-500 delay-500",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#EF4444]/10 flex items-center justify-center">
                    <TrophyIcon className="w-4 h-4 text-[#EF4444]" />
                  </div>
                  <h3 className="text-[16px] font-bold text-white">
                    {t('goals.personalRecords')}
                  </h3>
                </div>

                <div className="space-y-3">
                  {analytics.allPRs.map((pr, index) => (
                    <PRCard key={index} pr={pr} index={index} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {analytics.totalWorkouts === 0 && (
            <div
              className={cn(
                "text-center py-12 px-6",
                "rounded-2xl",
                "bg-white/[0.03] border border-white/10",
                "transition-all duration-500 delay-300",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#EF4444]/20 to-transparent flex items-center justify-center mx-auto mb-5">
                <TrendingUpIcon className="w-10 h-10 text-[#EF4444]" />
              </div>
              <h3 className="text-[20px] font-bold text-white mb-2">
                {t('goals.startTraining')}
              </h3>
              <p className="text-[14px] text-white/50 max-w-[280px] mx-auto leading-relaxed mb-6">
                {t('goals.firstWorkoutMessage')}
              </p>
              <div className="flex items-center justify-center gap-2 text-[12px] text-white/30">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                Complete a workout to track your progress
              </div>
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
