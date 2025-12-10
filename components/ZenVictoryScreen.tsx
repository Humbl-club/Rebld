import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutLog, UserProfile } from '../types';
import { useCountUp, useHaptic } from '../hooks/useAnimations';
import { detectPR } from '../services/prService';
import { cn } from '../lib/utils';

/* ═══════════════════════════════════════════════════════════════
   VICTORY SCREEN - Athlete Intelligence Summary

   Shows meaningful data after workout completion:
   - PRs achieved this session
   - Comparison to last similar session
   - Periodization progress (for competition users)
   - Volume, duration, sets completed

   No excessive animations or breathing - just data.
   ═══════════════════════════════════════════════════════════════ */

interface ZenVictoryScreenProps {
  sessionLog: WorkoutLog;
  onDone: () => void;
  allLogs?: WorkoutLog[];
  userProfile?: UserProfile | null;
}

export default function ZenVictoryScreen({ sessionLog, onDone, allLogs = [], userProfile }: ZenVictoryScreenProps) {
  const { t } = useTranslation();
  const haptic = useHaptic();
  const [showContent, setShowContent] = useState(false);
  const [statsRevealed, setStatsRevealed] = useState(0);

  // Calculate stats
  const exercises = Array.isArray(sessionLog.exercises) ? sessionLog.exercises : [];
  const totalVolume = exercises.reduce((sum, ex) => {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    return sum + sets.reduce((setSum, set) => {
      if ('weight' in set && 'reps' in set) {
        return setSum + (Number(set.weight) * Number(set.reps));
      }
      return setSum;
    }, 0);
  }, 0);
  const totalSets = exercises.reduce((sum, ex) => {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    return sum + sets.length;
  }, 0);

  // Detect PRs from this session
  const prsAchieved = useMemo(() => {
    const prs: { exercise: string; weight: number; reps: number }[] = [];

    exercises.forEach(ex => {
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      sets.forEach((set: any) => {
        if ('weight' in set && 'reps' in set) {
          const prCheck = detectPR(ex.exercise_name, set.weight, set.reps, allLogs);
          if (prCheck.isPR) {
            // Only add unique PRs (highest for each exercise)
            const existing = prs.find(p => p.exercise === ex.exercise_name);
            const volume = set.weight * set.reps;
            if (!existing || (existing.weight * existing.reps) < volume) {
              if (existing) {
                prs.splice(prs.indexOf(existing), 1);
              }
              prs.push({
                exercise: ex.exercise_name,
                weight: set.weight,
                reps: set.reps,
              });
            }
          }
        }
      });
    });

    return prs;
  }, [exercises, allLogs]);

  // Find last similar session for comparison
  const lastSimilarSession = useMemo(() => {
    const focusLower = (sessionLog.focus || '').toLowerCase();
    const similar = allLogs.find(log =>
      log.date !== sessionLog.date &&
      (log.focus || '').toLowerCase() === focusLower
    );

    if (!similar) return null;

    const similarExercises = similar.exercises || [];
    const similarVolume = similarExercises.reduce((sum, ex) => {
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      return sum + sets.reduce((setSum, set) => {
        if ('weight' in set && 'reps' in set) {
          return setSum + (Number(set.weight) * Number(set.reps));
        }
        return setSum;
      }, 0);
    }, 0);

    return {
      date: similar.date,
      volume: similarVolume,
      duration: similar.durationMinutes || 0,
    };
  }, [sessionLog, allLogs]);

  // Calculate periodization progress
  const periodization = useMemo(() => {
    const specificGoal = userProfile?.trainingPreferences?.specific_goal;
    if (!specificGoal?.target_date) return null;

    const targetDate = new Date(specificGoal.target_date);
    const today = new Date();
    const daysUntil = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return null;

    // Get week number (count workouts this week)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const workoutsThisWeek = allLogs.filter(log => new Date(log.date) >= weekStart).length;

    return {
      eventName: specificGoal.event_name || specificGoal.event_type,
      daysUntil,
      workoutsThisWeek,
    };
  }, [userProfile, allLogs]);

  // Animated counts
  const durationCount = useCountUp(showContent ? (sessionLog.durationMinutes || 0) : 0, 1200);
  const volumeCount = useCountUp(showContent ? Math.round(totalVolume) : 0, 1500);

  // Quick reveal animation
  useEffect(() => {
    haptic.success();

    // Show content immediately
    const timer = setTimeout(() => setShowContent(true), 100);

    // Reveal stats progressively
    const statsTimer = setInterval(() => {
      setStatsRevealed(prev => {
        if (prev >= 5) {
          clearInterval(statsTimer);
          return prev;
        }
        return prev + 1;
      });
    }, 200);

    return () => {
      clearTimeout(timer);
      clearInterval(statsTimer);
    };
  }, []);

  const handleDone = () => {
    haptic.medium();
    onDone();
  };

  // Calculate volume change
  const volumeChange = lastSimilarSession
    ? ((totalVolume - lastSimilarSession.volume) / lastSimilarSession.volume * 100)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex-1 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-y-auto">

        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center">
          <div
            className={cn(
              "inline-flex items-center justify-center w-16 h-16 rounded-full mb-4",
              "bg-gradient-to-br from-[#E07A5F] to-[#C45D45]",
              "transition-all duration-500",
              showContent ? "scale-100 opacity-100" : "scale-50 opacity-0"
            )}
          >
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L19 7" />
            </svg>
          </div>

          <p
            className="text-[#E07A5F] text-xs uppercase tracking-[0.3em] mb-2"
            style={{
              opacity: statsRevealed > 0 ? 1 : 0,
              transition: 'opacity 0.3s ease-out'
            }}
          >
            Complete
          </p>
          <h1
            className="text-white text-2xl font-bold tracking-tight"
            style={{
              opacity: statsRevealed > 0 ? 1 : 0,
              transform: statsRevealed > 0 ? 'translateY(0)' : 'translateY(10px)',
              transition: 'all 0.4s ease-out'
            }}
          >
            {sessionLog.focus || 'Workout'}
          </h1>
        </div>

        {/* Main Stats */}
        <div
          className="mx-6 p-4 rounded-2xl bg-white/5 mb-4"
          style={{
            opacity: statsRevealed > 1 ? 1 : 0,
            transform: statsRevealed > 1 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.4s ease-out'
          }}
        >
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <p className="text-white text-3xl font-black tabular-nums">
                {durationCount}
              </p>
              <p className="text-white/50 text-xs uppercase tracking-wider mt-1">min</p>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="text-center flex-1">
              <p className="text-white text-3xl font-black tabular-nums">
                {volumeCount.toLocaleString()}
              </p>
              <p className="text-white/50 text-xs uppercase tracking-wider mt-1">kg</p>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="text-center flex-1">
              <p className="text-white text-3xl font-black tabular-nums">
                {totalSets}
              </p>
              <p className="text-white/50 text-xs uppercase tracking-wider mt-1">sets</p>
            </div>
          </div>
        </div>

        {/* PRs Section */}
        {prsAchieved.length > 0 && (
          <div
            className="mx-6 mb-4"
            style={{
              opacity: statsRevealed > 2 ? 1 : 0,
              transform: statsRevealed > 2 ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.4s ease-out'
            }}
          >
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🏆</span>
                <h3 className="text-amber-400 font-bold text-sm uppercase tracking-wider">
                  Personal Records
                </h3>
              </div>
              <div className="space-y-2">
                {prsAchieved.map((pr, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-white/80 text-sm truncate flex-1 mr-4">
                      {pr.exercise}
                    </span>
                    <span className="text-amber-400 font-bold text-sm whitespace-nowrap">
                      {pr.weight}kg × {pr.reps}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Comparison to Last Session */}
        {lastSimilarSession && volumeChange !== null && (
          <div
            className="mx-6 mb-4"
            style={{
              opacity: statsRevealed > 3 ? 1 : 0,
              transform: statsRevealed > 3 ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.4s ease-out'
            }}
          >
            <div className={cn(
              "p-4 rounded-2xl border",
              volumeChange >= 0
                ? "bg-green-500/10 border-green-500/20"
                : "bg-white/5 border-white/10"
            )}>
              <h3 className="text-white/50 font-medium text-xs uppercase tracking-wider mb-3">
                vs Last {sessionLog.focus}
              </h3>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-white/60 text-xs mb-1">Volume</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">
                      {totalVolume.toLocaleString()}kg
                    </span>
                    <span className={cn(
                      "text-xs font-bold",
                      volumeChange >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {volumeChange >= 0 ? '↑' : '↓'} {Math.abs(volumeChange).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-xs mb-1">Previous</p>
                  <span className="text-white/60">
                    {lastSimilarSession.volume.toLocaleString()}kg
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Periodization Progress */}
        {periodization && (
          <div
            className="mx-6 mb-4"
            style={{
              opacity: statsRevealed > 4 ? 1 : 0,
              transform: statsRevealed > 4 ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.4s ease-out'
            }}
          >
            <div className="p-4 rounded-2xl bg-[#E07A5F]/10 border border-[#E07A5F]/20">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-[#E07A5F] font-bold text-xs uppercase tracking-wider">
                  {periodization.eventName}
                </h3>
                <span className="text-white/60 text-xs">
                  {periodization.workoutsThisWeek} workouts this week
                </span>
              </div>
              <p className="text-white font-bold text-lg">
                {periodization.daysUntil} days to go
              </p>
            </div>
          </div>
        )}

        {/* Exercise Summary */}
        <div
          className="mx-6 mb-4"
          style={{
            opacity: statsRevealed > 4 ? 1 : 0,
            transform: statsRevealed > 4 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.4s ease-out 0.1s'
          }}
        >
          <h3 className="text-white/50 font-medium text-xs uppercase tracking-wider mb-3 px-1">
            Exercises Completed
          </h3>
          <div className="space-y-2">
            {exercises.slice(0, 5).map((ex, i) => {
              const sets = Array.isArray(ex.sets) ? ex.sets : [];
              const hasPR = prsAchieved.some(pr => pr.exercise === ex.exercise_name);
              const bestSet = sets.reduce((best: any, set: any) => {
                if ('weight' in set && 'reps' in set) {
                  const volume = (set.weight || 0) * (set.reps || 0);
                  const bestVolume = (best?.weight || 0) * (best?.reps || 0);
                  return volume > bestVolume ? set : best;
                }
                return best;
              }, null);

              return (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 rounded-xl bg-white/5"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-white/80 text-sm truncate">
                      {ex.exercise_name}
                    </span>
                    {hasPR && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold flex-shrink-0">
                        PR
                      </span>
                    )}
                  </div>
                  <span className="text-white/50 text-sm whitespace-nowrap ml-2">
                    {sets.length} sets
                    {bestSet && ` · ${bestSet.weight}kg`}
                  </span>
                </div>
              );
            })}
            {exercises.length > 5 && (
              <p className="text-white/30 text-xs text-center mt-2">
                +{exercises.length - 5} more exercises
              </p>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-4" />

        {/* Done button */}
        <div
          className="px-6 pb-8 pt-4"
          style={{
            opacity: statsRevealed > 4 ? 1 : 0,
            transform: statsRevealed > 4 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s ease-out 0.2s'
          }}
        >
          <button
            onClick={handleDone}
            className="w-full py-4 rounded-xl bg-[#E07A5F] text-white font-bold text-base active:scale-[0.98] transition-transform"
          >
            {t('victory.done', 'Done')}
          </button>
          <p className="text-center text-white/30 text-xs mt-3">
            Progress saved automatically
          </p>
        </div>
      </div>
    </div>
  );
}
