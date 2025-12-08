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
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    bgLight: 'bg-blue-500/10',
    description: 'Building foundation',
    icon: '🏗️',
  },
  build: {
    label: 'BUILD',
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    bgLight: 'bg-orange-500/10',
    description: 'Progressive overload',
    icon: '💪',
  },
  peak: {
    label: 'PEAK',
    color: 'bg-red-500',
    textColor: 'text-red-500',
    bgLight: 'bg-red-500/10',
    description: 'High intensity',
    icon: '🔥',
  },
  taper: {
    label: 'TAPER',
    color: 'bg-green-500',
    textColor: 'text-green-500',
    bgLight: 'bg-green-500/10',
    description: 'Recovery & sharpness',
    icon: '🎯',
  },
  recovery: {
    label: 'RECOVERY',
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    bgLight: 'bg-purple-500/10',
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
          "px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide",
          config.bgLight,
          config.textColor
        )}>
          {config.icon} {config.label}
        </span>
        <span className="text-[12px] text-[var(--text-secondary)]">
          Week {current_week}/{total_weeks}
        </span>
        {isDeloadWeek && (
          <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 text-[10px] font-medium">
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
            "px-2.5 py-1 rounded-lg text-[12px] font-bold uppercase tracking-wide",
            config.bgLight,
            config.textColor
          )}>
            {config.icon} {config.label} Phase
          </span>
          {isDeloadWeek && (
            <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-600 text-[11px] font-semibold">
              🔄 Deload Week
            </span>
          )}
        </div>
        <span className="text-[14px] font-semibold text-[var(--text-primary)]">
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
      <div className="flex text-[10px] text-[var(--text-tertiary)] mb-3">
        <div className="w-[35%] text-center">Base</div>
        <div className="w-[35%] text-center">Build</div>
        <div className="w-[15%] text-center">Peak</div>
        <div className="w-[15%] text-center">Taper</div>
      </div>

      {/* Description and countdown */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[var(--text-secondary)]">
          {phase_description || config.description}
        </p>
        <div className="flex items-center gap-3 text-[12px]">
          {daysUntilNextWeek !== null && daysUntilNextWeek > 0 && (
            <span className="text-[var(--text-tertiary)]">
              {daysUntilNextWeek}d to next week
            </span>
          )}
          {daysUntilEvent !== null && daysUntilEvent > 0 && (
            <span className={cn(
              "font-medium",
              daysUntilEvent <= 7 ? "text-red-500" :
              daysUntilEvent <= 14 ? "text-orange-500" :
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
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
      config.bgLight,
      config.textColor,
      className
    )}>
      {config.icon} W{periodization.current_week}
    </span>
  );
}
