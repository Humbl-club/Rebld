/**
 * Conflict Detection Module for Hyrox Plan Generation
 *
 * Detects conflicts between user constraints and Hyrox requirements.
 * For example:
 * - User has shoulder injury but Wall Balls require overhead movement
 * - User has knee injury but BBJs are required
 * - User's gym is missing essential equipment
 *
 * Returns conflicts with severity and resolution options.
 */

import { HyroxStation } from './exerciseMappings';

// =============================================================================
// TYPES
// =============================================================================

export type ConflictSeverity = 'blocking' | 'warning' | 'info';

export interface Conflict {
  id: string;
  severity: ConflictSeverity;
  category: 'injury' | 'equipment' | 'time' | 'experience' | 'schedule';
  title: string;
  description: string;
  affectedStations: HyroxStation[];
  resolutionOptions: ResolutionOption[];
}

export interface ResolutionOption {
  id: string;
  label: string;
  description: string;
  action: 'substitute' | 'modify' | 'skip' | 'reduce_volume' | 'add_prep';
  details: Record<string, unknown>;
}

export interface UserConstraints {
  // Injury/pain areas
  painPoints?: string[];
  injuryAreas?: string[];

  // Equipment availability
  gymType?: 'commercial' | 'crossfit_box' | 'hyrox_affiliate' | 'home';
  missingEquipment?: string[];

  // Time constraints
  sessionLengthMinutes?: number;
  trainingDaysPerWeek?: number;

  // Experience level
  isFirstRace?: boolean;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';

  // Competition date
  weeksUntilRace?: number;
}

// =============================================================================
// STATION-INJURY MAPPING
// =============================================================================

/**
 * Maps body areas to affected Hyrox stations
 * Used to detect when user injuries conflict with required movements
 */
const INJURY_STATION_IMPACT: Record<string, {
  affectedStations: HyroxStation[];
  severity: ConflictSeverity;
  reason: string;
}> = {
  // Upper body
  shoulder: {
    affectedStations: ['wall_balls', 'skierg', 'sled_push', 'sled_pull'],
    severity: 'warning',
    reason: 'Shoulder issues affect overhead movements and pushing/pulling',
  },
  'rotator cuff': {
    affectedStations: ['wall_balls', 'skierg', 'sled_pull'],
    severity: 'blocking',
    reason: 'Rotator cuff injuries are aggravated by overhead and pulling movements',
  },
  elbow: {
    affectedStations: ['sled_pull', 'skierg', 'farmers_carry'],
    severity: 'warning',
    reason: 'Elbow issues affect grip-intensive pulling movements',
  },
  wrist: {
    affectedStations: ['wall_balls', 'sled_pull', 'farmers_carry', 'sandbag_lunges'],
    severity: 'warning',
    reason: 'Wrist issues affect grip and overhead positions',
  },

  // Core/torso
  'lower back': {
    affectedStations: ['sled_push', 'sled_pull', 'sandbag_lunges', 'farmers_carry', 'skierg', 'rowing'],
    severity: 'warning',
    reason: 'Lower back issues affect hip hinge and loaded carry movements',
  },
  back: {
    affectedStations: ['sled_push', 'sled_pull', 'sandbag_lunges', 'farmers_carry', 'rowing'],
    severity: 'warning',
    reason: 'Back issues affect most loaded movements',
  },
  hip: {
    affectedStations: ['burpee_broad_jump', 'sandbag_lunges', 'wall_balls', 'rowing', 'skierg'],
    severity: 'warning',
    reason: 'Hip issues affect squatting, lunging, and hinge patterns',
  },
  'hip flexor': {
    affectedStations: ['burpee_broad_jump', 'sandbag_lunges', 'skierg'],
    severity: 'warning',
    reason: 'Hip flexor tightness/strain affects high-knee movements',
  },

  // Lower body
  knee: {
    affectedStations: ['burpee_broad_jump', 'sandbag_lunges', 'wall_balls', 'sled_push'],
    severity: 'warning',
    reason: 'Knee issues affect jumping, squatting, and lunging',
  },
  'acl': {
    affectedStations: ['burpee_broad_jump', 'sandbag_lunges'],
    severity: 'blocking',
    reason: 'ACL injuries require avoiding explosive jumps and deep lunges',
  },
  ankle: {
    affectedStations: ['burpee_broad_jump', 'sandbag_lunges', 'wall_balls'],
    severity: 'warning',
    reason: 'Ankle issues affect landing and deep squat positions',
  },
  'achilles': {
    affectedStations: ['burpee_broad_jump', 'sandbag_lunges'],
    severity: 'blocking',
    reason: 'Achilles issues are high risk with explosive jumping',
  },
  calf: {
    affectedStations: ['burpee_broad_jump', 'sled_push'],
    severity: 'warning',
    reason: 'Calf issues affect push-off and landing',
  },
  foot: {
    affectedStations: ['burpee_broad_jump', 'sandbag_lunges'],
    severity: 'warning',
    reason: 'Foot issues affect running and landing mechanics',
  },
  'plantar fasciitis': {
    affectedStations: ['burpee_broad_jump', 'sandbag_lunges'],
    severity: 'warning',
    reason: 'Plantar fasciitis is aggravated by impact and repetitive running',
  },
};

