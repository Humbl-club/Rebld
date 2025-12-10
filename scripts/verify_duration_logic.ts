
// Mock types to match the logic
interface MetricsTemplate {
    type: string;
    target_sets?: number;
    sets?: number;
    target_reps?: string | number;
    duration_minutes?: number | string;
    target_duration_minutes?: number | string;
    duration_seconds?: number | string;
    target_duration_s?: number | string;
    rest_seconds?: number;
    rest_period_s?: number;
    distance_km?: number;
    distance_m?: number;
}

interface Exercise {
    exercise_name: string;
    category: string;
    metrics_template: MetricsTemplate;
    rest_seconds?: number;
    rpe?: string;
    notes?: string;
}

interface Block {
    type: string;
    exercises: Exercise[];
    duration_minutes?: number;
    rounds?: number;
}

interface Session {
    session_name: string;
    time_of_day: string;
    blocks: Block[];
    estimated_duration?: number;
}

interface Day {
    day_of_week: number;
    focus: string;
    blocks?: Block[];
    sessions?: Session[];
    estimated_duration?: number;
}

interface Plan {
    name: string;
    weeklyPlan: Day[];
    periodization?: Record<string, unknown>;
}

// COPIED LOGIC FROM convex/utils/aiHelpers.ts

function estimateWorkoutDuration(day: Day | { blocks?: Block[] }): number {
    let totalMinutes = 0;

    // Handle both single-session (blocks) and 2x-daily (sessions)
    const blocksToProcess: Block[] = [];

    if ('blocks' in day && day.blocks && Array.isArray(day.blocks)) {
        blocksToProcess.push(...day.blocks);
    }

    if ('sessions' in day && day.sessions && Array.isArray(day.sessions)) {
        day.sessions.forEach((session: Session) => {
            if (session.blocks && Array.isArray(session.blocks)) {
                blocksToProcess.push(...session.blocks);
            }
        });
    }

    // Calculate duration for each block
    blocksToProcess.forEach(block => {
        if (!block.exercises || !Array.isArray(block.exercises)) return;

        block.exercises.forEach((ex: Exercise) => {
            const category = ex.category || 'main';
            const metricsTemplate = ex.metrics_template || {} as MetricsTemplate;

            // Warmup/cooldown: ~1 min per exercise
            if (category === 'warmup' || category === 'cooldown') {
                totalMinutes += 1;
            }
            // Main work - strength
            else if (metricsTemplate.type === 'sets_reps_weight' || metricsTemplate.type === 'sets_reps') {
                const sets = metricsTemplate.target_sets || 3;
                const restSeconds = metricsTemplate.rest_seconds || 120;
                const workTimePerSet = 30; // ~30 seconds per set (conservative)
                const totalSetTime = (workTimePerSet + restSeconds) * sets;
                totalMinutes += totalSetTime / 60;
            }
            // Cardio - duration
            else if (metricsTemplate.type === 'duration_only') {
                const duration = typeof metricsTemplate.duration_minutes === 'string'
                    ? parseInt(metricsTemplate.duration_minutes) || 0
                    : metricsTemplate.duration_minutes || 0;
                totalMinutes += duration;
            }
            // Distance + duration
            else if (metricsTemplate.type === 'distance_duration') {
                const duration = typeof metricsTemplate.target_duration_minutes === 'string'
                    ? parseInt(metricsTemplate.target_duration_minutes) || 0
                    : metricsTemplate.target_duration_minutes || 0;
                totalMinutes += duration;
            }
            // AMRAP blocks
            else if (block.type === 'amrap') {
                totalMinutes += block.duration_minutes || 10;
            }
            // Default fallback
            else {
                totalMinutes += 2; // Conservative estimate
            }
        });
    });

    return Math.round(totalMinutes);
}

function addDurationEstimates(plan: Plan): Plan {
    if (!plan.weeklyPlan || !Array.isArray(plan.weeklyPlan)) {
        return plan;
    }

    plan.weeklyPlan.forEach((day: Day) => {
        // Single session - add to day level
        if (day.blocks) {
            day.estimated_duration = estimateWorkoutDuration(day);
        }

        // 2x daily - add to each session
        if (day.sessions && Array.isArray(day.sessions)) {
            day.sessions.forEach((session: Session) => {
                session.estimated_duration = estimateWorkoutDuration({ blocks: session.blocks });
            });
        }
    });

    return plan;
}

