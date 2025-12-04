export interface BaseMetricTemplate {
  type: string;
  target_sets?: number | null;
  target_reps?: string | null;
  reps_per_set?: (string | number)[]; // For complex schemes like descending reps
  rest_period_s?: number | null;
  one_rep_max_percentage?: string | null;
  incline?: string | null;
  speed?: string | null;
  resistance?: string | null;
  pulse_target?: string | null;
  has_drop_set?: boolean; // For special instructions
  target_tempo?: string; // For tempo-based exercises
}

export interface SetsRepsWeightTemplate extends BaseMetricTemplate {
  type: 'sets_reps_weight';
}

export interface SetsRepsWeightTempoTemplate extends BaseMetricTemplate {
  type: 'sets_reps_weight_tempo';
  target_tempo: string;
}

export interface SetsDurationTemplate extends BaseMetricTemplate {
  type: 'sets_duration';
  target_duration_s?: number | null;
  duration_seconds?: number | null; // Alternative field name from AI
}

export interface SetsDistanceRestTemplate extends BaseMetricTemplate {
  type: 'sets_distance_rest';
  target_distance_m?: number;
  target_rest_s?: number;
}

export interface DistanceTimeTemplate extends BaseMetricTemplate {
  type: 'distance_time';
  target_distance_km?: number;
  target_distance_m?: number; // Alternative: meters
  distance_km?: number; // Alternative field name from AI
  distance_m?: number; // Alternative field name from AI
}

export interface DurationOnlyTemplate extends BaseMetricTemplate {
  type: 'duration_only';
  target_duration_minutes?: number;
  duration_minutes?: number; // Alternative field name from AI
  target_duration_s?: number; // Alternative: seconds
}

export type MetricTemplate = 
  | SetsRepsWeightTemplate
  | SetsRepsWeightTempoTemplate
  | SetsDurationTemplate
  | SetsDistanceRestTemplate
  | DistanceTimeTemplate
  | DurationOnlyTemplate;

export interface PlanExercise {
  exercise_name: string;
  notes?: string | null;
  metrics_template: MetricTemplate;
  original_exercise_name?: string;
  rpe?: string | null;
  category: 'warmup' | 'main' | 'cooldown';
}

// NEW BLOCK-BASED ARCHITECTURE
export interface BaseBlock {
  type: 'single' | 'superset' | 'amrap' | 'circuit';
  title?: string;
  notes?: string;
  exercises: PlanExercise[];
}

export interface SingleExerciseBlock extends BaseBlock {
  type: 'single';
}

export interface SupersetBlock extends BaseBlock {
  type: 'superset';
  rounds: number;
}

export interface AmrapBlock extends BaseBlock {
  type: 'amrap';
  duration_minutes: number;
}

export interface CircuitBlock extends BaseBlock {
  type: 'circuit';
  rounds?: number;
  duration_minutes?: number;
}

export type WorkoutBlock = SingleExerciseBlock | SupersetBlock | AmrapBlock | CircuitBlock;

// NEW: Session for 2x/day training
export interface WorkoutSession {
  session_name: string; // e.g., "AM Cardio", "PM Strength"
  time_of_day: 'morning' | 'evening' | 'all-day';
  estimated_duration?: number; // minutes
  blocks: WorkoutBlock[];
}

export interface PlanDay {
  day_of_week: number; // 1=Mon, 7=Sun
  focus: string;
  notes?: string;
  // Standard single-session structure
  blocks?: WorkoutBlock[];
  // NEW: 2x/day session structure (use sessions OR blocks, not both)
  sessions?: WorkoutSession[];
}

// NEW: Periodization phases
export type PeriodizationPhase = 'base' | 'build' | 'peak' | 'taper' | 'recovery';

// NEW: Periodization metadata for goal-based training
export interface Periodization {
  total_weeks: number;
  current_week: number;
  phase: PeriodizationPhase;
  phase_description?: string;
  weeks_in_phase?: number;
  phase_end_week?: number;
}

export interface DailyRoutine {
    focus: string;
    notes?: string;
    exercises: PlanExercise[]; // Kept simple for now, can be upgraded to blocks later if needed
}

export interface WorkoutPlan {
    id?: string;
    _id?: string; // Convex document ID
    name: string;
    weeklyPlan: PlanDay[];
    dailyRoutine?: DailyRoutine;
    createdAt?: string; // ISO date string

    // NEW: Periodization for goal-based training
    periodization?: Periodization;
}

// Logged Data Types
export interface LoggedSetSRW {
  set: number;
  weight: number | string;
  reps: number | string;
  rpe?: number | null;
}

export interface LoggedSetSRWT extends LoggedSetSRW {
  tempo: string;
}

export interface LoggedSetDuration {
  set: number;
  duration_s: number | string;
}

export interface LoggedSetSDR {
  set: number;
  distance_m: number | string;
  rest_s: number | string;
}

export interface LoggedExercise {
    exercise_name: string;
    sets: (LoggedSetSRW | LoggedSetDuration)[];
}

export interface WorkoutLog {
    id?: string; // ID is assigned by Convex, so optional on creation
    date: string; // ISO date string
    focus: string;
    exercises: LoggedExercise[];
    durationMinutes?: number;
}


