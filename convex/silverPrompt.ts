/**
 * SILVER PROMPT - Structured JSON-based Plan Generation
 *
 * Philosophy:
 * - Every onboarding choice maps to a specific prompt segment
 * - JSON in → JSON out = reliable parsing
 * - Pain points trigger BOTH avoidance AND rehabilitation
 * - Two-phase: Fast generation → Background enrichment
 *
 * This replaces the massive prose prompts with structured data.
 */

import { INJURY_PROTOCOLS } from "./rehab/injuryProtocolsData";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface OnboardingData {
  // Identity
  userId?: string;
  firstName?: string;
  age?: number;
  sex?: 'male' | 'female' | 'other';

  // Goal Path
  path: 'competition' | 'general';

  // Competition-specific
  sport?: string;           // 'hyrox', 'powerlifting', 'marathon', etc.
  eventName?: string;       // 'Cologne Hyrox 2026'
  eventDate?: string;       // '2026-04-12'

  // General-specific
  generalGoal?: 'muscle' | 'strength' | 'fat_loss' | 'wellness';

  // Training Config
  experience: 'beginner' | 'intermediate' | 'advanced';
  trainingDays: number[];   // [0,1,2,3,4,5,6] = Mon-Sun
  sessionLength: number;    // 30, 45, 60, 75, 90
  sessionsPerDay: '1' | '2';

  // Physical State
  painPoints: string[];     // ['lower_back', 'knees', 'shoulders']
  currentStrength?: {
    bench_kg?: number;
    squat_kg?: number;
    deadlift_kg?: number;
  };

  // Personalization
  additionalNotes?: string; // Free text from user
}

export interface SilverPromptOutput {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: object;
  rehabExercises: RehabExercise[];
  avoidExercises: string[];
}

export interface RehabExercise {
  exercise: string;
  category: string;
  reason: string;
  sets: number;
  reps: string;
  frequency: string;  // 'every_session', 'twice_weekly', etc.
}

// ═══════════════════════════════════════════════════════════════════════════
// PAIN POINT → REHAB MAPPING
// ═══════════════════════════════════════════════════════════════════════════

