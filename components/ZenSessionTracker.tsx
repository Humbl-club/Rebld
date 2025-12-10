import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlanDay, LoggedSetSRW, LoggedSetDuration, WorkoutLog, LoggedExercise, PlanExercise, SupersetBlock, WorkoutBlock } from '../types';
import { useHaptic } from '../hooks/useAnimations';
import { notify } from './layout/Toast';
import { detectPR, shouldTrackPR } from '../services/prService';
import { useSaveExerciseHistory } from '../services/exerciseHistoryService';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { cn } from '../lib/utils';
import { ariaAnnouncer } from '../services/ariaAnnouncer';
import { validateWeight, validateReps } from '../lib/validationConstants';
import { useSessionState } from './session/useSessionState';

/* ═══════════════════════════════════════════════════════════════
   ZEN SESSION TRACKER - Premium Minimal Training UI

   Philosophy: Like a music player, not a form
   - One exercise, full screen, nothing else
   - Tap to input, swipe to navigate
   - Ambient progress, visual momentum
   - The reward is the flow itself
   ═══════════════════════════════════════════════════════════════ */

interface ZenSessionTrackerProps {
  session: PlanDay;
  onFinish: (log: { focus: string; exercises: LoggedExercise[]; durationMinutes: number }) => void;
  onCancel: () => void;
  allLogs: WorkoutLog[];
}

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

