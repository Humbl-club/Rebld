/**
 * Hyrox Plan Generation Action
 *
 * Main action for generating Hyrox-specific training plans.
 * Integrates all Phase 2 components:
 * - Sport knowledge (assembleHyroxPrompt)
 * - Validation (validateHyroxPlan with safety caps)
 * - Conflict detection
 * - Cross-week station coverage for first-timers
 *
 * Uses DeepSeek API for plan generation with retry logic.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { loggers } from "./utils/logger";
import {
  createDeepSeekClient,
  extractAndParseJSON,
} from "./utils/aiHelpers";

// Sport knowledge imports
import {
  assembleHyroxPrompt,
  calculateWeeksOut,
  getAdjustedVolumeTargets,
  type UserProfile,
  type WeekContext,
} from "./sportKnowledge/assembleHyroxPrompt";

import {
  getVolumeTargets,
  calculatePhase,
} from "./sportKnowledge/hyrox";

import {
  validateAndFix,
  type ValidationConstraints,
  type GeneratedPlan,
  type GenerationResult as ValidationGenerationResult,
} from "./sportKnowledge/validateHyroxPlan";

import {
  detectConflicts,
  canProceedWithGeneration,
  type UserConstraints,
  type Conflict,
} from "./sportKnowledge/conflictDetection";

import { extractStationsCovered } from "./hyroxQueries";

// =============================================================================
// TYPES
// =============================================================================

interface HyroxGenerationResult {
  success: boolean;
  plan?: GeneratedPlan;
  validation?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    autoFixed: boolean;
  };
  conflicts?: {
    blocking: boolean;
    summary: string;
  };
  error?: string;
  metadata?: {
    phase: string;
    weekNumber: number;
    generationTimeMs: number;
    model: string;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert Conflict issues to human-readable summary
 */
function summarizeConflicts(conflicts: Conflict[]): string {
  return conflicts.map(c => c.description).join('; ');
}

/**
 * Get first blocking conflict's resolution suggestion
 */
function getResolutionSuggestion(conflicts: Conflict[]): string {
  const blocking = conflicts.find(c => c.severity === 'blocking');
  if (blocking?.resolutionOptions.length) {
    return blocking.resolutionOptions[0].description;
  }
  return "Please resolve conflicts before generating a plan";
}

// =============================================================================
// MAIN ACTION
// =============================================================================

/**
 * Generate a Hyrox training plan for a user
 *
 * Full flow:
 * 1. Fetch user profile and context
 * 2. Check for conflicts (equipment, injuries, time constraints)
 * 3. Get previous weeks' station coverage for first-timers
 * 4. Assemble constrained prompt
 * 5. Generate plan via DeepSeek
 * 6. Validate with safety caps and first-timer rules
 * 7. Auto-fix recoverable issues
 * 8. Return validated plan
 */
