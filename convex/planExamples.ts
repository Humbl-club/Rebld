/**
 * EXAMPLE PLANS DATABASE - Reference for AI
 *
 * Perfect example plans that the AI can reference.
 * These demonstrate EXACTLY how to structure plans correctly.
 *
 * Purpose:
 * 1. Show AI correct metric template usage
 * 2. Provide examples for all common scenarios
 * 3. Serve as validation reference
 */

export const EXAMPLE_PLANS = {
  // ═══════════════════════════════════════════════════════════
  // EXAMPLE 1: Standard Strength Training Plan
  // ═══════════════════════════════════════════════════════════
  strength_4day: {
    name: "4-Day Upper/Lower Split",
    description: "Classic strength building program",
    weeklyPlan: [
      {
        day_of_week: 1, // Monday
        focus: "Upper Body",
        blocks: [
          {
            type: "single",
            exercises: [
              {
                exercise_name: "Barbell Bench Press",
                category: "main",
                metrics_template: {
                  type: "sets_reps_weight",
                  target_sets: 4,
                  target_reps: "8-10",
                  rest_period_s: 120,
                  rpe: 8,
                },
              },
              {
                exercise_name: "Barbell Row",
                category: "main",
                metrics_template: {
                  type: "sets_reps_weight",
                  target_sets: 4,
                  target_reps: 10,
                  rest_period_s: 90,
                  rpe: 7,
                },
              },
            ],
          },
        ],
      },
      {
        day_of_week: 3, // Wednesday
        focus: "Lower Body",
        blocks: [
          {
            type: "single",
            exercises: [
              {
                exercise_name: "Barbell Back Squat",
                category: "main",
                metrics_template: {
                  type: "sets_reps_weight",
                  target_sets: 4,
                  target_reps: "6-8",
                  rest_period_s: 180,
                  rpe: 8,
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // EXAMPLE 2: Twice Daily Training (AM Cardio / PM Strength)
  // ═══════════════════════════════════════════════════════════
  twice_daily_cardio_strength: {
    name: "2x Daily - AM Cardio / PM Strength",
    description: "Twice daily training with morning cardio and evening strength",
    weeklyPlan: [
      {
        day_of_week: 1, // Monday
        focus: "Cardio + Upper Strength",
        sessions: [
          {
            session_name: "AM Cardio",
            time_of_day: "morning",
            estimated_duration: 45,
            blocks: [
              {
                type: "single",
                exercises: [
                  {
                    exercise_name: "Treadmill Run",
                    category: "main",
                    metrics_template: {
                      type: "duration_only",
                      duration_minutes: 45,
                      rpe: 6,
                    },
                    notes: "Zone 2 cardio - conversational pace",
                  },
                ],
              },
            ],
          },
          {
            session_name: "PM Strength",
            time_of_day: "evening",
            estimated_duration: 60,
            blocks: [
              {
                type: "single",
                exercises: [
                  {
                    exercise_name: "Barbell Bench Press",
                    category: "main",
                    metrics_template: {
                      type: "sets_reps_weight",
                      target_sets: 4,
                      target_reps: 8,
                      rest_period_s: 120,
                      rpe: 8,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // EXAMPLE 3: Cardio-Focused Plan (Endurance Training)
  // ═══════════════════════════════════════════════════════════
  cardio_endurance: {
    name: "Endurance Training Plan",
    description: "Marathon/endurance focused with varied cardio",
    weeklyPlan: [
      {
        day_of_week: 1, // Monday
        focus: "Long Run",
        blocks: [
          {
            type: "single",
            exercises: [
              {
                exercise_name: "Treadmill Long Run",
                category: "main",
                metrics_template: {
                  type: "duration_only",
                  duration_minutes: 90,
                  rpe: 6,
                },
                notes: "Easy conversational pace",
              },
            ],
          },
        ],
      },
      {
        day_of_week: 3, // Wednesday
        focus: "Interval Training",
        blocks: [
          {
            type: "single",
            exercises: [
              {
                exercise_name: "Treadmill Sprint Intervals",
                category: "main",
                metrics_template: {
                  type: "sets_duration_rest",
                  sets: 8,
                  duration_seconds: 90,
                  rest_seconds: 90,
                  rpe: 9,
                },
                notes: "Hard effort, full recovery between intervals",
              },
            ],
          },
        ],
      },
      {
        day_of_week: 5, // Friday
        focus: "Tempo Run",
        blocks: [
          {
            type: "single",
            exercises: [
              {
                exercise_name: "Treadmill Tempo Run",
                category: "main",
                metrics_template: {
                  type: "duration_only",
                  duration_minutes: 40,
                  rpe: 8,
                },
                notes: "Comfortably hard pace",
              },
            ],
          },
        ],
      },
      {
        day_of_week: 6, // Saturday
        focus: "Cross-Training",
        blocks: [
          {
            type: "single",
            exercises: [
              {
                exercise_name: "Stationary Bike",
                category: "main",
                metrics_template: {
                  type: "duration_only",
                  duration_minutes: 60,
                  rpe: 6,
                },
              },
              {
                exercise_name: "Rowing Machine",
                category: "main",
                metrics_template: {
                  type: "duration_only",
                  duration_minutes: 20,
                  rpe: 7,
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // EXAMPLE 4: HIIT / Circuit Training
  // ═══════════════════════════════════════════════════════════
  hiit_circuit: {
    name: "HIIT Circuit Training",
    description: "High intensity interval and circuit work",
    weeklyPlan: [
      {
        day_of_week: 1,
        focus: "Full Body HIIT",
        blocks: [
          {
            type: "amrap",
            duration_minutes: 10,
            exercises: [
              {
                exercise_name: "Burpees",
                category: "main",
                metrics_template: {
                  type: "sets_reps",
                  target_reps: 10,
                },
              },
              {
                exercise_name: "Kettlebell Swings",
                category: "main",
                metrics_template: {
                  type: "sets_reps",
                  target_reps: 15,
                },
              },
              {
                exercise_name: "Box Jumps",
                category: "main",
                metrics_template: {
                  type: "sets_reps",
                  target_reps: 10,
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // EXAMPLE 5: Bodyweight Training
  // ═══════════════════════════════════════════════════════════
  bodyweight: {
    name: "Bodyweight Strength",
    description: "No equipment required",
    weeklyPlan: [
      {
        day_of_week: 1,
        focus: "Upper Body",
        blocks: [
          {
            type: "single",
            exercises: [
              {
                exercise_name: "Push-ups",
                category: "main",
                metrics_template: {
                  type: "sets_reps",
                  target_sets: 4,
                  target_reps: 15,
                  rest_period_s: 60,
                  rpe: 7,
                },
              },
              {
                exercise_name: "Pull-ups",
                category: "main",
                metrics_template: {
                  type: "sets_reps",
                  target_sets: 4,
                  target_reps: 8,
                  rest_period_s: 90,
                  rpe: 8,
                },
              },
              {
                exercise_name: "Plank",
                category: "main",
                metrics_template: {
                  type: "sets_duration",
                  target_sets: 3,
                  duration_seconds: 60,
                  rest_period_s: 60,
                  rpe: 7,
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * Get example plan prompt for AI reference
 */
export function getExamplePlansPrompt(): string {
  return `
**PERFECT PLAN EXAMPLES - REFERENCE THESE**

Below are PERFECT examples of correctly formatted plans. Study these carefully.

═══════════════════════════════════════════════════════════
EXAMPLE 1: TWICE DAILY TRAINING (AM Cardio / PM Strength)
═══════════════════════════════════════════════════════════

THIS IS THE CORRECT FORMAT FOR 2x DAILY TRAINING:

${JSON.stringify(EXAMPLE_PLANS.twice_daily_cardio_strength, null, 2)}

CRITICAL OBSERVATIONS:
- Uses "sessions" array instead of "blocks" at day level
- Each session has "session_name", "time_of_day", "estimated_duration"
- AM Cardio uses "duration_only" metrics template (NOT "cardio" or custom format!)
- PM Strength uses "sets_reps_weight" metrics template

═══════════════════════════════════════════════════════════
EXAMPLE 2: CARDIO-FOCUSED TRAINING
═══════════════════════════════════════════════════════════

THIS IS HOW TO FORMAT PURE CARDIO DAYS:

${JSON.stringify(EXAMPLE_PLANS.cardio_endurance.weeklyPlan[0], null, 2)}

CRITICAL: Treadmill, bike, elliptical → "type": "duration_only" with "duration_minutes"

═══════════════════════════════════════════════════════════
EXAMPLE 3: INTERVAL TRAINING
═══════════════════════════════════════════════════════════

THIS IS HOW TO FORMAT INTERVALS:

${JSON.stringify(EXAMPLE_PLANS.cardio_endurance.weeklyPlan[1], null, 2)}

CRITICAL: Use "sets_duration_rest" for timed intervals (30s work / 90s rest)

═══════════════════════════════════════════════════════════
VALIDATION CHECKLIST
═══════════════════════════════════════════════════════════

Before outputting your plan, verify:

✅ All exercises have "metrics_template" object
✅ All metrics_template have "type" field
✅ "type" matches one of the approved templates (sets_reps_weight, duration_only, etc.)
✅ Required fields for that template are present
✅ Cardio machines use "duration_only" (not "cardio", "treadmill", etc.)
✅ Strength exercises use "sets_reps_weight" (not "reps_weight", "weight_reps", etc.)
✅ 2x daily plans use "sessions" array (not "blocks" at day level)
✅ All categories are "warmup", "main", or "cooldown" (not "strength", "cardio", etc.)

`;
}

/**
 * CONDENSED example prompt - same structure info, ~70% fewer tokens
 * Used for speed optimization when full examples aren't needed
 */
export function getCondensedExamplePrompt(isTwiceDaily: boolean = false): string {
  if (isTwiceDaily) {
    // Only show 2x daily structure when needed
    return `**PLAN STRUCTURE (2x Daily)**

Day structure:
\`\`\`json
{
  "day_of_week": 1,
  "focus": "Cardio + Upper Strength",
  "sessions": [
    {
      "session_name": "AM Cardio",
      "time_of_day": "morning",
      "estimated_duration": 45,
      "blocks": [{ "type": "single", "exercises": [...] }]
    },
    {
      "session_name": "PM Strength",
      "time_of_day": "evening",
      "estimated_duration": 60,
      "blocks": [{ "type": "single", "exercises": [...] }]
    }
  ]
}
\`\`\`

Exercise structure:
\`\`\`json
{"exercise_name": "Treadmill Run", "category": "main", "metrics_template": {"type": "duration_only", "duration_minutes": 45, "rpe": 6}}
{"exercise_name": "Barbell Bench Press", "category": "main", "metrics_template": {"type": "sets_reps_weight", "target_sets": 4, "target_reps": 8, "rpe": 8}}
\`\`\`

RULES:
- 2x daily uses "sessions" array (NOT "blocks" at day level)
- AM Cardio → duration_only template
- PM Strength → sets_reps_weight template
- All categories: "warmup", "main", or "cooldown"
`;
  }

  // Standard 1x daily structure
  return `**PLAN STRUCTURE**

Day structure:
\`\`\`json
{
  "day_of_week": 1,
  "focus": "Upper Body",
  "blocks": [
    {
      "type": "single",
      "exercises": [
        {"exercise_name": "Barbell Bench Press", "category": "main", "metrics_template": {"type": "sets_reps_weight", "target_sets": 4, "target_reps": "8-10", "rest_period_s": 90, "rpe": 7}}
      ]
    }
  ]
}
\`\`\`

Block types: "single" (normal), "superset" (back-to-back), "amrap" (timed circuit with duration_minutes)

RULES:
- Standard plans use "blocks" array directly on day
- All exercises must have "metrics_template" with "type" field
- All categories: "warmup", "main", or "cooldown"
`;
}
