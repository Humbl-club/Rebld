/**
 * Convex AI Actions - Server-side Gemini API calls
 *
 * SECURITY: API keys are kept server-side only, never exposed to client
 *
 * Model Selection:
 * - gemini-2.5-pro: Complex plan generation (higher quality, slower)
 * - gemini-2.5-flash: Quick responses, exercise explanations (faster, cheaper)
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { loggers } from "./utils/logger";
import { formatSportPrompt } from "./sportData";
import { formatSupplementPrompt } from "./supplementData";
import {
  extractAndParseJSON,
  generateWithRetry,
  addDurationEstimates,
  getHeartRateGuidance,
  getDurationConstraintPrompt
} from "./utils/aiHelpers";
import {
  buildBriefMasterPrompt,
  getSportSpecificContext,
  getReadinessContext,
  getGoalEmphasis,
  type PromptInputs,
  type CurrentStrength
} from "./promptBuilder";
import {
  getCompleteSchemaPrompt,
  getSessionLengthGuidance,
  SESSION_DURATION_RULES,
  type SessionLength,
  TWO_A_DAY_PROMPT,
  PERIODIZATION_PROMPT,
  detectTwoADayFormat,
  TWO_A_DAY_PATTERNS,
} from "./planSchema";
import {
  getMetricsTemplatePrompt,
  getTerminologyPrompt,
  METRICS_TEMPLATES,
} from "./metricsTemplateReference";
import { getExamplePlansPrompt } from "./planExamples";
import { validateWorkoutPlan, validateAndExplain, fixCardioTemplates } from "./planValidator";

// Type for cardio preferences
interface CardioPreferences {
  preferred_types: string[];
  favorite_exercise?: string;
  cardio_duration_minutes?: number;
  outdoor_preferred?: boolean;
}

// Type for training split
interface TrainingSplit {
  sessions_per_day: '1' | '2';
  training_type: 'strength_only' | 'strength_plus_cardio' | 'combined' | 'cardio_focused';
  cardio_preferences?: CardioPreferences;
}

/**
 * Get optimal cardio duration based on user's goal when they haven't specified a preference.
 * User preferences (cardio_duration_minutes) ALWAYS take priority over these defaults.
 */
function getCardioDurationForGoal(goal: string): { duration: number; rationale: string } {
  const goalDurations: Record<string, { duration: number; rationale: string }> = {
    // Fat loss requires longer, steady-state cardio for maximum fat oxidation
    'fat_loss': { duration: 45, rationale: 'Fat loss: 45+ min Zone 2 cardio maximizes fat oxidation' },
    'weight_loss': { duration: 45, rationale: 'Weight loss: 45+ min steady state cardio for calorie burn' },
    'lose_weight': { duration: 45, rationale: 'Weight loss: 45+ min steady state cardio for calorie burn' },

    // Aesthetic goals need moderate cardio to preserve muscle
    'aesthetic': { duration: 30, rationale: 'Aesthetic: 30 min cardio preserves muscle while burning fat' },
    'body_composition': { duration: 30, rationale: 'Body recomp: 30 min cardio balances muscle preservation' },

    // Endurance sports need longer sessions
    'endurance': { duration: 60, rationale: 'Endurance: 60+ min builds aerobic base' },
    'marathon': { duration: 60, rationale: 'Marathon training: 60+ min for aerobic development' },
    'triathlon': { duration: 60, rationale: 'Triathlon training: 60+ min multi-sport conditioning' },
    'hyrox': { duration: 45, rationale: 'Hyrox: 45 min mixed modal conditioning' },

    // Strength goals: minimal cardio, just for health
    'strength': { duration: 20, rationale: 'Strength focus: 20 min cardio for heart health without interfering with gains' },
    'powerlifting': { duration: 20, rationale: 'Powerlifting: 20 min light cardio for recovery' },

    // General fitness: moderate
    'general_fitness': { duration: 30, rationale: 'General fitness: 30 min balanced cardio' },
    'health': { duration: 30, rationale: 'General health: 30 min cardio meets health guidelines' },
  };

  // Match goal (case-insensitive, partial match)
  const normalizedGoal = goal.toLowerCase().replace(/[^a-z]/g, '_');

  for (const [key, value] of Object.entries(goalDurations)) {
    if (normalizedGoal.includes(key) || key.includes(normalizedGoal)) {
      return value;
    }
  }

  // Default for unrecognized goals
  return { duration: 30, rationale: 'Standard: 30 min cardio session' };
}

// Type for specific goal
interface SpecificGoal {
  event_type?: string | null;
  event_name?: string | null;
  target_date?: string | null;
  current_readiness?: number | null;
  description?: string | null;
}

/**
 * Format training split prompt for 2x daily training
 * @param split - Training split configuration
 * @param primaryGoal - User's primary training goal (used to determine cardio duration if not specified)
 */
function formatTrainingSplitPrompt(split?: TrainingSplit, primaryGoal?: string): string {
  if (!split || split.sessions_per_day === '1') return '';

  const trainingTypeDescriptions: Record<string, string> = {
    'strength_only': 'Both sessions focus on strength training. AM = Heavy compounds, PM = Accessory/isolation work.',
    'strength_plus_cardio': 'AM = Cardio/conditioning, PM = Strength training.',
    'combined': 'Each session combines strength and cardio elements.',
    'cardio_focused': 'Primary focus on cardio/endurance with supplemental strength work.',
  };

  // Build personalized cardio guidance based on user preferences
  const cardioPrefs = split.cardio_preferences;

  // CARDIO DURATION LOGIC:
  // 1. User's explicit preference takes priority
  // 2. Otherwise, determine based on primary goal
  const goalBasedCardio = getCardioDurationForGoal(primaryGoal || 'general_fitness');
  const cardioDuration = cardioPrefs?.cardio_duration_minutes || goalBasedCardio.duration;
  const cardioDurationRationale = cardioPrefs?.cardio_duration_minutes
    ? `User preference: ${cardioDuration} min cardio`
    : goalBasedCardio.rationale;

  const preferredTypes = cardioPrefs?.preferred_types || [];
  const favoriteCardio = cardioPrefs?.favorite_exercise;

  // Map preferred types to exercise names
  const cardioExerciseMap: Record<string, string> = {
    'running': 'Treadmill Run',
    'incline_walk': 'Incline Treadmill Walk',
    'incline walk': 'Incline Treadmill Walk',
    'stairs': 'StairMaster',
    'cycling': 'Stationary Bike',
    'rowing': 'Rowing Machine',
    'swimming': 'Swimming',
    'elliptical': 'Elliptical Trainer',
    'stair_climber': 'StairMaster',
    'jump_rope': 'Jump Rope',
    'hiking': 'Outdoor Hike',
  };

  // Get preferred exercises or default list
  const userCardioExercises = preferredTypes.length > 0
    ? preferredTypes.map(t => cardioExerciseMap[t] || t).join(', ')
    : 'Treadmill Run, Stationary Bike, Rowing Machine, Elliptical';

  const favoriteExercise = favoriteCardio
    ? cardioExerciseMap[favoriteCardio] || favoriteCardio
    : null;

  // Enhanced cardio guidance for training types that include cardio
  const needsCardioGuidance = split.training_type === 'strength_plus_cardio' ||
                              split.training_type === 'combined' ||
                              split.training_type === 'cardio_focused';

  const cardioGuidance = needsCardioGuidance ? `

**═══════════════════════════════════════════════════════════════**
**CARDIO CONSTRAINTS (ABSOLUTE - NO EXCEPTIONS)**
**═══════════════════════════════════════════════════════════════**

${preferredTypes.length > 0 ? `
**ALLOWED CARDIO EXERCISES (USE ONLY THESE):**
${preferredTypes.map(t => `✓ ${cardioExerciseMap[t] || t}`).join('\n')}

**FORBIDDEN CARDIO (DO NOT USE):**
${Object.entries(cardioExerciseMap).filter(([key]) => !preferredTypes.includes(key)).map(([, name]) => `✗ ${name}`).join('\n')}

If user selected "Elliptical" and "Rowing" - ONLY use Elliptical and Rowing. Do NOT add Treadmill, Bike, etc.
` : ''}

**CARDIO DURATION: EXACTLY ${cardioDuration} MINUTES**
- Every single cardio session = ${cardioDuration} minutes
- target_duration_minutes: ${cardioDuration} (not ${cardioDuration - 10}, not ${cardioDuration + 10})
- This is user's explicit requirement, not a suggestion

**═══════════════════════════════════════════════════════════════**

CARDIO METRICS - USE "duration_only" for cardio:
{
  "exercise_name": "${favoriteExercise || 'Treadmill Run'}",
  "category": "main",
  "metrics_template": {
    "type": "duration_only",
    "target_duration_minutes": ${cardioDuration}
  },
  "rpe": "6-7",
  "notes": "Zone 2 cardio - ${cardioDuration} minutes"
}

COMPLETE AM CARDIO SESSION EXAMPLE:
{
  "session_name": "AM Cardio",
  "time_of_day": "morning",
  "estimated_duration": ${cardioDuration + 10},
  "blocks": [{
    "type": "single",
    "exercises": [{
      "exercise_name": "${favoriteExercise || 'Treadmill Run'}",
      "category": "main",
      "metrics_template": { "type": "duration_only", "target_duration_minutes": ${cardioDuration} },
      "rpe": "6",
      "notes": "Steady state Zone 2 cardio"
    }]
  }]
}

IMPORTANT:
- Cardio sessions MUST be at least ${cardioDuration} minutes
- Use "duration_only" metrics type with "target_duration_minutes" for all cardio
- Prioritize user's preferred cardio: ${userCardioExercises}
` : '';

  return `
**2x DAILY TRAINING - MANDATORY STRUCTURE**
The user trains TWICE per day. You MUST output "sessions" array instead of "blocks" for each training day.

Training Type: ${split.training_type}
Split Strategy: ${trainingTypeDescriptions[split.training_type] || 'Balanced AM/PM split'}
${cardioGuidance}

${TWO_A_DAY_PROMPT}

CRITICAL: Each day MUST have a "sessions" array with 2 session objects (morning and evening).
Do NOT use "blocks" directly on the day - use "sessions" with nested "blocks" inside each session.
`;
}

