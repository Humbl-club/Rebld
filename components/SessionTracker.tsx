import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlanDay, LoggedSetSRW, LoggedSetDuration, WorkoutLog, LoggedExercise, PlanExercise, SupersetBlock, AmrapBlock, StrengthProfile } from '../types';
import { useHaptic } from '../hooks/useAnimations';
import { notify } from './layout/Toast';
import { detectPR, shouldTrackPR } from '../services/prService';
import { useSaveExerciseHistory } from '../services/exerciseHistoryService';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { ariaAnnouncer } from '../services/ariaAnnouncer';
import { validateWeight, validateReps } from '../lib/validationConstants';
import {  CheckCircleIcon, FlameIcon, TrophyIcon, ZapIcon } from './icons';
import { suggestWeight } from '../lib/workoutUtils';

// Component imports
import SessionHeader from './session/SessionHeader';
import ExerciseCard from './session/ExerciseCard';
import ExerciseHistoryPreview from './session/ExerciseHistoryPreview';
import SetInputControls from './session/SetInputControls';
import SmartSuggestions from './session/SmartSuggestions';
import WarmupScreen from './session/WarmupScreen';
import AmrapScreen from './session/AmrapScreen';
import RestTimer from './RestTimer';
import ExerciseExplanationModal from './ExerciseExplanationModal';
import { useSessionState } from './session/useSessionState';

/* ═══════════════════════════════════════════════════════════════
   SESSION TRACKER - Refactored Version (Phase 10.1)

   Modular workout session tracking with separated concerns.
   Reduced from 1692 lines to ~500 lines by extracting:
   - SessionHeader, ExerciseCard, ExerciseHistoryPreview
   - SetInputControls, SmartSuggestions, WarmupScreen, AmrapScreen
   - useSessionState custom hook
   ═══════════════════════════════════════════════════════════════ */

interface SessionTrackerProps {
  session: PlanDay;
  onFinish: (log: { focus: string, exercises: LoggedExercise[], durationMinutes: number }) => void;
  onCancel: () => void;
  allLogs: WorkoutLog[];
  onOpenChatWithMessage?: (message: string) => void;
  strengthProfile?: StrengthProfile | null; // For AI weight suggestions
}

