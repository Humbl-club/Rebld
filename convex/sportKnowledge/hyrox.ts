/**
 * HYROX Knowledge Base
 *
 * Complete, research-validated training data for Hyrox competition preparation.
 * Used by prompt assembly and plan validation.
 *
 * Sources:
 * 1. Brandt et al. (2025) - "Physiological predictors of HYROX performance"
 * 2. HYROX Official Competition Rules (2024/2025 Season)
 * 3. Tactical Barbell - K. Black
 * 4. The Hybrid Athlete - Alex Viada
 * 5. Science of Running - Steve Magness
 * 6. 80/20 Running - Matt Fitzgerald
 * 7. Advanced Marathoning - Pete Pfitzinger
 * 8. Endure - Alex Hutchinson
 * 9. High-Intensity Interval Training - Laursen & Buchheit
 * 10. Norwegian 4x4 Protocol Research
 */

// ============================================================================
// TYPES
// ============================================================================

export type Division = 'open' | 'pro' | 'doubles' | 'relay';
export type Phase = 'BASE' | 'BUILD' | 'PEAK' | 'TAPER';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface StationSpec {
  name: string;
  distance?: string;
  reps?: string;
  weight: {
    menOpen: string;
    womenOpen: string;
    menPro: string;
    womenPro: string;
  };
  technique: string[];
  commonMistakes: string[];
  targetTime: {
    beginner: string;
    intermediate: string;
    advanced: string;
  };
}

export interface PhaseConfig {
  name: Phase;
  weekRange: string;
  primaryFocus: string;
  secondaryFocus: string;
  volumeTarget: {
    running: { beginner: string; intermediate: string; advanced: string };
    strength: { beginner: string; intermediate: string; advanced: string };
  };
  intensityDistribution: {
    zone1_2: string;
    zone3: string;
    zone4_5: string;
  };
  keyWorkouts: string[];
  stationFrequency: string;
}

export interface SessionTemplate {
  name: string;
  focus: string;
  duration: string;
  structure: {
    warmup: string;
    main: string[];
    cooldown: string;
  };
}

export interface InjuryRisk {
  area: string;
  commonIn: string[];
  prevention: string[];
  warningSignsSigns: string[];
  modifications: string[];
}

// ============================================================================
// COMPETITION FORMAT
// ============================================================================

export const COMPETITION_FORMAT = {
  totalDistance: '8km running',
  runSegments: '8 x 1km',
  stations: 8,
  divisions: {
    open: {
      description: 'Standard competition format',
      finishTime: { top: '55-65min', competitive: '70-80min', completion: '90-120min' },
    },
    pro: {
      description: 'Elite division with heavier weights',
      finishTime: { top: '50-58min', competitive: '60-70min' },
    },
    doubles: {
      description: 'Team of 2, alternating stations',
      finishTime: { top: '50-60min', competitive: '65-75min' },
    },
  },
} as const;

