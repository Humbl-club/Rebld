/**
 * Prompt Segment Architecture
 *
 * This system generates structured prompt segments from onboarding choices that combine into the final AI prompt.
 *
 * **Core concept:** Each onboarding choice maps to a PromptSegment with priority. Higher priority = more important constraint.
 *
 * Integrates with:
 * - /convex/promptBuilder.ts - Evidence-based training science
 * - /convex/ai.ts - AI generation and API calls
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PromptSegment {
  id: string;
  priority: number; // 100 = highest priority constraint
  content: string;
}

export interface OnboardingData {
  // Path selection
  path: 'competition' | 'general';

  // Competition path data
  sport?: string;
  targetDate?: string;
  readiness?: number; // 1-10 scale

  // General path data
  goal?: 'muscle' | 'strength' | 'fat_loss' | 'general';

  // Common data
  trainingDays: number[]; // [1, 3, 5] = Monday, Wednesday, Friday
  sessionLength: number; // minutes
  benchmarks: Record<string, number>; // { "squat_kg": 100, "bench_kg": 80, ... }
  painPoints: string[]; // ["lower back", "knee"]
  age?: number;
  experience?: string; // "beginner", "intermediate", "advanced"
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEGMENT GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Priority 100: Goal segment - The highest priority constraint
 * Defines the fundamental training style and approach
 */
function generateGoalSegment(data: OnboardingData): PromptSegment | null {
  if (!data.goal) return null;

  const goalPrompts: Record<string, string> = {
    muscle: `**PRIMARY GOAL: HYPERTROPHY (MUSCLE BUILDING)**
- Rep Range: 8-12 reps per set (optimal for hypertrophy)
- Sets: 3-4 sets per exercise
- Rest Periods: 60-90 seconds (moderate rest for metabolic stress)
- Volume: HIGH - accumulate volume to stimulate growth
- Intensity: RPE 7-8 (1-2 reps in reserve)
- Focus: Time under tension, mind-muscle connection, progressive overload
- Exercise Selection: Compound movements + isolation exercises
- Tempo: Controlled eccentric (2-3 seconds), explosive concentric`,

    strength: `**PRIMARY GOAL: STRENGTH DEVELOPMENT**
- Rep Range: 3-6 reps per set (neural adaptations)
- Sets: 4-5 sets per exercise
- Rest Periods: 3-5 minutes (full recovery for max output)
- Volume: LOW to MODERATE - quality over quantity
- Intensity: RPE 8-9 (heavy loads, 1-2 RIR)
- Focus: Progressive overload on compound lifts, technique perfection
- Exercise Selection: Barbell compounds (squat, bench, deadlift, press, row)
- Tempo: Fast concentric, controlled eccentric`,

    fat_loss: `**PRIMARY GOAL: FAT LOSS / BODY RECOMPOSITION**
- Rep Range: 10-15 reps (metabolic stress, calorie burn)
- Sets: 3 sets per exercise
- Rest Periods: 45-60 seconds (shorter rest = higher calorie burn)
- Volume: MODERATE - enough to preserve muscle
- Intensity: RPE 7-8 (challenging but sustainable)
- Focus: Circuit-style training, supersets, compound movements
- Exercise Selection: Full-body compounds, minimal isolation
- Conditioning: Include cardio integration (Zone 2 steady state)
- Critical: PRESERVE MUSCLE MASS while in caloric deficit`,

    general: `**PRIMARY GOAL: GENERAL FITNESS**
- Rep Range: 8-12 reps (balanced development)
- Sets: 3 sets per exercise
- Rest Periods: 60-90 seconds
- Volume: MODERATE - sustainable long-term
- Intensity: RPE 6-8 (varied across sessions)
- Focus: Balanced strength, conditioning, movement quality
- Exercise Selection: Mix of barbell, dumbbell, bodyweight, cardio
- Variety: Change exercises every 4-6 weeks for engagement`,
  };

  return {
    id: 'goal',
    priority: 100,
    content: goalPrompts[data.goal] || goalPrompts.general,
  };
}

/**
 * Priority 95: Sport-specific segment - Competition/event-specific requirements
 */
