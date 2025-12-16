import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { WorkoutPlan, TrainingSplit, SpecificGoal, CurrentStrength } from '../../types';
import { useHaptic } from '../../hooks/useAnimations';
import useUserProfile from '../../hooks/useUserProfile';
import { cn } from '../../lib/utils';
import PlanBuildingScreen from './PlanBuildingScreen';

/* ═══════════════════════════════════════════════════════════════════════════════
   PERSONAL ONBOARDING - iOS-Native, Human-Centered Design

   Design Principles:
   - Conversational, not transactional
   - Shows the user their program taking shape
   - iOS-native feel (generous spacing, subtle depth)
   - High contrast, excellent legibility
   - Each choice shows its impact immediately

   Typography:
   - Headlines: 28-32px, font-weight 700
   - Body: 17px, font-weight 400
   - Secondary: 15px, font-weight 400, 60% opacity
   - Line height: 1.4-1.5

   Colors:
   - Background: #0C0C0C (not pure black - easier on OLED)
   - Primary text: #F5F5F5 (not pure white)
   - Secondary text: #A1A1AA
   - Accent: #EF4444 (used sparingly)
   - Surface: #1A1A1A
   - Border: #2A2A2A
   ═══════════════════════════════════════════════════════════════════════════════ */

interface PersonalOnboardingProps {
  onPlanGenerated: (plan: Omit<WorkoutPlan, 'id'>) => void;
}

// Design tokens
const colors = {
  bg: '#0C0C0C',
  surface: '#1A1A1A',
  surfaceHover: '#222222',
  border: '#2A2A2A',
  borderFocus: '#3A3A3A',
  textPrimary: '#F5F5F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  accent: '#EF4444',
  accentMuted: '#DC2626',
  success: '#22C55E',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTIVE DESIGN SYSTEM - All values responsive to screen size
// Supports iPhone SE (375px) to iPhone Pro Max (430px) and all sizes between
// ═══════════════════════════════════════════════════════════════════════════════

// Spacing uses CSS clamp() for fluid scaling
// Format: clamp(min, preferred, max)
const spacing = {
  // Horizontal padding - scales from 16px to 24px based on viewport
  pagePadding: 'clamp(16px, 5vw, 24px)',
  // Section gaps - scales from 16px to 24px
  sectionGap: 'clamp(16px, 4vw, 24px)',
  // Element gaps - scales from 8px to 12px
  elementGap: 'clamp(8px, 2vw, 12px)',
  // Small gaps - scales from 4px to 8px
  smallGap: 'clamp(4px, 1vw, 8px)',
};

// Typography uses clamp() for fluid scaling
const typography = {
  // Headlines - scales from 24px to 32px
  headline: 'clamp(1.5rem, 5vw + 0.5rem, 2rem)',
  // Body - scales from 15px to 17px
  body: 'clamp(0.938rem, 2vw + 0.5rem, 1.063rem)',
  // Secondary - scales from 13px to 15px
  secondary: 'clamp(0.813rem, 1.5vw + 0.5rem, 0.938rem)',
  // Small - scales from 11px to 13px
  small: 'clamp(0.688rem, 1vw + 0.5rem, 0.813rem)',
};

// Touch targets - minimum 44px per Apple HIG, scales up on larger screens
const touchTargets = {
  // Standard button - min 44px, scales to 56px
  button: 'clamp(44px, 12vw, 56px)',
  // Compact button - min 40px, scales to 48px
  compact: 'clamp(40px, 10vw, 48px)',
  // Large button - min 48px, scales to 60px
  large: 'clamp(48px, 14vw, 60px)',
};

// Border radius - scales with screen size
const radius = {
  // Standard - 10px to 14px
  standard: 'clamp(10px, 2.5vw, 14px)',
  // Large - 14px to 20px
  large: 'clamp(14px, 3.5vw, 20px)',
};

// Types
type Path = 'competition' | 'general' | null;
type GeneralGoal = 'muscle' | 'strength' | 'fat_loss' | 'wellness';
type Experience = 'beginner' | 'intermediate' | 'advanced';
type Step = 'welcome' | 'path' | 'goal' | 'schedule' | 'body' | 'strength' | 'final' | 'generating' | 'complete';

// Competition sports
const SPORTS = [
  { id: 'hyrox', name: 'Hyrox', desc: 'Functional fitness racing' },
  { id: 'powerlifting', name: 'Powerlifting', desc: 'Squat, bench, deadlift' },
  { id: 'marathon', name: 'Marathon', desc: 'Long distance running' },
  { id: 'triathlon', name: 'Triathlon', desc: 'Swim, bike, run' },
  { id: 'crossfit', name: 'CrossFit', desc: 'Functional fitness' },
  { id: 'bodybuilding', name: 'Bodybuilding', desc: 'Physique competition' },
  { id: 'other', name: 'Other', desc: 'Custom event' },
];

// General goals with descriptions
const GENERAL_GOALS = [
  {
    id: 'muscle' as const,
    title: 'Build Muscle',
    desc: 'Increase muscle size and definition',
    detail: '8-12 reps, moderate rest, progressive volume',
  },
  {
    id: 'strength' as const,
    title: 'Get Stronger',
    desc: 'Maximize force production',
    detail: '3-6 reps, longer rest, heavy compounds',
  },
  {
    id: 'fat_loss' as const,
    title: 'Lose Fat',
    desc: 'Preserve muscle while cutting',
    detail: 'Strength + conditioning hybrid',
  },
  {
    id: 'wellness' as const,
    title: 'General Wellness',
    desc: 'Balanced fitness and health',
    detail: 'Varied training, sustainable approach',
  },
];

// Days of week
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Body areas for pain points
const BODY_AREAS = [
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'lower_back', label: 'Lower Back' },
  { id: 'knees', label: 'Knees' },
  { id: 'wrists', label: 'Wrists' },
  { id: 'neck', label: 'Neck' },
  { id: 'hips', label: 'Hips' },
];

// Main benchmarks
const BENCHMARKS = [
  { id: 'bench_kg', name: 'Bench Press', placeholder: '60' },
  { id: 'squat_kg', name: 'Squat', placeholder: '80' },
  { id: 'deadlift_kg', name: 'Deadlift', placeholder: '100' },
];

