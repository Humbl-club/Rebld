/**
 * REBLD Evidence-Based Prompt Builder
 *
 * Built on scientific literature from:
 * - NSCA (National Strength and Conditioning Association)
 * - ACSM (American College of Sports Medicine)
 * - Renaissance Periodization (Dr. Mike Israetel)
 * - Stronger By Science (Greg Nuckols)
 * - Peer-reviewed meta-analyses from PMC/PubMed
 *
 * Key Scientific Sources:
 * - Schoenfeld et al. (2017): Volume landmarks for hypertrophy
 * - Helms et al. (2016): RPE/RIR correlation study
 * - ACSM Position Stand (2009): Progression models in resistance training
 * - Baz-Valle et al.: Weekly set volume recommendations
 *
 * Every number in this file is evidence-based, not arbitrary.
 */

import { formatSportPrompt } from './sportData';

// ═══════════════════════════════════════════════════════════════════════════════
// SCIENTIFIC CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Volume Landmarks (sets per muscle group per week)
 * Source: Renaissance Periodization, Schoenfeld meta-analysis
 *
 * MV  = Maintenance Volume (preserves current muscle)
 * MEV = Minimum Effective Volume (minimum to grow)
 * MAV = Maximum Adaptive Volume (optimal growth range)
 * MRV = Maximum Recoverable Volume (upper limit)
 */
const VOLUME_LANDMARKS = {
  beginner: {
    MV: 4,   // Can maintain with very little
    MEV: 6,  // Growth comes easy
    MAV_low: 8,
    MAV_high: 12,
    MRV: 16, // Higher recovery capacity but lower tolerance
  },
  intermediate: {
    MV: 6,
    MEV: 10,
    MAV_low: 12,
    MAV_high: 16,
    MRV: 20,
  },
  advanced: {
    MV: 6,
    MEV: 12,
    MAV_low: 16,
    MAV_high: 20,
    MRV: 25, // Can tolerate more but diminishing returns
  },
};

/**
 * Weight Progression Rates (per week or per session)
 * Source: NSCA, Starting Strength, EliteFTS
 *
 * Upper body progresses slower than lower body
 * Beginners progress faster than advanced
 */
const PROGRESSION_RATES = {
  beginner: {
    upper_per_session: 2.5, // kg - can add every workout
    lower_per_session: 5.0, // kg - can add every workout
    weeks_before_stall: 8,  // Linear progression lasts ~8-12 weeks
  },
  intermediate: {
    upper_per_week: 1.25,   // kg - weekly progression
    lower_per_week: 2.5,    // kg - weekly progression
    mesocycle_length: 4,    // weeks before deload
  },
  advanced: {
    upper_per_mesocycle: 2.5, // kg - per 4-6 week block
    lower_per_mesocycle: 5.0, // kg - per 4-6 week block
    mesocycle_length: 3,      // weeks before deload (shorter)
  },
};

/**
 * Deload Frequency by Training Level
 * Source: BarBend, Legion Athletics, PowerliftingTechnique.com
 */
const DELOAD_FREQUENCY = {
  beginner: {
    weeks_between_deloads: 10, // 8-12 weeks typical
    deload_volume_reduction: 0.5, // 50% volume
    deload_intensity: 'same', // Keep weights, reduce sets
  },
  intermediate: {
    weeks_between_deloads: 6, // 4-8 weeks typical
    deload_volume_reduction: 0.5,
    deload_intensity: 'same',
  },
  advanced: {
    weeks_between_deloads: 4, // 3-6 weeks typical
    deload_volume_reduction: 0.4, // 40-60% reduction
    deload_intensity: 'reduce_5_percent',
  },
};

/**
 * RPE/RIR Correlation Chart
 * Source: Helms et al. (2016), NSCA-SCJ
 *
 * RPE = Rate of Perceived Exertion (1-10 scale)
 * RIR = Reps In Reserve (how many more you could do)
 */
const RPE_RIR_CHART = {
  10: { rir: 0, description: 'Maximum effort, no reps left', percent_1rm: '100%' },
  9.5: { rir: 0.5, description: 'Maybe could add tiny weight', percent_1rm: '97-98%' },
  9: { rir: 1, description: 'Could do 1 more rep', percent_1rm: '94-96%' },
  8.5: { rir: 1.5, description: 'Definitely 1, maybe 2 more', percent_1rm: '91-93%' },
  8: { rir: 2, description: 'Could do 2 more reps', percent_1rm: '88-90%' },
  7.5: { rir: 2.5, description: 'Definitely 2, maybe 3 more', percent_1rm: '85-87%' },
  7: { rir: 3, description: 'Could do 3 more reps', percent_1rm: '82-84%' },
  6: { rir: 4, description: 'Could do 4 more reps', percent_1rm: '75-81%' },
  5: { rir: 5, description: 'Light effort, 5+ reps left', percent_1rm: '70-74%' },
};

/**
 * Age-Based Training Modifications
 * Source: ACSM Position Stand, NSCA
 */
const AGE_MODIFICATIONS = {
  under_25: {
    recovery_hours: 24,
    max_rpe: 9,
    warmup_minutes: 8,
    rep_range: '6-12',
    deload_modifier: 1.5, // Can go longer between deloads
  },
  '25_34': {
    recovery_hours: 36,
    max_rpe: 9,
    warmup_minutes: 10,
    rep_range: '6-12',
    deload_modifier: 1.0, // Standard
  },
  '35_44': {
    recovery_hours: 48,
    max_rpe: 8.5,
    warmup_minutes: 12,
    rep_range: '8-12',
    deload_modifier: 0.85, // More frequent deloads
  },
  '45_54': {
    recovery_hours: 72,
    max_rpe: 8,
    warmup_minutes: 15,
    rep_range: '10-15',
    deload_modifier: 0.7, // Deload every ~70% of standard frequency
  },
  '55_plus': {
    recovery_hours: 72,
    max_rpe: 7.5,
    warmup_minutes: 15,
    rep_range: '12-15',
    deload_modifier: 0.6, // Frequent deloads, prioritize recovery
  },
};

