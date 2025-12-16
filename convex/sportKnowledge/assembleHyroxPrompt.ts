/**
 * Prompt Assembly for Hyrox Plan Generation
 *
 * This file combines user profile data with HYROX_KNOWLEDGE to create
 * a highly constrained prompt for the LLM. The LLM receives explicit
 * volume targets, pace guidance, and requirements - it fills in the
 * creative details while respecting all constraints.
 *
 * Key principle: Individualization happens HERE, not in the LLM.
 * The LLM executes, it doesn't decide fundamental parameters.
 */

import {
  HYROX_KNOWLEDGE,
  Phase,
  ExperienceLevel,
  calculatePhase,
  getVolumeTargets,
  calculateRunningPaces,
  PHASES,
  STATIONS,
  TRAINING_PRINCIPLES,
  ANTI_PATTERNS,
  INJURY_RISKS,
  EQUIPMENT_SUBSTITUTIONS,
  SESSION_TEMPLATES,
} from './hyrox';

// =============================================================================
// TYPES
// =============================================================================

export type Division = 'open' | 'pro' | 'doubles' | 'relay';

export interface UserProfile {
  // Personal info
  userId: string;
  name?: string;

  // Competition details
  competition: {
    date: Date;
    division: Division;
    isFirstRace: boolean;
    targetTimeMinutes?: number;
    previousBestTimeMinutes?: number;
  };

  // Current fitness assessment
  fitness: {
    runningLevel: 'beginner' | 'intermediate' | 'advanced';
    comfortable5kTimeMinutes?: number;
    weeklyRunningKm?: number;
    strengthLevel: 'beginner' | 'intermediate' | 'advanced';
    maxes?: {
      benchPressKg?: number;
      backSquatKg?: number;
      deadliftKg?: number;
    };
    trainingYears?: number;
    currentWeeklyHours?: number;
  };

  // Station proficiency
  stations?: {
    weak?: string[]; // e.g., ['sled_push', 'wall_balls']
    strong?: string[]; // e.g., ['rowing', 'skierg']
    neverDone?: string[]; // Stations user has never practiced - need technique focus
  };

  // Schedule constraints
  schedule: {
    trainingDays: 3 | 4 | 5 | 6;
    availableDays?: string[]; // e.g., ['monday', 'wednesday', 'friday', 'saturday'] - optional, derived if not provided
    sessionLengthMinutes: number;
    canDoTwoADay?: boolean;
  };

  // Physical constraints
  constraints: {
    painPoints?: string[]; // e.g., ['lower_back', 'knees']
    injuries?: Array<{
      area: string;
      severity: 'mild' | 'moderate' | 'severe';
      notes?: string;
    }>;
  };

  // Equipment access
  equipment: {
    gymType: 'commercial' | 'crossfit_box' | 'hyrox_affiliate' | 'home';
    missingEquipment?: string[]; // e.g., ['SkiErg', 'Sled']
  };

  // Preferences (HIGHEST PRIORITY)
  preferences?: {
    intensityPreference?: 'conservative' | 'moderate' | 'aggressive';
    additionalNotes?: string;
  };
}

export interface WeekContext {
  weekNumber: number;
  phase: Phase;
  isPhaseTransition: boolean;
  previousWeekActuals?: {
    runningKm: number;
    completionRate: number;
  };
  persistentPreferences?: string[];

  // Adaptation fields from weekSummary
  previousWeekFeeling?: 'too_easy' | 'just_right' | 'challenging' | 'too_hard';
  sessionsMissed?: string[];  // ["Monday", "Thursday"] - for scheduling awareness
}

export interface AssembledPrompt {
  systemPrompt: string;
  userPrompt: string;
  metadata: {
    phase: Phase;
    experienceLevel: ExperienceLevel;
    weekNumber: number;
    volumeTargets: ReturnType<typeof getVolumeTargets>;
    runningPaces?: ReturnType<typeof calculateRunningPaces>;
    injuryModifications: string[];
    equipmentSubstitutions: string[];
  };
}

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate weeks until competition
 */
export function calculateWeeksOut(competitionDate: Date): number {
  const now = new Date();
  const diffMs = competitionDate.getTime() - now.getTime();
  const diffWeeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diffWeeks);
}

/**
 * Determine experience level from fitness assessment
 * Weighted: Running 50%, Strength 30%, Years 20%
 */