function generateSportSegment(data: OnboardingData): PromptSegment | null {
  if (!data.sport) return null;

  const sportLower = data.sport.toLowerCase();

  const sportPrompts: Record<string, string> = {
    hyrox: `**SPORT: HYROX COMPETITION**
- Race Format: 8km run (1km segments) + 8 functional stations
- Key Movements: Running, SkiErg, Sled Push, Sled Pull, Burpee Broad Jumps, Rowing, Farmers Carry, Wall Balls, Lunges
- Training Split: 60% running/conditioning, 40% functional strength
- Critical Focus: Compromised running (running with fatigued legs from strength work)
- Conditioning: Zone 2 running base + race-pace intervals + brick workouts
- Strength Focus: Sled work, loaded carries, wall balls, lunges under fatigue
- Session Structure: Brick workouts (strength → run OR run → strength)
- Avoid: Heavy bilateral squats that interfere with running recovery`,

    powerlifting: `**SPORT: POWERLIFTING**
- Competition Lifts: Back Squat, Bench Press, Deadlift
- Training Focus: Build 1RM strength in these three lifts
- Exercise Selection: Competition variants + close accessories
  - Squat: Pause squats, tempo squats, box squats
  - Bench: Pause bench, close-grip bench, incline bench
  - Deadlift: Deficit deadlifts, rack pulls, Romanian deadlifts
- Periodization: Accumulation → Intensification → Peaking phases
- Technique: Competition form practice, bracing, setup consistency
- Accessories: Minimal - only what supports the main lifts
- GPP: Light sled work, carries (do not interfere with main lifts)`,

    marathon: `**SPORT: MARATHON RUNNING**
- Distance: 42.195km endurance event
- Training Philosophy: 80/20 Polarized Training (80% easy Zone 2, 20% hard)
- Running Types:
  - Long Slow Runs: 60-120 minutes Zone 2
  - Tempo Runs: 20-40 minutes at lactate threshold
  - Interval Work: 400m/800m/1600m repeats
  - Easy Runs: Conversational pace, recovery
- Strength Focus: Injury prevention, NOT muscle building
  - Single-leg stability (single leg RDL, step-ups)
  - Glute activation (clamshells, hip bridges)
  - Core endurance (planks, dead bugs)
  - Calf raises for Achilles resilience
- Avoid: Heavy bilateral squats (interferes with running recovery)
- Critical: Tissue tolerance, gradual volume increases (10% rule)`,

    triathlon: `**SPORT: TRIATHLON**
- Disciplines: Swim → Bike → Run (with transitions)
- Training Distribution: Depends on race distance
  - Sprint/Olympic: Balanced swim/bike/run
  - 70.3/Ironman: Bike-heavy training
- Key Sessions:
  - Swim: Pool laps, open water, technique drills
  - Bike: Long rides, interval work, power-based training
  - Run: Brick workouts (bike-to-run transitions)
- Strength Focus: Minimal interference, support endurance
  - Upper body: Pull strength for swimming
  - Lower body: Single-leg stability for running
  - Core: Endurance for bike position
- Critical: Brick workouts (practice transitions under fatigue)
- Avoid: Heavy upper body work (shoulder health for swimming)`,

    crossfit: `**SPORT: CROSSFIT**
- Modalities: Gymnastics, Weightlifting, Monostructural Cardio
- Training Focus: Work capacity across broad time/modal domains
- Key Movements:
  - Gymnastics: Pull-ups, muscle-ups, handstand push-ups, toes-to-bar
  - Weightlifting: Snatch, clean & jerk, Olympic lift variations
  - Monostructural: Running, rowing, biking, ski erg
- Workout Types:
  - AMRAP (As Many Rounds As Possible)
  - EMOM (Every Minute On the Minute)
  - For Time (complete work as fast as possible)
- Programming: Mixed modal training, skill work, engine building
- Focus: Movement efficiency, pacing strategy, GPP (General Physical Preparedness)
- Volume: High - multiple training sessions with varied stimuli`,
  };

  // Match sport (exact or partial)
  for (const [key, prompt] of Object.entries(sportPrompts)) {
    if (sportLower.includes(key) || key.includes(sportLower)) {
      return {
        id: 'sport',
        priority: 95,
        content: prompt,
      };
    }
  }

  return null;
}

/**
 * Priority 90: Periodization segment - Timeline-based training phases
 */
