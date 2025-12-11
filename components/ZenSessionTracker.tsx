import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlanDay, LoggedSetSRW, LoggedSetDuration, WorkoutLog, LoggedExercise, PlanExercise, SupersetBlock, WorkoutBlock, UserProfile } from '../types';
import { useHaptic } from '../hooks/useAnimations';
import { notify } from './layout/Toast';
import { detectPR, shouldTrackPR } from '../services/prService';
import { useSaveExerciseHistory } from '../services/exerciseHistoryService';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { cn } from '../lib/utils';
import { ariaAnnouncer } from '../services/ariaAnnouncer';
import { validateWeight, validateReps } from '../lib/validationConstants';
import { useSessionState } from './session/useSessionState';
import { CheckIcon, ChevronUpIcon, ChevronDownIcon } from './icons';

/* ═══════════════════════════════════════════════════════════════
   ZEN SESSION TRACKER - Complete Training UI

   Features:
   - Full exercise list drawer (swipe up)
   - Exercise info/instructions popup
   - Current exercise hero display
   - Set dots for progress
   - Rest timer with skip
   - PR detection and celebration
   - Cardio timer mode
   ═══════════════════════════════════════════════════════════════ */

interface ZenSessionTrackerProps {
  session: PlanDay;
  onFinish: (log: { focus: string; exercises: LoggedExercise[]; durationMinutes: number }) => void;
  onCancel: () => void;
  allLogs: WorkoutLog[];
  userProfile?: UserProfile | null;
}

// Tier badge colors
const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  'S': { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  'A': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'B': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'C': { bg: 'bg-white/10', text: 'text-white/60' },
};

// Movement pattern display names
const MOVEMENT_PATTERNS: Record<string, string> = {
  'squat': 'Squat',
  'hinge': 'Hinge',
  'push_horizontal': 'Horizontal Push',
  'push_vertical': 'Vertical Push',
  'pull_horizontal': 'Horizontal Pull',
  'pull_vertical': 'Vertical Pull',
  'carry': 'Carry',
  'core': 'Core',
  'mobility': 'Mobility',
  'plyometric': 'Plyo',
  'cardio': 'Cardio',
};

// Cardio detection
const CARDIO_KEYWORDS = ['cardio', 'treadmill', 'bike', 'cycling', 'rowing', 'elliptical', 'run', 'jog', 'swim', 'hiit', 'conditioning'];
const TIMED_KEYWORDS = ['plank', 'hold', 'stretch', 'dead hang', 'wall sit'];

function isTimeBased(exercise: PlanExercise | null): boolean {
  if (!exercise) return false;
  const mt = exercise.metrics_template;
  if (mt?.type === 'duration_only' || mt?.type === 'sets_duration') return true;
  const name = exercise.exercise_name.toLowerCase();
  return CARDIO_KEYWORDS.some(k => name.includes(k)) || TIMED_KEYWORDS.some(k => name.includes(k));
}

function getTargetDuration(exercise: PlanExercise): number {
  const mt = exercise.metrics_template as any;
  if (mt?.target_duration_minutes) return mt.target_duration_minutes * 60;
  if (mt?.duration_minutes) return mt.duration_minutes * 60;
  if (mt?.target_duration_s) return mt.target_duration_s;
  const name = exercise.exercise_name.toLowerCase();
  if (CARDIO_KEYWORDS.some(k => name.includes(k))) return 30 * 60;
  return 30;
}