/**
 * Format periodization prompt for goal-based training
 */
function formatPeriodizationPrompt(goal?: SpecificGoal): string {
  if (!goal?.target_date) return '';

  const targetDate = new Date(goal.target_date);
  const now = new Date();
  const weeksUntil = Math.ceil((targetDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));

  if (weeksUntil <= 0) return ''; // Target date has passed

  // Calculate phase distribution
  const baseWeeks = Math.floor(weeksUntil * 0.35);
  const buildWeeks = Math.floor(weeksUntil * 0.35);
  const peakWeeks = Math.floor(weeksUntil * 0.15);
  const taperWeeks = weeksUntil - baseWeeks - buildWeeks - peakWeeks;

  // Determine current phase (week 1 is always BASE)
  const currentPhase = 'base';
  const phaseEndWeek = baseWeeks;

  return `
**PERIODIZATION - TARGET DATE: ${goal.target_date}**
${goal.event_type ? `Event: ${goal.event_type}${goal.event_name ? ` (${goal.event_name})` : ''}` : ''}
${goal.description ? `Goal Description: ${goal.description}` : ''}
${goal.current_readiness ? `Current Readiness: ${goal.current_readiness}/10` : ''}

Total Weeks Until Event: ${weeksUntil}
Phase Distribution:
- BASE Phase: Weeks 1-${baseWeeks} (${baseWeeks} weeks) - Build foundation, moderate intensity
- BUILD Phase: Weeks ${baseWeeks + 1}-${baseWeeks + buildWeeks} (${buildWeeks} weeks) - Sport-specific, progressive overload
- PEAK Phase: Weeks ${baseWeeks + buildWeeks + 1}-${baseWeeks + buildWeeks + peakWeeks} (${peakWeeks} weeks) - High intensity, competition simulation
- TAPER Phase: Weeks ${baseWeeks + buildWeeks + peakWeeks + 1}-${weeksUntil} (${taperWeeks} weeks) - Recovery, maintain sharpness

CURRENT PHASE: ${currentPhase.toUpperCase()} (Week 1 of ${phaseEndWeek})

${PERIODIZATION_PROMPT}

Include "periodization" object in your output:
{
  "periodization": {
    "total_weeks": ${weeksUntil},
    "current_week": 1,
    "phase": "${currentPhase}",
    "phase_description": "Building aerobic foundation and movement proficiency",
    "weeks_in_phase": ${phaseEndWeek},
    "phase_end_week": ${phaseEndWeek}
  }
}
`;
}

/**
 * Cardio parsing patterns for detecting running, cycling, and other cardio exercises
 */
export const CARDIO_PARSING_RULES = `
**CARDIO EXERCISE PARSING RULES:**
When you encounter cardio exercises, use the appropriate metrics_template:

1. Duration-based cardio (steady state):
   - "90 min run" → { "type": "duration_only", "target_duration_minutes": 90 }
   - "Long Run" → { "type": "duration_only", "target_duration_minutes": 60 }
   - "Easy Run" → { "type": "duration_only", "target_duration_minutes": 30 }
   - "Incline Walk" → { "type": "duration_only", "target_duration_minutes": 30 }
   - "45 min bike" → { "type": "duration_only", "target_duration_minutes": 45 }

2. Distance-based cardio:
   - "5km run" → { "type": "distance_time", "target_distance_km": 5 }
   - "1000m row" → { "type": "distance_time", "target_distance_m": 1000 }
   - "2km swim" → { "type": "distance_time", "target_distance_km": 2 }

3. **INTERVAL CARDIO (CRITICAL - ALWAYS SPECIFY SETS/ROUNDS):**
   Time-based intervals MUST include sets and work/rest durations:
   - "Rowing Intervals" → { "type": "sets_duration_rest", "target_sets": 8, "work_duration_s": 20, "rest_duration_s": 40 }
   - "Bike Sprints" → { "type": "sets_duration_rest", "target_sets": 10, "work_duration_s": 30, "rest_duration_s": 30 }
   - "Treadmill HIIT" → { "type": "sets_duration_rest", "target_sets": 6, "work_duration_s": 60, "rest_duration_s": 90 }

   Distance-based intervals:
   - "8x400m" → { "type": "sets_distance_rest", "target_sets": 8, "distance_m": 400, "rest_s": 90 }
   - "6x800m" → { "type": "sets_distance_rest", "target_sets": 6, "distance_m": 800, "rest_s": 120 }

   **NEVER create intervals without specifying how many rounds/sets!**
   Total workout time = sets × (work + rest). Example: 8 × (20s + 40s) = 8 min

4. Machine cardio (SkiErg, Rower):
   - "1000m SkiErg" → { "type": "distance_time", "target_distance_m": 1000 }
   - "2000m row" → { "type": "distance_time", "target_distance_m": 2000 }

5. Low-impact options (great for all fitness levels):
   - "Incline Treadmill Walk" - 10-15% incline, 3-4 mph, Zone 2 cardio
   - Excellent for fat burning, easy on joints, high calorie burn

IMPORTANT: Cardio exercises should have category "main" unless they are warm-up jogs (then "warmup").
`;

/**
 * Exercise selection hierarchy prompt for AI plan generation
 * Guides AI to select exercises based on role classification
 */
export function getExerciseSelectionHierarchyPrompt(sport?: string, goal?: string): string {
  const sportSpecific = sport && sport !== 'general_fitness' && sport !== 'none';

  return `
**EXERCISE SELECTION HIERARCHY:**
Use this hierarchy when selecting exercises for each session:

1. **CORE exercises (2-3 per session)** - Foundation movements
   Examples: Squat, Bench Press, Deadlift, Row, Overhead Press, Pull-up, Hip Thrust
   These are the primary strength builders and should anchor the workout.

2. **ACCESSORY exercises (2-4 per session)** - Support and balance
   Examples: DB Fly, Leg Curl, Lat Pulldown, Face Pull, Tricep Extension
   These address weak points and support the core lifts.

3. **COMPLEMENTARY exercises (1-3 if sport-specific)** - Goal-aligned
   Examples: Sled Push (Hyrox), Box Jump (Athletic), Medicine Ball (Rotation sports)
   ${sportSpecific ? `For ${sport} training, include sport-specific movements.` : 'Include if user has a specific sport or athletic goal.'}

4. **ISOLATION exercises (0-2 per session)** - Finishers only
   Examples: Bicep Curl, Lateral Raise, Calf Raise
   Only include as finishing touches, not as main workout components.

5. **CARDIO exercises (as needed)** - Based on goal and sport
   ${sportSpecific && ['marathon', 'hyrox', 'triathlon', 'running'].includes(sport.toLowerCase())
     ? `For ${sport}, include specific cardio work: Long Run, Tempo Run, Intervals, etc.`
     : 'Include conditioning work appropriate for the user goal.'}
   Use appropriate metrics (duration_only, distance_time, or sets_distance_rest).

6. **MOBILITY exercises (warmup/cooldown)** - Movement prep and recovery
   For PUBLIC GYM settings, prioritize STANDING exercises that aren't awkward:
   Good: Arm Circles, Leg Swings, Band Pull-Aparts, Walking Lunges, High Knees, Bodyweight Squats
   AVOID floor-based: Cat-Cow, Hip Circles, Dead Bug, Bird Dog (awkward in busy gyms)
   Include 3-5 in warmup and 2-3 in cooldown.

**SELECTION RULES:**
- Start with CORE exercises for the day's focus
- Add ACCESSORY exercises to support the core lifts
- Include COMPLEMENTARY exercises only for sport-specific needs
- ISOLATION exercises should be used sparingly (arms, calves)
- NEVER create a session with only isolation exercises
- Match the exercise tier (S/A/B/C) to the user's experience level
`;
}

