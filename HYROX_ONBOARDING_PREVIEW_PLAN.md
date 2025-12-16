# REBLD Hyrox Onboarding & Preview Flow Implementation Plan

**Document Version:** 1.0
**Date:** December 2024
**Purpose:** Comprehensive implementation plan for LLM review and debate

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Part A: Enhanced Onboarding Flow](#4-part-a-enhanced-onboarding-flow)
5. [Part B: Preview & Feedback Flow](#5-part-b-preview--feedback-flow)
6. [Part C: Integration Layer](#6-part-c-integration-layer)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [API Contracts](#8-api-contracts)
9. [UI/UX Specifications](#9-uiux-specifications)
10. [Risk Analysis & Mitigations](#10-risk-analysis--mitigations)
11. [Implementation Sequence](#11-implementation-sequence)
12. [Open Questions for Debate](#12-open-questions-for-debate)

---

## 1. Executive Summary

### 1.1 What We're Building

Transform the existing single-prompt plan generation into a **sport-specific, multi-week periodized system** with user preview and feedback capabilities. The initial implementation focuses on **Hyrox** as the pilot sport.

### 1.2 Key Deliverables

| Component | Description | Complexity |
|-----------|-------------|------------|
| Enhanced Onboarding | Hyrox-specific data collection screens | Medium |
| Prompt Assembly Integration | Connect new `assembleHyroxPrompt.ts` to generation flow | Medium |
| Plan Validation Layer | Integrate `validateHyroxPlan.ts` for quality assurance | Medium |
| Preview UI | Week-by-week plan preview with edit capabilities | High |
| Feedback Loop | User feedback → regeneration with context | High |
| Job-based Generation | Background generation with progress tracking | Medium |

### 1.3 Success Criteria

1. **Hyrox-specific plans** include all 8 stations in appropriate frequency
2. **Running volume** matches phase targets (BASE: 25-35km/week, BUILD: 35-50km/week, etc.)
3. **User can preview** week before accepting, with ability to request changes
4. **Validation catches** 95%+ of anti-patterns before user sees plan
5. **Generation time** under 45 seconds for weekly plan

---

## 2. Current State Analysis

### 2.1 Existing Onboarding Flow

**Location:** `/components/onboarding/PersonalOnboarding.tsx` (1800+ lines)

**Current Steps:**
```
welcome → path → goal → schedule → body → strength → final → generating → complete
```

**Current Data Collected:**
- Path: `competition` or `general`
- Sport: Generic list (hyrox, powerlifting, marathon, etc.)
- Event date and name
- Training days (7-day selector)
- Session length (30/45/60/75/90 minutes)
- Sessions per day (1 or 2)
- Experience level (beginner/intermediate/advanced)
- Pain points (shoulders, lower_back, knees, wrists, neck, hips)
- Strength benchmarks (bench, squat, deadlift - optional)
- Age (optional)
- Additional notes (freeform text)

**Current Limitations for Hyrox:**
1. No running fitness assessment (5K time, weekly km)
2. No station proficiency assessment (weak/strong stations)
3. No previous Hyrox race data (PR, division)
4. No equipment access assessment (SkiErg, Sled availability)
5. No target time goal

### 2.2 Existing Generation Flow

**Location:** `/convex/ai.ts` → `generateWorkoutPlan` action

**Current Flow:**
```
User Input → silverPrompt.buildSilverPrompt() → DeepSeek API → Parse JSON → Save to DB
```

**Problems:**
1. Generic expert persona for all sports
2. No sport-specific validation
3. No volume/intensity constraints
4. No preview capability - plan goes directly to active

### 2.3 New Sport Knowledge Module

**Location:** `/convex/sportKnowledge/`

**Files Created:**
- `hyrox.ts` (~1100 lines) - Complete Hyrox knowledge database
- `exerciseMappings.ts` (566 lines) - Exercise categorization
- `assembleHyroxPrompt.ts` (807 lines) - Prompt assembly with constraints
- `validateHyroxPlan.ts` (731 lines) - Validation with auto-fix
- `index.ts` - Barrel exports

---

## 3. Architecture Overview

### 3.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Enhanced │    │  Prompt  │    │    AI    │    │ Preview  │              │
│  │Onboarding│───▶│ Assembly │───▶│Generation│───▶│   Flow   │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│       │                                                │                    │
│       │                                                │                    │
│       ▼                                                ▼                    │
│  ┌──────────┐                                   ┌──────────┐               │
│  │  User    │                                   │ Feedback │               │
│  │ Profile  │◀──────────────────────────────────│   Loop   │               │
│  └──────────┘                                   └──────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility | Key Files |
|-----------|---------------|-----------|
| Enhanced Onboarding | Collect Hyrox-specific user data | `HyroxOnboarding.tsx` (new) |
| Prompt Assembly | Transform user profile → constrained LLM prompt | `assembleHyroxPrompt.ts` |
| AI Generation | Call LLM with assembled prompt | `ai.ts` (modified) |
| Validation | Check plan quality, auto-fix issues | `validateHyroxPlan.ts` |
| Preview UI | Display plan for user review | `PlanPreview.tsx` (new) |
| Feedback Loop | Collect user feedback, regenerate | `FeedbackSheet.tsx` (new) |

---

## 4. Part A: Enhanced Onboarding Flow

### 4.1 New Hyrox-Specific Screens

When user selects **sport: "hyrox"** in path selection, inject additional screens:

#### Screen A1: Running Fitness Assessment

**Purpose:** Establish running base for volume prescription

**Data Collected:**
```typescript
interface RunningFitness {
  comfortable5kTimeMinutes: number;        // Required - key metric
  weeklyRunningKm: number;                 // Required - current volume
  longestRecentRunKm?: number;             // Optional - endurance indicator
  runningExperience: 'new' | '1-2years' | '3+years';
}
```

**UI Design:**
```
┌─────────────────────────────────────────┐
│ ← Back                                  │
│                                         │
│ Let's assess your running fitness       │
│ This determines your training paces     │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Your comfortable 5K time            │ │
│ │ ┌─────┐   ┌─────┐                   │ │
│ │ │ 25  │ : │ 30  │  minutes          │ │
│ │ └─────┘   └─────┘                   │ │
│ │ ↑ This sets your training paces     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Weekly running volume               │ │
│ │                                     │ │
│ │ ○ 0-10 km (building base)           │ │
│ │ ● 10-25 km (solid foundation)       │ │
│ │ ○ 25-40 km (experienced runner)     │ │
│ │ ○ 40+ km (high volume)              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Continue]                              │
└─────────────────────────────────────────┘
```

**Validation Rules:**
- 5K time: 15:00 - 45:00 range (reject outliers)
- If weekly km < 10, show warning about BASE phase duration

---

#### Screen A2: Station Proficiency

**Purpose:** Identify weak stations for extra practice

**Data Collected:**
```typescript
interface StationProficiency {
  weak: HyroxStation[];     // 0-3 selections
  strong: HyroxStation[];   // 0-3 selections
  neverDone: HyroxStation[]; // First-timer identification
}
```

**UI Design:**
```
┌─────────────────────────────────────────┐
│ ← Back                                  │
│                                         │
│ Which stations challenge you most?      │
│ Select up to 3 weak areas               │
│                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │SkiErg  │ │Sled Push│ │Sled Pull│    │
│ │   ○    │ │   ●    │ │   ●    │    │
│ └─────────┘ └─────────┘ └─────────┘    │
│                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │ Burpee │ │  Row   │ │Farmers │    │
│ │Br.Jump │ │        │ │ Carry  │    │
│ │   ○    │ │   ○    │ │   ○    │    │
│ └─────────┘ └─────────┘ └─────────┘    │
│                                         │
│ ┌─────────┐ ┌─────────┐                │
│ │Wall    │ │Sandbag │                │
│ │ Balls  │ │ Lunges │                │
│ │   ○    │ │   ●    │                │
│ └─────────┘ └─────────┘                │
│                                         │
│ □ I've never done Hyrox before         │
│   (We'll include station familiarization)│
│                                         │
│ [Continue]                              │
└─────────────────────────────────────────┘
```

**Logic:**
- If `isFirstRace === true`, pre-check "never done" option
- Weak stations → 2x/week in training plan
- Strong stations → 1x/week maintenance

---

#### Screen A3: Competition Details

**Purpose:** Set target time and collect race history

**Data Collected:**
```typescript
interface CompetitionDetails {
  targetTimeMinutes?: number;         // Goal finish time
  previousBestTimeMinutes?: number;   // If returning competitor
  division: 'open' | 'pro' | 'doubles';
  isFirstRace: boolean;
}
```

**UI Design:**
```
┌─────────────────────────────────────────┐
│ ← Back                                  │
│                                         │
│ Your Hyrox goals                        │
│                                         │
│ Have you done Hyrox before?             │
│ ┌─────────────────┐ ┌─────────────────┐ │
│ │ First timer    │ │ Returning       │ │
│ │      ●         │ │      ○          │ │
│ └─────────────────┘ └─────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Target finish time                  │ │
│ │ ┌─────┐   ┌─────┐                   │ │
│ │ │  1  │ : │ 30  │  hours            │ │
│ │ └─────┘   └─────┘                   │ │
│ │                                     │ │
│ │ Based on your 5K: ~1:25-1:35 likely │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Division                                │
│ ○ Open (standard weights)               │
│ ● Pro (heavier weights)                 │
│ ○ Doubles (partner event)               │
│                                         │
│ [Continue]                              │
└─────────────────────────────────────────┘
```

**Smart Defaults:**
- Target time auto-suggested from 5K time using formula:
  ```typescript
  suggestedTime = (fiveKMinutes * 8) + 15; // Rough heuristic
  ```

---

#### Screen A4: Equipment Access

**Purpose:** Identify equipment substitutions needed

**Data Collected:**
```typescript
interface EquipmentAccess {
  gymType: 'commercial' | 'crossfit_box' | 'hyrox_affiliate' | 'home';
  missingEquipment: string[]; // e.g., ['SkiErg', 'Sled']
}
```

**UI Design:**
```
┌─────────────────────────────────────────┐
│ ← Back                                  │
│                                         │
│ Your training environment               │
│                                         │
│ Where do you train?                     │
│ ○ Commercial gym                        │
│ ● CrossFit box                          │
│ ○ Hyrox affiliate gym                   │
│ ○ Home gym                              │
│                                         │
│ What equipment DON'T you have access to?│
│ (We'll provide alternatives)            │
│                                         │
│ □ SkiErg                                │
│ □ Rowing machine                        │
│ ☑ Sled (push/pull)                      │
│ □ Wall ball                             │
│ □ Sandbag                               │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ No sled? We'll substitute:          │ │
│ │ • Prowler push → Incline treadmill  │ │
│ │ • Sled pull → Cable face pull       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Continue]                              │
└─────────────────────────────────────────┘
```

---

### 4.2 Modified Onboarding Flow

**New Step Sequence (when sport === 'hyrox'):**
```
welcome → path → goal → hyrox_running → hyrox_stations → hyrox_competition
→ hyrox_equipment → schedule → body → final → generating → preview → complete
```

**Implementation Approach:**

```typescript
// In PersonalOnboarding.tsx
type Step =
  | 'welcome' | 'path' | 'goal'
  // Hyrox-specific (conditional)
  | 'hyrox_running' | 'hyrox_stations' | 'hyrox_competition' | 'hyrox_equipment'
  // Common
  | 'schedule' | 'body' | 'strength' | 'final'
  | 'generating' | 'preview' | 'complete';

const getNextStep = (currentStep: Step, sport: string | null): Step => {
  if (currentStep === 'goal' && sport === 'hyrox') {
    return 'hyrox_running';
  }
  // ... rest of flow logic
};
```

### 4.3 User Profile Schema Update

Add to `trainingPreferences` in schema:

```typescript
// In convex/schema.ts - add to trainingPreferences
hyrox_profile: v.optional(v.object({
  // Running fitness
  comfortable_5k_minutes: v.number(),
  weekly_running_km: v.number(),
  running_experience: v.union(
    v.literal('new'),
    v.literal('1-2years'),
    v.literal('3+years')
  ),

  // Station proficiency
  weak_stations: v.array(v.string()),
  strong_stations: v.array(v.string()),
  never_done_stations: v.array(v.string()),

  // Competition
  target_time_minutes: v.optional(v.number()),
  previous_best_minutes: v.optional(v.number()),
  division: v.union(
    v.literal('open'),
    v.literal('pro'),
    v.literal('doubles')
  ),
  is_first_race: v.boolean(),

  // Equipment
  gym_type: v.string(),
  missing_equipment: v.array(v.string()),
})),
```

---

## 5. Part B: Preview & Feedback Flow

### 5.1 Preview Screen Design

**Purpose:** Show user the generated week BEFORE activating, allow feedback

**Location:** New component `/components/plan/PlanPreview.tsx`

**UI Layout:**
```
┌─────────────────────────────────────────┐
│ Your Week 1 Training                    │
│ BASE Phase • 12 weeks out               │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ WEEKLY SUMMARY                      │ │
│ │ Running: 28 km  │  Stations: 6/8    │ │
│ │ Strength: 3x    │  Est. Time: 6.5h  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─── Monday ──────────────────────────┐ │
│ │ Easy Run + Sled Work                │ │
│ │ 🏃 5km easy @ 5:30/km               │ │
│ │ 💪 Sled Push 4x25m                  │ │
│ │ 💪 Sled Pull 4x25m                  │ │
│ │ ⏱ ~55 min                          │ │
│ │ [Expand]                            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─── Wednesday ───────────────────────┐ │
│ │ Intervals + SkiErg                  │ │
│ │ 🏃 6x800m @ 4:15/km (2min rest)     │ │
│ │ 🎿 3x500m SkiErg @ race pace        │ │
│ │ ⏱ ~50 min                          │ │
│ │ [Expand]                            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ... (more days)                         │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Something not right?                │ │
│ │ [Request Changes]                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Start This Week]                       │
└─────────────────────────────────────────┘
```

### 5.2 Preview Component Structure

```typescript
// /components/plan/PlanPreview.tsx

interface PlanPreviewProps {
  plan: GeneratedPlan;
  weekNumber: number;
  phase: Phase;
  weeksOut: number;
  volumeTargets: VolumeTargets;
  validationResult: ValidationResult;
  onAccept: () => void;
  onRequestChanges: () => void;
}

export function PlanPreview({
  plan,
  weekNumber,
  phase,
  weeksOut,
  volumeTargets,
  validationResult,
  onAccept,
  onRequestChanges,
}: PlanPreviewProps) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // Calculate actual volumes from plan
  const actualVolumes = useMemo(() => ({
    runningKm: plan.days.reduce((sum, day) =>
      sum + day.exercises.reduce((s, ex) =>
        s + extractRunningVolumeKm(ex), 0), 0),
    stationCount: countUniqueStations(plan),
    strengthSessions: countStrengthSessions(plan),
    totalMinutes: plan.days.reduce((sum, day) =>
      sum + (day.estimated_duration || 0), 0),
  }), [plan]);

  return (
    <div className="h-[100dvh] flex flex-col">
      {/* Header with phase info */}
      <PreviewHeader
        weekNumber={weekNumber}
        phase={phase}
        weeksOut={weeksOut}
      />

      {/* Volume summary card */}
      <VolumeSummary
        actual={actualVolumes}
        targets={volumeTargets}
      />

      {/* Validation warnings (if any) */}
      {validationResult.warnings.length > 0 && (
        <ValidationWarnings warnings={validationResult.warnings} />
      )}

      {/* Day-by-day breakdown */}
      <ScrollArea className="flex-1">
        {plan.days.map((day, index) => (
          <DayCard
            key={index}
            day={day}
            isExpanded={expandedDay === index}
            onToggle={() => setExpandedDay(
              expandedDay === index ? null : index
            )}
          />
        ))}
      </ScrollArea>

      {/* Action buttons */}
      <PreviewActions
        onAccept={onAccept}
        onRequestChanges={onRequestChanges}
      />
    </div>
  );
}
```

### 5.3 Feedback Collection

**Purpose:** Structured feedback for regeneration

**Feedback Types:**
```typescript
type FeedbackCategory =
  | 'too_much_volume'
  | 'too_little_volume'
  | 'wrong_exercises'
  | 'scheduling_issue'
  | 'intensity_too_high'
  | 'intensity_too_low'
  | 'missing_something'
  | 'other';

interface UserFeedback {
  category: FeedbackCategory;
  specificDays?: number[];        // Which days have issues
  specificExercises?: string[];   // Which exercises are problematic
  freeformText?: string;          // User's own words
  preferenceToRemember?: string;  // "Always" or "This week only"
}
```

**Feedback Sheet UI:**
```
┌─────────────────────────────────────────┐
│ ╳ What would you like to change?        │
│                                         │
│ Quick options:                          │
│ ┌─────────────────────────────────────┐ │
│ │ ○ Less running volume               │ │
│ │ ○ More running volume               │ │
│ │ ○ Shorter sessions                  │ │
│ │ ○ Different exercises               │ │
│ │ ○ More rest days                    │ │
│ │ ● Something else                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Tell us more (optional):                │
│ ┌─────────────────────────────────────┐ │
│ │ I'd prefer more sled work since     │ │
│ │ that's my weakest station...        │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ □ Remember this preference for future   │
│   weeks                                 │
│                                         │
│ [Regenerate Plan]                       │
└─────────────────────────────────────────┘
```

### 5.4 Regeneration with Feedback

When user requests changes:

```typescript
// Add to assembleHyroxPrompt.ts

interface RegenerationContext {
  previousPlan: GeneratedPlan;
  userFeedback: UserFeedback;
  validationIssues: ValidationIssue[];
  attemptNumber: number;
}

function assembleRegenerationPrompt(
  userProfile: UserProfile,
  weekContext: WeekContext,
  regenContext: RegenerationContext
): AssembledPrompt {
  const basePrompt = assembleHyroxPrompt(userProfile, weekContext);

  // Add regeneration-specific context
  const feedbackSection = `
## REGENERATION CONTEXT
This is attempt #${regenContext.attemptNumber}. The user rejected the previous plan.

### User Feedback
Category: ${regenContext.userFeedback.category}
${regenContext.userFeedback.freeformText ?
  `Details: "${regenContext.userFeedback.freeformText}"` : ''}

### Previous Plan Issues
${regenContext.validationIssues.map(i => `- ${i.message}`).join('\n')}

### CRITICAL: Address these specific concerns in the new plan.
`;

  return {
    ...basePrompt,
    userPrompt: basePrompt.userPrompt + feedbackSection,
  };
}
```

---

## 6. Part C: Integration Layer

### 6.1 Modified Generation Flow

```typescript
// New flow in /convex/ai.ts

export const generateHyroxPlan = action({
  args: {
    userId: v.string(),
    weekNumber: v.optional(v.number()),
    regenerationContext: v.optional(v.object({
      previousPlanId: v.optional(v.id("workoutPlans")),
      userFeedback: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args) => {
    // 1. Fetch user profile with Hyrox-specific data
    const userProfile = await ctx.runQuery(
      api.queries.getUserHyroxProfile,
      { userId: args.userId }
    );

    // 2. Calculate week context
    const weekContext = calculateWeekContext(
      userProfile.competition.date,
      args.weekNumber || 1
    );

    // 3. Assemble constrained prompt
    const prompt = args.regenerationContext
      ? assembleRegenerationPrompt(userProfile, weekContext, args.regenerationContext)
      : assembleHyroxPrompt(userProfile, weekContext);

    // 4. Call LLM
    const llmResponse = await callDeepSeek(prompt);

    // 5. Parse and validate
    const { plan, issues, score } = parseAndValidate(
      llmResponse,
      buildConstraints(userProfile, weekContext)
    );

    // 6. Auto-fix if needed
    let finalPlan = plan;
    if (score < 70) {
      finalPlan = autoFixPlan(plan, issues);
    }

    // 7. Return for preview (NOT saved yet)
    return {
      success: true,
      plan: finalPlan,
      validation: { issues, score },
      metadata: prompt.metadata,
    };
  },
});
```

### 6.2 Job-Based Generation (Background)

For longer generation or regeneration:

```typescript
// /convex/jobs/planGeneration.ts

interface GenerationJob {
  id: string;
  userId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  result?: GeneratedPlan;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// Schema addition
generationJobs: defineTable({
  userId: v.string(),
  jobType: v.union(
    v.literal('initial_generation'),
    v.literal('regeneration'),
    v.literal('next_week')
  ),
  status: v.union(
    v.literal('queued'),
    v.literal('running'),
    v.literal('completed'),
    v.literal('failed')
  ),
  progress: v.number(),
  input: v.any(), // UserProfile + context
  result: v.optional(v.any()), // GeneratedPlan
  error: v.optional(v.string()),
  createdAt: v.string(),
  completedAt: v.optional(v.string()),
})
  .index("by_userId", ["userId"])
  .index("by_status", ["status"]),
```

**Client-Side Polling:**
```typescript
// In PlanBuildingScreen.tsx

const useGenerationJob = (jobId: string) => {
  const job = useQuery(api.queries.getGenerationJob, { jobId });

  useEffect(() => {
    if (job?.status === 'completed' && job.result) {
      // Navigate to preview
      navigation.push('preview', { plan: job.result });
    }
  }, [job?.status]);

  return {
    status: job?.status,
    progress: job?.progress || 0,
    error: job?.error,
  };
};
```

### 6.3 Plan Activation Flow

```typescript
// When user accepts plan from preview

export const activatePlan = mutation({
  args: {
    userId: v.string(),
    plan: v.any(), // GeneratedPlan
    weekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Transform GeneratedPlan → WorkoutPlan schema
    const workoutPlan = transformToWorkoutPlan(args.plan);

    // 2. Save to workoutPlans
    const planId = await ctx.db.insert("workoutPlans", {
      userId: args.userId,
      name: `Hyrox Week ${args.weekNumber}`,
      weeklyPlan: workoutPlan.weeklyPlan,
      periodization: {
        total_weeks: calculateTotalWeeks(args.plan),
        current_week: args.weekNumber,
        phase: args.plan.phase,
      },
      createdAt: new Date().toISOString(),
    });

    // 3. Set as active plan
    await ctx.db.patch(userDoc._id, {
      activePlanId: planId,
    });

    // 4. Archive to week history
    await ctx.db.insert("weekHistory", {
      userId: args.userId,
      planId,
      weekNumber: args.weekNumber,
      phase: args.plan.phase,
      weeklyPlan: workoutPlan.weeklyPlan,
      completedAt: new Date().toISOString(),
      isDeloadWeek: args.plan.isDeload || false,
    });

    return { planId };
  },
});
```

---

## 7. Data Flow Diagrams

### 7.1 Initial Onboarding → First Plan

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │     │   Frontend   │     │   Backend    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Complete onboarding│                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ Save user profile  │
       │                    │───────────────────>│
       │                    │                    │
       │                    │ Start generation   │
       │                    │───────────────────>│
       │                    │                    │
       │                    │ (job created)      │
       │                    │<───────────────────│
       │                    │                    │
       │  Show loading      │                    │
       │<───────────────────│                    │
       │                    │                    │
       │                    │ Poll progress      │
       │                    │<──────────────────>│
       │                    │                    │
       │                    │ Plan ready         │
       │                    │<───────────────────│
       │                    │                    │
       │  Show preview      │                    │
       │<───────────────────│                    │
       │                    │                    │
       │ Accept plan        │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ Activate plan      │
       │                    │───────────────────>│
       │                    │                    │
       │  Show plan page    │                    │
       │<───────────────────│                    │
       │                    │                    │
```

### 7.2 Feedback → Regeneration

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │     │   Preview    │     │   Backend    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ View preview       │                    │
       │<───────────────────│                    │
       │                    │                    │
       │ "Request Changes"  │                    │
       │───────────────────>│                    │
       │                    │                    │
       │  Show feedback form│                    │
       │<───────────────────│                    │
       │                    │                    │
       │ Submit feedback    │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ Regenerate request │
       │                    │ (with feedback)    │
       │                    │───────────────────>│
       │                    │                    │
       │                    │ New plan generated │
       │                    │<───────────────────│
       │                    │                    │
       │  Show new preview  │                    │
       │<───────────────────│                    │
       │                    │                    │
```

---

## 8. API Contracts

### 8.1 Generation Action

```typescript
// Input
interface GenerateHyroxPlanArgs {
  userId: string;
  weekNumber?: number;                    // Default: 1
  regenerationContext?: {
    previousPlanId?: Id<"workoutPlans">;
    userFeedback?: UserFeedback;
  };
}

// Output
interface GenerateHyroxPlanResult {
  success: boolean;
  plan?: GeneratedPlan;
  validation?: {
    issues: ValidationIssue[];
    score: number;                        // 0-100
  };
  metadata?: {
    phase: Phase;
    experienceLevel: ExperienceLevel;
    volumeTargets: VolumeTargets;
    generationTimeMs: number;
  };
  error?: string;
}
```

### 8.2 Activation Mutation

```typescript
// Input
interface ActivatePlanArgs {
  userId: string;
  plan: GeneratedPlan;
  weekNumber: number;
}

// Output
interface ActivatePlanResult {
  planId: Id<"workoutPlans">;
}
```

### 8.3 User Profile Query

```typescript
// Input
interface GetUserHyroxProfileArgs {
  userId: string;
}

// Output (matches UserProfile from assembleHyroxPrompt.ts)
interface UserHyroxProfile {
  userId: string;
  competition: {
    date: Date;
    division: Division;
    isFirstRace: boolean;
    targetTimeMinutes?: number;
    previousBestTimeMinutes?: number;
  };
  fitness: {
    runningLevel: 'beginner' | 'intermediate' | 'advanced';
    comfortable5kTimeMinutes?: number;
    weeklyRunningKm?: number;
    strengthLevel: 'beginner' | 'intermediate' | 'advanced';
    maxes?: { benchPressKg?: number; backSquatKg?: number; deadliftKg?: number };
    trainingYears?: number;
  };
  stations?: {
    weak?: string[];
    strong?: string[];
  };
  schedule: {
    trainingDays: 3 | 4 | 5 | 6;
    sessionLengthMinutes: number;
    canDoTwoADay?: boolean;
  };
  constraints: {
    painPoints?: string[];
    injuries?: Array<{ area: string; severity: string; notes?: string }>;
  };
  equipment: {
    gymType: string;
    missingEquipment?: string[];
  };
}
```

---

## 9. UI/UX Specifications

### 9.1 Design System Compliance

All new components must follow existing design system:

```typescript
// From PersonalOnboarding.tsx - reuse these tokens
const colors = {
  bg: '#0C0C0C',
  surface: '#1A1A1A',
  surfaceHover: '#222222',
  border: '#2A2A2A',
  textPrimary: '#F5F5F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  accent: '#EF4444',
  success: '#22C55E',
};

const spacing = {
  pagePadding: 'clamp(16px, 5vw, 24px)',
  sectionGap: 'clamp(16px, 4vw, 24px)',
  elementGap: 'clamp(8px, 2vw, 12px)',
};

const typography = {
  headline: 'clamp(1.5rem, 5vw + 0.5rem, 2rem)',
  body: 'clamp(0.938rem, 2vw + 0.5rem, 1.063rem)',
  secondary: 'clamp(0.813rem, 1.5vw + 0.5rem, 0.938rem)',
};

const touchTargets = {
  button: 'clamp(44px, 12vw, 56px)',  // Min 44px per Apple HIG
};
```

### 9.2 Animation Standards

Use Framer Motion with consistent patterns:

```typescript
// Page transitions
const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
};

// Card expansions
const cardExpand = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

// Button feedback
const buttonTap = {
  whileTap: { scale: 0.98 },
};
```

### 9.3 Haptic Feedback

Use existing haptic hook at key moments:

```typescript
const haptic = useHaptic();

// Light - navigation, selection
haptic.light();

// Medium - important actions
haptic.medium();

// Heavy - errors, warnings
haptic.heavy();

// Success - plan accepted
haptic.success();
```

### 9.4 Loading States

Preview loading should show meaningful progress:

```
┌─────────────────────────────────────────┐
│                                         │
│      [Hyrox Logo Animation]             │
│                                         │
│   Building your Week 1 training...      │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │████████████████░░░░░░░░░░░░░░░░│   │
│   └─────────────────────────────────┘   │
│              67%                        │
│                                         │
│   ✓ Analyzing 12-week periodization     │
│   ✓ Setting BASE phase volumes          │
│   → Selecting station drills...         │
│   ○ Optimizing recovery windows         │
│   ○ Final validation                    │
│                                         │
│   Your weak stations (sled, lunges)     │
│   will appear 2x this week              │
│                                         │
└─────────────────────────────────────────┘
```

---

## 10. Risk Analysis & Mitigations

### 10.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM ignores constraints | Medium | High | Validation layer + auto-fix + regeneration |
| Generation timeout (>60s) | Low | Medium | Background jobs + progress polling |
| Invalid JSON from LLM | Medium | High | Robust parsing + fallback to previous format |
| Equipment substitutions wrong | Medium | Medium | Human-curated substitution database |
| Volume calculation errors | Low | High | Unit tests for all extraction functions |

### 10.2 UX Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Onboarding too long | Medium | High | Progress indicator + skip options for optional fields |
| Preview overwhelming | Medium | Medium | Collapsed day cards + summary first |
| Feedback loop frustrating | Low | High | Max 2 regenerations then human support |
| Users don't understand phases | High | Low | Phase explanation cards + tooltips |

### 10.3 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hyrox trademark issues | Low | High | Use "Hyrox-style" or get permission |
| Generated plans cause injury | Low | Critical | Conservative defaults + injury disclaimers |
| API costs too high | Medium | Medium | Caching + batch operations + rate limiting |

---

## 11. Implementation Sequence

### Phase 1: Foundation (Backend)
1. Add `hyrox_profile` to user schema
2. Create `getUserHyroxProfile` query
3. Integrate `assembleHyroxPrompt` into generation flow
4. Integrate `validateHyroxPlan` for validation
5. Add `generationJobs` table for background processing

### Phase 2: Onboarding Enhancement (Frontend)
1. Create Hyrox-specific onboarding screens as components
2. Integrate conditional screen flow in `PersonalOnboarding.tsx`
3. Update profile save mutation to include Hyrox data
4. Test end-to-end onboarding flow

### Phase 3: Preview Flow (Frontend)
1. Create `PlanPreview.tsx` component
2. Create `DayCard.tsx` expandable component
3. Create `VolumeSummary.tsx` component
4. Create `FeedbackSheet.tsx` bottom sheet
5. Integrate preview into generation completion flow

### Phase 4: Feedback & Regeneration
1. Create regeneration prompt assembly
2. Add feedback collection to backend
3. Implement regeneration action
4. Add regeneration limit (max 2 attempts)
5. Add "remember preference" storage

### Phase 5: Polish & Testing
1. Add analytics events for funnel tracking
2. Add error boundaries and fallbacks
3. Performance optimization (memo, lazy loading)
4. User testing with real Hyrox athletes
5. Iterate based on feedback

---

## 12. Open Questions for Debate

### Q1: Should preview be mandatory or optional?

**Option A: Mandatory Preview**
- Pro: Catches all issues before user starts
- Pro: Builds user confidence in system
- Con: Adds friction to getting started

**Option B: Optional Preview (with nudge)**
- Pro: Power users can skip
- Pro: Faster for confident users
- Con: More support requests for bad plans

**Current Recommendation:** Mandatory for first plan, optional for subsequent weeks

---

### Q2: How many regeneration attempts before escalation?

**Option A: Unlimited regenerations**
- Pro: User gets exactly what they want
- Pro: No support escalation needed
- Con: API costs, user frustration

**Option B: 2 attempts, then different flow**
- Pro: Forces improvement of base system
- Pro: Contains costs
- Con: May frustrate some users

**Option C: 3 attempts, then manual adjustment UI**
- Pro: Balance of automation and control
- Con: More UI complexity

**Current Recommendation:** 2 automated attempts, then show manual edit UI

---

### Q3: Should we store ALL generated plans or only accepted ones?

**Option A: Store all (including rejected)**
- Pro: Training data for improvements
- Pro: Debug rejected plans
- Con: Storage costs, privacy concerns

**Option B: Store only accepted plans**
- Pro: Simpler, cleaner
- Pro: Privacy-friendly
- Con: Lose learning opportunities

**Option C: Store anonymized rejected plans**
- Pro: Learn from rejections
- Pro: Privacy maintained
- Con: Implementation complexity

**Current Recommendation:** Option C - anonymized rejected plans for analysis

---

### Q4: Equipment substitution - deterministic or LLM?

**Option A: Deterministic mapping (current approach)**
```typescript
const SUBSTITUTIONS = {
  'SkiErg': ['Assault Bike', 'Battle Ropes + Burpees'],
  'Sled Push': ['Incline Treadmill Walk', 'Prowler Alternative'],
};
```
- Pro: Predictable, testable
- Pro: Fast, no API call
- Con: May miss creative alternatives

**Option B: LLM suggests substitutions**
- Pro: More creative solutions
- Pro: Context-aware (knows user's equipment)
- Con: Variable quality, slower

**Current Recommendation:** Deterministic with curated database (Option A)

---

### Q5: Phase transitions - automatic or user-confirmed?

When moving from BASE → BUILD phase:

**Option A: Automatic progression**
- Pro: Hands-off experience
- Con: User may not be ready

**Option B: User confirms phase change**
- Pro: User feels in control
- Pro: Can delay if not ready
- Con: Extra friction

**Option C: System suggests, user can override**
- Pro: Best of both
- Con: More UI complexity

**Current Recommendation:** Option C with clear phase explanation

---

### Q6: Multi-week preview or week-at-a-time?

**Option A: Generate full 12-16 weeks upfront**
- Pro: User sees full journey
- Con: Huge generation cost
- Con: Can't adapt to progress

**Option B: Week-at-a-time with future preview**
- Pro: Adapts to actual progress
- Pro: Lower upfront cost
- Con: User can't see far ahead

**Option C: Generate 4-week blocks**
- Pro: Balance of preview and adaptability
- Con: Still significant cost

**Current Recommendation:** Week-at-a-time (Option B) with phase overview showing structure

---

### Q7: What's the minimum viable data for Hyrox onboarding?

**Required (generation fails without):**
- Competition date
- 5K time OR running self-assessment
- Training days available

**Important (significantly improves plan):**
- Weak stations
- Equipment access
- Session length preference

**Nice-to-have (polish):**
- Target finish time
- Previous race data
- Strength benchmarks

**Debate:** Should we allow "I don't know my 5K time" and estimate from running self-assessment?

---

### Q8: How to handle first-time Hyrox athletes?

Users who have never done Hyrox need:
- Station familiarization period
- More technique focus, less intensity
- Realistic expectation setting

**Option A: Separate "First Timer" track**
- Different plan structure entirely
- Con: Maintains two codepaths

**Option B: Same structure with first-timer modifications**
- Add technique notes to exercises
- Lower initial volumes
- Pro: Single codebase

**Current Recommendation:** Option B with `isFirstRace` flag modifying plan parameters

---

## Summary

This plan provides a comprehensive blueprint for implementing:
1. Enhanced Hyrox-specific onboarding (4 new screens)
2. Prompt assembly integration with validation
3. Preview flow with user control
4. Feedback loop for regeneration
5. Job-based background generation

The architecture leverages the existing sport knowledge module (`/convex/sportKnowledge/`) and extends the current onboarding flow with conditional Hyrox-specific screens.

Key technical decisions favor:
- Deterministic validation over LLM judgment
- Week-at-a-time generation for adaptability
- Background jobs for reliability
- Mandatory preview for quality assurance

The open questions in Section 12 represent genuine architectural decisions that would benefit from external review and debate.