// =============================================================================
// EQUIPMENT-STATION MAPPING
// =============================================================================

/**
 * Aliases for equipment names to handle user input variations
 */
const EQUIPMENT_ALIASES: Record<string, string> = {
  // SkiErg variations
  'ski erg': 'skierg',
  'ski-erg': 'skierg',
  'ski machine': 'skierg',
  'concept2 ski': 'skierg',
  'c2 ski': 'skierg',

  // Sled variations
  'prowler': 'sled',
  'push sled': 'sled',
  'pull sled': 'sled',

  // Rower variations
  'rowing machine': 'rower',
  'row machine': 'rower',
  'concept2 row': 'rower',
  'c2 row': 'rower',
  'erg': 'rower',
  'rowing erg': 'rower',

  // Wall ball variations
  'wallball': 'wall ball',
  'wall balls': 'wall ball',
  'med ball': 'wall ball',
  'medicine ball': 'wall ball',

  // Sandbag variations
  'sand bag': 'sandbag',

  // Farmers carry variations
  'farmers handles': 'farmers handles',
  'farmer handles': 'farmers handles',
  'farmers carry handles': 'farmers handles',
  'farmer carry': 'farmers handles',

  // Rope variations
  'pull rope': 'rope',
  'sled rope': 'rope',
};

/**
 * Normalize equipment name for matching
 */
function normalizeEquipmentName(name: string): string {
  const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
  return EQUIPMENT_ALIASES[normalized] || normalized;
}

/**
 * Maps missing equipment to affected stations
 */
const EQUIPMENT_REQUIREMENTS: Record<string, {
  requiredFor: HyroxStation[];
  alternatives?: string[];
}> = {
  skierg: {
    requiredFor: ['skierg'],
    alternatives: ['battle ropes with overhead motion', 'cable machine lat pulldown intervals'],
  },
  sled: {
    requiredFor: ['sled_push', 'sled_pull'],
    alternatives: ['weighted prowler', 'tire push', 'heavy resistance band pulls'],
  },
  rower: {
    requiredFor: ['rowing'],
    alternatives: ['bike erg intervals', 'swim if available'],
  },
  'wall ball': {
    requiredFor: ['wall_balls'],
    alternatives: ['dumbbell thruster', 'kettlebell goblet squat to press'],
  },
  sandbag: {
    requiredFor: ['sandbag_lunges'],
    alternatives: ['heavy dumbbell lunges', 'barbell front rack lunges', 'weighted vest lunges'],
  },
  'farmers handles': {
    requiredFor: ['farmers_carry'],
    alternatives: ['heavy dumbbells', 'trap bar carry', 'kettlebells'],
  },
  rope: {
    requiredFor: ['sled_pull'],
    alternatives: ['cable row machine', 'band rows'],
  },
};

// =============================================================================
// MAIN DETECTION FUNCTION
// =============================================================================

/**
 * Detect all conflicts between user constraints and Hyrox requirements
 */