export default function SessionTracker({ session, onFinish, onCancel, allLogs, onOpenChatWithMessage, strengthProfile }: SessionTrackerProps) {
  const { t } = useTranslation();
  const saveExerciseHistory = useSaveExerciseHistory();
  const haptic = useHaptic();

  // Use custom hook for state management
  const sessionState = useSessionState(session, allLogs, onFinish);
  const {
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
    getExerciseHistory,
    getExerciseHistoryFull,
  } = sessionState;

  const savePerformanceMutation = useMutation(api.sportBucketMutations.saveExercisePerformance);
  const updateSportBucketMutation = useMutation(api.sportBucketMutations.updateSportBucket);
  const updateSportPerformanceMutation = useMutation(api.sportBucketMutations.updateSportBucketPerformance);

  // Pause/Resume handlers
  const handlePause = useCallback(() => {
    setIsPaused(true);
    haptic.light();
    ariaAnnouncer.announce('Workout paused', 'polite');
  }, [haptic]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    haptic.light();
    ariaAnnouncer.announce('Workout resumed', 'polite');
  }, [haptic]);

  // Announce exercise changes for screen readers
  useEffect(() => {
    if (currentExercise) {
      ariaAnnouncer.announceWorkoutProgress(
        currentExerciseGlobalIndex + 1,
        allExercises.length,
        currentExercise.exercise_name
      );
    }
  }, [currentExercise, currentExerciseGlobalIndex, allExercises.length]);

  // Milestone celebrations
  useEffect(() => {
    const milestones = [
      { threshold: 0.25, message: '25% Complete', emoji: '' },
      { threshold: 0.5, message: 'Halfway', emoji: '' },
      { threshold: 0.75, message: 'Almost Done', emoji: '' }
    ];

    milestones.forEach(milestone => {
      if (progress >= milestone.threshold && !celebratedMilestones.has(milestone.threshold)) {
        setCelebratedMilestones(prev => new Set(prev).add(milestone.threshold));
        setShowMilestoneCelebration({ progress: milestone.threshold * 100, message: milestone.message });
        haptic.medium();
        setTimeout(() => setShowMilestoneCelebration(null), 2500);
      }
    });
  }, [progress, celebratedMilestones, haptic]);

  const upcomingSteps = useMemo(() => {
    const steps: string[] = [];
    const isSuperset = currentBlock?.type === 'superset';

    if (isSuperset && currentBlock?.exercises?.length) {
      if (currentExerciseInBlock < currentBlock.exercises.length - 1) {
        steps.push(currentBlock.exercises[currentExerciseInBlock + 1]?.exercise_name || '');
      } else if (currentRound < (currentBlock as SupersetBlock).rounds) {
        steps.push(t('session.restWithTime', { seconds: currentExercise?.metrics_template?.rest_period_s || 90 }));
        steps.push(t('session.roundOf', { current: currentRound + 1, total: (currentBlock as SupersetBlock).rounds }));
      }
    } else {
      if (currentRound < (currentExercise?.metrics_template?.target_sets || 3)) {
        steps.push(t('session.restWithTime', { seconds: currentExercise?.metrics_template?.rest_period_s || 90 }));
        steps.push(t('session.setNumber', { number: currentRound + 1 }));
      } else if (currentBlockIndex < workoutBlocks.length - 1) {
        const nextBlock = workoutBlocks[currentBlockIndex + 1];
        steps.push(`${t('session.next')}: ${nextBlock.title || t('session.nextBlock')}`);
      }
    }
    return steps.slice(0, 3);
  }, [currentBlock, currentExerciseInBlock, currentRound, currentExercise, workoutBlocks, currentBlockIndex, t]);

  const lastPerformance = currentExercise ? getExerciseHistory(currentExercise.exercise_name) : null;

  useEffect(() => {
    if (currentExercise && lastPerformance && !currentInputData[currentExercise.exercise_name]) {
      setCurrentInputData(prev => ({
        ...prev,
        [currentExercise.exercise_name]: {
          weight: lastPerformance.weight,
          reps: lastPerformance.reps,
        }
      }));
    }
  }, [currentExercise, lastPerformance, currentInputData]);

  const handleInputChange = useCallback((field: 'weight' | 'reps' | 'duration' | 'distance', value: string) => {
    if (!currentExercise) return;

    setCurrentInputData(prev => ({
      ...prev,
      [currentExercise.exercise_name]: {
        ...prev[currentExercise.exercise_name],
        [field]: value
      }
    }));
  }, [currentExercise]);

  // Check if current exercise is time-based (cardio/intervals)
  const isTimeBased = useCallback((exercise: PlanExercise | null): boolean => {
    if (!exercise?.metrics_template) {
      const name = exercise?.exercise_name?.toLowerCase() || '';
      return name.includes('interval') || name.includes('cardio') ||
             name.includes('treadmill') || name.includes('bike') ||
             name.includes('row') || name.includes('plank') ||
             name.includes('hold') || name.includes('stretch');
    }
    return exercise.metrics_template.type === 'duration_only' ||
           exercise.metrics_template.type === 'sets_duration';
  }, []);

  const trackExercisePerformance = async (exercise: PlanExercise, completed: boolean = true, skipped: boolean = false) => {
    if (!userId || !exercise) return;

    try {
      const loggedSets = loggedData[exercise.exercise_name] || [];
      const totalSets = loggedSets.length;
      const totalReps = loggedSets.reduce((sum, set) => sum + set.reps, 0);
      const avgWeight = totalSets > 0 ? loggedSets.reduce((sum, set) => sum + set.weight, 0) / totalSets : 0;
      const lastSet = loggedSets[loggedSets.length - 1];

      await savePerformanceMutation({
        user_id: userId,
        exercise_name: exercise.exercise_name,
        sport_context: userProfile?.trainingPreferences?.sport_specific || null,
        session_id: null,
        completed,
        skipped,
        substituted: false,
        substitute_reason: null,
        actual_sets: totalSets,
        actual_reps: totalReps,
        actual_weight: avgWeight,
        actual_duration_s: null,
        rpe: lastSet?.rpe ? parseInt(lastSet.rpe) : null,
        form_quality: null,
        pain_experienced: null,
        pain_location: null,
        was_pr: celebratedPRs.has(`${exercise.exercise_name}_${lastSet?.weight}_${lastSet?.reps}`),
        notes: null,
      });

      if (userProfile?.trainingPreferences?.sport_specific) {
        await updateSportBucketMutation({
          sport: userProfile.trainingPreferences.sport_specific,
          exercise_name: exercise.exercise_name,
          category: exercise.category || 'main',
          placement: exercise.category || 'main',
          userId,
        });

        const performanceScore = calculatePerformanceScore(completed, skipped, totalSets, exercise);
        await updateSportPerformanceMutation({
          sport: userProfile.trainingPreferences.sport_specific,
          exercise_name: exercise.exercise_name,
          success: completed && !skipped,
          performance_score: performanceScore,
        });
      }
    } catch (error) {
      console.error('Failed to track exercise performance:', error);
    }
  };

  const calculatePerformanceScore = (completed: boolean, skipped: boolean, actualSets: number, exercise: PlanExercise): number => {
    if (skipped) return 0;
    if (!completed) return 30;
    const targetSets = exercise.metrics_template?.target_sets || 3;
    const setCompletion = Math.min(actualSets / targetSets, 1) * 100;
    return 70 + (setCompletion * 0.3);
  };

  const handleCompleteSet = useCallback((actualDuration?: number) => {
    if (!currentExercise) return;

    const input = currentInputData[currentExercise.exercise_name] || {};

    // Handle time-based exercises (cardio, intervals, holds)
    if (isTimeBased(currentExercise)) {
      haptic.success();
      setJustCompletedSet(true);
      setTimeout(() => setJustCompletedSet(false), 600);

      // Log as duration-based set with actual duration
      const durationSeconds = actualDuration ||
        (currentExercise.metrics_template as any)?.duration_minutes * 60 ||
        (currentExercise.metrics_template as any)?.target_duration_minutes * 60 ||
        (currentExercise.metrics_template as any)?.target_duration_s ||
        0;

      const newSet: LoggedSetDuration = {
        set: currentRound,
        duration_s: durationSeconds,
      };

      setLoggedData(prev => ({
        ...prev,
        [currentExercise.exercise_name]: [...(prev[currentExercise.exercise_name] || []), newSet]
      }));

      ariaAnnouncer.announce(t('session.exerciseComplete', { exercise: currentExercise.exercise_name }), 'assertive');

      if (currentBlock.type === 'superset') {
        handleSupersetLogic();
      } else if (currentBlock.type === 'amrap') {
        handleAmrapLogic();
      } else {
        handleSingleExerciseLogic();
      }
      return;
    }

    // Standard strength exercise validation
    if (!input?.weight || !input?.reps) {
      notify({ type: 'error', message: t('session.enterWeightAndReps') });
      return;
    }

    const weight = Number(input.weight);
    const reps = Number(input.reps);

    const weightValidation = validateWeight(weight);
    if (!weightValidation.valid) {
      notify({ type: 'error', message: weightValidation.error! });
      return;
    }

    const repsValidation = validateReps(reps);
    if (!repsValidation.valid) {
      notify({ type: 'error', message: repsValidation.error! });
      return;
    }

    haptic.success();
    setJustCompletedSet(true);
    setTimeout(() => setJustCompletedSet(false), 600);

    const newSet: LoggedSetSRW = {
      set: currentRound,
      weight,
      reps,
      rpe: input.rpe ?? null,
    };

    setLoggedData(prev => ({
      ...prev,
      [currentExercise.exercise_name]: [...(prev[currentExercise.exercise_name] || []), newSet]
    }));

    ariaAnnouncer.announceSetComplete(newSet.set, Number(input.weight), Number(input.reps));

    saveExerciseHistory(currentExercise.exercise_name, Number(input.weight), Number(input.reps))
      .catch((error) => {
        console.error('Failed to save exercise history:', error);
        setLoggedData(prev => {
          const exerciseSets = prev[currentExercise.exercise_name] || [];
          const rolledBack = exerciseSets.filter(set => set !== newSet);
          return { ...prev, [currentExercise.exercise_name]: rolledBack };
        });
        notify({ type: 'error', message: t('session.saveFailedRetry') || 'Failed to save set.' });
      });

    if (shouldTrackPR(currentExercise.exercise_name)) {
      const prKey = `${currentExercise.exercise_name}_${input.weight}_${input.reps}`;
      if (!celebratedPRs.has(prKey)) {
        const prCheck = detectPR(currentExercise.exercise_name, Number(input.weight), Number(input.reps), allLogs);
        if (prCheck.isPR) {
          setCelebratedPRs(prev => new Set(prev).add(prKey));
          haptic.heavy();
          ariaAnnouncer.announcePR(currentExercise.exercise_name, Number(input.weight), Number(input.reps));
          setTimeout(() => {
            notify({
              type: 'success',
              message: t('session.newPR', { exercise: currentExercise.exercise_name, weight: input.weight, reps: input.reps })
            });
          }, 300);
        }
      }
    }

    if (currentBlock.type === 'superset') {
      handleSupersetLogic();
    } else if (currentBlock.type === 'amrap') {
      handleAmrapLogic();
    } else {
      handleSingleExerciseLogic();
    }
  }, [currentExercise, currentInputData, currentBlock, currentRound, haptic, t, allLogs, celebratedPRs, isTimeBased]);

  const handleSupersetLogic = () => {
    const block = currentBlock as SupersetBlock;
    const isLastExerciseInRound = currentExerciseInBlock === block.exercises.length - 1;

    if (isLastExerciseInRound) {
      const isLastRound = currentRound >= block.rounds;
      if (isLastRound) {
        handleBlockComplete();
      } else {
        const lastExercise = block.exercises[currentExerciseInBlock];
        const restTime = lastExercise.metrics_template?.rest_period_s || 90;
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
  };

  const handleSingleExerciseLogic = () => {
    const targetSets = currentExercise?.metrics_template?.target_sets || 3;
    const isLastSet = currentRound >= targetSets;

    if (isLastSet) {
      handleBlockComplete();
    } else {
      const restTime = currentExercise?.metrics_template?.rest_period_s || 90;
      if (restTime > 0) {
        setRestDuration(restTime);
        setIsResting(true);
      }
      setCurrentRound(prev => prev + 1);
    }
  };

  const handleAmrapLogic = () => {
    notify({ type: 'success', message: t('session.roundLogged') });
  };

  const handleBlockComplete = async () => {
    if (currentExercise) {
      await trackExercisePerformance(currentExercise, true, false);
    }

    const nextBlockIndex = currentBlockIndex + 1;

    if (nextBlockIndex < workoutBlocks.length) {
      notify({
        type: 'success',
        message: `${currentBlock.title || t('session.blockCompleteTitle')} ${t('session.blockComplete').replace('!', '')}`
      });
      haptic.medium();
      setCurrentBlockIndex(nextBlockIndex);
      setCurrentExerciseInBlock(0);
      setCurrentRound(1);
    } else {
      handleFinishWorkout();
    }
  };

  const handleFinishWorkout = () => {
    const duration = Math.round(elapsedTimeMs / 60000);
    const exercises: LoggedExercise[] = Object.entries(loggedData).map(([name, sets]) => ({
      exercise_name: name,
      sets: sets as LoggedSetSRW[]
    }));

    ariaAnnouncer.announceWorkoutComplete(duration, exercises.length);

    // Ensure focus is never undefined - fallback to "Workout" if missing
    const focus = session?.focus?.trim() || 'Workout';

    onFinish({
      focus,
      exercises,
      durationMinutes: duration
    });
  };

  const handleSkipExercise = async () => {
    haptic.light();
    if (currentExercise) {
      await trackExercisePerformance(currentExercise, false, true);
    }
    handleBlockComplete();
  };

  const handleWarmupComplete = () => {
    const warmupLoggedData: Record<string, LoggedSetSRW[]> = {};
    warmupExercises.forEach(ex => {
      warmupLoggedData[ex.exercise_name] = [{ set: 1, weight: 0, reps: 1 }];
    });
    setLoggedData(prev => ({ ...prev, ...warmupLoggedData }));
    handleBlockComplete();
  };

  // No valid blocks error state
  if (workoutBlocks.length === 0) {
    return (
      <div className={cn(
        "min-h-screen w-full max-w-lg mx-auto",
        "flex flex-col items-center justify-center",
        "p-[var(--space-4)]",
        "bg-[var(--bg-primary)]"
      )}>
        <div className="text-center">
          <h2 className="text-[var(--text-xl)] font-[var(--weight-bold)] text-[var(--text-primary)] mb-[var(--space-2)]">
            {t('session.noWorkoutFound')}
          </h2>
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-4)]">
            {t('session.noExercisesMessage')}
          </p>
          <Button onClick={onCancel} variant="primary">
            {t('session.goBack')}
          </Button>
        </div>
      </div>
    );
  }

  const isWarmupBlock = currentBlock &&
    Array.isArray(currentBlock.exercises) &&
    currentBlock.exercises.length > 0 && (
      currentBlock.exercises.every(ex => ex && ex.category === 'warmup') ||
      (currentBlock.title && /warmup|warm-up|warm up/i.test(currentBlock.title))
    );

  // WARMUP BLOCK SCREEN
  if (isWarmupBlock && currentBlock) {
    return (
      <WarmupScreen
        warmupExercises={warmupExercises}
        completedWarmupExercises={completedWarmupExercises}
        setCompletedWarmupExercises={setCompletedWarmupExercises}
        selectedExercise={selectedExercise}
        setSelectedExercise={setSelectedExercise}
        allWarmupsComplete={allWarmupsComplete}
        progress={progress}
        currentExerciseGlobalIndex={currentExerciseGlobalIndex}
        totalExercises={allExercises.length}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
        onCancel={onCancel}
        onComplete={handleWarmupComplete}
        onOpenChatWithMessage={onOpenChatWithMessage}
      />
    );
  }

  // AMRAP MODE SCREEN
  if (currentBlock?.type === 'amrap') {
    const amrapBlock = currentBlock as AmrapBlock;
    return (
      <AmrapScreen
        amrapBlock={amrapBlock}
        currentBlockIndex={currentBlockIndex}
        onCancel={onCancel}
        onComplete={handleBlockComplete}
      />
    );
  }

  // Safety checks
  if (!currentBlock) {
    return (
      <div className="min-h-screen w-full max-w-lg mx-auto flex flex-col items-center justify-center p-[var(--space-4)] bg-[var(--bg-primary)]">
        <div className="text-center">
          <h2 className="text-[var(--text-xl)] font-[var(--weight-bold)] text-[var(--text-primary)] mb-[var(--space-2)]">
            {t('errors.somethingWentWrong')}
          </h2>
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-4)]">
            {t('session.noExercisesMessage')}
          </p>
          <Button onClick={onCancel} variant="primary">
            {t('session.goBack')}
          </Button>
        </div>
      </div>
    );
  }

  if (!currentExercise) {
    return (
      <div className="min-h-screen flex items-center justify-center p-[var(--space-4)] bg-[var(--bg-primary)]">
        <div className="text-center">
          <h2 className="text-[var(--text-xl)] font-[var(--weight-bold)] text-[var(--text-primary)]">
            {t('session.workoutComplete')}
          </h2>
          <Button onClick={handleFinishWorkout} variant="primary" className="mt-[var(--space-4)]">
            {t('session.finishSession')}
          </Button>
        </div>
      </div>
    );
  }

  const mt = currentExercise.metrics_template;
  const targetSets = mt?.target_sets || 3;
  const isSuperset = currentBlock.type === 'superset';
  const totalRounds = isSuperset ? (currentBlock as SupersetBlock).rounds : targetSets;

  // MAIN EXERCISE TRACKING SCREEN
  return (
    <div className="h-screen w-full max-w-lg mx-auto flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <SessionHeader
        progress={progress}
        currentExerciseGlobalIndex={currentExerciseGlobalIndex}
        totalExercises={allExercises.length}
        isPaused={isPaused}
        startTime={startTime}
        isSuperset={isSuperset}
        showExerciseList={showExerciseList}
        workoutBlocks={workoutBlocks}
        currentExercise={currentExercise}
        currentBlockIndex={currentBlockIndex}
        onCancel={onCancel}
        onPause={handlePause}
        onResume={handleResume}
        onToggleExerciseList={() => setShowExerciseList(!showExerciseList)}
      />

      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col px-[var(--space-3)] py-[var(--space-3)] animate-fade-in"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <ExerciseCard
          currentExercise={currentExercise}
          currentBlock={currentBlock}
          currentRound={currentRound}
          isSuperset={isSuperset}
          totalRounds={totalRounds}
          upcomingSteps={upcomingSteps}
          workoutBlocks={workoutBlocks}
          currentBlockIndex={currentBlockIndex}
          onOpenExerciseInfo={() => setSelectedExercise(currentExercise)}
          onOpenChatWithMessage={onOpenChatWithMessage}
        />

        {currentExercise && (
          <ExerciseHistoryPreview
            history={getExerciseHistoryFull(currentExercise.exercise_name) || []}
          />
        )}

        {/* Smart Suggestions - show on ALL sets if we have history (not just round > 1) */}
        {lastPerformance && !isTimeBased(currentExercise) && (
          <SmartSuggestions
            lastWeight={lastPerformance.weight}
            lastReps={lastPerformance.reps}
            currentRound={currentRound}
            onRepeatLast={() => {
              // Fill in the values and complete
              setCurrentInputData(prev => ({
                ...prev,
                [currentExercise.exercise_name]: {
                  weight: String(lastPerformance.weight),
                  reps: String(lastPerformance.reps)
                }
              }));
              // Small delay to let state update, then complete
              setTimeout(() => handleCompleteSet(), 50);
            }}
            onProgressiveOverload={(weight, reps) => {
              setCurrentInputData(prev => ({
                ...prev,
                [currentExercise.exercise_name]: { weight: String(weight), reps: String(reps) }
              }));
            }}
          />
        )}

        <SetInputControls
          exerciseName={currentExercise.exercise_name}
          currentInputData={currentInputData[currentExercise.exercise_name] || {}}
          onInputChange={handleInputChange}
          metricsTemplate={currentExercise.metrics_template}
          onComplete={handleCompleteSet}
          suggestedWeight={strengthProfile ? suggestWeight(
            currentExercise.exercise_name,
            strengthProfile,
            // Parse target reps for better suggestion
            parseInt(currentExercise.metrics_template?.target_reps?.toString() || '10')
          ) : null}
        />

        {/* Next Exercise Preview (for supersets) */}
        {isSuperset && currentBlock?.exercises?.length && currentExerciseInBlock < currentBlock.exercises.length - 1 && (
          <div className={cn(
            "mb-[var(--space-3)]",
            "bg-[var(--brand-primary-subtle)]",
            "border border-[var(--brand-primary)]",
            "rounded-[var(--radius-md)]",
            "p-[var(--space-3)]"
          )}>
            <p className="text-[9px] uppercase tracking-[var(--tracking-wider)] text-[var(--brand-primary)] font-[var(--weight-bold)] mb-[var(--space-0-5)]">
              {t('session.nextExercise')}
            </p>
            <p className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--text-primary)]">
              {currentBlock.exercises[currentExerciseInBlock + 1]?.exercise_name || ''}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto space-y-[var(--space-2)] pb-[calc(var(--space-2)+env(safe-area-inset-bottom))]">
          <Button
            onClick={handleCompleteSet}
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<CheckCircleIcon className="w-4 h-4" />}
            className={cn(
              'transition-all duration-300',
              justCompletedSet && 'scale-95 bg-[var(--status-success-bg)] shadow-[var(--shadow-glow-success)]'
            )}
          >
            {isSuperset
              ? (currentExerciseInBlock === currentBlock.exercises.length - 1
                  ? t('session.roundOf', { current: currentRound, total: totalRounds })
                  : t('common.next'))
              : t('session.setOf', { current: currentRound, total: totalRounds })
            }
          </Button>

          <Button
            onClick={handleSkipExercise}
            variant="ghost"
            size="md"
            fullWidth
          >
            {t('common.skip')}
          </Button>
        </div>
      </div>

      {/* Exercise Explanation Modal */}
      {selectedExercise && (
        <ExerciseExplanationModal
          exerciseName={selectedExercise.exercise_name}
          exerciseNotes={selectedExercise.notes || undefined}
          isOpen={!!selectedExercise}
          onClose={() => setSelectedExercise(null)}
        />
      )}

      {/* Rest Timer Overlay */}
      {isResting && (
        <div className={cn(
          "fixed inset-0 z-[var(--z-modal)]",
          "bg-[var(--bg-primary)]/95",
          "flex items-center justify-center",
          "animate-fade-in"
        )}>
          <div className="w-full max-w-md mx-auto px-[var(--space-5)]">
            <RestTimer
              duration={restDuration}
              onComplete={() => setIsResting(false)}
              onSkip={() => setIsResting(false)}
            />
          </div>
        </div>
      )}

      {/* Milestone Celebration Popup */}
      {showMilestoneCelebration && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[var(--z-above)] animate-fade-in-down px-[var(--space-4)]">
          <div className={cn(
            "px-[var(--space-6)] py-[var(--space-4)]",
            "rounded-[var(--radius-2xl)]",
            "shadow-[var(--shadow-lg)]",
            "flex items-center gap-[var(--space-3)]",
            "border-2",
            showMilestoneCelebration.progress === 25
              ? "bg-[var(--brand-primary)] border-[var(--brand-primary-hover)]"
              : showMilestoneCelebration.progress === 50
              ? "bg-[var(--status-warning-bg)] border-[var(--status-warning-bg)]"
              : "bg-[var(--status-success-bg)] border-[var(--status-success-bg)]",
            "text-white font-[var(--weight-bold)] text-[var(--text-base)]"
          )}>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              {showMilestoneCelebration.progress === 25 ? (
                <FlameIcon className="w-6 h-6" />
              ) : showMilestoneCelebration.progress === 50 ? (
                <ZapIcon className="w-6 h-6" />
              ) : (
                <TrophyIcon className="w-6 h-6" />
              )}
            </div>
            <span>{showMilestoneCelebration.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
