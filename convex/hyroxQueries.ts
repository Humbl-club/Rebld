/**
 * Hyrox-specific Queries
 *
 * Queries for Hyrox sport-specific plan generation, including:
 * - User profile transformation for prompt assembly
 * - Week summary retrieval for adaptation
 * - Previous week plan retrieval for station coverage validation
 * - Validation and generation metadata
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { normalizeExerciseName, categorizeExercise, type HyroxStation } from "./sportKnowledge/exerciseMappings";

// =============================================================================
// TYPES (matching assembleHyroxPrompt.ts UserProfile interface)
// =============================================================================

type RunningLevel = "beginner" | "intermediate" | "advanced";
type FiveKSource = "known" | "estimated" | "self_assessed";
type FiveKConfidence = "high" | "medium" | "low";
type Division = "open_men" | "open_women" | "pro_men" | "pro_women" | "doubles";
type GymType = "commercial" | "crossfit_box" | "hyrox_affiliate" | "home";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate running level from 5K time
 * - Beginner: > 30 min
 * - Intermediate: 23-30 min
 * - Advanced: < 23 min
 */
function calculateRunningLevel(fiveKMinutes: number): RunningLevel {
  if (fiveKMinutes > 30) return "beginner";
  if (fiveKMinutes > 23) return "intermediate";
  return "advanced";
}

/**
 * Calculate strength level from experience string
 */
function normalizeExperienceLevel(
  experience: string | undefined
): "beginner" | "intermediate" | "advanced" {
  if (!experience) return "intermediate";
  const lower = experience.toLowerCase();
  if (lower.includes("beginner") || lower.includes("novice")) return "beginner";
  if (lower.includes("advanced") || lower.includes("expert")) return "advanced";
  return "intermediate";
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get user's complete Hyrox profile for prompt assembly
 *
 * Transforms stored user data into the UserProfile format expected by
 * assembleHyroxPrompt.ts. Returns null if user doesn't have a Hyrox profile.
 */
export const getUserHyroxProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get user document
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      return null;
    }

    const prefs = user.trainingPreferences;
    if (!prefs) {
      return null;
    }

    const hyrox = prefs.hyrox_profile;
    if (!hyrox) {
      return null;
    }

    // Ensure we have a competition date (keep as ISO string for Convex serialization)
    const competitionDate = prefs.specific_goal?.target_date || null;

    if (!competitionDate) {
      // Hyrox profile exists but no competition date set
      // Return profile with null date - caller can handle this
    }

    // Transform to UserProfile format for assembleHyroxPrompt
    return {
      userId: args.userId,

      competition: {
        date: competitionDate,
        division: hyrox.division as Division,
        isFirstRace: hyrox.is_first_race,
        targetTimeMinutes: hyrox.target_time_minutes ?? undefined,
        previousBestTimeMinutes: hyrox.previous_best_minutes ?? undefined,
      },

      fitness: {
        runningLevel: calculateRunningLevel(hyrox.comfortable_5k_minutes),
        comfortable5kTimeMinutes: hyrox.comfortable_5k_minutes,
        weeklyRunningKm: hyrox.weekly_running_km,
        strengthLevel: normalizeExperienceLevel(prefs.experience_level),
        maxes: prefs.current_strength
          ? {
              benchPressKg: prefs.current_strength.bench_kg ?? undefined,
              backSquatKg: prefs.current_strength.squat_kg ?? undefined,
              deadliftKg: prefs.current_strength.deadlift_kg ?? undefined,
            }
          : undefined,
        trainingYears: prefs.training_age_years ?? undefined,
      },

      stations: {
        weak: hyrox.weak_stations,
        strong: hyrox.strong_stations,
        neverDone: hyrox.never_done_stations,
      },

      schedule: {
        trainingDays: parseTrainingDays(prefs.training_frequency),
        sessionLengthMinutes: parseSessionLength(prefs.preferred_session_length),
        canDoTwoADay: prefs.training_split?.sessions_per_day === "2",
      },

      constraints: {
        painPoints: prefs.pain_points,
      },

      equipment: {
        gymType: hyrox.gym_type as GymType,
        missingEquipment: hyrox.missing_equipment,
      },

      preferences: {
        additionalNotes: prefs.additional_notes ?? undefined,
      },

      // Metadata for UI display and confidence indicators
      _meta: {
        fiveKSource: hyrox.five_k_source as FiveKSource,
        fiveKConfidence: hyrox.five_k_confidence as FiveKConfidence,
        profileCreatedAt: hyrox.created_at,
        profileUpdatedAt: hyrox.updated_at,
      },
    };
  },
});

/**
 * Parse training frequency string to number
 */
