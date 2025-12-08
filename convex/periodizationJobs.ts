/**
 * Periodization Background Jobs
 *
 * Handles automatic weekly plan generation for users with periodized plans.
 * These jobs run in the background so users don't have to wait.
 *
 * ROBUSTNESS FEATURES:
 * 1. Generation locks prevent duplicate generations
 * 2. Previous week context passed to AI for proper progression
 * 3. Phase transitions handled explicitly
 * 4. Missed weeks handled (generates one week at a time, catches up)
 * 5. Failed generations are tracked and can be retried
 *
 * Flow:
 * 1. Scheduled job runs (Monday 5AM UTC or daily check)
 * 2. Find all plans that need next week generated
 * 3. Check for existing lock - skip if already in progress
 * 4. Create lock, queue generation
 * 5. AI generates next week based on:
 *    - Current phase (BASE/BUILD/PEAK/TAPER)
 *    - Previous week's plan (for progression)
 *    - Deload status
 * 6. Update plan, release lock
 */

import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { loggers } from "./utils/logger";
import {
  calculateCurrentWeek,
  advanceToNextWeek,
  getPeriodizationInfo,
  isDeloadWeek,
  PHASE_CHARACTERISTICS,
  PeriodizationPhase,
} from "./utils/periodization";

// Lock expiry time in milliseconds (30 minutes - generation shouldn't take longer)
const LOCK_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Check if a generation lock exists and is still valid
 */
export const checkGenerationLock = internalQuery({
  args: {
    planId: v.id("workoutPlans"),
    targetWeek: v.number(),
  },
  handler: async (ctx, args) => {
    const lock = await ctx.db
      .query("generationLocks")
      .withIndex("by_planId_week", (q) =>
        q.eq("planId", args.planId).eq("targetWeek", args.targetWeek)
      )
      .first();

    if (!lock) return { locked: false, lock: null };

    // Check if lock is expired (stuck in_progress)
    if (lock.status === "in_progress") {
      const lockAge = Date.now() - new Date(lock.startedAt).getTime();
      if (lockAge > LOCK_EXPIRY_MS) {
        // Lock expired, treat as not locked
        return { locked: false, lock, expired: true };
      }
      return { locked: true, lock };
    }

    // Completed or failed - check status
    if (lock.status === "completed") {
      return { locked: true, lock, alreadyGenerated: true };
    }

    // Failed - can retry
    return { locked: false, lock, previouslyFailed: true };
  },
});

/**
 * Create or update a generation lock
 */
export const createGenerationLock = internalMutation({
  args: {
    planId: v.id("workoutPlans"),
    userId: v.string(),
    targetWeek: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for existing lock
    const existing = await ctx.db
      .query("generationLocks")
      .withIndex("by_planId_week", (q) =>
        q.eq("planId", args.planId).eq("targetWeek", args.targetWeek)
      )
      .first();

    if (existing) {
      // Update existing lock
      await ctx.db.patch(existing._id, {
        status: "in_progress",
        startedAt: new Date().toISOString(),
        completedAt: undefined,
        error: undefined,
      });
      return existing._id;
    }

    // Create new lock
    return await ctx.db.insert("generationLocks", {
      planId: args.planId,
      userId: args.userId,
      targetWeek: args.targetWeek,
      status: "in_progress",
      startedAt: new Date().toISOString(),
    });
  },
});

/**
 * Update lock status on completion or failure
 */
export const updateGenerationLock = internalMutation({
  args: {
    lockId: v.id("generationLocks"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lockId, {
      status: args.status,
      completedAt: new Date().toISOString(),
      error: args.error,
    });
  },
});

/**
 * Find all plans that need their next week generated
 * Now also handles catching up multiple weeks if needed
 */
