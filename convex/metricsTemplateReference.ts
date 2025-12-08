/**
 * METRICS TEMPLATE REFERENCE - SINGLE SOURCE OF TRUTH
 *
 * This file defines ALL possible metric templates that exercises can use.
 * The AI MUST use these exact formats - no exceptions.
 *
 * Purpose: Ensure AI always structures exercises correctly
 * - Strength exercises → sets_reps_weight
 * - Cardio machines → duration_only or distance_time
 * - Bodyweight → sets_reps
 * - etc.
 */

// ═══════════════════════════════════════════════════════════
// METRIC TEMPLATE TYPES - ALL POSSIBLE FORMATS
// ═══════════════════════════════════════════════════════════

export interface MetricsTemplateReference {
  type: string;
  description: string;
  useCase: string;
  examples: string[];
  requiredFields: string[];
  optionalFields: string[];
  jsonExample: any;
}

export const METRICS_TEMPLATES: Record<string, MetricsTemplateReference> = {
  // ─────────────────────────────────────────────────────────
  // STRENGTH TRAINING (most common)
  // ─────────────────────────────────────────────────────────
  sets_reps_weight: {
    type: 'sets_reps_weight',
    description: 'Standard strength training with weights',
    useCase: 'Barbell, dumbbell, machine exercises with resistance',
    examples: [
      'Barbell Bench Press',
      'Barbell Back Squat',
      'Dumbbell Row',
      'Leg Press',
      'Cable Fly',
    ],
    requiredFields: ['type', 'target_sets', 'target_reps'],
    optionalFields: ['target_weight', 'weight_unit', 'one_rep_max_percentage', 'rest_period_s', 'rpe'],
    jsonExample: {
      type: 'sets_reps_weight',
      target_sets: 4,
      target_reps: '8-10', // Can be number or range
      target_weight: 80, // Optional
      weight_unit: 'kg', // Optional: 'kg' | 'lbs'
      one_rep_max_percentage: null, // Optional: 75 means 75% of 1RM
      rest_period_s: 90,
      rpe: 7, // Rate of Perceived Exertion 1-10
    },
  },

  // ─────────────────────────────────────────────────────────
  // BODYWEIGHT EXERCISES
  // ─────────────────────────────────────────────────────────
  sets_reps: {
    type: 'sets_reps',
    description: 'Bodyweight exercises without added weight',
    useCase: 'Push-ups, pull-ups, air squats, burpees',
    examples: [
      'Push-ups',
      'Pull-ups',
      'Air Squats',
      'Burpees',
      'Sit-ups',
    ],
    requiredFields: ['type', 'target_sets', 'target_reps'],
    optionalFields: ['rest_period_s', 'rpe'],
    jsonExample: {
      type: 'sets_reps',
      target_sets: 3,
      target_reps: 15,
      rest_period_s: 60,
      rpe: 6,
    },
  },

  // ─────────────────────────────────────────────────────────
  // CARDIO - DURATION BASED (most common for machines)
  // ─────────────────────────────────────────────────────────
  duration_only: {
    type: 'duration_only',
    description: 'Cardio exercises measured by time only',
    useCase: 'Treadmill, bike, elliptical - focus on duration not distance',
    examples: [
      'Treadmill Run (30 min)',
      'Stationary Bike (45 min)',
      'Elliptical (60 min)',
      'StairMaster (40 min)',
      'Rowing Machine (30 min)',
    ],
    requiredFields: ['type', 'duration_minutes'],
    optionalFields: ['rpe', 'notes'],
    jsonExample: {
      type: 'duration_only',
      duration_minutes: 45,
      rpe: 6,
      notes: 'Zone 2 cardio - conversational pace',
    },
  },

  // ─────────────────────────────────────────────────────────
  // CARDIO - DISTANCE BASED
  // ─────────────────────────────────────────────────────────
  distance_time: {
    type: 'distance_time',
    description: 'Cardio with specific distance target',
    useCase: 'Running, cycling, rowing with distance goals',
    examples: [
      '5km Run',
      '10km Bike',
      '2000m Row',
      '400m Sprint',
    ],
    requiredFields: ['type'],
    optionalFields: ['distance_km', 'distance_m', 'target_time_s', 'rpe'],
    jsonExample: {
      type: 'distance_time',
      distance_km: 5,
      distance_m: null, // Use km OR meters, not both
      target_time_s: 1800, // Optional: 30 minutes
      rpe: 7,
    },
  },

  // ─────────────────────────────────────────────────────────
  // INTERVAL TRAINING
  // ─────────────────────────────────────────────────────────
  sets_duration_rest: {
    type: 'sets_duration_rest',
    description: 'Interval training with work/rest periods',
    useCase: 'HIIT, sprint intervals, bike sprints',
    examples: [
      '8 x 30s Sprint (90s rest)',
      '10 x 1min Bike Sprint (60s rest)',
      'Tabata (20s work / 10s rest)',
    ],
    // Note: Validator accepts alternative field names (sets/target_sets, duration_seconds/work_duration_s, rest_seconds/rest_duration_s)
    requiredFields: ['type'],
    optionalFields: ['sets', 'target_sets', 'duration_seconds', 'work_duration_s', 'rest_seconds', 'rest_duration_s', 'rpe'],
    jsonExample: {
      type: 'sets_duration_rest',
      sets: 8,
      duration_seconds: 30,
      rest_seconds: 90,
      rpe: 9,
    },
  },

  sets_distance_rest: {
    type: 'sets_distance_rest',
    description: 'Distance-based interval training',
    useCase: 'Track sprints, rowing intervals',
    examples: [
      '8 x 400m (90s rest)',
      '5 x 1000m Row (2min rest)',
    ],
    requiredFields: ['type', 'sets', 'rest_seconds'],
    optionalFields: ['distance_km', 'distance_m', 'rpe'],
    jsonExample: {
      type: 'sets_distance_rest',
      sets: 8,
      distance_m: 400,
      rest_seconds: 90,
      rpe: 8,
    },
  },

  // ─────────────────────────────────────────────────────────
  // TIMED HOLDS
  // ─────────────────────────────────────────────────────────
  sets_duration: {
    type: 'sets_duration',
    description: 'Timed holds or isometric exercises',
    useCase: 'Planks, wall sits, dead hangs',
    examples: [
      'Plank Hold',
      'Wall Sit',
      'Dead Hang',
      'L-Sit Hold',
    ],
    // Note: Validator accepts alternative field names (duration_seconds/target_duration_s)
    requiredFields: ['type', 'target_sets'],
    optionalFields: ['duration_seconds', 'target_duration_s', 'rest_period_s', 'rpe'],
    jsonExample: {
      type: 'sets_duration',
      target_sets: 3,
      duration_seconds: 60,
      rest_period_s: 60,
      rpe: 7,
    },
  },

  // ─────────────────────────────────────────────────────────
  // WEIGHTED CARRIES
  // ─────────────────────────────────────────────────────────
  sets_duration_weight: {
    type: 'sets_duration_weight',
    description: 'Weighted carries or holds',
    useCase: 'Farmer carries, suitcase carries, overhead walks',
    examples: [
      'Farmer Carry',
      'Suitcase Carry',
      'Overhead Walk',
      'Waiter Walk',
    ],
    requiredFields: ['type', 'target_sets', 'duration_seconds'],
    optionalFields: ['target_weight', 'weight_unit', 'rest_period_s', 'rpe'],
    jsonExample: {
      type: 'sets_duration_weight',
      target_sets: 3,
      duration_seconds: 45,
      target_weight: 32,
      weight_unit: 'kg',
      rest_period_s: 90,
      rpe: 7,
    },
  },

  // ─────────────────────────────────────────────────────────
  // TEMPO TRAINING
  // ─────────────────────────────────────────────────────────
  tempo: {
    type: 'tempo',
    description: 'Controlled tempo exercises',
    useCase: 'Eccentric-focused, paused lifts',
    examples: [
      'Tempo Squat (3-1-1-0)',
      'Paused Bench Press',
      'Slow Eccentric Deadlift',
    ],
    requiredFields: ['type', 'target_sets', 'target_reps', 'tempo_eccentric', 'tempo_pause', 'tempo_concentric', 'tempo_top'],
    optionalFields: ['target_weight', 'rest_period_s', 'rpe'],
    jsonExample: {
      type: 'tempo',
      target_sets: 4,
      target_reps: 6,
      tempo_eccentric: 3, // 3 seconds down
      tempo_pause: 1, // 1 second pause at bottom
      tempo_concentric: 1, // 1 second up
      tempo_top: 0, // No pause at top
      target_weight: 70,
      rest_period_s: 120,
      rpe: 8,
    },
  },
};

