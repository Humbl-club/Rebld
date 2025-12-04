/**
 * AI Helper Utilities
 *
 * Robust helpers for AI generation with retry logic, JSON extraction, and validation
 */

import { validateWorkoutPlan, fixCardioTemplates, type ValidationResult } from "../planValidator";

// ═══════════════════════════════════════════════════════════
// Type definitions for plan structures (aligned with planValidator.ts)
// ═══════════════════════════════════════════════════════════

interface MetricsTemplate {
  type: string;
  target_sets?: number;
  sets?: number;
  target_reps?: string | number;
  duration_minutes?: number;
  target_duration_minutes?: number;
  duration_seconds?: number;
  target_duration_s?: number;
  rest_seconds?: number;
  rest_period_s?: number;
  distance_km?: number;
  distance_m?: number;
  [key: string]: unknown;
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

// Generic AI model interface
interface AIModel {
  generateContent: (config: GenerationConfig) => Promise<GenerationResult>;
}

interface GenerationConfig {
  model?: string;
  contents: Array<{ parts: Array<{ text: string }> }>;
  config?: Record<string, unknown>;
}

interface GenerationResult {
  text?: string;
  response?: { text: () => string };
}

/**
 * Extract and parse JSON from AI response (handles markdown, extra text, etc.)
 */
export function extractAndParseJSON(text: string): unknown {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  // Find JSON object boundaries
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}') + 1;

  if (jsonStart === -1 || jsonEnd === 0) {
    throw new Error('No valid JSON found in response');
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Attempt to fix common issues
    cleaned = cleaned
      .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/\n/g, ' ')      // Remove newlines
      .replace(/\t/g, ' ');     // Remove tabs

    return JSON.parse(cleaned); // Retry
  }
}

/**
 * Generate content with retry logic and validation
 */
export async function generateWithRetry(
  model: AIModel,
  config: GenerationConfig,
  validateFn?: (parsed: Plan) => ValidationResult,
  maxAttempts: number = 3,
  sessionDurationMinutes: number = 60 // For cardio template fixing
): Promise<Plan> {
  let lastError: Error | null = null;
  let validationErrors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${maxAttempts}] Generating content...`);

      // Add validation feedback to subsequent attempts
      if (attempt > 1 && validationErrors.length > 0) {
        const errorList = validationErrors.map((e, i) => `${i + 1}. ${e}`).join('\n');
        const feedbackText = `\n\nPREVIOUS ATTEMPT HAD ERRORS - FIX THESE:\n${errorList}\n\nRegenerate with these fixes applied.`;

        // Add feedback to the prompt
        if (config.contents && config.contents[0] && config.contents[0].parts) {
          config.contents[0].parts.push({ text: feedbackText });
        }
      }

      // Call AI
      const result = await model.generateContent(config);
      const text = result.text || result.response?.text() || '';

      // Extract and parse JSON
      const parsed = extractAndParseJSON(text) as Plan;

      // [SPEED OPTIMIZATION] Auto-fix common issues BEFORE validation
      // This prevents unnecessary retries for fixable problems
      let fixedPlan = parsed;
      if (parsed.weeklyPlan) {
        fixedPlan = fixCardioTemplates(parsed, sessionDurationMinutes) as Plan;
        console.log(`[Attempt ${attempt}] Auto-fixed cardio templates`);
      }

      // Validate the FIXED plan (not the original)
      if (validateFn) {
        const validation = validateFn(fixedPlan);

        if (validation.valid) {
          console.log(`[Attempt ${attempt}] SUCCESS - Valid plan generated`);
          if (validation.warnings.length > 0) {
            console.warn(`[Warnings] ${validation.warnings.join(', ')}`);
          }
          return fixedPlan; // Return the auto-fixed plan
        }

        // Invalid - prepare for retry
        validationErrors = validation.errors;
        console.warn(`[Attempt ${attempt}] INVALID - Errors: ${validation.errors.join(', ')}`);

        if (attempt === maxAttempts) {
          throw new Error(`Plan validation failed after ${maxAttempts} attempts: ${validation.errors.join(', ')}`);
        }

        // Continue to next attempt
        continue;
      }

      // No validation - return the auto-fixed result
      return fixedPlan;

    } catch (error: any) {
      lastError = error;
      console.error(`[Attempt ${attempt}] ERROR: ${error.message}`);

      if (attempt === maxAttempts) {
        throw new Error(`Generation failed after ${maxAttempts} attempts: ${lastError?.message || 'Unknown error'}`);
      }

      // Reduced backoff - 300-500ms is sufficient, no need for 1-3s delays
      const delay = 300 + Math.floor(Math.random() * 200);
      console.log(`[Retry] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Generation failed');
}