/**
 * Training Frequency by Days Per Week
 * Source: NSCA, Evidence-based practice
 */
const TRAINING_SPLITS = {
  2: { name: 'Full Body', muscles_per_session: 'all' },
  3: { name: 'Full Body', muscles_per_session: 'all' },
  4: { name: 'Upper/Lower', muscles_per_session: 'half' },
  5: { name: 'Upper/Lower/Push/Pull/Legs', muscles_per_session: 'targeted' },
  6: { name: 'Push/Pull/Legs', muscles_per_session: 'third' },
};

/**
 * 2-for-2 Rule (NSCA/ACSM Standard)
 * When to increase weight:
 * If you can do 2 more reps than target on the last set for 2 consecutive sessions
 */
const TWO_FOR_TWO_RULE = `
WEIGHT PROGRESSION RULE (2-for-2 Rule from NSCA/ACSM):
When the athlete can perform 2 additional repetitions beyond the target
on the last set for 2 consecutive training sessions, increase the load:
- Upper body exercises: +2.5kg (5lbs)
- Lower body exercises: +5kg (10lbs)
`;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserProfile {
  age?: number;
  sex?: 'male' | 'female' | 'other';
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  training_frequency: number;
  session_length: number;
}

export interface CurrentStrength {
  squat_kg?: number;
  bench_kg?: number;
  deadlift_kg?: number;
  row_kg?: number;
  pullup_count?: number;
}

export interface GoalConfig {
  primary_goal: string;
  sport?: string;
  target_date?: string;
  event_name?: string;
  additional_notes?: string;
}

export interface Constraints {
  pain_points: string[];
  equipment?: string;
  cardio_types?: string[];
  cardio_duration_minutes?: number;
}

export interface TrainingSplitConfig {
  sessions_per_day: 1 | 2;
  training_type?: 'strength_only' | 'strength_plus_cardio' | 'combined' | 'cardio_focused';
}