export const findPlansNeedingNextWeek = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get all plans with periodization
    const allPlans = await ctx.db.query("workoutPlans").collect();

    const plansNeedingUpdate: Array<{
      planId: string;
      planIdTyped: any;
      userId: string;
      currentWeek: number;
      calculatedWeek: number;
      nextWeekToGenerate: number; // The immediate next week to generate
      phase: PeriodizationPhase;
      totalWeeks: number;
    }> = [];

    for (const plan of allPlans) {
      // Skip plans without periodization
      if (!plan.periodization || !plan.createdAt) continue;

      // Calculate what week we should be on based on creation date
      const calculatedWeek = calculateCurrentWeek(plan.createdAt);
      const storedWeek = plan.periodization.current_week;

      // If calculated week is ahead of stored week, we need to generate
      // Generate ONE week at a time (next week = storedWeek + 1)
      if (calculatedWeek > storedWeek) {
        const nextWeekToGenerate = storedWeek + 1;

        // Don't generate if we've passed the total weeks (plan complete)
        if (nextWeekToGenerate <= plan.periodization.total_weeks) {
          plansNeedingUpdate.push({
            planId: plan._id,
            planIdTyped: plan._id,
            userId: plan.userId,
            currentWeek: storedWeek,
            calculatedWeek,
            nextWeekToGenerate,
            phase: plan.periodization.phase as PeriodizationPhase,
            totalWeeks: plan.periodization.total_weeks,
          });
        }
      }
    }

    loggers.mutations.info(`Found ${plansNeedingUpdate.length} plans needing next week generation`);
    return plansNeedingUpdate;
  },
});

/**
 * Main scheduled job: Check and queue next week generation
 * Called by cron every Monday at 5AM UTC
 */
export const checkAndGenerateNextWeeks = internalMutation({
  args: {},
  handler: async (ctx) => {
    loggers.mutations.info("🗓️ Running weekly plan generation check...");

    // Find all plans needing updates
    const plansNeedingUpdate = await ctx.runQuery(internal.periodizationJobs.findPlansNeedingNextWeek, {});

    if (plansNeedingUpdate.length === 0) {
      loggers.mutations.info("✅ No plans need next week generation");
      return { processed: 0, skipped: 0 };
    }

    // Queue generation for each plan (don't block - run async)
    let queued = 0;
    let skipped = 0;

    for (const plan of plansNeedingUpdate) {
      try {
        // Check if already locked/generated
        const lockStatus = await ctx.runQuery(internal.periodizationJobs.checkGenerationLock, {
          planId: plan.planIdTyped,
          targetWeek: plan.nextWeekToGenerate,
        });

        if (lockStatus.locked && !lockStatus.expired) {
          if (lockStatus.alreadyGenerated) {
            loggers.mutations.debug(`Week ${plan.nextWeekToGenerate} already generated for plan ${plan.planId}`);
          } else {
            loggers.mutations.debug(`Generation already in progress for plan ${plan.planId} week ${plan.nextWeekToGenerate}`);
          }
          skipped++;
          continue;
        }

        // Create lock before scheduling
        const lockId = await ctx.runMutation(internal.periodizationJobs.createGenerationLock, {
          planId: plan.planIdTyped,
          userId: plan.userId,
          targetWeek: plan.nextWeekToGenerate,
        });

        // Schedule the generation action (runs in background)
        await ctx.scheduler.runAfter(0, internal.periodizationJobs.generateNextWeekForPlan, {
          planId: plan.planId,
          userId: plan.userId,
          targetWeek: plan.nextWeekToGenerate,
          lockId,
        });
        queued++;
      } catch (error) {
        loggers.mutations.error(`Failed to queue generation for plan ${plan.planId}:`, error);
      }
    }

    loggers.mutations.info(`📋 Queued ${queued} plans, skipped ${skipped} (already in progress/generated)`);
    return { processed: queued, skipped };
  },
});

/**
 * Daily check for plans approaching week transition
 * Catches users in different timezones and handles catch-up
 */
export const dailyWeekCheck = internalMutation({
  args: {},
  handler: async (ctx) => {
    loggers.mutations.info("📅 Running daily week transition check...");

    // Reuse the same logic
    const result = await ctx.runMutation(internal.periodizationJobs.checkAndGenerateNextWeeks, {});
    return result;
  },
});

/**
 * Get previous week's plan for progression context
 */