// Chatbot types
export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    functionCall?: any;
}

// Cardio Preferences (for training types that include cardio)
export interface CardioPreferences {
    preferred_types: string[]; // ["running", "cycling", "rowing", "swimming", "elliptical", "stair_climber"]
    favorite_exercise?: string; // Primary cardio choice
    cardio_duration_minutes?: number; // Default cardio session length
    outdoor_preferred?: boolean; // Prefers outdoor activities
}

// Training Split (1x or 2x daily)
export interface TrainingSplit {
    sessions_per_day: '1' | '2';
    training_type: 'strength_only' | 'strength_plus_cardio' | 'combined' | 'cardio_focused';
    cardio_preferences?: CardioPreferences;
}

// Specific Goal with target date (e.g., Hyrox April 2025)
export interface SpecificGoal {
    event_type?: string | null; // "hyrox", "marathon", "powerlifting_meet"
    event_name?: string | null; // "Hyrox Hamburg"
    target_date?: string | null; // ISO date
    current_readiness?: number | null; // 1-10 scale
    description?: string | null; // Free-form goal description
}

// Supplement tracking
export interface Supplement {
    name: string;
    timing: 'morning' | 'pre_workout' | 'post_workout' | 'evening' | 'with_meals';
    dosage?: string | null;
    active: boolean;
}

// Training Preferences (from onboarding)
export interface TrainingPreferences {
    primary_goal: string; // "Aesthetic Physique", "Strength & Power", etc.
    goal_explanation?: string | null; // User's own words about their goal
    experience_level: string; // "Beginner", "Intermediate", "Advanced"
    training_frequency: string; // "2-3", "3-4", "4-5", "5+"
    pain_points: string[]; // ["Knees", "Lower Back", etc.]
    sport?: string | null; // Sport-specific training
    sport_specific?: string | null; // Elite sport-specific protocols
    additional_notes?: string | null; // Free-form notes
    last_updated: string; // ISO date string
    // Profile fields
    age?: number; // User's age for recovery/programming adjustments
    sex?: 'male' | 'female' | 'other';
    equipment?: 'minimal' | 'home_gym' | 'commercial_gym';
    preferred_session_length?: '30' | '45' | '60' | '75';
    athletic_level?: 'low' | 'moderate' | 'high';
    training_age_years?: number;
    body_type?: 'lean' | 'average' | 'muscular';
    comfort_flags?: string[];
    // Current strength levels for starting weight calculations
    current_strength?: CurrentStrength;
    // NEW: Training split for 1x/2x daily
    training_split?: TrainingSplit;
    // NEW: Specific goal with target date
    specific_goal?: SpecificGoal;
}

// User Profile types
export interface UserProfile {
    userCode?: string; // Unique permanent code for buddy connections (REBLD-ABC123)
    lastProgressionApplied?: string; // ISO date string
    bodyMetrics?: BodyMetrics;
    goals?: UserGoal[];
    trainingPreferences?: TrainingPreferences;
    apiUsage?: {
        tier: 'free' | 'premium';
        plansGenerated: number;
        chatMessagesSent: number;
        plansParsed: number;
        periodStart: string; // ISO date
        periodEnd: string; // ISO date
        lastReset?: string | null;
    };
}

// Body Metrics
export interface BodyMetrics {
    weight?: number; // in lbs or kg
    height?: number; // in cm or ft
    heightUnit?: 'cm' | 'ft';
    bodyFatPercentage?: number;
    measurements?: {
        chest?: number;
        waist?: number;
        hips?: number;
        biceps?: number;
        thighs?: number;
    };
    lastUpdated?: string; // ISO date string
}

// Current Strength Levels (for starting weight calculations)
export interface CurrentStrength {
    squat_kg?: number;      // Back squat 8-10RM
    bench_kg?: number;      // Bench press 8-10RM
    deadlift_kg?: number;   // Deadlift 8-10RM
    row_kg?: number;        // Barbell row 8-10RM
    pullup_count?: number;  // Max strict pullups
}

// User Goals
export interface UserGoal {
    id?: string;
    type: 'workout_count' | 'weight_loss' | 'strength_gain' | 'custom';
    title: string; // e.g., "Complete 30 workouts"
    target: number; // e.g., 30
    current: number; // e.g., 18
    deadline?: string; // ISO date string
    createdAt?: string; // ISO date string
}

// Personal Records
export interface PersonalRecord {
    exercise_name: string;
    weight: number;
    reps: number;
    date: string; // ISO date string
    previousBest?: {
        weight: number;
        reps: number;
        date: string; // ISO date string
    };
}

// Progress Photos
export interface ProgressPhoto {
    _id: string;
    userId: string;
    photoUrl: string;
    photoType: 'front' | 'side' | 'back';
    date: string; // ISO date string
    aiAnalysis?: {
        bodyFatEstimate: number;
        muscleChanges: string;
        improvements: string[];
        suggestions: string[];
        confidence: number;
    };
    comparedTo: string | null; // ID of previous photo
    createdAt: string; // ISO date string
}
