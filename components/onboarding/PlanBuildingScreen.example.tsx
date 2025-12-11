/* ═══════════════════════════════════════════════════════════════════════════
   USAGE EXAMPLE - PlanBuildingScreen Integration

   This shows how to integrate the intelligent loading screen into the
   onboarding flow. Replace the existing boring "Building..." screen
   with this contextual AI progress indicator.

   ═══════════════════════════════════════════════════════════════════════════ */

import PlanBuildingScreen from './PlanBuildingScreen';

// Example 1: Competition Prep User (Hyrox)
function CompetitionPrepExample() {
  const preferences = {
    primary_goal: 'Competition Prep',
    specificGoal: {
      event_type: 'hyrox',
      target_date: '2025-06-15', // 6 months out
    },
    currentStrength: {
      squat_kg: 100,
      bench_kg: 80,
      deadlift_kg: 140,
    },
    painPoints: ['Knees', 'Lower Back'],
    training_split: {
      training_type: 'combined',
    },
  };

  return (
    <PlanBuildingScreen
      preferences={preferences}
      onComplete={() => {
        console.log('Plan generation complete!');
        // Navigate to reveal screen
      }}
    />
  );
}

// Example 2: Strength & Power User (No Competition)
function StrengthPowerExample() {
  const preferences = {
    primary_goal: 'Strength & Power',
    currentStrength: {
      squat_kg: 120,
      bench_kg: 90,
      deadlift_kg: 160,
      overhead_press_kg: 60,
    },
    painPoints: ['Shoulders'],
    training_split: {
      training_type: 'strength_only',
    },
  };

  return (
    <PlanBuildingScreen
      preferences={preferences}
      onComplete={() => {
        console.log('Plan generation complete!');
      }}
    />
  );
}

// Example 3: Athletic Performance (Marathon)
function AthleticPerformanceExample() {
  const preferences = {
    primary_goal: 'Athletic Performance',
    specificGoal: {
      event_type: 'marathon',
      target_date: '2025-10-15',
    },
    training_split: {
      training_type: 'cardio_focused',
    },
    painPoints: [],
  };

  return (
    <PlanBuildingScreen
      preferences={preferences}
      onComplete={() => {
        console.log('Plan generation complete!');
      }}
    />
  );
}

// Example 4: Beginner (Minimal Equipment)
function BeginnerExample() {
  const preferences = {
    primary_goal: 'Health & Longevity',
    training_split: {
      training_type: 'combined',
    },
    painPoints: ['Lower Back'],
  };

  return (
    <PlanBuildingScreen
      preferences={preferences}
      onComplete={() => {
        console.log('Plan generation complete!');
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION INTO ZENONBOARDING.TSX
// ═══════════════════════════════════════════════════════════════════════════

/*

Replace the `renderBuilding()` function in ZenOnboarding.tsx with:

```typescript
import PlanBuildingScreen from './onboarding/PlanBuildingScreen';

// Inside ZenOnboarding component:
const renderBuilding = () => {
  if (error) {
    // Keep existing error handling
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8">
        <div className="absolute top-[max(6rem,env(safe-area-inset-top))] left-6 right-6">
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
            <button
              onClick={() => { setError(null); setIsGenerating(false); generatePlan(); }}
              className="w-full mt-3 py-2 text-red-400 font-medium text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Build preferences object
  const buildingPreferences = {
    primary_goal: goal,
    currentStrength: Object.keys(currentStrength).length > 0 ? currentStrength : undefined,
    specificGoal: specificGoal || undefined,
    sport: goal === 'Athletic Performance' ? specificGoal?.event_type : undefined,
    painPoints,
    training_split: trainingSplit,
  };

  return (
    <PlanBuildingScreen
      preferences={buildingPreferences}
      onComplete={() => {
        // This will be called when progress reaches 100%
        // The actual plan generation happens in parallel
        // When generatedPlan is set, phase will change to 'reveal'
      }}
    />
  );
};
```

The progress animation will run for 20-30 seconds while the actual AI
generation happens in the background. When the plan is ready, the
existing useEffect will automatically transition to the reveal phase.

*/

export { CompetitionPrepExample, StrengthPowerExample, AthleticPerformanceExample, BeginnerExample };
