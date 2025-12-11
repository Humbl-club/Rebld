import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   BENCHMARK INPUT - Strength benchmark inputs with unlock feedback

   Features:
   - Main lift inputs with real-time feedback
   - Shows what each benchmark "unlocks" in terms of AI accuracy
   - Progress tracking for provided benchmarks
   - Visual feedback on exercise estimation accuracy
   - Skip option with clear explanation
   ═══════════════════════════════════════════════════════════════ */

export interface BenchmarkInputProps {
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  unit: 'kg' | 'lbs';
}

type Benchmark = {
  id: string;
  name: string;
  emoji: string;
  placeholder: (unit: 'kg' | 'lbs') => string;
  unlocks: string;
  estimatesCount: number;
};

const BENCHMARKS: Benchmark[] = [
  {
    id: 'bench_press',
    name: 'Bench Press',
    emoji: '💪',
    placeholder: unit => unit === 'kg' ? '80' : '175',
    unlocks: 'All pressing movements',
    estimatesCount: 12
  },
  {
    id: 'squat',
    name: 'Squat',
    emoji: '🦵',
    placeholder: unit => unit === 'kg' ? '100' : '220',
    unlocks: 'All leg compounds',
    estimatesCount: 15
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    emoji: '🏋️',
    placeholder: unit => unit === 'kg' ? '120' : '265',
    unlocks: 'All hip hinge movements',
    estimatesCount: 10
  },
  {
    id: 'overhead_press',
    name: 'Overhead Press',
    emoji: '🎯',
    placeholder: unit => unit === 'kg' ? '50' : '110',
    unlocks: 'All shoulder movements',
    estimatesCount: 8
  },
  {
    id: 'barbell_row',
    name: 'Barbell Row',
    emoji: '⚡',
    placeholder: unit => unit === 'kg' ? '70' : '155',
    unlocks: 'All rowing movements',
    estimatesCount: 9
  },
];

// Get exercise examples based on benchmark
const getExerciseExamples = (benchmarkId: string): string[] => {
  const examples: Record<string, string[]> = {
    bench_press: ['DB Press', 'Incline Bench', 'Push-ups', 'Dips'],
    squat: ['Lunges', 'Leg Press', 'Step-ups', 'Bulgarian Split Squats'],
    deadlift: ['RDL', 'Good Mornings', 'Hip Thrusts', 'Glute Bridges'],
    overhead_press: ['DB Shoulder Press', 'Arnold Press', 'Lateral Raises', 'Front Raises'],
    barbell_row: ['DB Rows', 'Cable Rows', 'T-Bar Rows', 'Seal Rows']
  };
  return examples[benchmarkId] || [];
};

