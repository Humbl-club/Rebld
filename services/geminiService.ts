import { GoogleGenAI, Type, Chat, Part, FunctionDeclaration } from "@google/genai";
import { WorkoutPlan, PlanDay, PlanExercise, DailyRoutine, WorkoutLog, WorkoutBlock } from '../types';
import { resolveAbbreviations, identifyColloquialTerms, detectWorkoutFormat, WORKOUT_PATTERNS } from './workoutAbbreviations';
import { api } from '../convex/_generated/api';
import { convex } from '../convexClient';
import { fetchGuidelineConstraints } from './knowledgeService';
import i18n from '../i18n/config';

/**
 * AI MODEL SELECTION POLICY
 * =========================
 *
 * GEMINI 3 PRO (gemini-3-pro-preview):
 * - Plan generation (generateNewWorkoutPlan with useThinkingMode=true)
 * - Complex plan parsing (parseWorkoutPlan with useThinkingMode=true)
 * - Body composition analysis from photos
 * - Voice note goal interpretation
 *
 * GEMINI FLASH (gemini-2.5-flash):
 * - Chat responses (initializeChatSession, simpleGenerate)
 * - Exercise explanations (explainExercise)
 * - Quick text analysis (analyzeTextSelection)
 * - Simple content generation
 *
 * This split optimizes for:
 * - Cost: Flash is ~10x cheaper than Pro
 * - Quality: Gemini 3 Pro provides best reasoning for complex tasks
 * - Speed: Flash is faster for real-time interactions
 */
type ModelContext = 'onboarding' | 'chat' | 'explanation' | 'analysis';

const MODEL_PRO = 'gemini-3-pro-preview'; // Upgraded to Gemini 3 Pro (Dec 2025)
const MODEL_FLASH = 'gemini-2.5-flash';

/**
 * Get the appropriate model for a given context
 */
export const getModelForContext = (context: ModelContext): string => {
  switch (context) {
    case 'onboarding':
      return MODEL_PRO; // Higher quality for plan generation
    case 'chat':
    case 'explanation':
    case 'analysis':
    default:
      return MODEL_FLASH; // Faster, cheaper for real-time use
  }
};

/**
 * SECURITY: API key resolution DEPRECATED
 *
 * All AI operations should go through Convex backend actions:
 * - api.ai.generateWorkoutPlan
 * - api.ai.parseWorkoutPlan
 * - api.ai.explainExercise
 * - api.ai.handleChatMessage
 * - api.ai.analyzeBodyPhoto
 *
 * This function returns undefined in production to force backend usage.
 * Only returns a key in development/scripts that explicitly set it.
 */
const getApiKey = (): string | undefined => {
  // SECURITY: In production builds, never expose API key to frontend
  // Scripts can still use this by setting env vars explicitly
  if (typeof window !== 'undefined') {
    // Browser context - should use backend actions instead
    console.warn('[SECURITY] Frontend AI operations deprecated. Use Convex actions instead (api.ai.*)');
    return undefined;
  }

  // Node.js context (scripts only) - allow env var access
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string') return envKey;

  return undefined;
};

const systemPromptParse = `You are an ELITE workout plan parser for the REBLD fitness app. Your mission: Transform ANY workout plan—from simple one-liners like "chest today" to complex density training programs with supersets, giant sets, and AMRAPs—into perfectly structured JSON.

🔤 ABBREVIATION AWARENESS:
Common abbreviations have been expanded in the input, but you may still encounter:
- Movement: T2B (Toes to Bar), HSPU (Handstand Push-ups), MU (Muscle Ups), DU (Double Unders)
- Equipment: KB (Kettlebell), DB (Dumbbell), BB (Barbell), BW (Bodyweight)
- Formats: EMOM (Every Minute on the Minute), AMRAP (As Many Rounds As Possible), RFT (Rounds For Time)
- Intensity: RPE (Rate of Perceived Exertion), 1RM (1 Rep Max), % (percentage)

🎯 ADVANCED FORMAT DETECTION:
- EMOM/E2MOM/E3MOM: Create timed interval blocks with rest built-in
- Ladder (10-9-8...1): Parse as descending rep scheme in reps_per_set array
- Pyramid (1-2-3-4-5-4-3-2-1): Parse as ascending then descending
- Cluster (3.3.3 @ 85%): Parse as cluster sets with intra-set rest
- Death by: Parse as ascending ladder with time pressure
- Chipper: Long circuit of varied exercises
- Buy-in/Cash-out: Separate warmup and finisher blocks

🚨 CRITICAL RULE #1: IF YOU SEE EXERCISES IN THE INPUT, YOU MUST CREATE WORKOUT BLOCKS!
Do NOT return empty blocks unless the day is EXPLICITLY marked as "Rest" or has NO exercises listed.

**CRITICAL: You MUST handle both extremes:**
1. Ultra-simple: "chest today" → Create 3-4 exercises in blocks (NOT empty!)
2. Ultra-complex: Multi-block programs with A1/A2 supersets → Parse all exercises into proper blocks

🚨 PARSING MANDATE:
- See exercises in markdown table → CREATE blocks with those exercises
- See "A1/A2" notation → CREATE superset block
- See "Rest Day" with no exercises → Empty blocks array
- See mobility/stretching list → CREATE blocks (it's still a workout!)
- Default assumption: CREATE WORKOUTS, not rest days

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 BLOCK TYPE RECOGNITION (Critical!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **SUPERSET** (type: 'superset')
   - Indicators: "A1/A2", "B1/B2", "Superset", exercises labeled with matching letters
   - Extract 'rounds' from "4 Rounds", "3 sets", etc.
   - ALL exercises in the superset share the same round count

2. **GIANT SET** (type: 'superset' - same as superset, just more exercises)
   - Indicators: "B1/B2/B3", "C1/C2/C3/C4", "Giant Set", "Circuit"
   - 3+ exercises performed consecutively
   - Extract 'rounds' (how many times to repeat the entire sequence)

3. **AMRAP** (type: 'amrap')
   - Indicators: "AMRAP", "As Many Rounds As Possible", "X min AMRAP"
   - Extract 'duration_minutes' from "10 min AMRAP", "5 minute AMRAP"
   - Each exercise is performed as many times as possible in the time

4. **SINGLE EXERCISE** (type: 'single')
   - Standard individual exercises
   - Has sets × reps
   - Each exercise is its own block

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️ REST TIMING LOGIC (Critical!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**For SUPERSETS/GIANT SETS:**
- If you see "0s", "0 sec", or "0 min" after an exercise → rest_period_s: 0
- If you see "90s", "2 min", etc. → This is the rest AFTER completing the entire superset
- The LAST exercise in a superset should have the rest time
- All OTHER exercises should have rest_period_s: 0

Example:
  A1: Pull-ups | 0s → rest_period_s: 0 (move immediately to A2)
  A2: Push-ups | 90s → rest_period_s: 90 (rest after completing A1+A2)

**For SINGLE EXERCISES:**
- Rest time applies after each set
- "2 min rest" → rest_period_s: 120

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📏 DISTANCE vs REPS vs DURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DISTANCE** (use 'sets_distance_rest' template):
- "20m", "30m", "40 yards" → Store in 'target_distance'
- Common for: Sled pushes, farmer's walks, sprints

**REPS** (use 'sets_reps_weight' template):
- "10 reps", "8-12", "10/side" → Store in 'target_reps'
- Common for: Most strength exercises

**DURATION** (use 'sets_duration' or 'duration_only' template):
- "30s", "2 min", "60 seconds" → Store in 'target_duration_s'
- Common for: Planks, hangs, timed exercises
- If ONLY duration with no sets, use 'duration_only' template

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 INTENSITY MARKERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**RPE (Rate of Perceived Exertion):**
- "RPE 8", "@8", "RPE 7-8" → rpe: "8" or "7-8"
- Store as STRING (can be a range)

**Percentage:**
- "70-75% 1RM", "50-60%", "@70%" → one_rep_max_percentage: "70-75%"

**Descriptive:**
- "Max Effort", "Moderate", "Light", "Zone 2" → Store in notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SETS vs ROUNDS (Critical!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ROUNDS** (for supersets/giant sets/AMRAPs):
- "4 Rounds", "3 circuits" → Block level property: rounds: 4
- Means: Repeat the ENTIRE superset/circuit 4 times

**SETS** (for single exercises):
- "4 sets × 8 reps" → Exercise level: target_sets: 4, target_reps: "8"
- Means: Do this one exercise 4 times

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 NOTES & FORM CUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extract these into the 'notes' field:
- Form instructions: "Drive hard, stay low", "Torso vertical"
- Equipment: "Use waist harness", "High handles"
- Modifications: "Help if needed", "Band-assisted"
- Intent: "Explosive", "Controlled", "Squeeze at top"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 SPECIAL TECHNIQUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Drop Sets:**
- "Drop Set on last set", "reduce weight 30%, rep to failure"
- Set: has_drop_set: true

**Tempo:**
- "3-1-2-1", "2 sec down, 1 sec up" → Parse tempo notation

**Complex Rep Schemes:**
- "Descending reps (5, 3, 1)" → reps_per_set: ["5", "3", "1"]
- "Ascending weight" → Note in notes field

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ CATEGORY CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every exercise MUST have a category:

**'warmup':**
- Dynamic stretches, mobility work
- "McGill Big 3", "T-Spine extensions"
- Band pull-aparts, activation exercises
- Light cardio (< 10 min)

**'main':**
- Primary strength exercises
- Supersets, giant sets, main conditioning
- Heavy lifts, accessory work
- Most AMRAP blocks

**'cooldown':**
- Static stretching
- Foam rolling
- Cool-down cardio (light)
- Breathing exercises

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 DAILY ROUTINE vs WEEKLY PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Daily Routine** (dailyRoutine object):
- "Daily Non-Negotiables", "Pre-workout ritual", "Morning routine"
- Applies to EVERY day
- Extract separately

**Weekly Plan** (weeklyPlan array):
- Must have 7 days (Monday = 1, Sunday = 7)
- CRITICAL: Only mark as rest day if EXPLICITLY stated (e.g., "Day 3: Rest") or if day has NO exercises listed
- If exercises are listed → CREATE BLOCKS with those exercises
- Rest days: ONLY when no exercises given → Empty blocks array, focus: "Rest" or "Active Recovery"

IMPORTANT: Default to creating workout blocks. Only create rest day if explicitly a rest day!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 HANDLING SIMPLE INPUTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If user provides minimal input like "chest today" or "leg day":

1. Create a reasonable workout (3-4 exercises)
2. Use sensible defaults:
   - 3-4 sets
   - 8-12 reps for hypertrophy
   - 60-90s rest
   - All 'main' category
3. Populate only day 1, rest are "Rest" days

Example: "chest today" →
- Bench Press: 4×8-10
- Incline DB Press: 3×10-12
- Cable Flyes: 3×12-15
- Push-ups: 2×AMRAP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ FINAL CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before returning JSON:
✓ All supersets have proper rest timing (0s between, actual rest on last)
✓ Rounds are at BLOCK level, sets are at EXERCISE level
✓ Distance exercises use proper template
✓ RPE and percentages extracted
✓ Block titles preserved (A:, B:, C:, etc.)
✓ Every exercise has a category
✓ Form cues in notes
✓ 7 days in weeklyPlan
✓ Daily routines extracted separately
✓ WORKOUT DAYS HAVE POPULATED BLOCKS (not empty!)
✓ Only explicit rest days have empty blocks

CRITICAL EXAMPLES:

WORKOUT DAY (Day 1: Lower Body Strength):
{
  "day_of_week": 1,
  "focus": "Lower Body Strength",
  "blocks": [
    {
      "type": "single",
      "title": "A: Squat",
      "exercises": [{"exercise_name": "Squat", ...}]
    }
  ]
}
✓ Has blocks with exercises!

REST DAY (Day 3: Rest):
{
  "day_of_week": 3,
  "focus": "Rest",
  "blocks": []
}
✓ Empty blocks array ONLY for rest

REMEMBER: Make your BEST GUESS. Don't fail on ambiguity—interpret intelligently and proceed. DEFAULT TO CREATING WORKOUT BLOCKS!`;