export default function ZenSessionTracker({ session, onFinish, onCancel, allLogs, userProfile }: ZenSessionTrackerProps) {
  const { t } = useTranslation();
  const haptic = useHaptic();
  const saveExerciseHistory = useSaveExerciseHistory();

  // Core state from hook
  const sessionState = useSessionState(session, allLogs, onFinish);
  const {
    loggedData, setLoggedData,
    isResting, setIsResting,
    restDuration, setRestDuration,
    startTime, elapsedTimeMs,
    currentBlockIndex, setCurrentBlockIndex,
    currentExerciseInBlock, setCurrentExerciseInBlock,
    currentRound, setCurrentRound,
    celebratedPRs, setCelebratedPRs,
    workoutBlocks, currentBlock, allExercises,
    currentExerciseGlobalIndex, progress, currentExercise,
    userId, getExerciseHistory,
  } = sessionState;

  // Local UI state
  const [showInput, setShowInput] = useState(false);
  const [inputWeight, setInputWeight] = useState('');
  const [inputReps, setInputReps] = useState('');
  const [showPR, setShowPR] = useState(false);
  const [completedSetFlash, setCompletedSetFlash] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // New UI states
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [showExerciseInfo, setShowExerciseInfo] = useState(false);

  // Timer state for cardio
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Get last performance for current exercise
  const lastPerformance = currentExercise ? getExerciseHistory(currentExercise.exercise_name) : null;

  // Fetch exercise cache data for current exercise
  const exerciseCacheData = useQuery(
    api.queries.getCachedExercise,
    currentExercise ? { exerciseName: currentExercise.exercise_name } : 'skip'
  );

  // Get user's pain points for injury warnings
  const userPainPoints = useMemo(() => {
    return userProfile?.trainingPreferences?.pain_points || [];
  }, [userProfile]);

  // Check if exercise has contraindication for user's pain points
  const injuryWarning = useMemo(() => {
    if (!exerciseCacheData || !userPainPoints.length) return null;

    const contraindications = exerciseCacheData.injury_contraindications || [];
    const painPointMap: Record<string, string[]> = {
      'Knees': ['knee_pain', 'knee'],
      'Lower Back': ['lower_back', 'back'],
      'Shoulders': ['shoulder', 'shoulder_impingement'],
      'Wrists': ['wrist'],
      'Neck': ['neck'],
      'Hips': ['hip'],
      'Ankles': ['ankle'],
    };

    for (const painPoint of userPainPoints) {
      const keys = painPointMap[painPoint] || [painPoint.toLowerCase().replace(/\s+/g, '_')];
      const match = contraindications.find(c =>
        keys.some(k => c.injury_type.toLowerCase().includes(k))
      );
      if (match) {
        return {
          painPoint,
          severity: match.severity,
          reason: match.reason,
          modifications: match.safe_modifications,
          alternatives: match.alternative_exercises,
        };
      }
    }
    return null;
  }, [exerciseCacheData, userPainPoints]);

  // Get exercise history from logs for this exercise
  const exerciseHistoryFromLogs = useMemo(() => {
    if (!currentExercise) return [];
    const name = currentExercise.exercise_name.toLowerCase();

    return allLogs
      .filter(log => log.exercises?.some(ex =>
        ex.exercise_name.toLowerCase() === name
      ))
      .map(log => {
        const exercise = log.exercises?.find(ex =>
          ex.exercise_name.toLowerCase() === name
        );
        const sets = exercise?.sets || [];
        const bestSet = sets.reduce((best: any, set: any) => {
          if ('weight' in set && 'reps' in set) {
            const volume = (set.weight || 0) * (set.reps || 0);
            const bestVolume = (best?.weight || 0) * (best?.reps || 0);
            return volume > bestVolume ? set : best;
          }
          return best;
        }, null);

        return {
          date: log.date,
          weight: bestSet?.weight,
          reps: bestSet?.reps,
          totalSets: sets.length,
        };
      })
      .filter(h => h.weight && h.reps)
      .slice(0, 5); // Last 5 sessions
  }, [currentExercise, allLogs]);

  // Pre-fill inputs when exercise changes
  useEffect(() => {
    if (lastPerformance) {
      setInputWeight(String(lastPerformance.weight));
      setInputReps(String(lastPerformance.reps));
    } else {
      setInputWeight('');
      setInputReps('');
    }
  }, [currentExercise?.exercise_name, lastPerformance]);

  // Timer effect for cardio
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerElapsed(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  // Calculate completed exercises count
  const completedCount = useMemo(() => {
    return Object.keys(loggedData).length;
  }, [loggedData]);

  // Handle completing a set
  const handleCompleteSet = useCallback(() => {
    if (!currentExercise) return;

    // For time-based exercises
    if (isTimeBased(currentExercise)) {
      haptic.success();
      setCompletedSetFlash(true);
      setTimeout(() => setCompletedSetFlash(false), 400);

      const newSet: LoggedSetDuration = {
        set: currentRound,
        duration_s: timerElapsed || getTargetDuration(currentExercise),
      };

      setLoggedData(prev => ({
        ...prev,
        [currentExercise.exercise_name]: [...(prev[currentExercise.exercise_name] || []), newSet]
      }));

      setTimerRunning(false);
      setTimerElapsed(0);
      advanceToNext();
      return;
    }

    // Validate strength inputs
    const weight = Number(inputWeight);
    const reps = Number(inputReps);

    if (!weight || !reps) {
      haptic.warning();
      return;
    }

    const weightValid = validateWeight(weight);
    const repsValid = validateReps(reps);

    if (!weightValid.valid || !repsValid.valid) {
      haptic.warning();
      return;
    }

    // Success!
    haptic.success();
    setCompletedSetFlash(true);
    setTimeout(() => setCompletedSetFlash(false), 400);

    const newSet: LoggedSetSRW = {
      set: currentRound,
      weight,
      reps,
    };

    setLoggedData(prev => ({
      ...prev,
      [currentExercise.exercise_name]: [...(prev[currentExercise.exercise_name] || []), newSet]
    }));

    // Save history
    saveExerciseHistory(currentExercise.exercise_name, weight, reps).catch(console.error);

    // PR detection
    if (shouldTrackPR(currentExercise.exercise_name)) {
      const prKey = `${currentExercise.exercise_name}_${weight}_${reps}`;
      if (!celebratedPRs.has(prKey)) {
        const prCheck = detectPR(currentExercise.exercise_name, weight, reps, allLogs);
        if (prCheck.isPR) {
          setCelebratedPRs(prev => new Set(prev).add(prKey));
          setShowPR(true);
          haptic.heavy();
          setTimeout(() => setShowPR(false), 2000);
        }
      }
    }

    setShowInput(false);
    advanceToNext();
  }, [currentExercise, inputWeight, inputReps, currentRound, haptic, timerElapsed, allLogs, celebratedPRs]);

  // Advance to next set/exercise
  const advanceToNext = useCallback(() => {
    if (!currentExercise || !currentBlock) return;

    const isSuperset = currentBlock.type === 'superset';
    const targetSets = currentExercise.metrics_template?.target_sets || 3;
    const totalRounds = isSuperset ? (currentBlock as SupersetBlock).rounds : targetSets;

    if (isSuperset) {
      const isLastInRound = currentExerciseInBlock === currentBlock.exercises.length - 1;
      if (isLastInRound) {
        if (currentRound >= totalRounds) {
          moveToNextBlock();
        } else {
          const restTime = currentExercise.metrics_template?.rest_period_s || 90;
          if (restTime > 0) {
            setRestDuration(restTime);
            setIsResting(true);
          }
          setCurrentExerciseInBlock(0);
          setCurrentRound(prev => prev + 1);
        }
      } else {
        setCurrentExerciseInBlock(prev => prev + 1);
      }
    } else {
      if (currentRound >= totalRounds) {
        moveToNextBlock();
      } else {
        const restTime = currentExercise.metrics_template?.rest_period_s || 90;
        if (restTime > 0) {
          setRestDuration(restTime);
          setIsResting(true);
        }
        setCurrentRound(prev => prev + 1);
      }
    }
  }, [currentExercise, currentBlock, currentRound, currentExerciseInBlock]);

  const moveToNextBlock = useCallback(() => {
    const nextBlockIndex = currentBlockIndex + 1;
    if (nextBlockIndex < workoutBlocks.length) {
      haptic.medium();
      setCurrentBlockIndex(nextBlockIndex);
      setCurrentExerciseInBlock(0);
      setCurrentRound(1);
    } else {
      handleFinishWorkout();
    }
  }, [currentBlockIndex, workoutBlocks.length, haptic]);

  const handleSkipExercise = useCallback(() => {
    haptic.light();
    moveToNextBlock();
  }, [haptic, moveToNextBlock]);

  const handleFinishWorkout = useCallback(() => {
    const duration = Math.round(elapsedTimeMs / 60000);
    const exercises: LoggedExercise[] = Object.entries(loggedData).map(([name, sets]) => ({
      exercise_name: name,
      sets: sets as LoggedSetSRW[]
    }));

    setIsExiting(true);
    haptic.success();

    setTimeout(() => {
      onFinish({
        focus: session?.focus || 'Workout',
        exercises,
        durationMinutes: duration
      });
    }, 300);
  }, [elapsedTimeMs, loggedData, session, onFinish, haptic]);

  // Navigate to specific exercise
  const navigateToExercise = useCallback((blockIdx: number, exerciseIdx: number) => {
    setCurrentBlockIndex(blockIdx);
    setCurrentExerciseInBlock(exerciseIdx);
    setCurrentRound(1);
    setShowExerciseList(false);
    haptic.medium();
  }, [haptic]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatElapsed = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Safety check
  if (!currentExercise || workoutBlocks.length === 0) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-white/60 text-lg mb-4">No exercises found</p>
          <button onClick={onCancel} className="text-[#E07A5F] font-bold text-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isCardio = isTimeBased(currentExercise);
  const targetSets = currentExercise.metrics_template?.target_sets || 3;
  const isSuperset = currentBlock?.type === 'superset';
  const totalRounds = isSuperset ? (currentBlock as SupersetBlock).rounds : targetSets;
  const targetDuration = isCardio ? getTargetDuration(currentExercise) : 0;

  return (
    <div
      className={cn(
        "min-h-screen w-full bg-black overflow-hidden relative",
        "transition-opacity duration-300",
        isExiting && "opacity-0"
      )}
    >
      {/* Ambient Progress Bar - top edge */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-20">
        <div
          className="h-full bg-gradient-to-r from-[#E07A5F] to-[#E07A5F]/80 transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 pt-[calc(env(safe-area-inset-top)+16px)] px-5 flex justify-between items-center z-20">
        <button
          onClick={onCancel}
          className="text-white/60 text-sm font-semibold active:text-white transition-colors py-2 px-1"
        >
          Exit
        </button>

        <div className="flex items-center gap-3">
          <span className="text-white font-mono text-base tabular-nums">
            {formatElapsed(elapsedTimeMs)}
          </span>
        </div>
      </header>

      {/* Exercise Counter Pill - shows progress */}
      <button
        onClick={() => {
          setShowExerciseList(true);
          haptic.light();
        }}
        className={cn(
          "absolute top-[calc(env(safe-area-inset-top)+60px)] left-1/2 -translate-x-1/2 z-20",
          "flex items-center gap-2 px-4 py-2 rounded-full",
          "bg-white/10 backdrop-blur-md border border-white/20",
          "active:scale-95 transition-transform"
        )}
      >
        <span className="text-white font-bold text-sm">
          {currentExerciseGlobalIndex + 1} / {allExercises.length}
        </span>
        <ChevronDownIcon className="w-4 h-4 text-white/60" />
      </button>

      {/* Main Content */}
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-32">
        {/* Block label if superset */}
        {isSuperset && (
          <div className="mb-4 px-4 py-1.5 rounded-full bg-[#E07A5F]/20 border border-[#E07A5F]/40">
            <span className="text-[#E07A5F] text-xs font-bold uppercase tracking-wider">
              Superset · Round {currentRound}/{totalRounds}
            </span>
          </div>
        )}

        {/* Set dots - not for cardio */}
        {!isCardio && !isSuperset && (
          <div className="flex gap-2 mb-6">
            {Array.from({ length: totalRounds }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-300",
                  i < currentRound - 1
                    ? "bg-[#E07A5F]"
                    : i === currentRound - 1
                      ? "bg-white ring-2 ring-white/30 scale-110"
                      : "bg-white/20"
                )}
              />
            ))}
          </div>
        )}

        {/* Exercise Name */}
        <h1 className={cn(
          "text-white text-center font-black leading-tight mb-2",
          "transition-all duration-300",
          currentExercise.exercise_name.length > 25
            ? "text-2xl"
            : currentExercise.exercise_name.length > 15
              ? "text-3xl"
              : "text-4xl",
          completedSetFlash && "scale-95 opacity-80"
        )}>
          {currentExercise.exercise_name}
        </h1>

        {/* Exercise meta: tier, movement pattern, muscles */}
        <div className="flex items-center gap-2 mb-4 flex-wrap justify-center">
          {exerciseCacheData?.exercise_tier && (
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-bold uppercase",
              TIER_COLORS[exerciseCacheData.exercise_tier]?.bg || 'bg-white/10',
              TIER_COLORS[exerciseCacheData.exercise_tier]?.text || 'text-white/60'
            )}>
              {exerciseCacheData.exercise_tier}-Tier
            </span>
          )}
          {exerciseCacheData?.movement_pattern && (
            <span className="text-white/50 text-xs">
              {MOVEMENT_PATTERNS[exerciseCacheData.movement_pattern] || exerciseCacheData.movement_pattern}
            </span>
          )}
          {exerciseCacheData?.muscles_worked && exerciseCacheData.muscles_worked.length > 0 && (
            <span className="text-white/50 text-xs">
              · {exerciseCacheData.muscles_worked.slice(0, 2).join(', ')}
            </span>
          )}
        </div>

        {/* Injury Warning */}
        {injuryWarning && (
          <div className={cn(
            "mb-4 px-4 py-3 rounded-xl border max-w-sm",
            injuryWarning.severity === 'absolute'
              ? "bg-red-500/10 border-red-500/30"
              : injuryWarning.severity === 'caution'
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-blue-500/10 border-blue-500/30"
          )}>
            <div className="flex items-start gap-2">
              <svg className={cn(
                "w-4 h-4 mt-0.5 flex-shrink-0",
                injuryWarning.severity === 'absolute' ? "text-red-400" :
                  injuryWarning.severity === 'caution' ? "text-amber-400" : "text-blue-400"
              )} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className={cn(
                  "text-sm font-semibold",
                  injuryWarning.severity === 'absolute' ? "text-red-400" :
                    injuryWarning.severity === 'caution' ? "text-amber-400" : "text-blue-400"
                )}>
                  {injuryWarning.severity === 'absolute' ? 'Not recommended' :
                    injuryWarning.severity === 'caution' ? 'Use caution' : 'Monitor'} ({injuryWarning.painPoint})
                </p>
                <p className="text-white/60 text-xs mt-0.5">{injuryWarning.reason}</p>
                {injuryWarning.modifications?.length > 0 && (
                  <p className="text-white/50 text-xs mt-1">
                    Tip: {injuryWarning.modifications[0]}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Exercise Info Button */}
        <button
          onClick={() => {
            setShowExerciseInfo(true);
            haptic.light();
          }}
          className="mb-4 flex items-center gap-1.5 text-white/50 text-sm font-medium active:text-white/70 transition-colors min-h-[44px]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>Exercise details</span>
        </button>

        {/* Target metrics hint */}
        {!isCardio && currentExercise.metrics_template && (
          <div className="mb-6 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white/50 text-sm text-center">
              Target: {currentExercise.metrics_template.target_sets} sets × {currentExercise.metrics_template.target_reps} reps
              {currentExercise.metrics_template.rest_period_s && (
                <span className="text-white/50"> · {currentExercise.metrics_template.rest_period_s}s rest</span>
              )}
            </p>
          </div>
        )}

        {/* Last performance hint */}
        {lastPerformance && !isCardio && (
          <div className="mb-8 flex items-center gap-2">
            <span className="text-white/50 text-sm">Last:</span>
            <span className="text-white/60 text-sm font-semibold">
              {lastPerformance.weight}kg × {lastPerformance.reps} reps
            </span>
          </div>
        )}

        {/* Cardio: Timer */}
        {isCardio && (
          <div className="flex flex-col items-center">
            <div className="relative w-52 h-52 mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="4"
                />
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke="#E07A5F"
                  strokeWidth="4"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 2 * Math.PI * 45,
                    strokeDashoffset: 2 * Math.PI * 45 * (1 - Math.min(timerElapsed / targetDuration, 1)),
                    transition: timerRunning ? 'none' : 'stroke-dashoffset 0.3s'
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white text-5xl font-black tabular-nums">
                  {formatTime(timerRunning ? Math.max(0, targetDuration - timerElapsed) : targetDuration)}
                </span>
                <span className="text-white/50 text-xs uppercase tracking-wider mt-1">
                  {timerRunning ? 'remaining' : 'target'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (timerRunning) {
                  setTimerRunning(false);
                } else if (timerElapsed >= targetDuration) {
                  handleCompleteSet();
                } else {
                  setTimerRunning(true);
                  haptic.medium();
                }
              }}
              className={cn(
                "w-40 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95",
                timerElapsed >= targetDuration
                  ? "bg-green-500 text-white"
                  : timerRunning
                    ? "bg-red-500/80 text-white"
                    : "bg-[#E07A5F] text-white"
              )}
            >
              {timerElapsed >= targetDuration ? 'Complete' : timerRunning ? 'Stop' : 'Start'}
            </button>
          </div>
        )}

        {/* Strength: Log button */}
        {!isCardio && !showInput && (
          <button
            onClick={() => {
              setShowInput(true);
              haptic.light();
            }}
            className={cn(
              "w-full max-w-xs py-5 rounded-2xl",
              "bg-[#E07A5F] text-white",
              "font-bold text-lg",
              "active:scale-95 transition-all",
              "shadow-[0_0_30px_rgba(224,122,95,0.3)]"
            )}
          >
            Log Set {currentRound}
          </button>
        )}

        {/* Skip option */}
        <button
          onClick={handleSkipExercise}
          className="mt-6 text-white/50 text-sm font-medium active:text-white/70 transition-colors min-h-[44px] py-2"
        >
          Skip exercise
        </button>
      </div>

      {/* Input Overlay */}
      {showInput && (
        <div className="fixed inset-0 z-40 bg-black/98 flex flex-col animate-fade-in">
          <div className="pt-[calc(env(safe-area-inset-top)+16px)] px-5 flex justify-between items-center">
            <button
              onClick={() => setShowInput(false)}
              className="text-white/60 text-sm font-semibold active:text-white"
            >
              Cancel
            </button>
            <span className="text-white/50 text-sm uppercase tracking-wider">
              Set {currentRound} of {totalRounds}
            </span>
            <div className="w-12" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <h2 className="text-white text-xl font-bold mb-10 text-center">
              {currentExercise.exercise_name}
            </h2>

            {/* Weight input */}
            <div className="w-full max-w-sm mb-6">
              <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block text-center">
                Weight
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={inputWeight}
                  onChange={(e) => setInputWeight(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className={cn(
                    "w-full h-20 px-6 pr-16",
                    "bg-white/5 border-2 border-white/20",
                    "rounded-2xl",
                    "text-white text-5xl font-black text-center",
                    "placeholder:text-white/50",
                    "focus:border-[#E07A5F] focus:outline-none",
                    "transition-colors"
                  )}
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-white/50 text-xl font-bold">
                  kg
                </span>
              </div>
              <div className="flex gap-2 mt-3 justify-center">
                {[-5, -2.5, +2.5, +5].map(delta => (
                  <button
                    key={delta}
                    onClick={() => {
                      const current = Number(inputWeight) || 0;
                      setInputWeight(String(Math.max(0, current + delta)));
                      haptic.light();
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-bold",
                      "transition-all active:scale-90",
                      delta < 0
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-green-500/20 text-green-400 border border-green-500/30"
                    )}
                  >
                    {delta > 0 ? '+' : ''}{delta}
                  </button>
                ))}
              </div>
            </div>

            {/* Reps input */}
            <div className="w-full max-w-sm mb-10">
              <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block text-center">
                Reps
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={inputReps}
                onChange={(e) => setInputReps(e.target.value)}
                placeholder="0"
                className={cn(
                  "w-full h-20 px-6",
                  "bg-white/5 border-2 border-white/20",
                  "rounded-2xl",
                  "text-white text-5xl font-black text-center",
                  "placeholder:text-white/20",
                  "focus:border-[#E07A5F] focus:outline-none",
                  "transition-colors"
                )}
              />
            </div>

            {/* Log button */}
            <button
              onClick={handleCompleteSet}
              disabled={!inputWeight || !inputReps}
              className={cn(
                "w-full max-w-sm py-5 rounded-2xl font-bold text-lg",
                "transition-all active:scale-95",
                inputWeight && inputReps
                  ? "bg-[#E07A5F] text-white shadow-[0_0_30px_rgba(224,122,95,0.3)]"
                  : "bg-white/10 text-white/50"
              )}
            >
              Log Set
            </button>
          </div>
        </div>
      )}

      {/* Exercise List Drawer */}
      {showExerciseList && (
        <div className="fixed inset-0 z-50 animate-fade-in" onClick={() => setShowExerciseList(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#111] rounded-t-3xl max-h-[75vh] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#111] pt-4 pb-3 px-6 border-b border-white/10 rounded-t-3xl z-10">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <div className="flex justify-between items-center">
                <h3 className="text-white font-bold text-lg">Exercises</h3>
                <span className="text-white/50 text-sm">
                  {completedCount}/{allExercises.length} done
                </span>
              </div>
            </div>

            <div className="overflow-y-auto pb-[max(2rem,env(safe-area-inset-bottom))] px-4">
              {workoutBlocks.map((block, blockIdx) => (
                <div key={blockIdx} className="py-3">
                  {block.type === 'superset' && (
                    <div className="px-2 py-1 mb-2">
                      <span className="text-[#E07A5F] text-xs font-bold uppercase tracking-wider">
                        Superset · {(block as SupersetBlock).rounds} rounds
                      </span>
                    </div>
                  )}

                  {block.exercises.map((exercise, exIdx) => {
                    const exerciseSets = loggedData[exercise.exercise_name] || [];
                    const isCompleted = exerciseSets.length > 0;
                    const isCurrent = blockIdx === currentBlockIndex && exIdx === currentExerciseInBlock;

                    // Find best set for this exercise
                    const bestSet = exerciseSets.reduce((best: any, set: any) => {
                      if ('weight' in set && 'reps' in set) {
                        const volume = (set.weight || 0) * (set.reps || 0);
                        const bestVolume = (best?.weight || 0) * (best?.reps || 0);
                        return volume > bestVolume ? set : best;
                      }
                      return best;
                    }, null);

                    // Check if any set was a PR
                    const hasPR = exerciseSets.some((set: any) => {
                      if ('weight' in set && 'reps' in set) {
                        const prCheck = detectPR(exercise.exercise_name, set.weight, set.reps, allLogs);
                        return prCheck.isPR;
                      }
                      return false;
                    });

                    return (
                      <button
                        key={exIdx}
                        onClick={() => navigateToExercise(blockIdx, exIdx)}
                        className={cn(
                          "w-full flex items-center gap-3 p-4 rounded-xl mb-2 text-left transition-all active:scale-[0.98]",
                          isCurrent
                            ? "bg-[#E07A5F]/20 border border-[#E07A5F]/40"
                            : isCompleted
                              ? "bg-white/5 border border-white/10"
                              : "bg-white/5 border border-transparent"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          isCompleted ? "bg-green-500/20" : isCurrent ? "bg-[#E07A5F]/30" : "bg-white/10"
                        )}>
                          {isCompleted ? (
                            <CheckIcon className="w-4 h-4 text-green-400" />
                          ) : (
                            <span className={cn(
                              "text-sm font-bold",
                              isCurrent ? "text-[#E07A5F]" : "text-white/50"
                            )}>
                              {blockIdx * 10 + exIdx + 1}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "font-semibold truncate",
                              isCurrent ? "text-white" : isCompleted ? "text-white/60" : "text-white/80"
                            )}>
                              {exercise.exercise_name}
                            </p>
                            {hasPR && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                PR
                              </span>
                            )}
                          </div>
                          {isCompleted && bestSet ? (
                            <p className="text-green-400/70 text-xs mt-0.5">
                              {exerciseSets.length} sets · Best: {bestSet.weight}kg × {bestSet.reps}
                            </p>
                          ) : (
                            <p className="text-white/50 text-xs mt-0.5">
                              {exercise.metrics_template?.target_sets || 3} sets × {exercise.metrics_template?.target_reps || '8-12'} reps
                            </p>
                          )}
                        </div>

                        {isCurrent && (
                          <span className="px-2 py-1 rounded-full bg-[#E07A5F] text-white text-xs font-bold">
                            NOW
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Exercise Info Modal - Enhanced with full intelligence */}
      {showExerciseInfo && currentExercise && (
        <div className="fixed inset-0 z-50 animate-fade-in" onClick={() => setShowExerciseInfo(false)}>
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" />
          <div className="absolute inset-0 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div
              className="min-h-full p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-white font-bold text-xl pr-4 mb-1">
                    {currentExercise.exercise_name}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {exerciseCacheData?.exercise_tier && (
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-bold",
                        TIER_COLORS[exerciseCacheData.exercise_tier]?.bg,
                        TIER_COLORS[exerciseCacheData.exercise_tier]?.text
                      )}>
                        {exerciseCacheData.exercise_tier}-Tier
                      </span>
                    )}
                    {exerciseCacheData?.exercise_role && (
                      <span className="text-white/50 text-xs capitalize">
                        {exerciseCacheData.exercise_role}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowExerciseInfo(false)}
                  className="text-white/50 active:text-white min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Target Metrics */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1 p-3 rounded-xl bg-white/5 text-center">
                  <p className="text-white/50 text-xs uppercase mb-1">Sets</p>
                  <p className="text-white font-bold text-lg">
                    {currentExercise.metrics_template?.target_sets || 3}
                  </p>
                </div>
                <div className="flex-1 p-3 rounded-xl bg-white/5 text-center">
                  <p className="text-white/50 text-xs uppercase mb-1">Reps</p>
                  <p className="text-white font-bold text-lg">
                    {currentExercise.metrics_template?.target_reps || '8-12'}
                  </p>
                </div>
                <div className="flex-1 p-3 rounded-xl bg-white/5 text-center">
                  <p className="text-white/50 text-xs uppercase mb-1">Rest</p>
                  <p className="text-white font-bold text-lg">
                    {currentExercise.metrics_template?.rest_period_s || 90}s
                  </p>
                </div>
              </div>

              {/* Muscles Worked */}
              {exerciseCacheData?.muscles_worked && exerciseCacheData.muscles_worked.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-white/50 text-xs uppercase tracking-wider mb-2">Muscles Worked</h4>
                  <div className="flex flex-wrap gap-2">
                    {exerciseCacheData.muscles_worked.map((muscle, i) => (
                      <span
                        key={i}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium",
                          i === 0 ? "bg-[#E07A5F]/20 text-[#E07A5F]" : "bg-white/5 text-white/70"
                        )}
                      >
                        {muscle}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipment */}
              {exerciseCacheData?.equipment_required && exerciseCacheData.equipment_required.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-white/50 text-xs uppercase tracking-wider mb-2">Equipment</h4>
                  <p className="text-white/70 text-sm">
                    {exerciseCacheData.equipment_required.join(' · ')}
                  </p>
                </div>
              )}

              {/* Form Cue */}
              {exerciseCacheData?.form_cue && (
                <div className="mb-5 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <h4 className="text-green-400 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Form Cue
                  </h4>
                  <p className="text-white/80 text-sm leading-relaxed">
                    {exerciseCacheData.form_cue}
                  </p>
                </div>
              )}

              {/* Common Mistake */}
              {exerciseCacheData?.common_mistake && (
                <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <h4 className="text-red-400 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Common Mistake
                  </h4>
                  <p className="text-white/80 text-sm leading-relaxed">
                    {exerciseCacheData.common_mistake}
                  </p>
                </div>
              )}

              {/* Step by Step Instructions */}
              {exerciseCacheData?.step_by_step && exerciseCacheData.step_by_step.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-white/50 text-xs uppercase tracking-wider mb-3">How to Perform</h4>
                  <ol className="space-y-3">
                    {exerciseCacheData.step_by_step.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E07A5F]/20 text-[#E07A5F] text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-white/70 text-sm leading-relaxed pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Your History */}
              {exerciseHistoryFromLogs.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-white/50 text-xs uppercase tracking-wider mb-3">Your History</h4>
                  <div className="space-y-2">
                    {exerciseHistoryFromLogs.map((entry, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex justify-between items-center p-3 rounded-xl",
                          i === 0 ? "bg-[#E07A5F]/10 border border-[#E07A5F]/20" : "bg-white/5"
                        )}
                      >
                        <div>
                          <p className={cn(
                            "font-bold text-sm",
                            i === 0 ? "text-[#E07A5F]" : "text-white/80"
                          )}>
                            {entry.weight}kg × {entry.reps}
                          </p>
                          <p className="text-white/40 text-xs">{entry.totalSets} sets</p>
                        </div>
                        <p className="text-white/40 text-xs">
                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation */}
              {exerciseCacheData?.explanation && (
                <div className="mb-5">
                  <h4 className="text-white/50 text-xs uppercase tracking-wider mb-2">About This Exercise</h4>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {exerciseCacheData.explanation}
                  </p>
                </div>
              )}

              {/* Notes from plan */}
              {currentExercise.notes && (
                <div className="mb-5 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <h4 className="text-blue-400 text-xs uppercase tracking-wider mb-2">Coach Notes</h4>
                  <p className="text-white/80 text-sm leading-relaxed">
                    {currentExercise.notes}
                  </p>
                </div>
              )}

              {/* Close button at bottom */}
              <button
                onClick={() => setShowExerciseInfo(false)}
                className="w-full py-4 rounded-xl bg-white/10 text-white font-bold text-base active:bg-white/20 transition-colors mt-4"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest Timer Overlay */}
      {isResting && (
        <div className="fixed inset-0 z-40 bg-black flex flex-col items-center justify-center">
          <p className="text-white/40 text-sm uppercase tracking-widest mb-4">Rest</p>
          <RestCountdown
            duration={restDuration}
            onComplete={() => setIsResting(false)}
            onSkip={() => {
              setIsResting(false);
              haptic.light();
            }}
          />
        </div>
      )}

      {/* PR Flash */}
      {showPR && (
        <div className="fixed inset-0 z-50 pointer-events-none animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/30 via-transparent to-transparent" />
          <div className="h-full flex items-center justify-center">
            <div className="text-center animate-bounce-subtle">
              <p className="text-amber-400 text-7xl font-black mb-2">PR</p>
              <p className="text-white/70 text-lg font-medium">Personal Record!</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes bounce-subtle { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .animate-bounce-subtle { animation: bounce-subtle 0.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// Rest countdown component
function RestCountdown({
  duration,
  onComplete,
  onSkip
}: {
  duration: number;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [remaining, setRemaining] = useState(duration);
  const haptic = useHaptic();

  useEffect(() => {
    if (remaining <= 0) {
      haptic.success();
      onComplete();
      return;
    }
    const timer = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onComplete, haptic]);

  useEffect(() => {
    if (remaining <= 3 && remaining > 0) {
      haptic.light();
    }
  }, [remaining, haptic]);

  const progressPct = 1 - remaining / duration;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-60 h-60 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="3"
          />
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="#E07A5F"
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              strokeDasharray: 2 * Math.PI * 45,
              strokeDashoffset: 2 * Math.PI * 45 * progressPct,
              transition: 'stroke-dashoffset 1s linear'
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-8xl font-black tabular-nums">
            {remaining}
          </span>
        </div>
      </div>

      <button
        onClick={onSkip}
        className="text-white/40 text-sm font-medium active:text-white/60 py-2 px-4"
      >
        Skip rest
      </button>
    </div>
  );
}