function generatePeriodizationSegment(data: OnboardingData): PromptSegment | null {
  if (!data.targetDate) return null;

  const weeksUntilEvent = calculateWeeksUntilEvent(data.targetDate);
  if (weeksUntilEvent <= 0) return null;

  // Phase distribution: BASE (40%) → BUILD (35%) → PEAK (15%) → TAPER (10%)
  const baseWeeks = Math.floor(weeksUntilEvent * 0.4);
  const buildWeeks = Math.floor(weeksUntilEvent * 0.35);
  const peakWeeks = Math.floor(weeksUntilEvent * 0.15);
  const taperWeeks = Math.max(1, Math.floor(weeksUntilEvent * 0.1));

  const phase1End = baseWeeks;
  const phase2End = baseWeeks + buildWeeks;
  const phase3End = phase2End + peakWeeks;
  const phase4End = phase3End + taperWeeks;

  return {
    id: 'periodization',
    priority: 90,
    content: `**PERIODIZATION: ${weeksUntilEvent}-WEEK PROGRAM**
Target Event Date: ${data.targetDate}

**PHASE 1: BASE BUILDING (Weeks 1-${phase1End})**
- Volume: Start at MEV, build to MAV by end of phase
- Intensity: RPE 6-7 (submaximal)
- Focus: Build work capacity, establish movement patterns
- Progression: Add 1-2 sets per muscle group each week

**PHASE 2: BUILD (Weeks ${phase1End + 1}-${phase2End})**
- Volume: MAV (Maximum Adaptive Volume)
- Intensity: RPE 7-8 (working sets)
- Focus: Progressive overload, skill development
- Deload: Week ${phase1End + Math.floor(buildWeeks / 2)} (mid-phase deload)

**PHASE 3: PEAK (Weeks ${phase2End + 1}-${phase3End})**
- Volume: Reduced by 20-30% from BUILD phase
- Intensity: RPE 8-9 (high intensity, low volume)
- Focus: Sport-specific work, race simulations
- Critical: Practice event-specific demands

**PHASE 4: TAPER (Weeks ${phase3End + 1}-${phase4End})**
- Volume: 40-60% reduction from normal
- Intensity: Maintain sharpness (short, fast efforts)
- Focus: Full recovery, mental preparation
- Avoid: Starting new exercises, high volume

**Current Week: 1** (update this as program progresses)`,
  };
}

/**
 * Priority 85: Training days segment - Schedule and split configuration
 */
function generateTrainingDaysSegment(data: OnboardingData): PromptSegment | null {
  if (!data.trainingDays || data.trainingDays.length === 0) return null;

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const trainingDayNames = data.trainingDays.map(d => dayNames[d - 1]);
  const restDays = [1, 2, 3, 4, 5, 6, 7].filter(d => !data.trainingDays.includes(d)).map(d => dayNames[d - 1]);

  // Determine split type based on frequency
  const frequency = data.trainingDays.length;
  let splitType = '';
  let splitGuidance = '';

  if (frequency <= 3) {
    splitType = 'Full Body';
    splitGuidance = 'Train all major muscle groups each session (squat/hinge, push, pull, core)';
  } else if (frequency === 4) {
    splitType = 'Upper/Lower Split';
    splitGuidance = `
Day 1: Upper Body (chest, back, shoulders, arms)
Day 2: Lower Body (quads, hamstrings, glutes, calves)
Day 3: Upper Body (different exercises)
Day 4: Lower Body (different exercises)`;
  } else if (frequency === 5) {
    splitType = 'Upper/Lower/Push/Pull/Legs';
    splitGuidance = `
Day 1: Upper Body
Day 2: Lower Body
Day 3: Push (chest, shoulders, triceps)
Day 4: Pull (back, biceps)
Day 5: Legs (quads, hamstrings, glutes)`;
  } else if (frequency >= 6) {
    splitType = 'Push/Pull/Legs (PPL)';
    splitGuidance = `
Push: Chest, Shoulders, Triceps
Pull: Back, Biceps, Rear Delts
Legs: Quads, Hamstrings, Glutes, Calves
(Repeat 2x per week)`;
  }

  // Check for poor rest day distribution (avoid clustering on weekends)
  const hasWeekendCluster = data.trainingDays.includes(6) && data.trainingDays.includes(7) &&
    !data.trainingDays.includes(1) && !data.trainingDays.includes(2);

  return {
    id: 'training_days',
    priority: 85,
    content: `**TRAINING SCHEDULE**
Training Days: ${trainingDayNames.join(', ')}
Rest Days: ${restDays.join(', ')}
Frequency: ${frequency} days per week

**Split Type: ${splitType}**
${splitGuidance}

${hasWeekendCluster ? `
⚠️ WARNING: Rest days clustered at weekends. Consider distributing rest throughout week for better recovery.
Recommended: Insert rest days between training days when possible.
` : ''}

**CRITICAL RULE: NEVER cluster all rest days together (avoid Sat/Sun rest with Mon-Fri training).**
Distribute rest days throughout the week for optimal recovery and adherence.`,
  };
}