export const STATIONS: Record<string, StationSpec> = {
  skierg: {
    name: 'SkiErg',
    distance: '1000m',
    weight: { menOpen: 'N/A', womenOpen: 'N/A', menPro: 'N/A', womenPro: 'N/A' },
    technique: [
      'Hinge at hips, not waist',
      'Arms stay straight through pull',
      'Full extension overhead at start of each stroke',
      'Drive through legs AND arms simultaneously',
      'Maintain 28-32 strokes per minute for efficiency',
    ],
    commonMistakes: [
      'Pulling only with arms (wastes energy)',
      'Short range of motion',
      'Too high stroke rate (burns out quickly)',
      'Standing too upright (reduces power)',
    ],
    targetTime: {
      beginner: '5:30-6:30',
      intermediate: '4:30-5:30',
      advanced: '3:45-4:30',
    },
  },

  sled_push: {
    name: 'Sled Push',
    distance: '50m',
    weight: {
      menOpen: '152kg',
      womenOpen: '102kg',
      menPro: '202kg',
      womenPro: '152kg',
    },
    technique: [
      'Low body position - chest near handles',
      'Drive through balls of feet',
      'Short, powerful steps',
      'Keep arms locked, push through legs',
      'Eyes forward, not down',
    ],
    commonMistakes: [
      'Standing too upright (less leverage)',
      'Long strides (wastes energy)',
      'Pushing with arms instead of legs',
      'Starting too fast and dying',
    ],
    targetTime: {
      beginner: '1:30-2:30',
      intermediate: '0:45-1:30',
      advanced: '0:30-0:45',
    },
  },

  sled_pull: {
    name: 'Sled Pull',
    distance: '50m',
    weight: {
      menOpen: '103kg',
      womenOpen: '78kg',
      menPro: '153kg',
      womenPro: '103kg',
    },
    technique: [
      'Sit back into pulling stance',
      'Hand-over-hand technique',
      'Create rope pile between legs',
      'Pull to chest, not overhead',
      'Stay low and anchored',
    ],
    commonMistakes: [
      'Standing too tall (reduces pulling power)',
      'Letting rope scatter',
      'Pulling with straight arms only',
      'Not resetting grip between pulls',
    ],
    targetTime: {
      beginner: '1:30-2:30',
      intermediate: '0:50-1:30',
      advanced: '0:35-0:50',
    },
  },

  burpee_broad_jump: {
    name: 'Burpee Broad Jump',
    distance: '80m',
    weight: { menOpen: 'bodyweight', womenOpen: 'bodyweight', menPro: 'bodyweight', womenPro: 'bodyweight' },
    technique: [
      'Step-down burpee saves energy vs jump-back',
      'Minimal jump height - distance matters',
      'Land soft, immediately transition to next',
      'Find sustainable rhythm, don\'t race start',
      'Roughly 30-35 reps to cover 80m',
    ],
    commonMistakes: [
      'Jump-back burpees (too fatiguing)',
      'Jumping high instead of far',
      'Starting too fast',
      'Full push-up depth (wastes energy)',
    ],
    targetTime: {
      beginner: '4:00-6:00',
      intermediate: '3:00-4:00',
      advanced: '2:00-3:00',
    },
  },

  rowing: {
    name: 'Rowing',
    distance: '1000m',
    weight: { menOpen: 'N/A', womenOpen: 'N/A', menPro: 'N/A', womenPro: 'N/A' },
    technique: [
      'Legs-back-arms sequence on drive',
      'Arms-back-legs on recovery',
      'Damper setting 4-6 for most',
      'Target 24-28 strokes per minute',
      'Drive ratio 1:2 (quick drive, slow recovery)',
    ],
    commonMistakes: [
      'Arms before legs (power leak)',
      'Damper too high (exhausting)',
      'Stroke rate too high',
      'Slouching at catch position',
    ],
    targetTime: {
      beginner: '4:30-5:30',
      intermediate: '3:45-4:30',
      advanced: '3:15-3:45',
    },
  },

  farmers_carry: {
    name: 'Farmers Carry',
    distance: '200m',
    weight: {
      menOpen: '2x24kg',
      womenOpen: '2x16kg',
      menPro: '2x32kg',
      womenPro: '2x24kg',
    },
    technique: [
      'Tall posture, shoulders back',
      'Short, quick steps',
      'Grip kettlebells at center of handle',
      'Breathe rhythmically',
      'Look forward, not down',
    ],
    commonMistakes: [
      'Leaning forward',
      'Long strides (slower overall)',
      'Holding breath',
      'Grip too close to bell',
    ],
    targetTime: {
      beginner: '2:00-3:00',
      intermediate: '1:15-2:00',
      advanced: '0:50-1:15',
    },
  },

  sandbag_lunges: {
    name: 'Sandbag Lunges',
    distance: '100m',
    weight: {
      menOpen: '20kg',
      womenOpen: '10kg',
      menPro: '30kg',
      womenPro: '20kg',
    },
    technique: [
      'Bag on shoulders, not upper back',
      'Knee touches ground each rep',
      'Drive through front heel',
      'Short steps to maintain rhythm',
      'Keep torso upright',
    ],
    commonMistakes: [
      'Bag sliding to neck (dangerous)',
      'Not touching knee to ground',
      'Leaning too far forward',
      'Steps too long',
    ],
    targetTime: {
      beginner: '3:00-4:30',
      intermediate: '2:00-3:00',
      advanced: '1:30-2:00',
    },
  },

  wall_balls: {
    name: 'Wall Balls',
    reps: '75-100 reps',
    weight: {
      menOpen: '9kg to 3m',
      womenOpen: '6kg to 2.7m',
      menPro: '9kg to 3m',
      womenPro: '6kg to 3m',
    },
    technique: [
      'Catch at face height, not overhead',
      'Squat depth just below parallel',
      'Drive through heels on ascent',
      'Release at peak of squat drive',
      'Find sustainable pace: sets of 15-25',
    ],
    commonMistakes: [
      'Squatting too deep (wastes energy)',
      'Arms throwing vs legs driving',
      'Standing too far from wall',
      'Going unbroken (leads to failure)',
    ],
    targetTime: {
      beginner: '5:00-7:00',
      intermediate: '3:30-5:00',
      advanced: '2:30-3:30',
    },
  },
};