export default function BenchmarkInput({ values, onChange, unit }: BenchmarkInputProps) {
  const haptic = useHaptic();
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const providedCount = useMemo(() => {
    return Object.keys(values).filter(key => values[key] > 0).length;
  }, [values]);

  const totalBenchmarks = BENCHMARKS.length;

  // Calculate estimated accuracy
  const { accurateExercises, guessedExercises } = useMemo(() => {
    const totalEstimates = BENCHMARKS.reduce((sum, b) => sum + b.estimatesCount, 0);
    const providedEstimates = BENCHMARKS
      .filter(b => values[b.id] > 0)
      .reduce((sum, b) => sum + b.estimatesCount, 0);

    return {
      accurateExercises: providedEstimates,
      guessedExercises: totalEstimates - providedEstimates
    };
  }, [values]);

  const handleInputChange = (benchmarkId: string, value: string) => {
    haptic.light();
    const numValue = value === '' ? 0 : parseFloat(value);

    if (!isNaN(numValue) && numValue >= 0) {
      onChange({
        ...values,
        [benchmarkId]: numValue
      });
    }
  };

  const progressPercentage = (providedCount / totalBenchmarks) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-text-primary font-bold text-lg mb-1">
          Strength Benchmarks
        </h3>
        <p className="text-text-secondary text-sm">
          Help the AI estimate your starting weights
        </p>
      </div>

      {/* Progress Overview */}
      <div className="p-4 rounded-xl bg-brand-subtle border-2 border-brand-primary">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-brand-primary text-xs font-bold uppercase tracking-wide">
              Benchmarks Provided
            </p>
            <p className="text-text-primary text-2xl font-black tabular-nums">
              {providedCount} / {totalBenchmarks}
            </p>
          </div>
          <div className="text-3xl">
            {providedCount === 0 ? '📊' : providedCount === totalBenchmarks ? '✅' : '📈'}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Accuracy Preview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-success-subtle border border-success-bg">
          <p className="text-success-text text-xs font-bold uppercase tracking-wide mb-1">
            AI Can Estimate
          </p>
          <p className="text-text-primary text-xl font-black tabular-nums">
            {accurateExercises}
          </p>
          <p className="text-text-tertiary text-xs mt-1">
            exercises
          </p>
        </div>

        <div className="p-3 rounded-xl bg-warning-subtle border border-warning-bg">
          <p className="text-warning-text text-xs font-bold uppercase tracking-wide mb-1">
            AI Will Guess
          </p>
          <p className="text-text-primary text-xl font-black tabular-nums">
            {guessedExercises}
          </p>
          <p className="text-text-tertiary text-xs mt-1">
            exercises
          </p>
        </div>
      </div>

      {/* Unit Toggle */}
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-surface-secondary">
        <span className="text-text-secondary text-sm font-medium">
          Working weight (8-10 reps)
        </span>
        <div className="flex gap-1 p-1 rounded-lg bg-surface-primary">
          <button
            onClick={() => {
              haptic.light();
              // Note: Parent would handle unit conversion
            }}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-bold transition-colors',
              unit === 'kg'
                ? 'bg-brand-primary text-text-on-brand'
                : 'text-text-tertiary'
            )}
          >
            KG
          </button>
          <button
            onClick={() => {
              haptic.light();
              // Note: Parent would handle unit conversion
            }}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-bold transition-colors',
              unit === 'lbs'
                ? 'bg-brand-primary text-text-on-brand'
                : 'text-text-tertiary'
            )}
          >
            LBS
          </button>
        </div>
      </div>

      {/* Benchmark Inputs */}
      <div className="space-y-3">
        {BENCHMARKS.map(benchmark => {
          const hasValue = values[benchmark.id] > 0;
          const isFocused = focusedInput === benchmark.id;
          const examples = getExerciseExamples(benchmark.id);

          return (
            <div key={benchmark.id}>
              <div
                className={cn(
                  'p-4 rounded-xl border-2 transition-all duration-200',
                  hasValue
                    ? 'bg-success-subtle border-success-bg'
                    : isFocused
                    ? 'bg-surface-secondary border-brand-primary'
                    : 'bg-surface-primary border-border-default'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{benchmark.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-text-primary font-bold text-sm">
                      {benchmark.name}
                    </h4>
                    <p className="text-text-tertiary text-xs">
                      {benchmark.unlocks}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={values[benchmark.id] || ''}
                      onChange={(e) => handleInputChange(benchmark.id, e.target.value)}
                      onFocus={() => {
                        haptic.light();
                        setFocusedInput(benchmark.id);
                      }}
                      onBlur={() => setFocusedInput(null)}
                      placeholder={benchmark.placeholder(unit)}
                      className={cn(
                        'w-20 h-12 px-3 rounded-lg text-center font-bold text-lg',
                        'bg-surface-primary border-2 border-border-default',
                        'focus:border-brand-primary focus:bg-bg-primary outline-none',
                        'text-text-primary placeholder:text-text-disabled',
                        'transition-all duration-200'
                      )}
                    />
                    <span className="text-text-tertiary text-xs font-bold uppercase w-8">
                      {unit}
                    </span>
                  </div>
                </div>

                {/* Unlocked indicator */}
                {hasValue && (
                  <div className="flex items-start gap-2 mt-2 pt-3 border-t border-border-subtle">
                    <span className="text-success-text text-sm">✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-success-text text-xs font-semibold mb-1">
                        Unlocked {benchmark.estimatesCount} exercises
                      </p>
                      <p className="text-text-tertiary text-xs">
                        {examples.slice(0, 3).join(', ')}
                        {examples.length > 3 && ` +${examples.length - 3} more`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Skip Explanation */}
      <div className="p-4 rounded-xl bg-surface-secondary border border-border-subtle">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="flex-1">
            <p className="text-text-primary text-xs font-bold uppercase tracking-wide mb-1">
              Don't Know Your Numbers?
            </p>
            <p className="text-text-secondary text-xs leading-relaxed">
              No problem! You can skip this and track your first week. The AI will
              learn your strength profile and adjust automatically. It just means
              your first week might need more weight adjustments.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Summary */}
      {providedCount > 0 && (
        <div className="p-4 rounded-xl bg-info-subtle border border-info-bg">
          <div className="flex items-start gap-3">
            <span className="text-info-text text-xl">🎯</span>
            <div className="flex-1">
              <p className="text-info-text text-xs font-bold uppercase tracking-wide mb-1">
                Great start!
              </p>
              <p className="text-text-secondary text-xs leading-relaxed">
                With {providedCount} benchmark{providedCount !== 1 ? 's' : ''}, the AI can
                accurately estimate starting weights for {accurateExercises} exercises.
                {guessedExercises > 0 && ` The remaining ${guessedExercises} will use conservative estimates that you can adjust.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
