/**
 * Exercise Mappings for Validation
 *
 * This file provides deterministic exercise categorization for plan validation.
 * Instead of relying on string matching ("find exercises with 'run' in name"),
 * we use explicit pattern matching with exclusions to accurately categorize exercises.
 *
 * Used by: validateHyroxPlan.ts
 */

// =============================================================================
// EXERCISE NAME NORMALIZATION
// =============================================================================

/**
 * LLM-generated exercise names can vary. This map normalizes common variations
 * to canonical names BEFORE categorization. This ensures consistent behavior
 * without fuzzy matching.
 *
 * Format: 'variation' -> 'canonical_name'
 */
const EXERCISE_NAME_ALIASES: Record<string, string> = {
  // SkiErg variations
  'ski erg': 'skierg',
  'ski-erg': 'skierg',
  'ski machine': 'skierg',
  'ski ergometer': 'skierg',
  'concept 2 ski': 'skierg',
  'c2 ski': 'skierg',

  // Sled variations
  'prowler push': 'sled push',
  'sled push sprint': 'sled push',
  'heavy sled push': 'sled push',
  'pushing the sled': 'sled push',
  'rope sled pull': 'sled pull',
  'hand over hand sled pull': 'sled pull',
  'hand-over-hand pull': 'sled pull',
  'pulling sled': 'sled pull',

  // Burpee broad jump variations
  'broad jump burpee': 'burpee broad jump',
  'broad jump burpees': 'burpee broad jump',
  'burpee broad jumps': 'burpee broad jump',
  'bbj': 'burpee broad jump',
  'bbjs': 'burpee broad jump',
  'burpee + broad jump': 'burpee broad jump',

  // Rowing variations
  'row': 'rowing',
  'rower': 'rowing',
  'concept 2 row': 'rowing',
  'c2 row': 'rowing',
  'concept2 row': 'rowing',
  'erg row': 'rowing',
  'rowing machine': 'rowing',
  'indoor rowing': 'rowing',

  // Farmers carry variations
  'farmers walk': 'farmers carry',
  'farmer walk': 'farmers carry',
  'farmer carry': 'farmers carry',
  "farmer's carry": 'farmers carry',
  "farmer's walk": 'farmers carry',
  'kettlebell farmers carry': 'farmers carry',

  // Sandbag lunges variations
  'sandbag lunge': 'sandbag lunges',
  'sb lunge': 'sandbag lunges',
  'sb lunges': 'sandbag lunges',
  'sandbag walking lunge': 'sandbag lunges',
  'sandbag walking lunges': 'sandbag lunges',

  // Wall balls variations
  'wall ball': 'wall balls',
  'wallball': 'wall balls',
  'wallballs': 'wall balls',
  'wall ball shot': 'wall balls',
  'wall ball shots': 'wall balls',
  'wb': 'wall balls',

  // Running variations
  'run': 'running',
  'jog': 'running',
  'jogging': 'running',
  'easy jog': 'easy run',
  'recovery jog': 'recovery run',
  'steady run': 'easy run',
  'base run': 'easy run',
  'aerobic run': 'easy run',
  'z2 run': 'zone 2 run',
  'zone2 run': 'zone 2 run',

  // Deadlift variations
  'dl': 'deadlift',
  'conventional deadlift': 'deadlift',
  'sumo deadlift': 'deadlift',
  'trap bar deadlift': 'deadlift',
  'romanian deadlift': 'rdl',
  'stiff leg deadlift': 'rdl',
  'sldl': 'rdl',

  // Squat variations
  'back squat': 'squat',
  'barbell squat': 'squat',
  'bb squat': 'squat',
  'air squat': 'squat',
  'bodyweight squat': 'squat',
  'goblet squat': 'squat',
  'front squat': 'squat',

  // Bench press variations
  'flat bench': 'bench press',
  'barbell bench': 'bench press',
  'bb bench': 'bench press',
  'flat bench press': 'bench press',
  'db bench': 'dumbbell bench press',
  'dumbbell bench': 'dumbbell bench press',

  // Pull-up variations
  'pullup': 'pull-up',
  'pull up': 'pull-up',
  'chin up': 'chin-up',
  'chinup': 'chin-up',
  'strict pull-up': 'pull-up',
  'strict pullup': 'pull-up',

  // Push-up variations
  'pushup': 'push-up',
  'push up': 'push-up',
  'press up': 'push-up',
  'pressup': 'push-up',

  // Overhead press variations
  'ohp': 'overhead press',
  'shoulder press': 'overhead press',
  'military press': 'overhead press',
  'strict press': 'overhead press',
  'standing press': 'overhead press',

  // Kettlebell swing variations
  'kb swing': 'kettlebell swing',
  'kbs': 'kettlebell swing',
  'russian swing': 'kettlebell swing',
  'american swing': 'kettlebell swing',

  // Bike/assault bike variations
  'assault bike': 'air bike',
  'echo bike': 'air bike',
  'airdyne': 'air bike',
  'fan bike': 'air bike',

  // Core exercise variations
  'situp': 'sit-up',
  'sit up': 'sit-up',
  'dead bug': 'deadbug',
  'bird dog': 'birddog',
  'v up': 'v-up',
  'v-ups': 'v-up',
  'toes to bar': 't2b',
  'ttb': 't2b',
  'hanging leg raise': 'leg raise',
  'hanging knee raise': 'knee raise',
};