// ═══════════════════════════════════════════════════════════
// ABBREVIATIONS & TERMINOLOGY REFERENCE
// ═══════════════════════════════════════════════════════════

export interface TerminologyReference {
  term: string;
  fullName: string;
  definition: string;
  usage: string;
}

export const TERMINOLOGY: Record<string, TerminologyReference> = {
  // Training metrics
  RPE: {
    term: 'RPE',
    fullName: 'Rate of Perceived Exertion',
    definition: 'Subjective measure of how hard an exercise feels (1-10 scale)',
    usage: '7 RPE = could do 3 more reps, 9 RPE = could do 1 more rep, 10 RPE = failure',
  },
  '1RM': {
    term: '1RM',
    fullName: 'One Rep Max',
    definition: 'The maximum weight you can lift for exactly one repetition',
    usage: 'Often used as percentage: "80% 1RM" means 80% of your max weight',
  },
  RIR: {
    term: 'RIR',
    fullName: 'Reps in Reserve',
    definition: 'How many more reps you could do before failure',
    usage: '2 RIR = could do 2 more reps, 0 RIR = complete failure',
  },

  // Workout formats
  AMRAP: {
    term: 'AMRAP',
    fullName: 'As Many Rounds As Possible',
    definition: 'Complete as many rounds of a circuit as possible in a set time',
    usage: '10min AMRAP: 5 pull-ups, 10 push-ups, 15 squats',
  },
  EMOM: {
    term: 'EMOM',
    fullName: 'Every Minute On the Minute',
    definition: 'Start a new set at the beginning of every minute',
    usage: '12min EMOM: Odd minutes 5 burpees, Even minutes 10 KB swings',
  },
  TABATA: {
    term: 'TABATA',
    fullName: 'Tabata Protocol',
    definition: '20 seconds work, 10 seconds rest, for 8 rounds (4 minutes total)',
    usage: 'Tabata Squats: 8 rounds of 20s work / 10s rest',
  },
  AFAP: {
    term: 'AFAP',
    fullName: 'As Fast As Possible',
    definition: 'Complete a fixed amount of work in minimum time',
    usage: '100 burpees AFAP - finish as quickly as possible',
  },
  RFT: {
    term: 'RFT',
    fullName: 'Rounds For Time',
    definition: 'Complete a fixed number of rounds as fast as possible',
    usage: '5 RFT: 10 pull-ups, 20 push-ups, 30 squats',
  },

  // Exercise abbreviations
  DB: {
    term: 'DB',
    fullName: 'Dumbbell',
    definition: 'Free weight equipment with two separate weights',
    usage: 'DB Bench Press, DB Row, DB Curl',
  },
  BB: {
    term: 'BB',
    fullName: 'Barbell',
    definition: 'Long bar with weight plates on each end',
    usage: 'BB Squat, BB Bench Press, BB Deadlift',
  },
  KB: {
    term: 'KB',
    fullName: 'Kettlebell',
    definition: 'Cast iron weight with a handle',
    usage: 'KB Swing, KB Goblet Squat, KB Turkish Get-up',
  },
  BW: {
    term: 'BW',
    fullName: 'Bodyweight',
    definition: 'Exercise using only your body for resistance',
    usage: 'BW Squats, BW Push-ups, BW Pull-ups',
  },
  SB: {
    term: 'SB',
    fullName: 'Swiss Ball / Stability Ball',
    definition: 'Large inflatable ball for balance exercises',
    usage: 'SB Crunches, SB Hamstring Curl',
  },
  MB: {
    term: 'MB',
    fullName: 'Medicine Ball',
    definition: 'Weighted ball for throwing/slamming exercises',
    usage: 'MB Slam, MB Wall Ball, MB Chest Pass',
  },

  // Movement patterns
  RDL: {
    term: 'RDL',
    fullName: 'Romanian Deadlift',
    definition: 'Hip hinge movement with minimal knee bend',
    usage: 'BB RDL, DB RDL - focuses on hamstrings and glutes',
  },
  SLDL: {
    term: 'SLDL',
    fullName: 'Straight Leg Deadlift',
    definition: 'Deadlift variation with locked knees',
    usage: 'Similar to RDL but with straighter legs',
  },
  GHR: {
    term: 'GHR',
    fullName: 'Glute Ham Raise',
    definition: 'Hamstring exercise on GHD machine',
    usage: 'Eccentric hamstring strengthening',
  },
  HSPU: {
    term: 'HSPU',
    fullName: 'Handstand Push-up',
    definition: 'Push-up performed in handstand position',
    usage: 'Advanced shoulder and tricep exercise',
  },
  T2B: {
    term: 'T2B',
    fullName: 'Toes to Bar',
    definition: 'Hanging from bar and bringing toes to touch the bar',
    usage: 'Advanced core exercise',
  },
  MU: {
    term: 'MU',
    fullName: 'Muscle Up',
    definition: 'Pull-up transitioning into a dip at the top',
    usage: 'Advanced gymnastics movement',
  },
  DU: {
    term: 'DU',
    fullName: 'Double Under',
    definition: 'Jump rope where rope passes under feet twice per jump',
    usage: 'Cardio/coordination exercise',
  },

  // Periodization
  GPP: {
    term: 'GPP',
    fullName: 'General Physical Preparedness',
    definition: 'Broad fitness foundation phase',
    usage: 'Off-season training focusing on overall fitness',
  },
  SPP: {
    term: 'SPP',
    fullName: 'Specific Physical Preparedness',
    definition: 'Sport-specific training phase',
    usage: 'In-season training mimicking competition demands',
  },
  DELOAD: {
    term: 'DELOAD',
    fullName: 'Deload Week',
    definition: 'Reduced volume/intensity week for recovery',
    usage: 'Every 4th week: 50-60% volume for recovery',
  },
};

