import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutLog, WorkoutPlan, UserGoal, PersonalRecord } from '../types';
import { TrophyIcon, TargetIcon, TrendingUpIcon, FlameIcon } from '../components/icons';
import { getAllPRs } from '../services/prService';
import { cn } from '../lib/utils';
import LogbookPage from './LogbookPage';

/* ═══════════════════════════════════════════════════════════════
   GOAL TRACKING PAGE - Clean, Sophisticated Design

   - Warm coral accent (#F0725C)
   - Clean system typography
   - Proper visual hierarchy
   - Easy on the eyes
   ═══════════════════════════════════════════════════════════════ */

// Accent color - warm coral
const ACCENT = '#F0725C';
const ACCENT_SOFT = 'rgba(240, 114, 92, 0.15)';
const ACCENT_GLOW = 'rgba(240, 114, 92, 0.25)';

interface GoalTrackingPageProps {
  logs: WorkoutLog[];
  plan: WorkoutPlan;
  userGoals?: UserGoal[];
  onDeleteLog?: (logId: string) => Promise<void>;
}

/* ───────────────────────────────────────────────────────────────
   Progress Ring - Animated SVG
   ─────────────────────────────────────────────────────────────── */

const ProgressRing: React.FC<{ progress: number; size?: number }> = ({
  progress,
  size = 100
}) => {
  const [mounted, setMounted] = useState(false);
  const strokeWidth = 6;
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ACCENT}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? offset : circumference}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white text-2xl font-semibold tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────
   Stat Card
   ─────────────────────────────────────────────────────────────── */

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}> = ({ label, value, icon, highlight }) => (
  <div
    className={cn(
      "flex-1 p-4 rounded-xl",
      highlight
        ? "border"
        : "bg-white/[0.02] border border-white/[0.04]"
    )}
    style={highlight ? {
      backgroundColor: ACCENT_SOFT,
      borderColor: 'rgba(240, 114, 92, 0.25)'
    } : {}}
  >
    <div className="flex items-center gap-2 mb-2">
      <span style={{ color: highlight ? ACCENT : 'rgba(255,255,255,0.4)' }}>
        {icon}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
        {label}
      </span>
    </div>
    <span className={cn(
      "text-xl font-semibold tabular-nums",
      highlight ? "" : "text-white"
    )} style={highlight ? { color: ACCENT } : {}}>
      {value}
    </span>
  </div>
);

/* ───────────────────────────────────────────────────────────────
   PR Card
   ─────────────────────────────────────────────────────────────── */

const PRCard: React.FC<{ pr: PersonalRecord; isLatest?: boolean }> = ({ pr, isLatest }) => (
  <div
    className={cn(
      "p-4 rounded-xl transition-all",
      isLatest
        ? "border"
        : "bg-white/[0.02] border border-white/[0.04]"
    )}
    style={isLatest ? {
      backgroundColor: ACCENT_SOFT,
      borderColor: 'rgba(240, 114, 92, 0.25)'
    } : {}}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[15px] font-medium text-white/90 truncate">
            {pr.exercise_name}
          </p>
          {isLatest && (
            <span
              className="px-2 py-0.5 rounded text-[9px] font-medium uppercase"
              style={{ backgroundColor: ACCENT, color: 'white' }}
            >
              New
            </span>
          )}
        </div>
        <p className="text-lg font-semibold tabular-nums" style={{ color: ACCENT }}>
          {pr.weight}kg × {pr.reps}
        </p>
        {pr.previousBest && (
          <p className="text-[11px] text-white/30 mt-1 flex items-center gap-1">
            <TrendingUpIcon className="w-3 h-3" />
            was {pr.previousBest.weight}kg × {pr.previousBest.reps}
          </p>
        )}
      </div>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3"
        style={{ backgroundColor: isLatest ? 'rgba(240, 114, 92, 0.2)' : 'rgba(255,255,255,0.04)' }}
      >
        <TrophyIcon className="w-5 h-5" style={{ color: isLatest ? ACCENT : 'rgba(255,255,255,0.3)' }} />
      </div>
    </div>
  </div>
);

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

  // Calculate stats
  const analytics = useMemo(() => {
    const totalWorkouts = logs.length;
    const allPRs = getAllPRs(logs);
    const recentPRs = allPRs.slice(0, 5);

    // This week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const thisWeekWorkouts = logs.filter(log => {
      const logDate = new Date(log.startTime);
      return logDate >= startOfWeek;
    }).length;

    // Streak
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
        "w-full min-h-screen bg-[#0A0A0A]",
        "px-6",
        "pt-[calc(env(safe-area-inset-top)+16px)]",
        "pb-[calc(100px+env(safe-area-inset-bottom))]"
      )}
    >
      {/* Header */}
      <header
        className={cn(
          "mb-6 transition-all duration-500",
          mounted ? "opacity-100" : "opacity-0"
        )}
      >
        <p className="text-white/40 text-sm font-medium mb-1">
          {t('goals.yourProgress')}
        </p>
        <h1 className="text-white text-2xl font-semibold tracking-tight">
          {t('goals.title')}
        </h1>
      </header>

      {/* Tab Navigation */}
      <div
        className={cn(
          "flex gap-1 p-1 rounded-xl mb-6",
          "bg-white/[0.02] border border-white/[0.04]",
          "transition-all duration-500 delay-50",
          mounted ? "opacity-100" : "opacity-0"
        )}
      >
        {['goals', 'history'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'goals' | 'history')}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: activeTab === tab ? ACCENT : 'transparent',
              color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
              boxShadow: activeTab === tab ? `0 2px 12px ${ACCENT_GLOW}` : 'none'
            }}
          >
            {tab === 'goals' ? 'Goals & PRs' : 'History'}
          </button>
        ))}
      </div>

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <main
          className={cn(
            "space-y-5 transition-all duration-500 delay-100",
            mounted ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Goal Card */}
          <div className="rounded-2xl p-5 bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-5">
              <ProgressRing progress={goalProgress} />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white mb-1">
                  {primaryGoal.title}
                </h2>
                <p className="text-white/40 text-sm">
                  {primaryGoal.current} of {primaryGoal.target} workouts
                </p>
              </div>
            </div>

            {goalProgress >= 100 && (
              <div
                className="mt-4 p-3 rounded-xl text-center"
                style={{ backgroundColor: ACCENT_SOFT }}
              >
                <p className="text-sm font-medium" style={{ color: ACCENT }}>
                  Goal achieved!
                </p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="flex gap-3">
            <StatCard
              label="Streak"
              value={analytics.streak}
              icon={<FlameIcon className="w-4 h-4" />}
              highlight
            />
            <StatCard
              label="This Week"
              value={analytics.thisWeekWorkouts}
              icon={<TargetIcon className="w-4 h-4" />}
            />
            <StatCard
              label="PRs"
              value={analytics.prCount}
              icon={<TrophyIcon className="w-4 h-4" />}
            />
          </div>

          {/* Personal Records */}
          {analytics.allPRs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <TrophyIcon className="w-4 h-4" style={{ color: ACCENT }} />
                <h3 className="text-white/90 text-sm font-medium">
                  Personal Records
                </h3>
              </div>
              <div className="space-y-2">
                {analytics.allPRs.map((pr, index) => (
                  <PRCard key={index} pr={pr} isLatest={index === 0} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {analytics.totalWorkouts === 0 && (
            <div className="text-center py-12 px-6 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: ACCENT_SOFT }}
              >
                <TrendingUpIcon className="w-7 h-7" style={{ color: ACCENT }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {t('goals.startTraining')}
              </h3>
              <p className="text-sm text-white/40 max-w-[240px] mx-auto">
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