export const generateHyroxPlan = action({
  args: {
    userId: v.string(),
    planId: v.optional(v.id("workoutPlans")),
    weekNumber: v.optional(v.number()),
    forceModel: v.optional(v.union(v.literal("reasoner"), v.literal("chat"))),
  },
  handler: async (ctx, args): Promise<HyroxGenerationResult> => {
    const startTime = Date.now();

    try {
      // =========================================================================
      // STEP 1: Fetch user profile
      // =========================================================================
      const profile = await ctx.runQuery(api.hyroxQueries.getUserHyroxProfile, {
        userId: args.userId,
      });

      if (!profile) {
        return {
          success: false,
          error: "No Hyrox profile found. Complete Hyrox onboarding first.",
        };
      }

      if (!profile.competition.date) {
        return {
          success: false,
          error: "No competition date set. Please set a target race date.",
        };
      }

      loggers.ai.info(`[Hyrox] Generating plan for user ${args.userId}`);

      // =========================================================================
      // STEP 2: Build user constraints and check for conflicts
      // =========================================================================
      const weeksOut = calculateWeeksOut(new Date(profile.competition.date));

      const userConstraints: UserConstraints = {
        weeksUntilRace: weeksOut,
        isFirstRace: profile.competition.isFirstRace,
        painPoints: profile.constraints.painPoints,
        gymType: profile.equipment.gymType,
        missingEquipment: profile.equipment.missingEquipment,
        sessionLengthMinutes: profile.schedule.sessionLengthMinutes,
        trainingDaysPerWeek: profile.schedule.trainingDays,
      };

      const conflicts = detectConflicts(userConstraints);

      if (!canProceedWithGeneration(conflicts)) {
        return {
          success: false,
          conflicts: {
            blocking: true,
            summary: summarizeConflicts(conflicts),
          },
          error: `Cannot generate plan: ${getResolutionSuggestion(conflicts)}`,
        };
      }

      // =========================================================================
      // STEP 3: Get adaptation context from previous week
      // =========================================================================
      const weekNumber = args.weekNumber || 1;
      const phase = calculatePhase(weeksOut);
      let weekContext: WeekContext | undefined;

      if (args.planId && weekNumber > 1) {
        // Get latest week summary for adaptation
        const latestSummary = await ctx.runQuery(api.hyroxQueries.getLatestWeekSummary, {
          userId: args.userId,
          planId: args.planId,
        });

        if (latestSummary) {
          weekContext = {
            weekNumber,
            phase: latestSummary.phase as any,
            isPhaseTransition: false, // TODO: Calculate from phase changes
            previousWeekActuals: {
              runningKm: latestSummary.actualRunningKm || 0,
              completionRate: latestSummary.sessionsPlanned > 0
                ? latestSummary.sessionsCompleted / latestSummary.sessionsPlanned
                : 1,
            },
            previousWeekFeeling: latestSummary.overallFeeling || undefined,
            sessionsMissed: latestSummary.sessionsMissed,
          };
        }
      }

      // =========================================================================
      // STEP 4: Get previous weeks' station coverage (for first-timers)
      // =========================================================================
      let previousWeeksStationsCovered: string[] = [];

      if (profile.competition.isFirstRace && args.planId && weekNumber > 1) {
        previousWeeksStationsCovered = await ctx.runQuery(
          api.hyroxQueries.getPreviousWeeksStationsCovered,
          {
            userId: args.userId,
            planId: args.planId,
            currentWeekNumber: weekNumber,
          }
        );

        loggers.ai.info(
          `[Hyrox] First-timer week ${weekNumber}: Previous stations covered: ${previousWeeksStationsCovered.join(', ') || 'none'}`
        );
      }

      // =========================================================================
      // STEP 5: Assemble constrained prompt
      // =========================================================================
      const userProfile: UserProfile = {
        userId: args.userId,
        competition: {
          date: new Date(profile.competition.date),
          division: profile.competition.division as any,
          isFirstRace: profile.competition.isFirstRace,
          targetTimeMinutes: profile.competition.targetTimeMinutes,
          previousBestTimeMinutes: profile.competition.previousBestTimeMinutes,
        },
        fitness: {
          runningLevel: profile.fitness.runningLevel,
          comfortable5kTimeMinutes: profile.fitness.comfortable5kTimeMinutes,
          weeklyRunningKm: profile.fitness.weeklyRunningKm,
          strengthLevel: profile.fitness.strengthLevel,
          maxes: profile.fitness.maxes,
          trainingYears: profile.fitness.trainingYears,
        },
        stations: profile.stations,
        schedule: {
          trainingDays: profile.schedule.trainingDays,
          sessionLengthMinutes: profile.schedule.sessionLengthMinutes,
          canDoTwoADay: profile.schedule.canDoTwoADay,
        },
        constraints: {
          painPoints: profile.constraints.painPoints,
        },
        equipment: {
          gymType: profile.equipment.gymType,
          missingEquipment: profile.equipment.missingEquipment,
        },
        preferences: profile.preferences,
      };

      const assembledPrompt = assembleHyroxPrompt(userProfile, weekContext);

      loggers.ai.info(
        `[Hyrox] Prompt assembled for phase ${assembledPrompt.metadata.phase}, ` +
        `experience ${assembledPrompt.metadata.experienceLevel}`
      );

      // =========================================================================
      // STEP 6: Generate plan via DeepSeek
      // =========================================================================
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          error: "DeepSeek API key not configured. Set DEEPSEEK_API_KEY in Convex environment.",
        };
      }

      const ai = createDeepSeekClient(apiKey);
      const selectedModel = args.forceModel === "reasoner"
        ? "deepseek-reasoner"
        : "deepseek-chat";

      loggers.ai.info(`[Hyrox] Generating with ${selectedModel}...`);

      const fullPrompt = `${assembledPrompt.systemPrompt}\n\n${assembledPrompt.userPrompt}`;

      // Generate without built-in validation (we'll use our own)
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: fullPrompt,
      });

      const generatedText = response.text || '';
      let generatedPlan: GeneratedPlan;

      try {
        generatedPlan = extractAndParseJSON(generatedText) as GeneratedPlan;
      } catch (parseError: any) {
        return {
          success: false,
          error: `Failed to parse generated plan: ${parseError.message}`,
          metadata: {
            phase: assembledPrompt.metadata.phase,
            weekNumber,
            generationTimeMs: Date.now() - startTime,
            model: selectedModel,
          },
        };
      }

      // =========================================================================
      // STEP 7: Build validation constraints and validate
      // =========================================================================
      const experienceLevel = assembledPrompt.metadata.experienceLevel;
      const baseVolumeTargets = getVolumeTargets(phase, experienceLevel);

      // Parse volume targets from the string format
      const runningMatch = baseVolumeTargets.running.match(/(\d+)-(\d+)/);
      const runningMin = runningMatch ? parseInt(runningMatch[1]) : 25;
      const runningMax = runningMatch ? parseInt(runningMatch[2]) : 50;

      const validationConstraints: ValidationConstraints = {
        volumeTargets: {
          weeklyRunning: { min: runningMin, max: runningMax },
          weeklySkiErg: { min: 2000, max: 6000 },
          weeklyRowing: { min: 2000, max: 6000 },
          strengthSessions: { min: 2, max: 4 },
          totalTrainingHours: { min: 5, max: 12 },
        },
        trainingDays: profile.schedule.trainingDays,
        sessionLengthMinutes: profile.schedule.sessionLengthMinutes,
        weakStations: profile.stations?.weak,
        strongStations: profile.stations?.strong,
        injuryAreas: profile.constraints.painPoints,
        experienceLevel,
        isFirstRace: profile.competition.isFirstRace,
        weekNumber,
        previousWeeksStationsCovered: previousWeeksStationsCovered as any[],
      };

      // Use the combined validate-and-fix helper
      const result = validateAndFix(generatedPlan, validationConstraints);

      // Extract errors and warnings from issues
      const errors = result.validationResult?.issues
        .filter(i => i.type === 'error')
        .map(i => i.message) || [];

      const warnings = result.validationResult?.issues
        .filter(i => i.type === 'warning')
        .map(i => i.message) || [];

      loggers.ai.info(
        `[Hyrox] Validation: ${result.success ? 'PASSED' : 'FAILED'} ` +
        `(${errors.length} errors, ${warnings.length} warnings)`
      );

      // =========================================================================
      // STEP 8: Return result
      // =========================================================================
      const generationTimeMs = Date.now() - startTime;

      if (!result.success) {
        return {
          success: false,
          validation: {
            valid: false,
            errors,
            warnings,
            autoFixed: false,
          },
          error: result.error?.message || `Plan validation failed: ${errors.join('; ')}`,
          metadata: {
            phase: assembledPrompt.metadata.phase,
            weekNumber,
            generationTimeMs,
            model: selectedModel,
          },
        };
      }

      loggers.ai.info(`[Hyrox] Generation complete in ${generationTimeMs}ms`);

      return {
        success: true,
        plan: result.plan,
        validation: {
          valid: true,
          errors: [],
          warnings,
          autoFixed: result.validationResult?.issues.some(i => i.autoFixable) || false,
        },
        conflicts: conflicts.length > 0
          ? {
              blocking: false,
              summary: summarizeConflicts(conflicts.filter(c => c.severity === 'warning')),
            }
          : undefined,
        metadata: {
          phase: assembledPrompt.metadata.phase,
          weekNumber,
          generationTimeMs,
          model: selectedModel,
        },
      };

    } catch (error: any) {
      loggers.ai.error(`[Hyrox] Generation failed: ${error.message}`);

      return {
        success: false,
        error: error.message || "Unknown error during plan generation",
        metadata: {
          phase: "unknown",
          weekNumber: args.weekNumber || 1,
          generationTimeMs: Date.now() - startTime,
          model: args.forceModel || "deepseek-chat",
        },
      };
    }
  },
});