// ═══════════════════════════════════════════════════════════
// AI PROMPT - COMPREHENSIVE REFERENCE
// ═══════════════════════════════════════════════════════════

export function getMetricsTemplatePrompt(): string {
  return `
**CRITICAL: METRICS TEMPLATE REFERENCE - MANDATORY COMPLIANCE**

You MUST use these EXACT metric templates for ALL exercises. NO EXCEPTIONS.

═══════════════════════════════════════════════════════════
STRENGTH EXERCISES (Barbell, Dumbbell, Machines)
═══════════════════════════════════════════════════════════

Use: "type": "sets_reps_weight"

Examples:
- Barbell Bench Press → { "type": "sets_reps_weight", "target_sets": 4, "target_reps": "8-10", "rest_period_s": 90, "rpe": 7 }
- Dumbbell Row → { "type": "sets_reps_weight", "target_sets": 3, "target_reps": 12, "target_weight": 30 }
- Leg Press → { "type": "sets_reps_weight", "target_sets": 4, "target_reps": 10 }

Required: target_sets, target_reps
Optional: target_weight, one_rep_max_percentage, rest_period_s, rpe

═══════════════════════════════════════════════════════════
BODYWEIGHT EXERCISES (Push-ups, Pull-ups, Squats)
═══════════════════════════════════════════════════════════

Use: "type": "sets_reps"

Examples:
- Push-ups → { "type": "sets_reps", "target_sets": 3, "target_reps": 15, "rest_period_s": 60 }
- Pull-ups → { "type": "sets_reps", "target_sets": 4, "target_reps": 8 }
- Air Squats → { "type": "sets_reps", "target_sets": 3, "target_reps": 20 }

Required: target_sets, target_reps
Optional: rest_period_s, rpe

═══════════════════════════════════════════════════════════
CARDIO MACHINES - DURATION (Treadmill, Bike, Elliptical)
═══════════════════════════════════════════════════════════

Use: "type": "duration_only"

**CRITICAL FOR AM CARDIO SESSIONS** ← YOUR ISSUE!

Examples:
- Treadmill Run → { "type": "duration_only", "duration_minutes": 45, "rpe": 6, "notes": "Zone 2 cardio" }
- Stationary Bike → { "type": "duration_only", "duration_minutes": 60 }
- Elliptical → { "type": "duration_only", "duration_minutes": 40 }
- StairMaster → { "type": "duration_only", "duration_minutes": 30 }
- Rowing Machine → { "type": "duration_only", "duration_minutes": 35 }

Required: duration_minutes
Optional: rpe, notes

═══════════════════════════════════════════════════════════
CARDIO - DISTANCE BASED (Runs, Cycles with distance goals)
═══════════════════════════════════════════════════════════

Use: "type": "distance_time"

Examples:
- 5km Run → { "type": "distance_time", "distance_km": 5, "rpe": 7 }
- 10km Bike → { "type": "distance_time", "distance_km": 10 }
- 2000m Row → { "type": "distance_time", "distance_m": 2000 }

Required: distance_km OR distance_m (not both)
Optional: target_time_s, rpe

═══════════════════════════════════════════════════════════
INTERVAL TRAINING (HIIT, Sprints)
═══════════════════════════════════════════════════════════

Use: "type": "sets_duration_rest" for time-based intervals
Use: "type": "sets_distance_rest" for distance-based intervals

Examples:
- Sprint Intervals → { "type": "sets_duration_rest", "sets": 8, "duration_seconds": 30, "rest_seconds": 90, "rpe": 9 }
- Track Sprints → { "type": "sets_distance_rest", "sets": 8, "distance_m": 400, "rest_seconds": 90 }
- Bike Sprints → { "type": "sets_duration_rest", "sets": 10, "duration_seconds": 60, "rest_seconds": 60 }

═══════════════════════════════════════════════════════════
TIMED HOLDS (Planks, Wall Sits)
═══════════════════════════════════════════════════════════

Use: "type": "sets_duration"

Examples:
- Plank → { "type": "sets_duration", "target_sets": 3, "duration_seconds": 60, "rest_period_s": 60 }
- Wall Sit → { "type": "sets_duration", "target_sets": 3, "duration_seconds": 45 }
- Dead Hang → { "type": "sets_duration", "target_sets": 3, "duration_seconds": 30 }

Required: target_sets, duration_seconds
Optional: rest_period_s, rpe

═══════════════════════════════════════════════════════════
VALIDATION RULES - ENFORCE THESE
═══════════════════════════════════════════════════════════

1. **NEVER** create a custom metric format - use ONLY the templates above
2. **ALWAYS** include "type" field matching template name exactly
3. **STRENGTH** exercises (weights) → sets_reps_weight
4. **CARDIO MACHINES** (time-based) → duration_only ← FIX YOUR AM CARDIO HERE!
5. **CARDIO** (distance-based) → distance_time
6. **BODYWEIGHT** → sets_reps
7. **HOLDS** → sets_duration
8. **INTERVALS** → sets_duration_rest or sets_distance_rest

═══════════════════════════════════════════════════════════
COMMON MISTAKES - AVOID THESE
═══════════════════════════════════════════════════════════

❌ WRONG: { "type": "cardio", "minutes": 45 }
✅ CORRECT: { "type": "duration_only", "duration_minutes": 45 }

❌ WRONG: { "type": "treadmill", "time": 30 }
✅ CORRECT: { "type": "duration_only", "duration_minutes": 30 }

❌ WRONG: { "type": "reps_weight", "reps": 10, "weight": 100 }
✅ CORRECT: { "type": "sets_reps_weight", "target_sets": 3, "target_reps": 10, "target_weight": 100 }

❌ WRONG: Leaving metrics_template empty or null
✅ CORRECT: Always provide complete metrics_template object

`;
}

