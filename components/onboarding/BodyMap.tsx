import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   BODY MAP - Interactive body diagram for pain point selection

   Features:
   - Touch-friendly body area selection
   - Visual feedback for selected areas
   - Shows what exercises will be modified
   - Exercise substitution preview
   ═══════════════════════════════════════════════════════════════ */

export interface BodyMapProps {
  selectedAreas: string[];
  onChange: (areas: string[]) => void;
}

type BodyArea = {
  id: string;
  label: string;
  emoji: string;
  affectedExercises: string;
  substitutions: string;
};

const BODY_AREAS: BodyArea[] = [
  {
    id: 'Neck',
    label: 'Neck',
    emoji: '🔴',
    affectedExercises: 'Overhead Press, Heavy Shrugs',
    substitutions: 'Lighter loads, machine variations'
  },
  {
    id: 'Shoulders',
    label: 'Shoulders',
    emoji: '🔴',
    affectedExercises: 'Overhead Press, Dips, Heavy Bench',
    substitutions: 'Machine press, cables, neutral grip'
  },
  {
    id: 'Elbows',
    label: 'Elbows',
    emoji: '🔴',
    affectedExercises: 'Skull Crushers, Heavy Curls',
    substitutions: 'Hammer curls, cables, machines'
  },
  {
    id: 'Wrists',
    label: 'Wrists',
    emoji: '🔴',
    affectedExercises: 'Front Squats, Straight Bar Curls',
    substitutions: 'Neutral grip, straps, machines'
  },
  {
    id: 'Upper Back',
    label: 'Upper Back',
    emoji: '🔴',
    affectedExercises: 'Heavy Deadlifts, Rows',
    substitutions: 'Lighter loads, supported variations'
  },
  {
    id: 'Lower Back',
    label: 'Lower Back',
    emoji: '🔴',
    affectedExercises: 'Deadlifts, Back Squats, Good Mornings',
    substitutions: 'Romanian DL, leg press, front squats'
  },
  {
    id: 'Hips',
    label: 'Hips',
    emoji: '🔴',
    affectedExercises: 'Deep Squats, Sumo Deadlifts',
    substitutions: 'Box squats, leg press, machines'
  },
  {
    id: 'Knees',
    label: 'Knees',
    emoji: '🔴',
    affectedExercises: 'Deep Squats, Lunges, Leg Extensions',
    substitutions: 'Box squats, leg press, step-ups'
  },
  {
    id: 'Ankles',
    label: 'Ankles',
    emoji: '🔴',
    affectedExercises: 'Squats, Lunges, Calf Raises',
    substitutions: 'Seated variations, machines'
  },
];

// Group areas by body region for layout
const BODY_REGIONS = [
  { name: 'Upper Body', areas: ['Neck', 'Shoulders', 'Elbows', 'Wrists'] },
  { name: 'Torso', areas: ['Upper Back', 'Lower Back'] },
  { name: 'Lower Body', areas: ['Hips', 'Knees', 'Ankles'] },
];

export default function BodyMap({ selectedAreas, onChange }: BodyMapProps) {
  const haptic = useHaptic();

  const toggleArea = (areaId: string) => {
    haptic.light();
    if (selectedAreas.includes(areaId)) {
      onChange(selectedAreas.filter(a => a !== areaId));
    } else {
      onChange([...selectedAreas, areaId]);
    }
  };

  const selectedAreaDetails = useMemo(() => {
    return BODY_AREAS.filter(area => selectedAreas.includes(area.id));
  }, [selectedAreas]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-text-primary font-bold text-lg mb-1">
          Pain Points & Injuries
        </h3>
        <p className="text-text-secondary text-sm">
          Select areas to avoid or modify exercises
        </p>
      </div>

      {/* Body Diagram - Simplified Touch Interface */}
      <div className="p-6 rounded-2xl bg-surface-secondary border-2 border-border-default">
        <div className="space-y-4">
          {BODY_REGIONS.map(region => (
            <div key={region.name}>
              <p className="text-text-tertiary text-xs font-bold uppercase tracking-wider mb-2">
                {region.name}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {region.areas.map(areaId => {
                  const area = BODY_AREAS.find(a => a.id === areaId)!;
                  const isSelected = selectedAreas.includes(areaId);

                  return (
                    <button
                      key={areaId}
                      onClick={() => toggleArea(areaId)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
                        'min-h-touch active:scale-[0.98]',
                        'border-2',
                        isSelected
                          ? 'bg-error-subtle border-error-bg'
                          : 'bg-surface-primary border-border-subtle hover:border-border-default'
                      )}
                    >
                      <span className="text-xl">
                        {isSelected ? '🔴' : '⚪️'}
                      </span>
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          isSelected ? 'text-error-text' : 'text-text-secondary'
                        )}
                      >
                        {area.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Areas Count */}
      {selectedAreas.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-error-subtle border-2 border-error-bg">
          <span className="text-text-primary text-sm font-medium">
            Areas to protect
          </span>
          <span className="text-error-text text-xl font-black tabular-nums">
            {selectedAreas.length}
          </span>
        </div>
      )}

      {/* Selected Areas Detail */}
      {selectedAreaDetails.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-text-primary font-bold text-sm uppercase tracking-wide">
            Exercise Modifications
          </h4>

          {selectedAreaDetails.map(area => (
            <div
              key={area.id}
              className="p-4 rounded-xl bg-surface-primary border border-border-default"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{area.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h5 className="text-text-primary font-bold text-sm mb-2">
                    {area.label}
                  </h5>

                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-text-tertiary font-semibold uppercase tracking-wide mb-1">
                        Will avoid
                      </p>
                      <p className="text-text-secondary">
                        {area.affectedExercises}
                      </p>
                    </div>

                    <div>
                      <p className="text-success-text font-semibold uppercase tracking-wide mb-1">
                        Will use instead
                      </p>
                      <p className="text-text-secondary">
                        {area.substitutions}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {selectedAreas.length === 0 && (
        <div className="py-8 text-center">
          <div className="text-4xl mb-3">💪</div>
          <p className="text-text-secondary text-sm mb-1">
            No pain points selected
          </p>
          <p className="text-text-tertiary text-xs">
            The AI will program full range exercises
          </p>
        </div>
      )}

      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-info-subtle border border-info-bg">
        <div className="flex items-start gap-3">
          <span className="text-info-text text-xl">ℹ️</span>
          <div className="flex-1">
            <p className="text-info-text text-xs font-bold uppercase tracking-wide mb-1">
              Smart Programming
            </p>
            <p className="text-text-secondary text-xs leading-relaxed">
              The AI will automatically avoid high-risk exercises for selected areas and
              substitute safer alternatives while maintaining the same muscle groups.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