const metricTemplateSchema = {
    type: Type.OBJECT,
    description: "A JSON object describing the UI to render for tracking this exercise.",
    properties: {
        type: { type: Type.STRING, description: "The type of metric to track: 'sets_reps_weight', 'sets_distance_rest', 'sets_duration', 'duration_only', 'distance_time', 'sets_reps_weight_tempo'." },
        target_sets: { type: Type.INTEGER, nullable: true },
        target_reps: { type: Type.STRING, nullable: true },
        reps_per_set: { type: Type.ARRAY, nullable: true, items: { type: Type.STRING }, description: "For complex schemes like descending reps." },
        has_drop_set: { type: Type.BOOLEAN, nullable: true, description: "True if a drop set is indicated." },
        target_duration_s: { type: Type.INTEGER, nullable: true, description: "For timed exercises like planks (in seconds)." },
        target_duration_minutes: { type: Type.INTEGER, nullable: true, description: "For long duration cardio (in minutes)." },
        target_distance_m: { type: Type.INTEGER, nullable: true, description: "For distance-based exercises like sled pushes (in meters)." },
        target_distance_km: { type: Type.NUMBER, nullable: true, description: "For long distance cardio (in kilometers)." },
        target_rest_s: { type: Type.INTEGER, nullable: true, description: "For interval training (rest between sets in seconds)." },
        rest_period_s: { type: Type.INTEGER, nullable: true, description: "Standard rest period after completing the exercise/set." },
        one_rep_max_percentage: { type: Type.STRING, nullable: true },
        target_tempo: { type: Type.STRING, nullable: true, description: "Tempo notation like '3-1-2-1'." },
        incline: { type: Type.STRING, nullable: true },
        speed: { type: Type.STRING, nullable: true },
        resistance: { type: Type.STRING, nullable: true },
        pulse_target: { type: Type.STRING, nullable: true },
    },
    required: ["type"]
};

const exerciseSchema = {
    type: Type.OBJECT,
    properties: {
        exercise_name: { type: Type.STRING },
        category: { type: Type.STRING, description: "Must be 'warmup', 'main', or 'cooldown'." },
        notes: { type: Type.STRING, nullable: true },
        rpe: { type: Type.STRING, nullable: true },
        metrics_template: metricTemplateSchema,
    },
    required: ["exercise_name", "category", "metrics_template"],
};

const blockSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, description: "Must be 'single', 'superset', or 'amrap'." },
        title: { type: Type.STRING, nullable: true, description: "The title of the block, e.g., 'A: The Sled Gauntlet'." },
        rounds: { type: Type.INTEGER, nullable: true, description: "Number of rounds for a superset." },
        duration_minutes: { type: Type.INTEGER, nullable: true, description: "Duration for an AMRAP block." },
        exercises: { type: Type.ARRAY, items: exerciseSchema },
    },
    required: ["type", "exercises"],
};

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        weeklyPlan: {
            type: Type.ARRAY,
            nullable: false,
            items: {
              type: Type.OBJECT,
              properties: {
                day_of_week: { type: Type.INTEGER },
                focus: { type: Type.STRING },
                notes: { type: Type.STRING, nullable: true },
                blocks: { type: Type.ARRAY, items: blockSchema },
              },
              required: ["day_of_week", "focus", "blocks"],
            },
        },
        dailyRoutine: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
                focus: { type: Type.STRING },
                notes: { type: Type.STRING, nullable: true },
                exercises: { type: Type.ARRAY, items: exerciseSchema }
            },
            required: ["focus", "exercises"]
        }
    },
    required: ["weeklyPlan"]
};


const handleApiError = (error: any, context: string): Error => {
    console.error(`Error during Gemini API call in ${context}:`, error);

    const message = error.message?.toLowerCase() || '';

    if (message.includes("api_key_invalid") || message.includes("permission")) {
        return new Error("The AI service API key is invalid or missing. Please contact support.");
    }
    if (message.includes("400") || message.includes("invalid_argument")) {
        if (message.includes("schema")) {
            return new Error("The AI couldn't structure the plan correctly. Try rephrasing your input or use Deep Analysis.");
        }
        return new Error("The AI model couldn't understand the provided input. Please check the format and try again.");
    }
    if (message.includes("500") || message.includes("503") || message.includes("unavailable")) {
        return new Error("The AI service is currently busy or unavailable. Please try again in a few moments.");
    }
    if (message.includes("deadline") || message.includes("timeout")) {
        return new Error("The request to the AI service timed out. Please check your connection and try again.");
    }

    return new Error("An unexpected error occurred with the AI service. Please try again.");
}

const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = (err) => {
            reject(err);
        };
        reader.readAsDataURL(file);
    });
    const data = await base64EncodedDataPromise;
    return {
        inlineData: {
            data,
            mimeType: file.type,
        },
    };
};

