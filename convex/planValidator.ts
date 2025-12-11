/**
 * PLAN VALIDATOR - Runtime Validation
 *
 * Validates AI-generated plans to ensure they follow ALL rules.
 * This runs BEFORE saving plans to the database.
 *
 * Purpose: Catch and reject invalid plans from AI
 */

import { METRICS_TEMPLATES } from "./metricsTemplateReference";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════
// Type-safe interfaces for validation (matching types.ts but looser for AI output)
// ═══════════════════════════════════════════════════════════

// All possible fields that can appear in a metrics template from AI
interface MetricsTemplateFields {
  type: string;
  // Sets/Reps fields
  target_sets?: number | null;
  sets?: number | null;
  target_reps?: string | number | null;
  reps_per_set?: (string | number)[];
  // Duration fields (AI sometimes returns strings like "30 each side")
  duration_seconds?: number | string | null;
  target_duration_s?: number | string | null;
  target_duration_seconds?: number | string | null;
  hold_seconds?: number | string | null;
  duration_minutes?: number | string | null;
  target_duration_minutes?: number | string | null;
  // Distance fields
  distance_km?: number | null;
  distance_m?: number | null;
  target_distance_km?: number | null;
  target_distance_m?: number | null;
  // Rest fields
  rest_period_s?: number | null;
  rest_seconds?: number | null;
  rest_duration_s?: number | null;
  target_rest_s?: number | null;
  work_duration_s?: number | null;
  // Weight fields
  target_weight?: number | null;
  weight_unit?: string | null;
  one_rep_max_percentage?: string | null;
  // Tempo fields
  target_tempo?: string | null;
  tempo_eccentric?: number | null;
  tempo_pause?: number | null;
  tempo_concentric?: number | null;
  tempo_top?: number | null;
  // Other fields
  incline?: string | null;
  speed?: string | null;
  resistance?: string | null;
  pulse_target?: string | null;
  has_drop_set?: boolean;
  rpe?: number | string | null;
  notes?: string | null;
}

interface Exercise {
  exercise_name: string;
  category: string;
  metrics_template: MetricsTemplateFields;
  notes?: string | null;
  rpe?: string | null;
  original_exercise_name?: string;
}

interface Block {
  type: string;
  exercises: Exercise[];
  title?: string;
  notes?: string;
  rounds?: number;
  duration_minutes?: number;
}

interface Session {
  session_name: string;
  time_of_day: string;
  blocks: Block[];
  estimated_duration?: number;
}

interface Day {
  day_of_week: number;
  focus: string;
  blocks?: Block[];
  sessions?: Session[];
  notes?: string;
  estimated_duration?: number;
}

interface Plan {
  name: string;
  weeklyPlan: Day[];
  periodization?: {
    total_weeks?: number;
    current_week?: number;
    phase?: string;
    phase_description?: string;
  };
  dailyRoutine?: {
    focus: string;
    notes?: string;
    exercises: Exercise[];
  };
}

/**
 * Validate complete workout plan
 */