/**
 * Parse a text workout plan into structured JSON
 * Server-side action to keep API key secure
 *
 * Uses Pro model with thinking for intelligent parsing of ANY format
 */
export const parseWorkoutPlan = action({
  args: {
    planText: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in Convex environment variables.");
    }

    // Rate limiting
    const { checkRateLimit } = await import("./rateLimiter");
    checkRateLimit(args.userId, "parseWorkoutPlan");

    // Dynamic import to avoid bundling issues
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an ELITE workout plan parser. Your job is to intelligently analyze ANY workout plan format and convert it into structured JSON.

**YOUR SUPERPOWER: You can parse ANY format:**
- Simple text lists: "Monday: Bench press 3x10, Rows 3x12"
- Markdown tables with complex formatting
- Coach's notes with abbreviations (A1/A2 supersets, EMOM, AMRAP, etc.)
- Screenshots transcribed as text
- PDF exports from other apps
- Handwritten notes transcribed
- Programs from fitness influencers
- Scientific periodization programs
- CrossFit WODs
- Powerlifting programs (5/3/1, GZCL, etc.)
- Bodybuilding splits (PPL, Bro splits, etc.)
- ANY language or format - just figure it out!

**CRITICAL RULES:**
1. EVERY exercise MUST have "category": "warmup" | "main" | "cooldown"
2. If the plan doesn't specify days, create a logical week structure
3. If it's a single workout, put it on Day 1 and mark other days as rest
4. NEVER return empty blocks unless explicitly a rest day
5. Infer reasonable sets/reps if not specified (e.g., "Bench press" → 3 sets, 8-10 reps)
6. Parse abbreviations: DB=Dumbbell, BB=Barbell, KB=Kettlebell, BW=Bodyweight
7. Recognize supersets (A1/A2), circuits, AMRAPs, EMOMs
8. **EXERCISE INFERENCE RULES:**
   - If user lists specific exercises → parse exactly what they wrote, don't add extras
   - If user gives only muscle groups (e.g., "chest day", "leg day") → create 3-4 basic exercises for that muscle group
   - If user is vague (e.g., "whatever") → create a simple full-body routine
   - NEVER add warmups/cooldowns unless user mentions them
9. Mark ALL exercises as "main" category unless clearly warmup/cooldown

**OUTPUT JSON SCHEMA:**
{
  "name": "Plan Name (infer from content or use 'Imported Plan')",
  "weeklyPlan": [
    {
      "day_of_week": 1-7 (1=Monday, 7=Sunday),
      "focus": "Day focus (e.g., 'Upper Body', 'Pull Day', 'Rest')",
      "notes": "Any day-level notes",
      "blocks": [
        {
          "type": "single" | "superset" | "amrap",
          "title": "Optional block title",
          "rounds": 3 (for supersets - how many times to repeat),
          "duration_minutes": 10 (for AMRAPs),
          "exercises": [
            {
              "exercise_name": "Full exercise name",
              "category": "warmup" | "main" | "cooldown",
              "notes": "Form cues, tempo, etc.",
              "rpe": "7-8" (if specified),
              "metrics_template": {
                "type": "sets_reps_weight",
                "target_sets": 3,
                "target_reps": "8-10",
                "rest_period_s": 90
              }
            }
          ]
        }
      ]
    }
  ]
}

**METRICS TEMPLATE TYPES (use the correct one!):**
- sets_reps_weight: { type, target_sets, target_reps, rest_period_s } - DEFAULT for strength exercises
- sets_reps: { type, target_sets, target_reps } - bodyweight exercises
- duration_only: { type, duration_minutes } - cardio like running, cycling
- sets_duration: { type, target_sets, duration_seconds } - planks, holds
- sets_duration_rest: { type, target_sets, work_duration_s, rest_duration_s } - intervals like rowing sprints
- distance_time: { type, distance_km OR distance_m } - running with distance

**HANDLE EDGE CASES:**
- "Chest day" → Parse as single workout on Day 1, don't add exercises
- Single exercise listed → Put it in a block, don't invent other exercises
- Just exercise names → Add sensible sets/reps using sets_reps_weight
- Foreign language → Translate exercise names to English
- Typos → Fix them and parse correctly

${CARDIO_PARSING_RULES}

Parse intelligently. Return ONLY valid JSON.`;

    // Detect 2x/day patterns in the plan text
    const hasTwoADayPatterns = detectTwoADayFormat(args.planText);

    // Add 2x/day parsing instructions if patterns detected
    const twoADayParsingPrompt = hasTwoADayPatterns ? `
**2x DAILY TRAINING DETECTED**
This plan contains two workouts per day. Look for patterns like:
- "Day 1A / Day 1B" or "Day 1a / Day 1b"
- "Morning Session / Evening Session"
- "AM / PM" workouts
- "Session 1: / Session 2:"
- "Workout A: / Workout B:"

For days with 2 sessions, output "sessions" array instead of "blocks":
{
  "day_of_week": 1,
  "focus": "Cardio + Strength",
  "sessions": [
    {
      "session_name": "AM Cardio",
      "time_of_day": "morning",
      "estimated_duration": 45,
      "blocks": [...]
    },
    {
      "session_name": "PM Strength",
      "time_of_day": "evening",
      "estimated_duration": 60,
      "blocks": [...]
    }
  ]
}

IMPORTANT: For 2x/day, use "sessions" array. For single session days, use "blocks" directly.
` : '';

    try {
      loggers.ai.info('Parsing workout plan with Gemini Pro (with retry logic)...', hasTwoADayPatterns ? '(2x/day detected)' : '');

      const fullPrompt = twoADayParsingPrompt
        ? `${systemPrompt}\n\n${twoADayParsingPrompt}`
        : systemPrompt;

      const parsedPlan = await generateWithRetry(
        ai.models,
        {
          model: 'gemini-3-pro-preview', // Upgraded to Gemini 3 Pro
          contents: `${fullPrompt}\n\n---\nUSER'S PLAN TO PARSE:\n---\n${args.planText}`,
          config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 8192 }
          }
        },
        validateWorkoutPlan,
        3 // Max 3 attempts
      );

      // Post-process: Ensure every exercise has a category
      if (parsedPlan.weeklyPlan) {
        for (const day of parsedPlan.weeklyPlan) {
          if (!day.blocks) continue;

          for (let blockIndex = 0; blockIndex < day.blocks.length; blockIndex++) {
            const block = day.blocks[blockIndex];
            if (!block.exercises) continue;

            for (const exercise of block.exercises) {
              if (!exercise.category) {
                const exerciseName = exercise.exercise_name?.toLowerCase() || '';
                const isWarmup = exerciseName.includes('stretch') ||
                                exerciseName.includes('warmup') ||
                                exerciseName.includes('mobility') ||
                                exerciseName.includes('foam roll') ||
                                blockIndex === 0;

                const isCooldown = exerciseName.includes('cooldown') ||
                                  exerciseName.includes('static stretch') ||
                                  blockIndex === day.blocks.length - 1;

                exercise.category = isWarmup ? 'warmup' : (isCooldown ? 'cooldown' : 'main');
              }
            }
          }
        }
      }

      // Fix cardio exercises that incorrectly use sets_reps_weight
      const fixedParsedPlan = fixCardioTemplates(parsedPlan);

      return fixedParsedPlan;
    } catch (error: any) {
      loggers.ai.error("Gemini API error:", error);
      throw new Error(`Failed to parse workout plan: ${error.message}`);
    }
  },
});

/**
 * Generate a personalized workout plan using Gemini 2.5 Pro
 * Server-side action to keep API key secure
 *
 * This is the main plan generation function with comprehensive prompting
 */