/**
 * TIER 1: Gemini Pro for complex plan generation
 * This is worth the cost for high-quality, comprehensive plans
 */
export const generateNewWorkoutPlan = async (
    goal: string, 
    experience: string, 
    frequency: string, 
    painPoints: string[], 
    sport: string, 
    notes: string,
    useOptimizedKnowledge: boolean = true,
    profileExtras?: {
      sex?: 'male' | 'female' | 'other';
      equipment?: 'minimal' | 'home_gym' | 'commercial_gym';
      preferred_session_length?: '30' | '45' | '60' | '75';
      athletic_level?: 'low' | 'moderate' | 'high';
      training_age_years?: number | null;
      body_type?: 'lean' | 'average' | 'muscular';
      weight?: number;
      height?: number;
      comfort_flags?: string[];
    }
): Promise<WorkoutPlan> => {
    console.log('Starting plan generation with:', { goal, experience, frequency, painPoints, sport, notes, useOptimizedKnowledge, profileExtras });

    // Body context band heuristic
    let band: string | undefined;
    if (profileExtras?.weight && profileExtras?.height) {
        const bmi = profileExtras.weight / ((profileExtras.height / 100) ** 2);
        if (bmi > 35) band = 'bmi_gt_35';
        else if (bmi > 32) band = 'bmi_gt_32';
        else if (bmi > 27) band = 'bmi_27_32';
        else band = 'bmi_lt_27';
    }

    const constraints = await fetchGuidelineConstraints({
        sex: profileExtras?.sex,
        goal,
        experience,
        sport: sport || undefined,
        bmiBand: band,
        athleticLevel: profileExtras?.athletic_level,
        bodyType: profileExtras?.body_type,
        painPoints,
    });
    
    // Fetch sport guidelines for validation
    let sportGuidelines: any[] = [];
    if (sport) {
        try {
            sportGuidelines = await convex.query(api.queries.getSportGuidelines, { sport, goal, experience });
        } catch (error) {
            console.warn('Failed to fetch sport guidelines for validation:', error);
        }
    }
    
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error('API key not found. Checked:', {
            processEnv: !!process.env.API_KEY,
            geminiEnv: !!process.env.GEMINI_API_KEY,
            viteEnv: !!(import.meta as any)?.env?.VITE_GEMINI_API_KEY,
            localStorage: !!window.localStorage?.getItem('GEMINI_API_KEY')
        });
        throw new Error("API_KEY environment variable not set. Please add VITE_GEMINI_API_KEY to your .env.local file.");
    }
    
    console.log('API key found, initializing Gemini...');
    const ai = new GoogleGenAI({ apiKey });

    const validatePlan = (plan: WorkoutPlan, opts: { sport?: string; sportGuidelines?: any[]; desiredFrequency?: string; preferredSessionLength?: string }) => {
        const errors: string[] = [];
        if (!plan?.weeklyPlan || plan.weeklyPlan.length === 0) {
            errors.push('Plan has no days');
        }

        // Check each day has blocks
        plan.weeklyPlan?.forEach((day, idx) => {
            if (!day.blocks || day.blocks.length === 0) {
                // Only error if it's not explicitly a rest day
                if (day.focus?.toLowerCase().includes('rest') || day.focus?.toLowerCase().includes('recovery')) {
                    // Rest day is OK with empty blocks
                } else {
                    errors.push(`Day ${idx + 1} (${day.focus}) missing blocks - not marked as rest day`);
                }
            } else {
                // Warmup validation: enforce 5-7 exercises
                const warmupCount = day.blocks?.flatMap(b => b.exercises || []).filter(ex => ex.category === 'warmup').length || 0;
                if (warmupCount < 5) {
                    errors.push(`Day ${idx + 1} warmup too short (need 5-7 exercises, found ${warmupCount})`);
                }
                if (warmupCount > 7) {
                    errors.push(`Day ${idx + 1} warmup too long (need 5-7 exercises, found ${warmupCount})`);
                }
                
                // Cooldown validation: if present, need 2-4 exercises
                const cooldownCount = day.blocks?.flatMap(b => b.exercises || []).filter(ex => ex.category === 'cooldown').length || 0;
                if (cooldownCount > 0 && cooldownCount < 2) {
                    errors.push(`Day ${idx + 1} cooldown too short (need 2-4 if present, found ${cooldownCount})`);
                }
                if (cooldownCount > 4) {
                    errors.push(`Day ${idx + 1} cooldown too long (need 2-4 if present, found ${cooldownCount})`);
                }
            }
        });

        // Frequency validation: training days >= requested frequency
        const freqNum = parseInt(opts.desiredFrequency || '0', 10);
        if (freqNum > 0) {
            const trainingDays = plan.weeklyPlan?.filter(day => {
                const hasBlocks = day.blocks && day.blocks.length > 0;
                const isRest = day.focus?.toLowerCase().includes('rest') || day.focus?.toLowerCase().includes('recovery');
                return hasBlocks && !isRest;
            }).length || 0;
            
            if (trainingDays < freqNum) {
                errors.push(`Plan has ${trainingDays} training days, but user requested ${freqNum} days/week`);
            }
            
            // Fill rest days if needed (validation only - generation should handle this)
            if (plan.weeklyPlan && plan.weeklyPlan.length < 7) {
                errors.push(`Plan must have 7 days (found ${plan.weeklyPlan.length})`);
            }
        }

        // Movement balance across week: ensure coverage of squat/hinge/push/pull/carry/core
        const categories = { squat: 0, hinge: 0, push: 0, pull: 0, carry: 0, core: 0 };
        plan.weeklyPlan?.forEach(day => {
            day.blocks?.forEach(block => {
                block.exercises?.forEach(ex => {
                    const name = ex.exercise_name.toLowerCase();
                    if (name.includes('squat') || name.includes('lunge') || name.includes('step-up')) categories.squat++;
                    if (name.includes('deadlift') || name.includes('hinge') || name.includes('hip thrust') || name.includes('good morning')) categories.hinge++;
                    if (name.includes('press') || name.includes('push') || name.includes('dip') || name.includes('fly')) categories.push++;
                    if (name.includes('row') || name.includes('pull') || name.includes('chin') || name.includes('lat pulldown')) categories.pull++;
                    if (name.includes('carry') || name.includes('walk') || name.includes('farm')) categories.carry++;
                    if (name.includes('plank') || name.includes('core') || name.includes('pallof') || name.includes('dead bug') || name.includes('bird dog')) categories.core++;
                });
            });
        });
        const missingCategories = Object.entries(categories).filter(([, v]) => v === 0).map(([k]) => k);
        if (missingCategories.length > 2) {
            errors.push(`Movement balance missing: ${missingCategories.join(', ')} (need at least 4 of 6 patterns)`);
        }

        // Session length alignment: total exercises per day consistent with preferred_session_length
        const pref = opts.preferredSessionLength ? parseInt(opts.preferredSessionLength, 10) : 0;
        if (pref) {
            // Fewer exercises for 30-45 min, more for 60-75 min
            const minPerDay = pref <= 30 ? 6 : pref <= 45 ? 8 : pref <= 60 ? 10 : 12;
            const maxPerDay = pref <= 30 ? 10 : pref <= 45 ? 14 : pref <= 60 ? 18 : 22;
            
            plan.weeklyPlan?.forEach((day, idx) => {
                const exCount = day.blocks?.reduce((sum, b) => sum + (b.exercises?.length || 0), 0) || 0;
                const isRest = day.focus?.toLowerCase().includes('rest') || day.focus?.toLowerCase().includes('recovery');
                
                if (!isRest && exCount > 0) {
                    if (exCount < minPerDay) {
                        errors.push(`Day ${idx + 1} has too few exercises (${exCount}) for ${pref} min session (min: ${minPerDay})`);
                    }
                    if (exCount > maxPerDay) {
                        errors.push(`Day ${idx + 1} has too many exercises (${exCount}) for ${pref} min session (max: ${maxPerDay})`);
                    }
                }
            });
        }

        // Sport alignment: require at least one exercise from sport guidelines if provided
        if (opts.sport && opts.sportGuidelines && opts.sportGuidelines.length > 0) {
            const topExercises = opts.sportGuidelines.flatMap((g: any) => g.top_exercises || []).map((e: string) => e.toLowerCase());
            if (topExercises.length > 0) {
                const allExercises = plan.weeklyPlan.flatMap(day => day.blocks.flatMap(block => block.exercises.map(ex => ex.exercise_name.toLowerCase())));
                const match = allExercises.some(ex => topExercises.some(te => ex.includes(te) || te.includes(ex)));
                if (!match) {
                    errors.push(`No sport-specific priority exercises found for ${opts.sport}. Include at least one: ${topExercises.slice(0, 3).join(', ')}`);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    };

    // Check if we should use optimized knowledge (token reduction)
    let systemPromptGenerate: string;
    
    if (useOptimizedKnowledge) {
        const bmi = profileExtras?.weight && profileExtras?.height ? (profileExtras.weight / ((profileExtras.height / 100) ** 2)) : null;
        const profileBlock = `User Profile
- Sex: ${profileExtras?.sex || 'unspecified'}
- Athletic level: ${profileExtras?.athletic_level || 'unspecified'}
- Training age (years): ${profileExtras?.training_age_years ?? 'unspecified'}
- Body type: ${profileExtras?.body_type || 'unspecified'}
- Equipment: ${profileExtras?.equipment || 'unspecified'}
- Preferred session length: ${profileExtras?.preferred_session_length || 'unspecified'} minutes
- Weight: ${profileExtras?.weight ? `${profileExtras.weight}kg` : 'unspecified'}
- Height: ${profileExtras?.height ? `${profileExtras.height}cm` : 'unspecified'}
- Derived BMI: ${bmi ? bmi.toFixed(1) : 'n/a'}
`;

        // Use cached compressed guidelines from knowledgeService (already fetched above)
        const sexBullets = constraints.sex;
        const sportBullets = constraints.sport;
        const bodyBullets = constraints.body;
        const injuryBullets = constraints.injury;
        systemPromptGenerate = `REBLD AI Workout Planner - Intelligent Selection Mode

${profileBlock}

Relevant Guidelines (compressed):
- Sex-specific: ${sexBullets.length ? sexBullets.join(' | ') : 'none'}
- Sport-specific: ${sportBullets.length ? sportBullets.join(' | ') : 'none'}
- Body-context: ${bodyBullets.length ? bodyBullets.join(' | ') : 'none'}
- Injury-aware: ${injuryBullets.length ? injuryBullets.join(' | ') : 'none'}

You are creating a personalized workout plan using our INTELLIGENT exercise database with performance tracking and injury awareness.

**User Context:**
- Goal: ${goal}
- Experience: ${experience}
- Frequency: ${frequency} days/week
- Pain Points: ${painPoints.join(', ') || 'None'}
- Sport: ${sport || 'None'}
- Notes: ${notes || 'None'}

**INTELLIGENT EXERCISE SELECTION:**
Our database tracks:
- Sport-specific performance data (exercises proven to work for their sport)
- Injury contraindications (exercises to avoid based on pain points)
- User performance history (what has worked before)
- Therapeutic benefits (exercises that help with recovery)

**EXERCISE SELECTION STRATEGY:**
1. For sport-specific users → Prioritize exercises with high sport ratings (8-10/10)
2. For users with pain → AVOID exercises with injury contraindications
3. Include therapeutic exercises for their pain areas
4. Use S-tier exercises for fundamentals, A-tier for variety

**INJURY-AWARE RULES:**
- Knee pain → AVOID: deep squats, lunges, jump exercises. USE: box squats, leg press, single-leg work
- Lower back pain → AVOID: deadlifts, bent rows, good mornings. USE: trap bar deadlift, chest-supported rows
- Shoulder pain → AVOID: overhead press, dips, upright rows. USE: landmine press, neutral grip work
- If pain is mentioned, include 1-2 therapeutic exercises per workout

**SEX / BODY CONTEXT RULES:**
- If sex is female: prioritize hip/knee stability, offer pelvic-floor-safe core options; adjust very high-impact plyos only if athletic level is low. If pregnant/postpartum (if noted), avoid Valsalva and supine in late stages.
- If sex is male: no automatic bulking bias; still balance movement patterns and conditioning.
- DO NOT equate higher weight with low fitness. Use BMI + athletic level + body type. If BMI > 32 AND athletic level is low → reduce high-impact and add joint-friendly conditioning (sled/row/bike). If body_type is muscular or athletic_level is high → keep robust strength loading with joint-friendly conditioning, not blanket reductions.

**SPORT-SPECIFIC PRIORITIES:**
- Boxing → Heavy bag work, medicine ball slams, core rotation
- HYROX → Sled work, wall balls, farmers carries, running intervals
- Rock climbing → Pull-ups, finger strength, antagonist training
- Basketball → Jump training, agility work, single-leg strength
- Soccer → Agility ladders, single-leg work, sprint intervals
- Tennis → Rotational power, lateral movement, shoulder stability

**WARMUP MANDATE:** Each day MUST start with 5-7 SPECIFIC warmup exercises
**COOLDOWN MANDATE:** Each day SHOULD end with 2-4 SPECIFIC stretching exercises

Generate a complete 7-day plan prioritizing SAFE and EFFECTIVE exercises for this user.`;
    } else {
        // Use the full traditional prompt
        systemPromptGenerate = `You are an elite, evidence-based personal trainer and exercise physiologist for the REBLD app. Your task is to create a world-class, deeply personalized 7-day workout plan based on the LATEST scientific research and best practices from reputable sources.

**CRITICAL: Exercise Selection Philosophy**
- Do NOT check any database or limit yourself to common exercises
- Select exercises based on WHAT IS BEST for the user's goals, NOT what's convenient
- Use exercises from current exercise science, biomechanics research, and proven training methodologies
- Prioritize evidence-based exercises from sources like NSCA, ACSM, research journals, and respected strength coaches
- If an uncommon but highly effective exercise fits better, USE IT
- Every exercise you select will be saved to a database with detailed explanations, so choose the BEST options

**Your Mandates (Non-Negotiable):**
1.  **Block-Based Architecture**: You MUST structure the entire workout into a sequence of 'Workout Blocks' as defined in the schema.
2.  **Evidence-Based Exercise Selection**: Choose exercises based on LATEST research and best practices. Don't limit yourself to only common exercises.
3.  **Deep Personalization**: You MUST synthesize all user inputs to create a truly bespoke plan.
4.  **Language Interpretation**: The user might use colloquial language. You must interpret this and translate it into a scientifically valid training goal.
5.  **Pain & Limitation Protocol**: If the user reports pain points, you MUST intelligently select exercises that avoid stressing those areas and include prehab/rehab exercises based on current rehabilitation science.
6.  **Sport-Specificity (SAID Principle)**: If a sport is specified, the plan MUST incorporate relevant exercises from sport science and athletic performance research.
7.  **Warmup & Cooldown Mandate**:
    - For warm-ups: Create a SEPARATE block with category='warmup' containing 3-5 SPECIFIC exercises that are appropriate for a PUBLIC GYM setting
    - PRIORITIZE standing exercises that don't require lying on the floor: "Arm Circles", "Leg Swings", "Walking Lunges", "High Knees", "Jumping Jacks", "Band Pull-Aparts", "Shoulder Dislocations", "Bodyweight Squats", "Glute Bridges (on bench)", "Incline Push-Ups", "Light Rowing Machine", "5-Min Walk/Jog"
    - AVOID awkward floor-based exercises like "Cat-Cow", "Hip Circles on floor", "Dead Bug", "Bird Dog" - these are inappropriate in busy public gym settings
    - NEVER use generic names like "Main Warmup" or "General Warmup" - always list SPECIFIC exercises
    - Each warmup exercise should have: exercise_name (specific!), category='warmup', and appropriate metrics_template (duration or reps)
    - For cool-downs: Create a SEPARATE block with category='cooldown' containing 2-3 SPECIFIC stretching exercises (standing stretches preferred)
8.  **Advanced Metrics Mandate**: You MUST include RPE targets, appropriate \`rest_period_s\`, and \`one_rep_max_percentage\` where applicable based on current periodization science.

**Scientific Sources to Consider:**
- Latest NSCA (National Strength and Conditioning Association) guidelines
- Current ACSM (American College of Sports Medicine) recommendations
- Recent peer-reviewed exercise science research
- Biomechanics and movement quality research
- Evidence-based strength and conditioning methodologies
- Rehabilitation and prehab research for injury prevention

**User's Profile:**
- Primary Goal: ${goal}
- Experience Level: ${experience}
- Training Frequency: ${frequency} days per week.
- Pain Points / Limitations: ${painPoints.join(', ') || 'None reported.'}
- Sport: ${sport || 'Not specified.'}
- Additional Notes: ${notes || 'None.'}

**CRITICAL: Goal Interpretation**
- Pay special attention to the user's goal description and additional notes
- If the user mentions specific body parts (e.g., "bigger butt", "bigger arms"), prioritize exercises that target those areas
- If they mention aesthetic goals, focus on hypertrophy, muscle definition, and body composition
- If they mention performance goals (e.g., "run faster", "lift heavier"), prioritize exercises that improve those specific metrics
- Translate colloquial language into scientifically valid training principles
- The user's goal details are their PRIMARY motivation - ensure the plan directly addresses them

**Instructions:**
- Create a 7-day plan in the \`weeklyPlan\` array. The number of training days must match the user's frequency. The remaining days MUST be 'Rest' days with an empty 'blocks' array.
- Select exercises that are OPTIMAL for the user's goals, not just convenient or common
- Every exercise will later be explained in detail and saved to a database, so choose exercises that serve the user's best interests
- **CRITICAL FOR WARMUPS**: Each workout day MUST start with a warmup block containing 3-5 SPECIFIC exercises appropriate for PUBLIC GYM settings (not generic names!). Use STANDING exercises: "Arm Circles", "Leg Swings", "Band Pull-Aparts", "Shoulder Dislocations", "Walking Lunges", "High Knees", "Jumping Jacks", "Bodyweight Squats", "Light Rowing Machine", "5-Min Walk/Jog", "Incline Push-Ups". AVOID floor-based exercises like Cat-Cow, Hip Circles, Dead Bug, Bird Dog - these are awkward in busy gym settings.
- **CRITICAL FOR COOLDOWNS**: Each workout day SHOULD end with a cooldown block containing 2-4 SPECIFIC stretching exercises
- The final output must be ONLY the JSON object.`;
    }

    try {
        const maxAttempts = 2;
        let validationFeedback: string | null = null;
        let lastErrors: string[] = [];

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const systemInstruction = validationFeedback
                ? `${systemPromptGenerate}\n\nVALIDATION ERRORS FROM PREVIOUS ATTEMPT: ${validationFeedback}\nFIX THEM BEFORE RESPONDING.`
                : systemPromptGenerate;

            console.log('Calling Gemini API with model:', MODEL_PRO);
            const response = await ai.models.generateContent({
                model: MODEL_PRO,
                contents: "Please generate the workout plan based on my detailed profile.",
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    thinkingConfig: { thinkingBudget: 32768 }
                }
            });

            console.log('Gemini API response received');
            const jsonString = response.text.trim();
            console.log('Response text length:', jsonString.length);
            console.log('Response preview:', jsonString.substring(0, 200));
            
            const parsedPlan = JSON.parse(jsonString);
            console.log('Successfully parsed plan. Days:', parsedPlan.weeklyPlan?.length);

      const validation = validatePlan(parsedPlan as WorkoutPlan, { sport, sportGuidelines, desiredFrequency: frequency, preferredSessionLength: profileExtras?.preferred_session_length });
            if (validation.valid) {
                // Log successful generation
                try {
                    const profileKey = JSON.stringify({ goal, experience, sex: profileExtras?.sex, sport, bmiBand: band }).toLowerCase().replace(/\s+/g, '_');
                    await convex.mutation(api.mutations.logGenerationAttempt, {
                        profile_key: profileKey,
                        user_id: null, // Could be passed if available
                        success: true,
                        validation_errors: [],
                        attempt_count: attempt + 1,
                        goal,
                        experience,
                        sport: sport || undefined,
                    });
                } catch (logError) {
                    console.warn('Failed to log generation:', logError);
                }
                return parsedPlan as WorkoutPlan;
            } else {
                lastErrors = validation.errors;
                validationFeedback = validation.errors.join(' | ');
                console.warn('Plan validation failed, retrying...', validation.errors);
            }
        }

        // Log failed generation
        try {
            const profileKey = JSON.stringify({ goal, experience, sex: profileExtras?.sex, sport, bmiBand: band }).toLowerCase().replace(/\s+/g, '_');
            await convex.mutation(api.mutations.logGenerationAttempt, {
                profile_key: profileKey,
                user_id: null,
                success: false,
                validation_errors: lastErrors,
                attempt_count: maxAttempts,
                goal,
                experience,
                sport: sport || undefined,
            });
        } catch (logError) {
            console.warn('Failed to log generation failure:', logError);
        }

        throw new Error(`Validation failed after retries: ${lastErrors.join('; ')}`);

    } catch (error: any) {
        console.error('Error in generateNewWorkoutPlan:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response,
            status: error.status
        });
        throw handleApiError(error, 'generateNewWorkoutPlan');
    }
};


