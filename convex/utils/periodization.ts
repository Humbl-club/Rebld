/**
 * Periodization Utilities for REBLD
 *
 * Handles phase calculation, week progression, and periodized plan generation.
 *
 * PHASE DISTRIBUTION (% of total weeks):
 * - BASE (35%): Build aerobic base, learn movement patterns, moderate volume
 * - BUILD (35%): Increase intensity, sport-specific training, peak volume
 * - PEAK (15%): High intensity, reduced volume, competition simulation
 * - TAPER (15%): Reduced volume & intensity, maintain sharpness, recovery focus
 */

// PeriodizationPhase type defined locally to avoid path issues in Convex
export type PeriodizationPhase = 'base' | 'build' | 'peak' | 'taper' | 'recovery';

// Phase percentages (must sum to 100)
const PHASE_DISTRIBUTION = {
  base: 0.35,
  build: 0.35,
  peak: 0.15,
  taper: 0.15,
} as const;

// Phase characteristics for AI prompting
export const PHASE_CHARACTERISTICS = {
  base: {
    volumeMultiplier: 1.0,
    intensityMultiplier: 0.7,
    focusDescription: "Building aerobic foundation, technique focus, moderate volume",
    rpeRange: "5-7",
    deloadEveryNWeeks: 4,
    keyPrinciples: [
      "High volume, lower intensity",
      "Movement pattern proficiency",
      "General fitness base building",
      "Injury prevention focus",
    ],
  },
  build: {
    volumeMultiplier: 1.2,
    intensityMultiplier: 0.85,
    focusDescription: "Sport-specific training, progressive overload, peak volume",
    rpeRange: "7-8",
    deloadEveryNWeeks: 3,
    keyPrinciples: [
      "Progressive overload",
      "Sport-specific movements",
      "Peak training volume",
      "Competition pattern simulation",
    ],
  },
  peak: {
    volumeMultiplier: 0.8,
    intensityMultiplier: 1.0,
    focusDescription: "Competition simulation, high intensity, reduced volume",
    rpeRange: "8-9",
    deloadEveryNWeeks: 0, // No deload in peak
    keyPrinciples: [
      "High intensity, low volume",
      "Competition simulation",
      "Mental preparation",
      "Final skill refinement",
    ],
  },
  taper: {
    volumeMultiplier: 0.5,
    intensityMultiplier: 0.7,
    focusDescription: "Recovery focus, maintenance, freshness for competition",
    rpeRange: "5-6",
    deloadEveryNWeeks: 0, // Whole phase is essentially a taper
    keyPrinciples: [
      "Dramatic volume reduction",
      "Maintain training frequency",
      "Recovery and regeneration",
      "Carb loading if appropriate",
    ],
  },
} as const;

export interface PeriodizationInfo {
  totalWeeks: number;
  currentWeek: number;
  phase: PeriodizationPhase;
  phaseDescription: string;
  weeksInPhase: number;
  phaseStartWeek: number;
  phaseEndWeek: number;
  weeksUntilEvent: number;
  isDeloadWeek: boolean;
  progressPercent: number;
}

/**
 * Calculate total weeks between now and target date
 */
export function calculateTotalWeeks(targetDate: string): number {
  const now = new Date();
  const target = new Date(targetDate);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.ceil((target.getTime() - now.getTime()) / msPerWeek);
  return Math.max(1, weeks); // At least 1 week
}

/**
 * Calculate current week based on plan creation date
 */
export function calculateCurrentWeek(planCreatedAt: string): number {
  const created = new Date(planCreatedAt);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.floor((now.getTime() - created.getTime()) / msPerWeek) + 1;
  return Math.max(1, weeks);
}

/**
 * Calculate which phase we're in based on week number and total weeks
 */
export function calculatePhase(currentWeek: number, totalWeeks: number): {
  phase: PeriodizationPhase;
  phaseStartWeek: number;
  phaseEndWeek: number;
  weekInPhase: number;
  weeksInPhase: number;
} {
  // Calculate phase boundaries
  const baseEnd = Math.ceil(totalWeeks * PHASE_DISTRIBUTION.base);
  const buildEnd = Math.ceil(totalWeeks * (PHASE_DISTRIBUTION.base + PHASE_DISTRIBUTION.build));
  const peakEnd = Math.ceil(totalWeeks * (PHASE_DISTRIBUTION.base + PHASE_DISTRIBUTION.build + PHASE_DISTRIBUTION.peak));
  // Taper goes to end

  if (currentWeek <= baseEnd) {
    return {
      phase: 'base',
      phaseStartWeek: 1,
      phaseEndWeek: baseEnd,
      weekInPhase: currentWeek,
      weeksInPhase: baseEnd,
    };
  } else if (currentWeek <= buildEnd) {
    return {
      phase: 'build',
      phaseStartWeek: baseEnd + 1,
      phaseEndWeek: buildEnd,
      weekInPhase: currentWeek - baseEnd,
      weeksInPhase: buildEnd - baseEnd,
    };
  } else if (currentWeek <= peakEnd) {
    return {
      phase: 'peak',
      phaseStartWeek: buildEnd + 1,
      phaseEndWeek: peakEnd,
      weekInPhase: currentWeek - buildEnd,
      weeksInPhase: peakEnd - buildEnd,
    };
  } else {
    return {
      phase: 'taper',
      phaseStartWeek: peakEnd + 1,
      phaseEndWeek: totalWeeks,
      weekInPhase: currentWeek - peakEnd,
      weeksInPhase: totalWeeks - peakEnd,
    };
  }
}

/**
 * Determine if current week is a deload week
 */