export const generateWorkoutPlan = action({
  args: {
    userId: v.optional(v.string()),
    preferences: v.object({
      primary_goal: v.string(),
      experience_level: v.string(),
      training_frequency: v.string(),
      pain_points: v.array(v.string()),
      sport: v.optional(v.string()),
      additional_notes: v.optional(v.string()),
      equipment: v.optional(v.string()),
      preferred_session_length: v.optional(v.string()),
      sex: v.optional(v.string()),
      age: v.optional(v.number()),
      // Current strength levels for starting weight calculations
      current_strength: v.optional(v.object({
        squat_kg: v.optional(v.number()),
        bench_kg: v.optional(v.number()),
        deadlift_kg: v.optional(v.number()),
        row_kg: v.optional(v.number()),
        pullup_count: v.optional(v.number()),
      })),
      // NEW: Training split for 2x daily training
      training_split: v.optional(v.object({
        sessions_per_day: v.union(v.literal('1'), v.literal('2')),
        training_type: v.union(
          v.literal('strength_only'),
          v.literal('strength_plus_cardio'),
          v.literal('combined'),
          v.literal('cardio_focused')
        ),
        // Cardio preferences for training types with cardio
        cardio_preferences: v.optional(v.object({
          preferred_types: v.array(v.string()),
          favorite_exercise: v.optional(v.string()),
          cardio_duration_minutes: v.optional(v.number()),
          outdoor_preferred: v.optional(v.boolean()),
        })),
      })),
      // NEW: Specific goal with target date (periodization)
      specific_goal: v.optional(v.object({
        event_type: v.optional(v.union(v.string(), v.null())),
        event_name: v.optional(v.union(v.string(), v.null())),
        target_date: v.optional(v.union(v.string(), v.null())),
        current_readiness: v.optional(v.union(v.number(), v.null())),
        description: v.optional(v.union(v.string(), v.null())),
      })),
      // PERFORMANCE OPTIMIZATION FLAGS
      _useCompressedPrompt: v.optional(v.boolean()), // 60% token reduction
      _generateDayOneOnly: v.optional(v.boolean()), // Progressive generation step 1
      _day1Context: v.optional(v.any()), // Progressive generation step 2
      _forceProModel: v.optional(v.boolean()), // Force Pro model (quality mode)
      _useFlashModel: v.optional(v.boolean()), // Force Flash model (fast mode)
    }),
    // Optional supplement stack for personalized recommendations
    supplements: v.optional(v.array(v.object({
      name: v.string(),
      timing: v.string(),
      dosage: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in Convex environment variables.");
    }

    // Rate limiting - prevent abuse of expensive AI calls
    if (args.userId) {
      const { checkRateLimit } = await import("./rateLimiter");
      checkRateLimit(args.userId, "generateWorkoutPlan");
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const {
      primary_goal,
      experience_level,
      training_frequency,
      pain_points,
      sport,
      additional_notes,
      equipment,
      preferred_session_length,
      sex,
      age: rawAge,
      current_strength: rawStrength,
      training_split,
      specific_goal: rawSpecificGoal,
      _useCompressedPrompt,
      _generateDayOneOnly,
      _day1Context,
      _forceProModel,
      _useFlashModel,
    } = args.preferences;

    // ═══════════════════════════════════════════════════════════
    // INPUT VALIDATION: Sanitize extreme values to prevent AI issues
    // ═══════════════════════════════════════════════════════════

    // Age: Validate between 13-100 (reasonable training age range)
    const age = rawAge !== undefined ? Math.max(13, Math.min(100, rawAge)) : undefined;
    if (rawAge !== undefined && rawAge !== age) {
      loggers.ai.warn(`[Input Validation] Age ${rawAge} clamped to ${age}`);
    }

    // Session length: Validate between 15-180 minutes
    const sessionLengthNum = preferred_session_length ? parseInt(preferred_session_length) : 60;
    const validatedSessionLength = Math.max(15, Math.min(180, isNaN(sessionLengthNum) ? 60 : sessionLengthNum));
    if (sessionLengthNum !== validatedSessionLength) {
      loggers.ai.warn(`[Input Validation] Session length ${sessionLengthNum} clamped to ${validatedSessionLength}`);
    }

    // Cardio duration: Validate between 5-180 minutes (if present)
    const cardioPrefs = training_split?.cardio_preferences;
    const rawCardioDuration = cardioPrefs?.cardio_duration_minutes;
    const validatedCardioDuration = rawCardioDuration !== undefined
      ? Math.max(5, Math.min(180, rawCardioDuration))
      : undefined;
    if (rawCardioDuration !== undefined && rawCardioDuration !== validatedCardioDuration) {
      loggers.ai.warn(`[Input Validation] Cardio duration ${rawCardioDuration} clamped to ${validatedCardioDuration}`);
    }

    // Readiness: Validate between 1-10
    const rawReadiness = rawSpecificGoal?.current_readiness;
    const validatedReadiness = rawReadiness !== undefined && rawReadiness !== null
      ? Math.max(1, Math.min(10, rawReadiness))
      : rawReadiness;

    // Strength values: Validate between 0-500kg (reasonable max for elite lifters)
    const current_strength = rawStrength ? {
      squat_kg: rawStrength.squat_kg !== undefined ? Math.max(0, Math.min(500, rawStrength.squat_kg)) : undefined,
      bench_kg: rawStrength.bench_kg !== undefined ? Math.max(0, Math.min(500, rawStrength.bench_kg)) : undefined,
      deadlift_kg: rawStrength.deadlift_kg !== undefined ? Math.max(0, Math.min(500, rawStrength.deadlift_kg)) : undefined,
      row_kg: rawStrength.row_kg !== undefined ? Math.max(0, Math.min(500, rawStrength.row_kg)) : undefined,
      pullup_count: rawStrength.pullup_count !== undefined ? Math.max(0, Math.min(100, rawStrength.pullup_count)) : undefined,
    } : undefined;

    // Rebuild specific_goal with validated readiness
    const specific_goal = rawSpecificGoal ? {
      ...rawSpecificGoal,
      current_readiness: validatedReadiness,
    } : undefined;

    // Rebuild training_split with validated cardio duration
    const validatedTrainingSplit = training_split && cardioPrefs ? {
      ...training_split,
      cardio_preferences: {
        ...cardioPrefs,
        cardio_duration_minutes: validatedCardioDuration,
      },
    } : training_split;

    // ═══════════════════════════════════════════════════════════
    // PERFORMANCE OPTIMIZATION: Smart Model Selection
    // Upgraded to Gemini 3 Pro Preview for faster generation (Dec 2025)
    // ═══════════════════════════════════════════════════════════
    let selectedModel = 'gemini-3-pro-preview'; // Default to Gemini 3 Pro

    // Force model if specified
    if (_forceProModel) {
      selectedModel = 'gemini-3-pro-preview';
      loggers.ai.info("🎯 Model: Gemini 3 Pro (forced - quality mode)");
    } else if (_useFlashModel) {
      selectedModel = 'gemini-2.5-flash';
      loggers.ai.info("⚡ Model: 2.5 Flash (forced - fast mode)");
    } else {
      // Default to Gemini 3 Pro Preview - latest model with best quality
      selectedModel = 'gemini-3-pro-preview';
      loggers.ai.info("🎯 Model: Gemini 3 Pro (default - latest model)");
    }

    // Get sport-specific training context
    const sportContext = formatSportPrompt(sport);

    // Get supplement-based programming adjustments
    const supplementContext = formatSupplementPrompt(args.supplements);

    // Build training split prompt for 2x daily training (pass primary_goal for cardio duration calculation)
    // Use validatedTrainingSplit which has sanitized cardio duration
    const trainingSplitPrompt = formatTrainingSplitPrompt(validatedTrainingSplit, primary_goal);

    // Build periodization prompt if user has a target date
    const periodizationPrompt = formatPeriodizationPrompt(specific_goal);

    // ═══════════════════════════════════════════════════════════
    // INTELLIGENT CONTEXT: Deep sport and readiness understanding
    // ═══════════════════════════════════════════════════════════
    const eventTypeContext = getSportSpecificContext(specific_goal?.event_type || sport);
    const readinessContext = getReadinessContext(specific_goal?.current_readiness);
    const goalContext = getGoalEmphasis(primary_goal);

    // ═══════════════════════════════════════════════════════════
    // INTELLIGENT PROGRESSION: Fetch workout history for context
    // ═══════════════════════════════════════════════════════════
    let workoutHistoryPrompt = '';
    if (args.userId) {
      try {
        const progressionSummary = await ctx.runQuery(api.queries.getWorkoutProgressionSummary, {
          userId: args.userId,
          weeksToAnalyze: 4,
        });

        if (progressionSummary.hasData) {
          const strengthData = progressionSummary.strongestLifts
            .map(l => `${l.exerciseName}: ${l.maxWeight}kg × ${l.maxReps}`)
            .join(', ');

          const progressData = progressionSummary.exerciseProgress
            .filter(e => e.trend === 'increasing')
            .slice(0, 5)
            .map(e => `${e.exerciseName} (+${e.weightChange}kg)`)
            .join(', ');

          workoutHistoryPrompt = `
**WORKOUT HISTORY (Past 4 Weeks) - USE THIS FOR INTELLIGENT PROGRAMMING:**
${progressionSummary.summary}

${strengthData ? `**Current Strength Levels:** ${strengthData}` : ''}
${progressData ? `**Exercises Showing Progress:** ${progressData}` : ''}

**PROGRESSION GUIDANCE:**
- For exercises the user has done before, set target weights SLIGHTLY ABOVE their current max (2-5% increase)
- For new exercises, use conservative starting weights based on their demonstrated strength
- User's workout frequency: ${progressionSummary.avgWorkoutsPerWeek} sessions/week
- Total workouts analyzed: ${progressionSummary.totalWorkouts}

Example: If user benched 80kg last week, suggest 82.5kg this week with same reps.
`;
          loggers.ai.info(`📊 Workout history loaded: ${progressionSummary.totalWorkouts} workouts, ${progressionSummary.exerciseProgress.length} exercises tracked`);
        }
      } catch (error) {
        loggers.ai.warn('Could not fetch workout history for progression:', error);
      }
    }

    // Get session length guidance from unified schema
    const sessionLengthPrompt = preferred_session_length
      ? getSessionLengthGuidance(preferred_session_length as SessionLength)
      : '';

    // Get duration constraint and heart rate guidance
    const durationConstraintPrompt = preferred_session_length
      ? getDurationConstraintPrompt(parseInt(preferred_session_length) || 60)
      : '';

    const heartRateGuidancePrompt = getHeartRateGuidance();

    // Get exercise selection hierarchy based on sport and goal
    const exerciseHierarchyPrompt = getExerciseSelectionHierarchyPrompt(sport, primary_goal);

    // Determine if this is a 2x/day plan
    const hasTwoADay = training_split?.sessions_per_day === '2';
    const hasTargetDate = specific_goal?.target_date != null;

    // ═══════════════════════════════════════════════════════════
    // EVIDENCE-BASED MASTER PROMPT (from promptBuilder)
    // Uses scientific data from NSCA, ACSM, Renaissance Periodization
    // ═══════════════════════════════════════════════════════════
    let masterPromptSection = '';
    try {
      // Parse training frequency to a number
      const freqMap: Record<string, number> = { '2-3': 3, '3-4': 4, '4-5': 5, '5+': 6 };
      const trainingFreqNum = freqMap[training_frequency] || 4;

      const promptInputs: PromptInputs = {
        profile: {
          age: age,
          sex: sex as 'male' | 'female' | 'other' | undefined,
          experience_level: experience_level.toLowerCase() as 'beginner' | 'intermediate' | 'advanced',
          training_frequency: trainingFreqNum,
          session_length: parseInt(preferred_session_length || '60'),
        },
        strength: current_strength || {},
        goal: {
          primary_goal,
          sport: sport,
          target_date: specific_goal?.target_date || undefined,
          event_name: specific_goal?.event_name || undefined,
          additional_notes: additional_notes,
        },
        constraints: {
          pain_points: pain_points,
          equipment: equipment,
          cardio_types: training_split?.cardio_preferences?.preferred_types,
          cardio_duration_minutes: training_split?.cardio_preferences?.cardio_duration_minutes,
        },
        split: {
          sessions_per_day: training_split?.sessions_per_day === '2' ? 2 : 1,
          training_type: training_split?.training_type,
        },
      };

      masterPromptSection = buildBriefMasterPrompt(promptInputs);
      // Log the first 500 chars of the master prompt for debugging
      loggers.ai.info('📚 Evidence-based master prompt generated successfully');
      loggers.ai.debug('Master prompt preview:', masterPromptSection.substring(0, 500));
    } catch (e) {
      loggers.ai.warn('Failed to generate master prompt, using legacy prompt:', e);
    }

    // Get comprehensive metrics template reference (CRITICAL for correct formatting)
    const metricsTemplatePrompt = getMetricsTemplatePrompt();
    const terminologyPrompt = getTerminologyPrompt();
    const examplePlansPrompt = getExamplePlansPrompt();

    // Comprehensive system prompt for high-quality plan generation
    const systemPrompt = `You are an elite, evidence-based personal trainer for the REBLD fitness app. Create a world-class, personalized 7-day workout plan.

**User Profile:**
- Primary Goal: ${primary_goal}
- Experience Level: ${experience_level}
- Training Frequency: ${training_frequency} days per week
- Pain Points: ${pain_points.join(', ') || 'None reported'}
- Sport: ${sport || 'General Fitness'}
- Equipment: ${equipment || 'Full gym access'}
- Sex: ${sex || 'Not specified'}
- Additional Notes: ${additional_notes || 'None'}
${training_split?.sessions_per_day === '2' ? `- Training Split: 2x DAILY (${training_split.training_type})` : ''}
${specific_goal?.target_date ? `- Target Event Date: ${specific_goal.target_date}` : ''}
${specific_goal?.event_type ? `- Event Type: ${specific_goal.event_type}` : ''}

${eventTypeContext ? `
**═══════════════════════════════════════════════════════════════**
**SPORT/EVENT-SPECIFIC INTELLIGENCE**
**═══════════════════════════════════════════════════════════════**

${eventTypeContext}
` : ''}

${readinessContext ? `
**═══════════════════════════════════════════════════════════════**
**READINESS-BASED ADJUSTMENTS**
**═══════════════════════════════════════════════════════════════**

${readinessContext}
` : ''}

${goalContext ? `
${goalContext}
` : ''}

**═══════════════════════════════════════════════════════════════**
**ABSOLUTE CONSTRAINTS (NON-NEGOTIABLE - MUST BE FOLLOWED EXACTLY)**
**═══════════════════════════════════════════════════════════════**

1. **SESSION LENGTH: EXACTLY ${preferred_session_length || '60'} MINUTES (±5 min)**
   - This is the user's requested workout duration
   - EVERY strength session MUST be ${preferred_session_length || '60'} minutes (not 40, not 50, EXACTLY ${preferred_session_length || '60'})

   **HOW TO CALCULATE ${preferred_session_length || '60'}-MINUTE SESSION:**
   - Warmup: 5-7 exercises × 1.5 min = 8-10 min
   - Main strength: ${Math.floor((parseInt(preferred_session_length || '60') - 18) / 7)} exercises × 7 min each = ${Math.floor((parseInt(preferred_session_length || '60') - 18) / 7) * 7} min
     (Each strength exercise: 3-4 sets × [30s work + 90s rest] = ~7 min)
   - Cooldown: 3-4 stretches × 1.5 min = 5-6 min
   - TOTAL: ~${preferred_session_length || '60'} minutes

   **REQUIRED EXERCISE COUNTS FOR ${preferred_session_length || '60'} MIN:**
   - Warmup: ${preferred_session_length === '90' || parseInt(preferred_session_length || '60') >= 90 ? '7-8' : '5-7'} exercises
   - Main: ${Math.max(4, Math.floor((parseInt(preferred_session_length || '60') - 18) / 7))}-${Math.max(5, Math.ceil((parseInt(preferred_session_length || '60') - 12) / 6))} exercises
   - Cooldown: ${preferred_session_length === '90' || parseInt(preferred_session_length || '60') >= 90 ? '4-5' : '3-4'} stretches

   - VIOLATION OF THIS RULE = REJECTED PLAN

${training_split?.cardio_preferences?.preferred_types && training_split.cardio_preferences.preferred_types.length > 0 ? `
2. **CARDIO EXERCISES: ONLY USE THESE**
   - User's selected cardio: ${training_split.cardio_preferences.preferred_types.join(', ').toUpperCase()}
   - DO NOT add running if user didn't select running
   - DO NOT add cycling if user didn't select cycling
   - ONLY USE: ${training_split.cardio_preferences.preferred_types.join(', ')}
   - This is NOT a suggestion - these are the ONLY cardio exercises allowed
` : ''}

${training_split?.cardio_preferences?.cardio_duration_minutes ? `
3. **CARDIO DURATION: EXACTLY ${training_split.cardio_preferences.cardio_duration_minutes} MINUTES**
   - Every cardio session = ${training_split.cardio_preferences.cardio_duration_minutes} minutes
   - NOT ${training_split.cardio_preferences.cardio_duration_minutes - 10}, NOT ${training_split.cardio_preferences.cardio_duration_minutes + 10}
   - EXACTLY ${training_split.cardio_preferences.cardio_duration_minutes} minutes
` : ''}

**END OF ABSOLUTE CONSTRAINTS**
**═══════════════════════════════════════════════════════════════**

${sportContext}
${supplementContext}
${sessionLengthPrompt}
${durationConstraintPrompt}
${heartRateGuidancePrompt}
${trainingSplitPrompt}
${periodizationPrompt}
${exerciseHierarchyPrompt}
${workoutHistoryPrompt}
${CARDIO_PARSING_RULES}

${masterPromptSection}

${metricsTemplatePrompt}

${terminologyPrompt}

${examplePlansPrompt}

**CRITICAL REQUIREMENTS:**

1. **Block-Based Structure**: Use workout blocks (single, superset, amrap)

2. **Warmup Mandate**: Each training day MUST start with 5-7 SPECIFIC warmup exercises:
   - Use the mobility work listed above for the sport
   - Include dynamic stretches (Cat-Cow, Hip Circles, Arm Circles)
   - Include activation exercises (Band Pull-Aparts, Glute Bridges)
   - NEVER use generic names like "General Warmup"

3. **Main Workout**: Evidence-based exercise selection
   - PRIORITIZE the S-Tier exercises listed above for this sport
   - Match training frequency (create rest days as needed)
   - Avoid exercises that aggravate pain points
   - Include RPE targets and rest periods
   - Follow the conditioning protocols specified above

4. **Cooldown**: 2-4 specific stretching exercises relevant to the sport

5. **Pain Point Protocol**:
   - Knee pain → AVOID: deep squats, lunges, jump exercises
   - Lower back pain → AVOID: deadlifts, bent rows, good mornings
   - Shoulder pain → AVOID: overhead press, dips, upright rows
   - ALSO avoid any exercises listed in the "AVOID" section above

6. **Core Training**: Include the core exercises listed above as essential for this sport

**OUTPUT FORMAT (JSON only):**
{
  "name": "Personalized Training Plan",
  "weeklyPlan": [
    {
      "day_of_week": 1,
      "focus": "Upper Body Strength",
      "blocks": [
        {
          "type": "single",
          "exercises": [
            {
              "exercise_name": "Cat-Cow Stretch",
              "category": "warmup",
              "metrics_template": {
                "type": "sets_reps_weight",
                "target_sets": 2,
                "target_reps": "10"
              }
            }
          ]
        },
        {
          "type": "single",
          "exercises": [
            {
              "exercise_name": "Bench Press",
              "category": "main",
              "rpe": "7-8",
              "metrics_template": {
                "type": "sets_reps_weight",
                "target_sets": 4,
                "target_reps": "8-10",
                "rest_period_s": 90
              }
            }
          ]
        }
      ]
    }
  ]
}

**CRITICAL**: EVERY exercise MUST have a "category" field with one of: "warmup", "main", or "cooldown". This is REQUIRED - exercises without category will fail validation.

Generate a complete 7-day plan. Return ONLY valid JSON.`;

    // ═══════════════════════════════════════════════════════════
    // PERFORMANCE OPTIMIZATION: Prompt Compression (60% reduction)
    // ═══════════════════════════════════════════════════════════
    let finalPrompt = systemPrompt;

    if (_useCompressedPrompt) {
      // Compressed version (60% smaller, 40-50% faster)
      finalPrompt = `Create 7-day plan.
USER: goal=${primary_goal}, exp=${experience_level}, freq=${training_frequency}, sex=${sex || 'unspecified'}
${pain_points && pain_points.length > 0 ? `injuries=${pain_points.join(',')}` : ''}
${equipment ? `equip=${equipment}` : ''}
${sport ? `sport=${sport}` : ''}

RULES:
- 7 days (Mon-Sun), rest days have empty blocks
- Blocks: {type:"single"|"superset"|"amrap", exercises:[...]}
- Exercise: {exercise_name, metrics_template:{type,sets,reps,weight_kg}, category:"warmup"|"main"|"cooldown"}
- Warmup → Main → Cooldown order
- ${primary_goal === 'strength' ? 'Focus: compounds, 3-5 reps, 85-95% 1RM' : ''}
- ${primary_goal === 'aesthetic' ? 'Focus: volume, 6-12 reps, 65-85% 1RM' : ''}
- ${primary_goal === 'athletic' ? 'Focus: power + strength, explosive work first' : ''}
- ${pain_points && pain_points.length > 0 ? `AVOID: ${pain_points.join(', ')}` : ''}

Return valid JSON WorkoutPlan.`;

      loggers.ai.info("📝 Using compressed prompt (60% token reduction)");
    }

    // ═══════════════════════════════════════════════════════════
    // PERFORMANCE OPTIMIZATION: Progressive Generation (Day 1 only)
    // ═══════════════════════════════════════════════════════════
    if (_generateDayOneOnly) {
      const dayOneFocus = primary_goal === 'strength' ? 'Lower Body Power (Squat focus)' :
                         primary_goal === 'aesthetic' ? 'Chest & Triceps' :
                         primary_goal === 'athletic' ? 'Power Development' :
                         'Full Body';

      finalPrompt = `Generate DAY 1 ONLY of a workout plan.

USER: goal=${primary_goal}, exp=${experience_level}, sex=${sex || 'unspecified'}
${pain_points && pain_points.length > 0 ? `injuries=${pain_points.join(',')}` : ''}

DAY 1: ${dayOneFocus}

Include: Warmup (5-7 exercises) → Main Work (4-6 exercises) → Cooldown (2-3 stretches)

Return JSON:
{
  "name": "Day 1 Preview",
  "weeklyPlan": [{
    "day_of_week": 1,
    "focus": "${dayOneFocus}",
    "blocks": [...]
  }]
}`;

      loggers.ai.info("🚀 Generating Day 1 only (progressive mode - 2 seconds)");
    }

    // ═══════════════════════════════════════════════════════════
    // PERFORMANCE OPTIMIZATION: Remaining days with Day 1 context
    // ═══════════════════════════════════════════════════════════
    if (_day1Context) {
      finalPrompt = `Complete the 7-day plan. Day 1 provided below.

DAY 1: ${JSON.stringify(_day1Context)}

USER: goal=${primary_goal}, exp=${experience_level}
${pain_points && pain_points.length > 0 ? `injuries=${pain_points.join(',')}` : ''}

Generate Days 2-7 with balanced progression that complements Day 1.

Return JSON:
{
  "name": "Complete Plan",
  "weeklyPlan": [day1_from_above, day2, day3, day4, day5, day6, day7]
}`;

      loggers.ai.info("🚀 Generating remaining 6 days (progressive mode step 2)");
    }

    try {
      loggers.ai.info(`Generating plan with ${selectedModel} (with retry logic)...`);
      const startTime = Date.now();

      // Use generateWithRetry for robust generation with automatic validation
      const generatedPlan = await generateWithRetry(
        ai.models,
        {
          model: selectedModel,
          contents: finalPrompt,
          config: {
            responseMimeType: "application/json",
            // Gemini 3 Pro benefits from a healthy thinking budget for complex planning
            thinkingConfig: selectedModel === 'gemini-3-pro-preview' ? { thinkingBudget: 8192 } : undefined
          }
        },
        validateWorkoutPlan,
        2, // Reduced from 3 to 2 - 3rd attempt rarely succeeds
        parseInt(preferred_session_length || '60') // Pass session duration for cardio fixing
      );

      const elapsedMs = Date.now() - startTime;
      loggers.ai.info(`⏱️  Generation completed in ${(elapsedMs / 1000).toFixed(2)}s`);
      loggers.ai.info('✅ Plan validation passed! All metrics templates are correct.');

      // Validate plan has required structure
      if (!generatedPlan.weeklyPlan || generatedPlan.weeklyPlan.length === 0) {
        throw new Error('Generated plan has no weekly schedule');
      }

      // Post-process: Ensure every exercise has a category (fallback for AI inconsistency)
      for (const day of generatedPlan.weeklyPlan) {
        if (!day.blocks) continue;

        for (let blockIndex = 0; blockIndex < day.blocks.length; blockIndex++) {
          const block = day.blocks[blockIndex];
          if (!block.exercises) continue;

          for (const exercise of block.exercises) {
            if (!exercise.category) {
              // Infer category based on position and exercise name
              const exerciseName = exercise.exercise_name?.toLowerCase() || '';
              const isWarmup = exerciseName.includes('stretch') ||
                              exerciseName.includes('warmup') ||
                              exerciseName.includes('mobility') ||
                              exerciseName.includes('activation') ||
                              exerciseName.includes('cat-cow') ||
                              exerciseName.includes('foam roll') ||
                              exerciseName.includes('band pull') ||
                              exerciseName.includes('circle') ||
                              blockIndex === 0;

              const isCooldown = exerciseName.includes('cooldown') ||
                                exerciseName.includes('static stretch') ||
                                blockIndex === day.blocks.length - 1;

              exercise.category = isWarmup ? 'warmup' : (isCooldown ? 'cooldown' : 'main');
              loggers.ai.debug(`Auto-assigned category "${exercise.category}" to "${exercise.exercise_name}"`);
            }
          }
        }
      }

      // Post-process: Fix cardio exercises that incorrectly use sets_reps_weight
      // AI sometimes generates "3 sets of 10" for cardio instead of duration_only
      const requestedDuration = parseInt(preferred_session_length || '60');
      const cardioDuration = training_split?.cardio_preferences?.cardio_duration_minutes;
      const fixedPlan = fixCardioTemplates(generatedPlan, cardioDuration || requestedDuration);

      // Post-process: Add duration estimates to all days/sessions AFTER fixing cardio
      addDurationEstimates(fixedPlan);

      // Log duration mismatch warnings
      for (const day of fixedPlan.weeklyPlan) {
        const isRestDay = day.focus?.toLowerCase().includes('rest') ||
                          day.focus?.toLowerCase().includes('recovery');
        if (isRestDay) continue;

        const estimatedDuration = day.estimated_duration || 0;
        const tolerance = requestedDuration * 0.25; // 25% tolerance

        if (estimatedDuration > 0 && Math.abs(estimatedDuration - requestedDuration) > tolerance) {
          loggers.ai.warn(
            `⚠️ Duration mismatch: ${day.focus} estimated at ${estimatedDuration} min ` +
            `(requested: ${requestedDuration} min, diff: ${estimatedDuration - requestedDuration} min)`
          );
        }
      }

      loggers.ai.info('Plan generated successfully with', fixedPlan.weeklyPlan.length, 'days');
      return fixedPlan;
    } catch (error: any) {
      loggers.ai.error("Gemini API error:", error);

      // Provide helpful error messages
      if (error.message?.includes('API_KEY')) {
        throw new Error('AI service configuration error. Please contact support.');
      }
      if (error.message?.includes('timeout') || error.message?.includes('deadline')) {
        throw new Error('AI service is busy. Please try again in a moment.');
      }

      throw new Error(`Failed to generate workout plan: ${error.message}`);
    }
  },
});

/**
 * Explain an exercise with form cues and tips
 * Server-side action to keep API key secure
 */
export const explainExercise = action({
  args: {
    exerciseName: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // First check if exercise explanation exists in cache
    const cached = await ctx.runQuery(api.queries.getExerciseFromCache, {
      exerciseName: args.exerciseName
    });

    if (cached) {
      return {
        explanation: cached.explanation,
        muscles_worked: cached.muscles_worked,
        form_cue: cached.form_cue,
        common_mistake: cached.common_mistake,
        step_by_step: cached.step_by_step || [],
        cached: true
      };
    }

    // Rate limiting (only for non-cached requests)
    const { checkRateLimit } = await import("./rateLimiter");
    checkRateLimit(args.userId, "explainExercise");

    // Not in cache, generate explanation
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Exercise: "${args.exerciseName}"

Be ULTRA CONCISE. Max 15 words per field. No fluff.

JSON format:
{
  "explanation": "One punchy sentence - what it does",
  "muscles_worked": ["Muscle1", "Muscle2"],
  "form_cue": "Key cue in 5-8 words",
  "common_mistake": "Mistake in 5-8 words",
  "step_by_step": ["Setup", "Execute", "Return"]
}

RULES:
- explanation: 1 sentence, max 15 words
- form_cue: Action words, not explanation
- common_mistake: What NOT to do
- step_by_step: 3-4 steps, max 6 words each

Return ONLY valid JSON.`;

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      const responseText = result.text || '';

      // Extract JSON
      let jsonString = responseText;
      if (responseText.includes('```json')) {
        const match = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (match) jsonString = match[1];
      } else if (responseText.includes('```')) {
        const match = responseText.match(/```\n([\s\S]*?)\n```/);
        if (match) jsonString = match[1];
      }

      const exerciseData = JSON.parse(jsonString);

      // Save to cache
      await ctx.runMutation(api.mutations.cacheExerciseExplanation, {
        exerciseName: args.exerciseName,
        explanation: exerciseData.explanation || '',
        muscles_worked: exerciseData.muscles_worked || [],
        form_cue: exerciseData.form_cue || null,
        common_mistake: exerciseData.common_mistake || null,
        step_by_step: exerciseData.step_by_step || [],
        source: "gemini_api"
      });

      return {
        ...exerciseData,
        cached: false
      };
    } catch (error: any) {
      loggers.ai.error("Gemini API error:", error);
      throw new Error(`Failed to explain exercise: ${error.message}`);
    }
  },
});

/**
 * Chatbot action - handles user messages with function calling for workout plan modifications
 * Supports: substitute exercise, add exercise, modify, remove, adjust difficulty, extend/shorten workout
 */
export const handleChatMessage = action({
  args: {
    message: v.string(),
    planId: v.string(),
    dayOfWeek: v.number(),
    conversationHistory: v.optional(v.array(v.object({
      role: v.union(v.literal("user"), v.literal("model")),
      content: v.string(),
    }))),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    // Get the workout plan
    const plan = await ctx.runQuery(api.queries.getWorkoutPlan, { planId: args.planId });
    if (!plan) {
      throw new Error("Workout plan not found");
    }

    // Rate limiting based on plan's userId
    if (plan.userId) {
      const { checkRateLimit } = await import("./rateLimiter");
      checkRateLimit(plan.userId, "handleChatMessage");
    }

    const { GoogleGenAI, Type } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    // Define function declarations for plan modifications
    const functions = [
      {
        name: "substituteExercise",
        description: "Replace an exercise in a specific day with a new exercise and metrics.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            day_of_week: { type: Type.NUMBER, description: "Target day: 1=Mon ... 7=Sun" },
            original_exercise_name: { type: Type.STRING, description: "Exact name of the exercise to replace" },
            new_exercise_name: { type: Type.STRING, description: "Name of the new exercise" },
            new_sets: { type: Type.NUMBER, description: "Number of sets" },
            new_reps: { type: Type.STRING, description: "Rep range (e.g., '8-10' or '12')" },
            new_rest_period_s: { type: Type.NUMBER, description: "Rest period in seconds" },
          },
          required: ["day_of_week", "original_exercise_name", "new_exercise_name", "new_sets", "new_reps"],
        },
      },
      {
        name: "modifyExercise",
        description: "Modify sets, reps, rest, or RPE of an existing exercise without replacing it.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            day_of_week: { type: Type.NUMBER },
            exercise_name: { type: Type.STRING },
            new_sets: { type: Type.NUMBER },
            new_reps: { type: Type.STRING },
            new_rest_period_s: { type: Type.NUMBER },
          },
          required: ["day_of_week", "exercise_name"],
        },
      },
      {
        name: "addExercise",
        description: "Add a new exercise to a specific day.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            day_of_week: { type: Type.NUMBER },
            exercise_name: { type: Type.STRING },
            category: { type: Type.STRING, description: "warmup | main | cooldown" },
            sets: { type: Type.NUMBER },
            reps: { type: Type.STRING },
            rest_period_s: { type: Type.NUMBER },
          },
          required: ["day_of_week", "exercise_name", "category", "sets", "reps"],
        },
      },
    ];

    // Build system instruction with plan context
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const currentDay = args.dayOfWeek;
    const todayPlan = plan.weeklyPlan?.find((d: any) => d.day_of_week === currentDay);

    const languageInstruction = args.language === 'de'
      ? 'IMPORTANT: Respond in German (Deutsch). All your responses must be in German.'
      : 'Respond in English.';

    const systemInstruction = `You are REBLD's AI workout coach. Help users with their workout plans.

${languageInstruction}

TODAY: ${dayNames[currentDay - 1]}
PLAN: ${plan.name}
TODAY'S WORKOUT: ${todayPlan?.focus || 'Rest day'}

CAPABILITIES:
- substituteExercise: Swap one exercise for another
- modifyExercise: Change sets/reps/rest without swapping
- addExercise: Add new exercise to the plan

RULES:
1. ONLY answer workout/fitness questions
2. Be concise (2-3 sentences max)
3. When modifying the plan, call the appropriate function
4. Refuse off-topic questions politely

CONTEXT:
Plan has weeklyPlan[] with days (day_of_week 1-7), focus, and blocks.
Blocks have type (single|superset|amrap) and exercises[] with exercise_name, metrics_template, rpe.`;

    // Build conversation history for context
    const historyText = (args.conversationHistory || [])
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const prompt = `${systemInstruction}

CONVERSATION HISTORY:
${historyText || 'No previous messages.'}

USER MESSAGE: ${args.message}

Respond conversationally. If the user asks to modify their plan, respond with a JSON object in this format:
{"action": "substituteExercise"|"modifyExercise"|"addExercise", "params": {...}}
Otherwise, respond with plain text.`;

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
        config: {
          tools: [{ functionDeclarations: functions }],
        },
      });

      const responseText = result.text || '';

      // Check if response contains a function call JSON
      const functionMatch = responseText.match(/\{"action"\s*:\s*"(\w+)",\s*"params"\s*:\s*(\{[^}]+\})\}/);
      if (functionMatch) {
        const actionMap: Record<string, string> = {
          'substituteExercise': 'substituteExercise',
          'modifyExercise': 'modifyExercise',
          'addExercise': 'addExercise',
        };
        try {
          const params = JSON.parse(functionMatch[2]);
          return {
            type: "function_call",
            functionName: actionMap[functionMatch[1]] || functionMatch[1],
            functionArgs: params,
            textResponse: null,
          };
        } catch {
          // Fall through to text response
        }
      }

      // Regular text response
      return {
        type: "text",
        textResponse: responseText,
        functionCall: null,
      };
    } catch (error: any) {
      loggers.ai.error("Chat error:", error);
      throw new Error(`Chat failed: ${error.message}`);
    }
  },
});

