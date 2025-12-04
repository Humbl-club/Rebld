/**
 * Sport-Specific Training Data for AI Plan Generation
 * Compact version for Convex server-side use
 */

interface SportContext {
  displayName: string;
  focusAreas: string;
  essentialExercises: string[];
  mobilityFocus: string[];
  corePriority: string[];
  conditioning: string;
  avoid: string[];
  weeklyNotes: string;
}

export const SPORT_CONTEXTS: Record<string, SportContext> = {
  boxing: {
    displayName: 'Boxing',
    focusAreas: 'Rotational Power 25%, Endurance 30%, Power 25%, Mobility 10%',
    essentialExercises: [
      'Medicine Ball Rotational Throw (4x6 each side) - explosive rotational power',
      'Heavy Bag Work (3-5 rounds x 3min) - sport-specific conditioning',
      'Landmine Rotational Press (3x8 each side) - rotational pushing power',
      'Cable Woodchop (3x12 each side) - controlled rotation',
      'Sled Push (6x20m) - leg drive conditioning',
      'Battle Ropes (30s on/30s off x 8) - shoulder endurance',
      'Pallof Press (3x10 each side) - core anti-rotation',
    ],
    mobilityFocus: ['T-Spine Rotation', 'Shoulder CARs', 'Leg Swings', 'Arm Circles'],
    corePriority: ['Anti-Rotation (Pallof Press)', 'Rotational Power (Russian Twist, Med Ball Slam)', 'Stability (Plank, Hollow Body)'],
    conditioning: '3min work / 1min rest intervals mimicking rounds, Jump Rope 10-15min',
    avoid: ['Heavy Barbell Bench Press (creates shoulder tightness)', 'Heavy Bicep Curls (limits arm speed)'],
    weeklyNotes: 'Power + Conditioning days, avoid heavy lifting 48h before sparring',
  },

  mma: {
    displayName: 'Mixed Martial Arts',
    focusAreas: 'Strength 20%, Power 20%, Endurance 30%, Grappling 20%',
    essentialExercises: [
      'Turkish Get-Up (3x3 each side) - full-body, ground-to-standing',
      'Rope Climb (3-5 climbs) - pulling strength, grip endurance',
      'Kettlebell Swing (5x15) - hip power, conditioning',
      'Deadlift (4x5) - posterior chain strength',
      'Pull-ups weighted (4x8) - pulling strength for grappling',
      'Medicine Ball Slam (4x8) - ground and pound power',
      'Farmer Carries (4x40m) - grip, core stability',
    ],
    mobilityFocus: ['Leg Swings', 'Walking Lunges', 'T-Spine Rotation', 'Neck CARs'],
    corePriority: ['Anti-Extension (Ab Wheel, Plank)', 'Rotational (Pallof Press)', 'Hip Flexor Strength (Hanging Leg Raise)'],
    conditioning: '5min rounds / 1min rest, Assault Bike 30s sprint / 30s rest x 10',
    avoid: ['Heavy Overhead Press (shoulder impingement risk from grappling)'],
    weeklyNotes: 'Coordinate with skill training to manage fatigue',
  },

  hyrox: {
    displayName: 'HYROX',
    focusAreas: 'Endurance 55%, Strength 15%, Power 10%, Functional 20%',
    essentialExercises: [
      // The 8 competition stations (MANDATORY)
      'Sled Push (8x25m) - exact competition format',
      'Sled Pull (8x25m) - competition station',
      'Wall Ball (100 reps for time) - 6/9kg to 3m target',
      'SkiErg (1000m for time) - competition station',
      'Rowing (1000m for time) - competition station',
      'Burpee Broad Jump (80m for time) - competition station',
      'Weighted Lunges (100m with 24kg) - sandbag station',
      'Farmer Carry (200m with 24kg each) - competition station',
      // Running between stations (ESSENTIAL - 8km total in race)
      'Interval Run 400m (8x400m with 90s rest) - simulates 1km runs between stations',
      'Race Pace Run (20-40min) - continuous run at competition pace',
    ],
    mobilityFocus: ['Hip Flexor Stretch', 'Ankle Mobility', 'Leg Swings', 'Arm Circles'],
    corePriority: ['Anti-Extension (Plank, Ab Wheel)', 'Endurance Core (Hollow Body Hold)', 'Rotational Stability (Pallof Press)'],
    conditioning: 'Race simulations, 8x400m run intervals, station practice back-to-back',
    avoid: ['Heavy Back Squats (recovery vs endurance needs)', 'Isolated Arm Work (time better on functional)'],
    weeklyNotes: 'Running + Stations days, build to full race simulations over 8-12 weeks',
  },

  marathon: {
    displayName: 'Marathon Running',
    focusAreas: 'Endurance 70%, Mobility 10%, Single-Leg Strength 15%',
    essentialExercises: [
      // Running exercises (CORE of marathon training)
      'Long Run (60-150min) - aerobic base building at conversational pace (Zone 2)',
      'Tempo Run (20-40min) - sustained effort at marathon pace or lactate threshold',
      'Easy Run (30-45min) - recovery run at very easy pace',
      'Interval Run 400m (6-10x400m) - speed work, VO2max development',
      // Strength exercises for injury prevention
      'Single Leg Romanian Deadlift (3x10 each) - posterior chain, balance',
      'Bulgarian Split Squat (3x10 each) - single leg strength',
      'Calf Raises (3x15-20) - push-off strength',
      'Glute Bridge single leg (3x12 each) - glute activation',
      'Side Plank (3x30s each) - hip stability',
      'Step Ups (3x12 each) - functional strength',
      'Pallof Press (3x10 each) - core control',
    ],
    mobilityFocus: ['Hip Flexor Stretch', 'Calf Stretch', 'Leg Swings', 'Walking Lunges'],
    corePriority: ['Anti-Rotation (Pallof Press)', 'Hip Stability (Side Plank, Clamshells)', 'Anti-Extension (Ab Wheel)'],
    conditioning: '80/20 principle: 80% easy runs, 20% hard work (tempo/intervals)',
    avoid: ['Heavy Squats (interferes with running)', 'High Volume Upper Body (unnecessary mass)'],
    weeklyNotes: '3-5 runs per week, 1 long run, 1 quality session, rest easy',
  },

  triathlon: {
    displayName: 'Triathlon',
    focusAreas: 'Endurance 70%, Swim Strength 10%, Single-Leg 10%, Mobility 10%',
    essentialExercises: [
      // Cardio - the 3 disciplines (CORE of triathlon)
      'Swimming (pool technique + intervals) - 1500m-3800m depending on race distance',
      'Cycling (bike endurance + intervals) - Zone 2 base and threshold work',
      'Long Run (60-90min) - run leg aerobic base',
      'Easy Run (30-40min) - recovery runs',
      'Brick Workout (bike-to-run) - practice transitions under fatigue',
      // Strength exercises
      'Pull-ups/Lat Pulldown (3x10) - swim pulling strength',
      'Single Leg Press (3x12 each) - cycling power',
      'Romanian Deadlift (3x10) - posterior chain',
      'Plank (3x45-60s) - core for all three sports',
      'Shoulder External Rotation (3x15) - swim injury prevention',
      'Calf Raises (3x15) - run push-off',
    ],
    mobilityFocus: ['Shoulder CARs', 'Arm Circles', 'Hip Flexor Stretch', 'Leg Swings'],
    corePriority: ['Stability (Plank, Side Plank)', 'Anti-Rotation (Pallof Press, Ab Wheel)'],
    conditioning: 'Structured periodization across swim/bike/run with recovery weeks',
    avoid: ['Heavy Upper Body (swim shoulder health)', 'High Volume Squats (interferes with cycling/running)'],
    weeklyNotes: 'Manage training load across three sports, practice transitions',
  },

  powerlifting: {
    displayName: 'Powerlifting',
    focusAreas: 'Strength 60%, Power 15%, Hypertrophy 15%, Skill 10%',
    essentialExercises: [
      'Competition Squat (per program) - high bar or low bar',
      'Competition Bench (per program) - pause at chest',
      'Competition Deadlift (per program) - conventional or sumo',
      'Pause Squat (3x5 @70-80%) - hole strength',
      'Close Grip Bench (3x8) - tricep/lockout',
      'Deficit Deadlift (3x5) - off floor strength',
      'Romanian Deadlift (3x8-10) - hamstring/posterior chain',
    ],
    mobilityFocus: ['Hip Flexor Stretch', 'Leg Swings', 'Ankle Mobility', 'Arm Circles'],
    corePriority: ['Bracing (Plank, Pallof Press)', 'Anti-Extension (Ab Wheel, Hanging Leg Raise)'],
    conditioning: 'GPP: Sled drag, carry work 15-20min, walking/light cycling',
    avoid: ['High Rep Conditioning (interferes with strength)', 'Olympic Lifts (different patterns)'],
    weeklyNotes: 'Follow established program (5/3/1, GZCL, etc.)',
  },

  bodybuilding: {
    displayName: 'Bodybuilding',
    focusAreas: 'Hypertrophy 65%, Strength 20%, Conditioning 5%, Mobility 5%',
    essentialExercises: [
      'Barbell Bench Press (4x8-12) - chest mass',
      'Barbell Row (4x8-12) - back thickness',
      'Squat (4x8-12) - quad development',
      'Romanian Deadlift (4x10-12) - hamstring/glute',
      'Overhead Press (4x8-12) - shoulder mass',
      'Lat Pulldown (4x10-12) - back width',
      'Lateral Raise (4x15-20) - side delt width',
    ],
    mobilityFocus: ['Shoulder Dislocates', 'Pec Stretch', 'Hip Flexor Stretch'],
    corePriority: ['Stability (Plank, Cable Crunch)', 'Vacuum (Stomach Vacuum)'],
    conditioning: 'LISS Cardio 20-30min, increase in cutting phase',
    avoid: ['Heavy Singles (injury risk vs hypertrophy)', 'CrossFit-style Metcons (interferes with recovery)'],
    weeklyNotes: 'PPL or Upper/Lower split, focus on mind-muscle connection',
  },

  crossfit: {
    displayName: 'CrossFit',
    focusAreas: 'Endurance 35%, Strength 20%, Power 20%, Skill 15%, Mobility 10%',
    essentialExercises: [
      'Snatch (per program) - Olympic lift, technical',
      'Clean & Jerk (per program) - Olympic lift, technical',
      'Kipping Pull-up (for time/reps) - MetCon staple',
      'Thrusters (for time/reps) - high output movement',
      'Wall Ball (for time/reps) - legs and cardio',
      'Double Unders (for time/reps) - coordination/cardio',
      'Box Jump (for time/reps) - power/conditioning',
    ],
    mobilityFocus: ['Shoulder CARs', 'PVC Pass-throughs', 'Hip CARs', 'Wrist Circles'],
    corePriority: ['Hollow Body (Hollow Hold, Hollow Rock)', 'Stability (Plank, L-Sit, Toes to Bar)'],
    conditioning: 'Short MetCon 5-12min AMRAP, Long MetCon 15-30min, monostructural intervals',
    avoid: ['Kipping without strict strength first (injury risk)'],
    weeklyNotes: 'Strength + MetCon days, follow gym programming',
  },

  basketball: {
    displayName: 'Basketball',
    focusAreas: 'Power 25%, Endurance 25%, Lateral Movement 15%, Single-Leg 20%, Mobility 15%',
    essentialExercises: [
      'Box Jump (4x5) - vertical power',
      'Depth Jump (4x4) - reactive power',
      'Trap Bar Deadlift (4x5) - lower body power',
      'Bulgarian Split Squat (3x8 each) - single leg strength',
      'Lateral Bound (3x6 each) - lateral power',
      'Medicine Ball Rotational Throw (3x8 each) - core power',
      'Nordic Hamstring Curl (3x6) - injury prevention',
    ],
    mobilityFocus: ['Hip 90/90', 'Ankle Circles', 'T-Spine Rotation', 'Hip Flexor Stretch'],
    corePriority: ['Anti-Rotation (Pallof Press)', 'Hip Stability (Copenhagen Plank)', 'Power (Med Ball Slam)'],
    conditioning: 'Court sprints (17s baseline to baseline), Shuttle runs, Tempo runs 300m at 80%',
    avoid: ['Heavy Overhead Press (shoulder risk from shooting)', 'Heavy Back Squat (affects jump performance)'],
    weeklyNotes: 'In-season: reduce volume, maintain power',
  },

  soccer: {
    displayName: 'Soccer/Football',
    focusAreas: 'Endurance 35%, Power 20%, Single-Leg 20%, Mobility 15%, Strength 10%',
    essentialExercises: [
      'Nordic Hamstring Curl (3x6) - hamstring injury prevention',
      'Copenhagen Plank (3x10-15s each) - adductor strength',
      'Single Leg Romanian Deadlift (3x8 each) - posterior chain, balance',
      'Bulgarian Split Squat (3x8 each) - single leg strength',
      'Box Jump (3x5) - power for headers, sprints',
      'Lateral Lunge (3x8 each) - lateral stability',
      'Hip Flexor Strengthening (3x10 each) - kicking power',
    ],
    mobilityFocus: ['Hip Flexor Stretch', 'Adductor Stretch', 'Hamstring Active Stretch'],
    corePriority: ['Anti-Rotation (Pallof Press)', 'Hip Stability (Copenhagen Plank, Clamshells)', 'Power (Med Ball Throw)'],
    conditioning: 'Interval running 6x400m, Small-sided games, Tempo runs 10-15min',
    avoid: ['Heavy Bilateral Squats (unilateral sport)', 'Long Distance Running (interferes with speed)'],
    weeklyNotes: 'In-season: 2 gym sessions max, focus on injury prevention',
  },

  tennis: {
    displayName: 'Tennis',
    focusAreas: 'Rotational Power 20%, Lateral Movement 20%, Shoulder Health 20%, Endurance 25%, Mobility 15%',
    essentialExercises: [
      'Medicine Ball Rotational Throw (4x8 each) - stroke power',
      'Cable Rotation (3x12 each) - controlled rotation',
      'Lateral Bound (3x6 each) - court movement',
      'Single Leg RDL (3x8 each) - posterior chain, balance',
      'External Rotation (3x15) - shoulder health',
      'Split Squat Jump (3x6) - explosive first step',
      'Band Pull-Apart (3x20) - shoulder stability',
    ],
    mobilityFocus: ['Shoulder CARs', 'Sleeper Stretch', 'T-Spine Rotation', 'Hip 90/90'],
    corePriority: ['Rotational Power (Med Ball Throw)', 'Anti-Rotation (Pallof Press)', 'Stability (Plank, Side Plank)'],
    conditioning: 'Court sprints, Lateral shuttles, 20s work/40s rest intervals',
    avoid: ['Behind Neck Press (shoulder impingement)', 'Heavy Bicep Curls (tennis elbow risk)'],
    weeklyNotes: 'Shoulder prehab every session',
  },

  rock_climbing: {
    displayName: 'Rock Climbing',
    focusAreas: 'Pulling Strength 25%, Grip/Finger 25%, Core Tension 20%, Power 15%, Mobility 15%',
    essentialExercises: [
      'Pull-up weighted (4x5-8) - primary climbing movement',
      'Hangboard Training (per protocol) - finger strength',
      'Lock-off Holds (3x5s each angle) - isometric pulling',
      'Front Lever Progressions (3x5-10s) - core tension, pulling',
      'Push-ups (3x15) - antagonist shoulder health',
      'Wrist Curls (3x15) - antagonist forearm balance',
      'Shoulder External Rotation (3x15) - shoulder health',
    ],
    mobilityFocus: ['Shoulder CARs', 'Lat Stretch', 'Hip 90/90', 'Frog Stretch', 'Finger Extensions'],
    corePriority: ['Anti-Extension (Front Lever, Ab Wheel)', 'Compression (L-Sit, Hanging Leg Raise)', 'Rotation (Windshield Wipers)'],
    conditioning: 'Easy routes for volume climbing, light cardio for aerobic base',
    avoid: ['Heavy Deadlifts (grip fatigue impacts climbing)', 'Excessive Pulling Volume (elbow/finger overuse)'],
    weeklyNotes: 'Manage finger load carefully, antagonist training essential',
  },

  swimming: {
    displayName: 'Swimming',
    focusAreas: 'Endurance 40%, Shoulder Rotation 20%, Core 15%, Pulling Strength 15%, Mobility 10%',
    essentialExercises: [
      'Lat Pulldown (4x10-12) - pull phase strength',
      'Band Pull-Apart (4x20) - shoulder health',
      'Prone I-Y-T Raises (3x10 each) - rotator cuff',
      'Cable External Rotation (3x15) - shoulder stability',
      'Russian Twist (3x20) - rotational core',
      'Flutter Kicks (3x30s) - kick strength, hip flexors',
      'Squat Jump (3x8) - dive starts, turns',
    ],
    mobilityFocus: ['Shoulder CARs', 'Sleeper Stretch', 'T-Spine Extension', 'Ankle Plantarflexion'],
    corePriority: ['Stability (Plank, Side Plank, Hollow Hold)', 'Rotation (Russian Twist)', 'Hip Flexor (Flutter Kick)'],
    conditioning: 'Pool intervals 10x100m, technique drills, endurance swim 2000-4000m',
    avoid: ['Behind Neck Press (shoulder impingement)', 'Heavy Bench Press (pec tightness affects stroke)'],
    weeklyNotes: 'Shoulder prehab critical, balance dryland with pool work',
  },

  general_fitness: {
    displayName: 'General Fitness',
    focusAreas: 'Strength 25%, Endurance 25%, Hypertrophy 20%, Mobility 15%, Core 15%',
    essentialExercises: [
      'Squat (any variation) (3x8-12) - fundamental lower body',
      'Deadlift (any variation) (3x8-10) - posterior chain',
      'Bench Press/Push-up (3x8-12) - upper push',
      'Row/Pull-up (3x8-12) - upper pull',
      'Lunges (3x10 each) - unilateral leg work',
      'Shoulder Press (3x10) - overhead strength',
      'Plank (3x30-60s) - core stability',
    ],
    mobilityFocus: ['Hip Flexor Stretch', 'Shoulder Circles', 'Leg Swings', 'Arm Circles'],
    corePriority: ['Stability (Plank, Side Plank)', 'Strength (Hanging Leg Raise, Ab Wheel)'],
    conditioning: 'Steady state 30min walk/bike, intervals 20s hard/40s easy x 10',
    avoid: [],
    weeklyNotes: 'Flexible - adjust based on goals, focus on consistency',
  },
};