export function calculateExperienceLevel(fitness: UserProfile['fitness']): ExperienceLevel {
  const levelScore = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
  };

  const runningScore = levelScore[fitness.runningLevel];
  const strengthScore = levelScore[fitness.strengthLevel];

  // Years of training (0-2 = beginner, 3-5 = intermediate, 6+ = advanced)
  let yearsScore = 1;
  if (fitness.trainingYears) {
    if (fitness.trainingYears >= 6) yearsScore = 3;
    else if (fitness.trainingYears >= 3) yearsScore = 2;
  }

  // Weighted average (running is primary per research)
  const weighted = (runningScore * 0.5) + (strengthScore * 0.3) + (yearsScore * 0.2);

  if (weighted >= 2.5) return 'advanced';
  if (weighted >= 1.5) return 'intermediate';
  return 'beginner';
}

/**
 * Get division-specific weights
 */
function getDivisionWeights(division: Division): {
  sled_push_kg: number;
  sled_pull_kg: number;
  farmers_carry_kg_per_hand: number;
  sandbag_kg: number;
  wall_ball_kg: number;
  wall_ball_height_m: number;
} {
  // Default to men's open weights
  const weights = {
    open_men: {
      sled_push_kg: 152,
      sled_pull_kg: 103,
      farmers_carry_kg_per_hand: 24,
      sandbag_kg: 20,
      wall_ball_kg: 9,
      wall_ball_height_m: 3,
    },
    open_women: {
      sled_push_kg: 102,
      sled_pull_kg: 78,
      farmers_carry_kg_per_hand: 16,
      sandbag_kg: 10,
      wall_ball_kg: 6,
      wall_ball_height_m: 2.7,
    },
    pro_men: {
      sled_push_kg: 202,
      sled_pull_kg: 153,
      farmers_carry_kg_per_hand: 32,
      sandbag_kg: 30,
      wall_ball_kg: 9,
      wall_ball_height_m: 3,
    },
    pro_women: {
      sled_push_kg: 152,
      sled_pull_kg: 103,
      farmers_carry_kg_per_hand: 24,
      sandbag_kg: 20,
      wall_ball_kg: 6,
      wall_ball_height_m: 3,
    },
  };

  // Return open men as default
  if (division === 'pro') return weights.pro_men;
  return weights.open_men;
}

/**
 * Adjust volume targets based on user constraints
 */
export function getAdjustedVolumeTargets(
  baseTargets: ReturnType<typeof getVolumeTargets>,
  userProfile: UserProfile,
): ReturnType<typeof getVolumeTargets> {
  const adjusted = JSON.parse(JSON.stringify(baseTargets)); // Deep clone

  // Parse running range from string like "35-50km/week"
  const runningMatch = adjusted.running.match(/(\d+)-(\d+)/);
  let runningMin = runningMatch ? parseInt(runningMatch[1]) : 30;
  let runningMax = runningMatch ? parseInt(runningMatch[2]) : 50;

  // Cap running increase to 20% above current volume
  if (userProfile.fitness.weeklyRunningKm) {
    const maxSafe = userProfile.fitness.weeklyRunningKm * 1.2;
    runningMax = Math.min(runningMax, maxSafe);
    runningMin = Math.min(runningMin, runningMax);
  }

  // Reduce targets if limited training hours
  if (userProfile.fitness.currentWeeklyHours && userProfile.fitness.currentWeeklyHours < 5) {
    const reductionFactor = userProfile.fitness.currentWeeklyHours / 5;
    runningMin = Math.round(runningMin * reductionFactor);
    runningMax = Math.round(runningMax * reductionFactor);
  }

  // Return with adjusted running
  return {
    ...adjusted,
    runningMin,
    runningMax,
  };
}

/**
 * Build injury protocol section
 */