/**
 * analyzeBodyPhoto - Secure server-side body composition analysis
 *
 * Uses Gemini Vision API to analyze body photos for:
 * - Body fat percentage estimation
 * - Muscle definition assessment
 * - Progress comparison with previous photos
 * - Body composition insights
 *
 * SECURITY: API key stays server-side, never exposed to client
 */
export const analyzeBodyPhoto = action({
  args: {
    imageBase64: v.string(), // Base64 encoded image
    previousPhotoBase64: v.optional(v.string()), // Optional comparison photo
    userGoal: v.optional(v.string()), // User's fitness goal for context
    language: v.optional(v.string()),
    userId: v.optional(v.string()), // For rate limiting
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    // Rate limiting - expensive vision API
    if (args.userId) {
      const { checkRateLimit } = await import("./rateLimiter");
      checkRateLimit(args.userId, "analyzeBodyPhoto");
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `You are a fitness coach providing fun, simple body composition estimates.
Analyze the photo and provide:

1. **Body Fat Percentage Estimate**: A rough visual estimate range (e.g., "15-18%")
2. **Body Composition**: Brief assessment of overall build (lean, athletic, muscular, etc.)
3. **Progress Notes**: If a previous photo is provided, note any visible changes
4. **Encouragement**: A brief motivational note

Keep it fun and simple - this is a gimmick feature, not a medical assessment.
Be encouraging and positive. Avoid medical language.
Respond in ${args.language || "English"}.`;

      // Build prompt parts with images
      const promptParts: any[] = [
        { text: `${systemInstruction}\n\nUser's fitness goal: ${args.userGoal || "General fitness"}\n\nCurrent Photo:` },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: args.imageBase64,
          },
        },
      ];

      // Add comparison photo if provided
      if (args.previousPhotoBase64) {
        promptParts.push(
          { text: "\n\nPrevious Photo (for comparison):" },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: args.previousPhotoBase64,
            },
          }
        );
      }

      promptParts.push({
        text: "\n\nProvide a detailed body composition analysis with the 5 sections mentioned above.",
      });

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Fast model for simple body composition
        contents: [{ parts: promptParts }],
        config: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      });

      const analysis = result.text || '';

      loggers.ai.info("Body photo analysis completed");

      return {
        analysis,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      loggers.ai.error("Body photo analysis error:", error);
      throw new Error(`Photo analysis failed: ${error.message}`);
    }
  },
});

