/**
 * Hyrox Integration Test
 *
 * Quick smoke test for generateHyroxPlan action.
 * Creates a mock Hyrox profile and runs generation.
 */

import { mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Seed a test user with Hyrox profile
 */
export const seedTestHyroxUser = mutation({
  args: {},
  handler: async (ctx) => {
    const testUserId = "hyrox-test-user";

    // Check if test user exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", testUserId))
      .first();

    if (existing) {
      // Update with Hyrox profile
      const now = new Date().toISOString();
      const existingPrefs = existing.trainingPreferences || {};
      await ctx.db.patch(existing._id, {
        trainingPreferences: {
          ...existingPrefs,
          experience_level: "intermediate",
          training_frequency: "4",
          preferred_session_length: "60",
          primary_goal: "event_prep",
          pain_points: (existingPrefs as any).pain_points || [],
          sport: "hyrox",
          sport_specific: null,
          goal_explanation: null,
          additional_notes: null,
          last_updated: now,
          specific_goal: {
            target_date: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString(),
            event_name: "Test Hyrox Race",
            event_type: "hyrox",
            current_readiness: null,
            description: null,
          },
          hyrox_profile: {
            division: "open_men",
            is_first_race: true,
            comfortable_5k_minutes: 25,
            weekly_running_km: 20,
            running_experience: "1_2_years",
            five_k_source: "self_assessed",
            five_k_confidence: "medium",
            gym_type: "commercial",
            weak_stations: ["sled_push", "wall_balls"],
            strong_stations: ["rowing"],
            never_done_stations: ["skierg"],
            missing_equipment: [],
            created_at: now,
            updated_at: now,
          },
        },
      });
      return { userId: testUserId, action: "updated" };
    }

    // Create new test user with all required schema fields
    const now = new Date().toISOString();
    await ctx.db.insert("users", {
      userId: testUserId,
      activePlanId: null,
      bodyMetrics: null,
      goals: null,
      lastProgressionApplied: null,
      trainingPreferences: {
        experience_level: "intermediate",
        training_frequency: "4",
        preferred_session_length: "60",
        primary_goal: "event_prep",
        pain_points: [],
        sport: "hyrox",
        sport_specific: null,
        goal_explanation: null,
        additional_notes: null,
        last_updated: now,
        specific_goal: {
          target_date: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString(),
          event_name: "Test Hyrox Race",
          event_type: "hyrox",
          current_readiness: null,
          description: null,
        },
        hyrox_profile: {
          division: "open_men",
          is_first_race: true,
          comfortable_5k_minutes: 25,
          weekly_running_km: 20,
          running_experience: "1_2_years",
          five_k_source: "self_assessed",
          five_k_confidence: "medium",
          gym_type: "commercial",
          weak_stations: ["sled_push", "wall_balls"],
          strong_stations: ["rowing"],
          never_done_stations: ["skierg"],
          missing_equipment: [],
          created_at: now,
          updated_at: now,
        },
      },
    });

    return { userId: testUserId, action: "created" };
  },
});

/**
 * Run full Hyrox generation test
 */
export const runHyroxTest = action({
  args: {
    useReasoner: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const testUserId = "hyrox-test-user";

    // Step 1: Check readiness
    const readiness = await ctx.runAction(api.hyroxActions.checkGenerationReadiness, {
      userId: testUserId,
    });

    if (!readiness.ready) {
      return {
        success: false,
        step: "readiness_check",
        error: readiness.reason,
        suggestion: readiness.action,
      };
    }

    // Step 2: Generate plan
    const result = await ctx.runAction(api.hyroxActions.generateHyroxPlan, {
      userId: testUserId,
      weekNumber: 1,
      forceModel: args.useReasoner ? "reasoner" : "chat",
    });

    return {
      success: result.success,
      step: "generation",
      metadata: result.metadata,
      validation: result.validation,
      conflicts: result.conflicts,
      error: result.error,
      // Include FULL plan for debugging
      plan: result.plan,
      // Also include summary
      planSummary: result.plan ? {
        weekNumber: result.plan.week_number,
        phase: result.plan.phase,
        focus: result.plan.focus,
        daysCount: result.plan.days?.length,
        weeklyTotals: result.plan.weekly_totals,
      } : null,
    };
  },
});

/**
 * Debug running volume extraction
 */
export const debugRunningExtraction = action({
  args: {},
  handler: async () => {
    const { categorizeExercise, extractRunningVolumeKm } = await import("./sportKnowledge/exerciseMappings");

    const exercises = [
      { name: "Easy Run", distance_km: 6, sets: null },
      { name: "1km Intervals", distance_km: 1, sets: 6 },
      { name: "Long Run", distance_km: 12, sets: null },
    ];

    return exercises.map(ex => {
      const sets = ex.sets || 1;
      const baseVolume = extractRunningVolumeKm({
        name: ex.name,
        metrics_template: {
          target_distance_km: ex.distance_km,
        },
      });
      return {
        name: ex.name,
        distance_km: ex.distance_km,
        sets: ex.sets,
        effectiveSets: sets,
        baseVolume,
        totalVolume: baseVolume * sets,
        category: categorizeExercise(ex.name),
      };
    });
  },
});

/**
 * Test exercise categorization with debug info
 */
export const testCategorization = action({
  args: {},
  handler: async () => {
    // Import dynamically since we're in an action
    const { categorizeExercise, extractRunningVolumeKm, normalizeExerciseName } = await import("./sportKnowledge/exerciseMappings");

    const testCases = [
      "Easy Run",
      "1km Intervals",
      "Long Run",
      "SkiErg",
      "Rowing",
    ];

    // Also check if the distancePatterns logic works
    const name = "1km intervals";
    const distancePatterns = ['1km', '800m', '400m', '200m', '5km', '10km', '15km', '20km'];
    const hasDistancePattern = distancePatterns.some(p => name.includes(p));

    return {
      debugInfo: {
        testName: "1km intervals",
        normalized: normalizeExerciseName("1km Intervals"),
        hasDistancePattern,
        includes1km: name.includes('1km'),
      },
      results: testCases.map(n => ({
        name: n,
        normalized: normalizeExerciseName(n),
        category: categorizeExercise(n),
        runningKm: extractRunningVolumeKm({
          name: n,
          metrics_template: { target_distance_km: 1 },
        }),
      })),
    };
  },
});

/**
 * Debug: Call validateAndFix (the full flow) with test plan
 */
export const debugValidateAndFix = action({
  args: {},
  handler: async () => {
    const { validateAndFix } = await import("./sportKnowledge/validateHyroxPlan");

    // Exact plan structure matching LLM output (with explicit null values)
    const testPlan = {
      week_number: 1,
      phase: "BUILD" as const,
      focus: "Race-specific intervals and station familiarization",
      days: [
        {
          day_number: 1,
          day_name: "Monday",
          session_type: "Easy Run + Station Familiarization",
          duration_minutes: 68,
          exercises: [
            { name: "Easy Run", distance_km: 8, distance_m: null, sets: null, reps: null, notes: "Zone 2" },
            { name: "SkiErg", distance_km: null, distance_m: 500, sets: 3, reps: null, rest_seconds: 90 },
            { name: "Wall Balls", distance_km: null, distance_m: null, sets: 3, reps: 15, rest_seconds: 60 },
            { name: "Sled Push Practice", distance_km: null, distance_m: 25, sets: 3, reps: null, rest_seconds: 60 },
          ],
        },
        {
          day_number: 2,
          day_name: "Wednesday",
          session_type: "Interval Run + Station Circuit",
          duration_minutes: 60,
          exercises: [
            { name: "1km Intervals", distance_km: 1, distance_m: null, sets: 6, reps: null, rest_seconds: 90, notes: "Race pace" },
            { name: "Sled Push", distance_km: null, distance_m: 25, sets: 2, reps: null, rest_seconds: 120 },
            { name: "Farmers Carry", distance_km: null, distance_m: 100, sets: 2, reps: null, rest_seconds: 90 },
          ],
        },
        {
          day_number: 3,
          day_name: "Friday",
          session_type: "Strength + Station Practice",
          duration_minutes: 60,
          exercises: [
            { name: "Deadlift", distance_km: null, distance_m: null, sets: 3, reps: 5, rest_seconds: 120 },
            { name: "Back Squat", distance_km: null, distance_m: null, sets: 3, reps: 5, rest_seconds: 120, notes: "threshold" },
            { name: "Bent Over Row", distance_km: null, distance_m: null, sets: 3, reps: 5, rest_seconds: 90 },
            { name: "Sled Pull", distance_km: null, distance_m: 25, sets: 2, reps: null, rest_seconds: 90 },
            { name: "Burpee Broad Jump", distance_km: null, distance_m: 20, sets: 2, reps: null, rest_seconds: 60 },
          ],
        },
        {
          day_number: 4,
          day_name: "Sunday",
          session_type: "Long Run + Station Finish",
          duration_minutes: 60,
          exercises: [
            { name: "Long Run", distance_km: 10, distance_m: null, sets: null, reps: null, notes: "Zone 2" },
            { name: "Rowing", distance_km: null, distance_m: 500, sets: 2, reps: null, rest_seconds: 60 },
            { name: "Sandbag Lunges", distance_km: null, distance_m: 50, sets: 2, reps: null, rest_seconds: 90 },
            { name: "Wall Balls", distance_km: null, distance_m: null, sets: 2, reps: 20, rest_seconds: 60 },
          ],
        },
      ],
      weekly_totals: {
        running_km: 24,
        skierg_m: 1500,
        rowing_m: 1000,
        strength_sessions: 1,
        total_hours: 4,
      },
    };

    const constraints = {
      volumeTargets: {
        weeklyRunning: { min: 24, max: 50 },
        weeklySkiErg: { min: 2000, max: 6000 },
        weeklyRowing: { min: 2000, max: 6000 },
        strengthSessions: { min: 2, max: 4 },
        totalTrainingHours: { min: 5, max: 12 },
      },
      trainingDays: 4,
      sessionLengthMinutes: 60,
      weakStations: ["sled_push", "wall_balls"],
      experienceLevel: "intermediate" as const,
      isFirstRace: true,
      weekNumber: 1,
    };

    const result = validateAndFix(testPlan, constraints);

    return {
      success: result.success,
      validationResult: result.validationResult,
      error: result.error,
    };
  },
});

/**
 * Debug: Call validateHyroxPlan directly with test plan
 */
export const debugValidateDirectly = action({
  args: {},
  handler: async () => {
    const { validateHyroxPlan } = await import("./sportKnowledge/validateHyroxPlan");

    // Exact plan structure from the last test
    const testPlan = {
      week_number: 1,
      phase: "BUILD" as const,
      focus: "Race-specific intervals and station familiarization",
      days: [
        {
          day_number: 1,
          day_name: "Monday",
          session_type: "Easy Run + Station Familiarization",
          duration_minutes: 68,
          exercises: [
            { name: "Easy Run", distance_km: 8, notes: "Zone 2" },
            { name: "SkiErg", distance_m: 500, sets: 3, rest_seconds: 90 },
            { name: "Wall Balls", reps: 15, sets: 3, rest_seconds: 60 },
            { name: "Sled Push Practice", distance_m: 25, sets: 3, rest_seconds: 60 },
          ],
        },
        {
          day_number: 2,
          day_name: "Wednesday",
          session_type: "Interval Run + Station Circuit",
          duration_minutes: 60,
          exercises: [
            { name: "1km Intervals", distance_km: 1, sets: 6, rest_seconds: 90, notes: "Race pace" },
            { name: "Sled Push", distance_m: 25, sets: 2, rest_seconds: 120 },
            { name: "Farmers Carry", distance_m: 100, sets: 2, rest_seconds: 90 },
          ],
        },
        {
          day_number: 3,
          day_name: "Friday",
          session_type: "Recovery/Easy Strength + Station Practice",
          duration_minutes: 60,
          exercises: [
            { name: "Deadlift", reps: 5, sets: 3, rest_seconds: 120 },
            { name: "Back Squat", reps: 5, sets: 3, rest_seconds: 120 },
            { name: "Bent Over Row", reps: 5, sets: 3, rest_seconds: 90 },
            { name: "Sled Pull", distance_m: 25, sets: 2, rest_seconds: 90 },
            { name: "Burpee Broad Jump", distance_m: 20, sets: 2, rest_seconds: 60 },
          ],
        },
        {
          day_number: 4,
          day_name: "Sunday",
          session_type: "Long Run + Station Finish",
          duration_minutes: 60,
          exercises: [
            { name: "Long Run", distance_km: 10, notes: "Zone 2" },
            { name: "Rowing", distance_m: 500, sets: 2, rest_seconds: 60 },
            { name: "Sandbag Lunges", distance_m: 50, sets: 2, rest_seconds: 90 },
            { name: "Wall Balls", reps: 20, sets: 2, rest_seconds: 60 },
          ],
        },
      ],
      weekly_totals: {
        running_km: 24,
        skierg_m: 1500,
        rowing_m: 1000,
        strength_sessions: 1,
        total_hours: 4,
      },
    };

    const constraints = {
      volumeTargets: {
        weeklyRunning: { min: 24, max: 50 },
        weeklySkiErg: { min: 2000, max: 6000 },
        weeklyRowing: { min: 2000, max: 6000 },
        strengthSessions: { min: 2, max: 4 },
        totalTrainingHours: { min: 5, max: 12 },
      },
      trainingDays: 4,
      sessionLengthMinutes: 60,
      weakStations: ["sled_push", "wall_balls"],
      experienceLevel: "intermediate" as const,
      isFirstRace: true,
      weekNumber: 1,
    };

    const result = validateHyroxPlan(testPlan, constraints);

    return {
      valid: result.valid,
      score: result.score,
      calculatedVolumes: result.calculatedVolumes,
      issues: result.issues,
    };
  },
});

/**
 * Debug validation volume calculation with exact plan data
 */
export const debugValidationVolume = action({
  args: {},
  handler: async () => {
    const { categorizeExercise, extractRunningVolumeKm } = await import("./sportKnowledge/exerciseMappings");

    // Exact exercises from the last generated plan
    const planExercises = [
      // Day 1
      { name: "Easy Run", distance_km: 8 },
      { name: "SkiErg", distance_m: 500, sets: 3 },
      { name: "Wall Balls", reps: 15, sets: 3 },
      { name: "Sled Push Practice", distance_m: 25, sets: 3 },
      // Day 2
      { name: "1km Intervals", distance_km: 1, sets: 6 },
      { name: "Sled Push", distance_m: 25, sets: 2 },
      { name: "Farmers Carry", distance_m: 100, sets: 2 },
      // Day 3
      { name: "Deadlift", reps: 5, sets: 3 },
      { name: "Back Squat", reps: 5, sets: 3 },
      { name: "Bent Over Row", reps: 5, sets: 3 },
      { name: "Sled Pull", distance_m: 25, sets: 2 },
      { name: "Burpee Broad Jump", distance_m: 20, sets: 2 },
      // Day 4
      { name: "Long Run", distance_km: 10 },
      { name: "Rowing", distance_m: 500, sets: 2 },
      { name: "Sandbag Lunges", distance_m: 50, sets: 2 },
      { name: "Wall Balls", reps: 20, sets: 2 },
    ];

    // Calculate running volume exactly like validation does
    const runningDetails = planExercises.map(ex => {
      const category = categorizeExercise(ex.name);
      const sets = ex.sets || 1;
      const baseVolume = extractRunningVolumeKm({
        name: ex.name,
        metrics_template: {
          target_distance_km: ex.distance_km,
          target_distance_m: ex.distance_m,
        },
      });
      return {
        name: ex.name,
        category: category.type,
        subtype: (category as any).subtype,
        distance_km: ex.distance_km,
        distance_m: ex.distance_m,
        sets: ex.sets,
        baseVolume,
        contribution: baseVolume * sets,
      };
    });

    const totalRunningKm = runningDetails.reduce((sum, ex) => sum + ex.contribution, 0);
    const runningExercises = runningDetails.filter(ex => ex.contribution > 0);

    return {
      totalRunningKm,
      runningExercises,
      allExercises: runningDetails,
    };
  },
});

/**
 * Cleanup test user
 */
export const cleanupTestHyroxUser = mutation({
  args: {},
  handler: async (ctx) => {
    const testUserId = "hyrox-test-user";

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", testUserId))
      .first();

    if (user) {
      await ctx.db.delete(user._id);
      return { deleted: true };
    }

    return { deleted: false, reason: "User not found" };
  },
});
