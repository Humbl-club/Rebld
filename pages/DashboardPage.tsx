import React, { useMemo } from 'react';
import { WorkoutLog, WorkoutPlan, PlanDay, DailyRoutine, WorkoutSession } from '../types';
import { DumbbellIcon, FireIcon, CheckIcon } from '../components/icons';
import { useUser } from '@clerk/clerk-react';
import PerformanceAnalytics from '../components/PerformanceAnalytics';
import useUserProfile from '../hooks/useUserProfile';
import { cn } from '../lib/utils';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/ui/PullToRefreshIndicator';
import { useHaptic } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   ATHLETE INTELLIGENCE DASHBOARD - Comprehensive Redesign

   Features:
   - Periodization progress for competition users
   - PR counter for this week
   - Key lifts with percentage progression
   - Next session preview with one-tap start
   - Weekly completion tracker
   ═══════════════════════════════════════════════════════════════ */

interface DashboardPageProps {
  logs: WorkoutLog[];
  plan: WorkoutPlan;
  onStartSession?: (session: PlanDay | DailyRoutine | WorkoutSession) => void;
}

// Helper functions
const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const getDayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const KEY_LIFTS = ['squat', 'bench', 'deadlift', 'overhead press', 'ohp'];

export default function DashboardPage({ logs, plan, onStartSession }: DashboardPageProps) {
  const { user } = useUser();
  const { userProfile } = useUserProfile();
  const haptic = useHaptic();
  const userId = user?.id || null;

  const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });

  // Calculate all analytics
  const analytics = useMemo(() => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const sortedLogs = safeLogs
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const today = getDayStart(new Date());
    const oneWeekAgo = new Date(today.getTime() - 6 * 86400000);

    // Calculate Streak
    let currentStreak = 0;
    if (sortedLogs.length > 0) {
      const uniqueLogDays = [
        ...new Set(sortedLogs.map((log) => getDayStart(new Date(log.date)).getTime())),
      ]
        .map((time) => new Date(time))
        .sort((a, b) => b.getTime() - a.getTime());

      if (
        uniqueLogDays.length > 0 &&
        (isSameDay(uniqueLogDays[0], today) ||
          isSameDay(uniqueLogDays[0], new Date(today.getTime() - 86400000)))
      ) {
        currentStreak = 1;
        for (let i = 1; i < uniqueLogDays.length; i++) {
          const diff = uniqueLogDays[i - 1].getTime() - uniqueLogDays[i].getTime();
          if (diff === 86400000) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    // Calculate Weekly Volume
    let totalWeeklyVolume = 0;
    safeLogs.forEach((log) => {
      const logDate = getDayStart(new Date(log.date));
      if (logDate >= oneWeekAgo) {
        const exercises = Array.isArray(log.exercises) ? log.exercises : [];
        exercises.forEach((ex) => {
          const sets = Array.isArray(ex.sets) ? ex.sets : [];
          sets.forEach((set) => {
            if ('weight' in set && 'reps' in set) {
              totalWeeklyVolume += Number(set.weight) * Number(set.reps);
            }
          });
        });
      }
    });

    // Calculate PRs this week (simplified: count sessions with new max weights)
    let weeklyPRs = 0;
    const exerciseMaxes: Record<string, number> = {};

    sortedLogs.forEach((log) => {
      const logDate = getDayStart(new Date(log.date));
      const exercises = Array.isArray(log.exercises) ? log.exercises : [];

      exercises.forEach((ex) => {
        const name = ex.exercise_name?.toLowerCase() || '';
        const sets = Array.isArray(ex.sets) ? ex.sets : [];
        const maxWeight = Math.max(
          ...sets.map((s: any) => ('weight' in s ? Number(s.weight) : 0)),
          0
        );

        if (maxWeight > 0) {
          const prevMax = exerciseMaxes[name] || 0;
          if (maxWeight > prevMax) {
            if (logDate >= oneWeekAgo) {
              weeklyPRs++;
            }
            exerciseMaxes[name] = maxWeight;
          }
        }
      });
    });

    // Key Lift Progression with percentages
    const keyLiftProgress: { name: string; start: number; current: number; percent: number }[] = [];
    KEY_LIFTS.forEach((liftName) => {
      const relevantLogs = sortedLogs
        .map((log) => {
          const ex = (log.exercises || []).find((e) =>
            e?.exercise_name?.toLowerCase?.()?.includes(liftName)
          );
          return ex ? { date: log.date, exercise: ex } : null;
        })
        .filter(Boolean);

      if (relevantLogs.length >= 2) {
        const getHeaviestSet = (ex: any) =>
          Math.max(...(ex?.sets || []).map((s: any) => ('weight' in s ? Number(s.weight) : 0)), 0);
        const startWeight = getHeaviestSet(relevantLogs[0]!.exercise);
        const currentWeight = getHeaviestSet(relevantLogs[relevantLogs.length - 1]!.exercise);

        if (startWeight > 0) {
          const percent = startWeight > 0 ? ((currentWeight - startWeight) / startWeight) * 100 : 0;
          keyLiftProgress.push({
            name: liftName.replace('overhead press', 'OHP').replace('ohp', 'OHP'),
            start: startWeight,
            current: currentWeight,
            percent: Math.round(percent * 10) / 10
          });
        }
      }
    });

    // Weekly completion tracker
    const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const mondayOffset = (today.getDay() + 6) % 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - mondayOffset);

    const completedDays = weekDays.map((_, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      return safeLogs.some(log => isSameDay(getDayStart(new Date(log.date)), dayDate));
    });

    return {
      totalWorkouts: safeLogs.length,
      currentStreak,
      totalWeeklyVolume: Math.round(totalWeeklyVolume),
      weeklyPRs,
      keyLiftProgress,
      completedDays,
      weekDays,
    };
  }, [logs]);

  // Get next session from plan
  const nextSession = useMemo(() => {
    if (!plan?.weeklyPlan) return null;

    const today = new Date();
    const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0=Mon, 6=Sun

    // Try to find today's or next workout
    for (let i = 0; i < 7; i++) {
      const dayIndex = (todayIndex + i) % 7;
      const dayPlan = plan.weeklyPlan[dayIndex];

      if (dayPlan) {
        // Check if it's not a rest day
        const blocks = 'blocks' in dayPlan ? dayPlan.blocks : [];
        const exercises = blocks?.flatMap(b => b.exercises || []) || [];

        if (exercises.length > 0) {
          const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          return {
            day: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[dayIndex],
            focus: ('focus' in dayPlan ? dayPlan.focus : '') || 'Workout',
            exerciseCount: exercises.length,
            duration: ('estimated_duration_minutes' in dayPlan ? dayPlan.estimated_duration_minutes : null) || Math.round(exercises.length * 4),
            session: dayPlan,
          };
        }
      }
    }
    return null;
  }, [plan]);

  // Get periodization info
  const periodization = useMemo(() => {
    const specificGoal = userProfile?.trainingPreferences?.specific_goal;
    if (!specificGoal?.target_date) return null;

    const targetDate = new Date(specificGoal.target_date);
    const now = new Date();
    const totalWeeks = Math.ceil((targetDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));

    if (totalWeeks <= 0) return null;

    // Calculate current phase
    const base = Math.floor(totalWeeks * 0.35);
    const build = Math.floor(totalWeeks * 0.35);
    const peak = Math.floor(totalWeeks * 0.15);

    // Determine which phase we're in based on weeks remaining
    let currentPhase = 'BASE';
    let phaseColor = 'bg-blue-500';
    const weeksIntoProgram = Math.max(0, Math.ceil((now.getTime() - new Date().getTime()) / (7 * 24 * 60 * 60 * 1000)));

    if (totalWeeks <= peak) {
      currentPhase = 'TAPER';
      phaseColor = 'bg-green-500';
    } else if (totalWeeks <= peak + Math.floor(totalWeeks * 0.15)) {
      currentPhase = 'PEAK';
      phaseColor = 'bg-orange-500';
    } else if (totalWeeks <= peak + Math.floor(totalWeeks * 0.15) + build) {
      currentPhase = 'BUILD';
      phaseColor = 'bg-yellow-500';
    }

    const daysUntil = Math.ceil((targetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    return {
      eventType: specificGoal.event_type || 'Event',
      eventName: specificGoal.event_name,
      targetDate: specificGoal.target_date,
      totalWeeks,
      currentPhase,
      phaseColor,
      daysUntil,
      progress: Math.min(100, Math.max(0, 100 - (totalWeeks / 16) * 100)), // Assuming 16-week max
    };
  }, [userProfile]);

  const handleStartSession = () => {
    if (nextSession?.session && onStartSession) {
      haptic.heavy();
      onStartSession(nextSession.session);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-5 pt-[env(safe-area-inset-top)] pb-[calc(80px+env(safe-area-inset-bottom))] animate-fade-in">
      <PullToRefreshIndicator distance={pullDistance} isRefreshing={isRefreshing} isTriggered={pullDistance >= 80} />

      {/* Periodization Progress (for competition users) */}
      {periodization && (
        <div className="mb-6 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider">
                {periodization.eventType.toUpperCase()}
              </p>
              <p className="text-white font-bold text-lg">
                {periodization.currentPhase} Phase
              </p>
            </div>
            <div className="text-right">
              <p className="text-[#E07A5F] font-black text-2xl tabular-nums">
                {periodization.daysUntil}
              </p>
              <p className="text-white/50 text-xs">days left</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', periodization.phaseColor)}
              style={{ width: `${periodization.progress}%` }}
            />
          </div>

          <p className="text-white/40 text-xs mt-2">
            {periodization.totalWeeks} weeks until {periodization.eventName || 'event'}
          </p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Streak */}
        <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 text-center">
          <p className="text-white font-black text-3xl tabular-nums">
            {analytics.currentStreak}
          </p>
          <p className="text-white/50 text-xs uppercase tracking-wider mt-1">Streak</p>
        </div>

        {/* Weekly Volume */}
        <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 text-center">
          <p className="text-white font-black text-3xl tabular-nums">
            {analytics.totalWeeklyVolume >= 1000
              ? `${(analytics.totalWeeklyVolume / 1000).toFixed(1)}k`
              : analytics.totalWeeklyVolume}
          </p>
          <p className="text-white/50 text-xs uppercase tracking-wider mt-1">kg/week</p>
        </div>

        {/* PRs */}
        <div className="p-4 rounded-xl bg-[#E07A5F]/20 border border-[#E07A5F]/30 text-center">
          <p className="text-[#E07A5F] font-black text-3xl tabular-nums">
            {analytics.weeklyPRs}
          </p>
          <p className="text-[#E07A5F]/70 text-xs uppercase tracking-wider mt-1">PRs</p>
        </div>
      </div>

      {/* Key Lifts */}
      {analytics.keyLiftProgress.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Key Lifts</p>

          <div className="space-y-4">
            {analytics.keyLiftProgress.slice(0, 4).map((lift) => (
              <div key={lift.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold capitalize">{lift.name}</span>
                  <span className="text-white/90 font-mono text-sm">
                    {lift.start}kg → <span className="text-[#E07A5F] font-bold">{lift.current}kg</span>
                  </span>
                </div>
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#E07A5F] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(10, (lift.current / (lift.start * 1.5)) * 100))}%` }}
                  />
                </div>
                {lift.percent > 0 && (
                  <p className="text-green-400 text-xs mt-1 text-right">↑ {lift.percent}%</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* This Week */}
      <div className="mb-6 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">This Week</p>

        <div className="flex justify-between items-center">
          {analytics.weekDays.map((day, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center mb-1 transition-all',
                analytics.completedDays[i]
                  ? 'bg-[#E07A5F] text-white'
                  : 'bg-white/10 text-white/40'
              )}>
                {analytics.completedDays[i] ? (
                  <CheckIcon className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-bold">{day}</span>
                )}
              </div>
              <span className="text-white/30 text-[10px]">{day}</span>
            </div>
          ))}
        </div>

        <p className="text-white/40 text-xs mt-3 text-center">
          {analytics.completedDays.filter(Boolean).length}/7 workouts completed
        </p>
      </div>

      {/* Next Session */}
      {nextSession && onStartSession && (
        <button
          onClick={handleStartSession}
          className="w-full p-5 rounded-2xl bg-[#E07A5F] text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/70 text-xs uppercase tracking-wider mb-1">
                {nextSession.day}
              </p>
              <p className="text-white font-bold text-lg">
                {nextSession.focus}
              </p>
              <p className="text-white/70 text-sm mt-1">
                {nextSession.exerciseCount} exercises · ~{nextSession.duration} min
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}

      {/* Performance Analytics for Sport-Specific Training */}
      {userId && userProfile?.trainingPreferences?.sport_specific && (
        <div className="mt-6">
          <PerformanceAnalytics
            userId={userId}
            sport={userProfile.trainingPreferences.sport_specific}
          />
        </div>
      )}

      {/* Empty State */}
      {analytics.totalWorkouts < 2 && !nextSession && (
        <div className="text-center py-12 px-6 bg-white/[0.04] border border-white/10 rounded-2xl">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <DumbbellIcon className="h-8 w-8 text-white/40" />
          </div>
          <h3 className="text-white font-bold text-xl">Start Training</h3>
          <p className="mt-2 text-white/50 text-sm">
            Log a few workouts to see your progress analytics.
          </p>
        </div>
      )}
    </div>
  );
}
