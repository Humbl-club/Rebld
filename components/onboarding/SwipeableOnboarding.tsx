import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useAnimations';
import {
  TrainingSplit,
  SpecificGoal,
  CurrentStrength,
} from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   PREMIUM ONBOARDING - Editorial Fitness Experience

   Design Philosophy:
   - Whoop/Oura inspired minimalism
   - Full-screen immersive cards
   - Conversational, not transactional
   - Each step feels intentional and premium
   - Typography-first design
   - Goal-specific visual themes
   ═══════════════════════════════════════════════════════════════ */

// Types
type Goal = 'Aesthetic Physique' | 'Strength & Power' | 'Athletic Performance' | 'Health & Longevity' | 'Competition Prep';
type Experience = 'Beginner' | 'Intermediate' | 'Advanced';
type Frequency = '2-3' | '3-4' | '4-5' | '5+';
type PainPoint = 'Knees' | 'Lower Back' | 'Shoulders' | 'Wrists' | 'Neck' | 'Hips' | 'Elbows' | 'Ankles';
type Equipment = 'minimal' | 'home_gym' | 'commercial_gym';
type SessionLength = '30' | '45' | '60' | '75' | '90';

interface OnboardingData {
  goal: Goal | null;
  experience: Experience | null;
  frequency: Frequency | null;
  equipment: Equipment | string | null;
  sessionLength: SessionLength | string | null;
  painPoints: PainPoint[];
  sport: string;
  trainingSplit: TrainingSplit;
  specificGoal: SpecificGoal | null;
  currentStrength: CurrentStrength;
  userAge: number | undefined;
  userSex: 'male' | 'female' | 'other' | undefined;
}

interface SwipeableOnboardingProps {
  initialData: OnboardingData;
  onDataChange: (data: Partial<OnboardingData>) => void;
  onComplete: () => void;
  onBack: () => void;
}

// ═══════════════════════════════════════════════════════════════
// VISUAL THEMES - Goal-specific gradients and moods
// ═══════════════════════════════════════════════════════════════

const GOAL_THEMES: Record<Goal, { gradient: string; accent: string; mood: string }> = {
  'Aesthetic Physique': {
    gradient: 'from-amber-900/20 via-stone-900/40 to-neutral-950',
    accent: 'bg-amber-500',
    mood: 'Sculpt your physique',
  },
  'Strength & Power': {
    gradient: 'from-slate-800/30 via-zinc-900/50 to-neutral-950',
    accent: 'bg-zinc-400',
    mood: 'Build raw power',
  },
  'Athletic Performance': {
    gradient: 'from-blue-900/20 via-slate-900/40 to-neutral-950',
    accent: 'bg-blue-500',
    mood: 'Elevate your game',
  },
  'Health & Longevity': {
    gradient: 'from-emerald-900/20 via-teal-900/30 to-neutral-950',
    accent: 'bg-emerald-500',
    mood: 'Train for life',
  },
  'Competition Prep': {
    gradient: 'from-rose-900/20 via-stone-900/40 to-neutral-950',
    accent: 'bg-rose-500',
    mood: 'Peak when it matters',
  },
};

// ═══════════════════════════════════════════════════════════════
// CARD CONFIGURATIONS - Conversational, minimal
// ═══════════════════════════════════════════════════════════════

interface CardConfig {
  id: string;
  question: string;
  context?: string;
  required: boolean;
  condition?: (data: OnboardingData) => boolean;
}

