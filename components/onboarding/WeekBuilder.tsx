import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   WEEK BUILDER - Visual day selection for training availability

   Features:
   - 7-day grid (Mon-Sun) with touch-friendly toggles
   - Shows count of selected days
   - Recommends training split based on selection
   - Shows optimal rest day distribution
   ═══════════════════════════════════════════════════════════════ */

export interface WeekBuilderProps {
  selectedDays: number[]; // 0=Mon, 6=Sun
  onChange: (days: number[]) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Training split recommendations based on frequency
const getSplitRecommendation = (dayCount: number): { name: string; desc: string; restDays: string } => {
  switch (dayCount) {
    case 0:
      return { name: 'No training selected', desc: 'Select at least 2 days', restDays: 'All days off' };
    case 1:
      return { name: 'Full Body', desc: 'Single high-intensity session', restDays: '6 rest days' };
    case 2:
      return { name: 'Upper/Lower', desc: 'Classic 2-day split', restDays: '5 rest days' };
    case 3:
      return { name: 'Push/Pull/Legs', desc: 'Optimal 3-day split', restDays: '4 rest days - spread evenly' };
    case 4:
      return { name: 'Upper/Lower/Upper/Lower', desc: 'Higher frequency 4-day split', restDays: '3 rest days - every 2nd or 3rd day' };
    case 5:
      return { name: 'PPL + Upper/Lower', desc: '5-day split with variety', restDays: '2 rest days - mid-week and weekend' };
    case 6:
      return { name: 'PPL x2', desc: 'Push/Pull/Legs twice per week', restDays: '1 rest day - typically Sunday' };
    case 7:
      return { name: 'Daily Training', desc: 'Active recovery on lighter days', restDays: 'No dedicated rest - use deload weeks' };
    default:
      return { name: '', desc: '', restDays: '' };
  }
};

// Check if rest days are well-distributed (no more than 2 consecutive training days for beginners)
const analyzeRestDistribution = (selectedDays: number[]): { good: boolean; warning?: string } => {
  if (selectedDays.length === 0) return { good: true };
  if (selectedDays.length >= 6) return { good: true }; // Advanced athletes can handle consecutive days

  const sortedDays = [...selectedDays].sort((a, b) => a - b);

  // Check for 3+ consecutive training days
  for (let i = 0; i < sortedDays.length - 2; i++) {
    if (sortedDays[i + 1] === sortedDays[i] + 1 && sortedDays[i + 2] === sortedDays[i] + 2) {
      return {
        good: false,
        warning: '3+ consecutive training days detected. Consider spacing for better recovery.'
      };
    }
  }

  return { good: true };
};

export default function WeekBuilder({ selectedDays, onChange }: WeekBuilderProps) {
  const haptic = useHaptic();

  const split = useMemo(() => getSplitRecommendation(selectedDays.length), [selectedDays.length]);
  const restAnalysis = useMemo(() => analyzeRestDistribution(selectedDays), [selectedDays]);

  const toggleDay = (dayIndex: number) => {
    haptic.light();
    if (selectedDays.includes(dayIndex)) {
      onChange(selectedDays.filter(d => d !== dayIndex));
    } else {
      onChange([...selectedDays, dayIndex].sort((a, b) => a - b));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-text-primary font-bold text-lg mb-1">
          Training Days
        </h3>
        <p className="text-text-secondary text-sm">
          Tap days to build your weekly schedule
        </p>
      </div>

      {/* Day Grid - Mobile-optimized */}
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day, index) => {
          const isSelected = selectedDays.includes(index);
          const isWeekend = index >= 5;

          return (
            <button
              key={day}
              onClick={() => toggleDay(index)}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-xl transition-all duration-200',
                'min-h-touch active:scale-95',
                'border-2',
                isSelected
                  ? 'bg-brand-primary border-brand-primary'
                  : isWeekend
                  ? 'bg-surface-secondary border-border-subtle'
                  : 'bg-surface-primary border-border-default',
              )}
            >
              {/* Day letter */}
              <span
                className={cn(
                  'text-xs font-bold uppercase mb-1',
                  isSelected ? 'text-text-on-brand' : 'text-text-secondary'
                )}
              >
                {DAYS_SHORT[index]}
              </span>

              {/* Day name */}
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isSelected ? 'text-text-on-brand opacity-80' : 'text-text-tertiary'
                )}
              >
                {day.slice(0, 3)}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-success-bg rounded-full border-2 border-bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Count */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-secondary border border-border-subtle">
        <span className="text-text-secondary text-sm font-medium">
          Training days per week
        </span>
        <span className="text-brand-primary text-xl font-black tabular-nums">
          {selectedDays.length}
        </span>
      </div>

      {/* Split Recommendation */}
      {selectedDays.length > 0 && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-brand-subtle border-2 border-brand-primary">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="text-brand-primary text-sm font-bold uppercase tracking-wide mb-1">
                  Recommended Split
                </p>
                <h4 className="text-text-primary font-black text-lg leading-tight">
                  {split.name}
                </h4>
                <p className="text-text-secondary text-sm mt-1">
                  {split.desc}
                </p>
              </div>
              <div className="ml-3 text-2xl">
                💪
              </div>
            </div>
          </div>

          {/* Rest Day Distribution */}
          <div className={cn(
            'p-4 rounded-xl border-2',
            restAnalysis.good
              ? 'bg-success-subtle border-success-bg'
              : 'bg-warning-subtle border-warning-bg'
          )}>
            <div className="flex items-start gap-3">
              <span className="text-xl">
                {restAnalysis.good ? '✓' : '⚠️'}
              </span>
              <div className="flex-1">
                <p className={cn(
                  'text-xs font-bold uppercase tracking-wide mb-1',
                  restAnalysis.good ? 'text-success-text' : 'text-warning-text'
                )}>
                  Rest Day Distribution
                </p>
                <p className="text-text-primary text-sm font-medium">
                  {split.restDays}
                </p>
                {!restAnalysis.good && restAnalysis.warning && (
                  <p className="text-warning-text text-xs mt-2">
                    {restAnalysis.warning}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedDays.length === 0 && (
        <div className="py-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-text-secondary text-sm">
            Select your training days to see recommendations
          </p>
        </div>
      )}
    </div>
  );
}