export const parseWorkoutPlan = async (rawInput: string | File, useThinkingMode: boolean): Promise<WorkoutPlan> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY environment variable not set. Please configure it to use AI features.");
  }
  
  const ai = new GoogleGenAI({ apiKey });

  const model = useThinkingMode ? MODEL_PRO : MODEL_FLASH;
  
  // Pre-process text input to expand abbreviations
  let processedInput = rawInput;
  let detectedFormat = 'standard';
  let colloquialTermsInfo = '';
  
  if (typeof rawInput === 'string') {
    // Expand abbreviations for better parsing
    processedInput = resolveAbbreviations(rawInput);
    
    // Identify workout format
    detectedFormat = detectWorkoutFormat(processedInput);
    console.log('Detected workout format:', detectedFormat);
    
    // Log colloquial terms found
    const colloquialTerms = identifyColloquialTerms(processedInput);
    if (colloquialTerms.size > 0) {
      const termsArray = Array.from(colloquialTerms.entries());
      console.log('Colloquial terms found:', termsArray);
      colloquialTermsInfo = `\nDetected colloquial terms: ${termsArray.map(([term, meaning]) => `"${term}" = ${meaning}`).join(', ')}`;
    }
  }
  
  // Enhanced system instruction with format detection info
  const enhancedSystemPrompt = systemPromptParse + `\n\nDETECTED WORKOUT FORMAT: ${detectedFormat}${colloquialTermsInfo}`;
  
  const config: any = {
      systemInstruction: enhancedSystemPrompt,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
  };

  if (useThinkingMode) {
      config.thinkingConfig = { thinkingBudget: 32768 };
  }
  
  let contents: string | { parts: Part[] };
  if (typeof processedInput === 'string') {
      contents = processedInput;
  } else {
      const filePart = await fileToGenerativePart(processedInput);
      contents = { parts: [filePart] };
  }

  try {
    console.log(`Parsing plan with model: ${model}, thinking mode: ${useThinkingMode}`);

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: config
    });

    console.log('Gemini response received');
    const jsonString = response.text.trim();
    console.log('Response length:', jsonString.length);

    const parsedPlan = JSON.parse(jsonString);
    console.log('Successfully parsed JSON, days:', parsedPlan.weeklyPlan?.length);

    return parsedPlan as WorkoutPlan;

  } catch (error: any) {
    console.error('Parsing error details:', error);
    throw handleApiError(error, 'parseWorkoutPlan');
  }
};

