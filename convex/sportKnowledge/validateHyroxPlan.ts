/**
 * Validation Layer for Hyrox Plan Generation
 *
 * Validates generated plans against constraints before presenting to user.
 * Uses exercise mappings for deterministic categorization.
 *
 * Validation flow:
 * 1. LLM generates plan
 * 2. validateHyroxPlan() checks all constraints
 * 3. If issues found, autoFixPlan() attempts fixes
 * 4. If still invalid, regenerate with specific feedback
 * 5. If valid, present to user
 *
 * =============================================================================
 * FIRST-TIMER STATION COVERAGE VALIDATION
 * =============================================================================
 *
 * For first-time racers (isFirstRace: true), all 8 Hyrox stations must be
 * practiced within the first 2 weeks of training:
 *
 * - Week 1: WARNING if < 8 stations covered (informational)
 * - Week 2: ERROR if < 8 stations covered across weeks 1+2 combined
 * - Week 3+: No station coverage enforcement
 *
 * INTEGRATION NOTE (Phase 3):
 * Caller must provide `previousWeeksStationsCovered` by:
 * 1. Querying previous weeks' plans via getPreviousWeekPlans()
 * 2. Extracting stations via categorizeExercise() for each exercise
 * 3. Passing the HyroxStation[] array to ValidationConstraints
 *
 * If not provided, assumes no previous coverage (empty array).
 *
 * Example integration:
 * ```typescript
 * const previousPlans = await ctx.runQuery(internal.hyroxQueries.getPreviousWeekPlans, {
 *   userId,
 *   planId,
 *   beforeWeek: weekNumber,
 * });
 * const previousStationsCovered = extractStationsCovered(previousPlans);
 *
 * validateHyroxPlan(plan, {
 *   ...constraints,
 *   isFirstRace: true,
 *   weekNumber: 2,
 *   previousWeeksStationsCovered: previousStationsCovered,
 * });
 * ```
 *
 * EDGE CASE - Mid-training adoption:
 * Users who start using the app at week 5+ of their training will have no
 * data for previousWeeksStationsCovered. The validation silently passes
 * since the check only fires for weeks 1-2. This is acceptable for v1 -
 * "import previous training" is a v2 feature.
 */

import {
  categorizeExercise,
  extractRunningVolumeKm,
  extractSkiErgVolumeM,
  extractRowingVolumeM,
  getStationsPresent,
  getMissingStations,
  countStationOccurrences,
  hasProperWeightSpec,
  hasProperPaceGuidance,
  HyroxStation,
} from './exerciseMappings';

import { Phase, ExperienceLevel } from './hyrox';

// =============================================================================
// HARD SAFETY CAPS (Non-negotiable limits)
// =============================================================================

/**
 * These caps generate ERRORS, not warnings.
 * Plans violating these caps cannot be accepted - they must be auto-fixed or regenerated.
 * Based on sports science consensus and injury prevention principles.
 */