/**
 * Normalize an exercise name by:
 * 1. Lowercasing
 * 2. Trimming whitespace
 * 3. Removing extra spaces
 * 4. Removing inline metrics (e.g., "500m", "20kg", "10 reps")
 * 5. Applying alias mapping
 *
 * Returns the canonical form of the exercise name.
 */
export function normalizeExerciseName(name: string): string {
  // Basic normalization
  let normalized = name.toLowerCase().trim();

  // Remove inline metrics (numbers followed by units)
  // Handles: 500m, 5km, 20kg, 45lbs, 10 reps, 30min, 60sec, 3x10, x8, etc.
  normalized = normalized
    .replace(/\d+\s*x\s*\d+/gi, '')           // Sets x reps (3x10, 5 x 8)
    .replace(/x\s*\d+/gi, '')                  // x reps (x10, x 8)
    .replace(/\d+\s*(m|km|mi|meters?|kilometers?)\b/gi, '')  // Distance
    .replace(/\d+\s*(kg|kgs?|lbs?|pounds?)\b/gi, '')         // Weight
    .replace(/\d+\s*(reps?|repetitions?)\b/gi, '')           // Reps
    .replace(/\d+\s*(min|mins?|minutes?|sec|secs?|seconds?|s)\b/gi, '') // Time
    .replace(/\d+\s*(sets?)\b/gi, '')          // Sets
    .replace(/@\s*\d+%?/gi, '')                // @ percentages (@80%, @ 70)
    .replace(/\s+/g, ' ')                      // Collapse multiple spaces
    .trim();

  // Check for exact alias match first
  if (EXERCISE_NAME_ALIASES[normalized]) {
    return EXERCISE_NAME_ALIASES[normalized];
  }

  // Check for partial matches (alias is contained in the name)
  // Sort by length descending to match longer aliases first
  const sortedAliases = Object.entries(EXERCISE_NAME_ALIASES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, canonical] of sortedAliases) {
    if (normalized.includes(alias)) {
      // Replace the alias portion with canonical
      normalized = normalized.replace(alias, canonical);
      break; // Only apply one substitution
    }
  }

  return normalized;
}

// =============================================================================
// TYPES
// =============================================================================

export type ExerciseCategory =
  | { type: 'station'; station: HyroxStation }
  | { type: 'running'; subtype?: 'easy' | 'tempo' | 'interval' | 'long' }
  | { type: 'strength'; category: StrengthCategory }
  | { type: 'cardio'; modality: CardioModality }
  | { type: 'mobility' }
  | { type: 'core' }
  | { type: 'warmup' }
  | { type: 'other' };