export default function ZenSessionTracker({ session, onFinish, onCancel, allLogs }: ZenSessionTrackerProps) {
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
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  // Timer state for cardio
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Swipe gesture refs
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isDragging = useRef(false);

  // Get last performance for current exercise
  const lastPerformance = currentExercise ? getExerciseHistory(currentExercise.exercise_name) : null;

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
      // Superset logic
      const isLastInRound = currentExerciseInBlock === currentBlock.exercises.length - 1;
      if (isLastInRound) {
        if (currentRound >= totalRounds) {
          // Block complete
          moveToNextBlock();
        } else {
          // Next round
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
      // Single exercise logic
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
      // Workout complete
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

  // Touch handlers for swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (showInput || isResting) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = true;
  }, [showInput, isResting]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || showInput || isResting) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    // Only track upward swipes for completion
    if (deltaY < 0) {
      setSwipeOffset(Math.min(0, deltaY * 0.5));
    }
  }, [showInput, isResting]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // If swiped up enough, open input
    if (swipeOffset < -50 && !isTimeBased(currentExercise)) {
      setShowInput(true);
      haptic.light();
    }
    setSwipeOffset(0);
  }, [swipeOffset, currentExercise, haptic]);

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
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 text-lg mb-4">No exercises found</p>
          <button onClick={onCancel} className="text-[var(--brand-primary)] font-bold">
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
        "h-screen w-full bg-black overflow-hidden relative",
        "transition-opacity duration-300",
        isExiting && "opacity-0"
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Ambient Progress Bar - top edge */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Header - minimal */}
      <div className="absolute top-0 left-0 right-0 pt-[calc(env(safe-area-inset-top)+12px)] px-5 flex justify-between items-center z-10">
        <button
          onClick={onCancel}
          className="text-white/40 text-sm font-medium active:text-white/60"
        >
          Exit
        </button>
        <span className="text-white/40 text-sm font-mono tabular-nums">
          {formatElapsed(elapsedTimeMs)}
        </span>
      </div>

      {/* Main Content - centered */}
      <div
        className={cn(
          "h-full flex flex-col items-center justify-center px-8",
          "transition-transform duration-200"
        )}
        style={{ transform: `translateY(${swipeOffset}px)` }}
      >
        {/* Set indicator - tiny, above exercise */}
        {!isCardio && (
          <div className="flex gap-2 mb-6">
            {Array.from({ length: totalRounds }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  i < currentRound - 1
                    ? "bg-[var(--brand-primary)]"
                    : i === currentRound - 1
                      ? "bg-white scale-125"
                      : "bg-white/20"
                )}
              />
            ))}
          </div>
        )}

        {/* Exercise Name - MASSIVE */}
        <h1 className={cn(
          "text-white text-center font-black leading-tight mb-4",
          "transition-all duration-300",
          currentExercise.exercise_name.length > 20 ? "text-3xl" : "text-4xl",
          completedSetFlash && "scale-95 opacity-80"
        )}>
          {currentExercise.exercise_name}
        </h1>

        {/* Last performance hint */}
        {lastPerformance && !isCardio && (
          <p className="text-white/30 text-sm font-medium mb-8">
            Last: {lastPerformance.weight}kg × {lastPerformance.reps}
          </p>
        )}

        {/* Cardio: Timer */}
        {isCardio && (
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-48 h-48 mb-6">
              {/* Timer ring */}
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
                  stroke="var(--brand-primary)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 2 * Math.PI * 45,
                    strokeDashoffset: 2 * Math.PI * 45 * (1 - Math.min(timerElapsed / targetDuration, 1)),
                    transition: timerRunning ? 'none' : 'stroke-dashoffset 0.3s'
                  }}
                />
              </svg>
              {/* Timer text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white text-5xl font-black tabular-nums">
                  {formatTime(timerRunning ? targetDuration - timerElapsed : targetDuration)}
                </span>
              </div>
            </div>

            {/* Timer controls */}
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
                "px-12 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95",
                timerElapsed >= targetDuration
                  ? "bg-green-500 text-white"
                  : timerRunning
                    ? "bg-red-500/80 text-white"
                    : "bg-[var(--brand-primary)] text-white"
              )}
            >
              {timerElapsed >= targetDuration ? 'Complete' : timerRunning ? 'Stop' : 'Start'}
            </button>
          </div>
        )}

        {/* Strength: Tap to log prompt */}
        {!isCardio && !showInput && (
          <button
            onClick={() => {
              setShowInput(true);
              haptic.light();
            }}
            className={cn(
              "mt-4 px-8 py-4 rounded-2xl",
              "bg-white/10 backdrop-blur-sm",
              "border border-white/20",
              "text-white font-semibold text-lg",
              "active:scale-95 active:bg-white/20",
              "transition-all duration-200"
            )}
          >
            Tap to log set {currentRound}
          </button>
        )}

        {/* Skip option - subtle */}
        <button
          onClick={handleSkipExercise}
          className="mt-8 text-white/20 text-sm font-medium active:text-white/40"
        >
          Skip exercise
        </button>
      </div>

      {/* Input Overlay - slides up from bottom */}
      {showInput && (
        <div
          className={cn(
            "absolute inset-0 z-30",
            "bg-black/95 backdrop-blur-xl",
            "flex flex-col",
            "animate-fade-in"
          )}
        >
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <p className="text-white/50 text-sm uppercase tracking-widest mb-2">
              Set {currentRound} of {totalRounds}
            </p>
            <h2 className="text-white text-2xl font-bold mb-10 text-center">
              {currentExercise.exercise_name}
            </h2>

            {/* Weight input */}
            <div className="w-full max-w-xs mb-6">
              <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">
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
                    "bg-white/5 border-2 border-white/10",
                    "rounded-2xl",
                    "text-white text-4xl font-black text-center",
                    "placeholder:text-white/20",
                    "focus:border-[var(--brand-primary)] focus:outline-none",
                    "transition-colors"
                  )}
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-white/40 text-xl font-bold">
                  kg
                </span>
              </div>
              {/* Quick adjust */}
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
                        ? "bg-red-500/20 text-red-400"
                        : "bg-green-500/20 text-green-400"
                    )}
                  >
                    {delta > 0 ? '+' : ''}{delta}
                  </button>
                ))}
              </div>
            </div>

            {/* Reps input */}
            <div className="w-full max-w-xs mb-10">
              <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">
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
                  "bg-white/5 border-2 border-white/10",
                  "rounded-2xl",
                  "text-white text-4xl font-black text-center",
                  "placeholder:text-white/20",
                  "focus:border-[var(--brand-primary)] focus:outline-none",
                  "transition-colors"
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 w-full max-w-xs">
              <button
                onClick={() => setShowInput(false)}
                className="flex-1 py-4 rounded-2xl bg-white/10 text-white font-semibold active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteSet}
                disabled={!inputWeight || !inputReps}
                className={cn(
                  "flex-[2] py-4 rounded-2xl font-bold text-lg",
                  "transition-all active:scale-95",
                  inputWeight && inputReps
                    ? "bg-[var(--brand-primary)] text-white"
                    : "bg-white/5 text-white/30"
                )}
              >
                Log Set
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest Timer Overlay */}
      {isResting && (
        <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center">
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

      {/* PR Flash - full screen golden glow */}
      {showPR && (
        <div className="absolute inset-0 z-50 pointer-events-none animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/30 via-transparent to-transparent" />
          <div className="h-full flex items-center justify-center">
            <div className="text-center animate-bounce-subtle">
              <p className="text-amber-400 text-6xl font-black mb-2">PR</p>
              <p className="text-white/60 text-lg">Personal Record!</p>
            </div>
          </div>
        </div>
      )}
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

  // Haptic at 3, 2, 1
  useEffect(() => {
    if (remaining <= 3 && remaining > 0) {
      haptic.light();
    }
  }, [remaining, haptic]);

  const progress = 1 - remaining / duration;

  return (
    <div className="flex flex-col items-center">
      {/* Circular countdown */}
      <div className="relative w-56 h-56 mb-8">
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
            stroke="var(--brand-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              strokeDasharray: 2 * Math.PI * 45,
              strokeDashoffset: 2 * Math.PI * 45 * progress,
              transition: 'stroke-dashoffset 1s linear'
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-7xl font-black tabular-nums">
            {remaining}
          </span>
        </div>
      </div>

      <button
        onClick={onSkip}
        className="text-white/30 text-sm font-medium active:text-white/50"
      >
        Skip rest
      </button>
    </div>
  );
}