// ============================================================================
// TIME BENCHMARKS BY DIVISION
// ============================================================================

export const TIME_BENCHMARKS = {
  total: {
    elite: { men: '<58min', women: '<65min' },
    competitive: { men: '65-75min', women: '75-85min' },
    finisher: { men: '80-100min', women: '90-110min' },
  },
  running: {
    perKm: {
      elite: '3:45-4:15/km',
      competitive: '4:30-5:00/km',
      finisher: '5:30-6:30/km',
    },
    total8km: {
      elite: '30-34min',
      competitive: '36-40min',
      finisher: '44-52min',
    },
  },
} as const;

// ============================================================================
// TRAINING PRINCIPLES (Research-Backed)
// ============================================================================

export const TRAINING_PRINCIPLES = {
  /**
   * Source: Brandt et al. 2025
   * VO2max correlation with performance: r = -0.71 (strongest predictor)
   * Running economy: r = -0.65
   * Lactate threshold: r = -0.58
   */
  physiologicalPriorities: [
    {
      factor: 'VO2max',
      correlation: -0.71,
      training: 'Norwegian 4x4 intervals, Zone 2 base building',
      weeklyVolume: '2-3 sessions',
    },
    {
      factor: 'Running economy',
      correlation: -0.65,
      training: 'Easy running, strides, technique drills',
      weeklyVolume: '60-70% of running volume',
    },
    {
      factor: 'Lactate threshold',
      correlation: -0.58,
      training: 'Tempo runs, threshold intervals',
      weeklyVolume: '1-2 sessions',
    },
    {
      factor: 'Grip endurance',
      correlation: -0.45,
      training: 'Carries, hangs, sled work',
      weeklyVolume: '2-3 sessions',
    },
  ],

  /**
   * Source: 80/20 Running (Fitzgerald), Norwegian research
   * Polarized distribution outperforms threshold-focused for endurance
   */
  polarizedTraining: {
    zone1_2: '80%',
    zone3: '0%',
    zone4_5: '20%',
    explanation: 'No "gray zone" training. Either easy enough to recover, or hard enough to adapt.',
  },

  /**
   * Source: Tactical Barbell, Hybrid Athlete research
   * Concurrent training interference is real but manageable
   */
  concurrentTraining: {
    principle: 'Strength maintains, endurance builds',
    strengthFrequency: '2-3x/week',
    strengthFocus: 'Maintain, not build (except off-season)',
    runningFirst: 'Key running sessions on fresh legs',
    separation: '6-8 hours between strength and key runs when possible',
  },
} as const;

// ============================================================================
// PHASE DEFINITIONS
// ============================================================================

