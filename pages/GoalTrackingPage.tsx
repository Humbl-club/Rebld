import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutLog, WorkoutPlan, UserGoal, PersonalRecord } from '../types';
import { TrophyIcon, TargetIcon, TrendingUpIcon, FlameIcon } from '../components/icons';
import { getAllPRs } from '../services/prService';
import { cn } from '../lib/utils';
import LogbookPage from './LogbookPage';
import { usePageBackground, BackgroundOverlay } from '../hooks/usePageBackground';

/* ═══════════════════════════════════════════════════════════════
   GOAL TRACKING PAGE - Premium iOS Typography

   Typography principles:
   - Inter/SF Pro for legibility on dark backgrounds
   - Heavier weights (500-700) for better contrast
   - Proper letter-spacing on labels
   - No display fonts for content text
   ═══════════════════════════════════════════════════════════════ */

// Accent color - rich red, distinct but not harsh
const ACCENT = '#EF4444';
const ACCENT_SOFT = 'rgba(239, 68, 68, 0.12)';
const ACCENT_GLOW = 'rgba(239, 68, 68, 0.3)';

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
        <span
          className="text-[32px] font-bold tabular-nums tracking-tight"
          style={{ color: '#F5F5F5', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}
        >
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
      "flex-1 p-4 rounded-2xl",
      highlight
        ? "border"
        : "bg-[#141414] border border-white/[0.06]"
    )}
    style={highlight ? {
      backgroundColor: ACCENT_SOFT,
      borderColor: 'rgba(239, 68, 68, 0.2)'
    } : {}}
  >
    <div className="flex items-center gap-2 mb-3">
      <span style={{ color: highlight ? ACCENT : '#71717A' }}>
        {icon}
      </span>
      <span
        className="text-[11px] uppercase font-semibold"
        style={{
          color: '#A1A1AA',
          letterSpacing: '0.08em',
          fontFamily: 'Inter, -apple-system, system-ui, sans-serif'
        }}
      >
        {label}
      </span>
    </div>
    <span
      className="text-[28px] font-bold tabular-nums block"
      style={{
        color: highlight ? ACCENT : '#F5F5F5',
        fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
        letterSpacing: '-0.02em'
      }}
    >
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
      "p-4 rounded-2xl transition-all",
      isLatest
        ? "border"
        : "bg-[#141414] border border-white/[0.06]"
    )}
    style={isLatest ? {
      backgroundColor: ACCENT_SOFT,
      borderColor: 'rgba(239, 68, 68, 0.2)'
    } : {}}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p
            className="text-[15px] font-semibold truncate"
            style={{ color: '#E5E5E5', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}
          >
            {pr.exercise_name}
          </p>
          {isLatest && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
              style={{
                backgroundColor: ACCENT,
                color: 'white',
                letterSpacing: '0.04em',
                fontFamily: 'Inter, -apple-system, system-ui, sans-serif'
              }}
            >
              New
            </span>
          )}
        </div>
        <p
          className="text-[20px] font-bold tabular-nums"
          style={{
            color: ACCENT,
            fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
            letterSpacing: '-0.02em'
          }}
        >
          {pr.weight}kg × {pr.reps}
        </p>
        {pr.previousBest && (
          <p
            className="text-[12px] font-medium mt-1.5 flex items-center gap-1"
            style={{ color: '#71717A', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}
          >
            <TrendingUpIcon className="w-3 h-3" />
            was {pr.previousBest.weight}kg × {pr.previousBest.reps}
          </p>
        )}
      </div>
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ml-3"
        style={{ backgroundColor: isLatest ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.04)' }}
      >
        <TrophyIcon className="w-5 h-5" style={{ color: isLatest ? ACCENT : '#71717A' }} />
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
  const { backgroundStyles, hasBackground } = usePageBackground('goals');

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
        "w-full min-h-screen bg-[#0A0A0A] relative",
        "px-6",
        "pt-[calc(env(safe-area-inset-top)+16px)]",
        "pb-[calc(100px+env(safe-area-inset-bottom))]"
      )}
      style={backgroundStyles}
    >
      {/* Background overlay for readability */}
      {hasBackground && <BackgroundOverlay opacity={0.7} />}

      {/* Header */}
      <header
        className={cn(
          "mb-6 transition-all duration-500 relative z-10",
          mounted ? "opacity-100" : "opacity-0"
        )}
      >
        <p
          className="text-[13px] font-medium mb-1"
          style={{ color: '#71717A', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}
        >
          {t('goals.yourProgress')}
        </p>
        <h1
          className="text-[28px] font-bold tracking-tight"
          style={{ color: '#F5F5F5', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}
        >
          {t('goals.title')}
        </h1>
      </header>

      {/* Tab Navigation */}
      <div
        className={cn(
          "flex gap-1 p-1.5 rounded-2xl mb-6 relative z-10",
          "bg-[#141414] border border-white/[0.06]",
          "transition-all duration-500 delay-50",
          mounted ? "opacity-100" : "opacity-0"
        )}
      >
        {['goals', 'history'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'goals' | 'history')}
            className="flex-1 py-3 rounded-xl transition-all duration-200"
            style={{
              backgroundColor: activeTab === tab ? ACCENT : 'transparent',
              color: activeTab === tab ? '#FFFFFF' : '#A1A1AA',
              boxShadow: activeTab === tab ? `0 2px 12px ${ACCENT_GLOW}` : 'none',
              fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '-0.01em'
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
            "space-y-5 transition-all duration-500 delay-100 relative z-10",
            mounted ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Goal Card */}
          <div className="rounded-2xl p-5 bg-[#141414] border border-white/[0.06]">
            <div className="flex items-center gap-5">
              <ProgressRing progress={goalProgress} size={120} />
              <div className="flex-1">
                <h2
                  className="text-[18px] font-bold mb-1"
                  style={{
                    color: '#F5F5F5',
                    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
                    letterSpacing: '-0.02em'
                  }}
                >
                  {primaryGoal.title}
                </h2>
                <p
                  className="text-[14px] font-medium"
                  style={{
                    color: '#71717A',
                    fontFamily: 'Inter, -apple-system, system-ui, sans-serif'
                  }}
                >
                  {primaryGoal.current} of {primaryGoal.target} workouts
                </p>
              </div>
            </div>

            {goalProgress >= 100 && (
              <div
                className="mt-4 p-3 rounded-xl text-center"
                style={{ backgroundColor: ACCENT_SOFT }}
              >
                <p
                  className="text-[14px] font-semibold"
                  style={{ color: ACCENT, fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}
                >
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
                <h3
                  className="text-[14px] font-semibold"
                  style={{ color: '#E5E5E5', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}
                >
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
            <div className="text-center py-12 px-6 rounded-2xl bg-[#141414] border border-white/[0.06]">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: ACCENT_SOFT }}
              >
                <TrendingUpIcon className="w-7 h-7" style={{ color: ACCENT }} />
              </div>
              <h3
                className="text-[18px] font-bold mb-2"
                style={{ color: '#F5F5F5', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}
              >
                {t('goals.startTraining')}
              </h3>
              <p
                className="text-[14px] font-medium max-w-[240px] mx-auto"
                style={{ color: '#71717A', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}
              >
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
