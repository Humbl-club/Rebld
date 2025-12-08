import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useAnimations';
import {
  TrainingSplit,
  SpecificGoal,
  CurrentStrength,
} from '@/types';
import {
  Gem,
  Hexagon,
  Zap,
  Infinity,
  Target,
  ChevronLeft,
  Dumbbell,
  Home,
  Building2,
  Clock,
  Calendar,
  TrendingUp,
  User,
  Users,
  Crown,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   SWIPEABLE ONBOARDING - Premium Card-Based Experience

   Design: Instagram Stories meets premium fitness app
   - Full-screen cards with subtle gradients
   - One question per card
   - Swipe right to go back, tap to select & advance
   - Story-style progress dots at top

   Data Flow:
   - All data passed up via onChange callbacks
   - Parent component (PlanImporter) manages state & API calls
   - This component is purely presentational + local navigation
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

// Card configuration
interface CardConfig {
  id: string;
  title: string;
  subtitle?: string;
  required: boolean;
  condition?: (data: OnboardingData) => boolean;
}

const CARDS: CardConfig[] = [
  { id: 'goal', title: "What's your\nmain goal?", subtitle: 'This shapes everything', required: true },
  { id: 'experience', title: "Training\nexperience?", subtitle: 'Be honest - we adjust accordingly', required: true },
  { id: 'frequency', title: "How many days\nper week?", subtitle: 'Quality over quantity', required: true },
  { id: 'equipment', title: "What equipment\ndo you have?", subtitle: 'We work with what you have', required: true },
  { id: 'sessionLength', title: "How long per\nsession?", subtitle: 'Including warmup & cooldown', required: true },
  { id: 'painPoints', title: "Any injuries or\nlimitations?", subtitle: 'Optional - helps us protect you', required: false },
  { id: 'specificGoal', title: "Training for\nan event?", subtitle: 'Optional - enables periodization', required: false, condition: (d) => d.goal === 'Competition Prep' || d.goal === 'Athletic Performance' },
  { id: 'trainingSplit', title: "How do you\nwant to train?", subtitle: 'Structure your sessions', required: true },
  { id: 'strength', title: "Know your\ncurrent strength?", subtitle: 'Optional - improves weight suggestions', required: false },
  { id: 'review', title: "Ready to\nbuild your plan?", subtitle: 'Review & generate', required: true },
];

// Option configurations with Lucide icon components
const GOAL_OPTIONS: { id: Goal; label: string; desc: string; icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }> }[] = [
  { id: 'Aesthetic Physique', label: 'Aesthetic', desc: 'Build muscle, reduce body fat', icon: Gem },
  { id: 'Strength & Power', label: 'Strength', desc: 'Increase 1RM and power', icon: Hexagon },
  { id: 'Athletic Performance', label: 'Athletic', desc: 'Sport-specific conditioning', icon: Zap },
  { id: 'Health & Longevity', label: 'Health', desc: 'Sustainable fitness for life', icon: Infinity },
  { id: 'Competition Prep', label: 'Competition', desc: 'Prepare for a specific event', icon: Target },
];

// Equipment options with icons
const EQUIPMENT_OPTIONS: { id: Equipment; label: string; desc: string; icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }> }[] = [
  { id: 'minimal', label: 'Minimal', desc: 'Bodyweight + basics', icon: User },
  { id: 'home_gym', label: 'Home Gym', desc: 'Dumbbells, bench, rack', icon: Home },
  { id: 'commercial_gym', label: 'Full Gym', desc: 'Complete equipment access', icon: Building2 },
];

// Experience options with icons
const EXPERIENCE_OPTIONS_WITH_ICONS: { id: Experience; label: string; desc: string; icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }> }[] = [
  { id: 'Beginner', label: 'Beginner', desc: 'Less than 1 year training', icon: User },
  { id: 'Intermediate', label: 'Intermediate', desc: '1-3 years consistent training', icon: Users },
  { id: 'Advanced', label: 'Advanced', desc: '3+ years serious training', icon: Crown },
];