function parseTrainingDays(frequency: string | undefined): 3 | 4 | 5 | 6 {
  if (!frequency) return 4;
  // Handle formats like "3-4", "4-5", "5+", or just "4"
  const match = frequency.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num <= 3) return 3;
    if (num >= 6) return 6;
    return num as 4 | 5;
  }
  return 4;
}

/**
 * Parse session length string to number
 */
function parseSessionLength(length: string | null | undefined): number {
  if (!length) return 60;
  const num = parseInt(length, 10);
  return isNaN(num) ? 60 : num;
}

/**
 * Get week summaries for a user's plan
 *
 * Used for week-over-week adaptation. Returns summaries ordered by week number.
 */
export const getWeekSummaries = query({
  args: {
    userId: v.string(),
    planId: v.optional(v.id("workoutPlans")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("weekSummary")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId));

    const summaries = await query.collect();

    // Filter by planId if provided
    let filtered = args.planId
      ? summaries.filter((s) => s.planId === args.planId)
      : summaries;

    // Sort by week number descending (most recent first)
    filtered.sort((a, b) => b.weekNumber - a.weekNumber);

    // Apply limit
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

/**
 * Get the most recent week summary for adaptation context
 *
 * Used when generating the next week's plan.
 */
export const getLatestWeekSummary = query({
  args: {
    userId: v.string(),
    planId: v.id("workoutPlans"),
  },
  handler: async (ctx, args) => {
    const summaries = await ctx.db
      .query("weekSummary")
      .withIndex("by_planId", (q) => q.eq("planId", args.planId))
      .collect();

    if (summaries.length === 0) {
      return null;
    }

    // Find the most recent by week number
    return summaries.reduce((latest, current) =>
      current.weekNumber > latest.weekNumber ? current : latest
    );
  },
});

/**
 * Check if user has completed Hyrox onboarding
 *
 * Returns true if user has a valid hyrox_profile with required fields.
 */
export const hasHyroxProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user?.trainingPreferences?.hyrox_profile) {
      return false;
    }

    const hyrox = user.trainingPreferences.hyrox_profile;

    // Check required fields are populated
    return (
      typeof hyrox.comfortable_5k_minutes === "number" &&
      typeof hyrox.weekly_running_km === "number" &&
      typeof hyrox.is_first_race === "boolean" &&
      hyrox.division !== undefined
    );
  },
});

/**
 * Compute adaptation signals from a week summary
 *
 * This is computed dynamically rather than stored, per the debate conclusion.
 * Returns signals that inform next week's generation.
 */
export const computeAdaptationSignals = query({
  args: {
    weekSummaryId: v.id("weekSummary"),
  },
  handler: async (ctx, args) => {
    const summary = await ctx.db.get(args.weekSummaryId);

    if (!summary) {
      return null;
    }

    const completionRate =
      summary.sessionsPlanned > 0
        ? (summary.sessionsCompleted / summary.sessionsPlanned) * 100
        : 100;

    const signals: {
      volumeAdjustment: "decrease" | "maintain" | "increase";
      reasons: string[];
      completionRate: number;
    } = {
      volumeAdjustment: "maintain",
      reasons: [],
      completionRate,
    };

    // Low completion rate -> decrease volume
    if (completionRate < 70) {
      signals.volumeAdjustment = "decrease";
      signals.reasons.push(
        `Low completion rate (${completionRate.toFixed(0)}%)`
      );
    }

    // User reported too hard -> decrease volume
    if (summary.overallFeeling === "too_hard") {
      signals.volumeAdjustment = "decrease";
      signals.reasons.push("User reported sessions were too hard");
    }

    // Perfect completion + too easy -> increase volume
    if (completionRate === 100 && summary.overallFeeling === "too_easy") {
      signals.volumeAdjustment = "increase";
      signals.reasons.push("Perfect completion with sessions feeling too easy");
    }

    // Check for running-specific missed days
    const runningDaysMissed = summary.sessionsMissed.filter((day) =>
      // Assuming Monday, Wednesday, Saturday are typical running days
      ["Monday", "Wednesday", "Saturday"].includes(day)
    );

    if (runningDaysMissed.length >= 2) {
      signals.reasons.push(
        `Missed ${runningDaysMissed.length} running-focused days`
      );
    }

    // Include user's freeform feedback if present
    if (summary.anythingToAdjust) {
      signals.reasons.push(`User feedback: "${summary.anythingToAdjust}"`);
    }

    return signals;
  },
});

// =============================================================================
// STATION COVERAGE HELPERS
// =============================================================================

/**
 * Extract Hyrox stations covered from a workout plan's exercises
 *
 * Parses all exercises in a plan and identifies which of the 8 Hyrox stations
 * were practiced. Used for first-timer cross-week validation.
 *
 * @param weeklyPlan - The weeklyPlan array from a workoutPlans document
 * @returns Array of unique HyroxStation identifiers found in the plan
 */