// ═══════════════════════════════════════════════════════════
// CONDENSED AI PROMPT - OPTIMIZED FOR SPEED
// Same information, ~60% fewer tokens
// ═══════════════════════════════════════════════════════════

export function getCondensedMetricsPrompt(): string {
  return `**METRICS TEMPLATE TYPES (MANDATORY)**

| Exercise Type | template "type" | Required Fields | Example |
|--------------|-----------------|-----------------|---------|
| Strength (BB/DB/machines) | sets_reps_weight | target_sets, target_reps | {"type":"sets_reps_weight","target_sets":4,"target_reps":"8-10","rest_period_s":90,"rpe":7} |
| Bodyweight | sets_reps | target_sets, target_reps | {"type":"sets_reps","target_sets":3,"target_reps":15} |
| Cardio machines | duration_only | duration_minutes | {"type":"duration_only","duration_minutes":45,"rpe":6} |
| Distance cardio | distance_time | distance_km OR distance_m | {"type":"distance_time","distance_km":5} |
| Intervals (time) | sets_duration_rest | sets, duration_seconds, rest_seconds | {"type":"sets_duration_rest","sets":8,"duration_seconds":30,"rest_seconds":90} |
| Intervals (distance) | sets_distance_rest | sets, distance_m, rest_seconds | {"type":"sets_distance_rest","sets":8,"distance_m":400,"rest_seconds":90} |
| Holds (plank/wall sit) | sets_duration | target_sets, duration_seconds | {"type":"sets_duration","target_sets":3,"duration_seconds":60} |

**RULES:**
1. ALWAYS include "type" field exactly as shown
2. Treadmill/Bike/Elliptical → duration_only (NOT "cardio" or custom)
3. All categories must be "warmup", "main", or "cooldown"
`;
}

// ═══════════════════════════════════════════════════════════
// TERMINOLOGY PROMPT
// ═══════════════════════════════════════════════════════════

export function getTerminologyPrompt(): string {
  const terms = Object.values(TERMINOLOGY);

  return `
**ABBREVIATIONS & TERMINOLOGY REFERENCE**

When parsing or generating plans, recognize these abbreviations:

${terms.map(t => `
**${t.term}** (${t.fullName})
Definition: ${t.definition}
Usage: ${t.usage}
`).join('\n')}

IMPORTANT: When you see these abbreviations in user input, expand them appropriately in your output.
`;
}

// Condensed terminology - only essential abbreviations
export function getCondensedTerminologyPrompt(): string {
  return `**KEY ABBREVIATIONS:**
RPE = Rate of Perceived Exertion (1-10 scale, 7 = 3 reps left, 9 = 1 rep left)
1RM = One Rep Max
AMRAP = As Many Rounds As Possible
EMOM = Every Minute On the Minute
DB = Dumbbell, BB = Barbell, KB = Kettlebell, BW = Bodyweight
RDL = Romanian Deadlift, GHR = Glute Ham Raise
`;
}