export function validateWorkoutPlan(plan: Plan): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic structure validation
  if (!plan.name || plan.name.trim() === '') {
    errors.push('Plan must have a name');
  }

  if (!plan.weeklyPlan || !Array.isArray(plan.weeklyPlan)) {
    errors.push('Plan must have weeklyPlan array');
    return { valid: false, errors, warnings };
  }

  if (plan.weeklyPlan.length === 0) {
    errors.push('weeklyPlan cannot be empty');
    return { valid: false, errors, warnings };
  }

  if (plan.weeklyPlan.length !== 7) {
    errors.push(`weeklyPlan must have exactly 7 days (found ${plan.weeklyPlan.length})`);
  }

  // Validate each day
  plan.weeklyPlan.forEach((day, dayIndex) => {
    validateDay(day, dayIndex, errors, warnings);
  });

  // ═══════════════════════════════════════════════════════════
  // REST DAY DISTRIBUTION VALIDATION
  // ═══════════════════════════════════════════════════════════
  validateRestDayDistribution(plan.weeklyPlan, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate rest day distribution - ensure rest days are spread throughout the week
 * Rest days clustered at weekends (Sat+Sun together) is bad programming
 */
function validateRestDayDistribution(weeklyPlan: Day[], warnings: string[]): void {
  // Identify which days are rest days (day_of_week: 1=Mon, 7=Sun)
  const restDayIndices: number[] = [];
  const workoutDayIndices: number[] = [];

  weeklyPlan.forEach((day) => {
    const isRestDay =
      day.focus?.toLowerCase().includes('rest') ||
      day.focus?.toLowerCase().includes('recovery') ||
      day.focus?.toLowerCase().includes('off') ||
      (!day.blocks || day.blocks.length === 0) && (!day.sessions || day.sessions.length === 0);

    if (isRestDay) {
      restDayIndices.push(day.day_of_week);
    } else {
      workoutDayIndices.push(day.day_of_week);
    }
  });

  // Check for "weekend-only" rest pattern (both Sat AND Sun are rest, but no mid-week rest)
  const hasWeekendRest = restDayIndices.includes(6) && restDayIndices.includes(7); // Sat + Sun
  const hasMidWeekRest = restDayIndices.some(d => d >= 2 && d <= 5); // Tue-Fri

  if (hasWeekendRest && !hasMidWeekRest && restDayIndices.length <= 3) {
    warnings.push(
      `REST DAY DISTRIBUTION: Rest days clustered at weekend (Sat+Sun). ` +
      `For better recovery, distribute rest days throughout the week. ` +
      `Consider: Mon-Wed-Fri pattern or include mid-week rest.`
    );
  }

  // Check for too many consecutive workout days (more than 3 in a row is suboptimal)
  const sortedWorkoutDays = [...workoutDayIndices].sort((a, b) => a - b);
  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < sortedWorkoutDays.length; i++) {
    if (sortedWorkoutDays[i] === sortedWorkoutDays[i - 1] + 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  // Also check wrap-around (Sun to Mon)
  if (sortedWorkoutDays.includes(7) && sortedWorkoutDays.includes(1)) {
    // Need to count consecutive at the week boundaries
    let endStreak = 0;
    let startStreak = 0;
    for (let d = 7; sortedWorkoutDays.includes(d); d--) endStreak++;
    for (let d = 1; sortedWorkoutDays.includes(d); d++) startStreak++;
    maxConsecutive = Math.max(maxConsecutive, endStreak + startStreak);
  }

  if (maxConsecutive >= 5) {
    warnings.push(
      `REST DAY DISTRIBUTION: ${maxConsecutive} consecutive workout days detected. ` +
      `This increases injury risk and impairs recovery. ` +
      `Recommend: Insert rest day after every 2-3 training days.`
    );
  }
}

/**
 * Validate a single day
 */
function validateDay(day: Day, dayIndex: number, errors: string[], warnings: string[]): void {
  const dayLabel = `Day ${dayIndex + 1} (${day.focus || 'unnamed'})`;

  // Check day_of_week
  if (typeof day.day_of_week !== 'number' || day.day_of_week < 1 || day.day_of_week > 7) {
    errors.push(`${dayLabel}: day_of_week must be 1-7 (found: ${day.day_of_week})`);
  }

  // Check focus
  if (!day.focus || day.focus.trim() === '') {
    warnings.push(`${dayLabel}: Missing focus description`);
  }

  // Check for blocks OR sessions (not both, not neither)
  const hasBlocks = day.blocks && Array.isArray(day.blocks) && day.blocks.length > 0;
  const hasSessions = day.sessions && Array.isArray(day.sessions) && day.sessions.length > 0;

  if (!hasBlocks && !hasSessions) {
    // Only error if it's not a rest day
    const isRestDay = day.focus?.toLowerCase().includes('rest') ||
                      day.focus?.toLowerCase().includes('recovery') ||
                      day.focus?.toLowerCase().includes('off');

    if (!isRestDay) {
      errors.push(`${dayLabel}: Must have either 'blocks' or 'sessions' array (not a rest day)`);
    }
    return; // Skip further validation for rest days
  }

  if (hasBlocks && hasSessions) {
    errors.push(`${dayLabel}: Cannot have BOTH 'blocks' and 'sessions' - use one or the other`);
  }

  // Validate blocks
  if (hasBlocks && day.blocks) {
    day.blocks.forEach((block, blockIndex) => {
      validateBlock(block, blockIndex, dayLabel, errors, warnings);
    });
  }

  // Validate sessions (2x daily training)
  if (hasSessions && day.sessions) {
    if (day.sessions.length !== 2) {
      warnings.push(`${dayLabel}: sessions array should have exactly 2 sessions for twice-daily training (found ${day.sessions.length})`);
    }

    day.sessions.forEach((session, sessionIndex) => {
      validateSession(session, sessionIndex, dayLabel, errors, warnings);
    });
  }
}

/**
 * Validate a session (for 2x daily training)
 */
function validateSession(session: Session, sessionIndex: number, dayLabel: string, errors: string[], warnings: string[]): void {
  const sessionLabel = `${dayLabel} > Session ${sessionIndex + 1}`;

  // Check required fields
  if (!session.session_name || session.session_name.trim() === '') {
    errors.push(`${sessionLabel}: Missing session_name`);
  }

  if (!session.time_of_day) {
    errors.push(`${sessionLabel}: Missing time_of_day`);
  } else if (session.time_of_day !== 'morning' && session.time_of_day !== 'evening') {
    warnings.push(`${sessionLabel}: time_of_day should be 'morning' or 'evening' (found: ${session.time_of_day})`);
  }

  if (!session.blocks || !Array.isArray(session.blocks) || session.blocks.length === 0) {
    errors.push(`${sessionLabel}: Must have blocks array with at least one block`);
    return;
  }

  // Validate blocks within session
  session.blocks.forEach((block, blockIndex) => {
    validateBlock(block, blockIndex, sessionLabel, errors, warnings);
  });
}

/**
 * Validate a workout block
 */
function validateBlock(block: Block, blockIndex: number, parentLabel: string, errors: string[], warnings: string[]): void {
  const blockLabel = `${parentLabel} > Block ${blockIndex + 1}`;

  // Check block type
  const validBlockTypes = ['single', 'superset', 'amrap', 'circuit', 'emom'];
  if (!block.type) {
    errors.push(`${blockLabel}: Missing 'type' field`);
  } else if (!validBlockTypes.includes(block.type)) {
    errors.push(`${blockLabel}: Invalid block type '${block.type}' (must be: ${validBlockTypes.join(', ')})`);
  }

  // Check exercises
  if (!block.exercises || !Array.isArray(block.exercises) || block.exercises.length === 0) {
    errors.push(`${blockLabel}: Must have exercises array with at least one exercise`);
    return;
  }

  // Validate each exercise
  block.exercises.forEach((exercise, exerciseIndex) => {
    validateExercise(exercise, exerciseIndex, blockLabel, errors, warnings);
  });

  // Block-specific validation
  if (block.type === 'superset' || block.type === 'circuit') {
    if (!block.rounds || typeof block.rounds !== 'number' || block.rounds < 1) {
      errors.push(`${blockLabel}: ${block.type} must have 'rounds' field (number >= 1)`);
    }
  }

  if (block.type === 'amrap' || block.type === 'emom') {
    if (!block.duration_minutes || typeof block.duration_minutes !== 'number' || block.duration_minutes < 1) {
      errors.push(`${blockLabel}: ${block.type} must have 'duration_minutes' field (number >= 1)`);
    }
  }
}

// Cardio exercises that should NEVER use sets_reps_weight
const CARDIO_EXERCISE_KEYWORDS = [
  // Cardio machines
  'elliptical', 'treadmill', 'bike', 'cycling', 'rowing', 'rower',
  'stairmaster', 'stepper', 'stair climber', 'stairclimber', 'stairs',
  'stationary bike', 'recumbent bike', 'spin', 'spinning', 'peloton',
  'ski erg', 'skierg', 'assault bike', 'airbike', 'air bike', 'airdyne', 'echo bike',
  'cross trainer', 'arc trainer', 'jacob\'s ladder', 'versaclimber',
  // Running/walking
  'cardio', 'run', 'running', 'jog', 'jogging', 'walk', 'walking', 'sprint', 'sprinting',
  'incline walk', 'power walk', 'steady state',
  // Swimming
  'swim', 'swimming', 'lap swim', 'laps', 'pool',
  // Jump rope
  'jump rope', 'skipping', 'rope work',
  // Descriptors that indicate cardio
  'moderate intensity', 'low intensity', 'high intensity',
  'zone 2', 'zone2', 'liss', 'hiit session', 'conditioning'
];

/**
 * Check if an exercise is a cardio exercise based on its name
 */
function isCardioExercise(exerciseName: string): boolean {
  const lowerName = exerciseName.toLowerCase();
  return CARDIO_EXERCISE_KEYWORDS.some(keyword => lowerName.includes(keyword));
}

/**
 * Validate a single exercise - MOST CRITICAL VALIDATION
 */
function validateExercise(exercise: Exercise, exerciseIndex: number, blockLabel: string, errors: string[], warnings: string[]): void {
  const exerciseLabel = `${blockLabel} > Exercise ${exerciseIndex + 1} (${exercise.exercise_name || 'unnamed'})`;

  // Check exercise name
  if (!exercise.exercise_name || exercise.exercise_name.trim() === '') {
    errors.push(`${exerciseLabel}: Missing exercise_name`);
  }

  // Check category
  const validCategories = ['warmup', 'main', 'cooldown'];
  if (!exercise.category) {
    errors.push(`${exerciseLabel}: Missing 'category' field`);
  } else if (!validCategories.includes(exercise.category)) {
    errors.push(`${exerciseLabel}: Invalid category '${exercise.category}' (must be: ${validCategories.join(', ')})`);
  }

  // ═══════════════════════════════════════════════════════════
  // CRITICAL: Metrics Template Validation
  // ═══════════════════════════════════════════════════════════

  if (!exercise.metrics_template) {
    errors.push(`${exerciseLabel}: MISSING metrics_template - this is MANDATORY!`);
    return;
  }

  if (typeof exercise.metrics_template !== 'object') {
    errors.push(`${exerciseLabel}: metrics_template must be an object`);
    return;
  }

  const template = exercise.metrics_template;

  // Check 'type' field
  if (!template.type) {
    errors.push(`${exerciseLabel}: metrics_template missing 'type' field - MUST specify template type!`);
    return;
  }

  // Validate against known templates
  const validTemplateTypes = Object.keys(METRICS_TEMPLATES);
  if (!validTemplateTypes.includes(template.type)) {
    errors.push(`${exerciseLabel}: Invalid metrics template type '${template.type}'. Must be one of: ${validTemplateTypes.join(', ')}`);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // Cardio exercises should use duration_only or distance_time
  // BUT: fixCardioTemplates() auto-fixes this before validation,
  // so we only WARN here (don't fail the entire plan for this)
  // ═══════════════════════════════════════════════════════════
  if (exercise.exercise_name && isCardioExercise(exercise.exercise_name)) {
    const validCardioTemplates = ['duration_only', 'distance_time', 'sets_duration_rest'];
    if (!validCardioTemplates.includes(template.type)) {
      // Downgraded from ERROR to WARNING since fixCardioTemplates handles this
      warnings.push(
        `${exerciseLabel}: Cardio exercise "${exercise.exercise_name}" using '${template.type}' ` +
        `(prefer 'duration_only' or 'distance_time' for cardio)`
      );
    }
  }

  // Get template definition
  const templateDef = METRICS_TEMPLATES[template.type];

  // Check required fields
  templateDef.requiredFields.forEach(field => {
    if (template[field] === undefined || template[field] === null) {
      errors.push(`${exerciseLabel}: metrics_template type '${template.type}' requires field '${field}' (currently missing or null)`);
    }
  });

  // Type-specific validation
  if (template.type === 'duration_only') {
    // Accept both field names: duration_minutes OR target_duration_minutes
    let durationMin = template.duration_minutes ?? template.target_duration_minutes;
    // Handle string values - extract the number
    if (typeof durationMin === 'string') {
      const numMatch = durationMin.match(/(\d+)/);
      durationMin = numMatch ? parseInt(numMatch[1], 10) : null;
    }
    // Special case: "Complete Rest" or "Rest" exercises don't need a valid duration
    const exerciseName = (exercise.exercise_name || '').toLowerCase();
    const isRestExercise = exerciseName.includes('rest') || exerciseName.includes('recovery');
    if (!isRestExercise && (typeof durationMin !== 'number' || durationMin <= 0)) {
      errors.push(`${exerciseLabel}: duration_only requires duration_minutes to be a positive number`);
    }
  }

  if (template.type === 'sets_reps_weight' || template.type === 'sets_reps') {
    if (typeof template.target_sets !== 'number' || template.target_sets <= 0) {
      errors.push(`${exerciseLabel}: ${template.type} requires target_sets to be a positive number`);
    }
    // target_reps can be number or string (range like "8-10")
    if (template.target_reps === undefined || template.target_reps === null) {
      errors.push(`${exerciseLabel}: ${template.type} requires target_reps`);
    }
  }

  if (template.type === 'sets_duration') {
    if (typeof template.target_sets !== 'number' || template.target_sets <= 0) {
      errors.push(`${exerciseLabel}: sets_duration requires target_sets to be a positive number`);
    }
    // Accept multiple field names: duration_seconds, target_duration_s, target_duration_seconds, hold_seconds
    let durationSec = template.duration_seconds ?? template.target_duration_s ?? template.target_duration_seconds ?? template.hold_seconds;
    // Handle string values like "30 each side" - extract the number
    if (typeof durationSec === 'string') {
      const numMatch = durationSec.match(/(\d+)/);
      durationSec = numMatch ? parseInt(numMatch[1], 10) : null;
    }
    if (typeof durationSec !== 'number' || durationSec <= 0) {
      errors.push(`${exerciseLabel}: sets_duration requires duration_seconds to be a positive number`);
    }
  }

  if (template.type === 'sets_duration_rest') {
    // Accept both field names: sets OR target_sets
    const sets = template.sets ?? template.target_sets;
    if (typeof sets !== 'number' || sets <= 0) {
      errors.push(`${exerciseLabel}: sets_duration_rest requires sets to be a positive number`);
    }
    // Accept both field names: duration_seconds OR work_duration_s
    const durationSec = template.duration_seconds ?? template.work_duration_s;
    if (typeof durationSec !== 'number' || durationSec <= 0) {
      errors.push(`${exerciseLabel}: sets_duration_rest requires duration_seconds to be a positive number`);
    }
    // Accept both field names: rest_seconds OR rest_duration_s
    const restSec = template.rest_seconds ?? template.rest_duration_s;
    if (typeof restSec !== 'number' || restSec < 0) {
      errors.push(`${exerciseLabel}: sets_duration_rest requires rest_seconds to be a non-negative number`);
    }
  }

  if (template.type === 'distance_time') {
    const hasKm = template.distance_km !== undefined && template.distance_km !== null;
    const hasMeters = template.distance_m !== undefined && template.distance_m !== null;

    if (!hasKm && !hasMeters) {
      errors.push(`${exerciseLabel}: distance_time requires either distance_km OR distance_m`);
    }
    if (hasKm && hasMeters) {
      warnings.push(`${exerciseLabel}: distance_time has BOTH distance_km and distance_m - use only one`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // NEW: Validation for sets_duration_weight (weighted carries)
  // ═══════════════════════════════════════════════════════════
  if (template.type === 'sets_duration_weight') {
    const sets = template.target_sets ?? template.sets;
    if (typeof sets !== 'number' || sets <= 0) {
      errors.push(`${exerciseLabel}: sets_duration_weight requires target_sets to be a positive number`);
    }
    const durationSec = template.duration_seconds ?? template.target_duration_s;
    if (typeof durationSec !== 'number' || durationSec <= 0) {
      errors.push(`${exerciseLabel}: sets_duration_weight requires duration_seconds to be a positive number`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // NEW: Validation for tempo (controlled tempo exercises)
  // ═══════════════════════════════════════════════════════════
  if (template.type === 'tempo') {
    if (typeof template.target_sets !== 'number' || template.target_sets <= 0) {
      errors.push(`${exerciseLabel}: tempo requires target_sets to be a positive number`);
    }
    if (template.target_reps === undefined || template.target_reps === null) {
      errors.push(`${exerciseLabel}: tempo requires target_reps`);
    }
    // Tempo fields are optional but warn if none are provided
    const hasTempo = template.tempo_eccentric !== undefined ||
                     template.tempo_pause !== undefined ||
                     template.tempo_concentric !== undefined ||
                     template.tempo_top !== undefined ||
                     template.target_tempo !== undefined;
    if (!hasTempo) {
      warnings.push(`${exerciseLabel}: tempo exercise should have tempo fields (tempo_eccentric, tempo_pause, tempo_concentric, tempo_top) or target_tempo`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // NEW: Validation for sets_distance_rest (distance intervals)
  // ═══════════════════════════════════════════════════════════
  if (template.type === 'sets_distance_rest') {
    const sets = template.sets ?? template.target_sets;
    if (typeof sets !== 'number' || sets <= 0) {
      errors.push(`${exerciseLabel}: sets_distance_rest requires sets to be a positive number`);
    }
    const restSec = template.rest_seconds ?? template.target_rest_s ?? template.rest_period_s;
    if (typeof restSec !== 'number' || restSec < 0) {
      errors.push(`${exerciseLabel}: sets_distance_rest requires rest_seconds to be a non-negative number`);
    }
    const hasDistance = (template.distance_km !== undefined && template.distance_km !== null) ||
                        (template.distance_m !== undefined && template.distance_m !== null) ||
                        (template.target_distance_m !== undefined && template.target_distance_m !== null);
    if (!hasDistance) {
      warnings.push(`${exerciseLabel}: sets_distance_rest should have distance_km, distance_m, or target_distance_m`);
    }
  }
}

/**
 * Validate and provide helpful error messages
 */
export function validateAndExplain(plan: Plan): { valid: boolean; message: string } {
  const result = validateWorkoutPlan(plan);

  if (result.valid) {
    return {
      valid: true,
      message: 'Plan validation passed! All exercises have correct metrics templates.',
    };
  }

  let message = '🚨 PLAN VALIDATION FAILED\n\n';
  message += `Found ${result.errors.length} error(s):\n\n`;

  result.errors.forEach((error, index) => {
    message += `${index + 1}. ${error}\n`;
  });

  if (result.warnings.length > 0) {
    message += `\n⚠️  ${result.warnings.length} warning(s):\n\n`;
    result.warnings.forEach((warning, index) => {
      message += `${index + 1}. ${warning}\n`;
    });
  }

  return {
    valid: false,
    message,
  };
}

/**
 * Auto-fix cardio exercises that incorrectly use sets_reps_weight
 * Changes them to duration_only with a sensible duration based on context
 *
 * Also fixes metrics templates with missing required fields:
 * - sets_distance_rest: adds default sets (4) and rest_seconds (90)
 * - sets_duration_rest: adds default sets, duration_seconds, rest_seconds
 */
export function fixCardioTemplates(plan: Plan, sessionDurationMinutes?: number): Plan {
  const fixedPlan = JSON.parse(JSON.stringify(plan)); // Deep clone

  const processExercises = (exercises: Exercise[]) => {
    exercises.forEach(exercise => {
      if (!exercise.exercise_name || !exercise.metrics_template) return;

      const template = exercise.metrics_template;

      // ═══════════════════════════════════════════════════════════
      // FIX 1: sets_distance_rest missing required fields
      // Common issue with Sled Push/Pull and track sprints
      // ═══════════════════════════════════════════════════════════
      if (template.type === 'sets_distance_rest') {
        let wasFixed = false;

        // Add missing 'sets' field (default 4 sets)
        const hasSets = template.sets !== undefined || template.target_sets !== undefined;
        if (!hasSets) {
          template.sets = 4;
          wasFixed = true;
        }

        // Add missing 'rest_seconds' field (default 90s)
        const hasRest = template.rest_seconds !== undefined ||
                        template.target_rest_s !== undefined ||
                        template.rest_period_s !== undefined;
        if (!hasRest) {
          template.rest_seconds = 90;
          wasFixed = true;
        }

        // Add missing distance if not present (default 50m for sled work)
        const hasDistance = template.distance_km !== undefined ||
                           template.distance_m !== undefined ||
                           template.target_distance_m !== undefined;
        if (!hasDistance) {
          template.distance_m = 50;
          wasFixed = true;
        }

        if (wasFixed) {
          console.log(`[planValidator] Fixed sets_distance_rest for "${exercise.exercise_name}": added missing fields (sets: ${template.sets}, distance_m: ${template.distance_m}, rest_seconds: ${template.rest_seconds})`);
        }
      }

      // ═══════════════════════════════════════════════════════════
      // FIX 2: sets_duration_rest missing required fields
      // Common issue with interval training exercises
      // ═══════════════════════════════════════════════════════════
      if (template.type === 'sets_duration_rest') {
        let wasFixed = false;

        // Add missing 'sets' field (default 6 sets for intervals)
        const hasSets = template.sets !== undefined || template.target_sets !== undefined;
        if (!hasSets) {
          template.sets = 6;
          wasFixed = true;
        }

        // Add missing 'duration_seconds' / 'work_duration_s' (default 30s work)
        const hasDuration = template.duration_seconds !== undefined || template.work_duration_s !== undefined;
        if (!hasDuration) {
          template.duration_seconds = 30;
          wasFixed = true;
        }

        // Add missing 'rest_seconds' / 'rest_duration_s' (default 60s rest)
        const hasRest = template.rest_seconds !== undefined || template.rest_duration_s !== undefined;
        if (!hasRest) {
          template.rest_seconds = 60;
          wasFixed = true;
        }

        if (wasFixed) {
          console.log(`[planValidator] Fixed sets_duration_rest for "${exercise.exercise_name}": added missing fields (sets: ${template.sets}, duration: ${template.duration_seconds}s, rest: ${template.rest_seconds}s)`);
        }
      }

      // ═══════════════════════════════════════════════════════════
      // FIX 3: Cardio exercises with wrong template (original logic)
      // ═══════════════════════════════════════════════════════════
      if (isCardioExercise(exercise.exercise_name)) {
        // If using sets_reps_weight or sets_reps for cardio, fix it
        if (template.type === 'sets_reps_weight' || template.type === 'sets_reps') {
          // Calculate a sensible duration
          // If there's a session duration, use proportional time
          // Otherwise default to 20 minutes
          let durationMinutes = 20;

          if (sessionDurationMinutes) {
            // For cardio-focused sessions, cardio should be the bulk (e.g., 45 min of 60)
            // For hybrid sessions, cardio is typically 15-30 min
            if (sessionDurationMinutes >= 45) {
              durationMinutes = Math.min(45, sessionDurationMinutes - 15);
            } else {
              durationMinutes = Math.min(20, sessionDurationMinutes - 10);
            }
          }

          // Replace the template
          exercise.metrics_template = {
            type: 'duration_only',
            duration_minutes: durationMinutes,
          };

          console.log(`[planValidator] Fixed cardio template for "${exercise.exercise_name}": sets_reps_weight → duration_only (${durationMinutes} min)`);
        }
      }
    });
  };

  const processBlocks = (blocks: Block[]) => {
    blocks.forEach(block => {
      if (block.exercises && Array.isArray(block.exercises)) {
        processExercises(block.exercises);
      }
    });
  };

  // Process all days
  fixedPlan.weeklyPlan.forEach((day: Day) => {
    // Handle blocks directly on day
    if (day.blocks && Array.isArray(day.blocks)) {
      processBlocks(day.blocks);
    }

    // Handle sessions (2x daily)
    if (day.sessions && Array.isArray(day.sessions)) {
      day.sessions.forEach((session: Session) => {
        if (session.blocks && Array.isArray(session.blocks)) {
          processBlocks(session.blocks);
        }
      });
    }
  });

  return fixedPlan;
}