export type HyroxStation =
  | 'skierg'
  | 'sled_push'
  | 'sled_pull'
  | 'burpee_broad_jump'
  | 'rowing'
  | 'farmers_carry'
  | 'sandbag_lunges'
  | 'wall_balls';

export type StrengthCategory =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_push'
  | 'vertical_pull'
  | 'lunge'
  | 'carry'
  | 'accessory';

export type CardioModality =
  | 'bike'
  | 'swim'
  | 'elliptical'
  | 'stair_climber'
  | 'jump_rope';

interface Exercise {
  name: string;
  metrics_template?: {
    target_distance_km?: number;
    target_distance_m?: number;
    target_duration_minutes?: number;
    target_reps?: number;
    target_sets?: number;
    target_weight_kg?: number;
  };
  intensity_notes?: string;
}

// =============================================================================
// STATION MAPPINGS
// =============================================================================

const STATION_PATTERNS: Record<HyroxStation, { patterns: string[]; excludePatterns?: string[] }> = {
  skierg: {
    patterns: ['skierg', 'ski erg', 'ski-erg', 'ski machine'],
    excludePatterns: ['cross country ski'], // Outdoor skiing is different
  },
  sled_push: {
    patterns: ['sled push', 'prowler push', 'pushing sled'],
    excludePatterns: ['sled pull'], // Make sure we don't match pull
  },
  sled_pull: {
    patterns: ['sled pull', 'rope pull', 'hand-over-hand', 'hand over hand', 'pulling sled'],
    excludePatterns: ['sled push'],
  },
  burpee_broad_jump: {
    patterns: ['burpee broad jump', 'broad jump burpee', 'bbj'],
    // Regular burpees and regular broad jumps are NOT this station
  },
  rowing: {
    patterns: ['row', 'rowing', 'rower', 'erg row', 'concept2', 'c2 row'],
    excludePatterns: ['bent over row', 'barbell row', 'dumbbell row', 'cable row', 'upright row', 't-bar row', 'seated row', 'pendlay row', 'row variation'],
  },
  farmers_carry: {
    patterns: ['farmer', 'farmers carry', 'farmer carry', 'farmers walk', 'farmer walk'],
    excludePatterns: [],
  },
  sandbag_lunges: {
    patterns: ['sandbag lunge', 'sandbag lunges', 'sb lunge', 'sb lunges'],
    // Regular lunges without sandbag specification are strength, not station
  },
  wall_balls: {
    patterns: ['wall ball', 'wallball', 'wall balls', 'wallballs', 'wall ball shot'],
    excludePatterns: ['medicine ball', 'med ball'], // Med ball slams etc are different
  },
};

// =============================================================================
// RUNNING MAPPINGS
// =============================================================================

const RUNNING_PATTERNS = {
  patterns: ['run', 'running', 'jog', 'jogging', 'sprint', 'sprinting'],
  excludePatterns: [
    'burpee', // Burpee broad jumps involve jumping, not running
    'jump',   // Broad jumps
    'sled',   // Sled runs (push/pull)
  ],
  subtypePatterns: {
    easy: ['easy run', 'recovery run', 'zone 2', 'z2', 'conversational'],
    tempo: ['tempo run', 'tempo', 'threshold'],
    interval: ['interval', 'repeat', '1km', '800m', '400m', 'speed work', 'fartlek'],
    long: ['long run', 'lsd', 'long slow distance', 'endurance run'],
  },
};

// =============================================================================
// STRENGTH MAPPINGS
// =============================================================================

