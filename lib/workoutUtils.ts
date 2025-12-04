import { PlanDay, PlanExercise } from '../types';

/**
 * Calculate workout intensity based on RPE and exercise count
 */
export function calculateWorkoutIntensity(day: PlanDay): {
  level: 'High' | 'Moderate' | 'Light';
  value: number; // 0-100
  color: string;
  gradient: string;
} {
  // Get exercises from blocks (single session) or sessions (2x daily)
  let exercises: PlanExercise[] = [];

  // Single session: day.blocks
  if (day.blocks && Array.isArray(day.blocks)) {
    exercises = day.blocks.flatMap(b => Array.isArray(b.exercises) ? b.exercises : []);
  }

  // 2x daily: day.sessions[].blocks[].exercises
  const sessions = (day as any).sessions;
  if ((!exercises.length) && sessions && Array.isArray(sessions)) {
    exercises = sessions.flatMap((s: any) =>
      (s.blocks || []).flatMap((b: any) =>
        Array.isArray(b.exercises) ? b.exercises : []
      )
    );
  }

  if (exercises.length === 0) {
    return {
      level: 'Light',
      value: 0,
      color: 'accent-recovery',
      gradient: 'gradient-recovery'
    };
  }

  // Calculate average RPE (handles string or number)
  const validRPEs = exercises
    .map(ex => {
      if (ex.rpe === null || ex.rpe === undefined) return 5;
      if (typeof ex.rpe === 'number') return ex.rpe;
      const parsed = parseInt(String(ex.rpe), 10);
      return isNaN(parsed) ? 5 : parsed;
    })
    .filter(rpe => !isNaN(rpe) && rpe > 0);

  const avgRPE = validRPEs.length > 0
    ? validRPEs.reduce((sum, rpe) => sum + rpe, 0) / validRPEs.length
    : 5;

  // Factor in volume (exercise count)
  const volumeFactor = Math.min(exercises.length / 8, 1); // Normalize to 0-1
  const intensity = (avgRPE / 10) * 0.7 + volumeFactor * 0.3; // Weighted average

  const value = Math.round(intensity * 100);

  if (avgRPE >= 8 || value >= 75) {
    return {
      level: 'High',
      value,
      color: 'accent-strength',
      gradient: 'gradient-strength'
    };
  }

  if (avgRPE >= 6 || value >= 50) {
    return {
      level: 'Moderate',
      value,
      color: 'accent',
      gradient: 'gradient-accent'
    };
  }

  return {
    level: 'Light',
    value,
    color: 'accent-recovery',
    gradient: 'gradient-recovery'
  };
}

/**
 * Get workout type based on focus and exercises
 */
export function getWorkoutType(day: PlanDay): 'strength' | 'cardio' | 'mobility' | 'mixed' {
  const focus = (day.focus || (day as any).session_name || '').toLowerCase();

  if (focus.includes('cardio') || focus.includes('run') || focus.includes('endurance')) {
    return 'cardio';
  }

  if (focus.includes('mobility') || focus.includes('stretch') || focus.includes('yoga')) {
    return 'mobility';
  }

  if (focus.includes('strength') || focus.includes('power') || focus.includes('lift')) {
    return 'strength';
  }

  return 'mixed';
}

/**
 * Format elapsed time from start date
 */