// Aliases for sport name matching
const SPORT_ALIASES: Record<string, string> = {
  'mma': 'mma',
  'mixed martial arts': 'mma',
  'ufc': 'mma',
  'bjj': 'mma',
  'brazilian jiu jitsu': 'mma',
  'kickboxing': 'boxing',
  'muay thai': 'boxing',
  'football': 'soccer',
  'fussball': 'soccer',
  'futbol': 'soccer',
  'running': 'marathon',
  'long distance running': 'marathon',
  '5k': 'marathon',
  '10k': 'marathon',
  'half marathon': 'marathon',
  'ironman': 'triathlon',
  '70.3': 'triathlon',
  'olympic triathlon': 'triathlon',
  'olympic lifting': 'crossfit',
  'weightlifting': 'powerlifting',
  'strength training': 'powerlifting',
  'bouldering': 'rock_climbing',
  'sport climbing': 'rock_climbing',
  'climbing': 'rock_climbing',
  'padel': 'tennis',
  'squash': 'tennis',
  'badminton': 'tennis',
  'none': 'general_fitness',
  'general': 'general_fitness',
  'fitness': 'general_fitness',
  'gym': 'general_fitness',
  'weight loss': 'general_fitness',
  'get fit': 'general_fitness',
};

/**
 * Get sport context for AI prompt
 */
