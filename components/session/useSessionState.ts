import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PlanDay, LoggedSetSRW, LoggedSetDuration, LoggedExercise, WorkoutLog, PlanExercise, WorkoutBlock } from '../../types';
import { useUser } from '@clerk/clerk-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import useUserProfile from '../../hooks/useUserProfile';

export function useSessionState(
  session: PlanDay,
  allLogs: WorkoutLog[],
  onFinish: (log: { focus: string; exercises: LoggedExercise[]; durationMinutes: number }) => void
) {
  const [loggedData, setLoggedData] = useState<Record<string, (LoggedSetSRW | LoggedSetDuration)[]>>({});
  const [currentInputData, setCurrentInputData] = useState<Record<string, Partial<LoggedSetSRW>>>({});
  const [isResting, setIsResting] = useState(false);
  const [restDuration, setRestDuration] = useState(90);
  const [startTime] = useState(new Date());
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTimeMs, setElapsedTimeMs] = useState(0);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [currentExerciseInBlock, setCurrentExerciseInBlock] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedExercise, setSelectedExercise] = useState<PlanExercise | null>(null);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [celebratedPRs, setCelebratedPRs] = useState<Set<string>>(new Set());
  const [completedWarmupExercises, setCompletedWarmupExercises] = useState<Set<string>>(new Set());
  const [celebratedMilestones, setCelebratedMilestones] = useState<Set<number>>(new Set());
  const [showMilestoneCelebration, setShowMilestoneCelebration] = useState<{ progress: number; message: string } | null>(null);
  const [showWarmupDetails, setShowWarmupDetails] = useState(true);
  const [justCompletedSet, setJustCompletedSet] = useState(false);

  const pauseStartTime = useRef<Date | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { user } = useUser();
  const { userProfile } = useUserProfile();
  const userId = user?.id || null;

  const notifyBuddyMutation = useMutation(api.buddyMutations.notifyBuddyWorkoutStart);

  // Notify buddies on mount
  useEffect(() => {
    // Guard: Ensure both userId and session.focus are valid non-empty strings
    const workoutName = session?.focus;
    if (userId && workoutName && typeof workoutName === 'string' && workoutName.trim()) {
      notifyBuddyMutation({
        userId,
        workoutName: workoutName.trim()
      }).catch((error) => {
        // Silent fail - buddy notifications are not critical
        console.debug('Failed to notify workout buddies:', error);
      });
    }
  }, [userId, session?.focus, notifyBuddyMutation]);

  // Fix keyboard overlap on iOS
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        document.documentElement.style.setProperty('--viewport-height', `${viewportHeight}px`);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
      handleResize();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  // Timer effect
  useEffect(() => {
    if (!isPaused) {
      timerIntervalRef.current = setInterval(() => {
        const now = new Date().getTime();
        const totalElapsed = now - startTime.getTime();
        setElapsedTimeMs(totalElapsed);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isPaused, startTime]);

  // Extract blocks from session - handles both single session (blocks) and 2x daily (sessions)
  const workoutBlocks = useMemo(() => {
    let allBlocks: WorkoutBlock[] = [];

    // Primary: Get blocks directly from session
    if (session.blocks && Array.isArray(session.blocks)) {
      allBlocks = [...session.blocks];
    }

    // Fallback: Extract blocks from sessions array (2x daily training)
    // This handles cases where a PlanDay with sessions wasn't pre-normalized
    const sessions = (session as any).sessions;
    if ((!allBlocks.length || allBlocks.length === 0) && sessions && Array.isArray(sessions)) {
      sessions.forEach((sess: any) => {
        if (sess.blocks && Array.isArray(sess.blocks)) {
          allBlocks.push(...sess.blocks);
        }
      });
    }

    // Filter to valid blocks with exercises
    return allBlocks.filter(block =>
      block &&
      Array.isArray(block.exercises) &&
      block.exercises.length > 0
    );
  }, [session]);

  const currentBlock = workoutBlocks[currentBlockIndex];

  const allExercises = useMemo(() => {
    return workoutBlocks.flatMap(block => Array.isArray(block.exercises) ? block.exercises : []);
  }, [workoutBlocks]);

  const currentExerciseGlobalIndex = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentBlockIndex; i++) {
      count += workoutBlocks[i]?.exercises?.length || 0;
    }
    count += currentExerciseInBlock;
    return count;
  }, [currentBlockIndex, currentExerciseInBlock, workoutBlocks]);

  const progress = useMemo(
    () => allExercises.length > 0 ? (currentExerciseGlobalIndex + 1) / allExercises.length : 0,
    [allExercises.length, currentExerciseGlobalIndex]
  );

  const currentExercise = useMemo(
    () => currentBlock?.exercises?.[currentExerciseInBlock],
    [currentBlock, currentExerciseInBlock]
  );

  // Get only exercises with category 'warmup' from current block
  const warmupExercises = useMemo(() => {
    if (!currentBlock || !Array.isArray(currentBlock.exercises)) return [];
    return currentBlock.exercises.filter(ex => ex && ex.exercise_name && ex.category === 'warmup');
  }, [currentBlock]);

  // If there are no warmup exercises, consider warmups complete (don't block progress)
  // If there are warmup exercises, all must be completed
  const allWarmupsComplete = useMemo(() => {
    if (warmupExercises.length === 0) return true; // No warmups = always complete
    return warmupExercises.every(ex => completedWarmupExercises.has(ex.exercise_name));
  }, [warmupExercises, completedWarmupExercises]);

  const getExerciseHistory = useCallback((exerciseName: string) => {
    const lastLog = allLogs
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .find(log => log.exercises.some(ex => ex.exercise_name === exerciseName));

    if (!lastLog) return null;
    const exercise = lastLog.exercises.find(ex => ex.exercise_name === exerciseName);
    if (!exercise || !exercise.sets.length) return null;
    const lastSet = exercise.sets[exercise.sets.length - 1];
    if ('weight' in lastSet && 'reps' in lastSet) {
      return { weight: lastSet.weight, reps: lastSet.reps };
    }
    return null;
  }, [allLogs]);

  const getExerciseHistoryFull = useCallback((exerciseName: string, limit = 3) => {
    const sortedLogs = allLogs
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const history: Array<{ date: string; weight: number; reps: number; volume: number }> = [];

    for (const log of sortedLogs) {
      if (history.length >= limit) break;
      const exercise = log.exercises.find(ex => ex.exercise_name === exerciseName);
      if (exercise && exercise.sets.length > 0) {
        const lastSet = exercise.sets[exercise.sets.length - 1];
        if ('weight' in lastSet && 'reps' in lastSet) {
          // Parse values safely, handling NaN correctly (parseFloat('abc') returns NaN, not 0)
          const parsedWeight = typeof lastSet.weight === 'string' ? parseFloat(lastSet.weight) : lastSet.weight;
          const parsedReps = typeof lastSet.reps === 'string' ? parseFloat(lastSet.reps) : lastSet.reps;
          const weight = Number.isNaN(parsedWeight) ? 0 : parsedWeight;
          const reps = Number.isNaN(parsedReps) ? 0 : parsedReps;
          history.push({
            date: log.date,
            weight: weight,
            reps: reps,
            volume: weight * reps * exercise.sets.length,
          });
        }
      }
    }

    return history.length > 0 ? history : null;
  }, [allLogs]);

  return {
    // State
    loggedData,
    setLoggedData,
    currentInputData,
    setCurrentInputData,
    isResting,
    setIsResting,
    restDuration,
    setRestDuration,
    startTime,
    isPaused,
    setIsPaused,
    elapsedTimeMs,
    currentBlockIndex,
    setCurrentBlockIndex,
    currentExerciseInBlock,
    setCurrentExerciseInBlock,
    currentRound,
    setCurrentRound,
    selectedExercise,
    setSelectedExercise,
    showExerciseList,
    setShowExerciseList,
    celebratedPRs,
    setCelebratedPRs,
    completedWarmupExercises,
    setCompletedWarmupExercises,
    celebratedMilestones,
    setCelebratedMilestones,
    showMilestoneCelebration,
    setShowMilestoneCelebration,
    showWarmupDetails,
    setShowWarmupDetails,
    justCompletedSet,
    setJustCompletedSet,

    // Computed
    workoutBlocks,
    currentBlock,
    allExercises,
    currentExerciseGlobalIndex,
    progress,
    currentExercise,
    warmupExercises,
    allWarmupsComplete,
    userId,
    userProfile,

    // Utilities
    getExerciseHistory,
    getExerciseHistoryFull,
  };
}