export const PHASES: Record<Phase, PhaseConfig> = {
  BASE: {
    name: 'BASE',
    weekRange: '>12 weeks out',
    primaryFocus: 'Aerobic foundation, running volume',
    secondaryFocus: 'Strength maintenance, station familiarization',
    volumeTarget: {
      running: {
        beginner: '20-30km/week',
        intermediate: '35-50km/week',
        advanced: '50-70km/week',
      },
      strength: {
        beginner: '2x/week full body',
        intermediate: '2-3x/week',
        advanced: '2-3x/week',
      },
    },
    intensityDistribution: {
      zone1_2: '85%',
      zone3: '0%',
      zone4_5: '15%',
    },
    keyWorkouts: [
      'Long run 60-90min (Zone 2)',
      'Easy runs 30-45min',
      '1x VO2max session (4x4min or 5x5min)',
      'Station practice 1x/week (technique focus)',
    ],
    stationFrequency: '1x/week rotation through all stations',
  },

  BUILD: {
    name: 'BUILD',
    weekRange: '6-12 weeks out',
    primaryFocus: 'Race-specific intervals, station conditioning',
    secondaryFocus: 'Running intensity, grip endurance',
    volumeTarget: {
      running: {
        beginner: '25-35km/week',
        intermediate: '40-55km/week',
        advanced: '55-75km/week',
      },
      strength: {
        beginner: '2x/week',
        intermediate: '2x/week',
        advanced: '2x/week',
      },
    },
    intensityDistribution: {
      zone1_2: '80%',
      zone3: '0%',
      zone4_5: '20%',
    },
    keyWorkouts: [
      '1km repeats at race pace (6-8x)',
      'Tempo runs 20-30min',
      'Station circuits 2x/week',
      'Grip conditioning 2x/week',
      'Race simulation (partial)',
    ],
    stationFrequency: '2x/week, paired station practice',
  },

  PEAK: {
    name: 'PEAK',
    weekRange: '2-6 weeks out',
    primaryFocus: 'Race simulation, pacing practice',
    secondaryFocus: 'Sharpening, confidence building',
    volumeTarget: {
      running: {
        beginner: '20-25km/week',
        intermediate: '30-40km/week',
        advanced: '40-55km/week',
      },
      strength: {
        beginner: '1-2x/week',
        intermediate: '2x/week',
        advanced: '2x/week',
      },
    },
    intensityDistribution: {
      zone1_2: '75%',
      zone3: '0%',
      zone4_5: '25%',
    },
    keyWorkouts: [
      'Full race simulation 1-2x',
      'Partial simulations (4 stations + 4km)',
      'Race pace 1km intervals',
      'Reduced volume, maintained intensity',
    ],
    stationFrequency: '2-3x/week race simulation',
  },

  TAPER: {
    name: 'TAPER',
    weekRange: '<2 weeks out',
    primaryFocus: 'Recovery, freshness',
    secondaryFocus: 'Mental preparation, logistics',
    volumeTarget: {
      running: {
        beginner: '10-15km/week',
        intermediate: '15-25km/week',
        advanced: '25-35km/week',
      },
      strength: {
        beginner: '1x/week light',
        intermediate: '1x/week light',
        advanced: '1x/week light',
      },
    },
    intensityDistribution: {
      zone1_2: '70%',
      zone3: '0%',
      zone4_5: '30%',
    },
    keyWorkouts: [
      'Easy runs only',
      '2-3 short pickups at race pace',
      'Light station touch (technique only)',
      'Rest and nutrition focus',
    ],
    stationFrequency: '1x max, technique only',
  },
};

// ============================================================================
// SESSION TEMPLATES BY DAYS/WEEK
// ============================================================================