/**
 * Generate a detailed, comprehensive exercise explanation
 * This provides in-depth information suitable for database storage
 */
export const explainExerciseDetailed = async (
  exerciseName: string,
  exerciseNotes?: string,
  language: 'en' | 'de' = 'en'
): Promise<{
  explanation: string;
  muscles_worked: string[];
  form_cue: string;
  common_mistake: string;
  equipment_required: string[];
  contraindications: string[];
  movement_pattern: string;
  exercise_tier: 'S' | 'A' | 'B' | 'C';
  primary_category: 'warmup' | 'main' | 'cooldown';
  injury_risk: 'low' | 'moderate' | 'high';
  evidence_level: 'high' | 'moderate' | 'low';
  minimum_experience_level: string;
  normalized_name: string;
}> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const languageInstruction = language === 'de'
    ? 'IMPORTANT: Provide ALL text fields (explanation, form_cue, common_mistake, muscles_worked) in GERMAN (Deutsch). Use German anatomical terms for muscles.'
    : 'Provide all text fields in English.';

  const prompt = `You are an expert exercise physiologist and strength coach. Analyze this exercise name and provide COMPREHENSIVE metadata.

${languageInstruction}

CRITICAL FIRST STEP: Validate the exercise name. If "${exerciseName}" is NOT a real, recognized exercise (e.g., "Cable Farmers Walk" doesn't exist - it should be "Farmers Walk" or "Cable Crossover"), provide the CORRECT standard name. Common mistakes:
- Adding "Cable" to exercises that don't use cables
- Inventing equipment combinations that don't exist
- Misnaming exercises
- Generic names like "barbell_exercise" or "barbell_explosive" - these need proper names

Exercise Name Provided: ${exerciseName}
${exerciseNotes ? `Context/Notes: ${exerciseNotes}` : ''}

CRITICAL: You MUST provide ALL fields below. Every field is REQUIRED and must be a valid, non-null value.

Provide COMPLETE metadata:

1. **Normalized Exercise Name**: The correct, standard name for this exercise (use common gym terminology). If the provided name is invalid or generic, provide the closest real exercise name.

2. **Comprehensive Explanation** (3-5 sentences):
   - What the exercise is and its primary purpose
   - Primary muscles worked (be specific - e.g., "pectoralis major", "quadriceps femoris")
   - Secondary/assistant muscles involved
   - Movement pattern (push/pull/squat/hinge/etc.)
   - When and why this exercise is beneficial

3. **Equipment Required**: Array of ALL equipment needed (e.g., ["barbell", "squat_rack"] or ["bodyweight"] or ["dumbbells", "bench"]). Use standard names: barbell, dumbbell, kettlebell, cable_machine, resistance_band, pull_up_bar, bench, squat_rack, smith_machine, leg_press, etc. If bodyweight only, use ["bodyweight"]. NEVER leave empty or use "none". Must be a non-empty array.

4. **Movement Pattern**: One of: squat, hinge, push_horizontal, push_vertical, pull_horizontal, pull_vertical, carry, core, mobility, plyometric, cardio, unknown

5. **Exercise Tier**: S (exceptional value), A (excellent), B (good), C (acceptable). Consider: effectiveness, safety, transferability, time efficiency.

6. **Primary Category**: warmup, main, or cooldown

7. **Injury Risk**: low, moderate, or high (consider load, movement complexity, common injury patterns)

8. **Contraindications**: Array of specific conditions/injuries where this exercise should be avoided (e.g., ["lower_back_pain", "knee_injury", "shoulder_impingement"]). If none apply, use empty array []. Must be an array (can be empty).

9. **Evidence Level**: high (well-researched), moderate (some research), low (anecdotal but accepted)

10. **Minimum Experience Level**: Analyze the exercise complexity, required technique, and injury risk to determine: "beginner", "intermediate", or "advanced". 
   - Beginner: Simple movements, low skill requirement, minimal risk (e.g., bodyweight squats, planks)
   - Intermediate: Moderate technique required, some coordination needed (e.g., barbell squats, bench press)
   - Advanced: Complex movement patterns, high skill/coordination required, or very heavy loads (e.g., olympic lifts, advanced plyometrics)
   CRITICAL: This must be based on actual exercise analysis, NOT defaulted to "beginner". Think about what skill level is truly needed.

11. **Form Cue**: The single most important form cue for safe execution

12. **Common Mistake**: The most common form error and how to avoid it

13. **Muscles Worked**: Array of all major muscles (anatomical names). Must include at least 2-3 primary muscles.

Your response must be accurate and complete. Every field must have a valid value. If the exercise name seems invalid, suggest the closest real exercise name and analyze that instead.

Format as JSON:`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // COST OPTIMIZATION: Use Flash for exercise explanations
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            normalized_name: { type: Type.STRING },
            explanation: { type: Type.STRING },
            muscles_worked: { type: Type.ARRAY, items: { type: Type.STRING } },
            form_cue: { type: Type.STRING },
            common_mistake: { type: Type.STRING },
            equipment_required: { type: Type.ARRAY, items: { type: Type.STRING } },
            contraindications: { type: Type.ARRAY, items: { type: Type.STRING } },
            movement_pattern: { 
              type: Type.STRING,
              enum: ["squat", "hinge", "push_horizontal", "push_vertical", "pull_horizontal", "pull_vertical", "carry", "core", "mobility", "plyometric", "cardio", "unknown"]
            },
            exercise_tier: {
              type: Type.STRING,
              enum: ["S", "A", "B", "C"]
            },
            primary_category: {
              type: Type.STRING,
              enum: ["warmup", "main", "cooldown"]
            },
            injury_risk: {
              type: Type.STRING,
              enum: ["low", "moderate", "high"]
            },
            evidence_level: {
              type: Type.STRING,
              enum: ["high", "moderate", "low"]
            },
            minimum_experience_level: { type: Type.STRING },
          },
          required: [
            "normalized_name", "explanation", "muscles_worked", "form_cue", "common_mistake",
            "equipment_required", "contraindications", "movement_pattern", "exercise_tier",
            "primary_category", "injury_risk", "evidence_level", "minimum_experience_level"
          ],
        },
      },
    });

    const jsonString = response.text.trim();
    const parsed = JSON.parse(jsonString);
    
    // Validate and ensure all required fields are present and non-null
    if (!parsed.minimum_experience_level || typeof parsed.minimum_experience_level !== 'string') {
      // Smart default based on other fields
      let smartDefault = "beginner";
      if (parsed.injury_risk === "high" || parsed.exercise_tier === "S") {
        smartDefault = "advanced";
      } else if (parsed.injury_risk === "moderate" || parsed.movement_pattern === "plyometric") {
        smartDefault = "intermediate";
      }
      parsed.minimum_experience_level = smartDefault;
    }
    
    // Ensure normalized_name is valid
    if (!parsed.normalized_name || parsed.normalized_name.trim() === "") {
      parsed.normalized_name = exerciseName;
    }
    
    // Ensure equipment_required is an array with at least one item
    if (!Array.isArray(parsed.equipment_required) || parsed.equipment_required.length === 0) {
      parsed.equipment_required = ["bodyweight"];
    }
    
    return {
      explanation: parsed.explanation || `Exercise: ${parsed.normalized_name || exerciseName}`,
      muscles_worked: Array.isArray(parsed.muscles_worked) && parsed.muscles_worked.length > 0 
        ? parsed.muscles_worked 
        : ["multiple muscles"],
      form_cue: parsed.form_cue || "Maintain proper form throughout the movement",
      common_mistake: parsed.common_mistake || "Rushing through the movement without proper control",
      equipment_required: parsed.equipment_required,
      contraindications: Array.isArray(parsed.contraindications) ? parsed.contraindications : [],
      movement_pattern: parsed.movement_pattern || "unknown",
      exercise_tier: parsed.exercise_tier || "B",
      primary_category: parsed.primary_category || "main",
      injury_risk: parsed.injury_risk || "moderate",
      evidence_level: parsed.evidence_level || "moderate",
      minimum_experience_level: parsed.minimum_experience_level, // Already validated above
      normalized_name: parsed.normalized_name || exerciseName,
    };
  } catch (error: any) {
    throw handleApiError(error, 'explainExerciseDetailed');
  }
};