// Fitness level descriptions for the 1-10 scale
const FITNESS_LEVEL_INFO: Record<number, { label: string; desc: string }> = {
  1: { label: 'Starting out', desc: 'New to training or returning after a long break' },
  2: { label: 'Building base', desc: 'Training occasionally, still learning form' },
  3: { label: 'Getting consistent', desc: '1-2x per week, basic exercises' },
  4: { label: 'Regular', desc: '2-3x per week, comfortable with fundamentals' },
  5: { label: 'Solid foundation', desc: '3x per week, good form on main lifts' },
  6: { label: 'Committed', desc: '3-4x per week, tracking progress' },
  7: { label: 'Dedicated', desc: '4-5x per week, structured programming' },
  8: { label: 'Advanced', desc: '5+ days, years of consistent training' },
  9: { label: 'Elite amateur', desc: 'Near competition-level conditioning' },
  10: { label: 'Competition ready', desc: 'Peak form, professional-level prep' },
};

// Frequency options with icons
const FREQUENCY_OPTIONS: { id: Frequency; label: string; desc: string; icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }> }[] = [
  { id: '2-3', label: '2-3 days', desc: 'Perfect for beginners', icon: Calendar },
  { id: '3-4', label: '3-4 days', desc: 'Balanced approach', icon: Calendar },
  { id: '4-5', label: '4-5 days', desc: 'Serious commitment', icon: Calendar },
  { id: '5+', label: '5+ days', desc: 'Athlete level', icon: TrendingUp },
];

const SESSION_OPTIONS: { id: SessionLength; label: string }[] = [
  { id: '30', label: '30 min' },
  { id: '45', label: '45 min' },
  { id: '60', label: '60 min' },
  { id: '75', label: '75 min' },
  { id: '90', label: '90 min' },
];

const PAIN_POINT_OPTIONS: { id: PainPoint; label: string }[] = [
  { id: 'Knees', label: 'Knees' },
  { id: 'Lower Back', label: 'Lower Back' },
  { id: 'Shoulders', label: 'Shoulders' },
  { id: 'Wrists', label: 'Wrists' },
  { id: 'Neck', label: 'Neck' },
  { id: 'Hips', label: 'Hips' },
  { id: 'Elbows', label: 'Elbows' },
  { id: 'Ankles', label: 'Ankles' },
];

const SPORT_OPTIONS = [
  'HYROX', 'Marathon', 'Triathlon', 'CrossFit', 'Powerlifting',
  'Bodybuilding', 'Boxing/MMA', 'Basketball', 'Football', 'Tennis',
  'Swimming', 'Cycling', 'Other'
];