export const SESSION_TEMPLATES: Record<number, SessionTemplate[]> = {
  3: [
    {
      name: 'Running Focus',
      focus: 'Aerobic base + intervals',
      duration: '60-75min',
      structure: {
        warmup: '10min easy jog + dynamic stretches',
        main: [
          'Main set: varies by phase (long run OR intervals)',
          'Example: 6x1km at race pace with 90s recovery',
        ],
        cooldown: '10min easy jog + stretching',
      },
    },
    {
      name: 'Station Practice',
      focus: 'Competition stations',
      duration: '45-60min',
      structure: {
        warmup: '10min easy cardio + mobility',
        main: [
          'Rotate through 4 stations',
          '2-3 sets per station',
          'Practice transitions',
        ],
        cooldown: 'Light stretching + grip recovery',
      },
    },
    {
      name: 'Hybrid Conditioning',
      focus: 'Running + stations combined',
      duration: '60-75min',
      structure: {
        warmup: '10min easy run',
        main: [
          '4x (400m run + 1 station)',
          'Or: 3x (800m run + 2 stations)',
        ],
        cooldown: '10min easy jog',
      },
    },
  ],

  4: [
    {
      name: 'Easy Run',
      focus: 'Recovery, aerobic base',
      duration: '30-45min',
      structure: {
        warmup: '5min walk',
        main: ['Zone 2 running, conversational pace'],
        cooldown: '5min walk + stretching',
      },
    },
    {
      name: 'Interval Run',
      focus: 'VO2max, race pace',
      duration: '60min',
      structure: {
        warmup: '15min easy + strides',
        main: [
          'Phase dependent:',
          'BASE: 4x4min hard / 3min easy',
          'BUILD: 6x1km race pace / 90s rest',
          'PEAK: Race simulation',
        ],
        cooldown: '10min easy',
      },
    },
    {
      name: 'Strength + Stations',
      focus: 'Functional strength',
      duration: '60min',
      structure: {
        warmup: '10min easy cardio',
        main: [
          'Strength: Deadlift, Squat, Row (3x5)',
          'Stations: 3-4 stations, 2 sets each',
        ],
        cooldown: 'Stretching',
      },
    },
    {
      name: 'Long Run',
      focus: 'Aerobic endurance',
      duration: '75-120min',
      structure: {
        warmup: 'Start easy, build into pace',
        main: ['Steady Zone 2 effort', 'Practice nutrition if >90min'],
        cooldown: 'Walk, stretch, refuel',
      },
    },
  ],

  5: [
    {
      name: 'Easy Run',
      focus: 'Recovery',
      duration: '30-40min',
      structure: {
        warmup: 'Start slow',
        main: ['Zone 2'],
        cooldown: 'Stretch',
      },
    },
    {
      name: 'Interval Session',
      focus: 'VO2max / Race pace',
      duration: '60min',
      structure: {
        warmup: '15min + strides',
        main: ['See 4-day template'],
        cooldown: '10min easy',
      },
    },
    {
      name: 'Strength',
      focus: 'Posterior chain, grip',
      duration: '45-60min',
      structure: {
        warmup: 'Dynamic mobility',
        main: [
          'Deadlift 3x5',
          'Bulgarian Split Squat 3x8/leg',
          'Pull-ups 3x max',
          'Farmers carry 3x40m',
        ],
        cooldown: 'Stretch',
      },
    },
    {
      name: 'Station Circuit',
      focus: 'Race simulation',
      duration: '60-75min',
      structure: {
        warmup: '10min easy run',
        main: [
          '4-8 stations with running between',
          'Build to full simulation in PEAK',
        ],
        cooldown: 'Easy movement',
      },
    },
    {
      name: 'Long Run',
      focus: 'Aerobic base',
      duration: '90-120min',
      structure: {
        warmup: 'Build in',
        main: ['Steady Zone 2'],
        cooldown: 'Walk, stretch',
      },
    },
  ],

  6: [
    {
      name: 'Easy Run',
      focus: 'Recovery',
      duration: '30min',
      structure: { warmup: 'None', main: ['Easy'], cooldown: 'Stretch' },
    },
    {
      name: 'Intervals',
      focus: 'Speed',
      duration: '60min',
      structure: {
        warmup: '15min',
        main: ['Race pace work'],
        cooldown: '10min',
      },
    },
    {
      name: 'Strength A',
      focus: 'Lower body',
      duration: '50min',
      structure: {
        warmup: 'Mobility',
        main: ['Squat, RDL, Lunges'],
        cooldown: 'Stretch',
      },
    },
    {
      name: 'Tempo Run',
      focus: 'Threshold',
      duration: '50min',
      structure: {
        warmup: '10min',
        main: ['20-30min tempo'],
        cooldown: '10min',
      },
    },
    {
      name: 'Stations',
      focus: 'Competition prep',
      duration: '60min',
      structure: {
        warmup: '10min',
        main: ['All stations'],
        cooldown: 'Easy',
      },
    },
    {
      name: 'Long Run',
      focus: 'Endurance',
      duration: '90-120min',
      structure: {
        warmup: 'Build in',
        main: ['Zone 2'],
        cooldown: 'Walk',
      },
    },
  ],
};

// ============================================================================
// ANTI-PATTERNS (What NOT to do)
// ============================================================================