export interface PromptInputs {
  profile: UserProfile;
  strength: CurrentStrength;
  goal: GoalConfig;
  constraints: Constraints;
  split: TrainingSplitConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getAgeCategory(age?: number): keyof typeof AGE_MODIFICATIONS {
  if (!age || age < 25) return 'under_25';
  if (age < 35) return '25_34';
  if (age < 45) return '35_44';
  if (age < 55) return '45_54';
  return '55_plus';
}

function calculateTotalWeeks(targetDate?: string): number {
  if (!targetDate) return 12;
  const target = new Date(targetDate);
  const now = new Date();
  const diffWeeks = Math.ceil((target.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(4, Math.min(52, diffWeeks));
}

function getVolumeLandmarks(level: string) {
  return VOLUME_LANDMARKS[level as keyof typeof VOLUME_LANDMARKS] || VOLUME_LANDMARKS.intermediate;
}

function getAgeModifications(age?: number) {
  const category = getAgeCategory(age);
  return AGE_MODIFICATIONS[category];
}

function getProgressionRates(level: string) {
  return PROGRESSION_RATES[level as keyof typeof PROGRESSION_RATES] || PROGRESSION_RATES.intermediate;
}

function getDeloadFrequency(level: string, age?: number) {
  const base = DELOAD_FREQUENCY[level as keyof typeof DELOAD_FREQUENCY] || DELOAD_FREQUENCY.intermediate;
  const ageCategory = getAgeCategory(age);
  const ageModifier = AGE_MODIFICATIONS[ageCategory].deload_modifier;

  return {
    ...base,
    weeks_between_deloads: Math.round(base.weeks_between_deloads * ageModifier),
  };
}

function calculateStartingWeights(strength: CurrentStrength) {
  if (!strength.squat_kg && !strength.bench_kg && !strength.deadlift_kg) {
    return null;
  }

  // Calculate derivative lifts based on known lifts
  // Source: Common strength ratios from powerlifting
  const bench = strength.bench_kg;
  const squat = strength.squat_kg;
  const deadlift = strength.deadlift_kg;

  return {
    // Known lifts
    squat: squat,
    bench: bench,
    deadlift: deadlift,
    row: strength.row_kg,

    // Calculated derivatives (if base lift is known)
    incline_bench: bench ? Math.round(bench * 0.85) : null,
    overhead_press: bench ? Math.round(bench * 0.65) : null,
    front_squat: squat ? Math.round(squat * 0.85) : null,
    romanian_deadlift: deadlift ? Math.round(deadlift * 0.65) : null,
    barbell_row: deadlift ? Math.round(deadlift * 0.55) : null,
    dumbbell_bench: bench ? Math.round((bench * 0.4) / 2) : null, // Per hand
    dumbbell_row: strength.row_kg ? Math.round(strength.row_kg * 0.6) : null,
    lat_pulldown: strength.pullup_count && strength.pullup_count < 5 ? 'bodyweight_assist' : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERIODIZATION BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildPeriodization(
  totalWeeks: number,
  goal: string,
  level: string,
  age?: number,
  sport?: string
): string {
  const deload = getDeloadFrequency(level, age);
  const volumeMarks = getVolumeLandmarks(level);
  const progression = getProgressionRates(level);
  const ageCategory = getAgeCategory(age);
  const ageMods = AGE_MODIFICATIONS[ageCategory];

  // Determine periodization style based on goal
  const isStrengthGoal = ['strength', 'powerlifting', 'power'].some(g =>
    goal.toLowerCase().includes(g)
  );
  const isEnduranceGoal = ['endurance', 'marathon', 'triathlon', 'hyrox', 'running'].some(g =>
    goal.toLowerCase().includes(g) || sport?.toLowerCase().includes(g)
  );
  const isHypertrophyGoal = ['muscle', 'aesthetic', 'bodybuilding', 'size'].some(g =>
    goal.toLowerCase().includes(g)
  );

  // Calculate deload weeks
  const deloadInterval = deload.weeks_between_deloads;
  const deloadWeeks: number[] = [];
  for (let w = deloadInterval; w < totalWeeks; w += deloadInterval) {
    deloadWeeks.push(w);
  }

  let periodizationPrompt = `
═══════════════════════════════════════════════════════════════════════════════
PERIODIZATION STRUCTURE (${totalWeeks} WEEKS)
Based on: NSCA Guidelines, Renaissance Periodization, Stronger By Science
═══════════════════════════════════════════════════════════════════════════════

PROGRAM LENGTH: ${totalWeeks} weeks
DELOAD WEEKS: ${deloadWeeks.join(', ')} (every ${deloadInterval} weeks based on ${level} + age ${age || 'N/A'})
DELOAD PROTOCOL: Reduce volume to ${Math.round(deload.deload_volume_reduction * 100)}%, maintain intensity

VOLUME TARGETS (sets per muscle group per week):
- Maintenance (MV): ${volumeMarks.MV} sets
- Minimum for growth (MEV): ${volumeMarks.MEV} sets
- Optimal range (MAV): ${volumeMarks.MAV_low}-${volumeMarks.MAV_high} sets
- Maximum recoverable (MRV): ${volumeMarks.MRV} sets

START at MEV (${volumeMarks.MEV} sets) Week 1, progress toward MAV by adding 1-2 sets per muscle group each week until reaching deload.

RPE TARGETS FOR ${level.toUpperCase()}:
- Week 1-2: RPE ${Math.max(5, Number(ageMods.max_rpe) - 2)} (${ageMods.rep_range} reps)
- Week 3-4: RPE ${Math.max(6, Number(ageMods.max_rpe) - 1)}
- Week 5+: RPE ${ageMods.max_rpe} (cap - do not exceed)
- Deload weeks: RPE 5-6

RECOVERY: Minimum ${ageMods.recovery_hours} hours between sessions targeting same muscles

${TWO_FOR_TWO_RULE}
`;

  // Add goal-specific periodization
  if (isStrengthGoal) {
    const phase1End = Math.floor(totalWeeks * 0.35);
    const phase2End = Math.floor(totalWeeks * 0.7);
    const phase3End = totalWeeks - 1;

    periodizationPrompt += `
STRENGTH-FOCUSED PHASES:

PHASE 1: ACCUMULATION (Weeks 1-${phase1End})
├── Volume: HIGH (${volumeMarks.MAV_low}-${volumeMarks.MAV_high} sets/muscle/week)
├── Intensity: 65-75% 1RM (RPE 6-7)
├── Rep Range: 8-12
├── Focus: Build work capacity, technique refinement
├── Weight Progression: ${level === 'beginner' ? '+2.5-5kg per session' : '+1.25-2.5kg per week'}
└── Sets per exercise: 3-4

PHASE 2: TRANSMUTATION (Weeks ${phase1End + 1}-${phase2End})
├── Volume: MODERATE (reduce by 2-3 sets/muscle)
├── Intensity: 75-85% 1RM (RPE 7-8)
├── Rep Range: 5-8
├── Focus: Convert muscle to strength
├── Weight Progression: ${level === 'beginner' ? '+2.5kg per session' : '+2.5kg per week lower, +1.25kg upper'}
└── Sets per exercise: 4

PHASE 3: REALIZATION (Weeks ${phase2End + 1}-${phase3End})
├── Volume: LOW (minimum effective)
├── Intensity: 85-95% 1RM (RPE 8-9)
├── Rep Range: 1-5
├── Focus: Neural adaptations, peak strength
├── Weight Progression: Attempt new maxes Week ${phase3End}
└── Sets per exercise: 3-5 (lower reps = can do more sets)

TAPER (Week ${totalWeeks}):
├── Volume: 50% of Phase 3
├── Intensity: 70-80% (stay fresh)
└── Focus: Maintain patterns, full recovery
`;
  } else if (isEnduranceGoal) {
    const phase1End = Math.floor(totalWeeks * 0.4);
    const phase2End = Math.floor(totalWeeks * 0.75);
    const phase3End = totalWeeks - 2;

    periodizationPrompt += `
ENDURANCE-FOCUSED PHASES:
(Based on 80/20 polarized training model - 80% easy, 20% hard)

PHASE 1: BASE BUILDING (Weeks 1-${phase1End})
├── Volume: Building from 70% to 100% of target
├── Intensity: Zone 2 (conversational, RPE 5-6)
├── Focus: Aerobic base, technique, injury prevention
├── Cardio Split: 90% easy / 10% tempo
├── Strength: 2x/week maintenance only
└── Progression: +10% volume per week (10% rule)

PHASE 2: BUILD (Weeks ${phase1End + 1}-${phase2End})
├── Volume: 100-110% of target
├── Intensity: Zone 3-4 (RPE 7-8)
├── Focus: Sport-specific work, threshold training
├── Cardio Split: 75% easy / 15% threshold / 10% high intensity
├── Strength: 1-2x/week (reduce to prioritize sport)
└── Add race-pace intervals

PHASE 3: PEAK (Weeks ${phase2End + 1}-${phase3End})
├── Volume: 80-90% (slight reduction)
├── Intensity: Include race simulations (RPE 8-9)
├── Focus: Full race simulations, confidence building
├── Cardio: Race-specific sessions
└── Strength: Minimal, maintenance only

TAPER (Weeks ${phase3End + 1}-${totalWeeks})
├── Volume: 40-60% reduction
├── Intensity: Keep some sharpness (short, fast efforts)
├── Focus: Full recovery, mental preparation
└── Avoid: Starting new exercises, high volume
`;
  } else {
    // Hypertrophy / General
    const phase1End = Math.floor(totalWeeks * 0.25);
    const phase2End = Math.floor(totalWeeks * 0.5);
    const phase3End = Math.floor(totalWeeks * 0.8);

    periodizationPrompt += `
HYPERTROPHY-FOCUSED PHASES:
(Based on Renaissance Periodization methodology)

PHASE 1: ANATOMICAL ADAPTATION (Weeks 1-${phase1End})
├── Volume: ${volumeMarks.MEV}-${volumeMarks.MAV_low} sets/muscle/week
├── Intensity: RPE 6-7
├── Rep Range: 12-15
├── Focus: Prepare tissues, establish habits
├── Progression: Add reps before weight
└── Sets per exercise: 2-3

PHASE 2: HYPERTROPHY I (Weeks ${phase1End + 1}-${phase2End})
├── Volume: ${volumeMarks.MAV_low}-${volumeMarks.MAV_high} sets/muscle/week
├── Intensity: RPE 7-8
├── Rep Range: 8-12
├── Focus: Progressive overload, muscle growth
├── Progression: When all reps hit, add 2.5-5kg
└── Sets per exercise: 3-4

PHASE 3: HYPERTROPHY II (Weeks ${phase2End + 1}-${phase3End})
├── Volume: ${volumeMarks.MAV_high} sets/muscle/week (near MRV)
├── Intensity: RPE 8 (1-2 RIR on most sets)
├── Rep Range: 6-10
├── Focus: Push limits, intensity techniques allowed
├── Techniques: Drop sets, rest-pause on isolation (advanced only)
└── Sets per exercise: 4

PHASE 4: CONSOLIDATION (Weeks ${phase3End + 1}-${totalWeeks})
├── Volume: ${volumeMarks.MAV_low} sets (reduce to consolidate gains)
├── Intensity: RPE 8-9
├── Rep Range: 6-10
├── Focus: Maintain new muscle, prep for next block
└── Sets per exercise: 3-4
`;
  }

  return periodizationPrompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRAINT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildConstraintsSection(inputs: PromptInputs): string {
  const { profile, constraints } = inputs;

  let constraintPrompt = `
═══════════════════════════════════════════════════════════════════════════════
ABSOLUTE CONSTRAINTS (NON-NEGOTIABLE - VIOLATION = REJECTED PLAN)
═══════════════════════════════════════════════════════════════════════════════

CONSTRAINT 1: SESSION LENGTH = EXACTLY ${profile.session_length} MINUTES (±5 min)
──────────────────────────────────────────────────────────────────────────────
Calculate session structure:
- Warmup: ${AGE_MODIFICATIONS[getAgeCategory(profile.age)].warmup_minutes} minutes minimum
- Main Work: ${profile.session_length - AGE_MODIFICATIONS[getAgeCategory(profile.age)].warmup_minutes - 5} minutes
- Cooldown: 5 minutes

If you output a 45-minute session when ${profile.session_length} was requested, THE PLAN IS INVALID.
`;

  // Cardio constraints
  if (constraints.cardio_types && constraints.cardio_types.length > 0) {
    const cardioMap: Record<string, string> = {
      running: 'Treadmill Running',
      'incline walk': 'Incline Treadmill Walk',
      cycling: 'Stationary Bike / Cycling',
      rowing: 'Rowing Machine',
      swimming: 'Swimming',
      elliptical: 'Elliptical Trainer',
      stairs: 'StairMaster / Stair Climber',
    };

    const allowed = constraints.cardio_types.map(t => cardioMap[t.toLowerCase()] || t);
    const forbidden = Object.values(cardioMap).filter(c =>
      !allowed.some(a => a.toLowerCase() === c.toLowerCase())
    );

    constraintPrompt += `
CONSTRAINT 2: CARDIO EXERCISES - USE ONLY THESE
──────────────────────────────────────────────────────────────────────────────
✓ ALLOWED:
${allowed.map(c => `  ✓ ${c}`).join('\n')}

✗ FORBIDDEN (DO NOT USE):
${forbidden.map(c => `  ✗ ${c}`).join('\n')}

User explicitly selected their cardio preferences. Do NOT substitute.
`;
  }

  if (constraints.cardio_duration_minutes) {
    constraintPrompt += `
CONSTRAINT 3: CARDIO DURATION = EXACTLY ${constraints.cardio_duration_minutes} MINUTES
──────────────────────────────────────────────────────────────────────────────
Every cardio session = ${constraints.cardio_duration_minutes} minutes.
Set target_duration_minutes: ${constraints.cardio_duration_minutes} (not ${constraints.cardio_duration_minutes - 10}, not ${constraints.cardio_duration_minutes + 10})
`;
  }

  // Pain point restrictions
  if (constraints.pain_points && constraints.pain_points.length > 0) {
    const painRestrictions: Record<string, { avoid: string[]; substitute: string[] }> = {
      'lower back': {
        avoid: ['Conventional Deadlift', 'Bent Over Barbell Row', 'Good Mornings', 'Sit-ups'],
        substitute: ['Trap Bar Deadlift', 'Chest-Supported Row', 'Hip Hinge with bands', 'Dead Bug'],
      },
      knee: {
        avoid: ['Deep Squat', 'Walking Lunges', 'Jump Squats', 'Leg Extension'],
        substitute: ['Box Squat', 'Reverse Lunges', 'Step-ups', 'Leg Press'],
      },
      shoulder: {
        avoid: ['Behind Neck Press', 'Upright Row', 'Dips (deep)', 'Wide Grip Bench'],
        substitute: ['Front Press', 'Face Pulls', 'Close Grip Bench', 'Neutral Grip Press'],
      },
      wrist: {
        avoid: ['Straight Bar Curls', 'Front Rack Squat', 'Straight Bar Bench heavy'],
        substitute: ['EZ Bar Curls', 'Cross-Arm Front Squat', 'Dumbbell Press'],
      },
    };

    constraintPrompt += `
CONSTRAINT 4: PAIN POINT RESTRICTIONS
──────────────────────────────────────────────────────────────────────────────
User reported: ${constraints.pain_points.join(', ')}

`;
    for (const point of constraints.pain_points) {
      const normalized = point.toLowerCase().replace('knees', 'knee').replace('shoulders', 'shoulder');
      const restriction = painRestrictions[normalized];
      if (restriction) {
        constraintPrompt += `For ${point}:
  ✗ AVOID: ${restriction.avoid.join(', ')}
  ✓ USE INSTEAD: ${restriction.substitute.join(', ')}

`;
      }
    }
  }

  // Equipment constraints
  if (constraints.equipment) {
    const eq = constraints.equipment.toLowerCase();
    if (eq.includes('minimal') || eq.includes('home')) {
      constraintPrompt += `
CONSTRAINT 5: EQUIPMENT - HOME/MINIMAL
──────────────────────────────────────────────────────────────────────────────
User has LIMITED equipment. Assume available:
✓ Dumbbells, Resistance bands, Bodyweight

DO NOT USE (unless confirmed available):
✗ Barbells, Cable machines, Leg press, Smith machine, Specialty machines

SUBSTITUTIONS:
- Barbell Squat → Goblet Squat, Bulgarian Split Squat
- Barbell Bench → Dumbbell Press, Push-ups
- Cable Row → Dumbbell Row, Band Row
- Lat Pulldown → Pull-ups (assisted if needed), Band Pulldown
`;
    }
  }

  return constraintPrompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STARTING WEIGHTS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function buildStartingWeightsSection(strength: CurrentStrength): string {
  const calculated = calculateStartingWeights(strength);
  if (!calculated) {
    return `
STARTING WEIGHTS: Not provided
──────────────────────────────────────────────────────────────────────────────
User did not provide current strength levels.
Start conservatively:
- First session: Find working weight for target rep range at RPE 6-7
- Record weights for Week 2 progression
`;
  }

  return `
═══════════════════════════════════════════════════════════════════════════════
STARTING WEIGHTS (Based on User's Current Strength for 8-10 Reps)
═══════════════════════════════════════════════════════════════════════════════

KNOWN LIFTS (use these EXACTLY in Week 1):
${calculated.squat ? `- Back Squat: ${calculated.squat}kg` : ''}
${calculated.bench ? `- Bench Press: ${calculated.bench}kg` : ''}
${calculated.deadlift ? `- Deadlift: ${calculated.deadlift}kg` : ''}
${calculated.row ? `- Barbell Row: ${calculated.row}kg` : ''}

CALCULATED DERIVATIVES (use these for related exercises):
${calculated.incline_bench ? `- Incline Bench: ${calculated.incline_bench}kg (85% of flat bench)` : ''}
${calculated.overhead_press ? `- Overhead Press: ${calculated.overhead_press}kg (65% of bench)` : ''}
${calculated.front_squat ? `- Front Squat: ${calculated.front_squat}kg (85% of back squat)` : ''}
${calculated.romanian_deadlift ? `- Romanian Deadlift: ${calculated.romanian_deadlift}kg (65% of deadlift)` : ''}
${calculated.dumbbell_bench ? `- Dumbbell Press: ${calculated.dumbbell_bench}kg per hand (40% of barbell)` : ''}

PRESCRIPTION RULES:
- For exercises with known weights: Use EXACT weight in Week 1
- For new exercises: Start at RPE 6, record weight, progress from there
- Never guess - if unsure, start lighter and adjust
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

export function buildMasterPrompt(inputs: PromptInputs): string {
  const { profile, strength, goal, constraints, split } = inputs;

  const totalWeeks = calculateTotalWeeks(goal.target_date);
  const ageCategory = getAgeCategory(profile.age);
  const ageMods = AGE_MODIFICATIONS[ageCategory];
  const sportContext = formatSportPrompt(goal.sport);
  const volumeMarks = getVolumeLandmarks(profile.experience_level);

  const periodization = buildPeriodization(
    totalWeeks,
    goal.primary_goal,
    profile.experience_level,
    profile.age,
    goal.sport
  );

  const constraintsSection = buildConstraintsSection(inputs);
  const startingWeights = buildStartingWeightsSection(strength);

  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                     REBLD AI WORKOUT PLAN GENERATION                          ║
║                                                                               ║
║  Evidence-Based Programming System                                            ║
║  Sources: NSCA, ACSM, Renaissance Periodization, Stronger By Science          ║
╚══════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════
SECTION 1: USER PROFILE
═══════════════════════════════════════════════════════════════════════════════

Age: ${profile.age || 'Not specified'} (Category: ${ageCategory.replace('_', '-')})
Sex: ${profile.sex || 'Not specified'}
Experience Level: ${profile.experience_level.toUpperCase()}
Training Frequency: ${profile.training_frequency} days/week
Session Length: ${profile.session_length} minutes (ABSOLUTE - NOT A SUGGESTION)
Recommended Split: ${TRAINING_SPLITS[profile.training_frequency as keyof typeof TRAINING_SPLITS]?.name || 'Custom'}

AGE-SPECIFIC MODIFICATIONS:
- Minimum warmup: ${ageMods.warmup_minutes} minutes
- Recovery between sessions: ${ageMods.recovery_hours} hours minimum
- Maximum RPE: ${ageMods.max_rpe}
- Preferred rep range: ${ageMods.rep_range}

VOLUME TARGETS FOR ${profile.experience_level.toUpperCase()} (sets/muscle group/week):
- Start at: ${volumeMarks.MEV} sets (MEV)
- Build toward: ${volumeMarks.MAV_low}-${volumeMarks.MAV_high} sets (MAV)
- Never exceed: ${volumeMarks.MRV} sets (MRV)

${startingWeights}

═══════════════════════════════════════════════════════════════════════════════
SECTION 2: GOAL & PROGRAM CONFIGURATION
═══════════════════════════════════════════════════════════════════════════════

Primary Goal: ${goal.primary_goal}
Sport/Activity: ${goal.sport || 'General Fitness'}
${goal.target_date ? `Target Event: ${goal.event_name || 'Competition'} on ${goal.target_date}` : 'No target date - using default 12-week program'}

TOTAL PROGRAM LENGTH: ${totalWeeks} WEEKS

${goal.additional_notes ? `User Notes: ${goal.additional_notes}` : ''}

${periodization}

═══════════════════════════════════════════════════════════════════════════════
SECTION 3: SPORT-SPECIFIC PROTOCOL
═══════════════════════════════════════════════════════════════════════════════

${sportContext || 'No sport-specific requirements. Use general fitness programming.'}

${constraintsSection}

═══════════════════════════════════════════════════════════════════════════════
SECTION 4: TRAINING SPLIT CONFIGURATION
═══════════════════════════════════════════════════════════════════════════════

Sessions Per Day: ${split.sessions_per_day}
${split.sessions_per_day === 2 ? `
Split Type: ${split.training_type}
AM Session: ${split.training_type === 'strength_plus_cardio' ? 'Cardio/Conditioning' : 'Heavy Compounds'}
PM Session: ${split.training_type === 'strength_plus_cardio' ? 'Strength Training' : 'Accessory Work'}

Output "sessions" array for 2x daily instead of "blocks"
` : `
Single session per day - output "blocks" array
`}

Training Days: ${profile.training_frequency} days/week
${profile.training_frequency <= 3 ? 'Use FULL BODY split - each session trains all major muscle groups' : ''}
${profile.training_frequency === 4 ? 'Use UPPER/LOWER split' : ''}
${profile.training_frequency === 5 ? 'Use UPPER/LOWER/PUSH/PULL/LEGS or similar' : ''}
${profile.training_frequency >= 6 ? 'Use PUSH/PULL/LEGS split' : ''}

═══════════════════════════════════════════════════════════════════════════════
SECTION 5: OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════

Return ONLY valid JSON with this structure:

{
  "name": "Program name based on goal",
  "totalWeeks": ${totalWeeks},
  "currentPhase": "Phase 1 name",
  "weeklyPlan": [
    {
      "day_of_week": 1,
      "focus": "Upper Body / Lower Body / Full Body / Rest",
      "estimated_duration": ${profile.session_length},
      "blocks": [
        {
          "type": "single" | "superset" | "circuit",
          "exercises": [
            {
              "exercise_name": "Exercise Name",
              "category": "warmup" | "main" | "cooldown",
              "metrics_template": {
                "type": "sets_reps_weight",
                "target_sets": 3,
                "target_reps": "8-10",
                "target_weight_kg": 60,
                "rest_period_s": 90
              },
              "rpe": "7-8",
              "notes": "Form cues"
            }
          ]
        }
      ]
    }
  ],
  "progressionRules": {
    "currentWeek": 1,
    "phases": [
      {
        "name": "Phase name",
        "weeks": [1, 2, 3, 4],
        "volumeTarget": "${volumeMarks.MEV}-${volumeMarks.MAV_low} sets/muscle",
        "intensityTarget": "RPE 6-7",
        "repRange": "${ageMods.rep_range}",
        "progression": "Add reps until top of range, then add weight"
      }
    ],
    "deloadWeeks": [${Math.floor(totalWeeks / 3)}, ${Math.floor(totalWeeks * 2 / 3)}],
    "weeklyProgression": "${TWO_FOR_TWO_RULE.trim().split('\n')[1]}"
  },
  "startingWeights": {
    "Squat": ${strength.squat_kg || 'null'},
    "Bench Press": ${strength.bench_kg || 'null'},
    "Deadlift": ${strength.deadlift_kg || 'null'},
    "Row": ${strength.row_kg || 'null'}
  }
}

METRICS TEMPLATE TYPES (use EXACTLY as shown):
- "sets_reps_weight": { "type": "sets_reps_weight", "target_sets": 3, "target_reps": "8-10", "rest_period_s": 90 }
- "duration_only": { "type": "duration_only", "duration_minutes": 30 } - MUST include duration_minutes for cardio
- "sets_duration": { "type": "sets_duration", "target_sets": 3, "duration_seconds": 60 } - planks, holds
- "distance_time": { "type": "distance_time", "target_distance_km": 5 } - running with distance

CRITICAL: For cardio exercises (treadmill, bike, etc.), use "duration_only" with "duration_minutes" field.

═══════════════════════════════════════════════════════════════════════════════
FINAL CHECKLIST (Verify before output)
═══════════════════════════════════════════════════════════════════════════════

□ Total session duration = ${profile.session_length} minutes (±5)
□ Warmup duration = ${ageMods.warmup_minutes}+ minutes
□ Volume = ${volumeMarks.MEV}-${volumeMarks.MAV_low} sets per muscle group
□ RPE does not exceed ${ageMods.max_rpe}
□ Rep range = ${ageMods.rep_range}
□ Cardio types = ONLY user-selected options
□ Cardio duration = EXACTLY ${constraints.cardio_duration_minutes || 'N/A'} minutes
□ Pain point exercises = AVOIDED
□ All ${profile.training_frequency} training days included (rest days marked)
□ Sport-specific exercises included (if applicable)
□ Starting weights match user's current strength

Return ONLY valid JSON. No text before or after.
`;
}

/**
 * Validate generated plan against constraints
 */
export function validatePlanConstraints(
  plan: any,
  inputs: PromptInputs
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { profile, constraints } = inputs;

  // Validate session lengths
  if (plan.weeklyPlan) {
    for (const day of plan.weeklyPlan) {
      if (day.estimated_duration && day.blocks?.length > 0) {
        const diff = Math.abs(day.estimated_duration - profile.session_length);
        if (diff > 10) {
          errors.push(
            `Day ${day.day_of_week}: Duration ${day.estimated_duration}min violates ${profile.session_length}min constraint`
          );
        }
      }
    }
  }

  // Validate cardio types
  if (constraints.cardio_types?.length && plan.weeklyPlan) {
    const allowed = new Set(constraints.cardio_types.map(c => c.toLowerCase()));
    for (const day of plan.weeklyPlan) {
      for (const block of day.blocks || []) {
        for (const ex of block.exercises || []) {
          const name = ex.exercise_name?.toLowerCase() || '';
          if (name.includes('run') || name.includes('bike') || name.includes('row') ||
              name.includes('elliptical') || name.includes('swim') || name.includes('cardio')) {
            let found = false;
            const allowedArray = Array.from(allowed);
            for (let i = 0; i < allowedArray.length; i++) {
              if (name.includes(allowedArray[i])) found = true;
            }
            if (!found) errors.push(`Forbidden cardio: ${ex.exercise_name}`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build a BRIEF evidence-based prompt section that complements (not replaces) the existing prompt
 * This adds scientific guidance without conflicting with the main JSON schema
 */
export function buildBriefMasterPrompt(inputs: PromptInputs): string {
  const { profile, strength } = inputs;

  const exp = profile.experience_level;
  const volumeMarks = VOLUME_LANDMARKS[exp as keyof typeof VOLUME_LANDMARKS] || VOLUME_LANDMARKS.intermediate;
  const ageMods = getAgeModifications(profile.age);

  // Calculate starting weights if provided
  let startingWeightsInfo = '';
  if (strength.squat_kg || strength.bench_kg || strength.deadlift_kg) {
    const calculated = calculateStartingWeights(strength);
    startingWeightsInfo = `
**STARTING WEIGHTS (from user's known lifts):**
${strength.squat_kg ? `- Back Squat: ${calculated.squat}kg` : ''}
${strength.bench_kg ? `- Bench Press: ${calculated.bench}kg` : ''}
${strength.deadlift_kg ? `- Deadlift: ${calculated.deadlift}kg` : ''}
${strength.bench_kg ? `- Overhead Press: ${calculated.overhead_press}kg (65% of bench)` : ''}
${strength.squat_kg ? `- Front Squat: ${calculated.front_squat}kg (85% of back squat)` : ''}
Use these weights in Week 1 exercises.`;
  }

  return `
**═══════════════════════════════════════════════════════════════**
**EVIDENCE-BASED TRAINING SCIENCE (NSCA, ACSM, RP)**
**═══════════════════════════════════════════════════════════════**

**User Profile:**
- Age: ${profile.age || 'Not specified'}${profile.age ? ` (Category: ${getAgeCategory(profile.age).replace('_', '-')})` : ''}
- Experience: ${exp.toUpperCase()}
- Max RPE this session: ${ageMods.max_rpe}
- Minimum warmup: ${ageMods.warmup_minutes} minutes

**Volume Targets for ${exp.toUpperCase()}:**
- Start: ${volumeMarks.MEV} sets/muscle (Minimum Effective Volume)
- Target: ${volumeMarks.MAV_low}-${volumeMarks.MAV_high} sets/muscle (Maximum Adaptive Volume)
- Never exceed: ${volumeMarks.MRV} sets/muscle (Maximum Recoverable Volume)

**Progression Rule (2-for-2):**
When user completes target reps on final 2 sets for 2 consecutive workouts, increase weight:
- Upper body: +2.5kg
- Lower body: +5kg

${startingWeightsInfo}

**IMPORTANT: Use the JSON schema shown below - do NOT modify the structure.**
**═══════════════════════════════════════════════════════════════**
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPORT-SPECIFIC CONTEXT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get deep sport-specific context for intelligent plan generation
 * This tells the AI exactly what the sport demands
 */
export function getSportSpecificContext(eventType: string | null | undefined): string {
  if (!eventType) return '';

  const eventLower = eventType.toLowerCase();

  const contexts: Record<string, string> = {
    'hyrox': `**EVENT: HYROX**
- Demands: High-threshold aerobic power + functional strength
- Race Format: 8km run (1km segments) + 8 functional stations
- Programming Focus: Compromised running (run after heavy legs)
- Key Lifts: Sled Push, Sled Pull, Weighted Lunges, Wall Balls, SkiErg, Rowing
- Conditioning: 80% Zone 2 base, 20% race-pace intervals
- Critical: Practice running with fatigued legs (brick workouts)`,

    'marathon': `**EVENT: MARATHON**
- Demands: Aerobic capacity, tissue tolerance, mental endurance
- Programming: Polarized training (80% easy Zone 2, 20% hard threshold/intervals)
- Strength Focus: Single-leg stability, glute strength, core endurance
- Key Exercises: Single Leg Romanian Deadlift, Step-ups, Calf Raises, Hip Stability
- Running: Long slow runs (60-90min), Tempo runs, Interval 400s/800s
- Avoid: Heavy bilateral squats (interferes with running recovery)`,

    'triathlon': `**EVENT: TRIATHLON**
- Demands: Multi-sport aerobic capacity, transitions, brick training
- Programming: Structured periodization across swim/bike/run
- Strength Focus: Swim pulling strength, cycling power, run stability
- Key Exercises: Pull-ups/Lat Pulldown, Single Leg Press, Shoulder Rotation
- Critical: Brick workouts (bike-to-run transitions), practice transitions
- Avoid: Heavy upper body (swim shoulder health)`,

    'powerlifting': `**EVENT: POWERLIFTING**
- Demands: Maximal strength in squat/bench/deadlift
- Programming: Periodized blocks (accumulation → intensification → peaking)
- Key Exercises: Competition Squat/Bench/Deadlift, Pause variations, Accessories
- Peaking: Reduce volume, increase intensity toward competition
- Critical: Technique work, bracing, competition form practice
- GPP: Sled work, carries, light conditioning only`,

    'crossfit': `**EVENT: CROSSFIT**
- Demands: Work capacity, varied movement skills, gymnastics, Olympic lifts
- Programming: Mixed modal training, skill work, engine building
- Key Exercises: Olympic lifts, Gymnastics movements, Monostructural cardio
- Conditioning: High-intensity intervals, AMRAP, EMOM, For Time workouts
- Skill Focus: Double-unders, muscle-ups, handstands, Olympic lift technique
- Critical: GPP base, movement efficiency, pacing strategy`,

    'bodybuilding': `**EVENT: BODYBUILDING**
- Demands: Muscle hypertrophy, symmetry, definition
- Programming: High volume, progressive overload, mind-muscle connection
- Key Principles: Time under tension, metabolic stress, mechanical tension
- Split: Body part focused (PPL or Bro split for frequency)
- Critical: Eat to support growth, progressive overload, adequate volume
- Avoid: Excessive cardio that interferes with recovery`,
  };

  // Return exact match or partial match
  for (const [key, value] of Object.entries(contexts)) {
    if (eventLower.includes(key) || key.includes(eventLower)) {
      return value;
    }
  }

  return '';
}

/**
 * Get readiness-based training context
 * Adjusts programming based on user's current readiness level
 */
export function getReadinessContext(level: number | null | undefined): string {
  if (level === null || level === undefined) return '';

  if (level <= 3) {
    return `**READINESS: LOW (${level}/10) - RECOVERY FOCUS**
- Reduce volume by 30-40% from normal
- Cap RPE at 6-7 (no grinding reps)
- Avoid failure on all sets
- Prioritize movement quality over load
- Consider: Light cardio, mobility work, active recovery
- This is NOT a deload - user may be fatigued/stressed`;
  }

  if (level <= 5) {
    return `**READINESS: MODERATE-LOW (${level}/10)**
- Reduce volume by 15-20%
- Cap RPE at 7-8
- Focus on technique refinement
- Normal warmup, but be patient with heavy weights
- Monitor fatigue throughout session`;
  }

  if (level <= 7) {
    return `**READINESS: MODERATE (${level}/10) - STANDARD TRAINING**
- Normal volume and intensity
- Standard progressive overload
- RPE targets as planned
- Good day for consistent training`;
  }

  if (level <= 9) {
    return `**READINESS: HIGH (${level}/10) - PUSH DAY**
- Can push intensity higher (add 2-5% to planned weights)
- RPE 8-9 acceptable on compounds
- Good day for PR attempts if planned
- Take advantage of feeling strong`;
  }

  return `**READINESS: PEAK (${level}/10) - TEST DAY**
- Optimal day for heavy singles/doubles
- Test new maxes if in appropriate phase
- Full intensity work
- Capitalize on peak readiness`;
}

/**
 * Get goal-specific training emphasis
 */
export function getGoalEmphasis(goal: string | null | undefined): string {
  if (!goal) return '';

  const goalLower = goal.toLowerCase();

  if (goalLower.includes('strength') || goalLower.includes('strong')) {
    return `**GOAL EMPHASIS: STRENGTH**
- Rep ranges: 3-6 for compounds, 6-10 for accessories
- Rest periods: 3-5 minutes between heavy sets
- Focus: Progressive overload on main lifts
- Volume: MEV-MAV range, quality over quantity`;
  }

  if (goalLower.includes('muscle') || goalLower.includes('hypertrophy') || goalLower.includes('size')) {
    return `**GOAL EMPHASIS: HYPERTROPHY**
- Rep ranges: 8-15 for most exercises
- Rest periods: 60-90 seconds
- Focus: Time under tension, mind-muscle connection
- Volume: MAV-MRV range, accumulate volume`;
  }

  if (goalLower.includes('fat loss') || goalLower.includes('weight loss') || goalLower.includes('lean')) {
    return `**GOAL EMPHASIS: FAT LOSS / BODY RECOMPOSITION**
- Maintain strength training (don't just do cardio)
- Rep ranges: 8-12 to preserve muscle
- Add Zone 2 cardio: 2-4 sessions x 30-45 minutes
- Focus: Preserve muscle mass while in deficit
- Critical: Protein intake, sleep, stress management`;
  }

  if (goalLower.includes('endurance') || goalLower.includes('cardio')) {
    return `**GOAL EMPHASIS: ENDURANCE**
- 80/20 polarized training (80% easy, 20% hard)
- Strength: 2x/week maintenance only
- Focus: Building aerobic base (Zone 2)
- Avoid: Heavy lifting that interferes with conditioning`;
  }

  return '';
}