/**
 * Estimate workout duration based on plan structure
 */
export function estimateWorkoutDuration(day: Day | { blocks?: Block[] }): number {
  let totalMinutes = 0;

  // Handle both single-session (blocks) and 2x-daily (sessions)
  const blocksToProcess: Block[] = [];

  if (day.blocks && Array.isArray(day.blocks)) {
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
        const restSeconds = ex.rest_seconds || 120;
        const workTimePerSet = 30; // ~30 seconds per set (conservative)
        const totalSetTime = (workTimePerSet + restSeconds) * sets;
        totalMinutes += totalSetTime / 60;
      }
      // Cardio - duration
      else if (metricsTemplate.type === 'duration_only') {
        totalMinutes += metricsTemplate.duration_minutes || 0;
      }
      // Distance + duration
      else if (metricsTemplate.type === 'distance_duration') {
        totalMinutes += metricsTemplate.target_duration_minutes || 0;
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

/**
 * Add duration estimates to plan
 */
export function addDurationEstimates(plan: Plan): Plan {
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

/**
 * Heart rate zones reference
 */
export const HEART_RATE_ZONES = {
  zone1: { min: 100, max: 115, rpe: '3-4', description: 'Recovery - Easy conversation' },
  zone2: { min: 115, max: 135, rpe: '5-6', description: 'Aerobic - Conversational pace (TARGET for general fitness)' },
  zone3: { min: 135, max: 155, rpe: '7-8', description: 'Tempo - Challenging but sustainable' },
  zone4: { min: 155, max: 175, rpe: '8-9', description: 'Threshold - Very hard, short bursts' },
};

/**
 * Get heart rate guidance prompt
 */
export function getHeartRateGuidance(): string {
  return `
**CARDIO INTENSITY ZONES (for cardio exercises):**
- Zone 1 (Recovery): 100-115 BPM, RPE 3-4, "Easy conversation"
- Zone 2 (Aerobic): 115-135 BPM, RPE 5-6, "Conversational pace" ← TARGET FOR GENERAL FITNESS & FAT LOSS
- Zone 3 (Tempo): 135-155 BPM, RPE 7-8, "Challenging but sustainable"
- Zone 4 (Threshold): 155-175 BPM, RPE 8-9, "Very hard, short bursts"

**CRITICAL:** For cardio exercises, add target heart rate to notes:
- General fitness/fat loss → "Target: 120-130 BPM (Zone 2)"
- Conditioning → "Target: 140-150 BPM (Zone 3)"
- HIIT intervals → "Target: 160+ BPM (Zone 4)"

This helps users track intensity with heart rate monitors.
`;
}

/**
 * Get duration constraint prompt - for STRENGTH TRAINING ONLY
 * Cardio duration is handled separately based on user preferences and goals
 */
export function getDurationConstraintPrompt(sessionLength: number): string {
  return `
**CRITICAL: STRENGTH SESSION DURATION (${sessionLength} minutes)**
The ${sessionLength}-minute constraint applies to LIFTING/STRENGTH sessions ONLY.
Cardio duration is handled separately based on user preferences and goals.

**Duration Calculation for STRENGTH sessions:**
- Warmup: ~1 minute per exercise (5-7 min total)
- Strength work: 3 sets × (30s work + 2min rest) = ~8 minutes per exercise
- Cooldown: ~1 minute per exercise (3-5 min total)
- Supersets: Count exercises separately, rest applies between rounds

**Example for ${sessionLength}-minute STRENGTH session:**
- Warmup: 7 exercises = 7 min
- Main work: ${Math.floor((sessionLength - 15) / 8)} exercises × 8 min = ${Math.floor((sessionLength - 15) / 8) * 8} min
- Cooldown: 4 stretches = 4 min

IMPORTANT:
- For "sessions" array (2x daily training), set PM strength session "estimated_duration": ${sessionLength}
- For cardio sessions, use the cardio duration from user preferences (NOT this constraint)
- For single-session days, add "estimated_duration": ${sessionLength} to the day
`;
}
