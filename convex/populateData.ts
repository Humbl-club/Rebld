/**
 * Data Population Utilities
 *
 * Utilities to populate database tables with evidence-based data
 * from our comprehensive rehab protocols, exercise modifications, etc.
 */

import { action, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { loggers } from "./utils/logger";
import { INJURY_PROTOCOLS } from "./rehab/injuryProtocolsData";

// ═══════════════════════════════════════════════════════════════
// INJURY PROTOCOLS POPULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Populate all injury protocols from our ATG/McGill-based data
 * This converts the TypeScript data into database records
 */
export const populateInjuryProtocols = action({
  args: {},
  handler: async (ctx) => {
    const results: { issue: string; success: boolean; error?: string }[] = [];

    for (const protocol of INJURY_PROTOCOLS) {
      try {
        // Convert to database format
        const exercises_to_avoid = protocol.exercises_to_avoid.map(e => ({
          exercise: e.exercise,
          reason: e.reason,
        }));

        const exercise_substitutions = protocol.safe_alternatives.map(a => ({
          original: a.avoid,
          replacement: a.use_instead,
          reason: a.reason,
        }));

        const prehab_exercises = protocol.rehab_exercises.map(e => ({
          exercise: e.exercise,
          category: e.category,
          priority: e.priority,
          sets: e.sets,
          reps: e.reps,
          notes: e.notes,
          evidence_level: e.evidence_level,
        }));

        await ctx.runMutation(api.mutations.saveInjuryProtocol, {
          issue: protocol.issue,
          book_source: "ATG (Knees Over Toes), McGill Method, Physical Therapy Research",
          exercises_to_avoid,
          exercise_substitutions,
          prehab_exercises,
          warning_signs: protocol.warning_signs,
          when_to_progress: protocol.when_to_progress,
          when_to_regress: protocol.when_to_regress,
        });

        results.push({ issue: protocol.issue, success: true });
        loggers.mutations.info(`Populated injury protocol: ${protocol.issue}`);
      } catch (error: any) {
        results.push({ issue: protocol.issue, success: false, error: error.message });
        loggers.mutations.error(`Failed to populate ${protocol.issue}:`, error.message);
      }
    }

    const successCount = results.filter(r => r.success).length;
    return {
      message: `Populated ${successCount}/${INJURY_PROTOCOLS.length} injury protocols`,
      results,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// EXERCISE CACHE POPULATION (After Plan Generation)
// ═══════════════════════════════════════════════════════════════

/**
 * Extract all exercise names from a workout plan
 */
function extractExerciseNames(plan: any): string[] {
  const exercises: Set<string> = new Set();

  if (!plan?.weeklyPlan) return [];

  for (const day of plan.weeklyPlan) {
    // Handle single session (blocks directly on day)
    if (day.blocks && Array.isArray(day.blocks)) {
      for (const block of day.blocks) {
        if (block.exercises && Array.isArray(block.exercises)) {
          for (const ex of block.exercises) {
            if (ex.exercise_name) {
              exercises.add(ex.exercise_name);
            }
          }
        }
      }
    }

    // Handle 2x daily (sessions array)
    if (day.sessions && Array.isArray(day.sessions)) {
      for (const session of day.sessions) {
        if (session.blocks && Array.isArray(session.blocks)) {
          for (const block of session.blocks) {
            if (block.exercises && Array.isArray(block.exercises)) {
              for (const ex of block.exercises) {
                if (ex.exercise_name) {
                  exercises.add(ex.exercise_name);
                }
              }
            }
          }
        }
      }
    }
  }

  return Array.from(exercises);
}

/**
 * Populate exercise cache entries for all exercises in a plan
 * This runs as a background job after plan generation
 */
export const populateExerciseCacheForPlan = action({
  args: {
    planId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the plan
    const plan = await ctx.runQuery(api.queries.getWorkoutPlan, { planId: args.planId });
    if (!plan) {
      return { success: false, error: "Plan not found" };
    }

    // Extract unique exercise names
    const exerciseNames = extractExerciseNames(plan);
    loggers.ai.info(`Found ${exerciseNames.length} unique exercises in plan`);

    // Check which exercises are already cached
    const uncachedExercises: string[] = [];
    for (const name of exerciseNames) {
      const cached = await ctx.runQuery(api.queries.getExerciseFromCache, { exerciseName: name });
      if (!cached) {
        uncachedExercises.push(name);
      }
    }

    if (uncachedExercises.length === 0) {
      return {
        success: true,
        message: "All exercises already cached",
        totalExercises: exerciseNames.length,
        newlyCached: 0,
      };
    }

    loggers.ai.info(`${uncachedExercises.length} exercises need caching`);

    // Schedule background population
    await ctx.scheduler.runAfter(0, internal.populateData.batchPopulateExercises, {
      exerciseNames: uncachedExercises,
      batchSize: 5,
      delayMs: 1500,
    });

    return {
      success: true,
      message: `Scheduled caching for ${uncachedExercises.length} exercises`,
      totalExercises: exerciseNames.length,
      newlyCached: uncachedExercises.length,
    };
  },
});

/**
 * Internal mutation to batch populate exercises (called by scheduler)
 */
export const batchPopulateExercises = internalMutation({
  args: {
    exerciseNames: v.array(v.string()),
    batchSize: v.number(),
    delayMs: v.number(),
  },
  handler: async (ctx, args) => {
    // This is just a scheduler - actual AI calls happen in the action
    // We schedule individual exercise population
    for (let i = 0; i < args.exerciseNames.length; i++) {
      const exerciseName = args.exerciseNames[i];
      const delay = i * args.delayMs;

      // Schedule each exercise with a delay
      await ctx.scheduler.runAfter(delay, internal.populateData.populateSingleExercise, {
        exerciseName,
      });
    }

    loggers.ai.info(`Scheduled ${args.exerciseNames.length} exercises for population`);
  },
});

/**
 * Populate a single exercise (internal action called by scheduler)
 */
export const populateSingleExercise = action({
  args: {
    exerciseName: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Check if already cached (race condition protection)
      const existing = await ctx.runQuery(api.queries.getExerciseFromCache, {
        exerciseName: args.exerciseName,
      });

      if (existing) {
        return { success: true, cached: true };
      }

      // Generate explanation using DeepSeek
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error("DeepSeek API key not configured");
      }

      const { createDeepSeekClient, generateJSONWithRetry } = await import("./utils/aiHelpers");
      const ai = createDeepSeekClient(apiKey);

      const prompt = `Exercise: "${args.exerciseName}"

Generate COMPLETE exercise data. Be concise but comprehensive.

JSON format:
{
  "explanation": "What this exercise does (1-2 sentences)",
  "muscles_worked": ["Primary", "Secondary"],
  "form_cue": "Key cue in 5-8 words",
  "common_mistake": "Mistake to avoid",
  "step_by_step": ["Setup", "Execute", "Return"],
  "exercise_role": "core" | "accessory" | "complementary" | "isolation" | "cardio" | "mobility",
  "movement_pattern": "squat" | "hinge" | "push_horizontal" | "push_vertical" | "pull_horizontal" | "pull_vertical" | "carry" | "core" | "mobility" | "plyometric" | "cardio",
  "exercise_tier": "S" | "A" | "B" | "C",
  "equipment_required": ["equipment1", "equipment2"],
  "minimum_experience_level": "beginner" | "intermediate" | "advanced",
  "injury_risk": "low" | "moderate" | "high"
}

RULES:
- S-tier = fundamental compounds (squat, bench, deadlift, row, OHP, pull-up)
- A-tier = important accessory (DB fly, leg curl, lat pulldown)
- B-tier = useful but optional
- C-tier = isolation finishers

Return ONLY valid JSON.`;

      const validateExercise = (data: any) => {
        const errors = [];
        if (!data.explanation) errors.push("Missing 'explanation'");
        if (!data.muscles_worked || !Array.isArray(data.muscles_worked)) errors.push("Missing 'muscles_worked'");
        return { valid: errors.length === 0, errors };
      };

      const data = await generateJSONWithRetry(
        ai.models,
        {
          model: "deepseek-chat",
          contents: prompt,
        },
        validateExercise,
        2
      ) as any;

      // Save to cache
      await ctx.runMutation(api.mutations.cacheExerciseExplanation, {
        exerciseName: args.exerciseName,
        explanation: data.explanation || '',
        muscles_worked: data.muscles_worked || [],
        form_cue: data.form_cue || null,
        common_mistake: data.common_mistake || null,
        step_by_step: data.step_by_step || [],
        source: "deepseek_api",
      });

      // Update additional fields if mutation supports it
      // (These may need to be added to cacheExerciseExplanation)

      loggers.ai.info(`Cached exercise: ${args.exerciseName}`);
      return { success: true, cached: false };
    } catch (error: any) {
      loggers.ai.error(`Failed to cache ${args.exerciseName}:`, error.message);
      return { success: false, error: error.message };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// EXERCISE MODIFICATIONS (Progressions/Regressions)
// ═══════════════════════════════════════════════════════════════

/**
 * Common exercise progressions/regressions
 */
export const EXERCISE_MODIFICATIONS: {
  base_exercise: string;
  category: string;
  progressions: string[];
  regressions: string[];
  modifications_for_injuries?: { injury: string; modification: string }[];
}[] = [
  // SQUAT PATTERN
  {
    base_exercise: "Back Squat",
    category: "lower_body_compound",
    regressions: ["Goblet Squat", "Box Squat", "Bodyweight Squat", "Wall Squat"],
    progressions: ["Front Squat", "Pause Squat", "Tempo Squat", "1.5 Rep Squat"],
    modifications_for_injuries: [
      { injury: "knee_pain", modification: "Box Squat to parallel, no bounce" },
      { injury: "lower_back_pain", modification: "Goblet Squat with elevated heels" },
    ],
  },
  {
    base_exercise: "Goblet Squat",
    category: "lower_body_compound",
    regressions: ["Bodyweight Squat", "Wall Squat", "Assisted Squat"],
    progressions: ["Back Squat", "Front Squat", "Dumbbell Squat"],
  },
  // HINGE PATTERN
  {
    base_exercise: "Deadlift",
    category: "lower_body_compound",
    regressions: ["Romanian Deadlift", "Trap Bar Deadlift", "Kettlebell Deadlift", "Hip Hinge Practice"],
    progressions: ["Deficit Deadlift", "Pause Deadlift", "Snatch Grip Deadlift"],
    modifications_for_injuries: [
      { injury: "lower_back_pain", modification: "Trap Bar Deadlift from blocks" },
    ],
  },
  {
    base_exercise: "Romanian Deadlift",
    category: "lower_body_compound",
    regressions: ["Good Morning (light)", "Hip Hinge with Band", "Single-Leg RDL (bodyweight)"],
    progressions: ["Stiff-Leg Deadlift", "Single-Leg RDL (loaded)", "Deficit RDL"],
  },
  // HORIZONTAL PUSH
  {
    base_exercise: "Bench Press",
    category: "upper_body_push",
    regressions: ["Push-ups", "Dumbbell Bench Press", "Machine Chest Press", "Floor Press"],
    progressions: ["Pause Bench Press", "Close-Grip Bench", "Incline Bench Press", "Tempo Bench"],
    modifications_for_injuries: [
      { injury: "shoulder_pain", modification: "Floor Press or Neutral-Grip DB Press" },
    ],
  },
  {
    base_exercise: "Push-ups",
    category: "upper_body_push",
    regressions: ["Incline Push-ups", "Knee Push-ups", "Wall Push-ups"],
    progressions: ["Decline Push-ups", "Diamond Push-ups", "Weighted Push-ups", "Archer Push-ups"],
  },
  // VERTICAL PUSH
  {
    base_exercise: "Overhead Press",
    category: "upper_body_push",
    regressions: ["Seated Dumbbell Press", "Landmine Press", "Cable Shoulder Press"],
    progressions: ["Push Press", "Z-Press", "Strict Press (heavier)", "Single-Arm Press"],
    modifications_for_injuries: [
      { injury: "shoulder_pain", modification: "Landmine Press in scapular plane" },
    ],
  },
  // HORIZONTAL PULL
  {
    base_exercise: "Barbell Row",
    category: "upper_body_pull",
    regressions: ["Dumbbell Row", "Cable Row", "Chest-Supported Row", "Inverted Row"],
    progressions: ["Pendlay Row", "Seal Row", "Heavy Dumbbell Row"],
    modifications_for_injuries: [
      { injury: "lower_back_pain", modification: "Chest-Supported Row" },
    ],
  },
  // VERTICAL PULL
  {
    base_exercise: "Pull-ups",
    category: "upper_body_pull",
    regressions: ["Lat Pulldown", "Assisted Pull-ups", "Negative Pull-ups", "Inverted Row"],
    progressions: ["Weighted Pull-ups", "L-Sit Pull-ups", "Archer Pull-ups", "Muscle-ups"],
  },
  {
    base_exercise: "Lat Pulldown",
    category: "upper_body_pull",
    regressions: ["Assisted Pull-up Machine", "Band Pulldowns"],
    progressions: ["Pull-ups", "Wide-Grip Pulldown", "Single-Arm Pulldown"],
  },
  // LUNGES
  {
    base_exercise: "Walking Lunges",
    category: "lower_body_unilateral",
    regressions: ["Reverse Lunges", "Static Lunges", "Split Squat"],
    progressions: ["Deficit Lunges", "Bulgarian Split Squat", "Weighted Walking Lunges"],
    modifications_for_injuries: [
      { injury: "knee_pain", modification: "Reverse Lunges (controlled)" },
    ],
  },
  {
    base_exercise: "Bulgarian Split Squat",
    category: "lower_body_unilateral",
    regressions: ["Split Squat", "Reverse Lunge", "Assisted Split Squat"],
    progressions: ["Weighted BSS", "Deficit BSS", "1.5 Rep BSS"],
  },
  // CORE
  {
    base_exercise: "Plank",
    category: "core",
    regressions: ["Knee Plank", "Incline Plank", "Dead Bug"],
    progressions: ["Long-Lever Plank", "Weighted Plank", "Plank with Arm Reach", "RKC Plank"],
  },
  {
    base_exercise: "Dead Bug",
    category: "core",
    regressions: ["Dead Bug (arms only)", "Dead Bug (legs only)", "90-90 Hold"],
    progressions: ["Dead Bug with Band", "Dead Bug with Weight", "Slower Tempo Dead Bug"],
  },
];

/**
 * Populate exercise modifications to database
 */
export const populateExerciseModifications = action({
  args: {},
  handler: async (ctx) => {
    const results: { exercise: string; success: boolean; error?: string }[] = [];

    for (const mod of EXERCISE_MODIFICATIONS) {
      try {
        await ctx.runMutation(internal.populateData.saveExerciseModification, {
          base_exercise: mod.base_exercise,
          category: mod.category,
          progressions: mod.progressions.map(p => ({ exercise: p, difficulty_increase: "moderate" })),
          regressions: mod.regressions.map(r => ({ exercise: r, difficulty_decrease: "moderate" })),
          modifications: mod.modifications_for_injuries?.map(m => ({
            injury: m.injury,
            modification: m.modification,
          })) || [],
        });

        results.push({ exercise: mod.base_exercise, success: true });
      } catch (error: any) {
        results.push({ exercise: mod.base_exercise, success: false, error: error.message });
      }
    }

    return {
      message: `Populated ${results.filter(r => r.success).length}/${EXERCISE_MODIFICATIONS.length} exercise modifications`,
      results,
    };
  },
});

/**
 * Internal mutation to save exercise modification
 */
export const saveExerciseModification = internalMutation({
  args: {
    base_exercise: v.string(),
    category: v.string(),
    progressions: v.array(v.any()),
    regressions: v.array(v.any()),
    modifications: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const normalized = args.base_exercise.toLowerCase().trim().replace(/\s+/g, "_");

    // Check if exists
    const existing = await ctx.db
      .query("exerciseModifications")
      .withIndex("by_exercise", (q) => q.eq("base_exercise", normalized))
      .first();

    const data = {
      base_exercise: normalized,
      book_source: "Evidence-Based Training Principles",
      category: args.category,
      progressions: args.progressions,
      regressions: args.regressions,
      modifications: args.modifications,
      equipment_alternatives: [],
      extracted_at: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("exerciseModifications", data);
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// KNOWLEDGE CACHE (Compressed Decision Trees)
// ═══════════════════════════════════════════════════════════════

/**
 * Knowledge cache entries for faster AI generation
 * These are pre-computed decision trees that the AI can reference
 */
export const KNOWLEDGE_CACHE_ENTRIES = [
  {
    key: "goal_strength_exercises",
    type: "exercise_selection",
    data: {
      priority_order: ["squat", "deadlift", "bench_press", "row", "overhead_press"],
      rep_range: "1-6",
      rest_period: "3-5 minutes",
      volume_per_session: "15-25 total sets",
      frequency: "each major lift 2x/week",
    },
  },
  {
    key: "goal_hypertrophy_exercises",
    type: "exercise_selection",
    data: {
      priority_order: ["compounds_first", "then_isolations"],
      rep_range: "6-12",
      rest_period: "60-90 seconds",
      volume_per_session: "20-30 total sets",
      frequency: "each muscle group 2x/week",
    },
  },
  {
    key: "goal_fat_loss_structure",
    type: "programming",
    data: {
      session_structure: "strength + cardio",
      strength_rep_range: "8-15",
      cardio_type: "Zone 2 steady state or HIIT",
      cardio_duration: "30-45 minutes",
      emphasis: "maintain muscle while cutting",
    },
  },
  {
    key: "experience_beginner_guidelines",
    type: "programming",
    data: {
      frequency: "3 days/week full body",
      progression: "linear (add weight weekly)",
      exercise_selection: "compound movements only",
      volume: "low (2-3 sets per exercise)",
      rest: "2-3 minutes between sets",
    },
  },
  {
    key: "experience_intermediate_guidelines",
    type: "programming",
    data: {
      frequency: "4-5 days/week",
      progression: "weekly or bi-weekly",
      exercise_selection: "compounds + accessories",
      volume: "moderate (3-4 sets per exercise)",
      rest: "1.5-3 minutes depending on exercise",
    },
  },
  {
    key: "experience_advanced_guidelines",
    type: "programming",
    data: {
      frequency: "5-6 days/week",
      progression: "monthly or periodized",
      exercise_selection: "compounds + accessories + isolations",
      volume: "high (4-6 sets per exercise)",
      techniques: "supersets, drop sets, tempo work",
    },
  },
];

/**
 * Populate knowledge cache for faster AI decisions
 */
export const populateKnowledgeCache = action({
  args: {},
  handler: async (ctx) => {
    let successCount = 0;

    for (const entry of KNOWLEDGE_CACHE_ENTRIES) {
      try {
        await ctx.runMutation(internal.populateData.saveKnowledgeCacheEntry, {
          key: entry.key,
          type: entry.type,
          data: entry.data,
        });
        successCount++;
      } catch (error: any) {
        loggers.mutations.error(`Failed to save knowledge cache ${entry.key}:`, error.message);
      }
    }

    return {
      message: `Populated ${successCount}/${KNOWLEDGE_CACHE_ENTRIES.length} knowledge cache entries`,
    };
  },
});

/**
 * Save knowledge cache entry
 */
export const saveKnowledgeCacheEntry = internalMutation({
  args: {
    key: v.string(),
    type: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    // Check if programmingKnowledge table can be used
    // For now, we'll store in a simple format
    await ctx.db.insert("programmingKnowledge", {
      book_title: "REBLD Knowledge Base",
      author: "AI Training System",
      category: "athletic" as const, // Use appropriate category
      principle_type: args.type === "exercise_selection" ? "exercise_selection" : "programming",
      title: args.key,
      description: JSON.stringify(args.data),
      applicable_goals: [],
      applicable_experience: [],
      extracted_at: new Date().toISOString(),
    });
  },
});

// ═══════════════════════════════════════════════════════════════
// MASTER POPULATION ACTION (Run all at once)
// ═══════════════════════════════════════════════════════════════

/**
 * Populate all database tables with evidence-based data
 * Run this once to seed the database
 */
export const populateAllData = action({
  args: {},
  handler: async (ctx) => {
    const results: { table: string; result: any }[] = [];

    // 1. Injury Protocols
    try {
      const injuryResult = await ctx.runAction(api.populateData.populateInjuryProtocols, {});
      results.push({ table: "injuryProtocols", result: injuryResult });
    } catch (error: any) {
      results.push({ table: "injuryProtocols", result: { error: error.message } });
    }

    // 2. Exercise Modifications
    try {
      const modResult = await ctx.runAction(api.populateData.populateExerciseModifications, {});
      results.push({ table: "exerciseModifications", result: modResult });
    } catch (error: any) {
      results.push({ table: "exerciseModifications", result: { error: error.message } });
    }

    // 3. Knowledge Cache
    try {
      const knowledgeResult = await ctx.runAction(api.populateData.populateKnowledgeCache, {});
      results.push({ table: "programmingKnowledge", result: knowledgeResult });
    } catch (error: any) {
      results.push({ table: "programmingKnowledge", result: { error: error.message } });
    }

    return {
      message: "Database population complete",
      results,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// PHASE 2: GENERATION-TIME ENRICHMENT (No Auth Required)
// These functions are called after plan generation to enrich the database
// We're spending AI tokens anyway, so we should maximize data collection
// ═══════════════════════════════════════════════════════════════

/**
 * Main enrichment function called from generateWorkoutPlan
 * Extracts exercises from generated plan and schedules background jobs
 * NO AUTH REQUIRED - runs at generation time
 */
export const enrichPlanOnGeneration = action({
  args: {
    plan: v.any(), // The generated workout plan
    sport: v.optional(v.string()),
    painPoints: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { plan, sport, painPoints } = args;

    if (!plan?.weeklyPlan) {
      return { success: false, error: "No plan to enrich" };
    }

    // Extract unique exercise names from the plan
    const exerciseNames = new Set<string>();
    const exerciseCategories: Record<string, string> = {};

    for (const day of plan.weeklyPlan) {
      // Handle single session (blocks directly on day)
      if (day.blocks && Array.isArray(day.blocks)) {
        for (const block of day.blocks) {
          if (block.exercises && Array.isArray(block.exercises)) {
            for (const ex of block.exercises) {
              if (ex.exercise_name) {
                exerciseNames.add(ex.exercise_name);
                exerciseCategories[ex.exercise_name] = ex.category || 'main';
              }
            }
          }
        }
      }
      // Handle 2-a-day sessions
      if (day.sessions && Array.isArray(day.sessions)) {
        for (const session of day.sessions) {
          if (session.blocks && Array.isArray(session.blocks)) {
            for (const block of session.blocks) {
              if (block.exercises && Array.isArray(block.exercises)) {
                for (const ex of block.exercises) {
                  if (ex.exercise_name) {
                    exerciseNames.add(ex.exercise_name);
                    exerciseCategories[ex.exercise_name] = ex.category || 'main';
                  }
                }
              }
            }
          }
        }
      }
    }

    const exerciseList = Array.from(exerciseNames);
    loggers.ai.info(`📊 Phase 2 Enrichment: Found ${exerciseList.length} unique exercises`);

    // 1. Check which exercises need caching
    const uncachedExercises: string[] = [];
    for (const name of exerciseList) {
      const cached = await ctx.runQuery(api.queries.getExerciseFromCache, { exerciseName: name });
      if (!cached) {
        uncachedExercises.push(name);
      }
    }

    loggers.ai.info(`📊 Phase 2: ${uncachedExercises.length} exercises need caching`);

    // 2. Schedule exercise caching (background job)
    if (uncachedExercises.length > 0) {
      await ctx.scheduler.runAfter(0, internal.populateData.batchPopulateExercises, {
        exerciseNames: uncachedExercises,
        batchSize: 5,
        delayMs: 1500,
      });
    }

    // 3. Populate sport buckets if sport is specified
    if (sport) {
      await ctx.scheduler.runAfter(1000, internal.populateData.populateSportBucketInternal, {
        sport,
        exercises: exerciseList.map(name => ({
          name,
          category: exerciseCategories[name] || 'main',
        })),
      });
    }

    return {
      success: true,
      totalExercises: exerciseList.length,
      newExercisesToCache: uncachedExercises.length,
      sport: sport || null,
    };
  },
});

/**
 * Internal mutation to populate sport buckets (no auth)
 */
export const populateSportBucketInternal = internalMutation({
  args: {
    sport: v.string(),
    exercises: v.array(v.object({
      name: v.string(),
      category: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const { sport, exercises } = args;

    for (const ex of exercises) {
      // Normalize exercise name
      const normalizedName = ex.name.toLowerCase().replace(/\s+/g, '_');

      // Check if already exists
      const existing = await ctx.db
        .query("sportBuckets")
        .filter(q =>
          q.and(
            q.eq(q.field("sport"), sport.toLowerCase()),
            q.eq(q.field("exercise_name"), normalizedName)
          )
        )
        .first();

      // Determine placement stats
      const isWarmup = ex.category === 'warmup';
      const isCooldown = ex.category === 'cooldown';
      const isMain = !isWarmup && !isCooldown;

      if (!existing) {
        await ctx.db.insert("sportBuckets", {
          sport: sport.toLowerCase(),
          exercise_name: normalizedName,
          // Performance tracking (defaults for new entries)
          usage_count: 1,
          success_rate: 1.0, // Assume success on first use
          avg_performance_score: 70, // Default mid-range score
          // Volume patterns (will be updated with actual data)
          typical_sets: 3,
          typical_reps: isMain ? 10 : null,
          typical_duration_s: isMain ? null : 60,
          typical_weight_ratio: null,
          // Placement stats
          placement_stats: {
            warmup_count: isWarmup ? 1 : 0,
            main_count: isMain ? 1 : 0,
            cooldown_count: isCooldown ? 1 : 0,
          },
          // Metadata (no user - system-generated)
          last_updated: new Date().toISOString(),
          confidence_score: 0.5, // Low confidence initially
        });
      } else {
        // Update usage count and placement stats
        const newPlacementStats = {
          warmup_count: existing.placement_stats.warmup_count + (isWarmup ? 1 : 0),
          main_count: existing.placement_stats.main_count + (isMain ? 1 : 0),
          cooldown_count: existing.placement_stats.cooldown_count + (isCooldown ? 1 : 0),
        };

        // Increase confidence with more data points
        const newConfidence = Math.min(1.0, existing.confidence_score + 0.1);

        await ctx.db.patch(existing._id, {
          usage_count: existing.usage_count + 1,
          placement_stats: newPlacementStats,
          last_updated: new Date().toISOString(),
          confidence_score: newConfidence,
        });
      }
    }

    loggers.mutations.info(`📊 Sport bucket populated: ${exercises.length} exercises for ${sport}`);
  },
});

// ═══════════════════════════════════════════════════════════════
// BATCH JOB: POPULATE STEP-BY-STEP FOR EXISTING EXERCISES
// ═══════════════════════════════════════════════════════════════

/**
 * Find exercises missing step_by_step and populate them
 * Can be run manually or scheduled
 */
export const batchPopulateStepByStep = action({
  args: {
    limit: v.optional(v.number()), // Max exercises to process (default 50)
    delayMs: v.optional(v.number()), // Delay between API calls (default 2000)
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const delayMs = args.delayMs || 2000;

    // Find exercises without step_by_step
    const allExercises = await ctx.runQuery(api.queries.getAllExercisesNoPagination, {});

    const needsStepByStep = allExercises.filter(ex =>
      !ex.step_by_step || ex.step_by_step.length === 0
    );

    const toProcess = needsStepByStep.slice(0, limit);

    loggers.ai.info(`📊 Step-by-step batch: ${needsStepByStep.length} exercises need processing, processing ${toProcess.length}`);

    // Schedule individual processing
    for (let i = 0; i < toProcess.length; i++) {
      const ex = toProcess[i];
      const delay = i * delayMs;

      await ctx.scheduler.runAfter(delay, internal.populateData.populateStepByStepSingle, {
        exerciseName: ex.exercise_name || ex.exerciseName,
        exerciseId: ex._id,
      });
    }

    return {
      success: true,
      totalNeedingStepByStep: needsStepByStep.length,
      scheduled: toProcess.length,
      estimatedTimeMinutes: Math.ceil((toProcess.length * delayMs) / 60000),
    };
  },
});

/**
 * Internal action to populate step_by_step for a single exercise
 */
export const populateStepByStepSingle = action({
  args: {
    exerciseName: v.string(),
    exerciseId: v.id("exerciseCache"),
  },
  handler: async (ctx, args) => {
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error("DeepSeek API key not configured");
      }

      const { createDeepSeekClient, generateJSONWithRetry } = await import("./utils/aiHelpers");
      const ai = createDeepSeekClient(apiKey);

      const prompt = `Exercise: "${args.exerciseName}"

Generate step-by-step instructions for performing this exercise.

JSON format:
{
  "step_by_step": [
    "Step 1: Setup position description",
    "Step 2: Movement initiation",
    "Step 3: Execution phase",
    "Step 4: Return to start"
  ]
}

RULES:
- 3-5 steps maximum
- Each step should be 5-12 words
- Focus on form, not muscles worked
- Be specific and actionable
- Start each step with an action verb

Return ONLY valid JSON.`;

      const validate = (data: any) => {
        const errors = [];
        if (!data.step_by_step || !Array.isArray(data.step_by_step)) {
          errors.push("Missing step_by_step array");
        } else if (data.step_by_step.length < 2) {
          errors.push("Need at least 2 steps");
        }
        return { valid: errors.length === 0, errors };
      };

      const result = await generateJSONWithRetry(
        ai.models,
        {
          model: "deepseek-chat",
          contents: prompt,
        },
        validate,
        2
      ) as { step_by_step: string[] };

      // Update the exercise with step_by_step
      await ctx.runMutation(api.mutations.updateExerciseStepByStep, {
        exerciseId: args.exerciseId,
        step_by_step: result.step_by_step,
      });

      loggers.ai.info(`✅ Step-by-step added for: ${args.exerciseName}`);
      return { success: true, exerciseName: args.exerciseName };
    } catch (error: any) {
      loggers.ai.error(`❌ Failed step-by-step for ${args.exerciseName}:`, error.message);
      return { success: false, error: error.message };
    }
  },
});