const STRENGTH_PATTERNS: Record<StrengthCategory, { patterns: string[]; excludePatterns?: string[] }> = {
  squat: {
    patterns: ['squat', 'leg press', 'hack squat'],
    excludePatterns: ['split squat', 'pistol'], // These are lunges
  },
  hinge: {
    patterns: ['deadlift', 'rdl', 'romanian deadlift', 'hip thrust', 'good morning', 'kettlebell swing', 'kb swing', 'hip hinge', 'glute bridge'],
    excludePatterns: [],
  },
  horizontal_push: {
    patterns: ['bench press', 'bench', 'push-up', 'pushup', 'push up', 'dumbbell press', 'db press', 'floor press', 'chest press'],
    excludePatterns: ['overhead', 'shoulder', 'incline'], // Incline is debatable but closer to vertical
  },
  horizontal_pull: {
    patterns: ['bent over row', 'barbell row', 'dumbbell row', 'db row', 'cable row', 'seated row', 't-bar row', 'pendlay row', 'inverted row'],
    excludePatterns: ['upright row'], // This is more shoulder
  },
  vertical_push: {
    patterns: ['overhead press', 'ohp', 'shoulder press', 'military press', 'push press', 'jerk', 'landmine press', 'arnold press'],
    excludePatterns: [],
  },
  vertical_pull: {
    patterns: ['pull-up', 'pullup', 'pull up', 'chin-up', 'chinup', 'chin up', 'lat pulldown', 'lat pull-down', 'pulldown'],
    excludePatterns: [],
  },
  lunge: {
    patterns: ['lunge', 'split squat', 'bulgarian', 'step up', 'step-up', 'pistol'],
    excludePatterns: ['sandbag'], // Sandbag lunges are station work
  },
  carry: {
    patterns: ['carry', 'walk', 'suitcase'],
    excludePatterns: ['farmer', 'farmers'], // Farmers carry is station work
  },
  accessory: {
    patterns: [
      'curl', 'tricep', 'extension', 'fly', 'flye', 'raise', 'shrug',
      'calf', 'forearm', 'wrist', 'face pull', 'band pull', 'external rotation',
      'internal rotation', 'rotator', 'prehab'
    ],
    excludePatterns: [],
  },
};

// =============================================================================
// OTHER CARDIO MAPPINGS
// =============================================================================

const CARDIO_PATTERNS: Record<CardioModality, string[]> = {
  bike: ['bike', 'cycling', 'cycle', 'assault bike', 'air bike', 'echo bike', 'spin', 'stationary bike'],
  swim: ['swim', 'swimming', 'pool'],
  elliptical: ['elliptical', 'cross trainer'],
  stair_climber: ['stair', 'stairs', 'stairmaster', 'step mill'],
  jump_rope: ['jump rope', 'skipping', 'skip rope', 'double under'],
};

// =============================================================================
// CORE AND MOBILITY MAPPINGS
// =============================================================================

const CORE_PATTERNS = [
  'plank', 'dead bug', 'deadbug', 'bird dog', 'birddog', 'hollow',
  'pallof', 'anti-rotation', 'ab wheel', 'sit-up', 'situp', 'crunch',
  'russian twist', 'leg raise', 'hanging', 'v-up', 'toes to bar',
  'l-sit', 'side plank', 'woodchop', 'cable rotation',
];

const MOBILITY_PATTERNS = [
  'stretch', 'mobility', 'foam roll', 'lacrosse ball', 'yoga',
  'hip circle', '90/90', 'couch stretch', 'pigeon', 'cat cow',
  'thoracic', 'ankle mobility', 'hip opener', 'dynamic stretch',
];

const WARMUP_PATTERNS = [
  'warm-up', 'warmup', 'warm up', 'activation', 'prep',
];

// =============================================================================
// MAIN CATEGORIZATION FUNCTION
// =============================================================================

/**
 * Categorize an exercise by name into a specific type
 * Used for validation to sum volumes, check station coverage, etc.
 *
 * Applies normalization first to handle LLM naming variations.
 */
