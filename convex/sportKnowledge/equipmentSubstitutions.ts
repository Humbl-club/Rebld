/**
 * Equipment Substitutions for Hyrox Training
 *
 * When users don't have access to official Hyrox equipment,
 * this module provides safe substitutions and tracks race prep warnings.
 *
 * CRITICAL: Substitutes are fine for training, but users MUST practice
 * on actual equipment before race day. This module generates warnings
 * when approaching race day without actual equipment access.
 */

import { HyroxStation } from './exerciseMappings';

// =============================================================================
// TYPES
// =============================================================================

export interface EquipmentSubstitution {
  station: HyroxStation;
  originalEquipment: string;
  substitute: string;
  effectiveness: number; // 0-1, how close to race experience
  notes: string;
  raceReadinessImpact: 'high' | 'medium' | 'low';
}

export interface RacePrepWarning {
  station: HyroxStation;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  recommendation: string;
  weeksUntilRequired: number;
}

// =============================================================================
// EQUIPMENT SUBSTITUTION DATABASE
// =============================================================================

/**
 * Comprehensive substitution options for each station
 * Ordered by effectiveness (best first)
 */
export const STATION_SUBSTITUTIONS: Record<HyroxStation, EquipmentSubstitution[]> = {
  skierg: [
    {
      station: 'skierg',
      originalEquipment: 'Concept2 SkiErg',
      substitute: 'Battle Ropes (overhead pattern)',
      effectiveness: 0.6,
      notes: 'Focus on hip hinge and arm drive. Does not replicate resistance profile.',
      raceReadinessImpact: 'high',
    },
    {
      station: 'skierg',
      originalEquipment: 'Concept2 SkiErg',
      substitute: 'Cable Machine Lat Pulldown Intervals',
      effectiveness: 0.5,
      notes: 'Stand and perform intervals. Replicates pull pattern but not cardiovascular demand.',
      raceReadinessImpact: 'high',
    },
    {
      station: 'skierg',
      originalEquipment: 'Concept2 SkiErg',
      substitute: 'Kettlebell Swings + Band Pull-aparts Superset',
      effectiveness: 0.4,
      notes: 'Hip hinge + pulling. Does not replicate the specific SkiErg movement.',
      raceReadinessImpact: 'high',
    },
  ],

  sled_push: [
    {
      station: 'sled_push',
      originalEquipment: 'Hyrox Sled (152kg men / 102kg women)',
      substitute: 'Prowler Push',
      effectiveness: 0.9,
      notes: 'Very similar. May have different friction coefficient than Hyrox track.',
      raceReadinessImpact: 'low',
    },
    {
      station: 'sled_push',
      originalEquipment: 'Hyrox Sled (152kg men / 102kg women)',
      substitute: 'Car Push (in neutral)',
      effectiveness: 0.7,
      notes: 'Good for leg drive practice. Weight may vary significantly.',
      raceReadinessImpact: 'medium',
    },
    {
      station: 'sled_push',
      originalEquipment: 'Hyrox Sled (152kg men / 102kg women)',
      substitute: 'Wall Push Isometrics',
      effectiveness: 0.3,
      notes: 'Leg drive only. No movement or cardiovascular component.',
      raceReadinessImpact: 'high',
    },
    {
      station: 'sled_push',
      originalEquipment: 'Hyrox Sled (152kg men / 102kg women)',
      substitute: 'Heavy Lunges',
      effectiveness: 0.4,
      notes: 'Builds leg strength but doesn\'t replicate pushing posture.',
      raceReadinessImpact: 'high',
    },
  ],

  sled_pull: [
    {
      station: 'sled_pull',
      originalEquipment: 'Hyrox Sled with Rope (same weight as push)',
      substitute: 'Rope Climb (seated on ground)',
      effectiveness: 0.5,
      notes: 'Hand-over-hand pattern but no horizontal resistance.',
      raceReadinessImpact: 'medium',
    },
    {
      station: 'sled_pull',
      originalEquipment: 'Hyrox Sled with Rope (same weight as push)',
      substitute: 'Cable Face Pulls / Rows',
      effectiveness: 0.4,
      notes: 'Pulling pattern but different body position and no rope.',
      raceReadinessImpact: 'high',
    },
    {
      station: 'sled_pull',
      originalEquipment: 'Hyrox Sled with Rope (same weight as push)',
      substitute: 'Resistance Band Seated Rows',
      effectiveness: 0.3,
      notes: 'Pulling motion only. Resistance profile completely different.',
      raceReadinessImpact: 'high',
    },
  ],

  burpee_broad_jump: [
    {
      station: 'burpee_broad_jump',
      originalEquipment: 'Open floor space (80m total)',
      substitute: 'Standard Burpee Broad Jumps',
      effectiveness: 1.0,
      notes: 'This requires no special equipment! Just floor space.',
      raceReadinessImpact: 'low',
    },
    {
      station: 'burpee_broad_jump',
      originalEquipment: 'Open floor space (80m total)',
      substitute: 'Burpees + Standing Long Jumps (separate)',
      effectiveness: 0.6,
      notes: 'If space limited. Does not practice the transition.',
      raceReadinessImpact: 'medium',
    },
  ],

  rowing: [
    {
      station: 'rowing',
      originalEquipment: 'Concept2 RowErg',
      substitute: 'Other Rowing Machine (WaterRower, etc)',
      effectiveness: 0.8,
      notes: 'Different resistance feel but similar movement pattern.',
      raceReadinessImpact: 'low',
    },
    {
      station: 'rowing',
      originalEquipment: 'Concept2 RowErg',
      substitute: 'Bike Erg Intervals',
      effectiveness: 0.5,
      notes: 'Cardiovascular benefit but completely different movement.',
      raceReadinessImpact: 'high',
    },
    {
      station: 'rowing',
      originalEquipment: 'Concept2 RowErg',
      substitute: 'Ring Rows / TRX Rows',
      effectiveness: 0.3,
      notes: 'Pulling pattern only. No leg drive or cardiovascular component.',
      raceReadinessImpact: 'high',
    },
  ],

  farmers_carry: [
    {
      station: 'farmers_carry',
      originalEquipment: 'Farmers Handles (32kg men / 24kg women each hand)',
      substitute: 'Heavy Dumbbells',
      effectiveness: 0.9,
      notes: 'Very similar. May have different grip diameter.',
      raceReadinessImpact: 'low',
    },
    {
      station: 'farmers_carry',
      originalEquipment: 'Farmers Handles (32kg men / 24kg women each hand)',
      substitute: 'Trap Bar Carry',
      effectiveness: 0.7,
      notes: 'Good for weight but different grip position.',
      raceReadinessImpact: 'medium',
    },
    {
      station: 'farmers_carry',
      originalEquipment: 'Farmers Handles (32kg men / 24kg women each hand)',
      substitute: 'Heavy Kettlebells',
      effectiveness: 0.8,
      notes: 'Good substitute. Weight distribution slightly different.',
      raceReadinessImpact: 'low',
    },
  ],

  sandbag_lunges: [
    {
      station: 'sandbag_lunges',
      originalEquipment: 'Sandbag (20kg men / 10kg women)',
      substitute: 'Weighted Vest Lunges',
      effectiveness: 0.7,
      notes: 'Different weight distribution but similar load pattern.',
      raceReadinessImpact: 'medium',
    },
    {
      station: 'sandbag_lunges',
      originalEquipment: 'Sandbag (20kg men / 10kg women)',
      substitute: 'Barbell Front Rack Lunges',
      effectiveness: 0.6,
      notes: 'Heavier load option but rigid vs shifting weight.',
      raceReadinessImpact: 'medium',
    },
    {
      station: 'sandbag_lunges',
      originalEquipment: 'Sandbag (20kg men / 10kg women)',
      substitute: 'Heavy Dumbbell Lunges (one or two hands)',
      effectiveness: 0.7,
      notes: 'Similar weight, different carry position.',
      raceReadinessImpact: 'medium',
    },
    {
      station: 'sandbag_lunges',
      originalEquipment: 'Sandbag (20kg men / 10kg women)',
      substitute: 'Bodyweight Lunges',
      effectiveness: 0.4,
      notes: 'Movement pattern only. No strength stimulus.',
      raceReadinessImpact: 'high',
    },
  ],

  wall_balls: [
    {
      station: 'wall_balls',
      originalEquipment: 'Wall Ball (9kg men / 6kg women) + 3m target',
      substitute: 'Dumbbell Thruster',
      effectiveness: 0.7,
      notes: 'Similar movement but no catch/throw coordination.',
      raceReadinessImpact: 'medium',
    },
    {
      station: 'wall_balls',
      originalEquipment: 'Wall Ball (9kg men / 6kg women) + 3m target',
      substitute: 'Goblet Squat to Press',
      effectiveness: 0.6,
      notes: 'Movement pattern similar but no ballistic component.',
      raceReadinessImpact: 'medium',
    },
    {
      station: 'wall_balls',
      originalEquipment: 'Wall Ball (9kg men / 6kg women) + 3m target',
      substitute: 'Medicine Ball Slams + Air Squats',
      effectiveness: 0.4,
      notes: 'Separate movements. Does not build wall ball rhythm.',
      raceReadinessImpact: 'high',
    },
  ],
};

