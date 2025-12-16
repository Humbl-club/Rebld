/**
 * Sport Knowledge Module
 *
 * Centralized exports for sport-specific training knowledge,
 * exercise mappings, prompt assembly, and plan validation.
 */

// Hyrox knowledge base
export {
  HYROX_KNOWLEDGE,
  COMPETITION_FORMAT,
  STATIONS,
  TIME_BENCHMARKS,
  TRAINING_PRINCIPLES,
  PHASES,
  SESSION_TEMPLATES,
  ANTI_PATTERNS,
  INJURY_RISKS,
  LOAD_CALCULATION,
  EQUIPMENT_SUBSTITUTIONS,
  // Helper functions
  calculatePhase,
  getVolumeTargets,
  calculateRunningPaces,
  getSessionTemplates,
  getStation,
  getAllStationIds,
  // Types
  type Division,
  type Phase,
  type ExperienceLevel,
  type StationSpec,
  type PhaseConfig,
  type SessionTemplate,
  type InjuryRisk,
} from './hyrox';

// Exercise mappings for validation
export {
  // Normalization (handles LLM naming variations)
  normalizeExerciseName,
  // Categorization
  categorizeExercise,
  extractRunningVolumeKm,
  extractSkiErgVolumeM,
  extractRowingVolumeM,
  isStation,
  getStationsPresent,
  getMissingStations,
  countStationOccurrences,
  hasProperWeightSpec,
  hasProperPaceGuidance,
  // Testing
  testCategorization,
  testNormalization,
  // Types
  type ExerciseCategory,
  type HyroxStation,
  type StrengthCategory,
  type CardioModality,
} from './exerciseMappings';

// Prompt assembly
export {
  assembleHyroxPrompt,
  calculateWeeksOut,
  calculateExperienceLevel,
  getAdjustedVolumeTargets,
  getDivisionWeights,
  // Types
  type UserProfile,
  type WeekContext,
  type AssembledPrompt,
  type Division as PromptDivision,
} from './assembleHyroxPrompt';

// Plan validation
export {
  validateHyroxPlan,
  autoFixPlan,
  generateRegenerationFeedback,
  validateAndFix,
  parseAndValidate,
  // Safety caps (non-negotiable limits)
  HARD_SAFETY_CAPS,
  // Types
  type GeneratedPlan,
  type GeneratedDay,
  type GeneratedExercise,
  type ValidationConstraints,
  type ValidationIssue,
  type ValidationResult,
  type GenerationResult,
} from './validateHyroxPlan';

// Conflict detection
export {
  detectConflicts,
  summarizeConflicts,
  canProceedWithGeneration,
  // Types
  type Conflict,
  type ConflictSeverity,
  type ResolutionOption,
  type UserConstraints,
} from './conflictDetection';

// Equipment substitutions and race prep warnings
export {
  // Substitution database
  STATION_SUBSTITUTIONS,
  getBestSubstitution,
  getAllSubstitutions,
  canTrainWithSubstitutes,
  // Race prep warnings
  generateRacePrepWarnings,
  summarizeRacePrep,
  // Types
  type EquipmentSubstitution,
  type RacePrepWarning,
} from './equipmentSubstitutions';
