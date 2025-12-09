/**
 * PeriodizationBadge - Shows current week and training phase
 *
 * Displays:
 * - Current week / total weeks
 * - Current phase (BASE/BUILD/PEAK/TAPER)
 * - Progress bar
 * - Days until next week
 * - Deload indicator
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Periodization {
  total_weeks: number;
  current_week: number;
  phase: 'base' | 'build' | 'peak' | 'taper' | 'recovery';
  phase_description?: string;
  weeks_in_phase?: number;
  phase_end_week?: number;
}

interface PeriodizationBadgeProps {
  periodization: Periodization | null | undefined;
  planCreatedAt?: string;
  targetDate?: string;
  compact?: boolean;
  className?: string;
}

const PHASE_CONFIG = {
  base: {
    label: 'BASE',
    color: 'bg-[var(--status-info-bg)]',
    textColor: 'text-[var(--status-info-bg)]',
    bgLight: 'bg-[var(--status-info-subtle)]',
    description: 'Building foundation',
    icon: '🏗️',
  },
  build: {
    label: 'BUILD',
    color: 'bg-[var(--status-warning-bg)]',
    textColor: 'text-[var(--status-warning-bg)]',
    bgLight: 'bg-[var(--status-warning-subtle)]',
    description: 'Progressive overload',
    icon: '💪',
  },
  peak: {
    label: 'PEAK',
    color: 'bg-[var(--status-error-bg)]',
    textColor: 'text-[var(--status-error-bg)]',
    bgLight: 'bg-[var(--status-error-subtle)]',
    description: 'High intensity',
    icon: '🔥',
  },
  taper: {
    label: 'TAPER',
    color: 'bg-[var(--status-success-bg)]',
    textColor: 'text-[var(--status-success-bg)]',
    bgLight: 'bg-[var(--status-success-subtle)]',
    description: 'Recovery & sharpness',
    icon: '🎯',
  },
  recovery: {
    label: 'RECOVERY',
    color: 'bg-[var(--workout-mobility)]',
    textColor: 'text-[var(--workout-mobility)]',
    bgLight: 'bg-[var(--workout-mobility-subtle)]',
    description: 'Active recovery',
    icon: '🧘',
  },
};

export default function PeriodizationBadge({
  periodization,
  planCreatedAt,
  targetDate,
  compact = false,
  className,
}: PeriodizationBadgeProps) {
  // Calculate days until next week
  const daysUntilNextWeek = useMemo(() => {
    if (!planCreatedAt) return null;

    const created = new Date(planCreatedAt);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceCreation = Math.floor((now.getTime() - created.getTime()) / msPerDay);
    const daysIntoCurrentWeek = daysSinceCreation % 7;
    return 7 - daysIntoCurrentWeek;
  }, [planCreatedAt]);

  // Calculate if this is a deload week (every 3-4 weeks depending on phase)
  const isDeloadWeek = useMemo(() => {
    if (!periodization) return false;
    const { current_week, phase } = periodization;

    // Deload frequency by phase
    const deloadFrequency = {
      base: 4,
      build: 3,
      peak: 0, // No deload in peak
      taper: 0, // Taper is already low volume
      recovery: 0,
    };

    const freq = deloadFrequency[phase];
    if (freq === 0) return false;
    return current_week % freq === 0;
  }, [periodization]);

  // Calculate days until event
  const daysUntilEvent = useMemo(() => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((target.getTime() - now.getTime()) / msPerDay);
  }, [targetDate]);

  if (!periodization) return null;

  const { total_weeks, current_week, phase, phase_description } = periodization;
  const config = PHASE_CONFIG[phase] || PHASE_CONFIG.base;
  const progress = (current_week / total_weeks) * 100;

  // Compact version for headers/cards
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[var(--text-xs)] font-bold uppercase tracking-wide",
          config.bgLight,
          config.textColor
        )}>
          {config.icon} {config.label}
        </span>
        <span className="text-[var(--text-xs)] text-[var(--text-secondary)]">
          Week {current_week}/{total_weeks}
        </span>
        {isDeloadWeek && (
          <span className="px-1.5 py-0.5 rounded bg-[var(--status-warning-subtle)] text-[var(--status-warning-bg)] text-[var(--text-2xs)] font-medium">
            DELOAD
          </span>
        )}
      </div>
    );
  }

  // Full version with progress bar
  return (
    <div className={cn(
      "bg-[var(--surface-primary)] border border-[var(--border-default)] rounded-2xl p-4",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-2.5 py-1 rounded-lg text-[var(--text-xs)] font-bold uppercase tracking-wide",
            config.bgLight,
            config.textColor
          )}>
            {config.icon} {config.label} Phase
          </span>
          {isDeloadWeek && (
            <span className="px-2 py-1 rounded-lg bg-[var(--status-warning-subtle)] text-[var(--status-warning-bg)] text-[var(--text-xs)] font-semibold">
              🔄 Deload Week
            </span>
          )}
        </div>
        <span className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
          Week {current_week} of {total_weeks}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-[var(--surface-secondary)] rounded-full overflow-hidden mb-3">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500", config.color)}
          style={{ width: `${progress}%` }}
        />
        {/* Phase markers */}
        <div className="absolute inset-0 flex">
          <div className="w-[35%] border-r border-[var(--border-default)]/30" /> {/* BASE */}
          <div className="w-[35%] border-r border-[var(--border-default)]/30" /> {/* BUILD */}
          <div className="w-[15%] border-r border-[var(--border-default)]/30" /> {/* PEAK */}
          <div className="w-[15%]" /> {/* TAPER */}
        </div>
      </div>

      {/* Phase labels below progress bar */}
      <div className="flex text-[var(--text-2xs)] text-[var(--text-tertiary)] mb-3">
        <div className="w-[35%] text-center">Base</div>
        <div className="w-[35%] text-center">Build</div>
        <div className="w-[15%] text-center">Peak</div>
        <div className="w-[15%] text-center">Taper</div>
      </div>

      {/* Description and countdown */}
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
          {phase_description || config.description}
        </p>
        <div className="flex items-center gap-3 text-[var(--text-xs)]">
          {daysUntilNextWeek !== null && daysUntilNextWeek > 0 && (
            <span className="text-[var(--text-tertiary)]">
              {daysUntilNextWeek}d to next week
            </span>
          )}
          {daysUntilEvent !== null && daysUntilEvent > 0 && (
            <span className={cn(
              "font-medium",
              daysUntilEvent <= 7 ? "text-[var(--status-error-bg)]" :
              daysUntilEvent <= 14 ? "text-[var(--status-warning-bg)]" :
              "text-[var(--text-secondary)]"
            )}>
              {daysUntilEvent}d to event
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Mini badge for inline use
 */
export function PeriodizationMini({
  periodization,
  className,
}: {
  periodization: Periodization | null | undefined;
  className?: string;
}) {
  if (!periodization) return null;

  const config = PHASE_CONFIG[periodization.phase] || PHASE_CONFIG.base;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[var(--text-2xs)] font-semibold",
      config.bgLight,
      config.textColor,
      className
    )}>
      {config.icon} W{periodization.current_week}
    </span>
  );
}