// TEST CASES

const samplePlan: Plan = {
    name: "Test Plan",
    weeklyPlan: [
        {
            day_of_week: 1,
            focus: "Strength",
            blocks: [
                {
                    type: "single",
                    exercises: [
                        {
                            exercise_name: "Warmup 1",
                            category: "warmup",
                            metrics_template: { type: "sets_reps", target_sets: 2 }
                        },
                        {
                            exercise_name: "Warmup 2",
                            category: "warmup",
                            metrics_template: { type: "sets_reps", target_sets: 2 }
                        }
                    ]
                },
                {
                    type: "single",
                    exercises: [
                        {
                            exercise_name: "Bench Press",
                            category: "main",
                            metrics_template: {
                                type: "sets_reps_weight",
                                target_sets: 3,
                                rest_seconds: 120
                            }
                        }
                    ]
                },
                {
                    type: "single",
                    exercises: [
                        {
                            exercise_name: "Cool down stretch",
                            category: "cooldown",
                            metrics_template: { type: "sets_reps" }
                        }
                    ]
                }
            ]
        },
        {
            day_of_week: 2,
            focus: "Cardio",
            blocks: [
                {
                    type: "single",
                    exercises: [
                        {
                            exercise_name: "Run",
                            category: "main",
                            metrics_template: {
                                type: "duration_only",
                                duration_minutes: 45
                            }
                        }
                    ]
                }
            ]
        },
        {
            day_of_week: 3,
            focus: "2x Day Split",
            sessions: [
                {
                    session_name: "AM Cardio",
                    time_of_day: "morning",
                    blocks: [
                        {
                            type: "single",
                            exercises: [
                                {
                                    exercise_name: "Morning Jog",
                                    category: "main",
                                    metrics_template: {
                                        type: "duration_only",
                                        duration_minutes: 30
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    session_name: "PM Lift",
                    time_of_day: "evening",
                    blocks: [
                        {
                            type: "single",
                            exercises: [
                                {
                                    exercise_name: "Squat",
                                    category: "main",
                                    metrics_template: {
                                        type: "sets_reps_weight",
                                        target_sets: 3,
                                        rest_seconds: 180
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

console.log("Running simulation...");
const processed = addDurationEstimates(samplePlan);

console.log("Day 1 (Strength) Duration:", processed.weeklyPlan[0].estimated_duration);
// Warmup: 2 mins
// Bench: 3 * (30s work + 120s rest) = 3 * 150s = 450s = 7.5 mins.
// Cooldown: 1 min.
// Total: ~10.5 -> 11 mins? Or check rounding.
// Logic: warmup=1, warmup=1. Total=2.
// Bench: (30+120)*3 / 60 = 7.5. Total=9.5.
// Cooldown: 1. Total=10.5. Round -> 11.

console.log("Day 2 (Cardio) Duration:", processed.weeklyPlan[1].estimated_duration);
// 45 mins.

console.log("Day 3 (2x Day) Session 1:", processed.weeklyPlan[2].sessions![0].estimated_duration);
// 30 mins.
console.log("Day 3 (2x Day) Session 2:", processed.weeklyPlan[2].sessions![1].estimated_duration);
// Squat: 3 * (30+180) / 60 = 3 * 210 / 60 = 630 / 60 = 10.5. Round -> 11.

console.log("---------------------------------------------------");
console.log("VERIFICATION RESULTS:");
if (processed.weeklyPlan[0].estimated_duration && processed.weeklyPlan[0].estimated_duration > 0) {
    console.log("PASS: Day 1 duration calculated.");
} else {
    console.error("FAIL: Day 1 duration missing.");
}

if (processed.weeklyPlan[1].estimated_duration === 45) {
    console.log("PASS: Day 2 duration correct (45).");
} else {
    console.error("FAIL: Day 2 duration incorrect.");
}

if (processed.weeklyPlan[2].sessions![0].estimated_duration === 30) {
    console.log("PASS: Day 3 AM Session duration correct (30).");
} else {
    console.error("FAIL: Day 3 AM Session duration incorrect.");
}