export const getPreviousWeekContext = internalQuery({
  args: {
    planId: v.id("workoutPlans"),
    userId: v.string(),
    currentWeek: v.number(),
  },
  handler: async (ctx, args) => {
    // First try week history
    const previousWeekHistory = await ctx.db
      .query("weekHistory")
      .withIndex("by_userId_planId", (q) =>
        q.eq("userId", args.userId).eq("planId", args.planId)
      )
      .filter((q) => q.eq(q.field("weekNumber"), args.currentWeek - 1))
      .first();

    if (previousWeekHistory) {
      return {
        weekNumber: previousWeekHistory.weekNumber,
        phase: previousWeekHistory.phase,
        weeklyPlan: previousWeekHistory.weeklyPlan,
        stats: previousWeekHistory.stats,
        isDeloadWeek: previousWeekHistory.isDeloadWeek,
      };
    }

    // If no history, get from current plan (this is week 1's data)
    if (args.currentWeek === 1) {
      const plan = await ctx.db.get(args.planId);
      if (plan) {
        return {
          weekNumber: 1,
          phase: plan.periodization?.phase || "base",
          weeklyPlan: plan.weeklyPlan,
          stats: null,
          isDeloadWeek: false,
        };
      }
    }

    return null;
  },
});

/**
 * Generate next week for a specific plan
 * This is the actual AI generation that runs in background
 */