export function formatElapsedTime(startTime: Date): string {
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Estimate calories burned using a simple MET-based formula.
 * calories = MET * 3.5 * weight_kg / 200 * duration_minutes
 * Defaults: weight 70kg, MET derived from workout type + intensity (0-100)
 */
export function estimateCalories(
  durationMinutes: number,
  intensity: number,
  weightKg: number = 70,
  workoutType: 'strength' | 'cardio' | 'mobility' | 'mixed' = 'mixed'
): number {
  // Map workout type + intensity to a MET range
  const intensityClamp = Math.max(0, Math.min(intensity, 100));
  const ramp = (min: number, max: number) =>
    min + ((max - min) * intensityClamp) / 100;

  let met = 6; // default mixed
  if (workoutType === 'cardio') {
    met = ramp(6, 10); // moderate to vigorous cardio
  } else if (workoutType === 'strength') {
    met = ramp(4, 8); // moderate to heavy lifting
  } else if (workoutType === 'mobility') {
    met = ramp(3, 4); // light mobility/yoga
  } else {
    met = ramp(5, 7); // mixed circuits
  }

  const calories = (met * 3.5 * weightKg * durationMinutes) / 200;
  return Math.round(calories);
}

/**
 * Exercise categories for weight suggestion mapping
 */
const EXERCISE_STRENGTH_MAPPING: Record<string, {
  baseExercise: 'squat' | 'bench' | 'deadlift' | 'row' | 'overhead_press';
  multiplier: number;
}> = {
  // Squat variations
  'barbell back squat': { baseExercise: 'squat', multiplier: 1.0 },
  'back squat': { baseExercise: 'squat', multiplier: 1.0 },
  'squat': { baseExercise: 'squat', multiplier: 1.0 },
  'front squat': { baseExercise: 'squat', multiplier: 0.80 },
  'goblet squat': { baseExercise: 'squat', multiplier: 0.35 },
  'bulgarian split squat': { baseExercise: 'squat', multiplier: 0.40 },
  'leg press': { baseExercise: 'squat', multiplier: 1.5 },
  'hack squat': { baseExercise: 'squat', multiplier: 0.90 },
  'lunges': { baseExercise: 'squat', multiplier: 0.35 },
  'walking lunges': { baseExercise: 'squat', multiplier: 0.30 },
  'step ups': { baseExercise: 'squat', multiplier: 0.30 },

  // Bench variations
  'bench press': { baseExercise: 'bench', multiplier: 1.0 },
  'barbell bench press': { baseExercise: 'bench', multiplier: 1.0 },
  'flat bench press': { baseExercise: 'bench', multiplier: 1.0 },
  'incline bench press': { baseExercise: 'bench', multiplier: 0.85 },
  'incline barbell bench press': { baseExercise: 'bench', multiplier: 0.85 },
  'decline bench press': { baseExercise: 'bench', multiplier: 1.05 },
  'dumbbell bench press': { baseExercise: 'bench', multiplier: 0.40 }, // per dumbbell
  'dumbbell chest press': { baseExercise: 'bench', multiplier: 0.40 },
  'incline dumbbell press': { baseExercise: 'bench', multiplier: 0.35 },
  'dumbbell flyes': { baseExercise: 'bench', multiplier: 0.25 },
  'cable flyes': { baseExercise: 'bench', multiplier: 0.20 },
  'push ups': { baseExercise: 'bench', multiplier: 0 }, // bodyweight

  // Deadlift variations
  'deadlift': { baseExercise: 'deadlift', multiplier: 1.0 },
  'barbell deadlift': { baseExercise: 'deadlift', multiplier: 1.0 },
  'conventional deadlift': { baseExercise: 'deadlift', multiplier: 1.0 },
  'sumo deadlift': { baseExercise: 'deadlift', multiplier: 1.0 },
  'romanian deadlift': { baseExercise: 'deadlift', multiplier: 0.70 },
  'rdl': { baseExercise: 'deadlift', multiplier: 0.70 },
  'stiff leg deadlift': { baseExercise: 'deadlift', multiplier: 0.65 },
  'trap bar deadlift': { baseExercise: 'deadlift', multiplier: 1.10 },
  'dumbbell rdl': { baseExercise: 'deadlift', multiplier: 0.30 },
  'good mornings': { baseExercise: 'deadlift', multiplier: 0.40 },
  'hip thrust': { baseExercise: 'deadlift', multiplier: 0.75 },
  'glute bridge': { baseExercise: 'deadlift', multiplier: 0.50 },

  // Row variations
  'barbell row': { baseExercise: 'row', multiplier: 1.0 },
  'bent over row': { baseExercise: 'row', multiplier: 1.0 },
  'pendlay row': { baseExercise: 'row', multiplier: 0.95 },
  'dumbbell row': { baseExercise: 'row', multiplier: 0.50 }, // per dumbbell
  'single arm dumbbell row': { baseExercise: 'row', multiplier: 0.55 },
  'cable row': { baseExercise: 'row', multiplier: 0.85 },
  'seated cable row': { baseExercise: 'row', multiplier: 0.85 },
  't-bar row': { baseExercise: 'row', multiplier: 0.90 },
  'chest supported row': { baseExercise: 'row', multiplier: 0.80 },
  'lat pulldown': { baseExercise: 'row', multiplier: 0.75 },

  // Overhead press variations
  'overhead press': { baseExercise: 'overhead_press', multiplier: 1.0 },
  'barbell overhead press': { baseExercise: 'overhead_press', multiplier: 1.0 },
  'military press': { baseExercise: 'overhead_press', multiplier: 1.0 },
  'standing press': { baseExercise: 'overhead_press', multiplier: 1.0 },
  'shoulder press': { baseExercise: 'overhead_press', multiplier: 1.0 },
  'seated shoulder press': { baseExercise: 'overhead_press', multiplier: 1.05 },
  'dumbbell shoulder press': { baseExercise: 'overhead_press', multiplier: 0.45 },
  'dumbbell overhead press': { baseExercise: 'overhead_press', multiplier: 0.45 },
  'arnold press': { baseExercise: 'overhead_press', multiplier: 0.40 },
  'push press': { baseExercise: 'overhead_press', multiplier: 1.15 },
  'lateral raises': { baseExercise: 'overhead_press', multiplier: 0.15 },
  'front raises': { baseExercise: 'overhead_press', multiplier: 0.15 },
};

/**
 * Suggest a starting weight for an exercise based on user's strength profile
 *
 * @param exerciseName - The name of the exercise
 * @param strengthProfile - User's strength data from onboarding
 * @param targetReps - Target reps for the set (affects weight suggestion)
 * @returns Suggested weight in kg, or null if no suggestion available
 */
export function suggestWeight(
  exerciseName: string,
  strengthProfile: {
    squat_kg?: number;
    bench_kg?: number;
    deadlift_kg?: number;
    row_kg?: number;
    overhead_press_kg?: number;
  } | undefined | null,
  targetReps: number = 10
): number | null {
  if (!strengthProfile) return null;

  const lowerName = exerciseName.toLowerCase().trim();

  // Find matching exercise in our mapping
  const mapping = EXERCISE_STRENGTH_MAPPING[lowerName];
  if (!mapping) {
    // Try partial match
    for (const [key, value] of Object.entries(EXERCISE_STRENGTH_MAPPING)) {
      if (lowerName.includes(key) || key.includes(lowerName)) {
        const baseWeight = getBaseWeight(value.baseExercise, strengthProfile);
        if (baseWeight) {
          return calculateWorkingWeight(baseWeight * value.multiplier, targetReps);
        }
      }
    }
    return null;
  }

  const baseWeight = getBaseWeight(mapping.baseExercise, strengthProfile);
  if (!baseWeight) return null;

  return calculateWorkingWeight(baseWeight * mapping.multiplier, targetReps);
}

function getBaseWeight(
  exercise: 'squat' | 'bench' | 'deadlift' | 'row' | 'overhead_press',
  profile: {
    squat_kg?: number;
    bench_kg?: number;
    deadlift_kg?: number;
    row_kg?: number;
    overhead_press_kg?: number;
  }
): number | null {
  switch (exercise) {
    case 'squat': return profile.squat_kg || null;
    case 'bench': return profile.bench_kg || null;
    case 'deadlift': return profile.deadlift_kg || null;
    case 'row': return profile.row_kg || null;
    case 'overhead_press': return profile.overhead_press_kg || null;
    default: return null;
  }
}

/**
 * Calculate working weight based on estimated 1RM and target reps
 * Uses Brzycki formula reversed
 */
function calculateWorkingWeight(estimatedMax: number, targetReps: number): number {
  // For higher reps, use lower percentage of max
  // Brzycki: 1RM = weight × (36 / (37 - reps))
  // So: weight = 1RM × (37 - reps) / 36
  const repFactor = Math.max(0.5, (37 - targetReps) / 36);
  const weight = estimatedMax * repFactor;

  // Round to nearest 2.5kg for practical gym use
  return Math.round(weight / 2.5) * 2.5;
}