function buildInjuryProtocol(constraints: UserProfile['constraints']): string[] {
  const protocols: string[] = [];

  if (!constraints.painPoints?.length && !constraints.injuries?.length) {
    return protocols;
  }

  // Map pain points to injury risk data
  const injuryMap: Record<string, typeof INJURY_RISKS[0] | undefined> = {};
  for (const risk of INJURY_RISKS) {
    injuryMap[risk.area.toLowerCase()] = risk;
  }

  // Handle pain points
  for (const area of constraints.painPoints || []) {
    const risk = injuryMap[area.toLowerCase()];
    if (risk) {
      protocols.push(`## ${area.toUpperCase()} SENSITIVITY`);
      protocols.push(`Exercises to AVOID: ${risk.prevention.join(', ')}`);
      protocols.push(`Modifications: ${risk.modifications.join('; ')}`);
      protocols.push('');
    }
  }

  // Handle specific injuries
  for (const injury of constraints.injuries || []) {
    const risk = injuryMap[injury.area.toLowerCase()];
    if (risk) {
      protocols.push(`## ${injury.area.toUpperCase()} INJURY (${injury.severity})`);
      if (injury.severity === 'severe') {
        protocols.push('⚠️ SEVERE - Minimize all loading on this area');
      }
      protocols.push(`Warning signs: ${risk.warningSignsSigns.join(', ')}`);
      protocols.push(`Modifications: ${risk.modifications.join('; ')}`);
      if (injury.notes) {
        protocols.push(`Athlete notes: ${injury.notes}`);
      }
      protocols.push('');
    }
  }

  return protocols;
}

/**
 * Build equipment substitution section
 */
function buildEquipmentSubstitutions(equipment: UserProfile['equipment']): string[] {
  const subs: string[] = [];

  if (!equipment.missingEquipment?.length) {
    return subs;
  }

  for (const missing of equipment.missingEquipment) {
    const key = missing.toLowerCase() as keyof typeof EQUIPMENT_SUBSTITUTIONS;
    const sub = EQUIPMENT_SUBSTITUTIONS[key];
    if (sub) {
      subs.push(`## NO ${missing.toUpperCase()}`);
      subs.push(`Preferred: ${sub.preferred.join(', ')}`);
      subs.push(`Alternatives: ${sub.alternatives.join(', ')}`);
      subs.push(`Note: ${sub.notes}`);
      subs.push('');
    }
  }

  return subs;
}

/**
 * Build station focus section based on weak/strong/neverDone stations
 */
function buildStationFocus(stations?: UserProfile['stations']): string {
  if (!stations) {
    return 'All 8 stations should appear at least 1x per week with equal emphasis.';
  }

  const lines: string[] = [];

  // NEVER DONE stations get highest priority - technique familiarization
  if (stations.neverDone?.length) {
    lines.push(`## STATIONS NEVER PRACTICED - FAMILIARIZATION PRIORITY`);
    lines.push(`Stations: ${stations.neverDone.join(', ')}`);
    lines.push('');
    lines.push('For these stations:');
    lines.push('- Start with 50-60% of normal volume');
    lines.push('- Include explicit technique cues in exercise notes');
    lines.push('- Focus on movement quality over speed/load');
    lines.push('- Build confidence before intensity');
    lines.push('- Must appear 1-2x per week for familiarization');
    lines.push('');
  }

  if (stations.weak?.length) {
    lines.push(`WEAK STATIONS (2x per week minimum): ${stations.weak.join(', ')}`);
    lines.push('These stations need extra practice volume and technique work.');
  }

  if (stations.strong?.length) {
    lines.push(`STRONG STATIONS (1x per week maintenance): ${stations.strong.join(', ')}`);
    lines.push('Maintain proficiency without over-investing time.');
  }

  const allStations = Object.keys(STATIONS);
  const remainingStations = allStations.filter(s =>
    !stations.weak?.includes(s) &&
    !stations.strong?.includes(s) &&
    !stations.neverDone?.includes(s)
  );

  if (remainingStations.length) {
    lines.push(`NEUTRAL STATIONS (1-2x per week): ${remainingStations.join(', ')}`);
  }

  return lines.join('\n');
}

// =============================================================================
// MAIN PROMPT ASSEMBLY FUNCTION
// =============================================================================

/**
 * Assemble the complete prompt for Hyrox plan generation
 * Combines user profile with HYROX_KNOWLEDGE to create constrained prompt
 */
