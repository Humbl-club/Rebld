/**
 * Phase 2 Background Enrichment Test
 *
 * Verifies that:
 * 1. exerciseCache is being populated
 * 2. New exercises trigger background enrichment
 * 3. All database tables are properly updated
 */

import { action, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════════════════
// CHECK EXERCISE CACHE STATUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get stats on exercise cache
 */
export const getExerciseCacheStats = query({
  args: {},
  handler: async (ctx) => {
    const exercises = await ctx.db.query("exerciseCache").collect();

    const withExplanation = exercises.filter(e => e.explanation);
    const withStepByStep = exercises.filter(e => e.step_by_step && e.step_by_step.length > 0);
    const withMuscles = exercises.filter(e => e.muscles_worked && e.muscles_worked.length > 0);

    // Get recent exercises (last 24h)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentExercises = exercises.filter(e =>
      e._creationTime && e._creationTime > oneDayAgo
    );

    return {
      total: exercises.length,
      withExplanation: withExplanation.length,
      withStepByStep: withStepByStep.length,
      withMuscles: withMuscles.length,
      recentlyAdded: recentExercises.length,
      sampleExercises: exercises.slice(0, 10).map(e => ({
        name: e.exerciseName,
        hasExplanation: !!e.explanation,
        hasSteps: !!(e.step_by_step && e.step_by_step.length > 0),
        hasMuscles: !!(e.muscles_worked && e.muscles_worked.length > 0),
      })),
    };
  },
});

/**
 * Check if specific exercises are cached
 */
