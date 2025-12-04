import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  XMarkIcon,
  CheckCircleIcon,
  FlameIcon,
  QuestionMarkCircleIcon,
  ArrowRightLeftIcon,
} from '../icons';
import { PlanExercise, WorkoutBlock } from '../../types';
import ExerciseExplanationModal from '../ExerciseExplanationModal';
import { Button } from '../ui/button';
import { useHaptic } from '../../hooks/useAnimations';

const PauseIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
  </svg>
);

const PlayIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
  </svg>
);

interface WarmupScreenProps {
  warmupExercises: PlanExercise[];
  completedWarmupExercises: Set<string>;
  setCompletedWarmupExercises: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedExercise: PlanExercise | null;
  setSelectedExercise: (exercise: PlanExercise | null) => void;
  allWarmupsComplete: boolean;
  progress: number;
  currentExerciseGlobalIndex: number;
  totalExercises: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onComplete: () => void;
  onOpenChatWithMessage?: (message: string) => void;
}

export default function WarmupScreen({
  warmupExercises,
  completedWarmupExercises,
  setCompletedWarmupExercises,
  selectedExercise,
  setSelectedExercise,
  allWarmupsComplete,
  progress,
  currentExerciseGlobalIndex,
  totalExercises,
  isPaused,
  onPause,
  onResume,
  onCancel,
  onComplete,
  onOpenChatWithMessage,
}: WarmupScreenProps) {
  const { t } = useTranslation();
  const haptic = useHaptic();

  return (
    <div className="h-screen w-full max-w-lg mx-auto flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      {/* Progress Bar */}
      <div className="sticky top-0 z-[var(--z-sticky)] bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
        <div className="px-[var(--space-3)] py-[var(--space-2)] flex items-center justify-between">
          <button
            onClick={onCancel}
            className={cn(
              "p-[var(--space-1)]",
              "min-w-[var(--height-touch-min)] min-h-[var(--height-touch-min)]",
              "flex items-center justify-center",
              "rounded-[var(--radius-md)]",
              "hover:bg-[var(--surface-secondary)]",
              "transition-colors duration-[var(--duration-fast)]"
            )}
          >
            <XMarkIcon className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <div className="flex-1 mx-[var(--space-2)]">
            <div className="h-1 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--brand-primary)] transition-all duration-[var(--duration-normal)] rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="text-[9px] text-[var(--text-tertiary)] text-center mt-[var(--space-1)] font-[var(--weight-medium)]">
              {currentExerciseGlobalIndex + 1} / {totalExercises}
            </p>
          </div>
          <button
            onClick={isPaused ? onResume : onPause}
            className={cn(
              "p-[var(--space-1)]",
              "min-w-[var(--height-touch-min)] min-h-[var(--height-touch-min)]",
              "flex items-center justify-center",
              "rounded-[var(--radius-md)]",
              "hover:bg-[var(--surface-secondary)]",
              "transition-colors duration-[var(--duration-fast)]",
              isPaused && "bg-[var(--brand-primary-subtle)]"
            )}
            aria-label={isPaused ? "Resume workout" : "Pause workout"}
          >
            {isPaused ? (
              <PlayIcon className="w-4 h-4 text-[var(--brand-primary)]" />
            ) : (
              <PauseIcon className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
          </button>
        </div>
      </div>

      {/* Warmup Content */}
      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col px-[var(--space-3)] py-[var(--space-3)] animate-fade-in"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="mb-[var(--space-4)] text-center">
          <div className="inline-flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
            <FlameIcon className="w-6 h-6 text-[var(--status-warning-bg)]" />
            <h1 className="text-[var(--text-xl)] font-[var(--weight-bold)] text-[var(--text-primary)]">
              {t('session.warmup')}
            </h1>
          </div>
          <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
            {t('session.warmupInstructions')}
          </p>
        </div>

        {/* Bulk Actions */}
        {warmupExercises.length > 0 && (
          <div className="mb-[var(--space-4)]">
            <button
              onClick={() => {
                warmupExercises.forEach(ex => {
                  setCompletedWarmupExercises(prev => new Set(prev).add(ex.exercise_name));
                });
                haptic.medium();
              }}
              className={cn(
                "w-full h-12",
                "bg-gradient-to-r from-[var(--status-success-bg)] to-[var(--brand-primary)]",
                "text-white rounded-[var(--radius-xl)]",
                "font-[var(--weight-bold)] text-[var(--text-sm)]",
                "hover:shadow-[var(--shadow-lg)]",
                "transition-all duration-[var(--duration-fast)]",
                "active:scale-95",
                "flex items-center justify-center gap-[var(--space-2)]"
              )}
            >
              <CheckCircleIcon className="w-5 h-5" />
              Mark All Done
            </button>
          </div>
        )}

        {warmupExercises.length === 0 ? (
          <div className="text-center py-[var(--space-8)]">
            <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-2)]">
              {t('session.noWarmupFound')}
            </p>
          </div>
        ) : (
          <div className="space-y-[var(--space-2)] mb-[var(--space-4)]">
            {warmupExercises.map((exercise, index) => {
              const isCompleted = completedWarmupExercises.has(exercise.exercise_name);
              const mt = exercise.metrics_template;
              const duration = mt?.type === 'sets_duration' ? mt.target_duration_s : null;
              const reps = mt?.target_reps || null;
              const sets = mt?.target_sets || null;

              return (
                <div
                  key={`${exercise.exercise_name}-${index}`}
                  className={cn(
                    "bg-[var(--surface-primary)]",
                    "border-2 rounded-[var(--radius-lg)]",
                    "p-[var(--space-3)]",
                    "transition-all duration-[var(--duration-fast)]",
                    isCompleted
                      ? "border-[var(--status-success-bg)] bg-[var(--status-success-bg)]/10"
                      : "border-[var(--border-default)] hover:border-[var(--brand-primary)]"
                  )}
                >
                  <div className="flex items-start gap-[var(--space-3)]">
                    <button
                      onClick={() => {
                        const newCompleted = new Set(completedWarmupExercises);
                        if (isCompleted) {
                          newCompleted.delete(exercise.exercise_name);
                        } else {
                          newCompleted.add(exercise.exercise_name);
                        }
                        setCompletedWarmupExercises(newCompleted);
                        haptic.light();
                      }}
                      className={cn(
                        "mt-0.5 w-7 h-7 rounded-full border-2",
                        "flex items-center justify-center",
                        "transition-all duration-[var(--duration-fast)]",
                        "shrink-0",
                        isCompleted
                          ? "bg-[var(--status-success-bg)] border-[var(--status-success-bg)]"
                          : "border-[var(--border-strong)] hover:border-[var(--brand-primary)] bg-[var(--surface-secondary)]"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircleIcon className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-[var(--text-xs)] font-[var(--weight-bold)] text-[var(--text-tertiary)]">
                          {index + 1}
                        </span>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-[var(--space-2)] mb-[var(--space-1)]">
                        <h3 className={cn(
                          "font-[var(--weight-semibold)] text-[var(--text-base)] leading-tight flex-1",
                          isCompleted ? "text-[var(--text-secondary)] line-through" : "text-[var(--text-primary)]"
                        )}>
                          {exercise.exercise_name}
                        </h3>
                        <div className="flex items-center gap-[var(--space-1)]">
                          {onOpenChatWithMessage && (
                            <button
                              onClick={() => {
                                const swapMessage = t('session.swapExerciseMessage', { exercise: exercise.exercise_name });
                                onOpenChatWithMessage(swapMessage);
                              }}
                              className={cn(
                                "p-[var(--space-1-5)]",
                                "min-w-[var(--height-touch-min)] min-h-[var(--height-touch-min)]",
                                "flex items-center justify-center",
                                "rounded-[var(--radius-md)]",
                                "hover:bg-[var(--surface-secondary)]",
                                "transition-colors duration-[var(--duration-fast)]",
                                "shrink-0"
                              )}
                              aria-label={`Swap ${exercise.exercise_name}`}
                            >
                              <ArrowRightLeftIcon className="w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--brand-primary)]" />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedExercise(exercise)}
                            className={cn(
                              "p-[var(--space-1-5)]",
                              "min-w-[var(--height-touch-min)] min-h-[var(--height-touch-min)]",
                              "flex items-center justify-center",
                              "rounded-[var(--radius-md)]",
                              "hover:bg-[var(--surface-secondary)]",
                              "transition-colors duration-[var(--duration-fast)]",
                              "shrink-0"
                            )}
                            aria-label={`Learn about ${exercise.exercise_name}`}
                          >
                            <QuestionMarkCircleIcon className="w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--brand-primary)]" />
                          </button>
                        </div>
                      </div>

                      {/* Metrics */}
                      {(duration || reps || sets) && (
                        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
                          {sets && reps && (
                            <span className="text-[var(--text-2xs)] font-[var(--weight-medium)] text-[var(--text-secondary)] bg-[var(--surface-secondary)] px-[var(--space-2)] py-[var(--space-0-5)] rounded">
                              {sets}×{reps}
                            </span>
                          )}
                          {duration && (
                            <span className="text-[var(--text-2xs)] font-[var(--weight-medium)] text-[var(--text-secondary)] bg-[var(--surface-secondary)] px-[var(--space-2)] py-[var(--space-0-5)] rounded">
                              {duration}s
                            </span>
                          )}
                        </div>
                      )}

                      {exercise.notes && (
                        <p className="text-[var(--text-xs)] text-[var(--text-tertiary)] mt-[var(--space-1)] leading-[var(--leading-relaxed)] italic">
                          {exercise.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Complete Button */}
        <div className="mt-auto pb-[calc(var(--space-2)+env(safe-area-inset-bottom))]">
          <Button
            onClick={onComplete}
            disabled={!allWarmupsComplete}
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<CheckCircleIcon className="w-4 h-4" />}
          >
            {allWarmupsComplete ? t('session.completeWarmup') : t('session.completeExercises', { completed: completedWarmupExercises.size, total: warmupExercises.length })}
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
    </div>
  );
}