/**
 * Priority 80: Benchmark segment - Current strength levels
 */
function generateBenchmarkSegment(data: OnboardingData): PromptSegment | null {
  if (!data.benchmarks || Object.keys(data.benchmarks).length === 0) {
    return {
      id: 'benchmarks',
      priority: 80,
      content: `**STARTING WEIGHTS: Not provided**
User did not provide current strength benchmarks.

**Action Required:**
- Week 1: Find working weights at RPE 6-7 for target rep ranges
- Record weights for each exercise
- Week 2+: Progress using 2-for-2 rule`,
    };
  }

  // Parse benchmarks and calculate estimates
  const known: string[] = [];
  const estimated: string[] = [];

  // Direct benchmarks
  if (data.benchmarks.squat_kg) known.push(`Back Squat: ${data.benchmarks.squat_kg}kg`);
  if (data.benchmarks.bench_kg) known.push(`Bench Press: ${data.benchmarks.bench_kg}kg`);
  if (data.benchmarks.deadlift_kg) known.push(`Deadlift: ${data.benchmarks.deadlift_kg}kg`);
  if (data.benchmarks.row_kg) known.push(`Barbell Row: ${data.benchmarks.row_kg}kg`);
  if (data.benchmarks.overhead_press_kg) known.push(`Overhead Press: ${data.benchmarks.overhead_press_kg}kg`);
  if (data.benchmarks.pullup_count !== undefined) known.push(`Pull-ups: ${data.benchmarks.pullup_count} reps`);

  // Estimate related exercises based on known lifts
  if (data.benchmarks.squat_kg) {
    estimated.push(`Front Squat: ~${Math.round(data.benchmarks.squat_kg * 0.85)}kg (85% of back squat)`);
    estimated.push(`Leg Press: ~${Math.round(data.benchmarks.squat_kg * 2)}kg (2x back squat)`);
    estimated.push(`Bulgarian Split Squat: ~${Math.round(data.benchmarks.squat_kg * 0.5)}kg per hand`);
  }

  if (data.benchmarks.bench_kg) {
    estimated.push(`Incline Bench: ~${Math.round(data.benchmarks.bench_kg * 0.85)}kg (85% of flat bench)`);
    estimated.push(`Dumbbell Bench: ~${Math.round(data.benchmarks.bench_kg * 0.4)}kg per hand (40% of barbell)`);
    estimated.push(`Close-Grip Bench: ~${Math.round(data.benchmarks.bench_kg * 0.85)}kg (85% of regular bench)`);
  }

  if (data.benchmarks.deadlift_kg) {
    estimated.push(`Romanian Deadlift: ~${Math.round(data.benchmarks.deadlift_kg * 0.65)}kg (65% of deadlift)`);
    estimated.push(`Trap Bar Deadlift: ~${Math.round(data.benchmarks.deadlift_kg * 1.1)}kg (110% of conventional)`);
  }

  if (data.benchmarks.overhead_press_kg) {
    estimated.push(`Push Press: ~${Math.round(data.benchmarks.overhead_press_kg * 1.15)}kg (115% of strict press)`);
    estimated.push(`Dumbbell Shoulder Press: ~${Math.round(data.benchmarks.overhead_press_kg * 0.45)}kg per hand`);
  }

  return {
    id: 'benchmarks',
    priority: 80,
    content: `**STARTING WEIGHTS - USER PROVIDED BENCHMARKS**

**Known Lifts (exact values):**
${known.map(k => `- ${k}`).join('\n')}

**Estimated Related Exercises:**
${estimated.length > 0 ? estimated.map(e => `- ${e}`).join('\n') : '- Insufficient data for estimates'}

**Prescription Rules:**
- For KNOWN lifts: Use exact weight in Week 1
- For ESTIMATED lifts: Start 10% lighter, adjust based on RPE
- For unlisted exercises: Start at RPE 6-7, record weight, progress from there
- NEVER exceed recommended weights - start conservative`,
  };
}