export const checkExercisesCached = query({
  args: {
    exerciseNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results: { name: string; cached: boolean; hasExplanation: boolean }[] = [];

    for (const name of args.exerciseNames) {
      // Normalize name like the actual query does
      const normalizedName = name.toLowerCase().replace(/\s+/g, '_');

      const exercise = await ctx.db
        .query("exerciseCache")
        .withIndex("by_exerciseName", q => q.eq("exercise_name", normalizedName))
        .first();

      results.push({
        name,
        cached: !!exercise,
        hasExplanation: !!(exercise?.explanation),
      });
    }

    return {
      total: args.exerciseNames.length,
      cached: results.filter(r => r.cached).length,
      withExplanation: results.filter(r => r.hasExplanation).length,
      details: results,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL FLOW TEST (Generate + Save + Verify Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Test the full plan generation flow including Phase 2
 */
export const testFullFlow = action({
  args: {
    testUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const testUserId = args.testUserId || "test_phase2_user_" + Date.now();

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`FULL FLOW TEST (with Phase 2)`);
    console.log(`Test User: ${testUserId}`);
    console.log(`${'═'.repeat(60)}\n`);

    // Step 1: Generate plan with silver prompt
    console.log("▶ Step 1: Generating plan...");
    const startGen = Date.now();

    const generatedPlan = await ctx.runAction(api.ai.generateWorkoutPlan, {
      preferences: {
        primary_goal: "aesthetic",
        experience_level: "intermediate",
        training_frequency: "4-5",
        pain_points: [],
        preferred_session_length: "60",
        sex: "male",
        age: 30,
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    });

    const genTime = Date.now() - startGen;
    console.log(`  ✅ Plan generated in ${(genTime / 1000).toFixed(2)}s`);
    console.log(`  Plan name: ${generatedPlan.name}`);

    // Extract exercise names from the plan
    const exerciseNames = new Set<string>();
    for (const day of generatedPlan.weeklyPlan || []) {
      for (const block of day.blocks || []) {
        for (const ex of block.exercises || []) {
          if (ex.exercise_name) {
            exerciseNames.add(ex.exercise_name);
          }
        }
      }
    }
    console.log(`  Exercises in plan: ${exerciseNames.size}`);

    // Step 2: Check which exercises are already cached BEFORE saving
    console.log("\n▶ Step 2: Checking exercise cache (before save)...");
    const beforeSave = await ctx.runQuery(api.testPhase2.checkExercisesCached, {
      exerciseNames: Array.from(exerciseNames),
    });
    console.log(`  Already cached: ${beforeSave.cached}/${beforeSave.total}`);
    console.log(`  With explanations: ${beforeSave.withExplanation}/${beforeSave.total}`);

    // Step 3: Save the plan (triggers Phase 2)
    console.log("\n▶ Step 3: Saving plan (triggers Phase 2)...");
    const startSave = Date.now();

    // Normalize plan for Convex
    const normalizedPlan = {
      name: generatedPlan.name,
      weeklyPlan: generatedPlan.weeklyPlan.map((day: any) => ({
        day_of_week: day.day_of_week,
        focus: day.focus,
        estimated_duration: day.estimated_duration || 60,
        blocks: (day.blocks || []).map((block: any) => ({
          type: block.type || 'single',
          title: block.title || null,
          exercises: (block.exercises || []).map((ex: any) => ({
            exercise_name: ex.exercise_name,
            category: ex.category || 'main',
            metrics_template: ex.metrics_template,
            notes: ex.notes || null,
            original_exercise_name: ex.original_exercise_name || null,
            rpe: ex.rpe || null,
          })),
        })),
      })),
    };

    const saveResult = await ctx.runMutation(api.mutations.createWorkoutPlan, {
      userId: testUserId,
      name: normalizedPlan.name,
      weeklyPlan: normalizedPlan.weeklyPlan,
    });

    const saveTime = Date.now() - startSave;
    console.log(`  ✅ Plan saved in ${(saveTime / 1000).toFixed(2)}s`);
    console.log(`  Plan ID: ${saveResult.planId}`);
    console.log(`  New exercises added: ${saveResult.newExercisesAdded}`);

    // Step 4: Wait for Phase 2 (background job has 5s delay + processing time)
    console.log("\n▶ Step 4: Waiting for Phase 2 background job...");
    console.log("  (Phase 2 starts after 5s delay, then processes each exercise)");

    // Wait 10 seconds for Phase 2 to start
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check cache status
    const afterPhase2 = await ctx.runQuery(api.testPhase2.checkExercisesCached, {
      exerciseNames: Array.from(exerciseNames),
    });
    console.log(`  After Phase 2 start:`);
    console.log(`    Cached: ${afterPhase2.cached}/${afterPhase2.total}`);
    console.log(`    With explanations: ${afterPhase2.withExplanation}/${afterPhase2.total}`);

    // Step 5: Get overall cache stats
    console.log("\n▶ Step 5: Overall exercise cache stats...");
    const cacheStats = await ctx.runQuery(api.testPhase2.getExerciseCacheStats, {});
    console.log(`  Total exercises in cache: ${cacheStats.total}`);
    console.log(`  With explanations: ${cacheStats.withExplanation}`);
    console.log(`  With step-by-step: ${cacheStats.withStepByStep}`);
    console.log(`  Recently added (24h): ${cacheStats.recentlyAdded}`);

    // Step 6: Clean up test plan
    console.log("\n▶ Step 6: Cleaning up test plan...");
    await ctx.runMutation(api.mutations.deleteWorkoutPlan, {
      userId: testUserId,
      planId: saveResult.planId,
    });
    console.log("  ✅ Test plan deleted");

    // Summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`SUMMARY`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Plan generation: ${(genTime / 1000).toFixed(2)}s`);
    console.log(`Plan save: ${(saveTime / 1000).toFixed(2)}s`);
    console.log(`Exercises in plan: ${exerciseNames.size}`);
    console.log(`New exercises cached: ${afterPhase2.cached - beforeSave.cached}`);
    console.log(`Phase 2 triggered: ${saveResult.newExercisesAdded > 0 ? 'YES' : 'NO'}`);
    console.log(`${'═'.repeat(60)}\n`);

    return {
      success: true,
      genTimeMs: genTime,
      saveTimeMs: saveTime,
      exercisesInPlan: exerciseNames.size,
      cacheBeforeSave: beforeSave.cached,
      cacheAfterSave: afterPhase2.cached,
      newExercisesCached: afterPhase2.cached - beforeSave.cached,
      phase2Triggered: saveResult.newExercisesAdded > 0,
      overallCacheStats: cacheStats,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE TABLE STATS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Direct test of sportBuckets insertion (for debugging)
 */
export const testSportBucketInsert = mutation({
  args: {
    sport: v.string(),
    exerciseName: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const id = await ctx.db.insert("sportBuckets", {
        sport: args.sport,
        exercise_name: args.exerciseName,
        usage_count: 1,
        success_rate: 1.0,
        avg_performance_score: 70,
        typical_sets: 3,
        typical_reps: 10,
        typical_duration_s: null,
        typical_weight_ratio: null,
        placement_stats: {
          warmup_count: 0,
          main_count: 1,
          cooldown_count: 0,
        },
        last_updated: new Date().toISOString(),
        confidence_score: 0.5,
      });
      return { success: true, id: id.toString() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
});

/**
 * Get counts for all relevant tables
 */
export const getTableStats = query({
  args: {},
  handler: async (ctx) => {
    const tables: Record<string, number> = {};

    // Core tables
    tables.exerciseCache = (await ctx.db.query("exerciseCache").collect()).length;
    tables.workoutPlans = (await ctx.db.query("workoutPlans").collect()).length;
    tables.workoutLogs = (await ctx.db.query("workoutLogs").collect()).length;
    tables.users = (await ctx.db.query("users").collect()).length;

    // Knowledge tables
    tables.injuryProtocols = (await ctx.db.query("injuryProtocols").collect()).length;
    tables.sportGuidelines = (await ctx.db.query("sportGuidelines").collect()).length;
    tables.goalGuidelines = (await ctx.db.query("goalGuidelines").collect()).length;
    tables.exerciseModifications = (await ctx.db.query("exerciseModifications").collect()).length;

    // Sport bucket tables
    tables.sportBuckets = (await ctx.db.query("sportBuckets").collect()).length;
    tables.exercisePerformance = (await ctx.db.query("exercisePerformance").collect()).length;

    // Other tables
    tables.weekHistory = (await ctx.db.query("weekHistory").collect()).length;
    tables.healthMetrics = (await ctx.db.query("healthMetrics").collect()).length;

    return tables;
  },
});