export function categorizeExercise(exerciseName: string): ExerciseCategory {
  // Normalize the name first to handle LLM variations
  const name = normalizeExerciseName(exerciseName);

  // 1. Check warmup first (usually has "warm" in name)
  if (WARMUP_PATTERNS.some(p => name.includes(p))) {
    return { type: 'warmup' };
  }

  // 2. Check stations (most specific, check first)
  for (const [station, config] of Object.entries(STATION_PATTERNS)) {
    const matchesPattern = config.patterns.some(p => name.includes(p));
    const matchesExclusion = config.excludePatterns?.some(p => name.includes(p)) ?? false;

    if (matchesPattern && !matchesExclusion) {
      return { type: 'station', station: station as HyroxStation };
    }
  }

  // 3. Check running (before general cardio)
  const isRunning = RUNNING_PATTERNS.patterns.some(p => name.includes(p));
  const isExcludedFromRunning = RUNNING_PATTERNS.excludePatterns.some(p => name.includes(p));

  if (isRunning && !isExcludedFromRunning) {
    // Determine subtype
    let subtype: 'easy' | 'tempo' | 'interval' | 'long' | undefined;
    for (const [type, patterns] of Object.entries(RUNNING_PATTERNS.subtypePatterns)) {
      if (patterns.some(p => name.includes(p))) {
        subtype = type as 'easy' | 'tempo' | 'interval' | 'long';
        break;
      }
    }
    return { type: 'running', subtype };
  }

  // 4. Check core exercises
  if (CORE_PATTERNS.some(p => name.includes(p))) {
    return { type: 'core' };
  }

  // 5. Check mobility
  if (MOBILITY_PATTERNS.some(p => name.includes(p))) {
    return { type: 'mobility' };
  }

  // 6. Check strength categories
  for (const [category, config] of Object.entries(STRENGTH_PATTERNS)) {
    const matchesPattern = config.patterns.some(p => name.includes(p));
    const matchesExclusion = config.excludePatterns?.some(p => name.includes(p)) ?? false;

    if (matchesPattern && !matchesExclusion) {
      return { type: 'strength', category: category as StrengthCategory };
    }
  }

  // 7. Check other cardio modalities
  for (const [modality, patterns] of Object.entries(CARDIO_PATTERNS)) {
    if (patterns.some(p => name.includes(p))) {
      return { type: 'cardio', modality: modality as CardioModality };
    }
  }

  // 8. Default to other
  return { type: 'other' };
}

// =============================================================================
// VOLUME EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract running volume in km from an exercise
 * Handles both distance-based and duration-based exercises
 */
export function extractRunningVolumeKm(exercise: Exercise): number {
  const category = categorizeExercise(exercise.name);

  if (category.type !== 'running') {
    return 0;
  }

  const metrics = exercise.metrics_template;
  if (!metrics) return 0;

  // Direct distance
  if (metrics.target_distance_km) {
    return metrics.target_distance_km;
  }

  if (metrics.target_distance_m) {
    return metrics.target_distance_m / 1000;
  }

  // Estimate from duration based on intensity
  if (metrics.target_duration_minutes) {
    const intensity = exercise.intensity_notes?.toLowerCase() || '';
    const subtype = category.subtype;

    // Pace assumptions (minutes per km)
    let pacePerKm: number;

    if (subtype === 'easy' || intensity.includes('easy') || intensity.includes('zone 2')) {
      pacePerKm = 6.5; // Easy pace
    } else if (subtype === 'tempo' || intensity.includes('tempo') || intensity.includes('threshold')) {
      pacePerKm = 5.5; // Tempo pace
    } else if (subtype === 'interval' || intensity.includes('interval') || intensity.includes('repeat')) {
      pacePerKm = 5.0; // Interval pace
    } else if (subtype === 'long' || intensity.includes('long')) {
      pacePerKm = 6.5; // Long run pace (similar to easy)
    } else {
      pacePerKm = 6.0; // Default moderate pace
    }

    return metrics.target_duration_minutes / pacePerKm;
  }

  return 0;
}

/**
 * Extract SkiErg volume in meters from an exercise
 */