function getRehabProtocol(painPoint: string): {
  avoid: string[];
  rehab: RehabExercise[];
  alternatives: { avoid: string; useInstead: string }[];
} {
  // Map common pain point names to protocol keys
  const painPointMap: Record<string, string> = {
    'lower_back': 'lower_back',
    'back': 'lower_back',
    'knees': 'knee_pain',
    'knee': 'knee_pain',
    'shoulders': 'shoulder_impingement',
    'shoulder': 'shoulder_impingement',
    'wrists': 'wrist_pain',
    'wrist': 'wrist_pain',
    'neck': 'neck_pain',
    'hips': 'hip_pain',
    'hip': 'hip_pain',
    'ankles': 'ankle_instability',
    'ankle': 'ankle_instability',
  };

  const protocolKey = painPointMap[painPoint.toLowerCase()] || painPoint.toLowerCase();
  const protocol = INJURY_PROTOCOLS.find(p =>
    p.issue.toLowerCase().includes(protocolKey) ||
    protocolKey.includes(p.issue.toLowerCase().split(' ')[0])
  );

  if (!protocol) {
    return { avoid: [], rehab: [], alternatives: [] };
  }

  return {
    avoid: protocol.exercises_to_avoid.map(e => e.exercise),
    rehab: protocol.rehab_exercises.map(e => ({
      exercise: e.exercise,
      category: e.category,
      reason: `Rehab for ${painPoint}`,
      sets: e.sets,
      reps: e.reps,
      frequency: e.priority === 'essential' ? 'every_session' : 'twice_weekly',
    })),
    alternatives: protocol.safe_alternatives.map(a => ({
      avoid: a.avoid,
      useInstead: a.use_instead,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PERIODIZATION CALCULATOR (No AI needed)
// ═══════════════════════════════════════════════════════════════════════════

interface PeriodizationPlan {
  totalWeeks: number;
  currentWeek: number;
  phases: { name: string; weeks: number; focus: string }[];
  currentPhase: string;
  isDeloadWeek: boolean;
}

function calculatePeriodization(data: OnboardingData): PeriodizationPlan {
  const now = new Date();

  if (data.path === 'competition' && data.eventDate) {
    // Competition: Calculate weeks until event
    const eventDate = new Date(data.eventDate);
    const weeksUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));

    if (weeksUntilEvent <= 4) {
      return {
        totalWeeks: weeksUntilEvent,
        currentWeek: 1,
        phases: [{ name: 'PEAK', weeks: weeksUntilEvent, focus: 'Competition prep, sport-specific work' }],
        currentPhase: 'PEAK',
        isDeloadWeek: false,
      };
    }

    // Standard periodization for longer prep
    const taperWeeks = Math.min(2, Math.floor(weeksUntilEvent * 0.1));
    const peakWeeks = Math.min(3, Math.floor(weeksUntilEvent * 0.2));
    const buildWeeks = Math.floor((weeksUntilEvent - taperWeeks - peakWeeks) * 0.5);
    const baseWeeks = weeksUntilEvent - taperWeeks - peakWeeks - buildWeeks;

    return {
      totalWeeks: weeksUntilEvent,
      currentWeek: 1,
      phases: [
        { name: 'BASE', weeks: baseWeeks, focus: 'Build aerobic base, technical work, volume' },
        { name: 'BUILD', weeks: buildWeeks, focus: 'Increase intensity, sport-specific conditioning' },
        { name: 'PEAK', weeks: peakWeeks, focus: 'Race-pace work, competition simulation' },
        { name: 'TAPER', weeks: taperWeeks, focus: 'Reduce volume, maintain intensity, recovery' },
      ],
      currentPhase: 'BASE',
      isDeloadWeek: false,
    };
  }

  // General fitness: Rolling 12-week cycles
  return {
    totalWeeks: 12,
    currentWeek: 1,
    phases: [
      { name: 'ACCUMULATION', weeks: 4, focus: 'Build volume, technique refinement' },
      { name: 'INTENSIFICATION', weeks: 4, focus: 'Increase intensity, reduce volume' },
      { name: 'REALIZATION', weeks: 3, focus: 'Peak performance, test maxes' },
      { name: 'DELOAD', weeks: 1, focus: 'Active recovery, reduce load 50%' },
    ],
    currentPhase: 'ACCUMULATION',
    isDeloadWeek: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAINING SPLIT CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════

function getTrainingSplit(daysPerWeek: number, sessionsPerDay: '1' | '2'): string[] {
  const splits: Record<number, string[]> = {
    2: ['Full Body', 'Full Body'],
    3: ['Full Body', 'Full Body', 'Full Body'],
    4: ['Upper', 'Lower', 'Upper', 'Lower'],
    5: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
    6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
    7: ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Active Recovery'],
  };

  const baseSplit = splits[daysPerWeek] || splits[4];

  if (sessionsPerDay === '2') {
    // 2-a-day: AM = Strength focus, PM = Conditioning/Sport-specific
    return baseSplit.map(focus => `${focus} (AM: Strength / PM: Conditioning)`);
  }

  return baseSplit;
}

// ═══════════════════════════════════════════════════════════════════════════
// SILVER PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildSilverPrompt(data: OnboardingData): SilverPromptOutput {
  // 1. Gather all rehab/avoidance data from pain points
  const allRehabExercises: RehabExercise[] = [];
  const allAvoidExercises: string[] = [];
  const allAlternatives: { avoid: string; useInstead: string }[] = [];

  for (const painPoint of data.painPoints) {
    const protocol = getRehabProtocol(painPoint);
    allRehabExercises.push(...protocol.rehab);
    allAvoidExercises.push(...protocol.avoid);
    allAlternatives.push(...protocol.alternatives);
  }

  // 2. Calculate periodization
  const periodization = calculatePeriodization(data);

  // 3. Get training split
  const trainingSplit = getTrainingSplit(data.trainingDays.length, data.sessionsPerDay);

  // 4. Build the structured prompt
  const structuredInput = {
    user: {
      age: data.age || 'not specified',
      sex: data.sex || 'not specified',
      experience: data.experience,
      firstName: data.firstName,
    },
    goal: {
      type: data.path,
      primary: data.path === 'competition'
        ? `${data.sport} competition: ${data.eventName || 'Event'}`
        : data.generalGoal,
      ...(data.eventDate && { targetDate: data.eventDate }),
    },
    training: {
      daysPerWeek: data.trainingDays.length,
      activeDays: data.trainingDays.map(d => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]),
      sessionLength: data.sessionLength,
      sessionsPerDay: data.sessionsPerDay,
      split: trainingSplit,
    },
    periodization: {
      currentPhase: periodization.currentPhase,
      phaseFocus: periodization.phases.find(p => p.name === periodization.currentPhase)?.focus,
      weeksInProgram: periodization.totalWeeks,
      currentWeek: periodization.currentWeek,
      isDeloadWeek: periodization.isDeloadWeek,
    },
    constraints: {
      painPoints: data.painPoints,
      avoidExercises: [...new Set(allAvoidExercises)],
      substituteWith: allAlternatives,
      currentStrength: data.currentStrength,
    },
    rehabilitation: {
      required: allRehabExercises.length > 0,
      exercises: allRehabExercises,
      instruction: allRehabExercises.length > 0
        ? 'MUST include these rehab exercises in warmup or cooldown of EVERY session'
        : null,
    },
    personalization: {
      additionalNotes: data.additionalNotes || null,
      instruction: data.additionalNotes
        ? 'User has specific requests - prioritize these over defaults'
        : null,
    },
  };

  // 5. Create the system prompt (concise, structured)
  const systemPrompt = `You are an elite fitness coach. Generate a personalized 7-day workout plan.

CRITICAL RULES:
1. Pain points trigger BOTH avoidance AND rehabilitation
2. User's additional notes are HIGHEST priority
3. Every exercise needs: exercise_name, category, metrics_template
4. Rest days have focus: "Rest" and empty blocks: []

OUTPUT: Valid JSON only. No markdown, no explanation.`;

  // 6. Create the user prompt (structured JSON input)
  const userPrompt = `Generate workout plan for this user:

${JSON.stringify(structuredInput, null, 2)}

Required JSON output structure:
{
  "name": "Personalized Plan for {firstName}",
  "weeklyPlan": [
    {
      "day_of_week": 1,
      "focus": "{split focus}",
      "estimated_duration": ${data.sessionLength},
      ${data.sessionsPerDay === '2' ? '"sessions": [{ "session_name": "AM Strength", "time_of_day": "morning", "blocks": [...] }, { "session_name": "PM Conditioning", "time_of_day": "afternoon", "blocks": [...] }]' : '"blocks": [...]'}
    }
  ]
}

Exercise format:
{
  "exercise_name": "Name",
  "category": "warmup|main|cooldown",
  "rpe": "7-8",
  "metrics_template": {
    "type": "sets_reps_weight",
    "target_sets": 4,
    "target_reps": "8-10",
    "rest_period_s": 90
  }
}

${allRehabExercises.length > 0 ? `
MANDATORY REHAB (include in warmup/cooldown):
${allRehabExercises.map(r => `- ${r.exercise}: ${r.sets}×${r.reps} (${r.reason})`).join('\n')}
` : ''}

${data.additionalNotes ? `
USER'S SPECIFIC REQUESTS (HIGHEST PRIORITY):
"${data.additionalNotes}"
` : ''}

Generate the complete 7-day plan now.`;

  // 7. Define expected output schema (for validation)
  const outputSchema = {
    name: 'string',
    weeklyPlan: [{
      day_of_week: 'number (1-7)',
      focus: 'string',
      estimated_duration: 'number',
      blocks: [{
        type: 'single|superset|circuit',
        exercises: [{
          exercise_name: 'string (required)',
          category: 'warmup|main|cooldown (required)',
          metrics_template: {
            type: 'sets_reps_weight|duration_only|sets_duration|distance_time',
            target_sets: 'number',
            target_reps: 'string|number',
            rest_period_s: 'number',
          },
          rpe: 'string (optional)',
          notes: 'string (optional)',
        }],
      }],
    }],
  };

  return {
    systemPrompt,
    userPrompt,
    outputSchema,
    rehabExercises: allRehabExercises,
    avoidExercises: [...new Set(allAvoidExercises)],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS FOR PHASE 2 (Background Processing)
// ═══════════════════════════════════════════════════════════════════════════

export { calculatePeriodization, getTrainingSplit, getRehabProtocol };