/**
 * Priority 75: Pain points segment - Injury/limitation-based exercise restrictions
 */
function generatePainPointSegment(data: OnboardingData): PromptSegment | null {
  if (!data.painPoints || data.painPoints.length === 0) return null;

  const painRestrictions: Record<string, { avoid: string[]; substitute: string[] }> = {
    'lower back': {
      avoid: ['Conventional Deadlift', 'Bent Over Barbell Row', 'Good Mornings', 'Sit-ups', 'Heavy Back Squats'],
      substitute: ['Trap Bar Deadlift', 'Chest-Supported Row', 'Hip Thrusts', 'Dead Bug', 'Box Squats'],
    },
    'knee': {
      avoid: ['Deep Squats (ATG)', 'Walking Lunges', 'Jump Squats', 'Leg Extension', 'Deep Pistol Squats'],
      substitute: ['Box Squats (parallel)', 'Reverse Lunges', 'Step-ups', 'Leg Press', 'Wall Sits'],
    },
    'shoulder': {
      avoid: ['Behind-the-Neck Press', 'Upright Rows', 'Deep Dips', 'Wide Grip Bench Press'],
      substitute: ['Front Press', 'Face Pulls', 'Neutral Grip Press', 'Landmine Press', 'Cable Lateral Raises'],
    },
    'wrist': {
      avoid: ['Straight Bar Curls', 'Front Rack Position', 'Heavy Straight Bar Bench'],
      substitute: ['EZ Bar Curls', 'Cross-Arm Front Squat', 'Dumbbell Press', 'Neutral Grip Exercises'],
    },
    'hip': {
      avoid: ['Wide Stance Squats', 'Sumo Deadlifts', 'Deep Lunges', 'Leg Press (deep)'],
      substitute: ['Narrow Stance Squats', 'Conventional Deadlift', 'Shallow Lunges', 'Leg Press (partial ROM)'],
    },
    'elbow': {
      avoid: ['Skull Crushers', 'Close-Grip Bench (too narrow)', 'Tricep Dips'],
      substitute: ['Overhead Tricep Extension', 'Cable Pushdowns', 'Board Press', 'Neutral Grip Work'],
    },
  };

  const restrictionList: string[] = [];

  for (const painPoint of data.painPoints) {
    const normalized = painPoint.toLowerCase()
      .replace('knees', 'knee')
      .replace('shoulders', 'shoulder')
      .replace('elbows', 'elbow')
      .replace('hips', 'hip');

    const restriction = painRestrictions[normalized];
    if (restriction) {
      restrictionList.push(`
**${painPoint.toUpperCase()}:**
AVOID (do NOT program these):
${restriction.avoid.map(ex => `  ✗ ${ex}`).join('\n')}

USE INSTEAD (safe alternatives):
${restriction.substitute.map(ex => `  ✓ ${ex}`).join('\n')}
`);
    }
  }

  if (restrictionList.length === 0) return null;

  return {
    id: 'pain_points',
    priority: 75,
    content: `**INJURY/PAIN POINT RESTRICTIONS (ABSOLUTE CONSTRAINTS)**

User reported pain/discomfort in: ${data.painPoints.join(', ')}

${restrictionList.join('\n')}

**CRITICAL: Violating these restrictions = rejected plan. Pain points are non-negotiable.**`,
  };
}

/**
 * Priority 70: Session length segment - Time-based exercise count
 */