const CARDS: CardConfig[] = [
  {
    id: 'goal',
    question: "What drives you?",
    context: "This shapes your entire program",
    required: true
  },
  {
    id: 'experience',
    question: "How long have you\nbeen training?",
    context: "We'll match the intensity",
    required: true
  },
  {
    id: 'frequency',
    question: "How many days\ncan you commit?",
    context: "Consistency beats perfection",
    required: true
  },
  {
    id: 'equipment',
    question: "What's your setup?",
    context: "We'll work with what you have",
    required: true
  },
  {
    id: 'sessionLength',
    question: "How much time\nper session?",
    context: "Including warmup and cooldown",
    required: true
  },
  {
    id: 'painPoints',
    question: "Any areas we should\nbe careful with?",
    context: "Optional · We'll protect you",
    required: false
  },
  {
    id: 'specificGoal',
    question: "Training for\nsomething specific?",
    context: "We'll periodize your program",
    required: false,
    condition: (d) => d.goal === 'Competition Prep' || d.goal === 'Athletic Performance'
  },
  {
    id: 'trainingSplit',
    question: "How do you want\nto structure training?",
    context: "Strength, cardio, or both",
    required: true
  },
  {
    id: 'strength',
    question: "Know your\ncurrent numbers?",
    context: "Optional · Improves weight suggestions",
    required: false
  },
  {
    id: 'commitment',
    question: "Your program\nawaits",
    context: "Ready to begin",
    required: true
  },
];

// ═══════════════════════════════════════════════════════════════
// OPTION DATA
// ═══════════════════════════════════════════════════════════════

const GOAL_OPTIONS: { id: Goal; label: string; tagline: string }[] = [
  { id: 'Aesthetic Physique', label: 'Aesthetic', tagline: 'Build muscle · Reduce body fat' },
  { id: 'Strength & Power', label: 'Strength', tagline: 'Increase 1RM · Raw power' },
  { id: 'Athletic Performance', label: 'Athletic', tagline: 'Sport-specific · Conditioning' },
  { id: 'Health & Longevity', label: 'Health', tagline: 'Sustainable · Long-term' },
  { id: 'Competition Prep', label: 'Competition', tagline: 'Peak performance · Event ready' },
];

const EXPERIENCE_OPTIONS: { id: Experience; label: string; years: string }[] = [
  { id: 'Beginner', label: 'New to this', years: 'Less than 1 year' },
  { id: 'Intermediate', label: 'Building momentum', years: '1-3 years' },
  { id: 'Advanced', label: 'Seasoned', years: '3+ years' },
];

const FREQUENCY_OPTIONS: { id: Frequency; label: string; note: string }[] = [
  { id: '2-3', label: '2-3 days', note: 'Great for starting out' },
  { id: '3-4', label: '3-4 days', note: 'Balanced approach' },
  { id: '4-5', label: '4-5 days', note: 'Serious commitment' },
  { id: '5+', label: '5+ days', note: 'Athlete schedule' },
];

const EQUIPMENT_OPTIONS: { id: Equipment; label: string; desc: string }[] = [
  { id: 'minimal', label: 'Minimal', desc: 'Bodyweight + basics' },
  { id: 'home_gym', label: 'Home gym', desc: 'Dumbbells · Bench · Rack' },
  { id: 'commercial_gym', label: 'Full gym', desc: 'Complete access' },
];

const SESSION_OPTIONS: { id: SessionLength; label: string }[] = [
  { id: '30', label: '30 min' },
  { id: '45', label: '45 min' },
  { id: '60', label: '60 min' },
  { id: '75', label: '75 min' },
  { id: '90', label: '90 min' },
];

const PAIN_POINT_OPTIONS: { id: PainPoint; label: string }[] = [
  { id: 'Lower Back', label: 'Lower back' },
  { id: 'Knees', label: 'Knees' },
  { id: 'Shoulders', label: 'Shoulders' },
  { id: 'Neck', label: 'Neck' },
  { id: 'Hips', label: 'Hips' },
  { id: 'Wrists', label: 'Wrists' },
  { id: 'Elbows', label: 'Elbows' },
  { id: 'Ankles', label: 'Ankles' },
];

const SPORT_OPTIONS = [
  'HYROX', 'Marathon', 'Triathlon', 'CrossFit', 'Powerlifting',
  'Bodybuilding', 'Boxing/MMA', 'Basketball', 'Football', 'Tennis',
  'Swimming', 'Cycling', 'Other'
];

