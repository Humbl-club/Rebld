import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   INTELLIGENT LOADING SCREEN - Contextual AI Progress

   Replaces boring spinner with dynamic "AI thinking" steps based on user choices.
   Shows what the AI is actually doing with the user's data.

   Features:
   - Dynamic steps generated from user preferences (not generic)
   - Each step shows insight about what it unlocks
   - Steps progress: pending → active → complete
   - Progress bar with percentage
   - Phase preview for competition users
   - Simulates realistic progress over 20-30 seconds

   ═══════════════════════════════════════════════════════════════════════════ */

interface BuildStep {
  id: string;
  label: string;
  insight?: string;
  status: 'pending' | 'active' | 'complete';
}

interface PlanBuildingScreenProps {
  preferences: {
    currentStrength?: Record<string, number>;
    specificGoal?: {
      target_date?: string;
      sport?: string;
      event_type?: string;
    };
    sport?: string;
    painPoints?: string[];
    trainingDays?: number[];
    primary_goal?: string;
    training_split?: {
      training_type?: string;
    };
  };
  /** External progress (0-100) from parent component */
  progress?: number;
  /** Status text from parent */
  statusText?: string;
  onComplete?: () => void;
}

export default function PlanBuildingScreen({
  preferences,
  progress: externalProgress = 0,
  statusText: externalStatusText,
  onComplete
}: PlanBuildingScreenProps) {
  const [steps, setSteps] = useState<BuildStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Use external progress from parent
  const progress = externalProgress;

  // Calculate periodization phases for competition prep
  const phases = useMemo(() => {
    if (!preferences.specificGoal?.target_date) return null;

    const weeksUntilEvent = Math.ceil(
      (new Date(preferences.specificGoal.target_date).getTime() - Date.now()) /
      (7 * 24 * 60 * 60 * 1000)
    );

    if (weeksUntilEvent <= 0) return null;

    // Calculate phase distribution (35% base, 35% build, 15% peak, 15% taper)
    const base = Math.max(1, Math.floor(weeksUntilEvent * 0.35));
    const build = Math.max(1, Math.floor(weeksUntilEvent * 0.35));
    const peak = Math.max(1, Math.floor(weeksUntilEvent * 0.15));
    const taper = Math.max(1, weeksUntilEvent - base - build - peak);

    return { base, build, peak, taper, total: weeksUntilEvent };
  }, [preferences.specificGoal?.target_date]);

  // Generate dynamic steps based on user preferences
  useEffect(() => {
    const generatedSteps: BuildStep[] = [];

    // Always: Read profile
    generatedSteps.push({
      id: 'profile',
      label: 'Reading your profile',
      insight: 'Loading training history and preferences',
      status: 'pending',
    });

    // If strength benchmarks provided
    if (preferences.currentStrength && Object.keys(preferences.currentStrength).length > 0) {
      const liftCount = Object.keys(preferences.currentStrength).length;
      generatedSteps.push({
        id: 'strength',
        label: 'Analyzing strength benchmarks',
        insight: `${liftCount} lift${liftCount > 1 ? 's' : ''} → calculating starting weights`,
        status: 'pending',
      });
    }

    // If competition date provided
    if (preferences.specificGoal?.target_date && phases) {
      generatedSteps.push({
        id: 'periodization',
        label: `Creating ${phases.total}-week periodization`,
        insight: `${phases.base}w Base → ${phases.build}w Build → ${phases.peak}w Peak → ${phases.taper}w Taper`,
        status: 'pending',
      });
    }

    // If sport selected
    const sport = preferences.specificGoal?.event_type || preferences.sport;
    if (sport) {
      const sportName = sport.charAt(0).toUpperCase() + sport.slice(1).replace('_', ' ');
      let sportInsight = 'Sport-specific exercise selection';

      // Sport-specific insights
      if (sport === 'hyrox') sportInsight = 'Functional strength + running endurance';
      else if (sport === 'powerlifting') sportInsight = 'Heavy compounds, deload weeks';
      else if (sport === 'marathon' || sport === 'half_marathon') sportInsight = 'Endurance base, strength maintenance';
      else if (sport === 'triathlon') sportInsight = 'Multi-modal conditioning';
      else if (sport === 'crossfit') sportInsight = 'High-intensity functional training';
      else if (sport === 'bodybuilding') sportInsight = 'Hypertrophy focus, volume phases';

      generatedSteps.push({
        id: 'sport',
        label: `Applying ${sportName} protocols`,
        insight: sportInsight,
        status: 'pending',
      });
    }

    // If pain points provided
    if (preferences.painPoints && preferences.painPoints.length > 0) {
      const areas = preferences.painPoints.join(', ');
      generatedSteps.push({
        id: 'injury',
        label: 'Protecting injury areas',
        insight: `Avoiding ${areas} stress`,
        status: 'pending',
      });
    }

    // If cardio training
    if (preferences.training_split?.training_type &&
        preferences.training_split.training_type !== 'strength_only') {
      generatedSteps.push({
        id: 'cardio',
        label: 'Scheduling cardio sessions',
        insight: 'Balancing strength and conditioning',
        status: 'pending',
      });
    }

    // Always: Rest days
    generatedSteps.push({
      id: 'rest',
      label: 'Distributing rest days',
      insight: 'Optimizing recovery windows',
      status: 'pending',
    });

    // Always: Warmup
    generatedSteps.push({
      id: 'warmup',
      label: 'Selecting warmup mobility',
      insight: 'Injury prevention and activation',
      status: 'pending',
    });

    // Always: Cooldown
    generatedSteps.push({
      id: 'cooldown',
      label: 'Adding cooldown stretches',
      insight: 'Recovery and flexibility work',
      status: 'pending',
    });

    setSteps(generatedSteps);
  }, [preferences, phases]);

  // Sync step status to external progress
  useEffect(() => {
    if (steps.length === 0) return;

    // Calculate which step should be active based on external progress
    const targetIndex = Math.min(
      Math.floor((progress / 100) * steps.length),
      steps.length - 1
    );

    if (targetIndex !== currentStepIndex) {
      setSteps(prev => prev.map((step, idx) => {
        if (idx < targetIndex) return { ...step, status: 'complete' };
        if (idx === targetIndex) return { ...step, status: 'active' };
        return { ...step, status: 'pending' };
      }));
      setCurrentStepIndex(targetIndex);
    }

    // All complete when progress hits 100
    if (progress >= 100) {
      setSteps(prev => prev.map(step => ({ ...step, status: 'complete' })));
      onComplete?.();
    }
  }, [progress, steps.length, currentStepIndex, onComplete]);

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-white font-bold text-xl mb-2">
          Building Your Plan
        </h2>
        <p className="text-white/60 text-sm">
          AI is analyzing your preferences
        </p>
      </div>

      {/* Steps Container */}
      <div className="w-full max-w-md bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 mb-6">
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'flex items-start gap-3 transition-all duration-300',
                step.status === 'pending' && 'opacity-40',
                step.status === 'active' && 'opacity-100',
                step.status === 'complete' && 'opacity-70'
              )}
            >
              {/* Status Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {step.status === 'complete' && (
                  <div className="w-5 h-5 rounded-full bg-[#EF4444] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {step.status === 'active' && (
                  <div className="w-5 h-5 rounded-full bg-[#EF4444] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </div>
                )}
                {step.status === 'pending' && (
                  <div className="w-5 h-5 rounded-full border-2 border-white/20" />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-semibold',
                  step.status === 'complete' && 'text-white/70',
                  step.status === 'active' && 'text-white',
                  step.status === 'pending' && 'text-white/70'
                )}>
                  {step.label}
                </p>
                {step.insight && (
                  <p className={cn(
                    'text-xs mt-0.5',
                    step.status === 'complete' && 'text-white/70',
                    step.status === 'active' && 'text-[#EF4444]/90',
                    step.status === 'pending' && 'text-white/70'
                  )}>
                    {step.insight}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/70 text-xs font-medium">Progress</span>
          <span className="text-white/70 text-xs font-medium tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#EF4444] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phase Preview (Competition Prep Only) */}
      {phases && preferences.specificGoal?.target_date && (
        <div className="w-full max-w-md mt-8 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-semibold text-sm">Training Phases</p>
            <p className="text-[#EF4444] font-bold text-sm">{phases.total} weeks</p>
          </div>

          {/* Phase Visualization */}
          <div className="flex h-2 rounded-full overflow-hidden mb-3">
            <div
              style={{ width: `${(phases.base / phases.total) * 100}%` }}
              className="bg-blue-500"
              title={`Base: ${phases.base}w`}
            />
            <div
              style={{ width: `${(phases.build / phases.total) * 100}%` }}
              className="bg-yellow-500"
              title={`Build: ${phases.build}w`}
            />
            <div
              style={{ width: `${(phases.peak / phases.total) * 100}%` }}
              className="bg-orange-500"
              title={`Peak: ${phases.peak}w`}
            />
            <div
              style={{ width: `${(phases.taper / phases.total) * 100}%` }}
              className="bg-green-500"
              title={`Taper: ${phases.taper}w`}
            />
          </div>

          {/* Phase Labels */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-white/70">Base ({phases.base}w)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
              <span className="text-white/70">Build ({phases.build}w)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
              <span className="text-white/70">Peak ({phases.peak}w)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-white/70">Taper ({phases.taper}w)</span>
            </div>
          </div>

          <p className="text-white/70 text-[10px] mt-3 text-center">
            Deload weeks scheduled every 4 weeks
          </p>
        </div>
      )}

      {/* Timing Note */}
      <p className="text-white/70 text-xs mt-6">
        Typically takes 20-30 seconds
      </p>
    </div>
  );
}