export const ANTI_PATTERNS = [
  {
    mistake: 'Bodybuilding splits (Push/Pull/Legs)',
    why: 'Hyrox requires concurrent training, not muscle isolation. PPL fragments running recovery.',
    instead: 'Full body strength 2-3x/week, running as primary training mode.',
  },
  {
    mistake: 'Neglecting running for stations',
    why: 'Running is 8km of the race. Stations total <15min for elites. Running is the differentiator.',
    instead: '60-70% of training time on running, 20-30% on stations.',
  },
  {
    mistake: 'Gray zone training',
    why: 'Moderate intensity (Zone 3) creates fatigue without adaptation. Polarized training works.',
    instead: '80% easy (Zone 1-2), 20% hard (Zone 4-5). No "tempo every day."',
  },
  {
    mistake: 'Building strength in-season',
    why: 'Concurrent strength gains interfere with endurance adaptation.',
    instead: 'Maintain strength with 2x/week, build in off-season only.',
  },
  {
    mistake: 'Station practice without running fatigue',
    why: 'Stations feel different on fresh legs vs. after 1km runs.',
    instead: 'Practice stations after running segments, simulate race conditions.',
  },
  {
    mistake: 'Skipping long runs',
    why: 'Aerobic base is foundation. Long run builds mitochondria, capillaries, fat oxidation.',
    instead: 'Weekly long run mandatory, even in PEAK phase (just shorter).',
  },
  {
    mistake: 'Too much high intensity',
    why: 'Recovery debt accumulates, performance degrades, injury risk increases.',
    instead: 'Max 2-3 hard sessions/week. Quality over quantity.',
  },
  {
    mistake: 'Ignoring grip training',
    why: 'Grip fails on sled pull, farmers carry, SkiErg, rowing. Silent killer.',
    instead: 'Dedicated grip work: hangs, carries, fat grips 2-3x/week.',
  },
  {
    mistake: 'No race simulation before competition',
    why: 'Pacing, transitions, nutrition all need practice. First race shouldn\'t be race day.',
    instead: 'At least 2 full simulations in PEAK phase.',
  },
  {
    mistake: 'Starting stations too fast',
    why: 'Lactate accumulates, next station and run suffer. Consistent pace wins.',
    instead: 'Target even splits. First half slightly conservative.',
  },
  {
    mistake: 'Heavy squats day before key runs',
    why: 'Leg fatigue destroys running quality. Interference effect is real.',
    instead: 'Strength after easy runs, or 24-48h before key sessions.',
  },
  {
    mistake: 'Ignoring recovery weeks',
    why: 'Adaptation happens during recovery, not training. Overtraining is real.',
    instead: 'Every 3-4 weeks: reduce volume 30-40%, maintain some intensity.',
  },
];

// ============================================================================
// INJURY RISKS AND PREVENTION
// ============================================================================

export const INJURY_RISKS: InjuryRisk[] = [
  {
    area: 'Achilles tendon',
    commonIn: ['Running volume increases', 'Hill work', 'Speed work'],
    prevention: [
      'Gradual volume increases (<10%/week)',
      'Eccentric heel drops 3x15 daily',
      'Avoid sudden speed work increases',
      'Proper running shoe rotation',
    ],
    warningSignsSigns: ['Morning stiffness', 'Pain at start of run that warms up', 'Tenderness to touch'],
    modifications: ['Reduce running volume 50%', 'No hills or speed', 'Heel drops daily', 'Consider physio'],
  },
  {
    area: 'Knee (patellofemoral)',
    commonIn: ['Lunges', 'Wall balls', 'Running downhill', 'High squat volume'],
    prevention: [
      'Quad and hip strengthening',
      'Single-leg exercises',
      'Avoid deep knee bend when fatigued',
      'Proper running form (cadence 170-180)',
    ],
    warningSignsSigns: ['Pain under kneecap', 'Stairs painful', 'Swelling after activity'],
    modifications: ['Reduce lunge depth', 'Limit wall balls', 'Flat running only', 'VMO strengthening'],
  },
  {
    area: 'Lower back',
    commonIn: ['Sled push/pull', 'Deadlifts', 'Wall balls', 'Sandbag lunges'],
    prevention: [
      'Core bracing practice',
      'Hip hinge pattern mastery',
      'Avoid rounding under load',
      'Deadlift with neutral spine always',
    ],
    warningSignsSigns: ['Dull ache after training', 'Stiffness in morning', 'Pain radiating to legs'],
    modifications: ['Reduce sled weights', 'Hip hinge drills', 'McGill Big 3 daily', 'Limit loaded flexion'],
  },
  {
    area: 'Shoulder',
    commonIn: ['SkiErg', 'Wall balls', 'Rowing', 'Overhead movements'],
    prevention: [
      'Shoulder mobility work daily',
      'Band pull-aparts',
      'External rotation strengthening',
      'Avoid excessive overhead volume',
    ],
    warningSignsSigns: ['Clicking or catching', 'Pain reaching overhead', 'Night pain'],
    modifications: ['Reduce SkiErg volume', 'Lower wall ball target', 'Rowing focus on legs', 'Physio assessment'],
  },
  {
    area: 'Grip/forearm',
    commonIn: ['Sled pull', 'Farmers carry', 'SkiErg', 'Rowing'],
    prevention: [
      'Gradual grip volume increase',
      'Forearm stretching',
      'Alternating grip styles',
      'Recovery between grip sessions',
    ],
    warningSignsSigns: ['Weakness in grip', 'Pain on inside/outside elbow', 'Numbness in fingers'],
    modifications: ['Straps for some work', 'Reduce carry weight', 'More rest between grip work', 'Ice after sessions'],
  },
  {
    area: 'Hip flexor',
    commonIn: ['Running', 'Lunges', 'Burpee broad jumps'],
    prevention: [
      'Hip flexor stretching post-run',
      'Glute activation work',
      'Avoid excessive sit-ups',
      'Standing desk if possible',
    ],
    warningSignsSigns: ['Pain in front of hip', 'Tightness when running', 'Pain bringing knee to chest'],
    modifications: ['Reduce running volume', 'No lunges', 'Couch stretch daily', 'Glute bridges'],
  },
];