const TRAINING_TYPES = [
  { id: 'strength_only', label: 'Strength only', desc: 'Pure resistance training' },
  { id: 'strength_plus_cardio', label: 'Strength + Cardio', desc: 'Separate sessions' },
  { id: 'combined', label: 'Combined', desc: 'Cardio finishers after lifting' },
  { id: 'cardio_focused', label: 'Cardio focused', desc: 'Endurance priority' },
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SwipeableOnboarding({
  initialData,
  onDataChange,
  onComplete,
  onBack,
}: SwipeableOnboardingProps) {
  const haptic = useHaptic();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter cards based on conditions
  const visibleCards = CARDS.filter(card =>
    !card.condition || card.condition(data)
  );

  const currentCard = visibleCards[currentIndex];
  const isLastCard = currentIndex === visibleCards.length - 1;
  const progress = ((currentIndex + 1) / visibleCards.length) * 100;

  // Get current theme based on selected goal
  const currentTheme = data.goal ? GOAL_THEMES[data.goal] : null;

  // Sync data changes to parent
  useEffect(() => {
    onDataChange(data);
  }, [data, onDataChange]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentIndex < visibleCards.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      haptic.light();
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 150);
    }
  }, [currentIndex, visibleCards.length, isTransitioning, haptic]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      haptic.light();
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
        setIsTransitioning(false);
      }, 150);
    } else if (currentIndex === 0) {
      onBack();
    }
  }, [currentIndex, isTransitioning, haptic, onBack]);

  // Touch handling for swipe
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe left - can't go forward by swiping
      } else {
        // Swipe right - go back
        goPrev();
      }
    }
    setTouchStart(null);
  }, [touchStart, goPrev]);

  // Selection handlers
  const selectGoal = useCallback((goal: Goal) => {
    haptic.medium();
    setData(prev => ({ ...prev, goal }));
    setTimeout(goNext, 300);
  }, [haptic, goNext]);

  const selectExperience = useCallback((experience: Experience) => {
    haptic.medium();
    setData(prev => ({ ...prev, experience }));
    setTimeout(goNext, 300);
  }, [haptic, goNext]);

  const selectFrequency = useCallback((frequency: Frequency) => {
    haptic.medium();
    setData(prev => ({ ...prev, frequency }));
    setTimeout(goNext, 300);
  }, [haptic, goNext]);

  const selectEquipment = useCallback((equipment: Equipment) => {
    haptic.medium();
    setData(prev => ({ ...prev, equipment }));
    setTimeout(goNext, 300);
  }, [haptic, goNext]);

  const selectSessionLength = useCallback((sessionLength: SessionLength) => {
    haptic.medium();
    setData(prev => ({ ...prev, sessionLength }));
    setTimeout(goNext, 300);
  }, [haptic, goNext]);

  const togglePainPoint = useCallback((point: PainPoint) => {
    haptic.light();
    setData(prev => ({
      ...prev,
      painPoints: prev.painPoints.includes(point)
        ? prev.painPoints.filter(p => p !== point)
        : [...prev.painPoints, point]
    }));
  }, [haptic]);

  const selectTrainingType = useCallback((type: string) => {
    haptic.medium();
    setData(prev => ({
      ...prev,
      trainingSplit: { ...prev.trainingSplit, training_type: type }
    }));
    setTimeout(goNext, 300);
  }, [haptic, goNext]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER CARD CONTENT
  // ═══════════════════════════════════════════════════════════════

  const renderCardContent = () => {
    if (!currentCard) return null;

    switch (currentCard.id) {
      case 'goal':
        return (
          <div className="space-y-3">
            {GOAL_OPTIONS.map(option => {
              const isSelected = data.goal === option.id;
              const theme = GOAL_THEMES[option.id];
              return (
                <button
                  key={option.id}
                  onClick={() => selectGoal(option.id)}
                  className={cn(
                    'w-full p-5 rounded-2xl text-left transition-all duration-300',
                    'border border-white/10 active:scale-[0.98]',
                    'relative overflow-hidden',
                    isSelected
                      ? 'bg-white text-neutral-900'
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  {/* Accent bar */}
                  <div className={cn(
                    'absolute left-0 top-0 bottom-0 w-1 transition-opacity duration-300',
                    theme.accent,
                    isSelected ? 'opacity-100' : 'opacity-0'
                  )} />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        'font-semibold text-[17px]',
                        isSelected ? 'text-neutral-900' : 'text-white'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'text-[14px] mt-0.5',
                        isSelected ? 'text-neutral-600' : 'text-white/50'
                      )}>
                        {option.tagline}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center">
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'experience':
        return (
          <div className="space-y-3">
            {EXPERIENCE_OPTIONS.map(option => {
              const isSelected = data.experience === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => selectExperience(option.id)}
                  className={cn(
                    'w-full p-5 rounded-2xl text-left transition-all duration-300',
                    'border border-white/10 active:scale-[0.98]',
                    isSelected
                      ? 'bg-white text-neutral-900'
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        'font-semibold text-[17px]',
                        isSelected ? 'text-neutral-900' : 'text-white'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'text-[14px] mt-0.5',
                        isSelected ? 'text-neutral-600' : 'text-white/50'
                      )}>
                        {option.years}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center">
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'frequency':
        return (
          <div className="space-y-3">
            {FREQUENCY_OPTIONS.map(option => {
              const isSelected = data.frequency === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => selectFrequency(option.id)}
                  className={cn(
                    'w-full p-5 rounded-2xl text-left transition-all duration-300',
                    'border border-white/10 active:scale-[0.98]',
                    isSelected
                      ? 'bg-white text-neutral-900'
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        'font-semibold text-[17px]',
                        isSelected ? 'text-neutral-900' : 'text-white'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'text-[14px] mt-0.5',
                        isSelected ? 'text-neutral-600' : 'text-white/50'
                      )}>
                        {option.note}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center">
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'equipment':
        return (
          <div className="space-y-3">
            {EQUIPMENT_OPTIONS.map(option => {
              const isSelected = data.equipment === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => selectEquipment(option.id)}
                  className={cn(
                    'w-full p-5 rounded-2xl text-left transition-all duration-300',
                    'border border-white/10 active:scale-[0.98]',
                    isSelected
                      ? 'bg-white text-neutral-900'
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        'font-semibold text-[17px]',
                        isSelected ? 'text-neutral-900' : 'text-white'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'text-[14px] mt-0.5',
                        isSelected ? 'text-neutral-600' : 'text-white/50'
                      )}>
                        {option.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center">
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'sessionLength':
        return (
          <div className="grid grid-cols-2 gap-3">
            {SESSION_OPTIONS.map(option => {
              const isSelected = data.sessionLength === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => selectSessionLength(option.id)}
                  className={cn(
                    'p-5 rounded-2xl transition-all duration-300',
                    'border border-white/10 active:scale-[0.98]',
                    isSelected
                      ? 'bg-white text-neutral-900'
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  <p className={cn(
                    'font-semibold text-[17px] text-center',
                    isSelected ? 'text-neutral-900' : 'text-white'
                  )}>
                    {option.label}
                  </p>
                </button>
              );
            })}
          </div>
        );

      case 'painPoints':
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {PAIN_POINT_OPTIONS.map(option => {
                const isSelected = data.painPoints.includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => togglePainPoint(option.id)}
                    className={cn(
                      'px-4 py-2.5 rounded-full transition-all duration-200',
                      'border active:scale-[0.97]',
                      isSelected
                        ? 'bg-white text-neutral-900 border-white'
                        : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                    )}
                  >
                    <span className="font-medium text-[15px]">{option.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Continue button for optional step */}
            <button
              onClick={goNext}
              className="w-full py-4 rounded-full bg-white/10 text-white font-semibold text-[15px] hover:bg-white/20 transition-colors active:scale-[0.98]"
            >
              {data.painPoints.length > 0 ? 'Continue' : 'Skip'}
            </button>
          </div>
        );

      case 'specificGoal':
        return (
          <SpecificGoalCard
            value={data.specificGoal}
            onChange={(goal) => setData(prev => ({ ...prev, specificGoal: goal }))}
            sport={data.sport}
            onSportChange={(sport) => setData(prev => ({ ...prev, sport }))}
            onNext={goNext}
          />
        );

      case 'trainingSplit':
        return (
          <div className="space-y-3">
            {TRAINING_TYPES.map(option => {
              const isSelected = data.trainingSplit.training_type === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => selectTrainingType(option.id)}
                  className={cn(
                    'w-full p-5 rounded-2xl text-left transition-all duration-300',
                    'border border-white/10 active:scale-[0.98]',
                    isSelected
                      ? 'bg-white text-neutral-900'
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        'font-semibold text-[17px]',
                        isSelected ? 'text-neutral-900' : 'text-white'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'text-[14px] mt-0.5',
                        isSelected ? 'text-neutral-600' : 'text-white/50'
                      )}>
                        {option.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center">
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'strength':
        return (
          <StrengthCard
            value={data.currentStrength}
            onChange={(strength) => setData(prev => ({ ...prev, currentStrength: strength }))}
            onNext={goNext}
          />
        );

      case 'commitment':
        return (
          <CommitmentCard
            data={data}
            onComplete={onComplete}
          />
        );

      default:
        return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div
      ref={containerRef}
      className={cn(
        'min-h-[100dvh] h-[100dvh] flex flex-col overflow-hidden relative',
        'transition-all duration-500'
      )}
      style={{ backgroundColor: '#0a0a0a' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Gradient overlay based on selected goal */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-b transition-opacity duration-700',
          currentTheme ? currentTheme.gradient : 'from-neutral-900/50 to-neutral-950',
          currentTheme ? 'opacity-100' : 'opacity-50'
        )}
      />

      {/* Subtle grain texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 pt-[max(16px,env(safe-area-inset-top))] px-6">
          {/* Progress bar */}
          <div className="h-[2px] bg-white/10 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-white transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Navigation row */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goPrev}
              className="flex items-center gap-1 text-white/60 hover:text-white transition-colors min-h-[44px] -ml-2 px-2"
            >
              <ChevronLeft size={20} strokeWidth={2} />
              <span className="text-[14px] font-medium">Back</span>
            </button>

            <span className="text-[13px] text-white/40 font-medium tracking-wide">
              {currentIndex + 1} / {visibleCards.length}
            </span>
          </div>
        </div>

        {/* Main content area */}
        <div className={cn(
          'flex-1 flex flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))]',
          'transition-opacity duration-200',
          isTransitioning ? 'opacity-0' : 'opacity-100'
        )}>
          {/* Question */}
          <div className="mb-8">
            <h1 className="text-[32px] font-bold text-white leading-[1.1] tracking-tight whitespace-pre-line">
              {currentCard?.question}
            </h1>
            {currentCard?.context && (
              <p className="mt-3 text-[15px] text-white/40">
                {currentCard.context}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {renderCardContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

interface SpecificGoalCardProps {
  value: SpecificGoal | null;
  onChange: (goal: SpecificGoal) => void;
  sport: string;
  onSportChange: (sport: string) => void;
  onNext: () => void;
}

function SpecificGoalCard({ value, onChange, sport, onSportChange, onNext }: SpecificGoalCardProps) {
  return (
    <div className="space-y-6">
      {/* Sport selection */}
      <div>
        <p className="text-[13px] font-medium text-white/40 uppercase tracking-wider mb-3">
          Sport or event
        </p>
        <div className="flex flex-wrap gap-2">
          {SPORT_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => onSportChange(s)}
              className={cn(
                'px-4 py-2.5 rounded-full transition-all duration-200',
                'border active:scale-[0.97]',
                sport === s
                  ? 'bg-white text-neutral-900 border-white'
                  : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
              )}
            >
              <span className="font-medium text-[14px]">{s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Event date */}
      <div>
        <p className="text-[13px] font-medium text-white/40 uppercase tracking-wider mb-3">
          Event date (optional)
        </p>
        <input
          type="date"
          value={value?.target_date || ''}
          onChange={(e) => onChange({ ...value, target_date: e.target.value })}
          className={cn(
            'w-full h-14 px-4 rounded-2xl text-[16px] font-medium',
            'bg-white/5 text-white border border-white/10',
            'focus:border-white/30 outline-none transition-all',
            '[color-scheme:dark]'
          )}
          min={new Date().toISOString().split('T')[0]}
        />
        {value?.target_date && (
          <p className="mt-2 text-[14px] text-white/40">
            {Math.ceil((new Date(value.target_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))} weeks away
          </p>
        )}
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-full bg-white/10 text-white font-semibold text-[15px] hover:bg-white/20 transition-colors active:scale-[0.98]"
      >
        Continue
      </button>
    </div>
  );
}

interface StrengthCardProps {
  value: CurrentStrength;
  onChange: (strength: CurrentStrength) => void;
  onNext: () => void;
}

function StrengthCard({ value, onChange, onNext }: StrengthCardProps) {
  const exercises = [
    { key: 'squat_kg', label: 'Squat', unit: 'kg' },
    { key: 'bench_kg', label: 'Bench Press', unit: 'kg' },
    { key: 'deadlift_kg', label: 'Deadlift', unit: 'kg' },
  ];

  return (
    <div className="space-y-6">
      <p className="text-[14px] text-white/40">
        Enter your estimated 1 rep max. Leave blank if unsure.
      </p>

      <div className="space-y-4">
        {exercises.map(ex => (
          <div key={ex.key} className="flex items-center gap-4">
            <span className="text-[15px] text-white/70 w-28">{ex.label}</span>
            <div className="flex-1 relative">
              <input
                type="number"
                value={(value as any)[ex.key] || ''}
                onChange={(e) => onChange({ ...value, [ex.key]: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="—"
                className={cn(
                  'w-full h-12 px-4 pr-12 rounded-xl text-[16px] font-medium text-right',
                  'bg-white/5 text-white border border-white/10',
                  'focus:border-white/30 outline-none transition-all',
                  'placeholder:text-white/20'
                )}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-white/40">
                {ex.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-full bg-white/10 text-white font-semibold text-[15px] hover:bg-white/20 transition-colors active:scale-[0.98]"
      >
        {Object.values(value).some(v => v) ? 'Continue' : 'Skip'}
      </button>
    </div>
  );
}

interface CommitmentCardProps {
  data: OnboardingData;
  onComplete: () => void;
}

function CommitmentCard({ data, onComplete }: CommitmentCardProps) {
  const theme = data.goal ? GOAL_THEMES[data.goal] : null;

  const summaryItems = [
    { label: 'Goal', value: data.goal?.split(' ')[0] || '—' },
    { label: 'Experience', value: data.experience || '—' },
    { label: 'Frequency', value: data.frequency ? `${data.frequency} days/week` : '—' },
    { label: 'Session', value: data.sessionLength ? `${data.sessionLength} min` : '—' },
    { label: 'Equipment', value: data.equipment === 'commercial_gym' ? 'Full gym' : data.equipment === 'home_gym' ? 'Home gym' : data.equipment || '—' },
  ];

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
        <div className="space-y-3">
          {summaryItems.map((item, i) => (
            <div key={i} className="flex justify-between items-center">
              <span className="text-[14px] text-white/40">{item.label}</span>
              <span className="text-[15px] text-white font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Commitment message */}
      {theme && (
        <div className="text-center py-4">
          <p className="text-[18px] text-white/60 font-medium italic">
            "{theme.mood}"
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={onComplete}
        className={cn(
          'w-full py-4 rounded-full font-semibold text-[16px]',
          'bg-white text-neutral-900',
          'active:scale-[0.98] transition-transform',
          'flex items-center justify-center gap-2'
        )}
      >
        <Sparkles size={18} />
        Build My Program
      </button>

      <p className="text-center text-[13px] text-white/30">
        Your personalized plan will be ready in about 2 minutes
      </p>
    </div>
  );
}