export const generateNextWeekForPlan = internalAction({
  args: {
    planId: v.string(),
    userId: v.string(),
    targetWeek: v.number(),
    lockId: v.id("generationLocks"),
  },
  handler: async (ctx, args) => {
    loggers.ai.info(`🏋️ Generating Week ${args.targetWeek} for plan ${args.planId}`);

    try {
      // 1. Get the current plan and user preferences
      const plan = await ctx.runQuery(api.queries.getWorkoutPlan, { planId: args.planId as any });
      if (!plan) {
        throw new Error(`Plan ${args.planId} not found`);
      }

      const user = await ctx.runQuery(api.queries.getUserProfile, { userId: args.userId });
      if (!user) {
        throw new Error(`User ${args.userId} not found`);
      }

      // 2. Get the user's training preferences
      const preferences = user.trainingPreferences;
      if (!preferences) {
        loggers.ai.warn(`User ${args.userId} has no training preferences, skipping generation`);
        await ctx.runMutation(internal.periodizationJobs.updateGenerationLock, {
          lockId: args.lockId,
          status: "failed",
          error: "No training preferences",
        });
        return { success: false, reason: "No training preferences" };
      }

      // 3. Calculate new periodization state
      const currentPeriodization = plan.periodization;
      if (!currentPeriodization) {
        await ctx.runMutation(internal.periodizationJobs.updateGenerationLock, {
          lockId: args.lockId,
          status: "failed",
          error: "Plan has no periodization",
        });
        return { success: false, reason: "Plan has no periodization" };
      }

      // 4. Get previous week for progression context
      const previousWeek = await ctx.runQuery(internal.periodizationJobs.getPreviousWeekContext, {
        planId: args.planId as any,
        userId: args.userId,
        currentWeek: currentPeriodization.current_week,
      });

      // 5. Calculate new periodization (advances week + potentially phase)
      const newPeriodization = advanceToNextWeek(currentPeriodization);
      const phaseChanged = currentPeriodization.phase !== newPeriodization.phase;
      const isDeload = isDeloadWeek(args.targetWeek, currentPeriodization.total_weeks);

      // 6. Save current week to history before generating new one
      await ctx.runMutation(internal.periodizationJobs.saveWeekToHistory, {
        planId: args.planId as any,
        userId: args.userId,
        weekNumber: currentPeriodization.current_week,
        phase: currentPeriodization.phase,
        weeklyPlan: plan.weeklyPlan,
        isDeloadWeek: false,
      });

      // 7. Get periodization info for the AI prompt
      const periodizationInfo = getPeriodizationInfo(
        plan.createdAt,
        preferences.specific_goal?.target_date || null
      );

      if (!periodizationInfo) {
        await ctx.runMutation(internal.periodizationJobs.updateGenerationLock, {
          lockId: args.lockId,
          status: "failed",
          error: "Could not calculate periodization info",
        });
        return { success: false, reason: "Could not calculate periodization info" };
      }

      // 8. Build progression context for AI
      const progressionContext = buildProgressionContext({
        previousWeek,
        newPhase: newPeriodization.phase,
        phaseChanged,
        isDeload,
        weekNumber: args.targetWeek,
        totalWeeks: currentPeriodization.total_weeks,
        periodizationInfo,
      });

      // 9. Generate the new week using AI with progression context
      const newWeekPlan = await ctx.runAction(api.ai.generateWorkoutPlan, {
        userId: args.userId,
        preferences: {
          primary_goal: preferences.primary_goal || "general_fitness",
          experience_level: preferences.experience_level || "intermediate",
          training_frequency: preferences.training_frequency || "3-4",
          pain_points: preferences.pain_points || [],
          sport: preferences.sport || undefined,
          equipment: preferences.equipment || undefined,
          preferred_session_length: preferences.preferred_session_length || "60",
          sex: preferences.sex || undefined,
          age: preferences.age || undefined,
          current_strength: preferences.current_strength || undefined,
          training_split: preferences.training_split || undefined,
          specific_goal: preferences.specific_goal || undefined,
        },
        // Pass progression context (the AI action needs to handle this)
        periodizationContext: progressionContext,
      });

      if (!newWeekPlan || !newWeekPlan.weeklyPlan) {
        throw new Error("AI failed to generate valid plan");
      }

      // 10. Update the plan with new weekly content
      await ctx.runMutation(api.mutations.updatePlanWeeklyContent, {
        planId: args.planId as any,
        userId: args.userId,
        weeklyPlan: newWeekPlan.weeklyPlan,
        periodization: newPeriodization,
      });

      // 11. Mark lock as completed
      await ctx.runMutation(internal.periodizationJobs.updateGenerationLock, {
        lockId: args.lockId,
        status: "completed",
      });

      loggers.ai.info(`✅ Successfully generated Week ${args.targetWeek} for plan ${args.planId}`);

      // 12. Create push notification for the user
      await ctx.runMutation(internal.periodizationJobs.createNewWeekNotification, {
        userId: args.userId,
        weekNumber: args.targetWeek,
        phase: newPeriodization.phase,
        phaseChanged,
        isDeloadWeek: isDeload,
      });

      return {
        success: true,
        week: args.targetWeek,
        phase: newPeriodization.phase,
        phaseChanged,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      loggers.ai.error(`❌ Failed to generate Week ${args.targetWeek} for plan ${args.planId}:`, error);

      // Mark lock as failed
      await ctx.runMutation(internal.periodizationJobs.updateGenerationLock, {
        lockId: args.lockId,
        status: "failed",
        error: errorMsg,
      });

      return {
        success: false,
        reason: errorMsg,
      };
    }
  },
});

/**
 * Build progression context string for AI
 * This tells the AI exactly how to progress from the previous week
 */
function buildProgressionContext(params: {
  previousWeek: any;
  newPhase: PeriodizationPhase;
  phaseChanged: boolean;
  isDeload: boolean;
  weekNumber: number;
  totalWeeks: number;
  periodizationInfo: any;
}): string {
  const { previousWeek, newPhase, phaseChanged, isDeload, weekNumber, totalWeeks, periodizationInfo } = params;
  const phaseChars = PHASE_CHARACTERISTICS[newPhase];

  let context = `
**═══════════════════════════════════════════════════════════════**
**PERIODIZATION: WEEK ${weekNumber} of ${totalWeeks}**
**═══════════════════════════════════════════════════════════════**

**CURRENT PHASE: ${newPhase.toUpperCase()}**
- ${phaseChars.focusDescription}
- Volume Multiplier: ${phaseChars.volumeMultiplier}x
- Intensity Range: RPE ${phaseChars.rpeRange}

**KEY PRINCIPLES FOR THIS PHASE:**
${phaseChars.keyPrinciples.map(p => `✓ ${p}`).join('\n')}
`;

  // Phase transition guidance
  if (phaseChanged) {
    context += `
**🔄 PHASE TRANSITION: Entering ${newPhase.toUpperCase()} Phase**
- This is the FIRST week of the ${newPhase.toUpperCase()} phase
- Adjust volume and intensity according to new phase parameters
- ${newPhase === 'build' ? 'INCREASE intensity, maintain or increase volume' : ''}
- ${newPhase === 'peak' ? 'HIGH intensity, REDUCED volume - competition simulation' : ''}
- ${newPhase === 'taper' ? 'REDUCE both volume and intensity - recovery focus' : ''}
`;
  }

  // Deload guidance
  if (isDeload) {
    context += `
**🔄 DELOAD WEEK**
- Reduce volume by 40-50% from previous week
- Reduce intensity (lower RPE by 1-2 points)
- Maintain movement patterns and exercise selection
- Focus on recovery and technique refinement
`;
  }

  // Previous week context for progression
  if (previousWeek && previousWeek.weeklyPlan && !isDeload) {
    context += `
**📊 PREVIOUS WEEK REFERENCE (Week ${previousWeek.weekNumber}):**
- Phase was: ${previousWeek.phase.toUpperCase()}
- Apply progressive overload: +2.5-5% weight OR +1-2 reps where appropriate
- Maintain similar exercise selection for tracking continuity
- If previous week had any issues (logged), adjust accordingly
`;

    // Extract key exercises from previous week for reference
    if (Array.isArray(previousWeek.weeklyPlan)) {
      const mainExercises: string[] = [];
      previousWeek.weeklyPlan.forEach((day: any) => {
        if (day.blocks) {
          day.blocks.forEach((block: any) => {
            if (block.exercises) {
              block.exercises.forEach((ex: any) => {
                if (ex.category === 'main' && ex.exercise_name) {
                  mainExercises.push(ex.exercise_name);
                }
              });
            }
          });
        }
      });

      if (mainExercises.length > 0) {
        const uniqueExercises = [...new Set(mainExercises)].slice(0, 10);
        context += `
**KEY EXERCISES TO MAINTAIN (for progression tracking):**
${uniqueExercises.map(e => `- ${e}`).join('\n')}
`;
      }
    }
  }

  // Weeks until event
  if (periodizationInfo.weeksUntilEvent <= 2) {
    context += `
**⚠️ FINAL ${periodizationInfo.weeksUntilEvent} WEEK(S) BEFORE EVENT**
- Prioritize recovery and sharpness
- No new exercises - only familiar movements
- Reduce volume significantly
`;
  }

  return context;
}

/**
 * Manual trigger for generating next week (can be called from frontend)
 * Useful for users who want to manually refresh their plan
 */
export const triggerNextWeekGeneration = internalMutation({
  args: {
    planId: v.id("workoutPlans"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== args.userId) {
      throw new Error("Plan not found or access denied");
    }

    if (!plan.periodization || !plan.createdAt) {
      throw new Error("Plan does not have periodization enabled");
    }

    const nextWeek = plan.periodization.current_week + 1;

    // Check if already locked
    const lockStatus = await ctx.runQuery(internal.periodizationJobs.checkGenerationLock, {
      planId: args.planId,
      targetWeek: nextWeek,
    });

    if (lockStatus.locked && !lockStatus.expired) {
      if (lockStatus.alreadyGenerated) {
        return { queued: false, reason: "Already generated", targetWeek: nextWeek };
      }
      return { queued: false, reason: "Generation in progress", targetWeek: nextWeek };
    }

    // Create lock
    const lockId = await ctx.runMutation(internal.periodizationJobs.createGenerationLock, {
      planId: args.planId,
      userId: args.userId,
      targetWeek: nextWeek,
    });

    // Queue the generation
    await ctx.scheduler.runAfter(0, internal.periodizationJobs.generateNextWeekForPlan, {
      planId: args.planId,
      userId: args.userId,
      targetWeek: nextWeek,
      lockId,
    });

    return { queued: true, targetWeek: nextWeek };
  },
});

/**
 * Save completed week to history for progress tracking
 */
export const saveWeekToHistory = internalMutation({
  args: {
    planId: v.id("workoutPlans"),
    userId: v.string(),
    weekNumber: v.number(),
    phase: v.string(),
    weeklyPlan: v.any(),
    isDeloadWeek: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if this week already exists in history
    const existing = await ctx.db
      .query("weekHistory")
      .withIndex("by_userId_planId", (q) =>
        q.eq("userId", args.userId).eq("planId", args.planId)
      )
      .filter((q) => q.eq(q.field("weekNumber"), args.weekNumber))
      .first();

    if (existing) {
      loggers.mutations.debug(`Week ${args.weekNumber} already in history for plan ${args.planId}`);
      return existing._id;
    }

    // Calculate basic stats from workout logs for this week
    // For now, just save the plan snapshot - stats can be computed later
    const historyId = await ctx.db.insert("weekHistory", {
      userId: args.userId,
      planId: args.planId,
      weekNumber: args.weekNumber,
      phase: args.phase as "base" | "build" | "peak" | "taper" | "recovery",
      weeklyPlan: args.weeklyPlan,
      completedAt: new Date().toISOString(),
      isDeloadWeek: args.isDeloadWeek,
    });

    loggers.mutations.info(`📚 Saved Week ${args.weekNumber} to history for plan ${args.planId}`);
    return historyId;
  },
});

/**
 * Create in-app notification when new week is generated
 */
export const createNewWeekNotification = internalMutation({
  args: {
    userId: v.string(),
    weekNumber: v.number(),
    phase: v.string(),
    phaseChanged: v.boolean(),
    isDeloadWeek: v.boolean(),
  },
  handler: async (ctx, args) => {
    const phaseLabels: Record<string, string> = {
      base: "BASE",
      build: "BUILD",
      peak: "PEAK",
      taper: "TAPER",
      recovery: "RECOVERY",
    };

    const phaseEmojis: Record<string, string> = {
      base: "🏗️",
      build: "💪",
      peak: "🔥",
      taper: "🎯",
      recovery: "🧘",
    };

    let title: string;
    let body: string;
    let notificationType: "new_week_ready" | "phase_change" | "deload_reminder" = "new_week_ready";

    if (args.phaseChanged) {
      notificationType = "phase_change";
      title = `${phaseEmojis[args.phase]} New Phase: ${phaseLabels[args.phase]}`;
      body = `Week ${args.weekNumber} is ready! You've entered the ${phaseLabels[args.phase]} phase.`;
    } else if (args.isDeloadWeek) {
      notificationType = "deload_reminder";
      title = "🔄 Deload Week";
      body = `Week ${args.weekNumber} is a deload week. Focus on recovery and technique.`;
    } else {
      title = `📋 Week ${args.weekNumber} Ready`;
      body = `Your new training week has been generated. ${phaseEmojis[args.phase]} ${phaseLabels[args.phase]} phase continues.`;
    }

    // Create in-app notification
    const notificationId = await ctx.db.insert("pushNotifications", {
      userId: args.userId,
      type: notificationType,
      title,
      body,
      data: {
        weekNumber: args.weekNumber,
        phase: args.phase,
        isDeloadWeek: args.isDeloadWeek,
      },
      read: false,
      sentAt: new Date().toISOString(),
      delivered: true,
      deliveredAt: new Date().toISOString(),
    });

    loggers.mutations.info(`🔔 Created notification for user ${args.userId}: ${title}`);
    return notificationId;
  },
});

/**
 * Get user's notifications (for UI)
 */
export const getUserNotifications = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("pushNotifications")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId));

    if (args.unreadOnly) {
      query = ctx.db
        .query("pushNotifications")
        .withIndex("by_userId_read", (q) => q.eq("userId", args.userId).eq("read", false));
    }

    const notifications = await query
      .order("desc")
      .take(args.limit || 20);

    return notifications;
  },
});