// ============================================================================
// LOAD CALCULATION RULES
// ============================================================================

export const LOAD_CALCULATION = {
  /**
   * Sled work - based on competition weights
   */
  sled: {
    push: {
      competition: { men: 152, women: 102 },
      trainingPercent: {
        technique: '60-70%',
        conditioning: '80-90%',
        racePrep: '100%',
      },
    },
    pull: {
      competition: { men: 103, women: 78 },
      trainingPercent: {
        technique: '60-70%',
        conditioning: '80-90%',
        racePrep: '100%',
      },
    },
  },

  /**
   * Carries - based on competition weights
   */
  farmers: {
    competition: { men: '2x24kg', women: '2x16kg' },
    training: {
      beginner: '70-80% competition weight',
      intermediate: '80-90% competition weight',
      advanced: '90-100% competition weight',
    },
  },

  /**
   * Sandbag - based on competition weights
   */
  sandbag: {
    competition: { men: 20, women: 10 },
    training: 'Always at competition weight or slightly heavier',
  },

  /**
   * Running paces - based on race target
   */
  running: {
    zone2: 'Conversational pace, can speak full sentences',
    tempo: 'Race pace + 10-15s/km, comfortably hard',
    interval: 'Race pace or slightly faster',
    vo2max: '3-5km race pace effort',
  },
} as const;

// ============================================================================
// EQUIPMENT SUBSTITUTIONS
// ============================================================================