export function detectConflicts(constraints: UserConstraints): Conflict[] {
  const conflicts: Conflict[] = [];

  // 1. Check injury-related conflicts
  const injuryConflicts = detectInjuryConflicts(constraints);
  conflicts.push(...injuryConflicts);

  // 2. Check equipment-related conflicts
  const equipmentConflicts = detectEquipmentConflicts(constraints);
  conflicts.push(...equipmentConflicts);

  // 3. Check time-related conflicts
  const timeConflicts = detectTimeConflicts(constraints);
  conflicts.push(...timeConflicts);

  // 4. Check experience-related warnings
  const experienceWarnings = detectExperienceConflicts(constraints);
  conflicts.push(...experienceWarnings);

  return conflicts;
}

// =============================================================================
// INJURY CONFLICT DETECTION
// =============================================================================

function detectInjuryConflicts(constraints: UserConstraints): Conflict[] {
  const conflicts: Conflict[] = [];
  const painAreas = [...(constraints.painPoints || []), ...(constraints.injuryAreas || [])];

  for (const area of painAreas) {
    const areaLower = area.toLowerCase();

    // Find matching injury impact
    for (const [injuryKey, impact] of Object.entries(INJURY_STATION_IMPACT)) {
      if (areaLower.includes(injuryKey)) {
        const resolutions: ResolutionOption[] = impact.affectedStations.map(station => ({
          id: `reduce_${station}`,
          label: `Reduce ${formatStationName(station)} volume`,
          description: `Lower volume and intensity for ${formatStationName(station)} to manage ${area} impact`,
          action: 'reduce_volume' as const,
          details: { station, volumeReduction: 0.5 },
        }));

        // Add prep work option
        resolutions.push({
          id: `prep_${areaLower}`,
          label: 'Add injury prep protocol',
          description: `Include specific mobility and strengthening work for ${area} before each session`,
          action: 'add_prep',
          details: { area: areaLower },
        });

        conflicts.push({
          id: `injury_${areaLower}_${Date.now()}`,
          severity: impact.severity,
          category: 'injury',
          title: `${area} may affect Hyrox performance`,
          description: impact.reason,
          affectedStations: impact.affectedStations,
          resolutionOptions: resolutions,
        });

        break; // Only match first injury key per pain area
      }
    }
  }

  return conflicts;
}

// =============================================================================
// EQUIPMENT CONFLICT DETECTION
// =============================================================================

function detectEquipmentConflicts(constraints: UserConstraints): Conflict[] {
  const conflicts: Conflict[] = [];

  // Check gym type first
  if (constraints.gymType === 'home') {
    conflicts.push({
      id: 'home_gym_warning',
      severity: 'warning',
      category: 'equipment',
      title: 'Home gym may limit Hyrox-specific training',
      description: 'Hyrox requires specialized equipment (SkiErg, sled, rower). Home training will need substitutions.',
      affectedStations: ['skierg', 'sled_push', 'sled_pull', 'rowing'],
      resolutionOptions: [
        {
          id: 'find_hyrox_gym',
          label: 'Find a Hyrox-equipped gym',
          description: 'Consider 1-2 sessions per week at a CrossFit box or Hyrox affiliate',
          action: 'substitute',
          details: { type: 'gym_recommendation' },
        },
        {
          id: 'home_substitutes',
          label: 'Use home workout substitutes',
          description: 'We\'ll provide equipment alternatives for station practice',
          action: 'substitute',
          details: { type: 'home_alternatives' },
        },
      ],
    });
  }

  // Check specific missing equipment
  for (const missing of constraints.missingEquipment || []) {
    // Normalize the user's equipment name to match our keys
    const normalizedMissing = normalizeEquipmentName(missing);

    // Check for direct match first
    if (EQUIPMENT_REQUIREMENTS[normalizedMissing]) {
      const requirement = EQUIPMENT_REQUIREMENTS[normalizedMissing];
      conflicts.push({
        id: `missing_${normalizedMissing}`,
        severity: requirement.requiredFor.length > 1 ? 'warning' : 'info',
        category: 'equipment',
        title: `Missing ${normalizedMissing}`,
        description: `Required for: ${requirement.requiredFor.map(formatStationName).join(', ')}`,
        affectedStations: requirement.requiredFor,
        resolutionOptions: [
          {
            id: `substitute_${normalizedMissing}`,
            label: 'Use substitute exercises',
            description: requirement.alternatives?.join(', ') || 'Substitute exercises available',
            action: 'substitute',
            details: {
              original: normalizedMissing,
              alternatives: requirement.alternatives || [],
            },
          },
        ],
      });
      continue;
    }

    // Fallback: check if normalized name contains any equipment key
    for (const [equipKey, requirement] of Object.entries(EQUIPMENT_REQUIREMENTS)) {
      if (normalizedMissing.includes(equipKey) || equipKey.includes(normalizedMissing)) {
        conflicts.push({
          id: `missing_${equipKey}`,
          severity: requirement.requiredFor.length > 1 ? 'warning' : 'info',
          category: 'equipment',
          title: `Missing ${equipKey}`,
          description: `Required for: ${requirement.requiredFor.map(formatStationName).join(', ')}`,
          affectedStations: requirement.requiredFor,
          resolutionOptions: [
            {
              id: `substitute_${equipKey}`,
              label: 'Use substitute exercises',
              description: requirement.alternatives?.join(', ') || 'Substitute exercises available',
              action: 'substitute',
              details: {
                original: equipKey,
                alternatives: requirement.alternatives || [],
              },
            },
          ],
        });
        break;
      }
    }
  }

  return conflicts;
}