/**
 * Mark notification as read
 */
export const markNotificationRead = internalMutation({
  args: {
    notificationId: v.id("pushNotifications"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== args.userId) {
      throw new Error("Notification not found");
    }

    await ctx.db.patch(args.notificationId, {
      read: true,
      readAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * Get week history for a plan (for progress comparison)
 */
export const getWeekHistory = internalQuery({
  args: {
    userId: v.string(),
    planId: v.id("workoutPlans"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("weekHistory")
      .withIndex("by_userId_planId", (q) =>
        q.eq("userId", args.userId).eq("planId", args.planId)
      )
      .order("desc")
      .take(args.limit || 12);

    return history;
  },
});

/**
 * Cleanup old/expired locks (maintenance job)
 * Can be scheduled to run daily to clean up stuck locks
 */
export const cleanupExpiredLocks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allInProgressLocks = await ctx.db
      .query("generationLocks")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();

    let cleaned = 0;
    for (const lock of allInProgressLocks) {
      const lockAge = now - new Date(lock.startedAt).getTime();
      if (lockAge > LOCK_EXPIRY_MS) {
        await ctx.db.patch(lock._id, {
          status: "failed",
          completedAt: new Date().toISOString(),
          error: "Lock expired (timeout)",
        });
        cleaned++;
      }
    }

    if (cleaned > 0) {
      loggers.mutations.info(`🧹 Cleaned up ${cleaned} expired generation locks`);
    }
    return { cleaned };
  },
});
