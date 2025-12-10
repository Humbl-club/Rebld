import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useAnimations';
import {
  TrainingSplit,
  SpecificGoal,
  CurrentStrength,
  CardioPreferences,
} from '@/types';
import { ChevronLeft, Check, Sparkles } from 'lucide-react';

// Import the full step components for complex screens
import TrainingSplitStep from './TrainingSplitStep';
import SpecificGoalStep from './SpecificGoalStep';

/* ═══════════════════════════════════════════════════════════════
   PREMIUM SWIPEABLE ONBOARDING - REBLD Brutalist Design

   Design Philosophy:
   - Bold, confident typography (Syne display font)
   - 2px brutalist borders on premium elements
   - Coral accent strategically placed
   - Building blocks visual identity
   - Large headlines broken into lines
   - Athletic, data-driven aesthetic
   - OLED-optimized pure black background

   Functional Features:
   - Full TrainingSplit support (1x/2x daily, cardio preferences)
   - SpecificGoal support for Competition Prep
   - Strength profile input
   - Pain points and sport selection
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
// BUILDING BLOCKS ANIMATION
// ═══════════════════════════════════════════════════════════════

function BuildingBlocks({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const [visible, setVisible] = useState(false);
  const sizeMap = {
    sm: { block: 'w-2 h-2', gap: 'gap-0.5' },
    md: { block: 'w-3 h-3', gap: 'gap-1' },
    lg: { block: 'w-4 h-4', gap: 'gap-1.5' },
  };

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={cn('flex items-center justify-center', sizeMap[size].gap)}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            sizeMap[size].block,
            'bg-[var(--brand-primary)] transition-all',
            visible ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
          )}
          style={{
            transitionDelay: `${i * 80 + 100}ms`,
            transitionDuration: '350ms',
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GOAL ACCENT COLORS
// ═══════════════════════════════════════════════════════════════

const GOAL_ACCENTS: Record<Goal, string> = {
  'Aesthetic Physique': 'var(--brand-primary)',
  'Strength & Power': '#A0AEC0',
  'Athletic Performance': '#63B3ED',
  'Health & Longevity': '#68D391',
  'Competition Prep': '#F687B3',
};

// ═══════════════════════════════════════════════════════════════
// CARD CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

interface CardConfig {
  id: string;
  headline: string;
  subtext?: string;
  required: boolean;
  condition?: (data: OnboardingData) => boolean;
}

const CARDS: CardConfig[] = [
  {
    id: 'goal',
    headline: "What's Your\nDrive?",
    subtext: "This shapes everything",
    required: true
  },
  {
    id: 'experience',
    headline: "Training\nHistory",
    subtext: "We'll match the intensity",
    required: true
  },
  {
    id: 'frequency',
    headline: "Weekly\nCommitment",
    subtext: "Consistency beats perfection",
    required: true
  },
  {
    id: 'equipment',
    headline: "Your\nSetup",
    subtext: "We'll work with what you have",
    required: true
  },
  {
    id: 'sessionLength',
    headline: "Session\nDuration",
    subtext: "Including warmup and cooldown",
    required: true
  },
  {
    id: 'trainingSplit',
    headline: "Training\nStructure",
    subtext: "Sessions per day, cardio, and more",
    required: true
  },
  {
    id: 'specificGoal',
    headline: "Your\nEvent",
    subtext: "We'll periodize your program",
    required: false,
    condition: (d) => d.goal === 'Competition Prep' || d.goal === 'Athletic Performance'
  },
  {
    id: 'painPoints',
    headline: "Areas to\nProtect",
    subtext: "Optional · We'll program around them",
    required: false
  },
  {
    id: 'strength',
    headline: "Current\nNumbers",
    subtext: "Optional · Improves weight suggestions",
    required: false
  },
  {
    id: 'commitment',
    headline: "Your Program\nAwaits",
    subtext: "Ready to begin",
    required: true
  },
];

// ═══════════════════════════════════════════════════════════════
// OPTION DATA
// ═══════════════════════════════════════════════════════════════

const GOAL_OPTIONS: { id: Goal; label: string; desc: string }[] = [
  { id: 'Aesthetic Physique', label: 'AESTHETIC', desc: 'Build muscle · Reduce body fat' },
  { id: 'Strength & Power', label: 'STRENGTH', desc: 'Increase 1RM · Raw power' },
  { id: 'Athletic Performance', label: 'ATHLETIC', desc: 'Sport-specific · Conditioning' },
  { id: 'Health & Longevity', label: 'HEALTH', desc: 'Sustainable · Long-term' },
  { id: 'Competition Prep', label: 'COMPETITION', desc: 'Peak performance · Event ready' },
];

const EXPERIENCE_OPTIONS: { id: Experience; label: string; detail: string }[] = [
  { id: 'Beginner', label: 'BEGINNER', detail: 'Less than 1 year' },
  { id: 'Intermediate', label: 'INTERMEDIATE', detail: '1-3 years' },
  { id: 'Advanced', label: 'ADVANCED', detail: '3+ years' },
];

const FREQUENCY_OPTIONS: { id: Frequency; label: string; detail: string }[] = [
  { id: '2-3', label: '2-3', detail: 'Great for starting' },
  { id: '3-4', label: '3-4', detail: 'Balanced' },
  { id: '4-5', label: '4-5', detail: 'Serious' },
  { id: '5+', label: '5+', detail: 'Athlete' },
];

const EQUIPMENT_OPTIONS: { id: Equipment; label: string; detail: string }[] = [
  { id: 'minimal', label: 'MINIMAL', detail: 'Bodyweight + basics' },
  { id: 'home_gym', label: 'HOME GYM', detail: 'Dumbbells · Bench · Rack' },
  { id: 'commercial_gym', label: 'FULL GYM', detail: 'Complete access' },
];

const SESSION_OPTIONS: { id: SessionLength; label: string }[] = [
  { id: '30', label: '30' },
  { id: '45', label: '45' },
  { id: '60', label: '60' },
  { id: '75', label: '75' },
  { id: '90', label: '90' },
];

const PAIN_POINT_OPTIONS: { id: PainPoint; label: string }[] = [
  { id: 'Lower Back', label: 'LOWER BACK' },
  { id: 'Knees', label: 'KNEES' },
  { id: 'Shoulders', label: 'SHOULDERS' },
  { id: 'Neck', label: 'NECK' },
  { id: 'Hips', label: 'HIPS' },
  { id: 'Wrists', label: 'WRISTS' },
  { id: 'Elbows', label: 'ELBOWS' },
  { id: 'Ankles', label: 'ANKLES' },
];

// ═══════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════

// Brutalist selection card
interface SelectionCardProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accentColor?: string;
}

function SelectionCard({ selected, onClick, children, accentColor }: SelectionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-[clamp(16px,4.3vw,20px)] text-left transition-all duration-150 active:scale-[0.98]',
        'rounded-[var(--radius-lg)] border-2',
        selected
          ? 'bg-[var(--text-primary)] border-[var(--text-primary)]'
          : 'bg-[var(--bg-secondary)] border-[var(--border-strong)] hover:border-[var(--brand-primary)]'
      )}
      style={selected && accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : {}}
    >
      {children}
    </button>
  );
}

// Compact selection pill
interface SelectionPillProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function SelectionPill({ selected, onClick, children }: SelectionPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-[clamp(16px,4.3vw,20px)] py-[clamp(10px,2.7vw,12px)] transition-all duration-150 active:scale-[0.97]',
        'rounded-full border-2',
        'type-button-sm',
        selected
          ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
          : 'bg-transparent border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--brand-primary)]'
      )}
    >
      {children}
    </button>
  );
}

// Large number card
interface NumberCardProps {
  value: string;
  unit?: string;
  selected: boolean;
  onClick: () => void;
}

function NumberCard({ value, unit, selected, onClick }: NumberCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-[clamp(14px,3.7vw,18px)] transition-all duration-150 active:scale-[0.97]',
        'rounded-[var(--radius-lg)] border-2 min-h-[clamp(72px,19.2vw,88px)]',
        selected
          ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white'
          : 'bg-[var(--bg-secondary)] border-[var(--border-strong)] hover:border-[var(--brand-primary)]'
      )}
    >
      <span className={cn(
        'type-stat-lg',
        selected ? 'text-white' : 'text-[var(--text-primary)]'
      )}>
        {value}
      </span>
      {unit && (
        <span className={cn(
          'type-label-sm mt-1',
          selected ? 'text-white/70' : 'text-[var(--text-tertiary)]'
        )}>
          {unit}
        </span>
      )}
    </button>
  );
}

// Premium button
interface PremiumButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}

function PremiumButton({ children, onClick, variant = 'primary', loading, disabled }: PremiumButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full h-[clamp(52px,13.9vw,60px)] rounded-[var(--radius-lg)]',
        'type-button',
        'transition-all duration-150 active:scale-[0.97]',
        'flex items-center justify-center gap-3',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-[var(--brand-primary)] text-white border-2 border-[var(--brand-primary)]',
        variant === 'secondary' && 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-2 border-[var(--border-strong)] hover:border-[var(--brand-primary)]'
      )}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );
}

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
  const progress = ((currentIndex + 1) / visibleCards.length) * 100;

  // Get accent color based on selected goal
  const accentColor = data.goal ? GOAL_ACCENTS[data.goal] : 'var(--brand-primary)';

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

  // Touch handling for swipe back
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50 && diff < 0) {
      // Swipe right - go back
      goPrev();
    }
    setTouchStart(null);
  }, [touchStart, goPrev]);

  // Selection handlers with auto-advance
  const selectGoal = useCallback((goal: Goal) => {
    haptic.medium();
    setData(prev => ({ ...prev, goal }));
    setTimeout(goNext, 250);
  }, [haptic, goNext]);

  const selectExperience = useCallback((experience: Experience) => {
    haptic.medium();
    setData(prev => ({ ...prev, experience }));
    setTimeout(goNext, 250);
  }, [haptic, goNext]);

  const selectFrequency = useCallback((frequency: Frequency) => {
    haptic.medium();
    setData(prev => ({ ...prev, frequency }));
    setTimeout(goNext, 250);
  }, [haptic, goNext]);

  const selectEquipment = useCallback((equipment: Equipment) => {
    haptic.medium();
    setData(prev => ({ ...prev, equipment }));
    setTimeout(goNext, 250);
  }, [haptic, goNext]);

  const selectSessionLength = useCallback((sessionLength: SessionLength) => {
    haptic.medium();
    setData(prev => ({ ...prev, sessionLength }));
    setTimeout(goNext, 250);
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

  // Training split handler - full object from TrainingSplitStep
  const handleTrainingSplitChange = useCallback((split: TrainingSplit) => {
    haptic.light();
    setData(prev => ({ ...prev, trainingSplit: split }));
  }, [haptic]);

  // Specific goal handler - full object from SpecificGoalStep
  const handleSpecificGoalChange = useCallback((goal: SpecificGoal) => {
    haptic.light();
    setData(prev => ({ ...prev, specificGoal: goal }));
  }, [haptic]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER CARD CONTENT
  // ═══════════════════════════════════════════════════════════════

  const renderCardContent = () => {
    if (!currentCard) return null;

    switch (currentCard.id) {
      case 'goal':
        return (
          <div className="space-y-[clamp(10px,2.7vw,14px)]">
            {GOAL_OPTIONS.map(option => {
              const isSelected = data.goal === option.id;
              const optionAccent = GOAL_ACCENTS[option.id];
              return (
                <SelectionCard
                  key={option.id}
                  selected={isSelected}
                  onClick={() => selectGoal(option.id)}
                  accentColor={isSelected ? optionAccent : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        'type-button-sm',
                        isSelected ? 'text-white' : 'text-[var(--text-primary)]'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'type-body-sm mt-0.5',
                        isSelected ? 'text-white/70' : 'text-[var(--text-tertiary)]'
                      )}>
                        {option.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </SelectionCard>
              );
            })}
          </div>
        );

      case 'experience':
        return (
          <div className="space-y-[clamp(10px,2.7vw,14px)]">
            {EXPERIENCE_OPTIONS.map(option => {
              const isSelected = data.experience === option.id;
              return (
                <SelectionCard
                  key={option.id}
                  selected={isSelected}
                  onClick={() => selectExperience(option.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        'type-button-sm',
                        isSelected ? 'text-[var(--bg-primary)]' : 'text-[var(--text-primary)]'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'type-body-sm mt-0.5',
                        isSelected ? 'text-[var(--bg-primary)]/70' : 'text-[var(--text-tertiary)]'
                      )}>
                        {option.detail}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-primary)]/20 flex items-center justify-center">
                        <Check size={14} className="text-[var(--bg-primary)]" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </SelectionCard>
              );
            })}
          </div>
        );

      case 'frequency':
        return (
          <div className="space-y-[clamp(14px,3.7vw,18px)]">
            <p className="type-label-sm mb-[clamp(14px,3.7vw,18px)]">
              Days Per Week
            </p>
            <div className="grid grid-cols-2 gap-[clamp(10px,2.7vw,14px)]">
              {FREQUENCY_OPTIONS.map(option => {
                const isSelected = data.frequency === option.id;
                return (
                  <NumberCard
                    key={option.id}
                    value={option.label}
                    unit={option.detail}
                    selected={isSelected}
                    onClick={() => selectFrequency(option.id)}
                  />
                );
              })}
            </div>
          </div>
        );

      case 'equipment':
        return (
          <div className="space-y-[clamp(10px,2.7vw,14px)]">
            {EQUIPMENT_OPTIONS.map(option => {
              const isSelected = data.equipment === option.id;
              return (
                <SelectionCard
                  key={option.id}
                  selected={isSelected}
                  onClick={() => selectEquipment(option.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        'type-button-sm',
                        isSelected ? 'text-[var(--bg-primary)]' : 'text-[var(--text-primary)]'
                      )}>
                        {option.label}
                      </p>
                      <p className={cn(
                        'type-body-sm mt-0.5',
                        isSelected ? 'text-[var(--bg-primary)]/70' : 'text-[var(--text-tertiary)]'
                      )}>
                        {option.detail}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-primary)]/20 flex items-center justify-center">
                        <Check size={14} className="text-[var(--bg-primary)]" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </SelectionCard>
              );
            })}
          </div>
        );

      case 'sessionLength':
        return (
          <div className="space-y-[clamp(14px,3.7vw,18px)]">
            <p className="type-label-sm mb-[clamp(14px,3.7vw,18px)]">
              Minutes Per Session
            </p>
            <div className="grid grid-cols-3 gap-[clamp(10px,2.7vw,14px)]">
              {SESSION_OPTIONS.map(option => {
                const isSelected = data.sessionLength === option.id;
                return (
                  <NumberCard
                    key={option.id}
                    value={option.label}
                    unit="min"
                    selected={isSelected}
                    onClick={() => selectSessionLength(option.id)}
                  />
                );
              })}
            </div>
          </div>
        );

      case 'trainingSplit':
        // Use the FULL TrainingSplitStep component with all features:
        // - Sessions per day (1x/2x)
        // - Training type (strength only, strength+cardio, combined, cardio focused)
        // - Cardio preferences (type, duration)
        return (
          <div className="space-y-6">
            <TrainingSplitStep
              value={data.trainingSplit}
              onChange={handleTrainingSplitChange}
            />
            <PremiumButton variant="secondary" onClick={goNext}>
              Continue
            </PremiumButton>
          </div>
        );

      case 'specificGoal':
        // Use the FULL SpecificGoalStep component with all features:
        // - Event type selection (Hyrox, Marathon, etc.)
        // - Event name
        // - Target date with weeks calculation
        // - Current readiness scale (1-10)
        // - Goal description
        return (
          <div className="space-y-6">
            <SpecificGoalStep
              value={data.specificGoal}
              onChange={handleSpecificGoalChange}
            />
            <PremiumButton variant="secondary" onClick={goNext}>
              Continue
            </PremiumButton>
          </div>
        );

      case 'painPoints':
        return (
          <div className="space-y-[clamp(20px,5.3vw,28px)]">
            <div className="flex flex-wrap gap-[clamp(8px,2.1vw,10px)]">
              {PAIN_POINT_OPTIONS.map(option => {
                const isSelected = data.painPoints.includes(option.id);
                return (
                  <SelectionPill
                    key={option.id}
                    selected={isSelected}
                    onClick={() => togglePainPoint(option.id)}
                  >
                    {option.label}
                  </SelectionPill>
                );
              })}
            </div>

            {/* Sport input */}
            <div>
              <p className="type-label-sm mb-[clamp(10px,2.7vw,14px)]">
                Sport Focus (Optional)
              </p>
              <input
                type="text"
                value={data.sport}
                onChange={(e) => setData(prev => ({ ...prev, sport: e.target.value }))}
                placeholder="Hyrox, Soccer, MMA, Triathlon..."
                className={cn(
                  'w-full h-[clamp(48px,12.8vw,56px)] px-[clamp(14px,3.7vw,18px)] type-body font-medium',
                  'bg-[var(--bg-secondary)] text-[var(--text-primary)]',
                  'border-2 border-[var(--border-strong)] rounded-[var(--radius-lg)]',
                  'focus:border-[var(--brand-primary)] outline-none transition-colors',
                  'placeholder:text-[var(--text-disabled)]'
                )}
              />
            </div>

            <PremiumButton variant="secondary" onClick={goNext}>
              {data.painPoints.length > 0 || data.sport ? 'Continue' : 'Skip This'}
            </PremiumButton>
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
            accentColor={accentColor}
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
      className="min-h-[100dvh] h-[100dvh] flex flex-col overflow-hidden relative bg-[var(--bg-primary)]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Subtle gradient based on goal selection */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          background: data.goal
            ? `radial-gradient(ellipse 100% 60% at 50% -20%, ${accentColor}15 0%, transparent 50%)`
            : 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(224, 122, 95, 0.06) 0%, transparent 50%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 pt-[max(16px,env(safe-area-inset-top))] px-[clamp(20px,5.3vw,28px)]">
          {/* Progress bar - 2px brutalist style */}
          <div className="h-[2px] bg-[var(--border-strong)] overflow-hidden mb-[clamp(20px,5.3vw,28px)]">
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: accentColor,
              }}
            />
          </div>

          {/* Navigation row */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goPrev}
              className="flex items-center gap-1.5 text-[var(--text-secondary)] min-h-[44px] -ml-2 px-2 active:text-[var(--text-primary)] transition-colors"
            >
              <ChevronLeft size={20} strokeWidth={2} />
              <span className="type-body-sm font-semibold">Back</span>
            </button>

            {/* Step indicator with building blocks */}
            <div className="flex items-center gap-3">
              <span className="type-label tabular-nums">
                {currentIndex + 1}/{visibleCards.length}
              </span>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className={cn(
          'flex-1 flex flex-col px-[clamp(20px,5.3vw,28px)] pb-[max(24px,env(safe-area-inset-bottom))]',
          'transition-opacity duration-200',
          isTransitioning ? 'opacity-0' : 'opacity-100'
        )}>
          {/* Headline - Large, bold, broken into lines */}
          <div className="mb-[clamp(20px,5.3vw,28px)]">
            <h1 className="type-headline-1 text-[var(--text-primary)] whitespace-pre-line">
              {currentCard?.headline}
            </h1>
            {currentCard?.subtext && (
              <p className="mt-[clamp(10px,2.7vw,14px)] type-body text-[var(--text-tertiary)]">
                {currentCard.subtext}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1 pb-4">
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

interface StrengthCardProps {
  value: CurrentStrength;
  onChange: (strength: CurrentStrength) => void;
  onNext: () => void;
}

function StrengthCard({ value, onChange, onNext }: StrengthCardProps) {
  const exercises = [
    { key: 'squat_kg', label: 'SQUAT', unit: 'kg' },
    { key: 'bench_kg', label: 'BENCH', unit: 'kg' },
    { key: 'deadlift_kg', label: 'DEADLIFT', unit: 'kg' },
  ];

  return (
    <div className="space-y-[clamp(20px,5.3vw,28px)]">
      <p className="type-body-sm text-[var(--text-tertiary)]">
        Enter your estimated 1RM. Leave blank if unsure.
      </p>

      <div className="space-y-[clamp(14px,3.7vw,18px)]">
        {exercises.map(ex => (
          <div key={ex.key} className="flex items-center gap-[clamp(14px,3.7vw,18px)]">
            <span className="type-button-sm text-[var(--text-secondary)] w-[clamp(80px,21.3vw,100px)]">
              {ex.label}
            </span>
            <div className="flex-1 relative">
              <input
                type="number"
                value={(value as any)[ex.key] || ''}
                onChange={(e) => onChange({ ...value, [ex.key]: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="—"
                className={cn(
                  'w-full h-[clamp(48px,12.8vw,56px)] px-[clamp(14px,3.7vw,18px)] pr-[clamp(40px,10.7vw,52px)] type-stat text-right',
                  'bg-[var(--bg-secondary)] text-[var(--text-primary)]',
                  'border-2 border-[var(--border-strong)] rounded-[var(--radius-lg)]',
                  'focus:border-[var(--brand-primary)] outline-none transition-colors',
                  'placeholder:text-[var(--text-disabled)]'
                )}
              />
              <span className="absolute right-[clamp(14px,3.7vw,18px)] top-1/2 -translate-y-1/2 type-button-sm text-[var(--text-disabled)]">
                {ex.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      <PremiumButton variant="secondary" onClick={onNext}>
        {Object.values(value).some(v => v) ? 'Continue' : 'Skip This'}
      </PremiumButton>
    </div>
  );
}

interface CommitmentCardProps {
  data: OnboardingData;
  onComplete: () => void;
  accentColor: string;
}

function CommitmentCard({ data, onComplete, accentColor }: CommitmentCardProps) {
  const summaryItems = [
    { label: 'GOAL', value: data.goal?.split(' ')[0].toUpperCase() || '—' },
    { label: 'LEVEL', value: data.experience?.toUpperCase() || '—' },
    { label: 'FREQUENCY', value: data.frequency ? `${data.frequency} DAYS` : '—' },
    { label: 'SESSION', value: data.sessionLength ? `${data.sessionLength} MIN` : '—' },
    { label: 'SETUP', value: data.equipment === 'commercial_gym' ? 'FULL GYM' : data.equipment === 'home_gym' ? 'HOME GYM' : (data.equipment?.toUpperCase() || '—') },
    { label: 'SESSIONS/DAY', value: data.trainingSplit?.sessions_per_day === '2' ? '2X DAILY' : '1X DAILY' },
  ];

  // Add training type if not strength only
  if (data.trainingSplit?.training_type && data.trainingSplit.training_type !== 'strength_only') {
    summaryItems.push({
      label: 'TYPE',
      value: data.trainingSplit.training_type.replace(/_/g, ' ').toUpperCase()
    });
  }

  // Add cardio info if selected
  if (data.trainingSplit?.cardio_preferences?.preferred_types?.length) {
    summaryItems.push({
      label: 'CARDIO',
      value: data.trainingSplit.cardio_preferences.preferred_types.slice(0, 2).map(t => t.toUpperCase()).join(', ')
    });
  }

  // Add event info if competition prep
  if (data.specificGoal?.event_type) {
    summaryItems.push({
      label: 'EVENT',
      value: (data.specificGoal.event_name || data.specificGoal.event_type).toUpperCase()
    });
  }

  return (
    <div className="space-y-[clamp(24px,6.4vw,32px)]">
      {/* Building blocks visual */}
      <div className="flex justify-center py-[clamp(14px,3.7vw,18px)]">
        <BuildingBlocks size="lg" />
      </div>

      {/* Summary - brutalist style */}
      <div className="bg-[var(--bg-secondary)] border-2 border-[var(--border-strong)] rounded-[var(--radius-lg)] p-[clamp(16px,4.3vw,22px)] space-y-[clamp(10px,2.7vw,14px)]">
        {summaryItems.slice(0, 8).map((item, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="type-label-sm">
              {item.label}
            </span>
            <span className="type-body-sm font-bold text-[var(--text-primary)]">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Generate button */}
      <button
        onClick={onComplete}
        className={cn(
          'w-full h-[clamp(56px,14.9vw,64px)] rounded-[var(--radius-lg)]',
          'type-button',
          'active:scale-[0.97] transition-all duration-150',
          'flex items-center justify-center gap-3',
          'text-white border-2'
        )}
        style={{
          backgroundColor: accentColor,
          borderColor: accentColor,
        }}
      >
        <Sparkles size={20} />
        Build My Program
      </button>

      <p className="text-center type-caption text-[var(--text-disabled)]">
        Your personalized plan will be ready in about 2 minutes
      </p>
    </div>
  );
}