export function extractSkiErgVolumeM(exercise: Exercise): number {
  const category = categorizeExercise(exercise.name);

  if (category.type !== 'station' || category.station !== 'skierg') {
    return 0;
  }

  const metrics = exercise.metrics_template;
  if (!metrics) return 0;

  // Direct distance
  if (metrics.target_distance_m) {
    return metrics.target_distance_m * (metrics.target_sets || 1);
  }

  if (metrics.target_distance_km) {
    return metrics.target_distance_km * 1000 * (metrics.target_sets || 1);
  }

  // Estimate from duration (average ~500m per 2 minutes at moderate pace)
  if (metrics.target_duration_minutes) {
    return (metrics.target_duration_minutes / 2) * 500 * (metrics.target_sets || 1);
  }

  return 0;
}

/**
 * Extract rowing volume in meters from an exercise
 */
export function extractRowingVolumeM(exercise: Exercise): number {
  const category = categorizeExercise(exercise.name);

  if (category.type !== 'station' || category.station !== 'rowing') {
    return 0;
  }

  const metrics = exercise.metrics_template;
  if (!metrics) return 0;

  // Direct distance
  if (metrics.target_distance_m) {
    return metrics.target_distance_m * (metrics.target_sets || 1);
  }

  if (metrics.target_distance_km) {
    return metrics.target_distance_km * 1000 * (metrics.target_sets || 1);
  }

  // Estimate from duration (average ~500m per 2 minutes at moderate pace)
  if (metrics.target_duration_minutes) {
    return (metrics.target_duration_minutes / 2) * 500 * (metrics.target_sets || 1);
  }

  return 0;
}

/**
 * Check if an exercise is for a specific Hyrox station
 */
export function isStation(exercise: Exercise, station: HyroxStation): boolean {
  const category = categorizeExercise(exercise.name);
  return category.type === 'station' && category.station === station;
}

/**
 * Get all stations present in a list of exercises
 */
export function getStationsPresent(exercises: Exercise[]): HyroxStation[] {
  const stations = new Set<HyroxStation>();

  for (const exercise of exercises) {
    const category = categorizeExercise(exercise.name);
    if (category.type === 'station') {
      stations.add(category.station);
    }
  }

  return Array.from(stations);
}

/**
 * Get stations that are missing from a list of exercises
 */
export function getMissingStations(exercises: Exercise[]): HyroxStation[] {
  const allStations: HyroxStation[] = [
    'skierg', 'sled_push', 'sled_pull', 'burpee_broad_jump',
    'rowing', 'farmers_carry', 'sandbag_lunges', 'wall_balls'
  ];

  const present = getStationsPresent(exercises);
  return allStations.filter(s => !present.includes(s));
}

/**
 * Count how many times a station appears in exercises
 */
export function countStationOccurrences(exercises: Exercise[], station: HyroxStation): number {
  return exercises.filter(e => isStation(e, station)).length;
}

// =============================================================================
// STRENGTH VALIDATION HELPERS
// =============================================================================

/**
 * Check if exercise has proper weight specification (not just RPE)
 */
export function hasProperWeightSpec(exercise: Exercise): boolean {
  const category = categorizeExercise(exercise.name);

  // Only check strength exercises
  if (category.type !== 'strength') {
    return true; // Non-strength exercises don't need weight
  }

  const metrics = exercise.metrics_template;

  // Has explicit weight
  if (metrics?.target_weight_kg && metrics.target_weight_kg > 0) {
    return true;
  }

  // Bodyweight exercises don't need weight
  const name = exercise.name.toLowerCase();
  const bodyweightExercises = [
    'push-up', 'pushup', 'pull-up', 'pullup', 'chin-up', 'chinup',
    'dip', 'inverted row', 'plank', 'hollow', 'dead bug', 'bird dog',
    'glute bridge', 'hip circle', 'lunge' // bodyweight lunges
  ];

  if (bodyweightExercises.some(bw => name.includes(bw))) {
    return true;
  }

  // Otherwise, should have weight but doesn't
  return false;
}

/**
 * Check if running exercise has pace/zone guidance
 */
