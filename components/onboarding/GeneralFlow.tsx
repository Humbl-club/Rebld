import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { DumbbellIcon, TrendingUpIcon, FlameIcon, HeartIcon, ChevronRightIcon } from '@/components/icons';

/* ═══════════════════════════════════════════════════════════════
   GENERAL FLOW - Onboarding for Non-Competition Training

   For users without a specific event deadline.
   Single step: Goal Selection with detailed descriptions
   ═══════════════════════════════════════════════════════════════ */

export interface GeneralFlowData {
  goal: 'muscle' | 'strength' | 'fat_loss' | 'general' | null;
}

interface GeneralFlowProps {
  data: GeneralFlowData;
  onUpdate: (data: Partial<GeneralFlowData>) => void;
  onNext: () => void;
  onBack: () => void;
}

// Goal configurations with detailed descriptions
const GOALS = [
  {
    id: 'muscle' as const,
    title: 'BUILD MUSCLE',
    subtitle: 'Hypertrophy Focus',
    description: 'Hypertrophy-focused training with 8-12 rep range, volume-based progressive overload, and strategic exercise selection for maximum muscle growth.',
    icon: DumbbellIcon,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    textColor: 'text-purple-400',
    details: [
      '8-12 rep range for optimal hypertrophy',
      'High volume with strategic progressive overload',
      'Compound movements + isolation work',
      'Emphasis on time under tension',
      'Moderate rest periods (60-90s)',
    ],
    intensity: 'Moderate-High',
    sessionExample: '4-6 exercises, 3-4 sets each, ~60min',
  },
  {
    id: 'strength' as const,
    title: 'GET STRONGER',
    subtitle: 'Max Strength Focus',
    description: 'Strength-focused training with 3-6 rep range, heavy compound lifts, low volume but high intensity for maximum force production.',
    icon: TrendingUpIcon,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    textColor: 'text-blue-400',
    details: [
      '3-6 rep range for maximum strength',
      'Heavy compound lifts (squat, bench, deadlift)',
      'Low volume, high intensity',
      'Progressive weight increases each cycle',
      'Long rest periods (3-5min)',
    ],
    intensity: 'Very High',
    sessionExample: '3-5 compound lifts, 3-5 sets each, ~75min',
  },
  {
    id: 'fat_loss' as const,
    title: 'LOSE FAT',
    subtitle: 'Body Recomposition',
    description: 'Muscle preservation with calorie burn optimization. Hybrid strength + cardio programming designed to maximize fat loss while maintaining lean mass.',
    icon: FlameIcon,
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    textColor: 'text-red-400',
    details: [
      'Strength training to preserve muscle mass',
      'Strategic cardio for calorie expenditure',
      'Circuit-style training for efficiency',
      'Higher rep ranges with supersets',
      'Shorter rest periods (30-60s)',
    ],
    intensity: 'High',
    sessionExample: 'Strength circuits + cardio finishers, ~50min',
  },
  {
    id: 'general' as const,
    title: 'GENERAL FITNESS',
    subtitle: 'Well-Rounded Athlete',
    description: 'Balanced strength and conditioning programming. Develop a well-rounded fitness base with mobility, strength, endurance, and athleticism.',
    icon: HeartIcon,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    textColor: 'text-green-400',
    details: [
      'Mix of strength, cardio, and mobility',
      'Varied rep ranges and training styles',
      'Functional movement patterns',
      'Balanced muscle development',
      'Sustainable long-term approach',
    ],
    intensity: 'Moderate',
    sessionExample: 'Varied daily: strength, conditioning, mobility, ~50min',
  },
];

