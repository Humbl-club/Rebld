import React, { useState } from 'react';
import WeekBuilder from './WeekBuilder';
import BodyMap from './BodyMap';
import BenchmarkInput from './BenchmarkInput';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   ONBOARDING COMPONENTS DEMO

   This file demonstrates how to use the three visual input components:
   - WeekBuilder: Training day selection
   - BodyMap: Pain point/injury selection
   - BenchmarkInput: Strength benchmarks

   Usage in your onboarding flow:
   1. Import the components you need
   2. Manage state at the parent level
   3. Pass data to onChange handlers
   4. Use the data for plan generation
   ═══════════════════════════════════════════════════════════════ */

export default function OnboardingComponentsDemo() {
  // Week Builder State
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 2, 4]); // Mon, Wed, Fri

  // Body Map State
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['Lower Back', 'Knees']);

  // Benchmark Input State
  const [benchmarkValues, setBenchmarkValues] = useState<Record<string, number>>({
    bench_press: 80,
    squat: 100,
    deadlift: 0, // Not provided
    overhead_press: 0,
    barbell_row: 0,
  });
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');

  // Demo: Current step
  const [currentStep, setCurrentStep] = useState<'week' | 'body' | 'benchmark'>('week');

  const handleGeneratePlan = () => {
    console.log('Generating plan with:', {
      trainingDays: selectedDays,
      painPoints: selectedAreas,
      benchmarks: benchmarkValues,
      unit
    });
    alert('Plan generation would happen here! Check console for data.');
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="pt-safe-top px-6 py-4 border-b border-border-subtle">
        <h1 className="text-text-primary font-black text-2xl mb-1">
          Onboarding Components
        </h1>
        <p className="text-text-secondary text-sm">
          Demo of WeekBuilder, BodyMap, and BenchmarkInput
        </p>
      </div>

      {/* Step Selector */}
      <div className="px-6 py-4 border-b border-border-subtle bg-surface-primary">
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentStep('week')}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-colors',
              currentStep === 'week'
                ? 'bg-brand-primary text-text-on-brand'
                : 'bg-surface-secondary text-text-secondary'
            )}
          >
            Week Builder
          </button>
          <button
            onClick={() => setCurrentStep('body')}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-colors',
              currentStep === 'body'
                ? 'bg-brand-primary text-text-on-brand'
                : 'bg-surface-secondary text-text-secondary'
            )}
          >
            Body Map
          </button>
          <button
            onClick={() => setCurrentStep('benchmark')}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-colors',
              currentStep === 'benchmark'
                ? 'bg-brand-primary text-text-on-brand'
                : 'bg-surface-secondary text-text-secondary'
            )}
          >
            Benchmarks
          </button>
        </div>
      </div>

      {/* Component Display */}
      <div className="px-6 py-6 pb-32">
        {currentStep === 'week' && (
          <WeekBuilder
            selectedDays={selectedDays}
            onChange={setSelectedDays}
          />
        )}

        {currentStep === 'body' && (
          <BodyMap
            selectedAreas={selectedAreas}
            onChange={setSelectedAreas}
          />
        )}

        {currentStep === 'benchmark' && (
          <BenchmarkInput
            values={benchmarkValues}
            onChange={setBenchmarkValues}
            unit={unit}
          />
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 pb-safe-bottom pt-4 px-6 bg-gradient-to-t from-bg-primary via-bg-primary to-transparent border-t border-border-subtle">
        <button
          onClick={handleGeneratePlan}
          className="w-full h-button-lg rounded-xl bg-brand-primary text-text-on-brand font-bold text-base uppercase tracking-wider active:scale-[0.98] transition-transform"
        >
          Generate Plan
        </button>

        {/* Data Summary */}
        <div className="mt-3 p-3 rounded-lg bg-surface-secondary">
          <p className="text-text-tertiary text-xs mb-2">Current selections:</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-text-secondary font-semibold">{selectedDays.length} days</p>
              <p className="text-text-tertiary">Training</p>
            </div>
            <div>
              <p className="text-text-secondary font-semibold">{selectedAreas.length} areas</p>
              <p className="text-text-tertiary">Protected</p>
            </div>
            <div>
              <p className="text-text-secondary font-semibold">
                {Object.values(benchmarkValues).filter((v): v is number => typeof v === 'number' && v > 0).length} / 5
              </p>
              <p className="text-text-tertiary">Benchmarks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INTEGRATION EXAMPLE

   Here's how to integrate these components into ZenOnboarding.tsx:

   1. Add new question cases:

   case 'trainingDays':
     return (
       <QuestionCard headline="Training Schedule" subtext="Select your available days">
         <WeekBuilder
           selectedDays={selectedDays}
           onChange={setSelectedDays}
         />
         <ContinueButton onClick={goToNextQuestion} />
       </QuestionCard>
     );

   2. Add pain points with visual interface:

   case 'painPoints':
     return (
       <QuestionCard headline="Pain Points" subtext="Areas to protect">
         <BodyMap
           selectedAreas={painPoints}
           onChange={setPainPoints}
         />
         <ContinueButton onClick={goToNextQuestion} />
       </QuestionCard>
     );

   3. Replace the strength input section:

   case 'strength':
     return (
       <QuestionCard headline="Strength Benchmarks" subtext="Optional but recommended">
         <BenchmarkInput
           values={currentStrength}
           onChange={setCurrentStrength}
           unit="kg"
         />
         <ContinueButton onClick={goToNextQuestion} label="Continue to Build" />
       </QuestionCard>
     );

   ═══════════════════════════════════════════════════════════════ */