/**
 * Quick validation check without generation
 *
 * Useful for checking if a plan can be generated before starting
 * the expensive generation process.
 */
export const checkGenerationReadiness = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get profile
    const profile = await ctx.runQuery(api.hyroxQueries.getUserHyroxProfile, {
      userId: args.userId,
    });

    if (!profile) {
      return {
        ready: false,
        reason: "No Hyrox profile found",
        action: "Complete Hyrox onboarding",
      };
    }

    if (!profile.competition.date) {
      return {
        ready: false,
        reason: "No competition date set",
        action: "Set a target race date",
      };
    }

    // Check conflicts
    const weeksOut = calculateWeeksOut(new Date(profile.competition.date));

    const userConstraints: UserConstraints = {
      weeksUntilRace: weeksOut,
      isFirstRace: profile.competition.isFirstRace,
      painPoints: profile.constraints.painPoints,
      gymType: profile.equipment.gymType,
      missingEquipment: profile.equipment.missingEquipment,
      sessionLengthMinutes: profile.schedule.sessionLengthMinutes,
      trainingDaysPerWeek: profile.schedule.trainingDays,
    };

    const conflicts = detectConflicts(userConstraints);
    const blockingConflicts = conflicts.filter(c => c.severity === 'blocking');

    if (blockingConflicts.length > 0) {
      return {
        ready: false,
        reason: blockingConflicts[0].description,
        action: blockingConflicts[0].resolutionOptions[0]?.description || "Resolve the conflict",
        allConflicts: conflicts.map(c => ({
          severity: c.severity,
          title: c.title,
          description: c.description,
        })),
      };
    }

    return {
      ready: true,
      phase: profile.competition.isFirstRace ? "First race preparation" : "Experienced athlete",
      weeksOut,
      warnings: conflicts
        .filter(c => c.severity === 'warning')
        .map(c => c.description),
    };
  },
});