export function isDeloadWeek(currentWeek: number, totalWeeks: number): boolean {
  const { phase, weekInPhase } = calculatePhase(currentWeek, totalWeeks);
  const characteristics = PHASE_CHARACTERISTICS[phase];

  // No deloads in peak or taper
  if (characteristics.deloadEveryNWeeks === 0) return false;

  // Deload on every Nth week within the phase
  return weekInPhase > 0 && weekInPhase % characteristics.deloadEveryNWeeks === 0;
}

/**
 * Get complete periodization info for current state
 */
export function getPeriodizationInfo(
  planCreatedAt: string,
  targetDate: string | null
): PeriodizationInfo | null {
  // If no target date, no periodization
  if (!targetDate) return null;

  const totalWeeks = calculateTotalWeeks(targetDate);
  const currentWeek = calculateCurrentWeek(planCreatedAt);

  // If we're past the event, return null
  if (currentWeek > totalWeeks) return null;

  const phaseInfo = calculatePhase(currentWeek, totalWeeks);
  const characteristics = PHASE_CHARACTERISTICS[phaseInfo.phase];

  return {
    totalWeeks,
    currentWeek,
    phase: phaseInfo.phase,
    phaseDescription: characteristics.focusDescription,
    weeksInPhase: phaseInfo.weeksInPhase,
    phaseStartWeek: phaseInfo.phaseStartWeek,
    phaseEndWeek: phaseInfo.phaseEndWeek,
    weeksUntilEvent: totalWeeks - currentWeek,
    isDeloadWeek: isDeloadWeek(currentWeek, totalWeeks),
    progressPercent: Math.round((currentWeek / totalWeeks) * 100),
  };
}

/**
 * Generate periodization context for AI prompt
 * This tells the AI exactly what kind of week to generate
 */
export function generatePeriodizationPrompt(info: PeriodizationInfo): string {
  const characteristics = PHASE_CHARACTERISTICS[info.phase];

  return `
**═══════════════════════════════════════════════════════════════**
**PERIODIZATION CONTEXT - WEEK ${info.currentWeek} of ${info.totalWeeks}**
**═══════════════════════════════════════════════════════════════**

**CURRENT PHASE: ${info.phase.toUpperCase()}**
- Phase Description: ${info.phaseDescription}
- Week ${info.currentWeek - info.phaseStartWeek + 1} of ${info.weeksInPhase} in this phase
- Phase ends at Week ${info.phaseEndWeek}
- ${info.weeksUntilEvent} weeks until event

**TRAINING PARAMETERS FOR THIS WEEK:**
- Volume Multiplier: ${characteristics.volumeMultiplier}x (${characteristics.volumeMultiplier > 1 ? 'higher than baseline' : characteristics.volumeMultiplier < 1 ? 'lower than baseline' : 'baseline'})
- Intensity Range: RPE ${characteristics.rpeRange}
${info.isDeloadWeek ? `
**🔄 THIS IS A DELOAD WEEK**
- Reduce volume by 40-50%
- Maintain movement patterns
- Focus on recovery and technique
- Lower RPE by 1-2 points
` : ''}

**PHASE PRINCIPLES TO APPLY:**
${characteristics.keyPrinciples.map(p => `✓ ${p}`).join('\n')}

**PROGRESSION NOTE:**
Progress: ${info.progressPercent}% through training block
${info.weeksUntilEvent <= 2 ? '⚠️ FINAL WEEKS - Focus on peak readiness and recovery' : ''}
${info.weeksUntilEvent <= 1 ? '🎯 RACE WEEK - Minimal training, maximum recovery' : ''}
`;
}

/**
 * Create initial periodization object for a new plan
 */
export function createInitialPeriodization(targetDate: string | null): {
  total_weeks: number;
  current_week: number;
  phase: PeriodizationPhase;
  phase_description: string;
  weeks_in_phase: number;
  phase_end_week: number;
} | undefined {
  if (!targetDate) return undefined;

  const totalWeeks = calculateTotalWeeks(targetDate);
  const phaseInfo = calculatePhase(1, totalWeeks);
  const characteristics = PHASE_CHARACTERISTICS[phaseInfo.phase];

  return {
    total_weeks: totalWeeks,
    current_week: 1,
    phase: phaseInfo.phase,
    phase_description: characteristics.focusDescription,
    weeks_in_phase: phaseInfo.weeksInPhase,
    phase_end_week: phaseInfo.phaseEndWeek,
  };
}

/**
 * Check if it's time to generate next week
 * Returns true if the current week number based on creation date
 * is greater than the stored current_week
 */
export function shouldGenerateNextWeek(
  planCreatedAt: string,
  storedCurrentWeek: number
): boolean {
  const actualCurrentWeek = calculateCurrentWeek(planCreatedAt);
  return actualCurrentWeek > storedCurrentWeek;
}

/**
 * Get updated periodization for next week
 */
export function advanceToNextWeek(
  currentPeriodization: {
    total_weeks: number;
    current_week: number;
    phase: PeriodizationPhase;
    phase_description?: string;
    weeks_in_phase?: number;
    phase_end_week?: number;
  }
): {
  total_weeks: number;
  current_week: number;
  phase: PeriodizationPhase;
  phase_description: string;
  weeks_in_phase: number;
  phase_end_week: number;
} {
  const nextWeek = currentPeriodization.current_week + 1;
  const phaseInfo = calculatePhase(nextWeek, currentPeriodization.total_weeks);
  const characteristics = PHASE_CHARACTERISTICS[phaseInfo.phase];

  return {
    total_weeks: currentPeriodization.total_weeks,
    current_week: nextWeek,
    phase: phaseInfo.phase,
    phase_description: characteristics.focusDescription,
    weeks_in_phase: phaseInfo.weeksInPhase,
    phase_end_week: phaseInfo.phaseEndWeek,
  };
}