/**
 * analyzePairedBodyPhotos - Analyze front + back photos together
 * Provides more comprehensive body composition analysis
 */
export const analyzePairedBodyPhotos = action({
  args: {
    frontImageBase64: v.string(),
    backImageBase64: v.string(),
    previousFrontBase64: v.optional(v.string()),
    previousBackBase64: v.optional(v.string()),
    userGoal: v.optional(v.string()),
    language: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    // Rate limiting
    const { checkRateLimit } = await import("./rateLimiter");
    checkRateLimit(args.userId, "analyzeBodyPhoto");

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `You are a fitness coach providing fun, simple body composition estimates for the REBLD app.

Analyze these progress photos (FRONT + BACK views) and provide encouraging feedback.

KEEP IT SIMPLE:
1. Body Fat Estimate: A rough visual estimate (5-35% range)
2. Body Composition: Brief note on overall build
3. Improvements: 2-3 positive observations
4. Suggestions: 2-3 simple tips
5. Confidence: How confident you are (0-100) based on photo quality

TONE: Fun, encouraging, simple. This is a gimmick feature, not medical advice.
AVOID: Over-analysis, medical language, body shaming

Return ONLY valid JSON:
{
  "bodyFatEstimate": <number 5-35>,
  "muscleChanges": "<brief string>",
  "improvements": ["<string>", "<string>"],
  "suggestions": ["<string>", "<string>"],
  "confidence": <number 0-100>
}`;

      const promptParts: any[] = [
        {
          text: `${systemPrompt}

CURRENT PHOTOS (same person, same day):
User's goal: ${args.userGoal || "General fitness"}

Image 1: FRONT view`,
        },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: args.frontImageBase64,
          },
        },
        { text: "Image 2: BACK view" },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: args.backImageBase64,
          },
        },
      ];

      // Add previous photos if provided
      if (args.previousFrontBase64 && args.previousBackBase64) {
        promptParts.push(
          { text: "\n\nPREVIOUS PHOTOS (for comparison):\nPrevious FRONT view:" },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: args.previousFrontBase64,
            },
          },
          { text: "Previous BACK view:" },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: args.previousBackBase64,
            },
          }
        );
      }

      promptParts.push({
        text: `\n\nAnalyze these as 2 views of the SAME person for a complete body composition assessment.
Respond in ${args.language || "English"} with valid JSON only.`,
      });

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Fast model for simple body composition
        contents: [{ parts: promptParts }],
        config: {
          temperature: 0.7,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
        },
      });

      const analysisText = result.text || '';

      // Parse JSON response
      const analysis = JSON.parse(analysisText);

      loggers.ai.info("Paired body photo analysis completed");

      return {
        bodyFatEstimate: analysis.bodyFatEstimate,
        muscleChanges: analysis.muscleChanges,
        improvements: analysis.improvements,
        suggestions: analysis.suggestions,
        confidence: analysis.confidence,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      loggers.ai.error("Paired photo analysis error:", error);
      throw new Error(`Paired photo analysis failed: ${error.message}`);
    }
  },
});

