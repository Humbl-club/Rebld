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

      const result = await generatePlanAction(apiPayload);

      if (result.success && result.plan) {
        setGeneratedPlan(result.plan);
        setGenerationProgress(100);

        // Increment usage
        if (user?.id) {
          await incrementPlanUsageMutation({ clerkUserId: user.id });
        }

        // Brief delay then complete
        setTimeout(() => {
          onPlanGenerated(result.plan);
        }, 1500);
      } else {
        throw new Error(result.error || 'Failed to generate plan');
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
    <div className="min-h-screen flex flex-col" style={{ background: colors.bg }}>
      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        {/* Greeting */}
        <div className="mb-12">
          {firstName && (
            <p
              className="text-[15px] font-medium mb-3"
              style={{ color: colors.textSecondary }}
            >
              Hey {firstName}
            </p>
          )}
          <h1
            className="text-[32px] font-bold leading-[1.2] tracking-tight"
            style={{ color: colors.textPrimary }}
          >
            Let's build your{'\n'}training program.
          </h1>
        </div>

        {/* Value props */}
        <div className="space-y-4 mb-12">
          {[
            'Personalized to your goals and schedule',
            'Adapts to your experience level',
            'Smart weight recommendations',
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: `${colors.accent}20` }}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="3">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-[15px]" style={{ color: colors.textSecondary }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <button
          onClick={() => goToStep('path')}
          className="w-full h-14 rounded-2xl font-semibold text-[17px] active:scale-[0.98] transition-transform"
          style={{ background: colors.accent, color: '#FFFFFF' }}
        >
          Get Started
        </button>
        <p
          className="text-center text-[13px] mt-4"
          style={{ color: colors.textMuted }}
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
    <div className="min-h-screen flex flex-col" style={{ background: colors.bg }}>
      {/* Header */}
      <div className="pt-[max(60px,env(safe-area-inset-top))] px-6 pb-6">
        <button
          onClick={() => goToStep('welcome')}
          className="flex items-center gap-2 mb-6"
          style={{ color: colors.textSecondary }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[15px]">Back</span>
        </button>

        <h1
          className="text-[28px] font-bold leading-[1.2] tracking-tight"
          style={{ color: colors.textPrimary }}
        >
          What brings you here?
        </h1>
        <p
          className="text-[17px] mt-2 leading-relaxed"
          style={{ color: colors.textSecondary }}
        >
          This helps us tailor your program.
        </p>
      </div>

      {/* Options */}
      <div className="flex-1 px-6 space-y-4">
        {/* Competition */}
        <button
          onClick={() => {
            setPath('competition');
            haptic.medium();
            goToStep('goal');
          }}
          className="w-full p-5 rounded-2xl text-left active:scale-[0.98] transition-all border-2"
          style={{
            background: colors.surface,
            borderColor: path === 'competition' ? colors.accent : colors.border,
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p
                className="text-[17px] font-semibold"
                style={{ color: colors.textPrimary }}
              >
                I have a competition
              </p>
              <p
                className="text-[15px] mt-1 leading-relaxed"
                style={{ color: colors.textSecondary }}
              >
                Hyrox, marathon, powerlifting meet, or other event with a specific date.
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center ml-4"
              style={{ background: `${colors.accent}15` }}
            >
              <span className="text-xl">🏆</span>
            </div>
          </div>
          <div
            className="mt-4 pt-4 border-t"
            style={{ borderColor: colors.border }}
          >
            <p className="text-[13px]" style={{ color: colors.textMuted }}>
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
          className="w-full p-5 rounded-2xl text-left active:scale-[0.98] transition-all border-2"
          style={{
            background: colors.surface,
            borderColor: path === 'general' ? colors.accent : colors.border,
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p
                className="text-[17px] font-semibold"
                style={{ color: colors.textPrimary }}
              >
                I want to get fitter
              </p>
              <p
                className="text-[15px] mt-1 leading-relaxed"
                style={{ color: colors.textSecondary }}
              >
                Build muscle, get stronger, lose fat, or improve overall fitness.
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center ml-4"
              style={{ background: `${colors.accent}15` }}
            >
              <span className="text-xl">💪</span>
            </div>
          </div>
          <div
            className="mt-4 pt-4 border-t"
            style={{ borderColor: colors.border }}
          >
            <p className="text-[13px]" style={{ color: colors.textMuted }}>
              Progressive program, no deadline pressure
            </p>
          </div>
        </button>
      </div>

      <div className="h-[max(24px,env(safe-area-inset-bottom))]" />
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: GOAL (Competition or General)
  // ═══════════════════════════════════════════════════════════════════════════

  const renderGoal = () => {
    if (path === 'competition') {
      return (
        <div className="min-h-screen flex flex-col" style={{ background: colors.bg }}>
          {/* Header */}
          <div className="pt-[max(60px,env(safe-area-inset-top))] px-6 pb-6">
            <button
              onClick={() => goToStep('path')}
              className="flex items-center gap-2 mb-6"
              style={{ color: colors.textSecondary }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[15px]">Back</span>
            </button>

            <h1
              className="text-[28px] font-bold leading-[1.2] tracking-tight"
              style={{ color: colors.textPrimary }}
            >
              What's your event?
            </h1>
          </div>

          {/* Sport selection */}
          <div className="flex-1 px-6 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 mb-6">
              {SPORTS.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSport(s.id);
                    haptic.light();
                  }}
                  className="p-4 rounded-xl text-left active:scale-[0.97] transition-all border-2"
                  style={{
                    background: sport === s.id ? `${colors.accent}15` : colors.surface,
                    borderColor: sport === s.id ? colors.accent : colors.border,
                  }}
                >
                  <p
                    className="text-[15px] font-semibold"
                    style={{ color: sport === s.id ? colors.accent : colors.textPrimary }}
                  >
                    {s.name}
                  </p>
                  <p
                    className="text-[13px] mt-1"
                    style={{ color: colors.textMuted }}
                  >
                    {s.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* Event date */}
            {sport && (
              <div className="mb-6">
                <label
                  className="block text-[15px] font-medium mb-2"
                  style={{ color: colors.textPrimary }}
                >
                  When is your event?
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-14 px-4 rounded-xl text-[17px] border-2 outline-none"
                  style={{
                    background: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  }}
                />
                {weeksUntilEvent && (
                  <p
                    className="text-[13px] mt-2"
                    style={{ color: colors.accent }}
                  >
                    {weeksUntilEvent} weeks out — perfect for periodized training
                  </p>
                )}
              </div>
            )}

            {/* Event name (optional) */}
            {eventDate && (
              <div className="mb-6">
                <label
                  className="block text-[15px] font-medium mb-2"
                  style={{ color: colors.textPrimary }}
                >
                  Event name <span style={{ color: colors.textMuted }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g., Berlin Hyrox 2025"
                  className="w-full h-14 px-4 rounded-xl text-[17px] border-2 outline-none placeholder:text-[#4A4A4A]"
                  style={{
                    background: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  }}
                />
              </div>
            )}
          </div>

          {/* Continue */}
          <div className="px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
            <button
              onClick={() => goToStep('schedule')}
              disabled={!sport || !eventDate}
              className="w-full h-14 rounded-2xl font-semibold text-[17px] active:scale-[0.98] transition-all disabled:opacity-40"
              style={{
                background: sport && eventDate ? colors.accent : colors.surface,
                color: sport && eventDate ? '#FFFFFF' : colors.textMuted,
              }}
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    // General path
    return (
      <div className="min-h-screen flex flex-col" style={{ background: colors.bg }}>
        {/* Header */}
        <div className="pt-[max(60px,env(safe-area-inset-top))] px-6 pb-6">
          <button
            onClick={() => goToStep('path')}
            className="flex items-center gap-2 mb-6"
            style={{ color: colors.textSecondary }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[15px]">Back</span>
          </button>

          <h1
            className="text-[28px] font-bold leading-[1.2] tracking-tight"
            style={{ color: colors.textPrimary }}
          >
            What's your main goal?
          </h1>
        </div>

        {/* Goals */}
        <div className="flex-1 px-6 space-y-3">
          {GENERAL_GOALS.map(g => (
            <button
              key={g.id}
              onClick={() => {
                setGeneralGoal(g.id);
                haptic.light();
              }}
              className="w-full p-4 rounded-xl text-left active:scale-[0.98] transition-all border-2"
              style={{
                background: generalGoal === g.id ? `${colors.accent}10` : colors.surface,
                borderColor: generalGoal === g.id ? colors.accent : colors.border,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-[17px] font-semibold"
                    style={{ color: generalGoal === g.id ? colors.accent : colors.textPrimary }}
                  >
                    {g.title}
                  </p>
                  <p
                    className="text-[15px] mt-0.5"
                    style={{ color: colors.textSecondary }}
                  >
                    {g.desc}
                  </p>
                </div>
                {generalGoal === g.id && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: colors.accent }}
                  >
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
              {generalGoal === g.id && (
                <p
                  className="text-[13px] mt-3 pt-3 border-t"
                  style={{ color: colors.textMuted, borderColor: colors.border }}
                >
                  {g.detail}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Continue */}
        <div className="px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
          <button
            onClick={() => goToStep('schedule')}
            disabled={!generalGoal}
            className="w-full h-14 rounded-2xl font-semibold text-[17px] active:scale-[0.98] transition-all disabled:opacity-40"
            style={{
              background: generalGoal ? colors.accent : colors.surface,
              color: generalGoal ? '#FFFFFF' : colors.textMuted,
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: SCHEDULE
  // ═══════════════════════════════════════════════════════════════════════════

  const renderSchedule = () => (
    <div className="h-screen flex flex-col" style={{ background: colors.bg }}>
      {/* Fixed Header */}
      <div className="flex-shrink-0 pt-[max(60px,env(safe-area-inset-top))] px-6 pb-4">
        <button
          onClick={() => goToStep('goal')}
          className="flex items-center gap-2 mb-4"
          style={{ color: colors.textSecondary }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[15px]">Back</span>
        </button>

        <h1
          className="text-[28px] font-bold leading-[1.2] tracking-tight"
          style={{ color: colors.textPrimary }}
        >
          When can you train?
        </h1>
        <p
          className="text-[17px] mt-2"
          style={{ color: colors.textSecondary }}
        >
          Tap the days you're available.
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6">
        {/* Days */}
        <div className="mb-6">
          <div className="flex gap-2">
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
                  className="flex-1 h-14 rounded-xl flex flex-col items-center justify-center active:scale-95 transition-all border-2"
                  style={{
                    background: isSelected ? colors.accent : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                  }}
                >
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: isSelected ? '#FFFFFF' : colors.textPrimary }}
                  >
                    {day}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Summary */}
          <div
            className="mt-3 p-3 rounded-xl"
            style={{ background: colors.surface }}
          >
            <div className="flex justify-between items-center">
              <span className="text-[14px]" style={{ color: colors.textSecondary }}>
                Training days
              </span>
              <span className="text-[14px] font-semibold" style={{ color: colors.textPrimary }}>
                {selectedDays.length} per week
              </span>
            </div>
            <div
              className="mt-2 pt-2 border-t"
              style={{ borderColor: colors.border }}
            >
              <span className="text-[12px]" style={{ color: colors.textMuted }}>
                Recommended: {recommendedSplit}
              </span>
            </div>
          </div>
        </div>

        {/* Session length */}
        <div className="mb-6">
          <label
            className="block text-[15px] font-medium mb-2"
            style={{ color: colors.textPrimary }}
          >
            How long per session?
          </label>
          <div className="flex gap-2">
            {[30, 45, 60, 75, 90].map(mins => (
              <button
                key={mins}
                onClick={() => {
                  haptic.light();
                  setSessionLength(mins);
                }}
                className="flex-1 h-11 rounded-xl text-[15px] font-medium active:scale-95 transition-all border-2"
                style={{
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
            className="text-[12px] mt-1 text-center"
            style={{ color: colors.textMuted }}
          >
            minutes
          </p>
        </div>

        {/* 2-a-day option for competition prep */}
        {path === 'competition' && (
          <div className="mb-6">
            <label
              className="block text-[15px] font-medium mb-2"
              style={{ color: colors.textPrimary }}
            >
              Sessions per day
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  haptic.light();
                  setSessionsPerDay('1');
                }}
                className="h-14 rounded-xl flex flex-col items-center justify-center active:scale-[0.98] transition-all border-2"
                style={{
                  background: sessionsPerDay === '1' ? colors.accent : colors.surface,
                  borderColor: sessionsPerDay === '1' ? colors.accent : colors.border,
                }}
              >
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: sessionsPerDay === '1' ? '#FFFFFF' : colors.textPrimary }}
                >
                  1 session
                </span>
                <span
                  className="text-[11px] mt-0.5"
                  style={{ color: sessionsPerDay === '1' ? 'rgba(255,255,255,0.7)' : colors.textMuted }}
                >
                  Standard
                </span>
              </button>
              <button
                onClick={() => {
                  haptic.light();
                  setSessionsPerDay('2');
                }}
                className="h-14 rounded-xl flex flex-col items-center justify-center active:scale-[0.98] transition-all border-2"
                style={{
                  background: sessionsPerDay === '2' ? colors.accent : colors.surface,
                  borderColor: sessionsPerDay === '2' ? colors.accent : colors.border,
                }}
              >
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: sessionsPerDay === '2' ? '#FFFFFF' : colors.textPrimary }}
                >
                  2 sessions
                </span>
                <span
                  className="text-[11px] mt-0.5"
                  style={{ color: sessionsPerDay === '2' ? 'rgba(255,255,255,0.7)' : colors.textMuted }}
                >
                  AM/PM split
                </span>
              </button>
            </div>

            {/* Split type selector - only show when 2 sessions selected */}
            {sessionsPerDay === '2' && (
              <div className="mt-4">
                <label
                  className="block text-[14px] font-medium mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  What type of split?
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      haptic.light();
                      setSplitType('strength_cardio');
                    }}
                    className="w-full p-3 rounded-xl text-left active:scale-[0.98] transition-all border-2"
                    style={{
                      background: splitType === 'strength_cardio' ? `${colors.accent}15` : colors.surface,
                      borderColor: splitType === 'strength_cardio' ? colors.accent : colors.border,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className="text-[14px] font-semibold block"
                          style={{ color: splitType === 'strength_cardio' ? colors.accent : colors.textPrimary }}
                        >
                          Strength + Cardio
                        </span>
                        <span className="text-[12px]" style={{ color: colors.textMuted }}>
                          AM: Weights • PM: Running/Cardio
                        </span>
                      </div>
                      {splitType === 'strength_cardio' && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: colors.accent }}>
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      haptic.light();
                      setSplitType('technique_conditioning');
                    }}
                    className="w-full p-3 rounded-xl text-left active:scale-[0.98] transition-all border-2"
                    style={{
                      background: splitType === 'technique_conditioning' ? `${colors.accent}15` : colors.surface,
                      borderColor: splitType === 'technique_conditioning' ? colors.accent : colors.border,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className="text-[14px] font-semibold block"
                          style={{ color: splitType === 'technique_conditioning' ? colors.accent : colors.textPrimary }}
                        >
                          Skill + Conditioning
                        </span>
                        <span className="text-[12px]" style={{ color: colors.textMuted }}>
                          AM: Sport technique • PM: Fitness work
                        </span>
                      </div>
                      {splitType === 'technique_conditioning' && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: colors.accent }}>
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      haptic.light();
                      setSplitType('am_pm_same');
                    }}
                    className="w-full p-3 rounded-xl text-left active:scale-[0.98] transition-all border-2"
                    style={{
                      background: splitType === 'am_pm_same' ? `${colors.accent}15` : colors.surface,
                      borderColor: splitType === 'am_pm_same' ? colors.accent : colors.border,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className="text-[14px] font-semibold block"
                          style={{ color: splitType === 'am_pm_same' ? colors.accent : colors.textPrimary }}
                        >
                          Double Sessions
                        </span>
                        <span className="text-[12px]" style={{ color: colors.textMuted }}>
                          AM & PM: Both full training
                        </span>
                      </div>
                      {splitType === 'am_pm_same' && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: colors.accent }}>
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Experience */}
        <div className="mb-6">
          <label
            className="block text-[15px] font-medium mb-2"
            style={{ color: colors.textPrimary }}
          >
            Experience level
          </label>
          <div className="space-y-2">
            {(['beginner', 'intermediate', 'advanced'] as Experience[]).map(exp => (
              <button
                key={exp}
                onClick={() => {
                  haptic.light();
                  setExperience(exp);
                }}
                className="w-full h-12 px-4 rounded-xl text-left flex items-center justify-between active:scale-[0.98] transition-all border-2"
                style={{
                  background: experience === exp ? `${colors.accent}15` : colors.surface,
                  borderColor: experience === exp ? colors.accent : colors.border,
                }}
              >
                <span
                  className="text-[15px] font-medium capitalize"
                  style={{ color: experience === exp ? colors.accent : colors.textPrimary }}
                >
                  {exp}
                </span>
                {experience === exp && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: colors.accent }}
                  >
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Spacer for bottom button */}
        <div className="h-20" />
      </div>

      {/* Fixed Continue Button */}
      <div className="flex-shrink-0 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4" style={{ background: colors.bg }}>
        <button
          onClick={() => goToStep('body')}
          disabled={selectedDays.length === 0}
          className="w-full h-14 rounded-2xl font-semibold text-[17px] active:scale-[0.98] transition-all disabled:opacity-40"
          style={{
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
    <div className="min-h-screen flex flex-col" style={{ background: colors.bg }}>
      {/* Header */}
      <div className="pt-[max(60px,env(safe-area-inset-top))] px-6 pb-6">
        <button
          onClick={() => goToStep('schedule')}
          className="flex items-center gap-2 mb-6"
          style={{ color: colors.textSecondary }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[15px]">Back</span>
        </button>

        <h1
          className="text-[28px] font-bold leading-[1.2] tracking-tight"
          style={{ color: colors.textPrimary }}
        >
          Any areas to protect?
        </h1>
        <p
          className="text-[17px] mt-2"
          style={{ color: colors.textSecondary }}
        >
          We'll avoid exercises that stress these areas.
        </p>
      </div>

      {/* Body areas */}
      <div className="flex-1 px-6">
        <div className="grid grid-cols-2 gap-3">
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
                className="h-14 px-4 rounded-xl flex items-center justify-between active:scale-[0.97] transition-all border-2"
                style={{
                  background: isSelected ? `${colors.accent}15` : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                }}
              >
                <span
                  className="text-[15px] font-medium"
                  style={{ color: isSelected ? colors.accent : colors.textPrimary }}
                >
                  {area.label}
                </span>
                {isSelected && (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {painPoints.length === 0 && (
          <p
            className="text-center text-[15px] mt-6"
            style={{ color: colors.textMuted }}
          >
            None selected — all exercises available
          </p>
        )}

        {painPoints.length > 0 && (
          <div
            className="mt-6 p-4 rounded-xl"
            style={{ background: colors.surface }}
          >
            <p className="text-[13px]" style={{ color: colors.textMuted }}>
              We'll modify or substitute exercises for: {painPoints.map(p =>
                BODY_AREAS.find(a => a.id === p)?.label
              ).join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Continue */}
      <div className="px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <button
          onClick={() => goToStep('strength')}
          className="w-full h-14 rounded-2xl font-semibold text-[17px] active:scale-[0.98] transition-all"
          style={{ background: colors.accent, color: '#FFFFFF' }}
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
      <div className="min-h-screen flex flex-col" style={{ background: colors.bg }}>
        {/* Header */}
        <div className="pt-[max(60px,env(safe-area-inset-top))] px-6 pb-6">
          <button
            onClick={() => goToStep('body')}
            className="flex items-center gap-2 mb-6"
            style={{ color: colors.textSecondary }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[15px]">Back</span>
          </button>

          <h1
            className="text-[28px] font-bold leading-[1.2] tracking-tight"
            style={{ color: colors.textPrimary }}
          >
            Current strength
          </h1>
          <p
            className="text-[17px] mt-2"
            style={{ color: colors.textSecondary }}
          >
            Optional — helps us set accurate starting weights.
          </p>
        </div>

        {/* Benchmarks */}
        <div className="flex-1 px-6">
          <div className="space-y-4">
            {BENCHMARKS.map(b => (
              <div key={b.id}>
                <label
                  className="block text-[15px] font-medium mb-2"
                  style={{ color: colors.textPrimary }}
                >
                  {b.name}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={benchmarks[b.id] || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setBenchmarks(prev => ({ ...prev, [b.id]: val }));
                    }}
                    placeholder={b.placeholder}
                    className="flex-1 h-14 px-4 rounded-xl text-[17px] border-2 outline-none placeholder:opacity-30"
                    style={{
                      background: colors.surface,
                      borderColor: benchmarks[b.id] ? colors.accent : colors.border,
                      color: colors.textPrimary,
                    }}
                  />
                  <span
                    className="text-[15px] font-medium w-8"
                    style={{ color: colors.textMuted }}
                  >
                    kg
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p
            className="text-center text-[13px] mt-6"
            style={{ color: colors.textMuted }}
          >
            {filledCount === 0
              ? "Skip this — we'll start conservative"
              : `${filledCount} of ${BENCHMARKS.length} provided`}
          </p>
        </div>

        {/* Continue */}
        <div className="px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
          <button
            onClick={() => goToStep('final')}
            className="w-full h-14 rounded-2xl font-semibold text-[17px] active:scale-[0.98] transition-all"
            style={{ background: colors.accent, color: '#FFFFFF' }}
          >
            Continue
          </button>
          {filledCount === 0 && (
            <button
              onClick={() => goToStep('final')}
              className="w-full h-12 mt-2 text-[15px] font-medium"
              style={{ color: colors.textSecondary }}
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
    <div className="min-h-screen flex flex-col" style={{ background: colors.bg }}>
      {/* Header */}
      <div className="pt-[max(60px,env(safe-area-inset-top))] px-6 pb-6">
        <button
          onClick={() => goToStep('strength')}
          className="flex items-center gap-2 mb-6"
          style={{ color: colors.textSecondary }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[15px]">Back</span>
        </button>

        <h1
          className="text-[28px] font-bold leading-[1.2] tracking-tight"
          style={{ color: colors.textPrimary }}
        >
          Final touches
        </h1>
        <p
          className="text-[17px] mt-2"
          style={{ color: colors.textSecondary }}
        >
          Optional — make your plan even more personal.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 space-y-6">
        {/* Age */}
        <div>
          <label
            className="block text-[15px] font-medium mb-2"
            style={{ color: colors.textPrimary }}
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
            className="w-full h-14 px-4 rounded-xl text-[17px] border-2 outline-none placeholder:opacity-30"
            style={{
              background: colors.surface,
              borderColor: age ? colors.accent : colors.border,
              color: colors.textPrimary,
            }}
          />
          <p
            className="text-[13px] mt-2"
            style={{ color: colors.textMuted }}
          >
            Helps us adjust recovery time and exercise selection.
          </p>
        </div>

        {/* Additional Notes */}
        <div>
          <label
            className="block text-[15px] font-medium mb-2"
            style={{ color: colors.textPrimary }}
          >
            Anything else?
          </label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Tell us about specific exercises you love, equipment you have access to, things you want to focus on, or any other details that would help personalize your plan..."
            rows={5}
            className="w-full px-4 py-3 rounded-xl text-[17px] border-2 outline-none placeholder:opacity-40 resize-none"
            style={{
              background: colors.surface,
              borderColor: additionalNotes ? colors.accent : colors.border,
              color: colors.textPrimary,
              lineHeight: 1.5,
            }}
          />
          <p
            className="text-[13px] mt-2"
            style={{ color: colors.textMuted }}
          >
            Examples: "I love sled work", "No barbells at my gym", "Focus on explosiveness"
          </p>
        </div>
      </div>

      {/* Generate */}
      <div className="px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <button
          onClick={() => {
            goToStep('generating');
            setTimeout(generatePlan, 300);
          }}
          className="w-full h-14 rounded-2xl font-semibold text-[17px] active:scale-[0.98] transition-all"
          style={{ background: colors.accent, color: '#FFFFFF' }}
        >
          Generate My Plan
        </button>
        <button
          onClick={() => {
            goToStep('generating');
            setTimeout(generatePlan, 300);
          }}
          className="w-full h-12 mt-2 text-[15px] font-medium"
          style={{ color: colors.textSecondary }}
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