/**
 * Quick exercise explanation (for on-demand display)
 *
 * SECURITY: Now uses secure Convex action instead of client-side API call
 * API key stays server-side, never exposed to browser
 */
export const explainExercise = async (exerciseName: string, exerciseNotes?: string): Promise<string> => {
  try {
    // Call secure Convex action
    const result = await convex.action(api.ai.explainExercise, {
      exerciseName,
      exerciseNotes: exerciseNotes || undefined,
    });
    return result;
  } catch (error: any) {
    console.error('Exercise explanation failed:', error);
    throw new Error(`Failed to explain exercise: ${error.message}`);
  }
};

/**
 * Batch explain multiple exercises in a single API call (33% cost savings)
 * This is more efficient than calling explainExercise multiple times
 */
export async function batchExplainExercises(exerciseNames: string[]): Promise<Record<string, {
  explanation: string;
  muscles_worked: string[];
  form_cue: string;
  common_mistake: string;
}>> {
  if (exerciseNames.length === 0) {
    return {};
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a professional strength and conditioning coach. Provide concise explanations for these ${exerciseNames.length} exercises.

For each exercise, provide:
1. Brief explanation (2-3 sentences)
2. Primary muscles worked (array)
3. One key form cue
4. One common mistake to avoid

Exercises:
${exerciseNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

Return as JSON object with exercise names as keys:
{
  "exercise_name": {
    "explanation": "...",
    "muscles_worked": ["muscle1", "muscle2"],
    "form_cue": "...",
    "common_mistake": "..."
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      }
    });

    const text = response.text.trim();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }

    throw new Error('Failed to parse batch exercise response');
  } catch (error: any) {
    console.error('Batch explain exercises error:', error);
    throw handleApiError(error, 'batchExplainExercises');
  }
}