// =============================================================================
// RACE PREP WARNING LOGIC
// =============================================================================

/**
 * Minimum weeks before race to practice on actual equipment
 * Based on muscle memory and pacing strategy development
 */
const MIN_WEEKS_FOR_ACTUAL_EQUIPMENT: Record<HyroxStation, number> = {
  skierg: 4,        // Complex technique, need pacing practice
  sled_push: 3,     // Weight feel is critical
  sled_pull: 3,     // Rope technique needs practice
  burpee_broad_jump: 2, // Can practice anywhere
  rowing: 3,        // Pacing strategy important
  farmers_carry: 2, // Grip and weight feel
  sandbag_lunges: 2, // Weight distribution practice
  wall_balls: 3,    // Rhythm and target height critical
};

/**
 * Generate race prep warnings based on equipment substitutions and time until race
 */
export function generateRacePrepWarnings(
  substitutionsInUse: HyroxStation[],
  weeksUntilRace: number,
): RacePrepWarning[] {
  const warnings: RacePrepWarning[] = [];

  for (const station of substitutionsInUse) {
    const minWeeks = MIN_WEEKS_FOR_ACTUAL_EQUIPMENT[station];

    if (weeksUntilRace <= minWeeks) {
      // Critical warning - need to practice on real equipment NOW
      warnings.push({
        station,
        severity: 'critical',
        message: `You need to practice ${formatStationName(station)} on actual equipment before race day!`,
        recommendation: `Find a gym with a ${getEquipmentName(station)} within the next ${weeksUntilRace} weeks. At least 2-3 sessions on real equipment is essential.`,
        weeksUntilRequired: 0,
      });
    } else if (weeksUntilRace <= minWeeks + 2) {
      // Warning - should start planning
      warnings.push({
        station,
        severity: 'warning',
        message: `Plan to practice ${formatStationName(station)} on actual equipment soon`,
        recommendation: `Schedule at least 2-3 sessions on a real ${getEquipmentName(station)} in the next ${minWeeks} weeks.`,
        weeksUntilRequired: weeksUntilRace - minWeeks,
      });
    } else if (weeksUntilRace <= minWeeks + 4) {
      // Info - good to know
      warnings.push({
        station,
        severity: 'info',
        message: `You're using a substitute for ${formatStationName(station)}`,
        recommendation: `Substitutes are fine for now, but plan to practice on actual equipment ${minWeeks} weeks before race day.`,
        weeksUntilRequired: weeksUntilRace - minWeeks,
      });
    }
  }

  return warnings;
}

