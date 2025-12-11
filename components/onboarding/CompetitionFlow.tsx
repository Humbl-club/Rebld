import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { CalendarIcon, TrophyIcon, ChevronRightIcon } from '@/components/icons';

/* ═══════════════════════════════════════════════════════════════
   COMPETITION FLOW - Onboarding for Event-Specific Training

   For users training for specific competitions/events.
   3-step flow: Sport Selection → Event Date → Current Readiness
   ═══════════════════════════════════════════════════════════════ */

export interface CompetitionFlowData {
  sport: string | null;
  eventDate: string | null;
  readiness: number | null;
  eventName?: string;
}

interface CompetitionFlowProps {
  data: CompetitionFlowData;
  onUpdate: (data: Partial<CompetitionFlowData>) => void;
  onNext: () => void;
  onBack: () => void;
}

// Sport configurations with taglines
const SPORTS = [
  {
    id: 'hyrox',
    name: 'Hyrox',
    tagline: '8 stations, 8 runs, pure suffering',
    emoji: '🏃‍♂️',
  },
  {
    id: 'powerlifting',
    name: 'Powerlifting',
    tagline: 'Squat, bench, deadlift. Maximum strength.',
    emoji: '🏋️',
  },
  {
    id: 'triathlon',
    name: 'Triathlon',
    tagline: 'Swim, bike, run. Triple threat endurance.',
    emoji: '🏊',
  },
  {
    id: 'marathon',
    name: 'Marathon',
    tagline: '42.2km of mental warfare',
    emoji: '🏃',
  },
  {
    id: 'crossfit',
    name: 'CrossFit',
    tagline: 'Constantly varied functional fitness',
    emoji: '💪',
  },
  {
    id: 'ocr',
    name: 'Obstacle Course Racing',
    tagline: 'Mud, walls, heavy carries',
    emoji: '🧗',
  },
  {
    id: 'swimming',
    name: 'Swimming',
    tagline: 'Pool domination, stroke perfection',
    emoji: '🏊‍♀️',
  },
  {
    id: 'cycling',
    name: 'Cycling',
    tagline: 'Power output, endurance, speed',
    emoji: '🚴',
  },
  {
    id: 'other',
    name: 'Other',
    tagline: 'Custom event training',
    emoji: '🎯',
  },
];

// Readiness interpretations
const getReadinessInterpretation = (readiness: number): { label: string; description: string } => {
  if (readiness <= 3) {
    return {
      label: 'Building Foundation',
      description: 'We\'ll start with base conditioning and gradually build sport-specific work',
    };
  } else if (readiness <= 5) {
    return {
      label: 'Solid Base, Needs Specificity',
      description: 'You have general fitness. We\'ll focus on event-specific skills and conditioning',
    };
  } else if (readiness <= 7) {
    return {
      label: 'Competition Ready, Needs Polish',
      description: 'You\'re close. We\'ll fine-tune weaknesses and peak your performance',
    };
  } else {
    return {
      label: 'Peak Performance',
      description: 'You\'re ready now. We\'ll maintain readiness and address any final details',
    };
  }
};

// Calculate periodization phases
const calculatePeriodization = (weeksUntil: number) => {
  if (weeksUntil < 4) {
    return { base: 0, build: 0, peak: weeksUntil - 1, taper: 1 };
  } else if (weeksUntil < 8) {
    return { base: 1, build: weeksUntil - 3, peak: 1, taper: 1 };
  } else if (weeksUntil < 16) {
    const base = Math.floor(weeksUntil * 0.3);
    const build = Math.floor(weeksUntil * 0.5);
    const peak = Math.floor(weeksUntil * 0.15);
    const taper = weeksUntil - base - build - peak;
    return { base, build, peak, taper };
  } else {
    const base = Math.floor(weeksUntil * 0.35);
    const build = Math.floor(weeksUntil * 0.45);
    const peak = Math.floor(weeksUntil * 0.15);
    const taper = weeksUntil - base - build - peak;
    return { base, build, peak, taper };
  }
};

const getCurrentPhase = (weeksUntil: number, phases: ReturnType<typeof calculatePeriodization>) => {
  const { base, build, peak, taper } = phases;

  if (weeksUntil > base + build + peak) {
    return { phase: 'BASE', focus: 'Building aerobic foundation and general strength' };
  } else if (weeksUntil > build + peak) {
    return { phase: 'BUILD', focus: 'Increasing volume and sport-specific conditioning' };
  } else if (weeksUntil > taper) {
    return { phase: 'PEAK', focus: 'Maximum intensity, race-specific preparation' };
  } else {
    return { phase: 'TAPER', focus: 'Recovery and sharpening for peak performance' };
  }
};