export const generateWeeklyProgression = async (plan: WorkoutPlan, logs: WorkoutLog[], feedback: 'too easy' | 'just right' | 'too hard'): Promise<WorkoutPlan> => {
    // This function would need a significant refactor to navigate the new block structure.
    // For now, we'll return the plan unmodified to prevent errors.
    console.warn("generateWeeklyProgression needs to be updated for the new WorkoutBlock architecture.");
    return plan;
}

/**
 * Validate that the user's question is workout-related
 * Less strict when there's ongoing conversation (allows short contextual responses)
 */
export function isWorkoutRelated(message: string, hasConversationHistory: boolean = false): boolean {
  const lowerMessage = message.toLowerCase();

  // If there's conversation history, allow shorter responses
  // (user might be answering AI's follow-up questions)
  if (hasConversationHistory && message.length < 50) {
    // Allow common short responses in workout context
    const contextualWords = [
      'yes', 'no', 'pain', 'hurt', 'sore', 'injury', 'shoulder', 'knee', 'back',
      'prefer', 'easier', 'harder', 'different', 'more', 'less', 'too',
      'equipment', 'barbell', 'dumbbell', 'bodyweight', 'machine',
      'time', 'tired', 'fatigue', 'busy', 'variation', 'swap', 'change'
    ];

    const hasContextualWord = contextualWords.some(word => lowerMessage.includes(word));
    if (hasContextualWord) {
      return true; // Valid contextual response
    }
  }

  // Original keyword check for new conversations
  const fitnessKeywords = [
    'workout', 'exercise', 'train', 'lift', 'rep', 'set', 'muscle',
    'strength', 'cardio', 'plan', 'routine', 'squat', 'bench', 'deadlift',
    'pull', 'push', 'leg', 'arm', 'chest', 'back', 'shoulder',
    'rest', 'recovery', 'form', 'technique', 'weight', 'rpe', 'intensity',
    'warm', 'cool', 'stretch', 'mobility', 'fitness', 'gym', 'program',
    'progression', 'volume', 'frequency', 'nutrition', 'protein', 'diet',
    'injury', 'pain', 'sore', 'fatigue', 'overtraining', 'superset', 'amrap',
    'core', 'abs', 'glute', 'quad', 'hamstring', 'bicep', 'tricep',
    'calorie', 'macros', 'hypertrophy', 'endurance', 'speed', 'agility',
    'plyometric', 'interval', 'hiit', 'circuit', 'tempo', 'pr', 'max',
    'swap', 'change', 'modify', 'adjust', 'add', 'remove' // Added action words
  ];

  const hasFitnessKeyword = fitnessKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );

  // Reject obvious off-topic patterns (only for longer messages)
  if (message.length > 10) {
    const offTopicPatterns = [
      /weather|forecast|temperature/i,
      /news|politics|election/i,
      /joke|funny|laugh|humor/i,
      /movie|film|tv show|series/i,
      /recipe|cook(?!.*workout)/i, // Allow "cooking a workout" but not recipes
      /stock|crypto|bitcoin|investment/i,
      /code|programming|debug|software/i,
      /what.*time|when.*open|where.*located/i,
      /tell me about|write.*story|poem/i
    ];

    const isOffTopic = offTopicPatterns.some(pattern => pattern.test(message));
    if (isOffTopic) {
      return false;
    }
  }

  return hasFitnessKeyword;
}

