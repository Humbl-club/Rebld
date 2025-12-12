/**
 * Silver Prompt Test Suite
 * Tests edge cases and measures generation time
 *
 * Run with: npx convex run tests/testSilverPrompt:runAllTests
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════

interface TestCase {
  name: string;
  description: string;
  payload: {
    preferences: {
      primary_goal: string;
      experience_level: string;
      training_frequency: string;
      pain_points: string[];
      sport?: string;
      additional_notes?: string;
      equipment?: string;
      preferred_session_length?: string;
      sex?: string;
      age?: number;
      training_split?: {
        sessions_per_day: '1' | '2';
        training_type: 'strength_only' | 'strength_plus_cardio' | 'combined' | 'cardio_focused';
      };
      specific_goal?: {
        event_type?: string;
        event_name?: string;
        target_date?: string;
        current_readiness?: number;
      };
      _useSilverPrompt: boolean;
      _useFlashModel: boolean;
    };
  };
}

const TEST_CASES: TestCase[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // BASIC CASES
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "basic_muscle_building",
    description: "Basic muscle building, no injuries, intermediate",
    payload: {
      preferences: {
        primary_goal: "aesthetic",
        experience_level: "intermediate",
        training_frequency: "4-5",
        pain_points: [],
        preferred_session_length: "60",
        sex: "male",
        age: 28,
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },
  {
    name: "basic_strength",
    description: "Basic strength training, beginner",
    payload: {
      preferences: {
        primary_goal: "strength",
        experience_level: "beginner",
        training_frequency: "3-4",
        pain_points: [],
        preferred_session_length: "45",
        sex: "female",
        age: 32,
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // COMPETITION SPORTS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "hyrox_competition",
    description: "Hyrox competition prep with target date",
    payload: {
      preferences: {
        primary_goal: "athletic",
        experience_level: "advanced",
        training_frequency: "5+",
        pain_points: [],
        sport: "hyrox",
        preferred_session_length: "75",
        sex: "male",
        age: 35,
        specific_goal: {
          event_type: "hyrox",
          event_name: "Hyrox Cologne 2025",
          target_date: "2025-04-15",
          current_readiness: 7,
        },
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },
  {
    name: "marathon_training",
    description: "Marathon preparation",
    payload: {
      preferences: {
        primary_goal: "athletic",
        experience_level: "intermediate",
        training_frequency: "5+",
        pain_points: ["knees"],
        sport: "marathon",
        preferred_session_length: "90",
        sex: "female",
        age: 29,
        specific_goal: {
          event_type: "marathon",
          event_name: "Berlin Marathon",
          target_date: "2025-09-28",
        },
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },
  {
    name: "powerlifting_meet",
    description: "Powerlifting meet prep",
    payload: {
      preferences: {
        primary_goal: "strength",
        experience_level: "advanced",
        training_frequency: "4-5",
        pain_points: ["lower_back"],
        sport: "powerlifting",
        preferred_session_length: "90",
        sex: "male",
        age: 27,
        specific_goal: {
          event_type: "powerlifting",
          event_name: "IPF Nationals",
          target_date: "2025-06-20",
        },
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GERMAN SPORTS (Alias Test)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "fussball_german",
    description: "German alias: Fußball (Soccer)",
    payload: {
      preferences: {
        primary_goal: "athletic",
        experience_level: "intermediate",
        training_frequency: "4-5",
        pain_points: ["ankles"],
        sport: "fussball",
        preferred_session_length: "60",
        sex: "male",
        age: 22,
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },
  {
    name: "eishockey_german",
    description: "German alias: Eishockey (Ice Hockey)",
    payload: {
      preferences: {
        primary_goal: "athletic",
        experience_level: "advanced",
        training_frequency: "5+",
        pain_points: [],
        sport: "eishockey",
        preferred_session_length: "75",
        sex: "male",
        age: 24,
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PAIN POINT EDGE CASES (Rehab Testing)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "multiple_injuries",
    description: "Multiple pain points: back, knees, shoulders",
    payload: {
      preferences: {
        primary_goal: "aesthetic",
        experience_level: "intermediate",
        training_frequency: "3-4",
        pain_points: ["lower_back", "knees", "shoulders"],
        preferred_session_length: "45",
        sex: "male",
        age: 45,
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },
  {
    name: "wrist_injury",
    description: "Wrist pain - tests alternative exercises",
    payload: {
      preferences: {
        primary_goal: "strength",
        experience_level: "intermediate",
        training_frequency: "4-5",
        pain_points: ["wrists"],
        preferred_session_length: "60",
        sex: "female",
        age: 38,
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2-A-DAY TRAINING
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "two_a_day_strength_cardio",
    description: "2x daily: AM strength, PM cardio",
    payload: {
      preferences: {
        primary_goal: "athletic",
        experience_level: "advanced",
        training_frequency: "5+",
        pain_points: [],
        sport: "triathlon",
        preferred_session_length: "60",
        sex: "male",
        age: 30,
        training_split: {
          sessions_per_day: '2',
          training_type: 'strength_plus_cardio',
        },
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AGE EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "young_athlete",
    description: "Young athlete (16 years old)",
    payload: {
      preferences: {
        primary_goal: "athletic",
        experience_level: "beginner",
        training_frequency: "3-4",
        pain_points: [],
        sport: "basketball",
        preferred_session_length: "60",
        sex: "male",
        age: 16,
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },
  {
    name: "senior_fitness",
    description: "Senior fitness (65 years old)",
    payload: {
      preferences: {
        primary_goal: "health",
        experience_level: "beginner",
        training_frequency: "2-3",
        pain_points: ["knees", "lower_back"],
        preferred_session_length: "30",
        sex: "female",
        age: 65,
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ADDITIONAL NOTES (User Requests)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "specific_user_request",
    description: "User with specific exercise requests",
    payload: {
      preferences: {
        primary_goal: "aesthetic",
        experience_level: "intermediate",
        training_frequency: "4-5",
        pain_points: [],
        preferred_session_length: "60",
        sex: "male",
        age: 33,
        additional_notes: "I want to focus on my arms and shoulders. Please include lots of bicep curls and lateral raises. No leg press - I hate it.",
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MINIMAL INPUT (Edge Case)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "minimal_input",
    description: "Minimal required fields only",
    payload: {
      preferences: {
        primary_goal: "aesthetic",
        experience_level: "beginner",
        training_frequency: "3-4",
        pain_points: [],
        _useSilverPrompt: true,
        _useFlashModel: true,
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

export const runSingleTest = action({
  args: {
    testName: v.string(),
  },
  handler: async (ctx, args) => {
    const testCase = TEST_CASES.find(t => t.name === args.testName);
    if (!testCase) {
      return { error: `Test case "${args.testName}" not found` };
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`TEST: ${testCase.name}`);
    console.log(`DESC: ${testCase.description}`);
    console.log(`${'═'.repeat(60)}\n`);

    const startTime = Date.now();

    try {
      const result = await ctx.runAction(api.ai.generateWorkoutPlan, testCase.payload);
      const elapsedMs = Date.now() - startTime;
      const elapsedSec = (elapsedMs / 1000).toFixed(2);

      // Validate result structure
      const validation = validatePlanStructure(result);

      return {
        testName: testCase.name,
        success: true,
        elapsedMs,
        elapsedSec: `${elapsedSec}s`,
        planName: result?.name,
        daysGenerated: result?.weeklyPlan?.length || 0,
        validation,
        // Sample first day for inspection
        sampleDay: result?.weeklyPlan?.[0] ? {
          focus: result.weeklyPlan[0].focus,
          blockCount: result.weeklyPlan[0].blocks?.length || 0,
          exerciseCount: countExercises(result.weeklyPlan[0]),
        } : null,
      };
    } catch (error: any) {
      const elapsedMs = Date.now() - startTime;
      return {
        testName: testCase.name,
        success: false,
        elapsedMs,
        elapsedSec: `${(elapsedMs / 1000).toFixed(2)}s`,
        error: error.message,
      };
    }
  },
});

export const runAllTests = action({
  args: {},
  handler: async (ctx) => {
    const results: any[] = [];

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`SILVER PROMPT TEST SUITE`);
    console.log(`Running ${TEST_CASES.length} test cases...`);
    console.log(`${'═'.repeat(60)}\n`);

    for (const testCase of TEST_CASES) {
      console.log(`\n▶ Running: ${testCase.name}...`);

      const startTime = Date.now();

      try {
        const result = await ctx.runAction(api.ai.generateWorkoutPlan, testCase.payload);
        const elapsedMs = Date.now() - startTime;

        const validation = validatePlanStructure(result);

        results.push({
          testName: testCase.name,
          success: true,
          elapsedMs,
          elapsedSec: `${(elapsedMs / 1000).toFixed(2)}s`,
          daysGenerated: result?.weeklyPlan?.length || 0,
          validation,
        });

        console.log(`  ✅ PASS (${(elapsedMs / 1000).toFixed(2)}s)`);
      } catch (error: any) {
        const elapsedMs = Date.now() - startTime;

        results.push({
          testName: testCase.name,
          success: false,
          elapsedMs,
          elapsedSec: `${(elapsedMs / 1000).toFixed(2)}s`,
          error: error.message,
        });

        console.log(`  ❌ FAIL: ${error.message}`);
      }
    }

    // Summary
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalTime = results.reduce((sum, r) => sum + r.elapsedMs, 0);
    const avgTime = totalTime / results.length;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`SUMMARY`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Passed: ${passed}/${TEST_CASES.length}`);
    console.log(`Failed: ${failed}/${TEST_CASES.length}`);
    console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Average Time: ${(avgTime / 1000).toFixed(2)}s per test`);
    console.log(`${'═'.repeat(60)}\n`);

    return {
      summary: {
        total: TEST_CASES.length,
        passed,
        failed,
        totalTimeMs: totalTime,
        totalTimeSec: `${(totalTime / 1000).toFixed(2)}s`,
        avgTimeMs: avgTime,
        avgTimeSec: `${(avgTime / 1000).toFixed(2)}s`,
      },
      results,
    };
  },
});

// Quick test - just run one to verify setup
export const quickTest = action({
  args: {},
  handler: async (ctx) => {
    console.log("Running quick test: basic_muscle_building");

    const testCase = TEST_CASES[0]; // basic_muscle_building
    const startTime = Date.now();

    try {
      const result = await ctx.runAction(api.ai.generateWorkoutPlan, testCase.payload);
      const elapsedMs = Date.now() - startTime;

      return {
        success: true,
        testName: testCase.name,
        elapsedMs,
        elapsedSec: `${(elapsedMs / 1000).toFixed(2)}s`,
        planName: result?.name,
        daysGenerated: result?.weeklyPlan?.length || 0,
        firstDayFocus: result?.weeklyPlan?.[0]?.focus,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        elapsedMs: Date.now() - startTime,
      };
    }
  },
});

// List available tests
export const listTests = action({
  args: {},
  handler: async () => {
    return TEST_CASES.map(t => ({
      name: t.name,
      description: t.description,
    }));
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function validatePlanStructure(plan: any): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!plan) {
    issues.push("Plan is null/undefined");
    return { valid: false, issues };
  }

  if (!plan.name) {
    issues.push("Missing plan name");
  }

  if (!plan.weeklyPlan || !Array.isArray(plan.weeklyPlan)) {
    issues.push("Missing or invalid weeklyPlan array");
    return { valid: false, issues };
  }

  if (plan.weeklyPlan.length !== 7) {
    issues.push(`Expected 7 days, got ${plan.weeklyPlan.length}`);
  }

  // Check each day
  for (let i = 0; i < plan.weeklyPlan.length; i++) {
    const day = plan.weeklyPlan[i];
    const dayNum = i + 1;

    if (!day.focus) {
      issues.push(`Day ${dayNum}: Missing focus`);
    }

    if (day.focus?.toLowerCase().includes('rest')) {
      // Rest days should have empty blocks
      if (day.blocks && day.blocks.length > 0) {
        issues.push(`Day ${dayNum}: Rest day has non-empty blocks`);
      }
      continue;
    }

    // Training days should have blocks
    if (!day.blocks || day.blocks.length === 0) {
      issues.push(`Day ${dayNum}: Training day has no blocks`);
      continue;
    }

    // Check exercises have categories
    for (const block of day.blocks) {
      if (!block.exercises) continue;
      for (const ex of block.exercises) {
        if (!ex.category) {
          issues.push(`Day ${dayNum}: Exercise "${ex.exercise_name}" missing category`);
        }
        if (!ex.exercise_name) {
          issues.push(`Day ${dayNum}: Exercise missing name`);
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function countExercises(day: any): number {
  if (!day.blocks) return 0;
  return day.blocks.reduce((sum: number, block: any) => {
    return sum + (block.exercises?.length || 0);
  }, 0);
}