export function hasProperPaceGuidance(exercise: Exercise): boolean {
  const category = categorizeExercise(exercise.name);

  if (category.type !== 'running') {
    return true;
  }

  // Check if name or intensity notes contain pace info
  const text = `${exercise.name} ${exercise.intensity_notes || ''}`.toLowerCase();

  const paceIndicators = [
    'zone', 'z1', 'z2', 'z3', 'z4', 'z5',
    '/km', 'per km', 'min/km',
    'easy', 'tempo', 'threshold', 'race pace', 'interval',
    'conversational', 'recovery', 'hard', 'moderate',
    'rpe', 'effort'
  ];

  return paceIndicators.some(p => text.includes(p));
}

// =============================================================================
// TESTS / EXAMPLES
// =============================================================================

/**
 * Test the categorization with common exercise names
 */
export function testCategorization(): void {
  const testCases = [
    // Stations
    { name: 'SkiErg 1000m', expected: 'station:skierg' },
    { name: 'Sled Push 50m @ Race Weight', expected: 'station:sled_push' },
    { name: 'Sled Pull', expected: 'station:sled_pull' },
    { name: 'Burpee Broad Jumps 80m', expected: 'station:burpee_broad_jump' },
    { name: 'Rowing 1000m', expected: 'station:rowing' },
    { name: 'Concept2 Row Intervals', expected: 'station:rowing' },
    { name: 'Farmers Carry 200m', expected: 'station:farmers_carry' },
    { name: 'Sandbag Lunges 100m', expected: 'station:sandbag_lunges' },
    { name: 'Wall Balls x100', expected: 'station:wall_balls' },

    // Running
    { name: 'Easy Run 5km', expected: 'running:easy' },
    { name: 'Tempo Run 30min', expected: 'running:tempo' },
    { name: '1km Repeats x8', expected: 'running:interval' },
    { name: 'Long Run 12km', expected: 'running:long' },
    { name: 'Running', expected: 'running:undefined' },

    // Strength - should NOT match rowing station
    { name: 'Bent Over Row 3x10', expected: 'strength:horizontal_pull' },
    { name: 'Dumbbell Row', expected: 'strength:horizontal_pull' },
    { name: 'Cable Row', expected: 'strength:horizontal_pull' },

    // Strength - other
    { name: 'Back Squat 3x8', expected: 'strength:squat' },
    { name: 'Trap Bar Deadlift', expected: 'strength:hinge' },
    { name: 'Bench Press 3x10', expected: 'strength:horizontal_push' },
    { name: 'Pull-ups 3x max', expected: 'strength:vertical_pull' },
    { name: 'Overhead Press', expected: 'strength:vertical_push' },
    { name: 'Walking Lunges', expected: 'strength:lunge' },
    { name: 'Bulgarian Split Squat', expected: 'strength:lunge' },
    { name: 'Bicep Curls', expected: 'strength:accessory' },

    // Core
    { name: 'Dead Bugs 3x10', expected: 'core' },
    { name: 'Plank 3x60s', expected: 'core' },
    { name: 'Pallof Press', expected: 'core' },

    // Cardio
    { name: 'Assault Bike 20min', expected: 'cardio:bike' },
    { name: 'Swimming 1000m', expected: 'cardio:swim' },

    // Mobility
    { name: 'Hip Mobility Routine', expected: 'mobility' },
    { name: 'Foam Rolling', expected: 'mobility' },

    // Warmup
    { name: 'Dynamic Warm-up', expected: 'warmup' },

    // =======================================================================
    // NORMALIZATION TESTS (LLM naming variations)
    // =======================================================================

    // SkiErg variations
    { name: 'Ski Erg 500m', expected: 'station:skierg' },
    { name: 'Ski-Erg Intervals', expected: 'station:skierg' },
    { name: 'C2 Ski 1000m', expected: 'station:skierg' },

    // Sled variations
    { name: 'Prowler Push 50m', expected: 'station:sled_push' },
    { name: 'Hand Over Hand Sled Pull', expected: 'station:sled_pull' },

    // BBJ variations
    { name: 'BBJs 80m', expected: 'station:burpee_broad_jump' },
    { name: 'Broad Jump Burpees', expected: 'station:burpee_broad_jump' },

    // Rowing variations (should NOT match strength rows)
    { name: 'C2 Row 2000m', expected: 'station:rowing' },
    { name: 'Erg Row Intervals', expected: 'station:rowing' },

    // Farmers carry variations
    { name: "Farmer's Walk 100m", expected: 'station:farmers_carry' },
    { name: 'Farmers Walk 200m', expected: 'station:farmers_carry' },

    // Wall ball variations
    { name: 'Wallball x50', expected: 'station:wall_balls' },
    { name: 'WB 75 reps', expected: 'station:wall_balls' },

    // Running variations
    { name: 'Jog 3km', expected: 'running:undefined' },
    { name: 'Easy Jog 20min', expected: 'running:easy' },
    { name: 'Z2 Run 45min', expected: 'running:easy' }, // normalized to 'zone 2 run', matches 'zone 2' → easy

    // Strength variations
    { name: 'DL 3x5', expected: 'strength:hinge' },
    { name: 'OHP 3x8', expected: 'strength:vertical_push' },
    { name: 'BB Squat 5x5', expected: 'strength:squat' },
    { name: 'Pull Up 3x max', expected: 'strength:vertical_pull' },
    { name: 'Pushup 3x15', expected: 'strength:horizontal_push' },

    // Core variations
    { name: 'Situps 3x20', expected: 'core' },
    { name: 'Dead Bug 3x10 each', expected: 'core' },
  ];

  console.log('Running categorization tests...\n');

  let passCount = 0;
  let failCount = 0;

  for (const test of testCases) {
    const result = categorizeExercise(test.name);
    const resultStr = result.type === 'station' ? `station:${result.station}` :
                      result.type === 'running' ? `running:${result.subtype}` :
                      result.type === 'strength' ? `strength:${result.category}` :
                      result.type === 'cardio' ? `cardio:${result.modality}` :
                      result.type;

    const pass = resultStr === test.expected;
    if (pass) {
      passCount++;
    } else {
      failCount++;
    }
    console.log(`${pass ? '✓' : '✗'} "${test.name}" → ${resultStr} (expected: ${test.expected})`);
  }

  console.log(`\nResults: ${passCount} passed, ${failCount} failed`);
}