export const HARD_SAFETY_CAPS = {
  // Running progression (10% rule - sports science consensus)
  maxWeeklyRunningIncreasePercent: 10,
  maxSingleRunKm: {
    beginner: 12,
    intermediate: 16,
    advanced: 21,
  },

  // High intensity limits (prevent overtraining)
  maxHighIntensityRunsPerWeek: 2,
  maxHighIntensityDaysConsecutive: 0, // Never back-to-back hard days

  // Station volume caps (prevent rhabdo, overuse injuries)
  maxWallBallsPerWeek: {
    beginner: 150,
    intermediate: 250,
    advanced: 400,
  },
  maxBurpeeBroadJumpsPerWeek: {
    beginner: 60,
    intermediate: 100,
    advanced: 150,
  },
  maxSledPushMetersPerWeek: {
    beginner: 400,
    intermediate: 600,
    advanced: 800,
  },
  maxSledPullMetersPerWeek: {
    beginner: 400,
    intermediate: 600,
    advanced: 800,
  },

  // Recovery requirements
  minRestDaysPerWeek: 1,
  minEasyDaysPerWeek: 2, // Days with RPE < 6
  maxConsecutiveTrainingDays: 5,

  // Session limits
  maxSessionDurationMinutes: 120,
  minSessionDurationMinutes: 30,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratedPlan {
  week_number: number;
  phase: Phase;
  focus: string;
  days: GeneratedDay[];
  weekly_totals: {
    running_km: number;
    skierg_m: number;
    rowing_m: number;
    strength_sessions: number;
    total_hours: number;
  };
  notes?: string;
}

export interface GeneratedDay {
  day_number: number;
  day_name: string;
  session_type: string;
  duration_minutes: number;
  warmup?: {
    description: string;
    duration_minutes: number;
  };
  exercises: GeneratedExercise[];
  cooldown?: {
    description: string;
    duration_minutes: number;
  };
}

export interface GeneratedExercise {
  name: string;
  sets?: number;
  reps?: number;
  weight_kg?: number;
  distance_m?: number;
  distance_km?: number;
  duration_minutes?: number;
  rest_seconds?: number;
  target_pace?: string;
  notes?: string;
}

export interface ValidationConstraints {
  volumeTargets: {
    weeklyRunning: { min: number; max: number };
    weeklySkiErg: { min: number; max: number };
    weeklyRowing: { min: number; max: number };
    strengthSessions: { min: number; max: number };
    totalTrainingHours: { min: number; max: number };
  };
  trainingDays: number;
  sessionLengthMinutes: number;
  weakStations?: string[];
  strongStations?: string[];
  injuryAreas?: string[];
  injuryExercisesToAvoid?: string[];

  // Safety validation context (for week-over-week progression checks)
  experienceLevel?: ExperienceLevel;
  previousWeekVolumes?: {
    runningKm: number;
    skiErgM?: number;
    rowingM?: number;
  };

  // First-timer flag for station coverage validation
  isFirstRace?: boolean;
  weekNumber?: number;

  // Cross-week station tracking (for first-timer validation)
  // Stations covered in previous weeks - used to validate all 8 stations
  // are practiced in weeks 1-2 combined
  previousWeeksStationsCovered?: HyroxStation[];
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  category:
    | 'running_volume'
    | 'skierg_volume'
    | 'rowing_volume'
    | 'station_coverage'
    | 'weak_station_frequency'
    | 'training_days'
    | 'session_duration'
    | 'injury_violation'
    | 'missing_weight'
    | 'missing_pace'
    | 'intensity_distribution'
    // Safety cap violations (always errors, not warnings)
    | 'safety_running_progression'
    | 'safety_single_run_distance'
    | 'safety_high_intensity_frequency'
    | 'safety_consecutive_hard_days'
    | 'safety_station_volume'
    | 'safety_recovery'
    | 'safety_session_duration'
    // First-timer specific
    | 'first_timer_station_coverage';
  message: string;
  details?: Record<string, unknown>;
  autoFixable: boolean;
}

export interface ValidationResult {
  valid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  calculatedVolumes: {
    runningKm: number;
    skiErgM: number;
    rowingM: number;
    stationsPresent: HyroxStation[];
    stationsMissing: HyroxStation[];
    weakStationCounts: Record<string, number>;
  };
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate a generated Hyrox plan against constraints
 */
export function validateHyroxPlan(
  plan: GeneratedPlan,
  constraints: ValidationConstraints,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Flatten all exercises for analysis
  const allExercises = plan.days.flatMap(d => d.exercises);

  // ==========================================================================
  // CALCULATE ACTUAL VOLUMES
  // ==========================================================================

  // Calculate running volume
  const calculatedRunningKm = allExercises.reduce((sum, ex) => {
    return sum + extractRunningVolumeKm({
      name: ex.name,
      metrics_template: {
        target_distance_km: ex.distance_km,
        target_distance_m: ex.distance_m,
        target_duration_minutes: ex.duration_minutes,
      },
      intensity_notes: ex.notes,
    });
  }, 0);

  // Calculate SkiErg volume
  const calculatedSkiErgM = allExercises.reduce((sum, ex) => {
    return sum + extractSkiErgVolumeM({
      name: ex.name,
      metrics_template: {
        target_distance_m: ex.distance_m,
        target_distance_km: ex.distance_km,
        target_duration_minutes: ex.duration_minutes,
        target_sets: ex.sets,
      },
    });
  }, 0);

  // Calculate rowing volume
  const calculatedRowingM = allExercises.reduce((sum, ex) => {
    return sum + extractRowingVolumeM({
      name: ex.name,
      metrics_template: {
        target_distance_m: ex.distance_m,
        target_distance_km: ex.distance_km,
        target_duration_minutes: ex.duration_minutes,
        target_sets: ex.sets,
      },
    });
  }, 0);

  // Get station coverage
  const exercisesForMapping = allExercises.map(ex => ({ name: ex.name }));
  const stationsPresent = getStationsPresent(exercisesForMapping);
  const stationsMissing = getMissingStations(exercisesForMapping);

  // Count weak station occurrences
  const weakStationCounts: Record<string, number> = {};
  for (const station of constraints.weakStations || []) {
    weakStationCounts[station] = countStationOccurrences(
      exercisesForMapping,
      station as HyroxStation
    );
  }

  // ==========================================================================
  // VALIDATE RUNNING VOLUME
  // ==========================================================================

  const runningMin = constraints.volumeTargets.weeklyRunning.min;
  const runningMax = constraints.volumeTargets.weeklyRunning.max;

  if (calculatedRunningKm < runningMin) {
    issues.push({
      type: 'error',
      category: 'running_volume',
      message: `Running volume too low: ${calculatedRunningKm.toFixed(1)}km (minimum: ${runningMin}km)`,
      details: { actual: calculatedRunningKm, min: runningMin, max: runningMax },
      autoFixable: false, // Need to regenerate
    });
  } else if (calculatedRunningKm > runningMax) {
    issues.push({
      type: 'warning',
      category: 'running_volume',
      message: `Running volume high: ${calculatedRunningKm.toFixed(1)}km (maximum: ${runningMax}km)`,
      details: { actual: calculatedRunningKm, min: runningMin, max: runningMax },
      autoFixable: false,
    });
  }

  // ==========================================================================
  // VALIDATE SKIERG VOLUME
  // ==========================================================================

  const skiErgMin = constraints.volumeTargets.weeklySkiErg.min;
  const skiErgMax = constraints.volumeTargets.weeklySkiErg.max;

  if (calculatedSkiErgM < skiErgMin) {
    issues.push({
      type: 'warning',
      category: 'skierg_volume',
      message: `SkiErg volume low: ${calculatedSkiErgM}m (minimum: ${skiErgMin}m)`,
      details: { actual: calculatedSkiErgM, min: skiErgMin, max: skiErgMax },
      autoFixable: true, // Can add SkiErg to a session
    });
  }

  // ==========================================================================
  // VALIDATE ROWING VOLUME
  // ==========================================================================

  const rowingMin = constraints.volumeTargets.weeklyRowing.min;
  const rowingMax = constraints.volumeTargets.weeklyRowing.max;

  if (calculatedRowingM < rowingMin) {
    issues.push({
      type: 'warning',
      category: 'rowing_volume',
      message: `Rowing volume low: ${calculatedRowingM}m (minimum: ${rowingMin}m)`,
      details: { actual: calculatedRowingM, min: rowingMin, max: rowingMax },
      autoFixable: true,
    });
  }

  // ==========================================================================
  // VALIDATE STATION COVERAGE
  // ==========================================================================

  if (stationsMissing.length > 0) {
    issues.push({
      type: 'error',
      category: 'station_coverage',
      message: `Missing stations: ${stationsMissing.join(', ')}`,
      details: { missing: stationsMissing, present: stationsPresent },
      autoFixable: stationsMissing.length <= 2, // Can add 1-2 stations
    });
  }

  // ==========================================================================
  // VALIDATE WEAK STATION FREQUENCY
  // ==========================================================================

  for (const [station, count] of Object.entries(weakStationCounts)) {
    if (count < 2) {
      issues.push({
        type: 'warning',
        category: 'weak_station_frequency',
        message: `Weak station "${station}" only appears ${count}x (should be 2x)`,
        details: { station, count, required: 2 },
        autoFixable: true,
      });
    }
  }

  // ==========================================================================
  // VALIDATE TRAINING DAYS
  // ==========================================================================

  if (plan.days.length !== constraints.trainingDays) {
    issues.push({
      type: 'error',
      category: 'training_days',
      message: `Wrong number of training days: ${plan.days.length} (expected: ${constraints.trainingDays})`,
      details: { actual: plan.days.length, expected: constraints.trainingDays },
      autoFixable: false, // Need to regenerate
    });
  }

  // ==========================================================================
  // VALIDATE SESSION DURATIONS
  // ==========================================================================

  for (const day of plan.days) {
    if (day.duration_minutes > constraints.sessionLengthMinutes * 1.1) { // 10% tolerance
      issues.push({
        type: 'warning',
        category: 'session_duration',
        message: `Day ${day.day_number} too long: ${day.duration_minutes}min (max: ${constraints.sessionLengthMinutes}min)`,
        details: { day: day.day_number, actual: day.duration_minutes, max: constraints.sessionLengthMinutes },
        autoFixable: false,
      });
    }
  }

  // ==========================================================================
  // VALIDATE INJURY CONSTRAINTS
  // ==========================================================================

  if (constraints.injuryExercisesToAvoid?.length) {
    for (const exercise of allExercises) {
      const name = exercise.name.toLowerCase();
      for (const avoid of constraints.injuryExercisesToAvoid) {
        if (name.includes(avoid.toLowerCase())) {
          issues.push({
            type: 'error',
            category: 'injury_violation',
            message: `Exercise "${exercise.name}" violates injury constraints (avoid: ${avoid})`,
            details: { exercise: exercise.name, constraint: avoid },
            autoFixable: true, // Can remove/replace exercise
          });
        }
      }
    }
  }

  // ==========================================================================
  // VALIDATE WEIGHT SPECIFICATIONS
  // ==========================================================================

  let missingWeightCount = 0;
  for (const exercise of allExercises) {
    if (!hasProperWeightSpec({
      name: exercise.name,
      metrics_template: { target_weight_kg: exercise.weight_kg },
    })) {
      missingWeightCount++;
    }
  }

  if (missingWeightCount > 0) {
    issues.push({
      type: 'warning',
      category: 'missing_weight',
      message: `${missingWeightCount} strength exercise(s) missing specific weight`,
      details: { count: missingWeightCount },
      autoFixable: false,
    });
  }

  // ==========================================================================
  // VALIDATE PACE GUIDANCE
  // ==========================================================================

  let missingPaceCount = 0;
  for (const exercise of allExercises) {
    if (!hasProperPaceGuidance({
      name: exercise.name,
      intensity_notes: exercise.notes || exercise.target_pace,
    })) {
      const category = categorizeExercise(exercise.name);
      if (category.type === 'running') {
        missingPaceCount++;
      }
    }
  }

  if (missingPaceCount > 0) {
    issues.push({
      type: 'warning',
      category: 'missing_pace',
      message: `${missingPaceCount} running exercise(s) missing pace/zone guidance`,
      details: { count: missingPaceCount },
      autoFixable: false,
    });
  }

  // ==========================================================================
  // HARD SAFETY CAP VALIDATION (These generate ERRORS, not warnings)
  // ==========================================================================

  const safetyIssues = validateSafetyCaps(plan, constraints, allExercises, calculatedRunningKm);
  issues.push(...safetyIssues);

  // ==========================================================================
  // FIRST-TIMER STATION COVERAGE (All 8 stations in weeks 1-2 combined)
  // ==========================================================================

  if (constraints.isFirstRace) {
    const weekNum = constraints.weekNumber || 1;

    // Combine stations from previous weeks with this week
    const previousStations = new Set(constraints.previousWeeksStationsCovered || []);
    const allCoveredStations = new Set([...previousStations, ...stationsPresent]);

    // All 8 Hyrox stations
    const ALL_STATIONS: HyroxStation[] = [
      'skierg', 'sled_push', 'sled_pull', 'burpee_broad_jump',
      'rowing', 'farmers_carry', 'sandbag_lunges', 'wall_balls'
    ];

    const stillMissing = ALL_STATIONS.filter(s => !allCoveredStations.has(s));

    // Only enforce in weeks 1-2 (by end of week 2, all stations must be covered)
    if (weekNum <= 2 && stillMissing.length > 0) {
      if (weekNum === 2) {
        // End of week 2 - this is an error, all should be covered by now
        issues.push({
          type: 'error',
          category: 'first_timer_station_coverage',
          message: `First-timer: By end of week 2, all stations must be practiced. Still missing: ${stillMissing.join(', ')}`,
          details: {
            missing: stillMissing,
            coveredThisWeek: stationsPresent,
            coveredPreviousWeeks: Array.from(previousStations),
            totalCovered: Array.from(allCoveredStations),
            weekNumber: weekNum,
            reason: 'First-time racers must practice every station in the first 2 weeks',
          },
          autoFixable: stillMissing.length <= 3,
        });
      } else {
        // Week 1 - warning to inform, not error yet
        issues.push({
          type: 'warning',
          category: 'first_timer_station_coverage',
          message: `First-timer: ${stillMissing.length} stations not yet practiced. Ensure they're covered in week 2: ${stillMissing.join(', ')}`,
          details: {
            missing: stillMissing,
            coveredThisWeek: stationsPresent,
            weekNumber: weekNum,
            reason: 'First-time racers should practice all 8 stations in weeks 1-2',
          },
          autoFixable: false, // Don't auto-fix week 1, just inform
        });
      }
    }
  }

  // ==========================================================================
  // CALCULATE SCORE
  // ==========================================================================

  const errorCount = issues.filter(i => i.type === 'error').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;

  // Score: 100 - (errors * 15) - (warnings * 5)
  const score = Math.max(0, 100 - (errorCount * 15) - (warningCount * 5));

  return {
    valid: errorCount === 0,
    score,
    issues,
    calculatedVolumes: {
      runningKm: calculatedRunningKm,
      skiErgM: calculatedSkiErgM,
      rowingM: calculatedRowingM,
      stationsPresent,
      stationsMissing,
      weakStationCounts,
    },
  };
}

// =============================================================================
// SAFETY VALIDATION HELPERS
// =============================================================================

/**
 * Validate all hard safety caps
 * Returns array of ERRORS (not warnings) for any violations
 */
function validateSafetyCaps(
  plan: GeneratedPlan,
  constraints: ValidationConstraints,
  allExercises: GeneratedExercise[],
  calculatedRunningKm: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const level = constraints.experienceLevel || 'intermediate';

  // --------------------------------------------------------------------------
  // 1. RUNNING PROGRESSION (10% rule)
  // --------------------------------------------------------------------------
  if (constraints.previousWeekVolumes?.runningKm) {
    const prevKm = constraints.previousWeekVolumes.runningKm;
    const maxAllowedKm = prevKm * (1 + HARD_SAFETY_CAPS.maxWeeklyRunningIncreasePercent / 100);

    if (calculatedRunningKm > maxAllowedKm) {
      const increasePercent = ((calculatedRunningKm - prevKm) / prevKm * 100).toFixed(1);
      issues.push({
        type: 'error',
        category: 'safety_running_progression',
        message: `Running volume increase too aggressive: ${increasePercent}% (max: ${HARD_SAFETY_CAPS.maxWeeklyRunningIncreasePercent}%)`,
        details: {
          previousWeekKm: prevKm,
          currentWeekKm: calculatedRunningKm,
          maxAllowedKm,
          increasePercent: parseFloat(increasePercent),
          rule: '10% rule - sports science consensus for injury prevention',
        },
        autoFixable: true, // Can scale down running distances
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. SINGLE RUN DISTANCE CAP
  // --------------------------------------------------------------------------
  const maxSingleRunKm = HARD_SAFETY_CAPS.maxSingleRunKm[level];

  for (const day of plan.days) {
    for (const ex of day.exercises) {
      const category = categorizeExercise(ex.name);
      if (category.type === 'running') {
        const runKm = ex.distance_km || (ex.distance_m ? ex.distance_m / 1000 : 0);

        if (runKm > maxSingleRunKm) {
          issues.push({
            type: 'error',
            category: 'safety_single_run_distance',
            message: `Single run too long: ${runKm.toFixed(1)}km on Day ${day.day_number} (max for ${level}: ${maxSingleRunKm}km)`,
            details: {
              exercise: ex.name,
              dayNumber: day.day_number,
              distanceKm: runKm,
              maxAllowedKm: maxSingleRunKm,
              level,
            },
            autoFixable: true, // Can cap the distance
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. HIGH INTENSITY FREQUENCY
  // --------------------------------------------------------------------------
  const highIntensityDays: number[] = [];

  for (const day of plan.days) {
    const isHighIntensity = day.exercises.some(ex => {
      const notes = (ex.notes || '').toLowerCase();
      return notes.includes('tempo') ||
             notes.includes('threshold') ||
             notes.includes('interval') ||
             notes.includes('race pace') ||
             notes.includes('hard') ||
             notes.includes('max effort') ||
             notes.includes('vo2') ||
             notes.includes('sprint');
    }) || day.session_type.toLowerCase().includes('interval') ||
         day.session_type.toLowerCase().includes('tempo') ||
         day.session_type.toLowerCase().includes('threshold');

    if (isHighIntensity) {
      highIntensityDays.push(day.day_number);
    }
  }

  // Count high intensity running sessions specifically
  const highIntensityRunningCount = plan.days.filter(day => {
    return day.exercises.some(ex => {
      const category = categorizeExercise(ex.name);
      if (category.type !== 'running') return false;
      const notes = (ex.notes || '').toLowerCase();
      return notes.includes('tempo') ||
             notes.includes('threshold') ||
             notes.includes('interval') ||
             notes.includes('race pace') ||
             notes.includes('vo2') ||
             notes.includes('sprint');
    });
  }).length;

  if (highIntensityRunningCount > HARD_SAFETY_CAPS.maxHighIntensityRunsPerWeek) {
    issues.push({
      type: 'error',
      category: 'safety_high_intensity_frequency',
      message: `Too many high intensity running sessions: ${highIntensityRunningCount} (max: ${HARD_SAFETY_CAPS.maxHighIntensityRunsPerWeek})`,
      details: {
        count: highIntensityRunningCount,
        maxAllowed: HARD_SAFETY_CAPS.maxHighIntensityRunsPerWeek,
        highIntensityDays,
        rule: 'More than 2 high intensity sessions per week increases injury risk significantly',
      },
      autoFixable: true, // Can convert some to easy/recovery
    });
  }

  // --------------------------------------------------------------------------
  // 4. CONSECUTIVE HARD DAYS
  // --------------------------------------------------------------------------
  if (highIntensityDays.length >= 2) {
    // Sort and check for consecutive days
    const sorted = [...highIntensityDays].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] === 1) {
        issues.push({
          type: 'error',
          category: 'safety_consecutive_hard_days',
          message: `Back-to-back high intensity days: Day ${sorted[i]} and Day ${sorted[i + 1]}`,
          details: {
            consecutiveDays: [sorted[i], sorted[i + 1]],
            rule: 'Never schedule hard days consecutively - recovery is essential for adaptation',
          },
          autoFixable: true, // Can convert one to easy
        });
        break; // Only report first occurrence
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. STATION VOLUME CAPS
  // --------------------------------------------------------------------------

  // Wall balls
  const wallBallsTotal = allExercises
    .filter(ex => {
      const cat = categorizeExercise(ex.name);
      return cat.type === 'station' && cat.station === 'wall_balls';
    })
    .reduce((sum, ex) => sum + (ex.reps || 0) * (ex.sets || 1), 0);

  const maxWallBalls = HARD_SAFETY_CAPS.maxWallBallsPerWeek[level];
  if (wallBallsTotal > maxWallBalls) {
    issues.push({
      type: 'error',
      category: 'safety_station_volume',
      message: `Wall balls volume too high: ${wallBallsTotal} reps (max for ${level}: ${maxWallBalls})`,
      details: {
        station: 'wall_balls',
        totalReps: wallBallsTotal,
        maxAllowed: maxWallBalls,
        level,
        risk: 'Excessive wall balls can cause shoulder/hip overuse injuries and rhabdomyolysis',
      },
      autoFixable: true,
    });
  }

  // Burpee broad jumps
  const burpeeTotal = allExercises
    .filter(ex => {
      const cat = categorizeExercise(ex.name);
      return cat.type === 'station' && cat.station === 'burpee_broad_jump';
    })
    .reduce((sum, ex) => {
      // BBJs can be specified as distance (typically 80 BBJs = 160m)
      if (ex.distance_m) {
        return sum + Math.ceil(ex.distance_m / 2); // ~2m per BBJ
      }
      return sum + (ex.reps || 0) * (ex.sets || 1);
    }, 0);

  const maxBurpees = HARD_SAFETY_CAPS.maxBurpeeBroadJumpsPerWeek[level];
  if (burpeeTotal > maxBurpees) {
    issues.push({
      type: 'error',
      category: 'safety_station_volume',
      message: `Burpee broad jumps too high: ~${burpeeTotal} (max for ${level}: ${maxBurpees})`,
      details: {
        station: 'burpee_broad_jump',
        totalCount: burpeeTotal,
        maxAllowed: maxBurpees,
        level,
        risk: 'High volume BBJs cause severe DOMS and knee/hip stress',
      },
      autoFixable: true,
    });
  }

  // Sled push volume (total meters)
  const sledPushTotal = allExercises
    .filter(ex => {
      const cat = categorizeExercise(ex.name);
      return cat.type === 'station' && cat.station === 'sled_push';
    })
    .reduce((sum, ex) => sum + (ex.distance_m || 0) * (ex.sets || 1), 0);

  const maxSledPush = HARD_SAFETY_CAPS.maxSledPushMetersPerWeek[level];
  if (sledPushTotal > maxSledPush) {
    issues.push({
      type: 'error',
      category: 'safety_station_volume',
      message: `Sled push volume too high: ${sledPushTotal}m (max for ${level}: ${maxSledPush}m)`,
      details: {
        station: 'sled_push',
        totalMeters: sledPushTotal,
        maxAllowed: maxSledPush,
        level,
        risk: 'Excessive sled pushing causes significant eccentric stress and DOMS',
      },
      autoFixable: true,
    });
  }

  // Sled pull volume (total meters)
  const sledPullTotal = allExercises
    .filter(ex => {
      const cat = categorizeExercise(ex.name);
      return cat.type === 'station' && cat.station === 'sled_pull';
    })
    .reduce((sum, ex) => sum + (ex.distance_m || 0) * (ex.sets || 1), 0);

  const maxSledPull = HARD_SAFETY_CAPS.maxSledPullMetersPerWeek[level];
  if (sledPullTotal > maxSledPull) {
    issues.push({
      type: 'error',
      category: 'safety_station_volume',
      message: `Sled pull volume too high: ${sledPullTotal}m (max for ${level}: ${maxSledPull}m)`,
      details: {
        station: 'sled_pull',
        totalMeters: sledPullTotal,
        maxAllowed: maxSledPull,
        level,
        risk: 'Excessive sled pulling causes grip fatigue and posterior chain overuse',
      },
      autoFixable: true,
    });
  }

  // --------------------------------------------------------------------------
  // 6. RECOVERY REQUIREMENTS
  // --------------------------------------------------------------------------
  const trainingDays = plan.days.length;
  const restDaysInWeek = 7 - trainingDays;

  if (restDaysInWeek < HARD_SAFETY_CAPS.minRestDaysPerWeek) {
    issues.push({
      type: 'error',
      category: 'safety_recovery',
      message: `Not enough rest days: ${restDaysInWeek} (minimum: ${HARD_SAFETY_CAPS.minRestDaysPerWeek})`,
      details: {
        restDays: restDaysInWeek,
        trainingDays,
        minRequired: HARD_SAFETY_CAPS.minRestDaysPerWeek,
        rule: 'At least 1 complete rest day per week is essential for recovery',
      },
      autoFixable: false, // Need to regenerate with fewer days
    });
  }

  // Check for consecutive training days
  if (trainingDays > HARD_SAFETY_CAPS.maxConsecutiveTrainingDays) {
    // Need to check actual day distribution
    const dayNumbers = plan.days.map(d => d.day_number).sort((a, b) => a - b);
    let maxConsecutive = 1;
    let currentStreak = 1;

    for (let i = 1; i < dayNumbers.length; i++) {
      if (dayNumbers[i] - dayNumbers[i-1] === 1) {
        currentStreak++;
        maxConsecutive = Math.max(maxConsecutive, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    if (maxConsecutive > HARD_SAFETY_CAPS.maxConsecutiveTrainingDays) {
      issues.push({
        type: 'error',
        category: 'safety_recovery',
        message: `Too many consecutive training days: ${maxConsecutive} (max: ${HARD_SAFETY_CAPS.maxConsecutiveTrainingDays})`,
        details: {
          consecutiveDays: maxConsecutive,
          maxAllowed: HARD_SAFETY_CAPS.maxConsecutiveTrainingDays,
          dayNumbers,
          rule: 'Maximum 5 consecutive training days - rest days allow adaptation',
        },
        autoFixable: false,
      });
    }
  }

  // Count easy days (sessions with no high intensity work)
  const easyDayCount = plan.days.filter(day => {
    return !day.exercises.some(ex => {
      const notes = (ex.notes || '').toLowerCase();
      return notes.includes('tempo') ||
             notes.includes('threshold') ||
             notes.includes('interval') ||
             notes.includes('hard') ||
             notes.includes('max') ||
             notes.includes('race pace') ||
             notes.includes('sprint');
    }) && !day.session_type.toLowerCase().includes('interval') &&
         !day.session_type.toLowerCase().includes('tempo') &&
         !day.session_type.toLowerCase().includes('threshold');
  }).length;

  if (easyDayCount < HARD_SAFETY_CAPS.minEasyDaysPerWeek && trainingDays >= 4) {
    issues.push({
      type: 'error',
      category: 'safety_recovery',
      message: `Not enough easy/recovery days: ${easyDayCount} (minimum: ${HARD_SAFETY_CAPS.minEasyDaysPerWeek})`,
      details: {
        easyDays: easyDayCount,
        minRequired: HARD_SAFETY_CAPS.minEasyDaysPerWeek,
        rule: 'At least 2 easy days per week for proper recovery and adaptation',
      },
      autoFixable: true, // Can reduce intensity on some days
    });
  }

  // --------------------------------------------------------------------------
  // 7. SESSION DURATION LIMITS
  // --------------------------------------------------------------------------
  for (const day of plan.days) {
    if (day.duration_minutes > HARD_SAFETY_CAPS.maxSessionDurationMinutes) {
      issues.push({
        type: 'error',
        category: 'safety_session_duration',
        message: `Session too long: Day ${day.day_number} is ${day.duration_minutes}min (max: ${HARD_SAFETY_CAPS.maxSessionDurationMinutes}min)`,
        details: {
          dayNumber: day.day_number,
          durationMinutes: day.duration_minutes,
          maxAllowed: HARD_SAFETY_CAPS.maxSessionDurationMinutes,
          risk: 'Sessions over 2 hours increase cortisol and decrease training quality',
        },
        autoFixable: true, // Can split or reduce exercises
      });
    }

    if (day.duration_minutes < HARD_SAFETY_CAPS.minSessionDurationMinutes) {
      issues.push({
        type: 'error',
        category: 'safety_session_duration',
        message: `Session too short: Day ${day.day_number} is ${day.duration_minutes}min (min: ${HARD_SAFETY_CAPS.minSessionDurationMinutes}min)`,
        details: {
          dayNumber: day.day_number,
          durationMinutes: day.duration_minutes,
          minRequired: HARD_SAFETY_CAPS.minSessionDurationMinutes,
        },
        autoFixable: false, // Needs more content
      });
    }
  }

  return issues;
}

// =============================================================================
// AUTO-FIX FUNCTIONS
// =============================================================================

/**
 * Attempt to automatically fix issues in a plan
 */
export function autoFixPlan(
  plan: GeneratedPlan,
  issues: ValidationIssue[],
): GeneratedPlan {
  // Deep clone the plan
  const fixed = JSON.parse(JSON.stringify(plan)) as GeneratedPlan;

  const autoFixableIssues = issues.filter(i => i.autoFixable);

  for (const issue of autoFixableIssues) {
    switch (issue.category) {
      case 'station_coverage':
      case 'first_timer_station_coverage':
        fixMissingStations(fixed, issue.details?.missing as HyroxStation[]);
        break;
      case 'weak_station_frequency':
        fixWeakStationFrequency(fixed, issue.details?.station as string);
        break;
      case 'skierg_volume':
        fixSkiErgVolume(fixed, issue.details?.min as number);
        break;
      case 'rowing_volume':
        fixRowingVolume(fixed, issue.details?.min as number);
        break;
      case 'injury_violation':
        fixInjuryViolation(fixed, issue.details?.exercise as string);
        break;

      // Safety cap auto-fixes
      case 'safety_running_progression':
        fixRunningProgression(fixed, issue.details?.maxAllowedKm as number);
        break;
      case 'safety_single_run_distance':
        fixSingleRunDistance(fixed, issue.details?.dayNumber as number, issue.details?.maxAllowedKm as number);
        break;
      case 'safety_high_intensity_frequency':
        fixHighIntensityFrequency(fixed, issue.details?.maxAllowed as number);
        break;
      case 'safety_consecutive_hard_days':
        fixConsecutiveHardDays(fixed, issue.details?.consecutiveDays as number[]);
        break;
      case 'safety_station_volume':
        fixStationVolume(fixed, issue.details?.station as string, issue.details?.maxAllowed as number);
        break;
      case 'safety_session_duration':
        fixSessionDuration(fixed, issue.details?.dayNumber as number, issue.details?.maxAllowed as number);
        break;
    }
  }

  return fixed;
}

/**
 * Add missing stations to the plan
 */
function fixMissingStations(plan: GeneratedPlan, missing: HyroxStation[]): void {
  if (!missing || missing.length === 0) return;

  // Station templates for adding
  const stationTemplates: Record<HyroxStation, GeneratedExercise> = {
    skierg: { name: 'SkiErg', distance_m: 500, sets: 3, rest_seconds: 60, notes: 'Race pace' },
    sled_push: { name: 'Sled Push', distance_m: 50, sets: 2, rest_seconds: 90, notes: 'Race weight' },
    sled_pull: { name: 'Sled Pull', distance_m: 50, sets: 2, rest_seconds: 90, notes: 'Race weight' },
    burpee_broad_jump: { name: 'Burpee Broad Jumps', distance_m: 40, sets: 2, rest_seconds: 60, notes: 'Focus on distance' },
    rowing: { name: 'Rowing', distance_m: 500, sets: 3, rest_seconds: 60, notes: 'Steady pace' },
    farmers_carry: { name: 'Farmers Carry', distance_m: 100, sets: 2, rest_seconds: 90, notes: 'Race weight' },
    sandbag_lunges: { name: 'Sandbag Lunges', distance_m: 50, sets: 2, rest_seconds: 60, notes: 'Race weight' },
    wall_balls: { name: 'Wall Balls', reps: 25, sets: 3, rest_seconds: 60, notes: 'Find rhythm' },
  };

  // Add each missing station to an appropriate day
  for (let i = 0; i < missing.length; i++) {
    const station = missing[i];
    const template = stationTemplates[station];

    // Add to day (distribute across days)
    const dayIndex = i % plan.days.length;
    plan.days[dayIndex].exercises.push(template);

    // Update duration estimate
    plan.days[dayIndex].duration_minutes += 10;
  }
}

/**
 * Add extra weak station practice
 */
function fixWeakStationFrequency(plan: GeneratedPlan, station: string): void {
  const stationTemplates: Record<string, GeneratedExercise> = {
    sled_push: { name: 'Sled Push Practice', distance_m: 25, sets: 3, rest_seconds: 60, notes: 'Technique focus' },
    sled_pull: { name: 'Sled Pull Practice', distance_m: 25, sets: 3, rest_seconds: 60, notes: 'Hand-over-hand rhythm' },
    wall_balls: { name: 'Wall Balls', reps: 20, sets: 2, rest_seconds: 45, notes: 'Extra practice' },
    burpee_broad_jump: { name: 'Burpee Broad Jump Practice', distance_m: 20, sets: 2, rest_seconds: 45, notes: 'Landing mechanics' },
    skierg: { name: 'SkiErg Technique', distance_m: 250, sets: 3, rest_seconds: 45, notes: 'Focus on hip hinge' },
    rowing: { name: 'Rowing Technique', distance_m: 250, sets: 3, rest_seconds: 45, notes: 'Drive sequence' },
    farmers_carry: { name: 'Farmers Carry Practice', distance_m: 50, sets: 2, rest_seconds: 60, notes: 'Posture focus' },
    sandbag_lunges: { name: 'Sandbag Lunge Practice', distance_m: 25, sets: 2, rest_seconds: 60, notes: 'Stability focus' },
  };

  const template = stationTemplates[station];
  if (!template) return;

  // Find day without this station
  for (const day of plan.days) {
    const hasStation = day.exercises.some(ex =>
      ex.name.toLowerCase().includes(station.replace('_', ' '))
    );

    if (!hasStation) {
      day.exercises.push(template);
      day.duration_minutes += 8;
      break;
    }
  }
}

/**
 * Add SkiErg volume if too low
 */
function fixSkiErgVolume(plan: GeneratedPlan, minVolume: number): void {
  // Find a conditioning day to add SkiErg
  for (const day of plan.days) {
    const sessionType = day.session_type.toLowerCase();
    if (sessionType.includes('conditioning') || sessionType.includes('cardio') || sessionType.includes('machine')) {
      day.exercises.push({
        name: 'SkiErg',
        distance_m: 500,
        sets: 3,
        rest_seconds: 60,
        notes: 'Added for volume',
      });
      day.duration_minutes += 12;
      break;
    }
  }
}

/**
 * Add rowing volume if too low
 */
function fixRowingVolume(plan: GeneratedPlan, minVolume: number): void {
  for (const day of plan.days) {
    const sessionType = day.session_type.toLowerCase();
    if (sessionType.includes('conditioning') || sessionType.includes('cardio') || sessionType.includes('machine')) {
      day.exercises.push({
        name: 'Rowing',
        distance_m: 500,
        sets: 3,
        rest_seconds: 60,
        notes: 'Added for volume',
      });
      day.duration_minutes += 12;
      break;
    }
  }
}

/**
 * Remove exercise that violates injury constraint
 */
function fixInjuryViolation(plan: GeneratedPlan, exerciseName: string): void {
  for (const day of plan.days) {
    const index = day.exercises.findIndex(
      ex => ex.name.toLowerCase() === exerciseName.toLowerCase()
    );

    if (index !== -1) {
      // Remove the exercise
      day.exercises.splice(index, 1);
      day.duration_minutes -= 5; // Estimate
    }
  }
}

// =============================================================================
// SAFETY AUTO-FIX FUNCTIONS
// =============================================================================

/**
 * Scale down running distances to meet 10% progression rule
 */
function fixRunningProgression(plan: GeneratedPlan, maxAllowedKm: number): void {
  // Calculate current total
  let currentTotal = 0;
  const runningExercises: { day: GeneratedDay; ex: GeneratedExercise; km: number }[] = [];

  for (const day of plan.days) {
    for (const ex of day.exercises) {
      const category = categorizeExercise(ex.name);
      if (category.type === 'running') {
        const km = ex.distance_km || (ex.distance_m ? ex.distance_m / 1000 : 0);
        if (km > 0) {
          currentTotal += km;
          runningExercises.push({ day, ex, km });
        }
      }
    }
  }

  if (currentTotal <= maxAllowedKm || runningExercises.length === 0) return;

  // Scale factor to reduce all runs proportionally
  const scaleFactor = maxAllowedKm / currentTotal;

  for (const { ex } of runningExercises) {
    if (ex.distance_km) {
      ex.distance_km = Math.round(ex.distance_km * scaleFactor * 10) / 10;
    }
    if (ex.distance_m) {
      ex.distance_m = Math.round(ex.distance_m * scaleFactor);
    }
    // Add note about the reduction
    ex.notes = `${ex.notes || ''} [Reduced for safe progression]`.trim();
  }

  // Update weekly totals
  plan.weekly_totals.running_km = Math.round(maxAllowedKm * 10) / 10;
}

/**
 * Cap single run distance for a specific day
 */
function fixSingleRunDistance(plan: GeneratedPlan, dayNumber: number, maxKm: number): void {
  const day = plan.days.find(d => d.day_number === dayNumber);
  if (!day) return;

  for (const ex of day.exercises) {
    const category = categorizeExercise(ex.name);
    if (category.type === 'running') {
      const currentKm = ex.distance_km || (ex.distance_m ? ex.distance_m / 1000 : 0);
      if (currentKm > maxKm) {
        if (ex.distance_km) {
          ex.distance_km = maxKm;
        }
        if (ex.distance_m) {
          ex.distance_m = maxKm * 1000;
        }
        ex.notes = `${ex.notes || ''} [Capped at ${maxKm}km for safety]`.trim();
      }
    }
  }
}

/**
 * Convert excess high intensity sessions to easy/recovery
 */
function fixHighIntensityFrequency(plan: GeneratedPlan, maxAllowed: number): void {
  const highIntensityIndicators = ['tempo', 'threshold', 'interval', 'race pace', 'hard', 'max effort', 'vo2', 'sprint'];
  let highIntensityCount = 0;

  for (const day of plan.days) {
    const isHighIntensity = day.exercises.some(ex => {
      const notes = (ex.notes || '').toLowerCase();
      return highIntensityIndicators.some(ind => notes.includes(ind));
    }) || highIntensityIndicators.some(ind =>
      day.session_type.toLowerCase().includes(ind)
    );

    if (isHighIntensity) {
      highIntensityCount++;

      // If we've exceeded the limit, convert this day to easy
      if (highIntensityCount > maxAllowed) {
        // Modify session type
        if (day.session_type.toLowerCase().includes('interval')) {
          day.session_type = day.session_type.replace(/interval/gi, 'Easy');
        }
        if (day.session_type.toLowerCase().includes('tempo')) {
          day.session_type = day.session_type.replace(/tempo/gi, 'Easy');
        }

        // Modify exercise intensities
        for (const ex of day.exercises) {
          if (ex.notes) {
            const lowerNotes = ex.notes.toLowerCase();
            for (const ind of highIntensityIndicators) {
              if (lowerNotes.includes(ind)) {
                ex.notes = 'Easy/recovery pace [Converted from high intensity for safety]';
                break;
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Convert one of the consecutive hard days to easy
 */
function fixConsecutiveHardDays(plan: GeneratedPlan, consecutiveDays: number[]): void {
  if (!consecutiveDays || consecutiveDays.length < 2) return;

  // Convert the second day to easy (keep first hard day)
  const dayToFix = plan.days.find(d => d.day_number === consecutiveDays[1]);
  if (!dayToFix) return;

  // Change session type
  dayToFix.session_type = `Recovery/Easy ${dayToFix.session_type}`;

  // Modify exercise notes
  for (const ex of dayToFix.exercises) {
    const notes = (ex.notes || '').toLowerCase();
    if (notes.includes('tempo') || notes.includes('interval') ||
        notes.includes('hard') || notes.includes('race pace') ||
        notes.includes('sprint') || notes.includes('threshold')) {
      ex.notes = 'Easy pace [Converted from hard day - avoiding consecutive hard days]';
    }
  }
}

/**
 * Reduce station volume to safe limits
 */
function fixStationVolume(plan: GeneratedPlan, station: string, maxAllowed: number): void {
  // Find all exercises for this station
  const stationExercises: { day: GeneratedDay; ex: GeneratedExercise }[] = [];

  for (const day of plan.days) {
    for (const ex of day.exercises) {
      const category = categorizeExercise(ex.name);
      if (category.type === 'station' && category.station === station) {
        stationExercises.push({ day, ex });
      }
    }
  }

  if (stationExercises.length === 0) return;

  // Calculate current total and scale factor
  let currentTotal = 0;
  if (station === 'wall_balls') {
    currentTotal = stationExercises.reduce((sum, { ex }) =>
      sum + (ex.reps || 0) * (ex.sets || 1), 0);
  } else if (station === 'burpee_broad_jump') {
    currentTotal = stationExercises.reduce((sum, { ex }) => {
      if (ex.distance_m) return sum + Math.ceil(ex.distance_m / 2);
      return sum + (ex.reps || 0) * (ex.sets || 1);
    }, 0);
  } else if (station === 'sled_push') {
    currentTotal = stationExercises.reduce((sum, { ex }) =>
      sum + (ex.distance_m || 0) * (ex.sets || 1), 0);
  }

  if (currentTotal <= maxAllowed) return;

  const scaleFactor = maxAllowed / currentTotal;

  // Scale down
  for (const { ex } of stationExercises) {
    if (ex.reps) {
      ex.reps = Math.max(5, Math.round(ex.reps * scaleFactor));
    }
    if (ex.distance_m && station !== 'sled_push') {
      ex.distance_m = Math.round(ex.distance_m * scaleFactor);
    }
    if (station === 'sled_push' && ex.sets && ex.sets > 1) {
      ex.sets = Math.max(1, Math.round(ex.sets * scaleFactor));
    }
    ex.notes = `${ex.notes || ''} [Reduced for safe volume]`.trim();
  }
}

/**
 * Reduce session duration by removing lower-priority exercises
 */
function fixSessionDuration(plan: GeneratedPlan, dayNumber: number, maxDuration: number): void {
  const day = plan.days.find(d => d.day_number === dayNumber);
  if (!day || day.duration_minutes <= maxDuration) return;

  // Sort exercises by priority (running and Hyrox stations are high priority)
  const prioritizedExercises = day.exercises.map(ex => {
    const category = categorizeExercise(ex.name);
    let priority = 2; // Default medium priority

    // High priority: running, Hyrox stations
    if (category.type === 'running' || category.type === 'station') {
      priority = 3;
    }
    // Low priority: accessory work, mobility
    if (category.type === 'strength') {
      const name = ex.name.toLowerCase();
      if (name.includes('curl') || name.includes('extension') ||
          name.includes('raise') || name.includes('calf')) {
        priority = 1;
      }
    }

    return { ex, priority };
  });

  // Remove lowest priority exercises until under limit
  const excessMinutes = day.duration_minutes - maxDuration;
  let removedMinutes = 0;

  // Sort by priority (ascending, so lowest priority first)
  prioritizedExercises.sort((a, b) => a.priority - b.priority);

  for (const { ex } of prioritizedExercises) {
    if (removedMinutes >= excessMinutes) break;

    // Estimate time for this exercise
    const estimatedMinutes = ex.duration_minutes ||
      (ex.sets ? ex.sets * 2 : 5); // ~2 min per set or 5 min default

    // Remove the exercise
    const index = day.exercises.indexOf(ex);
    if (index !== -1) {
      day.exercises.splice(index, 1);
      removedMinutes += estimatedMinutes;
    }
  }

  // Update duration
  day.duration_minutes = Math.max(
    HARD_SAFETY_CAPS.minSessionDurationMinutes,
    day.duration_minutes - removedMinutes
  );
}

// =============================================================================
// REGENERATION FEEDBACK
// =============================================================================

/**
 * Generate feedback for regeneration attempt
 */
export function generateRegenerationFeedback(
  validationResult: ValidationResult,
): string {
  const lines: string[] = [
    'The previous plan had the following issues that must be fixed:',
    '',
  ];

  for (const issue of validationResult.issues) {
    const prefix = issue.type === 'error' ? '❌ ERROR' : '⚠️ WARNING';
    lines.push(`${prefix}: ${issue.message}`);
  }

  lines.push('');
  lines.push('Please regenerate the plan addressing ALL of these issues.');
  lines.push('');

  // Add specific guidance
  if (validationResult.calculatedVolumes.runningKm < 10) {
    lines.push('Specific guidance: Add more running sessions. Running should be 60% of training focus.');
  }

  if (validationResult.calculatedVolumes.stationsMissing.length > 0) {
    lines.push(`Specific guidance: Make sure to include: ${validationResult.calculatedVolumes.stationsMissing.join(', ')}`);
  }

  return lines.join('\n');
}

// =============================================================================
// FULL VALIDATION WORKFLOW
// =============================================================================

export interface GenerationResult {
  success: boolean;
  plan?: GeneratedPlan;
  validationResult?: ValidationResult;
  error?: {
    type: 'validation_failed' | 'auto_fix_failed' | 'parse_error';
    message: string;
    regenerationFeedback?: string;
  };
}

/**
 * Full validation workflow with auto-fix attempt
 */
export function validateAndFix(
  plan: GeneratedPlan,
  constraints: ValidationConstraints,
): GenerationResult {
  // First validation pass
  const firstValidation = validateHyroxPlan(plan, constraints);

  // If valid, return immediately
  if (firstValidation.valid) {
    return {
      success: true,
      plan,
      validationResult: firstValidation,
    };
  }

  // Check if any issues are auto-fixable
  const hasAutoFixable = firstValidation.issues.some(i => i.autoFixable);

  if (hasAutoFixable) {
    // Attempt auto-fix
    const fixedPlan = autoFixPlan(plan, firstValidation.issues);

    // Re-validate
    const secondValidation = validateHyroxPlan(fixedPlan, constraints);

    if (secondValidation.valid) {
      return {
        success: true,
        plan: fixedPlan,
        validationResult: secondValidation,
      };
    }

    // Auto-fix didn't fully resolve issues
    return {
      success: false,
      plan: fixedPlan,
      validationResult: secondValidation,
      error: {
        type: 'auto_fix_failed',
        message: 'Auto-fix could not resolve all issues',
        regenerationFeedback: generateRegenerationFeedback(secondValidation),
      },
    };
  }

  // No auto-fixable issues, need regeneration
  return {
    success: false,
    plan,
    validationResult: firstValidation,
    error: {
      type: 'validation_failed',
      message: 'Plan failed validation',
      regenerationFeedback: generateRegenerationFeedback(firstValidation),
    },
  };
}

// =============================================================================
// JSON PARSING WITH VALIDATION
// =============================================================================

/**
 * Parse LLM output and validate
 */
export function parseAndValidate(
  llmOutput: string,
  constraints: ValidationConstraints,
): GenerationResult {
  // Try to parse JSON
  let plan: GeneratedPlan;

  try {
    // Remove any markdown code fences if present
    let cleanOutput = llmOutput.trim();
    if (cleanOutput.startsWith('```json')) {
      cleanOutput = cleanOutput.slice(7);
    }
    if (cleanOutput.startsWith('```')) {
      cleanOutput = cleanOutput.slice(3);
    }
    if (cleanOutput.endsWith('```')) {
      cleanOutput = cleanOutput.slice(0, -3);
    }

    plan = JSON.parse(cleanOutput);
  } catch (e) {
    return {
      success: false,
      error: {
        type: 'parse_error',
        message: `Failed to parse LLM output as JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
      },
    };
  }

  // Validate parsed plan
  return validateAndFix(plan, constraints);
}