export function assembleHyroxPrompt(
  userProfile: UserProfile,
  weekContext?: WeekContext,
): AssembledPrompt {

  // Calculate derived values
  const weeksOut = calculateWeeksOut(userProfile.competition.date);
  const phase = weekContext?.phase || calculatePhase(weeksOut);
  const experienceLevel = calculateExperienceLevel(userProfile.fitness);
  const weekNumber = weekContext?.weekNumber || 1;

  // Get phase-specific data
  const phaseData = PHASES[phase];
  const baseVolumeTargets = getVolumeTargets(phase, experienceLevel);
  const adjustedVolumeTargets = getAdjustedVolumeTargets(baseVolumeTargets, userProfile);

  // Get division weights
  const divisionWeights = getDivisionWeights(userProfile.competition.division);

  // Calculate running paces if 5K time provided
  const runningPaces = userProfile.fitness.comfortable5kTimeMinutes
    ? calculateRunningPaces(userProfile.fitness.comfortable5kTimeMinutes * 2) // Convert to target finish
    : null;

  // Get session structure
  const sessionStructure = SESSION_TEMPLATES[userProfile.schedule.trainingDays];

  // Build conditional sections
  const injuryProtocols = buildInjuryProtocol(userProfile.constraints);
  const equipmentSubs = buildEquipmentSubstitutions(userProfile.equipment);
  const stationFocus = buildStationFocus(userProfile.stations);

  // Build the system prompt
  const systemPrompt = buildSystemPrompt();

  // Build the user prompt with all context
  const userPrompt = buildUserPrompt(
    userProfile,
    phase,
    phaseData,
    experienceLevel,
    adjustedVolumeTargets,
    divisionWeights,
    runningPaces,
    sessionStructure,
    injuryProtocols,
    equipmentSubs,
    stationFocus,
    weeksOut,
    weekNumber,
    weekContext,
  );

  return {
    systemPrompt,
    userPrompt,
    metadata: {
      phase,
      experienceLevel,
      weekNumber,
      volumeTargets: adjustedVolumeTargets,
      runningPaces: runningPaces || undefined,
      injuryModifications: injuryProtocols,
      equipmentSubstitutions: equipmentSubs,
    },
  };
}

/**
 * Build the system prompt (role and critical context)
 */
function buildSystemPrompt(): string {
  const keyInsight = TRAINING_PRINCIPLES.polarizedTraining.explanation;

  return `You are an expert Hyrox coach creating personalized weekly training plans.

CRITICAL CONTEXT - What Hyrox Actually Is:
${keyInsight}

Your plans must reflect this fundamental truth:
- Running accounts for 60% of race time
- VO2max is the #1 performance predictor (correlation: -0.71)
- Elite athletes do 80%+ of training at low intensity
- Strength training maintains capacity but doesn't predict faster times

You will receive specific volume targets, pace guidance, and constraints.
Your job is to fill in the creative details (exercise selection, session flow, progression)
while STRICTLY adhering to all provided constraints.

Output format: Valid JSON matching the provided schema.
Never output anything other than the JSON plan.`;
}

/**
 * Build the detailed user prompt with all context
 */