export default function SwipeableOnboarding({
  initialData,
  onDataChange,
  onComplete,
  onBack,
}: SwipeableOnboardingProps) {
  const haptic = useHaptic();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter cards based on conditions
  const visibleCards = CARDS.filter(card =>
    !card.condition || card.condition(data)
  );

  const currentCard = visibleCards[currentIndex];

  // Sync data changes to parent
  useEffect(() => {
    onDataChange(data);
  }, [data, onDataChange]);

  // Update local data and notify parent
  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  // Navigation
  const goNext = useCallback(() => {
    haptic.light();
    if (currentIndex < visibleCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, visibleCards.length, haptic]);

  const goPrev = useCallback(() => {
    haptic.light();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      onBack();
    }
  }, [currentIndex, haptic, onBack]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < visibleCards.length) {
      haptic.light();
      setCurrentIndex(index);
    }
  }, [visibleCards.length, haptic]);

  // Touch handling for swipe
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isRightSwipe) {
      goPrev();
    }
    // Left swipe disabled - use tap to advance
  };

  // Select option and auto-advance
  const selectOption = useCallback((cardId: string, value: any) => {
    haptic.medium();

    switch (cardId) {
      case 'goal':
        updateData({ goal: value });
        setTimeout(goNext, 300);
        break;
      case 'experience':
        updateData({ experience: value });
        setTimeout(goNext, 300);
        break;
      case 'frequency':
        updateData({ frequency: value });
        setTimeout(goNext, 300);
        break;
      case 'equipment':
        updateData({ equipment: value });
        setTimeout(goNext, 300);
        break;
      case 'sessionLength':
        updateData({ sessionLength: value });
        setTimeout(goNext, 300);
        break;
      default:
        break;
    }
  }, [haptic, updateData, goNext]);

  // Toggle pain point
  const togglePainPoint = useCallback((point: PainPoint) => {
    haptic.light();
    setData(prev => ({
      ...prev,
      painPoints: prev.painPoints.includes(point)
        ? prev.painPoints.filter(p => p !== point)
        : [...prev.painPoints, point]
    }));
  }, [haptic]);

  // Render card content
  const renderCardContent = () => {
    if (!currentCard) return null;

    switch (currentCard.id) {
      case 'goal':
        return (
          <div className="space-y-3">
            {GOAL_OPTIONS.map(option => {
              const isSelected = data.goal === option.id;
              const IconComponent = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => selectOption('goal', option.id)}
                  className={cn(
                    'w-full p-4 rounded-2xl text-left transition-all duration-200',
                    'border-2 active:scale-[0.98]',
                    isSelected
                      ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                      : 'bg-[var(--surface-secondary)] border-transparent'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                      isSelected ? 'bg-white/20' : 'bg-[var(--surface-hover)]'
                    )}>
                      <IconComponent
                        size={22}
                        strokeWidth={isSelected ? 2 : 1.5}
                        className={isSelected ? 'text-white' : 'text-[var(--text-secondary)]'}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        'font-bold text-[16px]',
                        isSelected ? 'text-white' : 'text-[var(--text-primary)]'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'text-[13px]',
                        isSelected ? 'text-white/80' : 'text-[var(--text-secondary)]'
                      )}>
                        {option.desc}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'experience':
        return (
          <div className="space-y-3">
            {EXPERIENCE_OPTIONS_WITH_ICONS.map(option => {
              const isSelected = data.experience === option.id;
              const IconComponent = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => selectOption('experience', option.id)}
                  className={cn(
                    'w-full p-4 rounded-2xl text-left transition-all duration-200',
                    'border-2 active:scale-[0.98]',
                    isSelected
                      ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                      : 'bg-[var(--surface-secondary)] border-transparent'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                      isSelected ? 'bg-white/20' : 'bg-[var(--surface-hover)]'
                    )}>
                      <IconComponent
                        size={22}
                        strokeWidth={isSelected ? 2 : 1.5}
                        className={isSelected ? 'text-white' : 'text-[var(--text-secondary)]'}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        'font-bold text-[16px]',
                        isSelected ? 'text-white' : 'text-[var(--text-primary)]'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'text-[13px]',
                        isSelected ? 'text-white/80' : 'text-[var(--text-secondary)]'
                      )}>
                        {option.desc}
                      </p>
                    </div>
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
              const IconComponent = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => selectOption('frequency', option.id)}
                  className={cn(
                    'w-full p-4 rounded-2xl text-left transition-all duration-200',
                    'border-2 active:scale-[0.98]',
                    isSelected
                      ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                      : 'bg-[var(--surface-secondary)] border-transparent'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                      isSelected ? 'bg-white/20' : 'bg-[var(--surface-hover)]'
                    )}>
                      <IconComponent
                        size={22}
                        strokeWidth={isSelected ? 2 : 1.5}
                        className={isSelected ? 'text-white' : 'text-[var(--text-secondary)]'}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        'font-bold text-[16px]',
                        isSelected ? 'text-white' : 'text-[var(--text-primary)]'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'text-[13px]',
                        isSelected ? 'text-white/80' : 'text-[var(--text-secondary)]'
                      )}>
                        {option.desc}
                      </p>
                    </div>
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
              const IconComponent = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => selectOption('equipment', option.id)}
                  className={cn(
                    'w-full p-4 rounded-2xl text-left transition-all duration-200',
                    'border-2 active:scale-[0.98]',
                    isSelected
                      ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                      : 'bg-[var(--surface-secondary)] border-transparent'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                      isSelected ? 'bg-white/20' : 'bg-[var(--surface-hover)]'
                    )}>
                      <IconComponent
                        size={22}
                        strokeWidth={isSelected ? 2 : 1.5}
                        className={isSelected ? 'text-white' : 'text-[var(--text-secondary)]'}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        'font-bold text-[16px]',
                        isSelected ? 'text-white' : 'text-[var(--text-primary)]'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'text-[13px]',
                        isSelected ? 'text-white/80' : 'text-[var(--text-secondary)]'
                      )}>
                        {option.desc}
                      </p>
                    </div>
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
                  onClick={() => selectOption('sessionLength', option.id)}
                  className={cn(
                    'p-4 rounded-2xl transition-all duration-200',
                    'border-2 active:scale-[0.98]',
                    isSelected
                      ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                      : 'bg-[var(--surface-secondary)] border-transparent text-[var(--text-primary)]'
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Clock
                      size={20}
                      strokeWidth={isSelected ? 2 : 1.5}
                      className={isSelected ? 'text-white' : 'text-[var(--text-secondary)]'}
                    />
                    <span className="font-bold text-[16px]">{option.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 'painPoints':
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PAIN_POINT_OPTIONS.map(option => (
                <button
                  key={option.id}
                  onClick={() => togglePainPoint(option.id)}
                  className={cn(
                    'px-4 py-2 rounded-full font-semibold text-[14px] transition-all duration-200',
                    'border-2 active:scale-[0.98]',
                    data.painPoints.includes(option.id)
                      ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                      : 'bg-[var(--surface-secondary)] border-transparent text-[var(--text-primary)]'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={goNext}
              className="w-full h-14 mt-4 rounded-2xl font-bold text-[15px] uppercase tracking-wide text-white bg-[var(--brand-primary)] active:scale-[0.98] transition-transform"
            >
              {data.painPoints.length === 0 ? 'Skip' : 'Continue'}
            </button>
          </div>
        );

      case 'specificGoal':
        return (
          <SpecificGoalCard
            value={data.specificGoal}
            onChange={(goal) => updateData({ specificGoal: goal })}
            sport={data.sport}
            onSportChange={(sport) => updateData({ sport })}
            onNext={goNext}
          />
        );

      case 'trainingSplit':
        return (
          <TrainingSplitCard
            value={data.trainingSplit}
            onChange={(split) => updateData({ trainingSplit: split })}
            onNext={goNext}
          />
        );

      case 'strength':
        return (
          <StrengthCard
            value={data.currentStrength}
            onChange={(strength) => updateData({ currentStrength: strength })}
            onNext={goNext}
          />
        );

      case 'review':
        return (
          <ReviewCard
            data={data}
            onEdit={goToIndex}
            onComplete={onComplete}
            cards={visibleCards}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-[100dvh] h-[100dvh] bg-[var(--bg-primary)] flex flex-col overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Fixed header area - progress + back button */}
      <div className="shrink-0 pt-[max(12px,env(safe-area-inset-top))]">
        {/* Progress dots - Instagram story style */}
        <div className="px-5 pb-2">
          <div className="flex gap-1">
            {visibleCards.map((_, index) => (
              <button
                key={index}
                onClick={() => goToIndex(index)}
                className={cn(
                  'h-[3px] flex-1 rounded-full transition-all duration-300',
                  index < currentIndex
                    ? 'bg-[var(--brand-primary)]'
                    : index === currentIndex
                    ? 'bg-[var(--brand-primary)]'
                    : 'bg-[var(--border-strong)]'
                )}
              />
            ))}
          </div>
        </div>

        {/* Back button */}
        <div className="px-5 py-2">
          <button
            onClick={goPrev}
            className="flex items-center gap-1.5 text-[var(--text-secondary)] font-semibold text-[14px] min-h-[44px] -ml-1"
          >
            <ChevronLeft size={22} strokeWidth={2} />
            Back
          </button>
        </div>

        {/* Title */}
        <div className="px-5 pb-4">
          <h1 className="text-[28px] font-black text-[var(--text-primary)] leading-tight whitespace-pre-line">
            {currentCard?.title}
          </h1>
          {currentCard?.subtitle && (
            <p className="mt-1.5 text-[14px] text-[var(--text-secondary)]">
              {currentCard.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        {renderCardContent()}

        {/* Swipe hint */}
        {currentIndex > 0 && currentCard?.id !== 'review' && (
          <p className="text-center text-[12px] text-[var(--text-tertiary)] mt-6 pb-2">
            Swipe right to go back
          </p>
        )}
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
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <div className="space-y-6">
      {/* Sport selection */}
      <div>
        <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
          What sport or event?
        </p>
        <div className="flex flex-wrap gap-2">
          {SPORT_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => onSportChange(s)}
              className={cn(
                'px-4 py-2 rounded-full font-semibold text-[14px] transition-all',
                'border-2 active:scale-[0.98]',
                sport === s
                  ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                  : 'bg-[var(--surface-secondary)] border-transparent text-[var(--text-primary)]'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Event date */}
      <div>
        <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
          Event date (optional)
        </p>
        <input
          type="date"
          value={value?.target_date || ''}
          onChange={(e) => onChange({ ...value, target_date: e.target.value })}
          className={cn(
            'w-full h-14 px-4 rounded-2xl text-[16px] font-semibold',
            'bg-[var(--surface-secondary)] text-[var(--text-primary)]',
            'border-2 border-transparent focus:border-[var(--brand-primary)]',
            'outline-none transition-all'
          )}
          min={new Date().toISOString().split('T')[0]}
        />
        {value?.target_date && (
          <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
            {Math.ceil((new Date(value.target_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))} weeks away
          </p>
        )}
      </div>

      {/* Readiness */}
      <div>
        <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
          Current fitness level
        </p>
        <p className="text-[12px] text-[var(--text-secondary)] mb-3">
          Rate your current conditioning for this event
        </p>

        {/* Visual scale with markers */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mb-1 px-1">
            <span>Beginner</span>
            <span>Intermediate</span>
            <span>Elite</span>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <button
                key={num}
                onClick={() => onChange({ ...value, current_readiness: num })}
                className={cn(
                  'flex-1 h-10 rounded-lg font-bold text-[13px] transition-all',
                  'active:scale-[0.95]',
                  value?.current_readiness === num
                    ? 'bg-[var(--brand-primary)] text-white'
                    : num <= (value?.current_readiness || 0)
                    ? 'bg-[var(--brand-primary)]/30 text-[var(--text-primary)]'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                )}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic explanation based on selection */}
        {value?.current_readiness && (
          <div className="bg-[var(--surface-secondary)] rounded-xl p-3 animate-fade-in">
            <p className="font-semibold text-[14px] text-[var(--text-primary)]">
              {FITNESS_LEVEL_INFO[value.current_readiness]?.label}
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              {FITNESS_LEVEL_INFO[value.current_readiness]?.desc}
            </p>
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        className="w-full h-14 rounded-2xl font-bold text-[15px] uppercase tracking-wide text-white bg-[var(--brand-primary)] active:scale-[0.98] transition-transform"
      >
        Continue
      </button>
    </div>
  );
}

interface TrainingSplitCardProps {
  value: TrainingSplit;
  onChange: (split: TrainingSplit) => void;
  onNext: () => void;
}

function TrainingSplitCard({ value, onChange, onNext }: TrainingSplitCardProps) {
  const [showCardio, setShowCardio] = useState(
    value.training_type !== 'strength_only'
  );

  const TRAINING_TYPES = [
    { id: 'strength_only', label: 'Strength Only', desc: 'Pure resistance training', hasCardio: false },
    { id: 'strength_plus_cardio', label: 'Strength + Cardio', desc: 'Separate sessions', hasCardio: true },
    { id: 'combined', label: 'Combined', desc: 'Cardio finishers after strength', hasCardio: true },
    { id: 'cardio_focused', label: 'Cardio Focused', desc: 'Endurance priority', hasCardio: true },
  ];

  const CARDIO_TYPES = [
    { id: 'running', label: 'Running' },
    { id: 'incline_walk', label: 'Incline Walk' },
    { id: 'cycling', label: 'Cycling' },
    { id: 'rowing', label: 'Rowing' },
    { id: 'swimming', label: 'Swimming' },
    { id: 'elliptical', label: 'Elliptical' },
    { id: 'stair_climber', label: 'Stair Climber' },
  ];

  return (
    <div className="space-y-6">
      {/* Sessions per day */}
      <div>
        <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
          Sessions per day
        </p>
        <div className="flex gap-3">
          {['1', '2'].map(sessions => (
            <button
              key={sessions}
              onClick={() => onChange({ ...value, sessions_per_day: sessions as '1' | '2' })}
              className={cn(
                'flex-1 p-4 rounded-2xl text-left transition-all',
                'border-2 active:scale-[0.98]',
                value.sessions_per_day === sessions
                  ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                  : 'bg-[var(--surface-secondary)] border-transparent'
              )}
            >
              <p className={cn(
                'font-bold text-[16px]',
                value.sessions_per_day === sessions ? 'text-white' : 'text-[var(--text-primary)]'
              )}>
                {sessions === '1' ? 'Once Daily' : 'Twice Daily'}
              </p>
              <p className={cn(
                'text-[13px]',
                value.sessions_per_day === sessions ? 'text-white/80' : 'text-[var(--text-secondary)]'
              )}>
                {sessions === '1' ? 'Single focused session' : 'AM/PM split'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Training type */}
      <div>
        <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
          Training style
        </p>
        <div className="space-y-2">
          {TRAINING_TYPES.map(type => (
            <button
              key={type.id}
              onClick={() => {
                onChange({ ...value, training_type: type.id as TrainingSplit['training_type'] });
                setShowCardio(type.hasCardio);
              }}
              className={cn(
                'w-full p-4 rounded-2xl text-left transition-all',
                'border-2 active:scale-[0.98]',
                value.training_type === type.id
                  ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                  : 'bg-[var(--surface-secondary)] border-transparent'
              )}
            >
              <p className={cn(
                'font-bold text-[15px]',
                value.training_type === type.id ? 'text-white' : 'text-[var(--text-primary)]'
              )}>
                {type.label}
              </p>
              <p className={cn(
                'text-[13px]',
                value.training_type === type.id ? 'text-white/80' : 'text-[var(--text-secondary)]'
              )}>
                {type.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Cardio preferences */}
      {showCardio && (
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
            Preferred cardio
          </p>
          <div className="flex flex-wrap gap-2">
            {CARDIO_TYPES.map(cardio => {
              const isSelected = value.cardio_preferences?.preferred_types?.includes(cardio.id);
              return (
                <button
                  key={cardio.id}
                  onClick={() => {
                    const current = value.cardio_preferences?.preferred_types || [];
                    const newTypes = isSelected
                      ? current.filter(t => t !== cardio.id)
                      : [...current, cardio.id];
                    onChange({
                      ...value,
                      cardio_preferences: {
                        ...value.cardio_preferences,
                        preferred_types: newTypes,
                      }
                    });
                  }}
                  className={cn(
                    'px-4 py-2 rounded-full font-semibold text-[14px] transition-all',
                    'border-2 active:scale-[0.98]',
                    isSelected
                      ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
                      : 'bg-[var(--surface-secondary)] border-transparent text-[var(--text-primary)]'
                  )}
                >
                  {cardio.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full h-14 rounded-2xl font-bold text-[15px] uppercase tracking-wide text-white bg-[var(--brand-primary)] active:scale-[0.98] transition-transform"
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
  const [expanded, setExpanded] = useState(false);

  const CORE_LIFTS = [
    { key: 'squat_kg', label: 'Squat', placeholder: 'kg' },
    { key: 'bench_kg', label: 'Bench Press', placeholder: 'kg' },
    { key: 'deadlift_kg', label: 'Deadlift', placeholder: 'kg' },
  ];

  const ADDITIONAL_LIFTS = [
    { key: 'overhead_press_kg', label: 'Overhead Press', placeholder: 'kg' },
    { key: 'row_kg', label: 'Barbell Row', placeholder: 'kg' },
    { key: 'pullup_count', label: 'Pull-ups', placeholder: 'reps' },
    { key: 'pushup_count', label: 'Push-ups', placeholder: 'reps' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-[var(--text-secondary)]">
        Enter your best recent weights. This helps us set accurate starting points.
      </p>

      {/* Core lifts */}
      <div className="space-y-3">
        {CORE_LIFTS.map(lift => (
          <div key={lift.key} className="flex items-center gap-3">
            <span className="flex-1 font-semibold text-[15px] text-[var(--text-primary)]">
              {lift.label}
            </span>
            <input
              type="number"
              value={(value as any)[lift.key] || ''}
              onChange={(e) => onChange({ ...value, [lift.key]: e.target.value ? Number(e.target.value) : undefined })}
              placeholder={lift.placeholder}
              className={cn(
                'w-24 h-12 px-3 rounded-xl text-center text-[16px] font-bold',
                'bg-[var(--surface-secondary)] text-[var(--text-primary)]',
                'border-2 border-transparent focus:border-[var(--brand-primary)]',
                'outline-none transition-all'
              )}
            />
          </div>
        ))}
      </div>

      {/* Expand for more */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-3 text-[14px] font-semibold text-[var(--brand-primary)]"
      >
        {expanded ? 'Show less' : 'Add more exercises'}
      </button>

      {expanded && (
        <div className="space-y-3 animate-fade-in">
          {ADDITIONAL_LIFTS.map(lift => (
            <div key={lift.key} className="flex items-center gap-3">
              <span className="flex-1 font-semibold text-[15px] text-[var(--text-primary)]">
                {lift.label}
              </span>
              <input
                type="number"
                value={(value as any)[lift.key] || ''}
                onChange={(e) => onChange({ ...value, [lift.key]: e.target.value ? Number(e.target.value) : undefined })}
                placeholder={lift.placeholder}
                className={cn(
                  'w-24 h-12 px-3 rounded-xl text-center text-[16px] font-bold',
                  'bg-[var(--surface-secondary)] text-[var(--text-primary)]',
                  'border-2 border-transparent focus:border-[var(--brand-primary)]',
                  'outline-none transition-all'
                )}
              />
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full h-14 rounded-2xl font-bold text-[15px] uppercase tracking-wide text-white bg-[var(--brand-primary)] active:scale-[0.98] transition-transform"
      >
        {Object.values(value).some(v => v) ? 'Continue' : 'Skip'}
      </button>
    </div>
  );
}

interface ReviewCardProps {
  data: OnboardingData;
  onEdit: (index: number) => void;
  onComplete: () => void;
  cards: CardConfig[];
}

function ReviewCard({ data, onEdit, onComplete, cards }: ReviewCardProps) {
  const canGenerate = data.goal && data.experience && data.frequency && data.equipment && data.sessionLength;

  const summaryItems = [
    { label: 'Goal', value: data.goal, cardIndex: cards.findIndex(c => c.id === 'goal') },
    { label: 'Experience', value: data.experience, cardIndex: cards.findIndex(c => c.id === 'experience') },
    { label: 'Frequency', value: data.frequency ? `${data.frequency} days/week` : null, cardIndex: cards.findIndex(c => c.id === 'frequency') },
    { label: 'Equipment', value: data.equipment, cardIndex: cards.findIndex(c => c.id === 'equipment') },
    { label: 'Session', value: data.sessionLength ? `${data.sessionLength} min` : null, cardIndex: cards.findIndex(c => c.id === 'sessionLength') },
    { label: 'Injuries', value: data.painPoints.length > 0 ? data.painPoints.join(', ') : 'None', cardIndex: cards.findIndex(c => c.id === 'painPoints') },
    { label: 'Training', value: data.trainingSplit.training_type?.replace(/_/g, ' '), cardIndex: cards.findIndex(c => c.id === 'trainingSplit') },
  ];

  if (data.sport) {
    summaryItems.push({ label: 'Sport', value: data.sport, cardIndex: cards.findIndex(c => c.id === 'specificGoal') });
  }

  if (data.specificGoal?.target_date) {
    const weeks = Math.ceil((new Date(data.specificGoal.target_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000));
    summaryItems.push({ label: 'Event', value: `${weeks} weeks away`, cardIndex: cards.findIndex(c => c.id === 'specificGoal') });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {summaryItems.map((item, i) => (
          <button
            key={i}
            onClick={() => item.cardIndex >= 0 && onEdit(item.cardIndex)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)] transition-colors"
          >
            <span className="text-[14px] text-[var(--text-secondary)]">{item.label}</span>
            <span className="font-semibold text-[14px] text-[var(--text-primary)]">{item.value || '—'}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onComplete}
        disabled={!canGenerate}
        className={cn(
          'w-full h-14 rounded-2xl font-bold text-[15px] uppercase tracking-wide transition-all',
          'active:scale-[0.98]',
          canGenerate
            ? 'text-white bg-[var(--brand-primary)]'
            : 'text-[var(--text-tertiary)] bg-[var(--surface-secondary)]'
        )}
      >
        Generate My Plan
      </button>
    </div>
  );
}