export default function CompetitionFlow({ data, onUpdate, onNext, onBack }: CompetitionFlowProps) {
  const [step, setStep] = useState<'sport' | 'date' | 'readiness'>('sport');

  const selectedSport = SPORTS.find(s => s.id === data.sport);

  // Calculate weeks until event
  const weeksUntil = data.eventDate
    ? Math.ceil((new Date(data.eventDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 7))
    : 0;

  const phases = weeksUntil > 0 ? calculatePeriodization(weeksUntil) : null;
  const currentPhase = phases ? getCurrentPhase(weeksUntil, phases) : null;

  const handleSportSelect = (sportId: string) => {
    onUpdate({ sport: sportId });
    setTimeout(() => setStep('date'), 300);
  };

  const handleDateSelect = (date: string) => {
    onUpdate({ eventDate: date });
    setTimeout(() => setStep('readiness'), 300);
  };

  const handleReadinessSelect = (readiness: number) => {
    onUpdate({ readiness });
    setTimeout(onNext, 400);
  };

  const canProgress = () => {
    if (step === 'sport') return !!data.sport;
    if (step === 'date') return !!data.eventDate;
    if (step === 'readiness') return data.readiness !== null;
    return false;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="px-6 pt-16 pb-8">
        <button
          onClick={step === 'sport' ? onBack : () => setStep(step === 'date' ? 'sport' : 'date')}
          className="text-gray-400 hover:text-white transition-colors mb-6 flex items-center gap-2"
        >
          <ChevronRightIcon className="w-5 h-5 rotate-180" />
          <span className="text-sm font-semibold">Back</span>
        </button>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-8">
          {['sport', 'date', 'readiness'].map((s, i) => (
            <div
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-all duration-300',
                s === step || ['sport', 'date', 'readiness'].indexOf(s) < ['sport', 'date', 'readiness'].indexOf(step)
                  ? 'bg-red-500'
                  : 'bg-gray-800'
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-32">
        {/* Step 1: Sport Selection */}
        {step === 'sport' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
              <h1 className="text-4xl font-black mb-3 leading-tight">
                What's Your
                <br />
                Competition?
              </h1>
              <p className="text-gray-400 text-lg">
                We'll build a periodized plan to peak at the right time
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SPORTS.map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => handleSportSelect(sport.id)}
                  className={cn(
                    'p-5 rounded-2xl border-2 transition-all duration-200 text-left min-h-[140px] flex flex-col justify-between',
                    'active:scale-95',
                    data.sport === sport.id
                      ? 'bg-red-500 border-red-500'
                      : 'bg-[#141414] border-gray-800 hover:border-red-500'
                  )}
                >
                  <div className="text-3xl mb-3">{sport.emoji}</div>
                  <div>
                    <div className={cn(
                      'font-bold mb-1',
                      data.sport === sport.id ? 'text-white' : 'text-white'
                    )}>
                      {sport.name}
                    </div>
                    <div className={cn(
                      'text-xs leading-tight',
                      data.sport === sport.id ? 'text-white/70' : 'text-gray-500'
                    )}>
                      {sport.tagline}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Selected sport tagline */}
            {selectedSport && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-red-400 text-sm italic">
                  "{selectedSport.tagline}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Event Date */}
        {step === 'date' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
              <h1 className="text-4xl font-black mb-3 leading-tight">
                When's Your
                <br />
                Event?
              </h1>
              <p className="text-gray-400 text-lg">
                We'll periodize your training to peak at the right time
              </p>
            </div>

            {/* Date Picker */}
            <div className="relative mb-6">
              <input
                type="date"
                value={data.eventDate || ''}
                onChange={(e) => handleDateSelect(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={cn(
                  'w-full h-16 px-5 bg-[#141414] border-2 border-gray-800',
                  'rounded-xl text-white text-lg font-semibold',
                  'focus:border-red-500 focus:outline-none transition-colors',
                  'appearance-none'
                )}
              />
              <CalendarIcon className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500 pointer-events-none" />
            </div>

            {/* Optional: Event Name */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">
                Event Name (Optional)
              </label>
              <input
                type="text"
                value={data.eventName || ''}
                onChange={(e) => onUpdate({ eventName: e.target.value })}
                placeholder="e.g., Hyrox Hamburg 2025"
                className={cn(
                  'w-full h-14 px-5 bg-[#141414] border-2 border-gray-800',
                  'rounded-xl text-white font-medium',
                  'focus:border-red-500 focus:outline-none transition-colors',
                  'placeholder:text-gray-600'
                )}
              />
            </div>

            {/* Periodization Preview */}
            {data.eventDate && weeksUntil > 0 && phases && currentPhase && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Weeks Until */}
                <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <TrophyIcon className="w-6 h-6 text-red-400" />
                    <span className="text-2xl font-black text-white">{weeksUntil} weeks</span>
                  </div>
                  <p className="text-gray-400">to prepare for your event</p>
                </div>

                {/* Phase Breakdown */}
                <div className="p-5 bg-[#141414] border-2 border-gray-800 rounded-xl">
                  <div className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">
                    Training Phases
                  </div>

                  <div className="flex items-center gap-1 mb-4">
                    {phases.base > 0 && (
                      <div className="flex-1 h-8 bg-blue-500/20 rounded flex items-center justify-center border border-blue-500/30">
                        <span className="text-xs font-bold text-blue-400">
                          BASE {phases.base}w
                        </span>
                      </div>
                    )}
                    {phases.build > 0 && (
                      <div className="flex-1 h-8 bg-purple-500/20 rounded flex items-center justify-center border border-purple-500/30">
                        <span className="text-xs font-bold text-purple-400">
                          BUILD {phases.build}w
                        </span>
                      </div>
                    )}
                    {phases.peak > 0 && (
                      <div className="flex-1 h-8 bg-red-500/20 rounded flex items-center justify-center border border-red-500/30">
                        <span className="text-xs font-bold text-red-400">
                          PEAK {phases.peak}w
                        </span>
                      </div>
                    )}
                    {phases.taper > 0 && (
                      <div className="flex-1 h-8 bg-green-500/20 rounded flex items-center justify-center border border-green-500/30">
                        <span className="text-xs font-bold text-green-400">
                          TAPER {phases.taper}w
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-[#0a0a0a] rounded-lg border border-gray-800">
                    <div className="text-sm font-bold text-white mb-1">
                      You're in: {currentPhase.phase}
                    </div>
                    <div className="text-xs text-gray-400">
                      {currentPhase.focus}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Current Readiness */}
        {step === 'readiness' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
              <h1 className="text-4xl font-black mb-3 leading-tight">
                Current
                <br />
                Readiness
              </h1>
              <p className="text-gray-400 text-lg">
                If your competition was tomorrow, how ready are you?
              </p>
            </div>

            {/* Readiness Slider */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                  <button
                    key={level}
                    onClick={() => handleReadinessSelect(level)}
                    className={cn(
                      'w-12 h-12 rounded-full font-black text-lg transition-all duration-200',
                      'active:scale-90',
                      data.readiness === level
                        ? 'bg-red-500 text-white scale-110'
                        : 'bg-[#141414] text-gray-500 hover:bg-gray-800 hover:text-white border-2 border-gray-800'
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div className="flex justify-between text-xs text-gray-500 font-semibold">
                <span>Not Ready</span>
                <span>Competition Ready</span>
              </div>
            </div>

            {/* Readiness Interpretation */}
            {data.readiness !== null && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="text-lg font-bold text-white mb-2">
                    {getReadinessInterpretation(data.readiness).label}
                  </div>
                  <p className="text-gray-400">
                    {getReadinessInterpretation(data.readiness).description}
                  </p>
                </div>

                {/* What This Means */}
                <div className="p-5 bg-[#141414] border-2 border-gray-800 rounded-xl">
                  <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
                    What This Means For Training
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {data.readiness <= 3 && (
                      <>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Start with base conditioning and general strength</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Progressive overload with conservative progression</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Focus on movement quality and building habits</span>
                        </li>
                      </>
                    )}
                    {data.readiness > 3 && data.readiness <= 5 && (
                      <>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Introduce sport-specific conditioning early</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Build volume gradually with targeted weaknesses</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Balance general fitness with event preparation</span>
                        </li>
                      </>
                    )}
                    {data.readiness > 5 && data.readiness <= 7 && (
                      <>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>High-intensity, race-specific sessions</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Address remaining weak points aggressively</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Practice pacing and race-day strategies</span>
                        </li>
                      </>
                    )}
                    {data.readiness > 7 && (
                      <>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Maintain peak condition with smart volume</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Fine-tune minor details and optimize recovery</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>Mental preparation and race simulation</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Continue Button (only show when can progress to next step within flow) */}
      {step !== 'readiness' && canProgress() && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
          <button
            onClick={() => {
              if (step === 'sport') setStep('date');
              else if (step === 'date') setStep('readiness');
            }}
            className="w-full h-14 bg-red-500 text-white font-bold rounded-xl active:scale-95 transition-transform"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
