import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  RepeatIcon,
  ClockIcon,
  ZapIcon,
  QuestionMarkCircleIcon,
  ArrowRightLeftIcon,
  TimerIcon,
} from '../icons';
import { PlanExercise, SupersetBlock, WorkoutBlock, MetricTemplate } from '../../types';
import BlockOverview from '../BlockOverview';

// Cardio exercise keywords for detection
const CARDIO_KEYWORDS = [
  'cardio', 'elliptical', 'treadmill', 'bike', 'cycling', 'rowing', 'rower',
  'stairmaster', 'stepper', 'stair climber', 'run', 'running', 'jog', 'walk',
  'swim', 'swimming', 'sprint', 'hiit', 'conditioning', 'steady state'
];

// Helper to check if exercise is cardio/duration based
function isCardioExercise(template?: MetricTemplate, exerciseName?: string): boolean {
  // Check template type first
  if (template?.type) {
    if (['duration_only', 'sets_duration', 'sets_duration_rest', 'distance_time'].includes(template.type)) {
      return true;
    }
  }
  // Fallback: check exercise name
  const lowerName = exerciseName?.toLowerCase() || '';
  return CARDIO_KEYWORDS.some(keyword => lowerName.includes(keyword));
}

// Helper to format duration for display
function formatDuration(minutes?: number, seconds?: number): string {
  if (minutes) return `${minutes} min`;
  if (seconds) return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`;
  return '';
}

interface ExerciseCardProps {
  currentExercise: PlanExercise;
  currentBlock: WorkoutBlock;
  currentRound: number;
  isSuperset: boolean;
  totalRounds: number;
  upcomingSteps: string[];
  workoutBlocks: WorkoutBlock[];
  currentBlockIndex: number;
  onOpenExerciseInfo: () => void;
  onOpenChatWithMessage?: (message: string) => void;
}

export default function ExerciseCard({
  currentExercise,
  currentBlock,
  currentRound,
  isSuperset,
  totalRounds,
  upcomingSteps,
  workoutBlocks,
  currentBlockIndex,
  onOpenExerciseInfo,
  onOpenChatWithMessage,
}: ExerciseCardProps) {
  const { t } = useTranslation();

  const mt = currentExercise.metrics_template;
  const targetSets = mt?.target_sets || 3;
  const targetReps = mt?.target_reps || '10';

  // Check if this is a cardio/duration exercise
  const isCardio = isCardioExercise(mt, currentExercise.exercise_name);

  // Get duration for cardio exercises
  const targetDuration = (mt as any)?.target_duration_minutes || (mt as any)?.duration_minutes ||
                         ((mt as any)?.target_duration_s ? Math.round((mt as any).target_duration_s / 60) : null);

  return (
    <div className="mb-[var(--space-3)]">
      <BlockOverview blocks={workoutBlocks} currentBlockIndex={currentBlockIndex} />
      {/* Only show set counter for non-cardio exercises */}
      {!isCardio && (
        <p className="text-[9px] uppercase tracking-[var(--tracking-wider)] text-[var(--text-tertiary)] font-[var(--weight-medium)] mb-[var(--space-1)]">
          {isSuperset ? t('session.roundOf', { current: currentRound, total: totalRounds }) : t('session.setOf', { current: currentRound, total: totalRounds })}
        </p>
      )}
      <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
        <h1 className="text-[var(--text-xl)] font-[var(--weight-bold)] text-[var(--text-primary)] leading-tight flex-1">
          {currentExercise.exercise_name}
        </h1>
        <div className="flex items-center gap-[var(--space-1)]">
          {onOpenChatWithMessage && (
            <button
              onClick={() => {
                const swapMessage = t('session.swapExerciseMessage', { exercise: currentExercise.exercise_name });
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
              aria-label={`Swap ${currentExercise.exercise_name}`}
            >
              <ArrowRightLeftIcon className="w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--brand-primary)]" />
            </button>
          )}
          <button
            onClick={onOpenExerciseInfo}
            className={cn(
              "p-[var(--space-1-5)]",
              "min-w-[var(--height-touch-min)] min-h-[var(--height-touch-min)]",
              "flex items-center justify-center",
              "rounded-[var(--radius-md)]",
              "hover:bg-[var(--surface-secondary)]",
              "transition-colors duration-[var(--duration-fast)]",
              "shrink-0"
            )}
            aria-label="Exercise info"
          >
            <QuestionMarkCircleIcon className="w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--brand-primary)]" />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex items-center flex-wrap gap-[var(--space-2)] text-[var(--text-xs)] text-[var(--text-secondary)]">
        <span className="flex items-center gap-[var(--space-1)]">
          {isCardio ? (
            <>
              <TimerIcon className="w-3.5 h-3.5" />
              {targetDuration ? `${targetDuration} min` : t('session.duration')}
            </>
          ) : (
            <>
              <RepeatIcon className="w-3.5 h-3.5" />
              {isSuperset ? t('session.roundsShort', { count: totalRounds }) : `${targetSets}×${targetReps}`}
            </>
          )}
        </span>
        {!isCardio && mt?.rest_period_s !== undefined && mt.rest_period_s > 0 && (
          <span className="flex items-center gap-[var(--space-1)]">
            <ClockIcon className="w-3.5 h-3.5" />
            {mt.rest_period_s}s
          </span>
        )}
        {currentExercise.rpe && (
          <span className="flex items-center gap-[var(--space-1)]">
            <ZapIcon className="w-3.5 h-3.5" />
            {t('session.rpeValue', { value: currentExercise.rpe })}
          </span>
        )}
      </div>

      {currentExercise.notes && (
        <p className={cn(
          "mt-[var(--space-3)]",
          "text-[var(--text-xs)] text-[var(--text-tertiary)]",
          "leading-[var(--leading-relaxed)]",
          "bg-[var(--surface-secondary)]",
          "rounded-[var(--radius-lg)]",
          "p-[var(--space-3)]",
          "italic"
        )}>
          {currentExercise.notes}
        </p>
      )}

      {/* Coming Up */}
      {upcomingSteps.length > 0 && (
        <div className={cn(
          "mt-[var(--space-3)]",
          "bg-[var(--surface-secondary)]",
          "border border-[var(--border-subtle)]",
          "rounded-[var(--radius-md)]",
          "p-[var(--space-2)]"
        )}>
          <p className="text-[9px] uppercase tracking-[var(--tracking-wider)] text-[var(--text-tertiary)] font-[var(--weight-bold)] mb-[var(--space-1)]">
            {t('session.comingUp')}
          </p>
          <div className="space-y-[var(--space-0-5)]">
            {upcomingSteps.map((step, i) => (
              <p key={i} className="text-[var(--text-xs)] text-[var(--text-secondary)] flex items-center gap-[var(--space-1)]">
                <span className="text-[var(--brand-primary)]">→</span>
                {step}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