// =============================================================================
// TIME CONFLICT DETECTION
// =============================================================================

function detectTimeConflicts(constraints: UserConstraints): Conflict[] {
  const conflicts: Conflict[] = [];

  // Check session length
  if (constraints.sessionLengthMinutes && constraints.sessionLengthMinutes < 45) {
    conflicts.push({
      id: 'short_sessions',
      severity: 'warning',
      category: 'time',
      title: 'Short session length may limit Hyrox prep',
      description: 'Hyrox requires combined running + station work. Sessions under 45 minutes may need to be split.',
      affectedStations: [],
      resolutionOptions: [
        {
          id: 'split_sessions',
          label: 'Split into focused sessions',
          description: 'Separate running and station work into different sessions',
          action: 'modify',
          details: { type: 'split_sessions' },
        },
        {
          id: 'extend_sessions',
          label: 'Extend to 60 minutes if possible',
          description: 'Combined sessions are most effective for race simulation',
          action: 'modify',
          details: { type: 'extend' },
        },
      ],
    });
  }

  // Check training days
  if (constraints.trainingDaysPerWeek && constraints.trainingDaysPerWeek < 3) {
    conflicts.push({
      id: 'few_training_days',
      severity: 'warning',
      category: 'time',
      title: 'Limited training days',
      description: 'Hyrox preparation typically requires 4-5 days. With fewer days, each session must be highly focused.',
      affectedStations: [],
      resolutionOptions: [
        {
          id: 'combined_sessions',
          label: 'Use combined training sessions',
          description: 'Each session will include running, stations, and strength',
          action: 'modify',
          details: { type: 'combined' },
        },
        {
          id: 'priority_focus',
          label: 'Prioritize weaknesses only',
          description: 'Focus limited time on weak stations and running',
          action: 'modify',
          details: { type: 'prioritized' },
        },
      ],
    });
  }

  // Check weeks until race
  if (constraints.weeksUntilRace !== undefined && constraints.weeksUntilRace < 6) {
    // Even <4 weeks gets a warning, not blocking - user can still benefit from a plan
    // The plan will be maintenance-focused rather than building fitness
    conflicts.push({
      id: 'short_prep_time',
      severity: 'warning', // Changed from blocking - always allow plan generation
      category: 'time',
      title: `Only ${constraints.weeksUntilRace} weeks until race`,
      description: constraints.weeksUntilRace < 4
        ? 'Very limited time remaining. Plan will focus on race simulation and maintaining current fitness - no time for building new capacity.'
        : 'Limited time means focusing on race-specific preparation rather than building base fitness.',
      affectedStations: [],
      resolutionOptions: [
        {
          id: 'race_simulation',
          label: 'Focus on race simulation',
          description: 'Practice race-day pacing and station transitions',
          action: 'modify',
          details: { type: 'simulation_focus' },
        },
        {
          id: 'maintain_fitness',
          label: 'Maintain current fitness',
          description: 'Avoid adding volume that could cause injury before race day',
          action: 'reduce_volume',
          details: { type: 'maintenance' },
        },
      ],
    });
  }

  return conflicts;
}