/**
 * Get the best substitution for a station
 */
export function getBestSubstitution(
  station: HyroxStation,
  availableEquipment?: string[],
): EquipmentSubstitution | null {
  const substitutions = STATION_SUBSTITUTIONS[station];
  if (!substitutions || substitutions.length === 0) {
    return null;
  }

  // If we have info about available equipment, try to match
  if (availableEquipment && availableEquipment.length > 0) {
    const availableLower = availableEquipment.map(e => e.toLowerCase());

    for (const sub of substitutions) {
      const subLower = sub.substitute.toLowerCase();
      if (availableLower.some(avail =>
        subLower.includes(avail) || avail.includes(subLower.split(' ')[0])
      )) {
        return sub;
      }
    }
  }

  // Return best effectiveness option
  return substitutions[0];
}

/**
 * Get all substitutions for a station, ordered by effectiveness
 */
export function getAllSubstitutions(station: HyroxStation): EquipmentSubstitution[] {
  return STATION_SUBSTITUTIONS[station] || [];
}

/**
 * Check if a station can be adequately trained with substitutes
 * Returns false for stations where substitutes are very poor
 */
export function canTrainWithSubstitutes(station: HyroxStation): boolean {
  const subs = STATION_SUBSTITUTIONS[station];
  if (!subs || subs.length === 0) return false;

  // If best substitute is at least 50% effective, it's trainable
  return subs[0].effectiveness >= 0.5;
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

function getEquipmentName(station: HyroxStation): string {
  const equipment: Record<HyroxStation, string> = {
    skierg: 'Concept2 SkiErg',
    sled_push: 'weighted sled',
    sled_pull: 'sled with rope',
    burpee_broad_jump: 'open floor space',
    rowing: 'Concept2 RowErg',
    farmers_carry: 'farmers handles or heavy dumbbells',
    sandbag_lunges: 'sandbag',
    wall_balls: 'wall ball and target',
  };
  return equipment[station] || station;
}

// =============================================================================
// SUMMARY FUNCTIONS
// =============================================================================

/**
 * Summarize race prep status for all stations using substitutes
 */
export function summarizeRacePrep(
  substitutionsInUse: HyroxStation[],
  weeksUntilRace: number,
): {
  readyForRace: boolean;
  criticalWarnings: number;
  warnings: number;
  stationsNeedingAttention: HyroxStation[];
  summary: string;
} {
  const allWarnings = generateRacePrepWarnings(substitutionsInUse, weeksUntilRace);

  const critical = allWarnings.filter(w => w.severity === 'critical');
  const warning = allWarnings.filter(w => w.severity === 'warning');

  const stationsNeedingAttention = [
    ...critical.map(w => w.station),
    ...warning.map(w => w.station),
  ];

  let summary = '';
  if (critical.length > 0) {
    summary = `URGENT: Practice ${critical.length} station(s) on real equipment before race day! `;
  } else if (warning.length > 0) {
    summary = `Plan to practice ${warning.length} station(s) on real equipment within the next few weeks. `;
  } else {
    summary = 'Equipment preparation on track for race day.';
  }

  return {
    readyForRace: critical.length === 0,
    criticalWarnings: critical.length,
    warnings: warning.length,
    stationsNeedingAttention: [...new Set(stationsNeedingAttention)],
    summary: summary.trim(),
  };
}