function buildUserPrompt(
  userProfile: UserProfile,
  phase: Phase,
  phaseData: typeof PHASES.BASE,
  experienceLevel: ExperienceLevel,
  volumeTargets: ReturnType<typeof getAdjustedVolumeTargets>,
  divisionWeights: ReturnType<typeof getDivisionWeights>,
  runningPaces: ReturnType<typeof calculateRunningPaces> | null,
  sessionStructure: typeof SESSION_TEMPLATES[3] | undefined,
  injuryProtocols: string[],
  equipmentSubs: string[],
  stationFocus: string,
  weeksOut: number,
  weekNumber: number,
  weekContext?: WeekContext,
): string {

  const sections: string[] = [];

  // ==========================================================================
  // SECTION 1: Athlete Profile
  // ==========================================================================
  sections.push(`# ATHLETE PROFILE

## Competition
- Division: ${userProfile.competition.division.replace('_', ' ').toUpperCase()}
- Weeks until race: ${weeksOut}
- Current phase: ${phase}
- Week ${weekNumber} of program
${userProfile.competition.isFirstRace ? '- FIRST HYROX RACE - prioritize completion and technique over time goals' : ''}
${userProfile.competition.targetTimeMinutes ? `- Target time: ${formatTime(userProfile.competition.targetTimeMinutes)}` : ''}
${userProfile.competition.previousBestTimeMinutes ? `- Previous best: ${formatTime(userProfile.competition.previousBestTimeMinutes)}` : ''}

## Current Fitness
- Running level: ${userProfile.fitness.runningLevel}
- Strength level: ${userProfile.fitness.strengthLevel}
- Experience level (calculated): ${experienceLevel}
${userProfile.fitness.weeklyRunningKm ? `- Current weekly running: ${userProfile.fitness.weeklyRunningKm}km` : ''}
${userProfile.fitness.comfortable5kTimeMinutes ? `- 5K time: ${formatTime(userProfile.fitness.comfortable5kTimeMinutes)}` : ''}
${userProfile.fitness.trainingYears ? `- Training experience: ${userProfile.fitness.trainingYears} years` : ''}

## Schedule
- Training days: ${userProfile.schedule.trainingDays} per week
${userProfile.schedule.availableDays?.length ? `- Available days: ${userProfile.schedule.availableDays.join(', ')}` : '- Available days: Flexible (assign to any days)'}
- Session length: ${userProfile.schedule.sessionLengthMinutes} minutes
${userProfile.schedule.canDoTwoADay ? '- Can do two-a-day sessions if beneficial' : ''}

## Equipment Access
- Gym type: ${userProfile.equipment.gymType}
${userProfile.equipment.missingEquipment?.length ? `- Missing equipment: ${userProfile.equipment.missingEquipment.join(', ')}` : '- Full equipment access'}`);

  // ==========================================================================
  // SECTION 2: Phase Requirements
  // ==========================================================================
  sections.push(`# PHASE REQUIREMENTS: ${phase}

${phaseData.primaryFocus}

## Phase Objectives
- Primary: ${phaseData.primaryFocus}
- Secondary: ${phaseData.secondaryFocus}

## Key Workouts This Phase
${phaseData.keyWorkouts.map(kw => `- ${kw}`).join('\n')}

## Station Practice Frequency
${phaseData.stationFrequency}`);

  // ==========================================================================
  // SECTION 3: Volume Targets (STRICT)
  // ==========================================================================
  sections.push(`# VOLUME TARGETS (MANDATORY)

These targets are calculated for THIS athlete's experience level and constraints.
You MUST hit within these ranges.

## Weekly Running
- Target: ${volumeTargets.running}
- Adjusted min: ${volumeTargets.runningMin || 'N/A'}km
- Adjusted max: ${volumeTargets.runningMax || 'N/A'}km

## Strength Sessions
- Target: ${volumeTargets.strength}

## Intensity Distribution
- Zone 1-2 (easy): ${volumeTargets.intensityDistribution.zone1_2}
- Zone 3 (moderate): ${volumeTargets.intensityDistribution.zone3}
- Zone 4-5 (hard): ${volumeTargets.intensityDistribution.zone4_5}`);

  // ==========================================================================
  // SECTION 4: Station Coverage (MANDATORY)
  // ==========================================================================
  sections.push(`# STATION COVERAGE (MANDATORY)

All 8 Hyrox stations MUST appear each week:
${Object.entries(STATIONS).map(([id, station]) =>
  `- ${station.name} (${station.distance || station.reps} in race)`
).join('\n')}

## Station Focus for This Athlete
${stationFocus}`);

  // ==========================================================================
  // SECTION 5: Session Structure
  // ==========================================================================
  if (sessionStructure) {
    sections.push(`# SESSION STRUCTURE (${userProfile.schedule.trainingDays} DAYS)

## Session Templates
${sessionStructure.map((s, i) => `
### Day ${i + 1}: ${s.name}
- Duration: ${s.duration}
- Focus: ${s.focus}
- Structure: ${s.structure.main.join(' | ')}
`).join('\n')}`);
  }

  // ==========================================================================
  // SECTION 6: Running Paces (if available)
  // ==========================================================================
  if (runningPaces) {
    sections.push(`# RUNNING PACE GUIDANCE

Calculated from athlete's 5K time (${userProfile.fitness.comfortable5kTimeMinutes} minutes):

- Zone 2 / Easy: ${runningPaces.zone2}
- Tempo: ${runningPaces.tempo}
- Race Goal Pace: ${runningPaces.perKm}
- 1km Intervals: ${runningPaces.interval}

Use these specific paces in running prescriptions.`);
  } else {
    sections.push(`# RUNNING PACE GUIDANCE

No 5K time provided. Use RPE/Zone guidance:

- Zone 2: Conversational pace, can speak full sentences
- Tempo: Comfortably hard, short sentences only
- Intervals: Hard effort, race pace or faster`);
  }

  // ==========================================================================
  // SECTION 7: Station Weights (Division-Specific)
  // ==========================================================================
  sections.push(`# STATION WEIGHTS (${userProfile.competition.division.replace('_', ' ').toUpperCase()})

Race weights for this division:
- Sled Push: ${divisionWeights.sled_push_kg}kg
- Sled Pull: ${divisionWeights.sled_pull_kg}kg
- Farmers Carry: ${divisionWeights.farmers_carry_kg_per_hand}kg per hand
- Sandbag: ${divisionWeights.sandbag_kg}kg
- Wall Ball: ${divisionWeights.wall_ball_kg}kg (${divisionWeights.wall_ball_height_m}m target)

Training guidance for ${phase} phase:
${phase === 'BASE' ? '- Practice at 60-80% of race weight, focus on technique' : ''}
${phase === 'BUILD' ? '- Train at race weight, some sessions at race weight + 10-20%' : ''}
${phase === 'PEAK' ? '- Train at EXACT race weight for specificity' : ''}
${phase === 'TAPER' ? '- Light touches at race weight only' : ''}`);

  // ==========================================================================
  // SECTION 8: Injury Modifications (CONDITIONAL)
  // ==========================================================================
  if (injuryProtocols.length > 0) {
    sections.push(`# INJURY MODIFICATIONS (MANDATORY)

The athlete has the following physical constraints. These modifications are NOT optional.

${injuryProtocols.join('\n')}`);
  }

  // ==========================================================================
  // SECTION 9: Equipment Substitutions (CONDITIONAL)
  // ==========================================================================
  if (equipmentSubs.length > 0) {
    sections.push(`# EQUIPMENT SUBSTITUTIONS (MANDATORY)

The athlete is missing the following equipment. Use these substitutions.

${equipmentSubs.join('\n')}`);
  }

  // ==========================================================================
  // SECTION 10: Intensity Distribution
  // ==========================================================================
  const polarized = TRAINING_PRINCIPLES.polarizedTraining;
  sections.push(`# INTENSITY DISTRIBUTION

Follow the polarized 80/20 model:

- Zone 1-2: ${polarized.zone1_2} of training
- Zone 4-5: ${polarized.zone4_5} of training
- Zone 3: ${polarized.zone3} (avoid gray zone!)

${polarized.explanation}

Most sessions should feel EASY. This is by design.`);

  // ==========================================================================
  // SECTION 11: Anti-Patterns to Avoid
  // ==========================================================================
  const criticalAntiPatterns = ANTI_PATTERNS.slice(0, 5);
  sections.push(`# CRITICAL MISTAKES TO AVOID

${criticalAntiPatterns.map(ap => `## ❌ ${ap.mistake}
Why: ${ap.why}
Instead: ${ap.instead}`).join('\n\n')}`);

  // ==========================================================================
  // SECTION 12: User Preferences (HIGHEST PRIORITY)
  // ==========================================================================
  if (userProfile.preferences?.additionalNotes || weekContext?.persistentPreferences?.length) {
    sections.push(`# USER PREFERENCES (HIGHEST PRIORITY)

These preferences override defaults where safe to do so.

${userProfile.preferences?.intensityPreference ? `Intensity preference: ${userProfile.preferences.intensityPreference}` : ''}
${userProfile.preferences?.additionalNotes ? `\nAdditional notes from athlete:\n${userProfile.preferences.additionalNotes}` : ''}
${weekContext?.persistentPreferences?.length ? `\nLearned preferences from previous weeks:\n${weekContext.persistentPreferences.map(p => `- ${p}`).join('\n')}` : ''}`);
  }

  // ==========================================================================
  // SECTION 13: Multi-Week Context (CONDITIONAL)
  // ==========================================================================
  if (weekContext) {
    // Build adaptation guidance based on previous week feeling
    let feelingGuidance = '';
    if (weekContext.previousWeekFeeling) {
      const feelingMap: Record<string, string> = {
        'too_easy': '📈 INCREASE volume by 10-15% - athlete found previous week too easy',
        'just_right': '✓ MAINTAIN current volume - athlete is adapting well',
        'challenging': '⚠️ MAINTAIN or slightly reduce volume - athlete found it challenging',
        'too_hard': '📉 REDUCE volume by 15-20% - athlete reported excessive difficulty',
      };
      feelingGuidance = feelingMap[weekContext.previousWeekFeeling] || '';
    }

    // Build missed sessions awareness
    let missedSessionsGuidance = '';
    if (weekContext.sessionsMissed?.length) {
      missedSessionsGuidance = `\n## Missed Sessions Last Week
Sessions missed: ${weekContext.sessionsMissed.join(', ')}
Consider: Redistributing missed training stimulus OR accepting reduced volume this cycle`;
    }

    sections.push(`# PROGRAM CONTEXT

Week ${weekContext.weekNumber} of program
Phase: ${weekContext.phase}
${weekContext.isPhaseTransition ? `⚠️ PHASE TRANSITION: This week begins ${weekContext.phase} phase. Adjust focus accordingly.` : ''}

${weekContext.previousWeekActuals ? `## Previous Week Performance
- Running completed: ${weekContext.previousWeekActuals.runningKm}km
- Completion rate: ${Math.round(weekContext.previousWeekActuals.completionRate * 100)}%
${weekContext.previousWeekActuals.completionRate < 0.8
  ? '⚠️ Low completion rate. Consider REDUCING volume this week.'
  : weekContext.previousWeekActuals.completionRate >= 1.0
    ? '✓ Full completion. Can progress volume by 10-15%.'
    : ''}` : ''}
${feelingGuidance ? `\n## Athlete Feedback\n${feelingGuidance}` : ''}${missedSessionsGuidance}`);
  }

  // ==========================================================================
  // SECTION 14: Self-Verification Checklist
  // ==========================================================================
  sections.push(`# SELF-VERIFICATION CHECKLIST

Before outputting, verify:

□ Running volume meets phase targets
□ All 8 Hyrox stations appear at least once
${userProfile.stations?.weak?.length ? `□ Weak stations (${userProfile.stations.weak.join(', ')}) appear 2x this week` : ''}
□ Correct number of training days (${userProfile.schedule.trainingDays})
□ Each session is within ${userProfile.schedule.sessionLengthMinutes} minutes
${injuryProtocols.length > 0 ? '□ No exercises that violate injury constraints' : ''}
□ Running exercises include pace/zone guidance
□ Strength exercises include specific kg values (not "moderate" or "RPE X")
□ Intensity follows 80/20 distribution (most sessions easy)`);

  // ==========================================================================
  // SECTION 15: Output Schema
  // ==========================================================================
  sections.push(`# OUTPUT SCHEMA

Generate a JSON object matching this structure:

{
  "week_number": ${weekNumber},
  "phase": "${phase}",
  "focus": "string describing this week's primary focus",
  "days": [
    {
      "day_number": 1,
      "day_name": "Monday",
      "session_type": "Upper Strength + SkiErg",
      "duration_minutes": 60,
      "warmup": {
        "description": "Dynamic warmup description",
        "duration_minutes": 10
      },
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": 10,
          "weight_kg": 50,
          "rest_seconds": 90,
          "notes": "Form cues or intensity notes"
        },
        {
          "name": "SkiErg",
          "distance_m": 500,
          "sets": 4,
          "rest_seconds": 60,
          "target_pace": "2:00/500m",
          "notes": "Race pace intervals"
        },
        {
          "name": "Easy Run",
          "distance_km": 5,
          "target_pace": "${runningPaces?.zone2 || '6:00/km'}",
          "notes": "Zone 2, conversational"
        }
      ],
      "cooldown": {
        "description": "Stretching and mobility",
        "duration_minutes": 5
      }
    }
  ],
  "weekly_totals": {
    "running_km": 25,
    "skierg_m": 3000,
    "rowing_m": 2000,
    "strength_sessions": 2,
    "total_hours": 7
  },
  "notes": "Any important notes about this week's training"
}

Output ONLY the JSON. No markdown, no explanations.`);

  return sections.join('\n\n---\n\n');
}

/**
 * Format minutes as H:MM or M:SS
 */
function formatTime(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  calculateWeeksOut,
  calculateExperienceLevel,
  getAdjustedVolumeTargets,
  buildInjuryProtocol,
  buildEquipmentSubstitutions,
  buildStationFocus,
  getDivisionWeights,
};