// =============================================================================
// EXPERIENCE CONFLICT DETECTION
// =============================================================================

function detectExperienceConflicts(constraints: UserConstraints): Conflict[] {
  const conflicts: Conflict[] = [];

  if (constraints.isFirstRace && constraints.experienceLevel === 'beginner') {
    conflicts.push({
      id: 'first_race_beginner',
      severity: 'info',
      category: 'experience',
      title: 'First Hyrox race as a beginner',
      description: 'Your plan will focus on completing the race safely rather than speed. All stations will be practiced multiple times before race day.',
      affectedStations: [],
      resolutionOptions: [
        {
          id: 'completion_focus',
          label: 'Focus on completion',
          description: 'Build confidence with each station, emphasize proper technique',
          action: 'modify',
          details: { type: 'completion_focus' },
        },
      ],
    });
  }

  if (constraints.isFirstRace) {
    conflicts.push({
      id: 'first_race_station_familiarity',
      severity: 'info',
      category: 'experience',
      title: 'Station familiarization required',
      description: 'Since this is your first race, you\'ll need to practice ALL 8 stations multiple times before race day.',
      affectedStations: ['skierg', 'sled_push', 'sled_pull', 'burpee_broad_jump', 'rowing', 'farmers_carry', 'sandbag_lunges', 'wall_balls'],
      resolutionOptions: [
        {
          id: 'station_rotation',
          label: 'Weekly station rotation',
          description: 'Ensure each station is practiced at least once per week',
          action: 'modify',
          details: { type: 'station_rotation' },
        },
      ],
    });
  }

  return conflicts;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatStationName(station: HyroxStation): string {
  const names: Record<HyroxStation, string> = {
    skierg: 'SkiErg',
    sled_push: 'Sled Push',
    sled_pull: 'Sled Pull',
    burpee_broad_jump: 'Burpee Broad Jumps',
    rowing: 'Rowing',
    farmers_carry: 'Farmers Carry',
    sandbag_lunges: 'Sandbag Lunges',
    wall_balls: 'Wall Balls',
  };
  return names[station] || station;
}

// =============================================================================
// CONFLICT SUMMARY
// =============================================================================

/**
 * Generate a summary of conflicts for UI display
 */
export function summarizeConflicts(conflicts: Conflict[]): {
  hasBlocking: boolean;
  blockingCount: number;
  warningCount: number;
  infoCount: number;
  totalAffectedStations: HyroxStation[];
  summary: string;
} {
  const blocking = conflicts.filter(c => c.severity === 'blocking');
  const warnings = conflicts.filter(c => c.severity === 'warning');
  const info = conflicts.filter(c => c.severity === 'info');

  const allAffected = new Set<HyroxStation>();
  conflicts.forEach(c => c.affectedStations.forEach(s => allAffected.add(s)));

  let summary = '';
  if (blocking.length > 0) {
    summary = `${blocking.length} issue(s) require attention before proceeding. `;
  }
  if (warnings.length > 0) {
    summary += `${warnings.length} warning(s) may affect your training. `;
  }
  if (info.length > 0 && blocking.length === 0 && warnings.length === 0) {
    summary = `${info.length} note(s) about your training plan.`;
  }

  return {
    hasBlocking: blocking.length > 0,
    blockingCount: blocking.length,
    warningCount: warnings.length,
    infoCount: info.length,
    totalAffectedStations: Array.from(allAffected),
    summary: summary.trim(),
  };
}

/**
 * Check if user can proceed with plan generation
 * Returns false if there are unresolved blocking conflicts
 */
export function canProceedWithGeneration(conflicts: Conflict[]): boolean {
  return !conflicts.some(c => c.severity === 'blocking');
}