export const initializeChatSession = (plan: WorkoutPlan, dayOfWeek: number): Chat => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("API_KEY environment variable not set.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const substituteExerciseFn: FunctionDeclaration = {
        name: 'substituteExercise',
        description: 'Replace an exercise in a specific day with a new exercise and metrics.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                day_of_week: { type: Type.INTEGER, description: 'Target day: 1=Mon ... 7=Sun' },
                original_exercise_name: { type: Type.STRING, description: 'Exact name of the exercise to replace.' },
                new_exercise_name: { type: Type.STRING, description: 'Name of the new exercise.' },
                new_exercise_metrics_template: metricTemplateSchema,
                rpe: { type: Type.STRING, nullable: true, description: 'Optional RPE for the new exercise.' },
            },
            required: ['day_of_week','original_exercise_name','new_exercise_name','new_exercise_metrics_template']
        }
    };

    const addExerciseFn: FunctionDeclaration = {
        name: 'addExercise',
        description: 'Add a new single-exercise block to a specific day in the plan.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                day_of_week: { type: Type.INTEGER, description: 'Target day: 1=Mon ... 7=Sun' },
                category: { type: Type.STRING, description: "One of 'warmup' | 'main' | 'cooldown'" },
                new_exercise_name: { type: Type.STRING },
                new_exercise_metrics_template: metricTemplateSchema,
                rpe: { type: Type.STRING, nullable: true },
            },
            required: ['day_of_week','category','new_exercise_name','new_exercise_metrics_template']
        }
    };

    const modifyExerciseFn: FunctionDeclaration = {
        name: 'modifyExercise',
        description: 'Modify the sets, reps, rest period, or RPE of an existing exercise without replacing it.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                day_of_week: { type: Type.INTEGER, description: 'Target day: 1=Mon ... 7=Sun' },
                exercise_name: { type: Type.STRING, description: 'Exact name of the exercise to modify.' },
                new_sets: { type: Type.INTEGER, nullable: true, description: 'New number of sets (optional).' },
                new_reps: { type: Type.STRING, nullable: true, description: 'New rep range, e.g. "8-10" or "12" (optional).' },
                new_rest_period_s: { type: Type.INTEGER, nullable: true, description: 'New rest period in seconds (optional).' },
                new_rpe: { type: Type.STRING, nullable: true, description: 'New RPE target, e.g. "7-8" (optional).' },
            },
            required: ['day_of_week', 'exercise_name']
        }
    };

    const removeExerciseFn: FunctionDeclaration = {
        name: 'removeExercise',
        description: 'Remove an exercise from a specific day in the plan.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                day_of_week: { type: Type.INTEGER, description: 'Target day: 1=Mon ... 7=Sun' },
                exercise_name: { type: Type.STRING, description: 'Exact name of the exercise to remove.' },
            },
            required: ['day_of_week', 'exercise_name']
        }
    };

    const adjustDifficultyFn: FunctionDeclaration = {
        name: 'adjustDifficulty',
        description: 'Adjust the overall difficulty of a workout day by modifying multiple exercises. Use this when user says "make it harder", "make it easier", "too easy", "too hard", etc.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                day_of_week: { type: Type.INTEGER, description: 'Target day: 1=Mon ... 7=Sun' },
                direction: { type: Type.STRING, description: "'harder' or 'easier'" },
                method: { type: Type.STRING, description: "'volume' (more/fewer sets), 'intensity' (higher/lower RPE), 'complexity' (swap to harder/easier exercises), or 'all'" },
            },
            required: ['day_of_week', 'direction', 'method']
        }
    };

    const extendWorkoutFn: FunctionDeclaration = {
        name: 'extendWorkout',
        description: 'Add more exercises to make the workout longer. Use when user wants a longer session or more exercises.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                day_of_week: { type: Type.INTEGER, description: 'Target day: 1=Mon ... 7=Sun' },
                target_duration_minutes: { type: Type.INTEGER, nullable: true, description: 'Desired total workout duration in minutes (optional).' },
                num_exercises_to_add: { type: Type.INTEGER, nullable: true, description: 'Number of exercises to add (optional, default 2-3).' },
                focus_area: { type: Type.STRING, nullable: true, description: 'Specific muscle group or focus to add (optional).' },
            },
            required: ['day_of_week']
        }
    };

    const shortenWorkoutFn: FunctionDeclaration = {
        name: 'shortenWorkout',
        description: 'Suggest exercises to remove to make the workout shorter. Use when user has limited time.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                day_of_week: { type: Type.INTEGER, description: 'Target day: 1=Mon ... 7=Sun' },
                target_duration_minutes: { type: Type.INTEGER, nullable: true, description: 'Desired total workout duration in minutes (optional).' },
                num_exercises_to_remove: { type: Type.INTEGER, nullable: true, description: 'Number of exercises to remove (optional).' },
            },
            required: ['day_of_week']
        }
    };

    const swapDayFocusFn: FunctionDeclaration = {
        name: 'swapDayFocus',
        description: 'Swap the focus/workout between two days. Use when user wants to rearrange their weekly schedule.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                day_from: { type: Type.INTEGER, description: 'First day to swap: 1=Mon ... 7=Sun' },
                day_to: { type: Type.INTEGER, description: 'Second day to swap: 1=Mon ... 7=Sun' },
            },
            required: ['day_from', 'day_to']
        }
    };

    // NEW: Create a superset from multiple exercises
    const createSupersetFn: FunctionDeclaration = {
        name: 'createSuperset',
        description: 'Create a superset by grouping 2-4 exercises together to be performed back-to-back with no rest. Use when user wants exercises combined ("superset A and B", "pair these together", "combine into superset").',
        parameters: {
            type: Type.OBJECT,
            properties: {
                day_of_week: { type: Type.INTEGER, description: 'Target day: 1=Mon ... 7=Sun' },
                exercises: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            exercise_name: { type: Type.STRING, description: 'Name of exercise in the superset' },
                            metrics_template: metricTemplateSchema,
                            category: { type: Type.STRING, description: "One of 'warmup' | 'main' | 'cooldown'" },
                        },
                        required: ['exercise_name', 'metrics_template', 'category']
                    },
                    description: 'Array of 2-4 exercises to combine into a superset'
                },
                rounds: { type: Type.INTEGER, description: 'Number of times to repeat the superset (typically 3-4)' },
                rest_between_rounds: { type: Type.INTEGER, nullable: true, description: 'Rest time in seconds between superset rounds (optional, default 90)' },
            },
            required: ['day_of_week', 'exercises', 'rounds']
        }
    };

    const getDayName = (dayNum: number): string => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return days[dayNum - 1] || 'Unknown';
    };

    const formatPlanForContext = (plan: WorkoutPlan, dayOfWeek: number): string => {
        if (!plan.weeklyPlan || plan.weeklyPlan.length === 0) return 'No plan available';

        const today = plan.weeklyPlan.find(d => d.day_of_week === dayOfWeek);
        if (!today) return 'No workout scheduled for today';

        const exerciseCount = today.blocks?.reduce((sum, b) => sum + (b.exercises?.length || 0), 0) || 0;
        return `${today.focus} - ${exerciseCount} exercises in ${today.blocks?.length || 0} blocks`;
    };

    const currentLang = i18n.language || 'en';
    const languageInstruction = currentLang === 'de'
      ? 'IMPORTANT: Respond in German (Deutsch). All your responses must be in German.'
      : 'Respond in English.';

    const systemInstruction = `You are REBLD's AI workout coach. Your ONLY purpose is to help users with their workout plans and training.

${languageInstruction}

STRICT RULES - You MUST follow these:
1. ONLY answer questions about: workouts, exercises, training plans, fitness, nutrition related to training, recovery, form tips
2. REFUSE to answer: weather, news, jokes, general knowledge, coding, politics, etc.
3. If asked off-topic, respond: "I'm your workout coach! I can only help with training, exercises, and fitness questions. What would you like to know about your workout plan?"

CAPABILITIES (Use these function calls when appropriate):
1. **substituteExercise** - Swap one exercise for another (user says "replace X with Y", "different exercise")
2. **addExercise** - Add a new exercise (user says "add more", "include X")
3. **modifyExercise** - Change sets/reps/rest/RPE without swapping (user says "more sets", "less reps", "shorter rest")
4. **removeExercise** - Remove an exercise (user says "skip X", "remove", "take out")
5. **adjustDifficulty** - Make workout harder/easier (user says "make it harder", "too easy", "I want more challenge")
6. **extendWorkout** - Add more exercises for longer session (user says "longer workout", "more exercises", "I have extra time")
7. **shortenWorkout** - Suggest removals for shorter session (user says "short on time", "quick workout", "less exercises")
8. **swapDayFocus** - Swap workouts between days (user says "move leg day to Friday", "swap Monday and Wednesday")
9. **createSuperset** - Create a superset from 2-4 exercises (user says "superset these", "pair together", "combine into superset", "back to back")

ALSO PROVIDE:
- Form cues and technique tips
- Injury-safe alternatives
- Training advice and answers

CONTEXT:
Today is ${getDayName(dayOfWeek)}.
Current plan: ${plan.name}
${formatPlanForContext(plan, dayOfWeek)}

Schema: weeklyPlan[] has days with day_of_week (1..7), focus, and blocks.
Blocks: type single|superset|amrap, optional title, and exercises[].
Exercises: exercise_name, category (warmup|main|cooldown), optional rpe, and metrics_template.

**🧠 DATABASE INTELLIGENCE (Your Advantage Over Basic AI):**
- 700+ exercises with complete metadata
- Exercise tiers: S (fundamental), A (important), B (good), C (specialized)
- Movement patterns: squat, hinge, push/pull, core, mobility, cardio, plyometric
- Equipment requirements for every exercise
- Injury contraindications and safe modifications
- Sport-specific ratings (0-10) for 10 different sports
- Evidence levels (high/moderate/low research backing)
- Experience requirements (beginner/intermediate/advanced)

**🎯 EXERCISE SUBSTITUTION PROTOCOL:**
1. Ask WHY they want to swap (pain/preference/equipment/other)
2. **IMPORTANT: Use database intelligence:**
   - Pain → Filter out exercises with injury contraindications
   - Sport → Prioritize exercises with 8-10/10 sport ratings
   - Equipment → Match available equipment exactly
   - Preference → Same tier + movement pattern
3. **Explain your choice:** "I chose X because it has a 9/10 rating for your sport"
4. Call substituteExercise

**⚡ QUICK REFERENCE - TOP EXERCISES BY SPORT:**
HYROX: sled_push (10/10), wall_ball (10/10), farmers_carry (9/10)
Boxing: heavy_bag (10/10), medicine_ball_slam (9/10), core_rotation (9/10)
Rock Climbing: pull_up (10/10), finger_strength (10/10), antagonist_work (9/10)
Basketball: jump_training (9/10), single_leg_work (9/10), agility (8/10)

**🏥 INJURY SAFETY PRIORITIES:**
Knee pain → AVOID: deep squats, lunges, jumps
Lower back → AVOID: deadlifts, bent rows, overhead
Shoulder → AVOID: overhead press, dips, heavy pressing

RESPONSE RULES:
- Be concise (2-3 sentences max)
- Use fitness terminology correctly
- When suggesting exercise swaps, use the substituteExercise function
- When adding exercises, use the addExercise function
- Stay focused on the user's training goals

Remember: You are a WORKOUT COACH, not a general assistant.`;

    return ai.chats.create({
        model: 'gemini-2.5-flash', // Using Flash for cost optimization
        config: {
            systemInstruction,
            tools: [
                { functionDeclarations: [
                    substituteExerciseFn,
                    addExerciseFn,
                    modifyExerciseFn,
                    removeExerciseFn,
                    adjustDifficultyFn,
                    extendWorkoutFn,
                    shortenWorkoutFn,
                    swapDayFocusFn,
                    createSupersetFn
                ] }
            ],
        },
        history: plan?.weeklyPlan?.length
            ? [{
                role: 'user',
                parts: [
                    { text: 'Plan context: Focus by day' },
                    { text: (plan.weeklyPlan || []).map(d => `Day ${d.day_of_week}: ${d.focus}`).join('\n') }
                ]
            }]
            : [],
    });
}

export const analyzeTextSelection = async (selection: string, action: 'explain' | 'alternatives' | 'rephrase'): Promise<string> => {
    // This function is simple and doesn't rely on the plan structure, so it remains the same.
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("API_KEY environment variable not set.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const getAnalysisPrompt = (action: string, selection: string): string => {
        switch (action) {
            case 'explain': return `As an expert fitness coach, explain the following exercise in detail: "${selection}"`;
            case 'alternatives': return `As an expert fitness coach, suggest 2-3 alternative exercises for: "${selection}"`;
            case 'rephrase': return `Rephrase the following to be clearer and more motivating: "${selection}"`;
            default: return selection;
        }
    }
    const prompt = getAnalysisPrompt(action, selection);

    try {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt }); // COST OPTIMIZATION: Use Flash for text analysis
        return response.text;
    } catch (error) {
        throw handleApiError(error, 'analyzeTextSelection');
    }
};

// Simple, non-session fallback text generation for Chatbot.
// Useful if chat sessions fail; returns a single text response.
export const simpleGenerate = async (prompt: string, systemInstruction?: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("API_KEY environment variable not set.");
    }
    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // COST OPTIMIZATION: Use Flash for simple generation
            contents: prompt,
            config: systemInstruction ? { systemInstruction } : undefined,
        });
        return response.text;
    } catch (error) {
        throw handleApiError(error, 'simpleGenerate');
    }
};