export function extractStationsCovered(weeklyPlan: any[]): HyroxStation[] {
  const stationsFound = new Set<HyroxStation>();

  if (!weeklyPlan || !Array.isArray(weeklyPlan)) {
    return [];
  }

  // Helper to process exercises from any block structure
  const processExercises = (exercises: any[]) => {
    if (!exercises || !Array.isArray(exercises)) return;

    for (const exercise of exercises) {
      const name = exercise.exercise_name || exercise.name;
      if (!name) continue;

      // Normalize and categorize the exercise
      const normalized = normalizeExerciseName(name);
      const category = categorizeExercise(normalized);

      // Check if it's a Hyrox station exercise
      if (category.type === 'station' && category.station) {
        stationsFound.add(category.station);
      }
    }
  };

  // Process each day in the plan
  for (const day of weeklyPlan) {
    // Handle single-session structure (blocks directly on day)
    if (day.blocks && Array.isArray(day.blocks)) {
      for (const block of day.blocks) {
        processExercises(block.exercises);
      }
    }

    // Handle 2x-daily structure (sessions array)
    if (day.sessions && Array.isArray(day.sessions)) {
      for (const session of day.sessions) {
        if (session.blocks && Array.isArray(session.blocks)) {
          for (const block of session.blocks) {
            processExercises(block.exercises);
          }
        }
      }
    }
  }

  return Array.from(stationsFound);
}

/**
 * Get previous week's plan for station coverage validation
 *
 * Used by generateHyroxPlan to fetch the previous week's training data
 * for first-timer cross-week station coverage validation.
 */
export const getPreviousWeekPlan = query({
  args: {
    userId: v.string(),
    planId: v.id("workoutPlans"),
    currentWeekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // For week 1, there is no previous week
    if (args.currentWeekNumber <= 1) {
      return null;
    }

    // Get the weekHistory for the previous week
    const previousWeekHistory = await ctx.db
      .query("weekHistory")
      .withIndex("by_userId_planId", (q) =>
        q.eq("userId", args.userId).eq("planId", args.planId)
      )
      .filter((q) => q.eq(q.field("weekNumber"), args.currentWeekNumber - 1))
      .first();

    if (previousWeekHistory?.weeklyPlan) {
      return {
        weekNumber: previousWeekHistory.weekNumber,
        weeklyPlan: previousWeekHistory.weeklyPlan,
        stationsCovered: extractStationsCovered(previousWeekHistory.weeklyPlan),
      };
    }

    // Fallback: If no weekHistory, check if this is week 2 and get current plan's weeklyPlan
    // (In case the plan was just created and week 1 is the current weeklyPlan)
    if (args.currentWeekNumber === 2) {
      const currentPlan = await ctx.db.get(args.planId);
      if (currentPlan?.weeklyPlan) {
        return {
          weekNumber: 1,
          weeklyPlan: currentPlan.weeklyPlan,
          stationsCovered: extractStationsCovered(currentPlan.weeklyPlan as any[]),
        };
      }
    }

    return null;
  },
});

/**
 * Get stations covered across multiple previous weeks
 *
 * Aggregates station coverage from week 1 through currentWeekNumber-1.
 * Used for first-timer validation which requires all 8 stations
 * to be covered by end of week 2.
 */
export const getPreviousWeeksStationsCovered = query({
  args: {
    userId: v.string(),
    planId: v.id("workoutPlans"),
    currentWeekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const allStations = new Set<HyroxStation>();

    // For week 1, no previous weeks exist
    if (args.currentWeekNumber <= 1) {
      return [];
    }

    // Get all weekHistory entries for this plan
    const weekHistories = await ctx.db
      .query("weekHistory")
      .withIndex("by_userId_planId", (q) =>
        q.eq("userId", args.userId).eq("planId", args.planId)
      )
      .collect();

    // Filter to weeks before current and extract stations
    for (const history of weekHistories) {
      if (history.weekNumber < args.currentWeekNumber && history.weeklyPlan) {
        const stations = extractStationsCovered(history.weeklyPlan);
        stations.forEach(s => allStations.add(s));
      }
    }

    // Edge case: Week 2 might need to check current plan's weeklyPlan as "week 1"
    if (args.currentWeekNumber === 2 && allStations.size === 0) {
      const currentPlan = await ctx.db.get(args.planId);
      if (currentPlan?.weeklyPlan) {
        const stations = extractStationsCovered(currentPlan.weeklyPlan as any[]);
        stations.forEach(s => allStations.add(s));
      }
    }

    return Array.from(allStations);
  },
});