export const EQUIPMENT_SUBSTITUTIONS = {
  skierg: {
    preferred: ['SkiErg machine'],
    alternatives: [
      'Lat pulldown (high rep: 3x30)',
      'Straight-arm pulldown (3x20)',
      'Band pulldown (3x30)',
      'Dumbbell pullover (3x15)',
    ],
    notes: 'Nothing truly replicates SkiErg. Find a gym with one for race prep.',
  },

  sled: {
    preferred: ['Competition sled'],
    alternatives: [
      'Prowler (similar but different)',
      'Heavy resistance band walks',
      'Wall sit + resistance (push simulation)',
      'Seated cable row (pull simulation)',
    ],
    notes: 'Sled specificity matters. Practice on actual competition equipment if possible.',
  },

  rower: {
    preferred: ['Concept2 rower'],
    alternatives: [
      'Any rowing machine',
      'Bent-over rows (high rep)',
      'Seated cable row',
    ],
    notes: 'Concept2 is competition standard. Other rowers have different pacing.',
  },

  wallBall: {
    preferred: ['Wall ball to 3m/2.7m target'],
    alternatives: [
      'Thruster with dumbbell/barbell',
      'Medicine ball squat + overhead throw',
      'Goblet squat + shoulder press',
    ],
    notes: 'Practice with actual wall ball and target height.',
  },

  kettlebells: {
    preferred: ['Competition kettlebells (24kg/16kg)'],
    alternatives: [
      'Dumbbells',
      'Trap bar for carries',
      'Farmer walk handles',
    ],
    notes: 'Kettlebell handle differs from dumbbells. Practice with KBs.',
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate training phase based on weeks until race
 */
export function calculatePhase(weeksOut: number): Phase {
  if (weeksOut > 12) return 'BASE';
  if (weeksOut > 6) return 'BUILD';
  if (weeksOut > 2) return 'PEAK';
  return 'TAPER';
}

/**
 * Get volume targets for current phase and experience
 */
export function getVolumeTargets(phase: Phase, experience: ExperienceLevel) {
  const phaseConfig = PHASES[phase];
  return {
    running: phaseConfig.volumeTarget.running[experience],
    strength: phaseConfig.volumeTarget.strength[experience],
    intensityDistribution: phaseConfig.intensityDistribution,
  };
}

/**
 * Calculate race pace range based on target finish time
 */
export function calculateRunningPaces(targetFinishMinutes: number): {
  perKm: string;
  zone2: string;
  tempo: string;
  interval: string;
} {
  // Running is roughly 40-50% of total time for most athletes
  const runningMinutes = targetFinishMinutes * 0.45;
  const perKmSeconds = (runningMinutes * 60) / 8;
  const perKmMinutes = Math.floor(perKmSeconds / 60);
  const perKmRemainder = Math.round(perKmSeconds % 60);

  const racePerKm = `${perKmMinutes}:${perKmRemainder.toString().padStart(2, '0')}/km`;

  // Zone 2 is ~60-90s/km slower
  const zone2Seconds = perKmSeconds + 75;
  const zone2Min = Math.floor(zone2Seconds / 60);
  const zone2Rem = Math.round(zone2Seconds % 60);

  // Tempo is 10-15s/km slower than race pace
  const tempoSeconds = perKmSeconds + 12;
  const tempoMin = Math.floor(tempoSeconds / 60);
  const tempoRem = Math.round(tempoSeconds % 60);

  return {
    perKm: racePerKm,
    zone2: `${zone2Min}:${zone2Rem.toString().padStart(2, '0')}/km`,
    tempo: `${tempoMin}:${tempoRem.toString().padStart(2, '0')}/km`,
    interval: racePerKm,
  };
}

/**
 * Get session templates for given days per week
 */
export function getSessionTemplates(daysPerWeek: number): SessionTemplate[] {
  const available = SESSION_TEMPLATES[daysPerWeek];
  if (available) return available;

  // Fallback to closest match
  const keys = Object.keys(SESSION_TEMPLATES).map(Number).sort((a, b) => a - b);
  const closest = keys.reduce((prev, curr) =>
    Math.abs(curr - daysPerWeek) < Math.abs(prev - daysPerWeek) ? curr : prev
  );
  return SESSION_TEMPLATES[closest];
}

/**
 * Get station by ID
 */
export function getStation(stationId: string): StationSpec | undefined {
  return STATIONS[stationId];
}

/**
 * Get all station IDs
 */
export function getAllStationIds(): string[] {
  return Object.keys(STATIONS);
}

// ============================================================================
// FULL KNOWLEDGE EXPORT
// ============================================================================

export const HYROX_KNOWLEDGE = {
  sport: 'hyrox' as const,
  version: '1.0.0',
  lastValidated: '2025-12-15',

  competition: COMPETITION_FORMAT,
  stations: STATIONS,
  timeBenchmarks: TIME_BENCHMARKS,
  principles: TRAINING_PRINCIPLES,
  phases: PHASES,
  sessionTemplates: SESSION_TEMPLATES,
  antiPatterns: ANTI_PATTERNS,
  injuryRisks: INJURY_RISKS,
  loadCalculation: LOAD_CALCULATION,
  equipmentSubstitutions: EQUIPMENT_SUBSTITUTIONS,

  // Helper functions
  calculatePhase,
  getVolumeTargets,
  calculateRunningPaces,
  getSessionTemplates,
  getStation,
  getAllStationIds,
} as const;