export default function PersonalOnboarding({ onPlanGenerated }: PersonalOnboardingProps) {
  const { user } = useUser();
  const haptic = useHaptic();
  const { userProfile, updateUserProfile } = useUserProfile();

  // Convex
  const generatePlanAction = useAction(api.ai.generateWorkoutPlan);
  const incrementPlanUsageMutation = useMutation(api.mutations.incrementPlanUsage);

  // Flow state
  const [step, setStep] = useState<Step>('welcome');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // User choices
  const [path, setPath] = useState<Path>(null);

  // Competition path
  const [sport, setSport] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');

  // General path
  const [generalGoal, setGeneralGoal] = useState<GeneralGoal | null>(null);

  // Common
  const [experience, setExperience] = useState<Experience>('intermediate');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 2, 4]); // Mon, Wed, Fri
  const [sessionLength, setSessionLength] = useState<number>(60);
  const [sessionsPerDay, setSessionsPerDay] = useState<'1' | '2'>('1');
  const [splitType, setSplitType] = useState<'strength_cardio' | 'technique_conditioning' | 'am_pm_same'>('strength_cardio');
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [benchmarks, setBenchmarks] = useState<Record<string, number>>({});
  const [age, setAge] = useState<number | undefined>(undefined);
  const [additionalNotes, setAdditionalNotes] = useState<string>('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<Omit<WorkoutPlan, 'id'> | null>(null);

  // User's first name
  const firstName = user?.firstName || '';

  // Smooth step transition
  const goToStep = useCallback((newStep: Step) => {
    setIsTransitioning(true);
    haptic.light();
    setTimeout(() => {
      setStep(newStep);
      setIsTransitioning(false);
    }, 200);
  }, [haptic]);

  // Calculate weeks until event
  const weeksUntilEvent = useMemo(() => {
    if (!eventDate) return null;
    const weeks = Math.ceil(
      (new Date(eventDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)
    );
    return weeks > 0 ? weeks : null;
  }, [eventDate]);

  // Recommended split based on selected days
  const recommendedSplit = useMemo(() => {
    const count = selectedDays.length;
    if (count <= 2) return 'Full Body';
    if (count === 3) return 'Full Body or Push/Pull/Legs';
    if (count === 4) return 'Upper/Lower';
    if (count === 5) return 'Upper/Lower + Full Body';
    return 'Push/Pull/Legs × 2';
  }, [selectedDays]);

  // Progress animation during generation (~30-60 second target)
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        // Fast model: reach 85% in ~30 seconds
        if (prev < 30) return prev + 6;      // 0-30% in 5 seconds
        if (prev < 60) return prev + 4;      // 30-60% in ~8 seconds
        if (prev < 80) return prev + 2;      // 60-80% in ~10 seconds
        if (prev < 90) return prev + 0.5;    // 80-90% slow creep
        return 90;                            // Hold at 90% until complete
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  // Status text during generation
  useEffect(() => {
    if (!isGenerating) return;

    const messages = [
      { at: 0, text: 'Analyzing your goals...' },
      { at: 20, text: 'Selecting exercises...' },
      { at: 40, text: 'Building your week...' },
      { at: 60, text: 'Optimizing recovery...' },
      { at: 80, text: 'Final touches...' },
    ];

    const msg = [...messages].reverse().find(m => generationProgress >= m.at);
    if (msg) setStatusText(msg.text);
  }, [generationProgress, isGenerating]);

  // Generate plan
  const generatePlan = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    try {
      // Map goal to API expected values
      const primaryGoal = path === 'competition' ? 'Athletic Performance' :
        generalGoal === 'muscle' ? 'Aesthetic Physique' :
          generalGoal === 'strength' ? 'Strength & Power' :
            generalGoal === 'fat_loss' ? 'Health & Longevity' :
              'Health & Longevity';

      // Build preferences matching API validator schema
      const apiPayload = {
        preferences: {
          primary_goal: primaryGoal,
          experience_level: experience,
          training_frequency: String(selectedDays.length),
          preferred_session_length: String(sessionLength),
          equipment: 'commercial_gym',
          pain_points: painPoints,
          current_strength: Object.keys(benchmarks).length > 0 ? {
            bench_kg: benchmarks.bench_kg,
            squat_kg: benchmarks.squat_kg,
            deadlift_kg: benchmarks.deadlift_kg,
          } : undefined,
          training_split: {
            sessions_per_day: sessionsPerDay,
            // Map splitType to validator values: strength_only | strength_plus_cardio | combined | cardio_focused
            training_type: sessionsPerDay === '2'
              ? (splitType === 'strength_cardio' ? 'strength_plus_cardio' as const
                : splitType === 'technique_conditioning' ? 'combined' as const
                  : 'strength_only' as const)  // am_pm_same
              : (path === 'competition' ? 'combined' as const : 'strength_only' as const),
          },
          specific_goal: path === 'competition' ? {
            event_type: sport || undefined,
            target_date: eventDate || undefined,
            event_name: eventName || undefined,
          } : undefined,
          sport: path === 'competition' ? sport || undefined : undefined,
          // Personalization fields
          age: age,
          additional_notes: additionalNotes || undefined,
          // NEW: Use silver prompt (expert personas, structured JSON)
          _useSilverPrompt: true,
          // PERFORMANCE: Use fast model (deepseek-chat, ~30 seconds)
          _useFlashModel: true,
        },
        userId: user?.id,
      };

      const plan = await generatePlanAction(apiPayload);

      if (plan) {
        setGeneratedPlan(plan);
        setGenerationProgress(100);

        // Increment usage
        if (user?.id) {
          await incrementPlanUsageMutation({ clerkUserId: user.id });
        }

        // Brief delay then complete
        setTimeout(() => {
          onPlanGenerated(plan);
        }, 1500);
      } else {
        throw new Error('Failed to generate plan');
      }
    } catch (e: any) {
      console.error('Generation error:', e);
      setError(e.message || 'Something went wrong. Please try again.');
      setIsGenerating(false);
    }
  }, [path, sport, eventDate, eventName, generalGoal, experience, selectedDays, sessionLength, sessionsPerDay, splitType, painPoints, benchmarks, age, additionalNotes, generatePlanAction, incrementPlanUsageMutation, user?.id, onPlanGenerated]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: WELCOME
  // ═══════════════════════════════════════════════════════════════════════════

  const renderWelcome = () => (
    <div className="h-[100dvh] flex flex-col" style={{ background: colors.bg }}>
      <div
        className="flex-1 flex flex-col justify-center"
        style={{
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingBottom: spacing.sectionGap,
        }}
      >
        {/* Greeting */}
        <div style={{ marginBottom: 'clamp(32px, 8vw, 48px)' }}>
          {firstName && (
            <p
              className="font-medium"
              style={{
                fontSize: typography.secondary,
                color: colors.textSecondary,
                marginBottom: spacing.elementGap,
              }}
            >
              Hey {firstName}
            </p>
          )}
          <h1
            className="font-bold leading-tight tracking-tight"
            style={{
              fontSize: 'clamp(1.75rem, 6vw + 0.5rem, 2.25rem)',
              color: colors.textPrimary
            }}
          >
            Let's build your{'\n'}training program.
          </h1>
        </div>

        {/* Value props */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.elementGap, marginBottom: 'clamp(32px, 8vw, 48px)' }}>
          {[
            'Personalized to your goals and schedule',
            'Adapts to your experience level',
            'Smart weight recommendations',
          ].map((text, i) => (
            <div key={i} className="flex items-center" style={{ gap: spacing.elementGap }}>
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  width: '1.25em',
                  height: '1.25em',
                  fontSize: typography.body,
                  background: `${colors.accent}20`
                }}
              >
                <svg className="w-[0.75em] h-[0.75em]" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="3">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ fontSize: typography.secondary, color: colors.textSecondary }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
        }}
      >
        <button
          onClick={() => goToStep('path')}
          className="w-full font-semibold active:scale-[0.98] transition-transform"
          style={{
            minHeight: touchTargets.button,
            borderRadius: radius.large,
            fontSize: typography.body,
            background: colors.accent,
            color: '#FFFFFF',
          }}
        >
          Get Started
        </button>
        <p
          className="text-center"
          style={{
            fontSize: typography.small,
            color: colors.textMuted,
            marginTop: spacing.elementGap,
          }}
        >
          Takes about 2 minutes
        </p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PATH SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const renderPath = () => (
    <div className="h-[100dvh] flex flex-col" style={{ background: colors.bg }}>
      {/* Fixed Header - Adaptive */}
      <div
        className="flex-shrink-0"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingBottom: spacing.elementGap,
        }}
      >
        <button
          onClick={() => goToStep('welcome')}
          className="flex items-center active:opacity-70 transition-opacity"
          style={{
            gap: spacing.smallGap,
            marginBottom: spacing.elementGap,
            minHeight: '44px',
          }}
        >
          <svg className="w-[1.25em] h-[1.25em]" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: typography.secondary, color: colors.textSecondary }}>Back</span>
        </button>

        <h1
          className="font-bold leading-tight tracking-tight"
          style={{ fontSize: typography.headline, color: colors.textPrimary }}
        >
          What brings you here?
        </h1>
        <p
          className="leading-relaxed"
          style={{
            fontSize: typography.body,
            color: colors.textSecondary,
            marginTop: spacing.smallGap,
          }}
        >
          This helps us tailor your program.
        </p>
      </div>

      {/* Scrollable Content - Adaptive */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.elementGap,
        }}
      >
        {/* Competition */}
        <button
          onClick={() => {
            setPath('competition');
            haptic.medium();
            goToStep('goal');
          }}
          className="w-full text-left active:scale-[0.98] transition-all border-2"
          style={{
            padding: spacing.sectionGap,
            borderRadius: radius.large,
            background: colors.surface,
            borderColor: path === 'competition' ? colors.accent : colors.border,
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-semibold" style={{ fontSize: typography.body, color: colors.textPrimary }}>
                I have a competition
              </p>
              <p
                className="leading-relaxed"
                style={{ fontSize: typography.secondary, color: colors.textSecondary, marginTop: spacing.smallGap }}
              >
                Hyrox, marathon, powerlifting meet, or other event with a specific date.
              </p>
            </div>
            <div
              className="rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                width: 'clamp(36px, 10vw, 44px)',
                height: 'clamp(36px, 10vw, 44px)',
                marginLeft: spacing.elementGap,
                background: `${colors.accent}15`
              }}
            >
              <span style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}>🏆</span>
            </div>
          </div>
          <div
            style={{
              marginTop: spacing.elementGap,
              paddingTop: spacing.elementGap,
              borderTop: `1px solid ${colors.border}`
            }}
          >
            <p style={{ fontSize: typography.small, color: colors.textMuted }}>
              Includes periodization: Base → Build → Peak → Taper
            </p>
          </div>
        </button>

        {/* General */}
        <button
          onClick={() => {
            setPath('general');
            haptic.medium();
            goToStep('goal');
          }}
          className="w-full text-left active:scale-[0.98] transition-all border-2"
          style={{
            padding: spacing.sectionGap,
            borderRadius: radius.large,
            background: colors.surface,
            borderColor: path === 'general' ? colors.accent : colors.border,
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-semibold" style={{ fontSize: typography.body, color: colors.textPrimary }}>
                I want to get fitter
              </p>
              <p
                className="leading-relaxed"
                style={{ fontSize: typography.secondary, color: colors.textSecondary, marginTop: spacing.smallGap }}
              >
                Build muscle, get stronger, lose fat, or improve overall fitness.
              </p>
            </div>
            <div
              className="rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                width: 'clamp(36px, 10vw, 44px)',
                height: 'clamp(36px, 10vw, 44px)',
                marginLeft: spacing.elementGap,
                background: `${colors.accent}15`
              }}
            >
              <span style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}>💪</span>
            </div>
          </div>
          <div
            style={{
              marginTop: spacing.elementGap,
              paddingTop: spacing.elementGap,
              borderTop: `1px solid ${colors.border}`
            }}
          >
            <p style={{ fontSize: typography.small, color: colors.textMuted }}>
              Progressive program, no deadline pressure
            </p>
          </div>
        </button>

        {/* Spacer for bottom safe area */}
        <div style={{ height: 'max(env(safe-area-inset-bottom), 16px)' }} />
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: GOAL (Competition or General)
  // ═══════════════════════════════════════════════════════════════════════════

  const renderGoal = () => {
    // Shared header component for both paths
    const renderHeader = (title: string) => (
      <div
        className="flex-shrink-0"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingBottom: spacing.elementGap,
        }}
      >
        <button
          onClick={() => goToStep('path')}
          className="flex items-center active:opacity-70 transition-opacity"
          style={{
            gap: spacing.smallGap,
            marginBottom: spacing.elementGap,
            minHeight: '44px',
          }}
        >
          <svg className="w-[1.25em] h-[1.25em]" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: typography.secondary, color: colors.textSecondary }}>Back</span>
        </button>
        <h1
          className="font-bold leading-tight tracking-tight"
          style={{ fontSize: typography.headline, color: colors.textPrimary }}
        >
          {title}
        </h1>
      </div>
    );

    // Shared footer component for both paths
    const renderFooter = (isEnabled: boolean, onClick: () => void) => (
      <div
        className="flex-shrink-0"
        style={{
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingTop: spacing.elementGap,
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          background: colors.bg,
        }}
      >
        <button
          onClick={onClick}
          disabled={!isEnabled}
          className="w-full font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
          style={{
            minHeight: touchTargets.button,
            borderRadius: radius.large,
            fontSize: typography.body,
            background: isEnabled ? colors.accent : colors.surface,
            color: isEnabled ? '#FFFFFF' : colors.textMuted,
          }}
        >
          Continue
        </button>
      </div>
    );

    if (path === 'competition') {
      return (
        <div className="h-[100dvh] flex flex-col" style={{ background: colors.bg }}>
          {renderHeader("What's your event?")}

          {/* Scrollable Content */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ paddingLeft: spacing.pagePadding, paddingRight: spacing.pagePadding }}
          >
            <div className="grid grid-cols-2" style={{ gap: spacing.elementGap, marginBottom: spacing.sectionGap }}>
              {SPORTS.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSport(s.id);
                    haptic.light();
                  }}
                  className="text-left active:scale-[0.97] transition-all border-2"
                  style={{
                    padding: spacing.elementGap,
                    borderRadius: radius.standard,
                    background: sport === s.id ? `${colors.accent}15` : colors.surface,
                    borderColor: sport === s.id ? colors.accent : colors.border,
                  }}
                >
                  <p
                    className="font-semibold"
                    style={{ fontSize: typography.secondary, color: sport === s.id ? colors.accent : colors.textPrimary }}
                  >
                    {s.name}
                  </p>
                  <p style={{ fontSize: typography.small, color: colors.textMuted, marginTop: spacing.smallGap }}>
                    {s.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* Event date */}
            {sport && (
              <div style={{ marginBottom: spacing.sectionGap }}>
                <label
                  className="block font-medium"
                  style={{ fontSize: typography.secondary, color: colors.textPrimary, marginBottom: spacing.smallGap }}
                >
                  When is your event?
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border-2 outline-none"
                  style={{
                    minHeight: touchTargets.button,
                    padding: `0 ${spacing.elementGap}`,
                    borderRadius: radius.standard,
                    fontSize: typography.body,
                    background: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  }}
                />
                {weeksUntilEvent && (
                  <p style={{ fontSize: typography.small, color: colors.accent, marginTop: spacing.smallGap }}>
                    {weeksUntilEvent} weeks out — perfect for periodized training
                  </p>
                )}
              </div>
            )}

            {/* Event name (optional) */}
            {eventDate && (
              <div style={{ marginBottom: spacing.sectionGap }}>
                <label
                  className="block font-medium"
                  style={{ fontSize: typography.secondary, color: colors.textPrimary, marginBottom: spacing.smallGap }}
                >
                  Event name <span style={{ color: colors.textMuted }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g., Berlin Hyrox 2025"
                  className="w-full border-2 outline-none placeholder:text-[#4A4A4A]"
                  style={{
                    minHeight: touchTargets.button,
                    padding: `0 ${spacing.elementGap}`,
                    borderRadius: radius.standard,
                    fontSize: typography.body,
                    background: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  }}
                />
              </div>
            )}

            {/* Spacer for bottom button */}
            <div style={{ height: touchTargets.large }} />
          </div>

          {renderFooter(!!(sport && eventDate), () => goToStep('schedule'))}
        </div>
      );
    }

    // General path
    return (
      <div className="h-[100dvh] flex flex-col" style={{ background: colors.bg }}>
        {renderHeader("What's your main goal?")}

        {/* Scrollable Content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            paddingLeft: spacing.pagePadding,
            paddingRight: spacing.pagePadding,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.elementGap,
          }}
        >
          {GENERAL_GOALS.map(g => (
            <button
              key={g.id}
              onClick={() => {
                setGeneralGoal(g.id);
                haptic.light();
              }}
              className="w-full text-left active:scale-[0.98] transition-all border-2"
              style={{
                padding: spacing.elementGap,
                borderRadius: radius.standard,
                background: generalGoal === g.id ? `${colors.accent}10` : colors.surface,
                borderColor: generalGoal === g.id ? colors.accent : colors.border,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="font-semibold"
                    style={{ fontSize: typography.body, color: generalGoal === g.id ? colors.accent : colors.textPrimary }}
                  >
                    {g.title}
                  </p>
                  <p style={{ fontSize: typography.secondary, color: colors.textSecondary, marginTop: '2px' }}>
                    {g.desc}
                  </p>
                </div>
                {generalGoal === g.id && (
                  <div
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ width: '1.5em', height: '1.5em', background: colors.accent, fontSize: typography.body }}
                  >
                    <svg className="w-[0.875em] h-[0.875em] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
              {generalGoal === g.id && (
                <p
                  style={{
                    fontSize: typography.small,
                    color: colors.textMuted,
                    marginTop: spacing.elementGap,
                    paddingTop: spacing.elementGap,
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  {g.detail}
                </p>
              )}
            </button>
          ))}

          {/* Spacer for bottom button */}
          <div style={{ height: touchTargets.large }} />
        </div>

        {renderFooter(!!generalGoal, () => goToStep('schedule'))}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: SCHEDULE
  // ═══════════════════════════════════════════════════════════════════════════

  const renderSchedule = () => (
    <div className="h-[100dvh] flex flex-col" style={{ background: colors.bg }}>
      {/* Fixed Header - Adaptive padding */}
      <div
        className="flex-shrink-0"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingBottom: spacing.elementGap,
        }}
      >
        <button
          onClick={() => goToStep('goal')}
          className="flex items-center active:opacity-70 transition-opacity"
          style={{
            gap: spacing.smallGap,
            marginBottom: spacing.elementGap,
            minHeight: '44px', // Apple HIG minimum
          }}
        >
          <svg className="w-[1.25em] h-[1.25em]" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: typography.secondary, color: colors.textSecondary }}>Back</span>
        </button>

        <h1
          className="font-bold leading-tight tracking-tight"
          style={{ fontSize: typography.headline, color: colors.textPrimary }}
        >
          When can you train?
        </h1>
        <p
          style={{
            fontSize: typography.body,
            color: colors.textSecondary,
            marginTop: spacing.smallGap,
          }}
        >
          Tap the days you're available.
        </p>
      </div>

      {/* Scrollable Content - Adaptive padding */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingLeft: spacing.pagePadding, paddingRight: spacing.pagePadding }}
      >
        {/* Days - Adaptive grid */}
        <div style={{ marginBottom: spacing.sectionGap }}>
          <div className="grid grid-cols-7" style={{ gap: spacing.smallGap }}>
            {DAYS.map((day, idx) => {
              const isSelected = selectedDays.includes(idx);
              return (
                <button
                  key={day}
                  onClick={() => {
                    haptic.light();
                    setSelectedDays(prev =>
                      isSelected
                        ? prev.filter(d => d !== idx)
                        : [...prev, idx].sort()
                    );
                  }}
                  className="aspect-square flex flex-col items-center justify-center active:scale-95 transition-all border-2"
                  style={{
                    minHeight: touchTargets.compact,
                    borderRadius: radius.standard,
                    background: isSelected ? colors.accent : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                  }}
                >
                  <span
                    className="font-semibold"
                    style={{
                      fontSize: typography.small,
                      color: isSelected ? '#FFFFFF' : colors.textPrimary
                    }}
                  >
                    {day}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Summary - Adaptive padding */}
          <div
            style={{
              marginTop: spacing.elementGap,
              padding: spacing.elementGap,
              borderRadius: radius.standard,
              background: colors.surface,
            }}
          >
            <div className="flex justify-between items-center">
              <span style={{ fontSize: typography.secondary, color: colors.textSecondary }}>
                Training days
              </span>
              <span className="font-semibold" style={{ fontSize: typography.secondary, color: colors.textPrimary }}>
                {selectedDays.length} per week
              </span>
            </div>
            <div
              style={{
                marginTop: spacing.smallGap,
                paddingTop: spacing.smallGap,
                borderTop: `1px solid ${colors.border}`
              }}
            >
              <span style={{ fontSize: typography.small, color: colors.textMuted }}>
                Recommended: {recommendedSplit}
              </span>
            </div>
          </div>
        </div>

        {/* Session length - Adaptive layout */}
        <div style={{ marginBottom: spacing.sectionGap }}>
          <label
            className="block font-medium"
            style={{
              fontSize: typography.secondary,
              color: colors.textPrimary,
              marginBottom: spacing.smallGap,
            }}
          >
            How long per session?
          </label>
          <div className="grid grid-cols-5" style={{ gap: spacing.smallGap }}>
            {[30, 45, 60, 75, 90].map(mins => (
              <button
                key={mins}
                onClick={() => {
                  haptic.light();
                  setSessionLength(mins);
                }}
                className="font-medium active:scale-95 transition-all border-2"
                style={{
                  minHeight: touchTargets.compact,
                  borderRadius: radius.standard,
                  fontSize: typography.secondary,
                  background: sessionLength === mins ? colors.accent : colors.surface,
                  borderColor: sessionLength === mins ? colors.accent : colors.border,
                  color: sessionLength === mins ? '#FFFFFF' : colors.textPrimary,
                }}
              >
                {mins}
              </button>
            ))}
          </div>
          <p
            className="text-center"
            style={{
              fontSize: typography.small,
              color: colors.textMuted,
              marginTop: spacing.smallGap,
            }}
          >
            minutes
          </p>
        </div>

        {/* 2-a-day option for competition prep */}
        {path === 'competition' && (
          <div style={{ marginBottom: spacing.sectionGap }}>
            <label
              className="block font-medium"
              style={{
                fontSize: typography.secondary,
                color: colors.textPrimary,
                marginBottom: spacing.smallGap,
              }}
            >
              Sessions per day
            </label>
            <div className="grid grid-cols-2" style={{ gap: spacing.elementGap }}>
              <button
                onClick={() => {
                  haptic.light();
                  setSessionsPerDay('1');
                }}
                className="flex flex-col items-center justify-center active:scale-[0.98] transition-all border-2"
                style={{
                  minHeight: touchTargets.button,
                  borderRadius: radius.standard,
                  background: sessionsPerDay === '1' ? colors.accent : colors.surface,
                  borderColor: sessionsPerDay === '1' ? colors.accent : colors.border,
                }}
              >
                <span
                  className="font-semibold"
                  style={{
                    fontSize: typography.secondary,
                    color: sessionsPerDay === '1' ? '#FFFFFF' : colors.textPrimary
                  }}
                >
                  1 session
                </span>
                <span
                  style={{
                    fontSize: typography.small,
                    marginTop: '2px',
                    color: sessionsPerDay === '1' ? 'rgba(255,255,255,0.7)' : colors.textMuted
                  }}
                >
                  Standard
                </span>
              </button>
              <button
                onClick={() => {
                  haptic.light();
                  setSessionsPerDay('2');
                }}
                className="flex flex-col items-center justify-center active:scale-[0.98] transition-all border-2"
                style={{
                  minHeight: touchTargets.button,
                  borderRadius: radius.standard,
                  background: sessionsPerDay === '2' ? colors.accent : colors.surface,
                  borderColor: sessionsPerDay === '2' ? colors.accent : colors.border,
                }}
              >
                <span
                  className="font-semibold"
                  style={{
                    fontSize: typography.secondary,
                    color: sessionsPerDay === '2' ? '#FFFFFF' : colors.textPrimary
                  }}
                >
                  2 sessions
                </span>
                <span
                  style={{
                    fontSize: typography.small,
                    marginTop: '2px',
                    color: sessionsPerDay === '2' ? 'rgba(255,255,255,0.7)' : colors.textMuted
                  }}
                >
                  AM/PM split
                </span>
              </button>
            </div>

            {/* Split type selector - only show when 2 sessions selected */}
            {sessionsPerDay === '2' && (
              <div style={{ marginTop: spacing.elementGap }}>
                <label
                  className="block font-medium"
                  style={{
                    fontSize: typography.secondary,
                    color: colors.textSecondary,
                    marginBottom: spacing.smallGap,
                  }}
                >
                  What type of split?
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.smallGap }}>
                  {[
                    { id: 'strength_cardio', title: 'Strength + Cardio', desc: 'AM: Weights • PM: Running/Cardio' },
                    { id: 'technique_conditioning', title: 'Skill + Conditioning', desc: 'AM: Sport technique • PM: Fitness work' },
                    { id: 'am_pm_same', title: 'Double Sessions', desc: 'AM & PM: Both full training' },
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        haptic.light();
                        setSplitType(option.id as typeof splitType);
                      }}
                      className="w-full text-left active:scale-[0.98] transition-all border-2"
                      style={{
                        padding: spacing.elementGap,
                        borderRadius: radius.standard,
                        background: splitType === option.id ? `${colors.accent}15` : colors.surface,
                        borderColor: splitType === option.id ? colors.accent : colors.border,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span
                            className="font-semibold block"
                            style={{
                              fontSize: typography.secondary,
                              color: splitType === option.id ? colors.accent : colors.textPrimary
                            }}
                          >
                            {option.title}
                          </span>
                          <span style={{ fontSize: typography.small, color: colors.textMuted }}>
                            {option.desc}
                          </span>
                        </div>
                        {splitType === option.id && (
                          <div
                            className="flex items-center justify-center rounded-full"
                            style={{
                              width: '1.25em',
                              height: '1.25em',
                              background: colors.accent,
                              fontSize: typography.body,
                            }}
                          >
                            <svg className="w-[0.75em] h-[0.75em] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Experience - Adaptive layout */}
        <div style={{ marginBottom: spacing.sectionGap }}>
          <label
            className="block font-medium"
            style={{
              fontSize: typography.secondary,
              color: colors.textPrimary,
              marginBottom: spacing.smallGap,
            }}
          >
            Experience level
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.smallGap }}>
            {(['beginner', 'intermediate', 'advanced'] as Experience[]).map(exp => (
              <button
                key={exp}
                onClick={() => {
                  haptic.light();
                  setExperience(exp);
                }}
                className="w-full text-left flex items-center justify-between active:scale-[0.98] transition-all border-2"
                style={{
                  minHeight: touchTargets.compact,
                  padding: `0 ${spacing.elementGap}`,
                  borderRadius: radius.standard,
                  background: experience === exp ? `${colors.accent}15` : colors.surface,
                  borderColor: experience === exp ? colors.accent : colors.border,
                }}
              >
                <span
                  className="font-medium capitalize"
                  style={{
                    fontSize: typography.secondary,
                    color: experience === exp ? colors.accent : colors.textPrimary
                  }}
                >
                  {exp}
                </span>
                {experience === exp && (
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: '1.25em',
                      height: '1.25em',
                      background: colors.accent,
                      fontSize: typography.body,
                    }}
                  >
                    <svg className="w-[0.75em] h-[0.75em] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Spacer for bottom button - Adaptive */}
        <div style={{ height: touchTargets.large }} />
      </div>

      {/* Fixed Continue Button - Adaptive */}
      <div
        className="flex-shrink-0"
        style={{
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingTop: spacing.elementGap,
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          background: colors.bg,
        }}
      >
        <button
          onClick={() => goToStep('body')}
          disabled={selectedDays.length === 0}
          className="w-full font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
          style={{
            minHeight: touchTargets.button,
            borderRadius: radius.large,
            fontSize: typography.body,
            background: selectedDays.length > 0 ? colors.accent : colors.surface,
            color: selectedDays.length > 0 ? '#FFFFFF' : colors.textMuted,
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: BODY (Pain points)
  // ═══════════════════════════════════════════════════════════════════════════

  const renderBody = () => (
    <div className="h-[100dvh] flex flex-col" style={{ background: colors.bg }}>
      {/* Fixed Header - Adaptive */}
      <div
        className="flex-shrink-0"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingBottom: spacing.elementGap,
        }}
      >
        <button
          onClick={() => goToStep('schedule')}
          className="flex items-center active:opacity-70 transition-opacity"
          style={{
            gap: spacing.smallGap,
            marginBottom: spacing.elementGap,
            minHeight: '44px',
          }}
        >
          <svg className="w-[1.25em] h-[1.25em]" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: typography.secondary, color: colors.textSecondary }}>Back</span>
        </button>

        <h1
          className="font-bold leading-tight tracking-tight"
          style={{ fontSize: typography.headline, color: colors.textPrimary }}
        >
          Any areas to protect?
        </h1>
        <p style={{ fontSize: typography.body, color: colors.textSecondary, marginTop: spacing.smallGap }}>
          We'll avoid exercises that stress these areas.
        </p>
      </div>

      {/* Scrollable Content - Adaptive */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingLeft: spacing.pagePadding, paddingRight: spacing.pagePadding }}
      >
        <div className="grid grid-cols-2" style={{ gap: spacing.elementGap }}>
          {BODY_AREAS.map(area => {
            const isSelected = painPoints.includes(area.id);
            return (
              <button
                key={area.id}
                onClick={() => {
                  haptic.light();
                  setPainPoints(prev =>
                    isSelected
                      ? prev.filter(p => p !== area.id)
                      : [...prev, area.id]
                  );
                }}
                className="flex items-center justify-between active:scale-[0.97] transition-all border-2"
                style={{
                  minHeight: touchTargets.button,
                  padding: `0 ${spacing.elementGap}`,
                  borderRadius: radius.standard,
                  background: isSelected ? `${colors.accent}15` : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                }}
              >
                <span className="font-medium" style={{ fontSize: typography.secondary, color: isSelected ? colors.accent : colors.textPrimary }}>
                  {area.label}
                </span>
                {isSelected && (
                  <svg className="w-[1.25em] h-[1.25em]" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {painPoints.length === 0 && (
          <p className="text-center" style={{ fontSize: typography.secondary, color: colors.textMuted, marginTop: spacing.sectionGap }}>
            None selected — all exercises available
          </p>
        )}

        {painPoints.length > 0 && (
          <div
            style={{
              marginTop: spacing.sectionGap,
              padding: spacing.elementGap,
              borderRadius: radius.standard,
              background: colors.surface,
            }}
          >
            <p style={{ fontSize: typography.small, color: colors.textMuted }}>
              We'll modify or substitute exercises for: {painPoints.map(p =>
                BODY_AREAS.find(a => a.id === p)?.label
              ).join(', ')}
            </p>
          </div>
        )}

        {/* Spacer for bottom button */}
        <div style={{ height: touchTargets.large }} />
      </div>

      {/* Fixed Continue Button - Adaptive */}
      <div
        className="flex-shrink-0"
        style={{
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingTop: spacing.elementGap,
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          background: colors.bg,
        }}
      >
        <button
          onClick={() => goToStep('strength')}
          className="w-full font-semibold active:scale-[0.98] transition-all"
          style={{
            minHeight: touchTargets.button,
            borderRadius: radius.large,
            fontSize: typography.body,
            background: colors.accent,
            color: '#FFFFFF',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: STRENGTH (Benchmarks)
  // ═══════════════════════════════════════════════════════════════════════════

  const renderStrength = () => {
    const filledCount = Object.values(benchmarks).filter((v): v is number => typeof v === 'number' && v > 0).length;

    return (
      <div className="h-[100dvh] flex flex-col" style={{ background: colors.bg }}>
        {/* Fixed Header - Adaptive */}
        <div
          className="flex-shrink-0"
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 12px)',
            paddingLeft: spacing.pagePadding,
            paddingRight: spacing.pagePadding,
            paddingBottom: spacing.elementGap,
          }}
        >
          <button
            onClick={() => goToStep('body')}
            className="flex items-center active:opacity-70 transition-opacity"
            style={{
              gap: spacing.smallGap,
              marginBottom: spacing.elementGap,
              minHeight: '44px',
            }}
          >
            <svg className="w-[1.25em] h-[1.25em]" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: typography.secondary, color: colors.textSecondary }}>Back</span>
          </button>

          <h1
            className="font-bold leading-tight tracking-tight"
            style={{ fontSize: typography.headline, color: colors.textPrimary }}
          >
            Current strength
          </h1>
          <p style={{ fontSize: typography.body, color: colors.textSecondary, marginTop: spacing.smallGap }}>
            Optional — helps us set accurate starting weights.
          </p>
        </div>

        {/* Scrollable Content - Adaptive */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ paddingLeft: spacing.pagePadding, paddingRight: spacing.pagePadding }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.elementGap }}>
            {BENCHMARKS.map(b => (
              <div key={b.id}>
                <label
                  className="block font-medium"
                  style={{ fontSize: typography.secondary, color: colors.textPrimary, marginBottom: spacing.smallGap }}
                >
                  {b.name}
                </label>
                <div className="flex items-center" style={{ gap: spacing.elementGap }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={benchmarks[b.id] || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setBenchmarks(prev => ({ ...prev, [b.id]: val }));
                    }}
                    placeholder={b.placeholder}
                    className="flex-1 border-2 outline-none placeholder:opacity-30"
                    style={{
                      minHeight: touchTargets.button,
                      padding: `0 ${spacing.elementGap}`,
                      borderRadius: radius.standard,
                      fontSize: typography.body,
                      background: colors.surface,
                      borderColor: benchmarks[b.id] ? colors.accent : colors.border,
                      color: colors.textPrimary,
                    }}
                  />
                  <span className="font-medium" style={{ fontSize: typography.secondary, color: colors.textMuted, width: '2em' }}>
                    kg
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center" style={{ fontSize: typography.small, color: colors.textMuted, marginTop: spacing.sectionGap }}>
            {filledCount === 0
              ? "Skip this — we'll start conservative"
              : `${filledCount} of ${BENCHMARKS.length} provided`}
          </p>

          {/* Spacer for bottom button */}
          <div style={{ height: 'clamp(80px, 20vw, 100px)' }} />
        </div>

        {/* Fixed Continue Button - Adaptive */}
        <div
          className="flex-shrink-0"
          style={{
            paddingLeft: spacing.pagePadding,
            paddingRight: spacing.pagePadding,
            paddingTop: spacing.elementGap,
            paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
            background: colors.bg,
          }}
        >
          <button
            onClick={() => goToStep('final')}
            className="w-full font-semibold active:scale-[0.98] transition-all"
            style={{
              minHeight: touchTargets.button,
              borderRadius: radius.large,
              fontSize: typography.body,
              background: colors.accent,
              color: '#FFFFFF',
            }}
          >
            Continue
          </button>
          {filledCount === 0 && (
            <button
              onClick={() => goToStep('final')}
              className="w-full font-medium active:opacity-70 transition-opacity"
              style={{
                minHeight: touchTargets.compact,
                marginTop: spacing.smallGap,
                fontSize: typography.secondary,
                color: colors.textSecondary,
              }}
            >
              Skip — let AI estimate
            </button>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: FINAL (Age + Additional Notes)
  // ═══════════════════════════════════════════════════════════════════════════

  const renderFinal = () => (
    <div className="h-[100dvh] flex flex-col" style={{ background: colors.bg }}>
      {/* Fixed Header - Adaptive */}
      <div
        className="flex-shrink-0"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingBottom: spacing.elementGap,
        }}
      >
        <button
          onClick={() => goToStep('strength')}
          className="flex items-center active:opacity-70 transition-opacity"
          style={{
            gap: spacing.smallGap,
            marginBottom: spacing.elementGap,
            minHeight: '44px',
          }}
        >
          <svg className="w-[1.25em] h-[1.25em]" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: typography.secondary, color: colors.textSecondary }}>Back</span>
        </button>

        <h1
          className="font-bold leading-tight tracking-tight"
          style={{ fontSize: typography.headline, color: colors.textPrimary }}
        >
          Final touches
        </h1>
        <p style={{ fontSize: typography.body, color: colors.textSecondary, marginTop: spacing.smallGap }}>
          Optional — make your plan even more personal.
        </p>
      </div>

      {/* Scrollable Content - Adaptive */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.sectionGap,
        }}
      >
        {/* Age */}
        <div>
          <label
            className="block font-medium"
            style={{ fontSize: typography.secondary, color: colors.textPrimary, marginBottom: spacing.smallGap }}
          >
            Your age
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={age || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setAge(val > 0 && val < 120 ? val : undefined);
            }}
            placeholder="e.g. 28"
            className="w-full border-2 outline-none placeholder:opacity-30"
            style={{
              minHeight: touchTargets.button,
              padding: `0 ${spacing.elementGap}`,
              borderRadius: radius.standard,
              fontSize: typography.body,
              background: colors.surface,
              borderColor: age ? colors.accent : colors.border,
              color: colors.textPrimary,
            }}
          />
          <p style={{ fontSize: typography.small, color: colors.textMuted, marginTop: spacing.smallGap }}>
            Helps us adjust recovery time and exercise selection.
          </p>
        </div>

        {/* Additional Notes */}
        <div>
          <label
            className="block font-medium"
            style={{ fontSize: typography.secondary, color: colors.textPrimary, marginBottom: spacing.smallGap }}
          >
            Anything else?
          </label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Tell us about specific exercises you love, equipment you have access to, things you want to focus on, or any other details that would help personalize your plan..."
            rows={5}
            className="w-full border-2 outline-none placeholder:opacity-40 resize-none"
            style={{
              padding: spacing.elementGap,
              borderRadius: radius.standard,
              fontSize: typography.body,
              background: colors.surface,
              borderColor: additionalNotes ? colors.accent : colors.border,
              color: colors.textPrimary,
              lineHeight: 1.5,
            }}
          />
          <p style={{ fontSize: typography.small, color: colors.textMuted, marginTop: spacing.smallGap }}>
            Examples: "I love sled work", "No barbells at my gym", "Focus on explosiveness"
          </p>
        </div>

        {/* Spacer for bottom button */}
        <div style={{ height: 'clamp(80px, 20vw, 100px)' }} />
      </div>

      {/* Fixed Generate Button - Adaptive */}
      <div
        className="flex-shrink-0"
        style={{
          paddingLeft: spacing.pagePadding,
          paddingRight: spacing.pagePadding,
          paddingTop: spacing.elementGap,
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          background: colors.bg,
        }}
      >
        <button
          onClick={() => {
            goToStep('generating');
            setTimeout(generatePlan, 300);
          }}
          className="w-full font-semibold active:scale-[0.98] transition-all"
          style={{
            minHeight: touchTargets.button,
            borderRadius: radius.large,
            fontSize: typography.body,
            background: colors.accent,
            color: '#FFFFFF',
          }}
        >
          Generate My Plan
        </button>
        <button
          onClick={() => {
            goToStep('generating');
            setTimeout(generatePlan, 300);
          }}
          className="w-full font-medium active:opacity-70 transition-opacity"
          style={{
            minHeight: touchTargets.compact,
            marginTop: spacing.smallGap,
            fontSize: typography.secondary,
            color: colors.textSecondary,
          }}
        >
          Skip — generate now
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: GENERATING
  // ═══════════════════════════════════════════════════════════════════════════

  const renderGenerating = () => {
    if (error) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center px-6"
          style={{ background: colors.bg }}
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl border"
            style={{ background: colors.surface, borderColor: '#DC2626' }}
          >
            <h3
              className="text-[17px] font-semibold mb-2"
              style={{ color: '#EF4444' }}
            >
              Something went wrong
            </h3>
            <p
              className="text-[15px] mb-4"
              style={{ color: colors.textSecondary }}
            >
              {error}
            </p>
            <button
              onClick={() => {
                setError(null);
                setIsGenerating(false);
                generatePlan();
              }}
              className="w-full h-12 rounded-xl font-semibold text-[15px]"
              style={{ background: colors.accent, color: '#FFFFFF' }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    const buildingPreferences = {
      currentStrength: Object.keys(benchmarks).length > 0 ? benchmarks : undefined,
      specificGoal: path === 'competition' ? {
        target_date: eventDate,
        event_type: sport,
      } : undefined,
      sport: sport || undefined,
      painPoints: painPoints.length > 0 ? painPoints : undefined,
      primary_goal: path === 'competition' ? 'Athletic Performance' : generalGoal || undefined,
      training_split: { training_type: 'combined' },
    };

    return (
      <PlanBuildingScreen
        preferences={buildingPreferences}
        progress={generationProgress}
        statusText={statusText}
      />
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className={cn(
        'transition-opacity duration-200',
        isTransitioning ? 'opacity-0' : 'opacity-100'
      )}
    >
      {step === 'welcome' && renderWelcome()}
      {step === 'path' && renderPath()}
      {step === 'goal' && renderGoal()}
      {step === 'schedule' && renderSchedule()}
      {step === 'body' && renderBody()}
      {step === 'strength' && renderStrength()}
      {step === 'final' && renderFinal()}
      {step === 'generating' && renderGenerating()}
    </div>
  );
}