/**
 * Test exercise name normalization specifically
 */
export function testNormalization(): void {
  const testCases = [
    { input: 'Ski Erg', expected: 'skierg' },
    { input: 'SKI-ERG', expected: 'skierg' },
    { input: 'BBJs', expected: 'burpee broad jump' },
    { input: 'Prowler Push 50m', expected: 'sled push' },  // 50m removed by metric removal
    { input: "Farmer's Walk", expected: 'farmers carry' },
    { input: 'C2 Row', expected: 'rowing' },
    { input: 'Wallball', expected: 'wall balls' },
    { input: 'OHP', expected: 'overhead press' },
    { input: 'Pull Up', expected: 'pull-up' },
    { input: 'Dead Bug', expected: 'deadbug' },
    { input: 'Easy Jog', expected: 'easy run' },
    // Metric removal tests
    { input: 'SkiErg 500m', expected: 'skierg' },
    { input: 'Bench Press 3x10', expected: 'bench press' },
    { input: 'Running 5km @ 80%', expected: 'running' },
    { input: 'Wall Balls x100', expected: 'wall balls' },
  ];

  console.log('Running normalization tests...\n');

  let passCount = 0;
  let failCount = 0;

  for (const test of testCases) {
    const result = normalizeExerciseName(test.input);
    const pass = result === test.expected;
    if (pass) {
      passCount++;
    } else {
      failCount++;
    }
    console.log(`${pass ? '✓' : '✗'} "${test.input}" → "${result}" (expected: "${test.expected}")`);
  }

  console.log(`\nResults: ${passCount} passed, ${failCount} failed`);
}