export function getSportContext(sportName: string | undefined): SportContext | null {
  if (!sportName) return SPORT_CONTEXTS.general_fitness;

  const normalized = sportName.toLowerCase().trim();

  // Direct match
  if (SPORT_CONTEXTS[normalized]) {
    return SPORT_CONTEXTS[normalized];
  }

  // Check aliases
  const aliased = SPORT_ALIASES[normalized];
  if (aliased && SPORT_CONTEXTS[aliased]) {
    return SPORT_CONTEXTS[aliased];
  }

  // Partial match
  for (const [key, context] of Object.entries(SPORT_CONTEXTS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return context;
    }
  }

  return SPORT_CONTEXTS.general_fitness;
}

// Competition sports with MANDATORY exercise requirements
const COMPETITION_SPORTS = ['hyrox', 'marathon', 'powerlifting', 'triathlon'];

/**
 * Format sport context for AI prompt injection
 * Competition sports have MANDATORY exercise requirements with validation
 */
export function formatSportPrompt(sportName: string | undefined): string {
  const context = getSportContext(sportName);
  if (!context) return '';

  // Normalize sport name for comparison
  const normalizedSport = sportName?.toLowerCase().trim() || '';
  const isCompetition = COMPETITION_SPORTS.some(s =>
    normalizedSport.includes(s) || normalizedSport === s
  );

  // For Hyrox specifically, extract station names for clearer enforcement
  const isHyrox = normalizedSport.includes('hyrox');
  const hyroxStations = isHyrox ? [
    'Sled Push',
    'Sled Pull',
    'Wall Ball',
    'SkiErg',
    'Rowing',
    'Burpee Broad Jump',
    'Weighted Lunges (Sandbag)',
    'Farmer Carry',
  ] : [];

  const enforcementLevel = isCompetition ? 'MANDATORY' : 'PRIORITY';
  const exerciseCount = context.essentialExercises.length;

  let competitionWarning = '';
  if (isCompetition) {
    competitionWarning = `
**VALIDATION REQUIREMENT:**
This is a ${context.displayName} competition plan. The generated plan is INVALID unless it includes exercises that train ALL ${exerciseCount} essential movement patterns listed below.

${isHyrox ? `For HYROX specifically, the 8 competition stations MUST ALL be practiced:
${hyroxStations.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Include station practice AT LEAST 2x per week for each station.` : ''}
`;
  }

  return `
**SPORT-SPECIFIC TRAINING: ${context.displayName}**

Focus Distribution: ${context.focusAreas}
${competitionWarning}

**${enforcementLevel} Exercises (${isCompetition ? 'ALL REQUIRED' : 'S-Tier for this sport'}):**
${context.essentialExercises.map((e, i) => `${i + 1}. ${e}`).join('\n')}

${isCompetition ? `
IMPORTANT: Include ALL ${exerciseCount} exercises above in the weekly plan. Missing any will result in an incomplete program that won't prepare the athlete for competition.
` : ''}

**Required Mobility Work:**
${context.mobilityFocus.map(m => `- ${m}`).join('\n')}

**Core Training Priority:**
${context.corePriority.map(c => `- ${c}`).join('\n')}

**Conditioning Protocol:**
${context.conditioning}

**AVOID These Exercises:**
${context.avoid.length > 0 ? context.avoid.map(a => `- ${a}`).join('\n') : '- No specific restrictions'}

**Weekly Structure Notes:**
${context.weeklyNotes}
`;
}