function generateSessionLengthSegment(data: OnboardingData): PromptSegment | null {
  if (!data.sessionLength) return null;

  const sessionLength = data.sessionLength;

  // Calculate exercise count based on time
  // Assumptions: 10 min warmup, 5 min cooldown, ~8-10 min per exercise
  const warmupMin = 10;
  const cooldownMin = 5;
  const workTime = sessionLength - warmupMin - cooldownMin;
  const exerciseCount = Math.floor(workTime / 9); // ~9 min per exercise (3 sets x 90s rest + work time)

  const exerciseGuidance: Record<number, { exercises: string; structure: string }> = {
    30: {
      exercises: '3-4 exercises',
      structure: '1 compound + 2-3 accessories (minimal rest between exercises)',
    },
    45: {
      exercises: '4-5 exercises',
      structure: '2 compounds + 2-3 accessories (standard rest periods)',
    },
    60: {
      exercises: '5-6 exercises',
      structure: '2-3 compounds + 3 accessories (full rest periods)',
    },
    75: {
      exercises: '6-7 exercises',
      structure: '3 compounds + 3-4 accessories (generous rest)',
    },
    90: {
      exercises: '7-8 exercises',
      structure: '3-4 compounds + 4 accessories (full recovery between sets)',
    },
  };

  // Find closest match
  const closestLength = Object.keys(exerciseGuidance)
    .map(Number)
    .reduce((prev, curr) => Math.abs(curr - sessionLength) < Math.abs(prev - sessionLength) ? curr : prev);

  const guidance = exerciseGuidance[closestLength];

  return {
    id: 'session_length',
    priority: 70,
    content: `**SESSION LENGTH: EXACTLY ${sessionLength} MINUTES (±5 min tolerance)**

Time Breakdown:
- Warmup: ${warmupMin} minutes (dynamic stretching, activation)
- Main Work: ${workTime} minutes (resistance training)
- Cooldown: ${cooldownMin} minutes (static stretching, mobility)

**Exercise Count: ${guidance.exercises}**
**Structure: ${guidance.structure}**

**CRITICAL RULES:**
- If planned session exceeds ${sessionLength + 5} minutes, plan is INVALID
- Reduce exercises or sets to fit time constraint
- Do NOT sacrifice warmup or cooldown to fit more exercises
- Rest periods must be realistic (60-90s accessories, 2-3min compounds)

**Example ${sessionLength}-minute session:**
- 0-10 min: Warmup (foam roll, dynamic stretches, activation)
- 10-${sessionLength - 5} min: Main work (${guidance.exercises})
- ${sessionLength - 5}-${sessionLength} min: Cooldown (stretching)`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateWeeksUntilEvent(targetDate: string): number {
  const target = new Date(targetDate);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffWeeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(52, diffWeeks)); // Cap at 0-52 weeks
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build complete prompt from onboarding data
 * Generates all relevant segments, sorts by priority, and combines into final prompt
 */
export function buildPromptFromOnboarding(data: OnboardingData): string {
  const segments: PromptSegment[] = [];

  // Generate all applicable segments
  const goal = generateGoalSegment(data);
  if (goal) segments.push(goal);

  const sport = generateSportSegment(data);
  if (sport) segments.push(sport);

  const periodization = generatePeriodizationSegment(data);
  if (periodization) segments.push(periodization);

  const trainingDays = generateTrainingDaysSegment(data);
  if (trainingDays) segments.push(trainingDays);

  const benchmarks = generateBenchmarkSegment(data);
  if (benchmarks) segments.push(benchmarks);

  const painPoints = generatePainPointSegment(data);
  if (painPoints) segments.push(painPoints);

  const sessionLength = generateSessionLengthSegment(data);
  if (sessionLength) segments.push(sessionLength);

  // Sort by priority (highest first)
  segments.sort((a, b) => b.priority - a.priority);

  // Build final prompt
  const header = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                     REBLD AI WORKOUT PLAN GENERATION                          ║
║                  Generated from Onboarding Flow Data                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

This prompt was automatically generated from user onboarding choices.
Each section below represents a constraint or preference with assigned priority.
Higher priority = more critical to respect in plan generation.

═══════════════════════════════════════════════════════════════════════════════
USER PROFILE SUMMARY
═══════════════════════════════════════════════════════════════════════════════

Path: ${data.path === 'competition' ? 'Competition-Focused' : 'General Fitness'}
${data.age ? `Age: ${data.age}` : ''}
${data.experience ? `Experience Level: ${data.experience.toUpperCase()}` : ''}
Training Frequency: ${data.trainingDays.length} days/week
Session Duration: ${data.sessionLength} minutes

═══════════════════════════════════════════════════════════════════════════════
PROMPT SEGMENTS (Sorted by Priority)
═══════════════════════════════════════════════════════════════════════════════
`;

  const segmentContent = segments
    .map((seg, idx) => `
──────────────────────────────────────────────────────────────────────────────
SEGMENT ${idx + 1}: ${seg.id.toUpperCase()} (Priority: ${seg.priority})
──────────────────────────────────────────────────────────────────────────────
${seg.content}
`)
    .join('\n');

  const footer = `
═══════════════════════════════════════════════════════════════════════════════
FINAL INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════

1. Respect ALL constraints above, prioritized by priority number
2. Generate a workout plan that satisfies the highest-priority constraints first
3. If constraints conflict, higher priority wins
4. Return plan in valid JSON format (schema provided separately)
5. Verify final plan meets session length and training day requirements

**CRITICAL: Session length of ${data.sessionLength} minutes is ABSOLUTE. Plans exceeding ±5 minutes are INVALID.**
`;

  return header + segmentContent + footer;
}

/**
 * Validate that generated plan respects segment constraints
 */
export function validatePlanAgainstSegments(
  plan: any,
  data: OnboardingData
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate session length (Priority 70)
  if (data.sessionLength && plan.weeklyPlan) {
    for (const day of plan.weeklyPlan) {
      if (day.estimated_duration) {
        const diff = Math.abs(day.estimated_duration - data.sessionLength);
        if (diff > 5) {
          errors.push(
            `Day ${day.day_of_week}: Duration ${day.estimated_duration}min exceeds ${data.sessionLength}min ±5min tolerance`
          );
        }
      }
    }
  }

  // Validate training days (Priority 85)
  if (data.trainingDays && plan.weeklyPlan) {
    const planDays = plan.weeklyPlan.map((d: any) => d.day_of_week).filter((d: number) => d > 0);
    const missingDays = data.trainingDays.filter(d => !planDays.includes(d));
    if (missingDays.length > 0) {
      errors.push(`Missing training days: ${missingDays.join(', ')}`);
    }
  }

  // Validate pain points (Priority 75) - check for forbidden exercises
  if (data.painPoints && data.painPoints.length > 0 && plan.weeklyPlan) {
    const forbidden = getForbiddenExercises(data.painPoints);
    for (const day of plan.weeklyPlan) {
      for (const block of day.blocks || []) {
        for (const ex of block.exercises || []) {
          const exName = ex.exercise_name?.toLowerCase() || '';
          for (const forbiddenEx of forbidden) {
            if (exName.includes(forbiddenEx.toLowerCase())) {
              errors.push(`Forbidden exercise for pain point: ${ex.exercise_name}`);
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get list of forbidden exercises based on pain points
 */
function getForbiddenExercises(painPoints: string[]): string[] {
  const forbidden: string[] = [];

  const restrictionMap: Record<string, string[]> = {
    'lower back': ['conventional deadlift', 'bent over row', 'good morning', 'sit-up'],
    'knee': ['deep squat', 'walking lunge', 'jump squat', 'leg extension'],
    'shoulder': ['behind-the-neck press', 'upright row', 'wide grip bench'],
    'wrist': ['straight bar curl', 'front rack', 'straight bar bench'],
    'hip': ['wide stance squat', 'sumo deadlift', 'deep lunge'],
    'elbow': ['skull crusher', 'tricep dip'],
  };

  for (const painPoint of painPoints) {
    const normalized = painPoint.toLowerCase()
      .replace('knees', 'knee')
      .replace('shoulders', 'shoulder')
      .replace('elbows', 'elbow')
      .replace('hips', 'hip');

    if (restrictionMap[normalized]) {
      forbidden.push(...restrictionMap[normalized]);
    }
  }

  return forbidden;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  generateGoalSegment,
  generateSportSegment,
  generatePeriodizationSegment,
  generateTrainingDaysSegment,
  generateBenchmarkSegment,
  generatePainPointSegment,
  generateSessionLengthSegment,
};