export default function GeneralFlow({ data, onUpdate, onNext, onBack }: GeneralFlowProps) {
  const [selectedGoal, setSelectedGoal] = useState<typeof GOALS[0] | null>(
    data.goal ? GOALS.find(g => g.id === data.goal) || null : null
  );

  const handleGoalSelect = (goal: typeof GOALS[0]) => {
    setSelectedGoal(goal);
    onUpdate({ goal: goal.id });
  };

  const handleContinue = () => {
    if (selectedGoal) {
      onNext();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32">
      {/* Header */}
      <div className="px-6 pt-16 pb-8">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors mb-6 flex items-center gap-2"
        >
          <ChevronRightIcon className="w-5 h-5 rotate-180" />
          <span className="text-sm font-semibold">Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-black mb-3 leading-tight">
            What's Your
            <br />
            Primary Goal?
          </h1>
          <p className="text-gray-400 text-lg">
            We'll design your program around what matters most
          </p>
        </div>
      </div>

      {/* Goal Cards */}
      <div className="px-6 space-y-4">
        {GOALS.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedGoal?.id === goal.id;

          return (
            <button
              key={goal.id}
              onClick={() => handleGoalSelect(goal)}
              className={cn(
                'w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left',
                'active:scale-98',
                isSelected
                  ? `${goal.bgColor} ${goal.borderColor} border-2`
                  : 'bg-[#141414] border-gray-800 hover:border-gray-700'
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    isSelected ? goal.bgColor : 'bg-gray-800'
                  )}>
                    <Icon className={cn(
                      'w-6 h-6',
                      isSelected ? goal.textColor : 'text-gray-400'
                    )} />
                  </div>

                  <div>
                    <h3 className={cn(
                      'text-xl font-black mb-1',
                      isSelected ? 'text-white' : 'text-gray-300'
                    )}>
                      {goal.title}
                    </h3>
                    <p className={cn(
                      'text-sm font-semibold',
                      isSelected ? goal.textColor : 'text-gray-500'
                    )}>
                      {goal.subtitle}
                    </p>
                  </div>
                </div>

                {/* Selection indicator */}
                <div className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                  isSelected
                    ? `${goal.borderColor} bg-gradient-to-br ${goal.color}`
                    : 'border-gray-700'
                )}>
                  {isSelected && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
              </div>

              {/* Description */}
              <p className={cn(
                'text-sm mb-4 leading-relaxed',
                isSelected ? 'text-gray-300' : 'text-gray-500'
              )}>
                {goal.description}
              </p>

              {/* Details - Only show when selected */}
              {isSelected && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Key Points */}
                  <div className="space-y-2">
                    {goal.details.map((detail, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className={cn('mt-1.5 w-1 h-1 rounded-full', `bg-gradient-to-br ${goal.color}`)} />
                        <span className="text-sm text-gray-400">{detail}</span>
                      </div>
                    ))}
                  </div>

                  {/* Session Example & Intensity */}
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                          Intensity
                        </div>
                        <div className={cn('text-sm font-bold', goal.textColor)}>
                          {goal.intensity}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                          Session Example
                        </div>
                        <div className="text-sm text-gray-400">
                          {goal.sessionExample}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Summary Card - Only show when goal is selected */}
      {selectedGoal && (
        <div className="px-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={cn(
            'p-5 rounded-xl border',
            selectedGoal.bgColor,
            selectedGoal.borderColor
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                `bg-gradient-to-br ${selectedGoal.color}`
              )}>
                <selectedGoal.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-white mb-1">
                  Your Training Will Focus On:
                </div>
                <div className={cn('text-sm', selectedGoal.textColor)}>
                  {selectedGoal.subtitle} • {selectedGoal.intensity} Intensity
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Continue Button */}
      {selectedGoal && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
          <button
            onClick={handleContinue}
            className={cn(
              'w-full h-14 font-bold rounded-xl active:scale-95 transition-all',
              `bg-gradient-to-r ${selectedGoal.color} text-white shadow-lg`,
              `shadow-${selectedGoal.id === 'muscle' ? 'purple' : selectedGoal.id === 'strength' ? 'blue' : selectedGoal.id === 'fat_loss' ? 'red' : 'green'}-500/20`
            )}
          >
            Continue with {selectedGoal.title}
          </button>
        </div>
      )}
    </div>
  );
}