/**
 * Batch populate step_by_step for exercises that don't have them
 * Processes in small batches to avoid rate limits
 */
export const batchPopulateStepByStep = action({
  args: {
    batchSize: v.optional(v.number()),
    delayMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 5;
    const delayMs = args.delayMs || 4500; // ~13 requests/minute to stay under limit

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    // Get exercises without step_by_step
    const allExercises = await ctx.runQuery(api.queries.getExercisesWithoutSteps, {
      limit: batchSize
    });

    if (allExercises.length === 0) {
      return { processed: 0, message: "All exercises already have step_by_step" };
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    let processed = 0;
    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const exercise of allExercises) {
      try {
        const prompt = `Exercise: "${exercise.exercise_name}"

Generate ONLY step-by-step instructions. Be ULTRA CONCISE - max 6 words per step.

JSON format:
{
  "step_by_step": ["Setup step", "Execute step", "Return step"]
}

RULES:
- 3-4 steps maximum
- Max 6 words per step
- Action words only, no fluff

Return ONLY valid JSON.`;

        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
        });

        const responseText = result.text || '';
        let jsonString = responseText;
        if (responseText.includes('```json')) {
          const match = responseText.match(/```json\n([\s\S]*?)\n```/);
          if (match) jsonString = match[1];
        } else if (responseText.includes('```')) {
          const match = responseText.match(/```\n([\s\S]*?)\n```/);
          if (match) jsonString = match[1];
        }

        const data = JSON.parse(jsonString);

        // Update the exercise with step_by_step
        await ctx.runMutation(api.mutations.updateExerciseStepByStep, {
          exerciseId: exercise._id,
          step_by_step: data.step_by_step || []
        });

        processed++;
        results.push({ name: exercise.exercise_name, success: true });

        // Delay between requests
        if (processed < allExercises.length) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error: any) {
        results.push({
          name: exercise.exercise_name,
          success: false,
          error: error.message
        });
      }
    }

    return {
      processed,
      total: allExercises.length,
      results,
      message: `Processed ${processed}/${allExercises.length} exercises`
    };
  },
});
