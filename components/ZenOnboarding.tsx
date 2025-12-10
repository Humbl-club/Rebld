import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { WorkoutPlan, TrainingPreferences, TrainingSplit, SpecificGoal, CurrentStrength } from '../types';
import { useHaptic } from '../hooks/useAnimations';
import useUserProfile from '../hooks/useUserProfile';
import useOnboardingPersistence from '../hooks/useOnboardingPersistence';
import { analytics, EventTypes } from '../services/analyticsService';
import { hasExceededLimit, getLimitMessage, getRemainingUsage } from '../lib/rateLimiter';
import { cn } from '../lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   ZEN ONBOARDING - "TRANSFORMATION STORY" EXPERIENCE

   Philosophy: The onboarding IS the first workout - focused, minimal, powerful.

   Structure:
   1. OPENING SEQUENCE (Cinematic) - Name → Logo → "Begin"
   2. QUESTION CARDS (One at a time) - Full-screen, auto-advance
   3. BUILDING SEQUENCE (Dramatic) - Animated plan generation
   4. REVEAL (Victory) - Plan ready, single CTA

   Design Language:
   - Pure black backgrounds (OLED optimized)
   - Coral accent (#E07A5F) for selections and focus
   - Massive typography (48-72px headlines)
   - Haptic feedback on every interaction
   - No progress bars until questions begin
   - Breathing/pulsing animations for rhythm
   ═══════════════════════════════════════════════════════════════════════════ */

interface ZenOnboardingProps {
  onPlanGenerated: (plan: Omit<WorkoutPlan, 'id'>) => void;
}

// Types
type Goal = 'Aesthetic Physique' | 'Strength & Power' | 'Athletic Performance' | 'Health & Longevity' | 'Competition Prep';
type Experience = 'Beginner' | 'Intermediate' | 'Advanced';
type Frequency = '2-3' | '3-4' | '4-5' | '5+';
type Equipment = 'minimal' | 'home_gym' | 'commercial_gym';
type SessionLength = '30' | '45' | '60' | '75' | '90';
type PainPoint = 'Knees' | 'Lower Back' | 'Shoulders' | 'Wrists';

// Flow phases
type Phase =
  | 'opening'      // Cinematic intro
  | 'questions'    // Data collection
  | 'building'     // AI generation
  | 'reveal'       // Plan ready
  | 'custom';      // Import own plan

// Opening sequence beats
type OpeningBeat = 'dark' | 'name' | 'logo' | 'begin';

// Question IDs in order
const QUESTION_ORDER = [
  'goal',
  'experience',
  'frequency',
  'equipment',
  'sessionLength',
  'painPoints',
] as const;

type QuestionId = typeof QUESTION_ORDER[number];

export default function ZenOnboarding({ onPlanGenerated }: ZenOnboardingProps) {
  const { user } = useUser();
  const haptic = useHaptic();
  const { userProfile, updateUserProfile } = useUserProfile();

  // Convex mutations
  const incrementPlanUsageMutation = useMutation(api.mutations.incrementPlanUsage);
  const generatePlanAction = useAction(api.ai.generateWorkoutPlan);

  // Persistence
  const {
    state: persistedState,
    isRestored,
    hasExistingSession,
    updateState: updatePersistedState,
    clearState: clearPersistedState,
    startFresh,
  } = useOnboardingPersistence(user?.id);

  // Phase tracking
  const [phase, setPhase] = useState<Phase>('opening');
  const [openingBeat, setOpeningBeat] = useState<OpeningBeat>('dark');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Data collection
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [sessionLength, setSessionLength] = useState<SessionLength>('60');
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [trainingSplit, setTrainingSplit] = useState<TrainingSplit>({
    sessions_per_day: '1',
    training_type: 'combined'
  });

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationPhase, setGenerationPhase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<Omit<WorkoutPlan, 'id'> | null>(null);

  // Tracking
  const [startTime] = useState(Date.now());
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Refs
  const openingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE & RESTORATION
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (isRestored && hasExistingSession) {
      setShowResumePrompt(true);
    }
  }, [isRestored, hasExistingSession]);

  const handleResume = useCallback(() => {
    // Restore persisted state
    if (persistedState.goal) setGoal(persistedState.goal as Goal);
    if (persistedState.experience) setExperience(persistedState.experience as Experience);
    if (persistedState.frequency) setFrequency(persistedState.frequency as Frequency);
    if (persistedState.equipment) setEquipment(persistedState.equipment as Equipment);
    if (persistedState.sessionLength) setSessionLength(persistedState.sessionLength as SessionLength);
    if (persistedState.painPoints) setPainPoints(persistedState.painPoints as PainPoint[]);
    if (persistedState.trainingSplit) setTrainingSplit(persistedState.trainingSplit);

    // Skip to questions phase
    setPhase('questions');
    setShowResumePrompt(false);

    // Find first unanswered question
    let firstUnanswered = 0;
    if (persistedState.goal) firstUnanswered = 1;
    if (persistedState.experience) firstUnanswered = 2;
    if (persistedState.frequency) firstUnanswered = 3;
    if (persistedState.equipment) firstUnanswered = 4;
    if (persistedState.sessionLength) firstUnanswered = 5;

    setCurrentQuestionIndex(Math.min(firstUnanswered, QUESTION_ORDER.length - 1));
  }, [persistedState]);

  const handleStartFresh = useCallback(() => {
    startFresh();
    setShowResumePrompt(false);
  }, [startFresh]);

  // Persist state changes
  useEffect(() => {
    if (!isRestored || phase === 'opening') return;

    updatePersistedState({
      currentStep: QUESTION_ORDER[currentQuestionIndex],
      goal,
      experience,
      frequency,
      equipment: equipment || '',
      sessionLength: sessionLength || '60',
      painPoints,
      trainingSplit,
    });
  }, [isRestored, phase, currentQuestionIndex, goal, experience, frequency, equipment, sessionLength, painPoints, trainingSplit, updatePersistedState]);

  // ═══════════════════════════════════════════════════════════════════════
  // OPENING SEQUENCE
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (phase !== 'opening' || showResumePrompt) return;

    // Track onboarding start
    if (user?.id) {
      analytics.track(EventTypes.ONBOARDING_STARTED, { entryPoint: 'zen_onboarding' });
    }

    // Beat 1: Dark (0.5s)
    // Beat 2: Name fades in (1.5s)
    // Beat 3: Logo appears (1.5s)
    // Beat 4: Begin button (hold)

    const timings = [
      { beat: 'name' as OpeningBeat, delay: 500 },
      { beat: 'logo' as OpeningBeat, delay: 2000 },
      { beat: 'begin' as OpeningBeat, delay: 3500 },
    ];

    timings.forEach(({ beat, delay }) => {
      const timer = setTimeout(() => {
        setOpeningBeat(beat);
        if (beat === 'logo') haptic.medium();
      }, delay);
      openingTimerRef.current = timer;
    });

    return () => {
      if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
    };
  }, [phase, showResumePrompt, user?.id, haptic]);

  const handleBegin = useCallback(() => {
    haptic.heavy();
    setPhase('questions');
  }, [haptic]);

  const handleImportOwn = useCallback(() => {
    haptic.light();
    setPhase('custom');
  }, [haptic]);

  // ═══════════════════════════════════════════════════════════════════════
  // QUESTION NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════

  const currentQuestion = QUESTION_ORDER[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / QUESTION_ORDER.length) * 100;

  const goToNextQuestion = useCallback(() => {
    if (currentQuestionIndex < QUESTION_ORDER.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // All questions answered, start generation
      setPhase('building');
    }
  }, [currentQuestionIndex]);

  const goToPrevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      haptic.light();
      setCurrentQuestionIndex(prev => prev - 1);
    } else {
      // Go back to opening
      setPhase('opening');
      setOpeningBeat('begin');
    }
  }, [currentQuestionIndex, haptic]);

  // Auto-advance after selection (with delay for visual feedback)
  const selectAndAdvance = useCallback((setter: () => void) => {
    haptic.medium();
    setter();
    setTimeout(goToNextQuestion, 300);
  }, [haptic, goToNextQuestion]);

  // ═══════════════════════════════════════════════════════════════════════
  // PLAN GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  const generatePlan = useCallback(async () => {
    if (!goal || !experience || !frequency) {
      setError('Missing required selections');
      return;
    }

    // Check rate limits
    if (user?.id && userProfile) {
      const tier = userProfile.apiUsage?.tier || 'free';
      const usage = userProfile.apiUsage;

      if (usage && hasExceededLimit(usage, tier, 'plan')) {
        const remaining = getRemainingUsage(usage, tier);
        setError(getLimitMessage('plan', tier, remaining));
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    // Progress simulation (AI takes ~45-60s)
    const phases = [
      { progress: 15, text: 'Understanding your goals...', delay: 0 },
      { progress: 30, text: 'Analyzing training patterns...', delay: 8000 },
      { progress: 45, text: 'Selecting exercises...', delay: 16000 },
      { progress: 60, text: 'Building your week...', delay: 24000 },
      { progress: 75, text: 'Optimizing for recovery...', delay: 32000 },
      { progress: 85, text: 'Adding finishing touches...', delay: 40000 },
    ];

    phases.forEach(({ progress, text, delay }) => {
      setTimeout(() => {
        setGenerationProgress(progress);
        setGenerationPhase(text);
      }, delay);
    });

    try {
      const planData = await generatePlanAction({
        userId: user?.id,
        preferences: {
          primary_goal: goal,
          experience_level: experience,
          training_frequency: frequency,
          pain_points: painPoints,
          equipment: equipment || undefined,
          preferred_session_length: sessionLength || undefined,
          training_split: trainingSplit || undefined,
        },
      });

      if (!planData || !planData.weeklyPlan || planData.weeklyPlan.length === 0) {
        throw new Error('Invalid plan generated');
      }

      const plan: Omit<WorkoutPlan, 'id'> = {
        ...planData,
        name: `${goal} Program`
      };

      // Track usage
      if (user?.id) {
        await incrementPlanUsageMutation({ userId: user.id });
      }

      // Save preferences
      if (user?.id) {
        const preferences: TrainingPreferences = {
          primary_goal: goal,
          goal_explanation: null,
          experience_level: experience,
          training_frequency: frequency,
          pain_points: painPoints,
          sport: null,
          sport_specific: null,
          additional_notes: null,
          last_updated: new Date().toISOString(),
          equipment: equipment || undefined,
          preferred_session_length: sessionLength || undefined,
          training_split: trainingSplit || undefined,
        };

        await updateUserProfile({ trainingPreferences: preferences }).catch(() => {});
      }

      setGenerationProgress(100);
      setGenerationPhase('Your program is ready');
      setGeneratedPlan(plan);

      // Short delay then reveal
      setTimeout(() => {
        setPhase('reveal');
        haptic.heavy();
      }, 1000);

    } catch (e: any) {
      console.error('Plan generation failed:', e);

      let userMessage = 'Failed to generate plan. Please try again.';
      if (e?.message?.includes('Rate limit')) {
        userMessage = e.message;
      } else if (e?.message?.includes('timeout')) {
        userMessage = 'AI service is busy. Please try again in a moment.';
      }

      setError(userMessage);
      setIsGenerating(false);

      analytics.trackError(EventTypes.PLAN_GENERATION_FAILED, e, { goal, experience, frequency });
    }
  }, [goal, experience, frequency, painPoints, equipment, sessionLength, trainingSplit, user?.id, userProfile, generatePlanAction, incrementPlanUsageMutation, updateUserProfile, haptic]);

  // Trigger generation when entering building phase
  useEffect(() => {
    if (phase === 'building' && !isGenerating && !generatedPlan) {
      generatePlan();
    }
  }, [phase, isGenerating, generatedPlan, generatePlan]);

  // ═══════════════════════════════════════════════════════════════════════
  // PLAN CONFIRMATION
  // ═══════════════════════════════════════════════════════════════════════

  const handleConfirmPlan = useCallback(() => {
    if (generatedPlan) {
      // Track completion
      if (user?.id) {
        const timeSpent_ms = Date.now() - startTime;
        analytics.track(EventTypes.ONBOARDING_COMPLETED, {
          timeSpent_ms,
          goal,
          experience,
          frequency,
          painPointsCount: painPoints.length,
        });
      }

      clearPersistedState();
      haptic.heavy();
      onPlanGenerated(generatedPlan);
    }
  }, [generatedPlan, user?.id, startTime, goal, experience, frequency, painPoints.length, clearPersistedState, haptic, onPlanGenerated]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: OPENING SEQUENCE
  // ═══════════════════════════════════════════════════════════════════════

  const renderOpening = () => {
    const userName = user?.firstName || 'Athlete';

    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8">
        {/* User name - fades in */}
        <div className={cn(
          'transition-all duration-1000 ease-out',
          openingBeat === 'dark' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        )}>
          {(openingBeat === 'name' || openingBeat === 'logo' || openingBeat === 'begin') && (
            <p className="text-white/60 text-lg font-medium tracking-wide mb-3 text-center">
              Welcome back,
            </p>
          )}
          <h1 className={cn(
            'text-white font-black text-center transition-all duration-700',
            openingBeat === 'name' ? 'text-5xl' : 'text-4xl'
          )}>
            {userName}
          </h1>
        </div>

        {/* Logo - appears after name */}
        <div className={cn(
          'mt-16 transition-all duration-700 ease-out',
          (openingBeat === 'logo' || openingBeat === 'begin')
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-90'
        )}>
          <div className="flex items-center justify-center">
            <span className="text-white font-black text-6xl tracking-tighter">RE</span>
            <span className="text-[#E07A5F] font-black text-6xl tracking-tighter">BLD</span>
          </div>
          <p className="text-white/40 text-center mt-2 text-sm tracking-[0.3em] uppercase">
            Transform
          </p>
        </div>

        {/* Begin button - appears last */}
        <div className={cn(
          'absolute bottom-0 left-0 right-0 px-8 pb-[max(3rem,env(safe-area-inset-bottom))]',
          'transition-all duration-500 ease-out',
          openingBeat === 'begin' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}>
          <button
            onClick={handleBegin}
            className={cn(
              'w-full h-16 rounded-2xl font-bold text-lg uppercase tracking-wider',
              'bg-[#E07A5F] text-white',
              'active:scale-[0.98] transition-transform',
              'shadow-[0_0_40px_rgba(224,122,95,0.3)]'
            )}
          >
            Begin
          </button>

          <button
            onClick={handleImportOwn}
            className="w-full mt-4 py-3 text-white/40 text-sm font-medium"
          >
            I have my own plan
          </button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: QUESTIONS
  // ═══════════════════════════════════════════════════════════════════════

  const renderQuestions = () => {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Header with progress */}
        <div className="pt-[max(1rem,env(safe-area-inset-top))] px-6">
          {/* Back button */}
          <button
            onClick={goToPrevQuestion}
            className="flex items-center gap-2 text-white/60 py-2 -ml-2 px-2 active:text-white transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Progress bar - thin, elegant */}
          <div className="mt-4 h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E07A5F] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step counter */}
          <p className="mt-2 text-white/30 text-xs font-medium tracking-wider">
            {currentQuestionIndex + 1} / {QUESTION_ORDER.length}
          </p>
        </div>

        {/* Question content */}
        <div className="flex-1 flex flex-col px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] overflow-y-auto">
          {renderQuestionContent()}
        </div>
      </div>
    );
  };

  const renderQuestionContent = () => {
    switch (currentQuestion) {
      case 'goal':
        return (
          <QuestionCard
            headline="What's Your Drive?"
            subtext="This shapes everything we build for you"
          >
            <div className="space-y-3 mt-8">
              {[
                { id: 'Aesthetic Physique' as Goal, label: 'AESTHETIC', desc: 'Build muscle · Reduce body fat' },
                { id: 'Strength & Power' as Goal, label: 'STRENGTH', desc: 'Increase 1RM · Raw power' },
                { id: 'Athletic Performance' as Goal, label: 'ATHLETIC', desc: 'Sport-specific conditioning' },
                { id: 'Health & Longevity' as Goal, label: 'HEALTH', desc: 'Sustainable · Long-term fitness' },
                { id: 'Competition Prep' as Goal, label: 'COMPETITION', desc: 'Peak for an event' },
              ].map(option => (
                <SelectionCard
                  key={option.id}
                  selected={goal === option.id}
                  onClick={() => selectAndAdvance(() => setGoal(option.id))}
                  label={option.label}
                  description={option.desc}
                />
              ))}
            </div>
          </QuestionCard>
        );

      case 'experience':
        return (
          <QuestionCard
            headline="Training History"
            subtext="We'll match your intensity"
          >
            <div className="space-y-3 mt-8">
              {[
                { id: 'Beginner' as Experience, label: 'BEGINNER', desc: 'Less than 1 year' },
                { id: 'Intermediate' as Experience, label: 'INTERMEDIATE', desc: '1-3 years training' },
                { id: 'Advanced' as Experience, label: 'ADVANCED', desc: '3+ years experience' },
              ].map(option => (
                <SelectionCard
                  key={option.id}
                  selected={experience === option.id}
                  onClick={() => selectAndAdvance(() => setExperience(option.id))}
                  label={option.label}
                  description={option.desc}
                />
              ))}
            </div>
          </QuestionCard>
        );

      case 'frequency':
        return (
          <QuestionCard
            headline="Weekly Commitment"
            subtext="Consistency beats perfection"
          >
            <div className="grid grid-cols-2 gap-3 mt-8">
              {[
                { id: '2-3' as Frequency, label: '2-3', desc: 'Great start' },
                { id: '3-4' as Frequency, label: '3-4', desc: 'Balanced' },
                { id: '4-5' as Frequency, label: '4-5', desc: 'Serious' },
                { id: '5+' as Frequency, label: '5+', desc: 'Athlete' },
              ].map(option => (
                <NumberCard
                  key={option.id}
                  selected={frequency === option.id}
                  onClick={() => selectAndAdvance(() => setFrequency(option.id))}
                  value={option.label}
                  unit={option.desc}
                />
              ))}
            </div>
          </QuestionCard>
        );

      case 'equipment':
        return (
          <QuestionCard
            headline="Your Setup"
            subtext="We'll work with what you have"
          >
            <div className="space-y-3 mt-8">
              {[
                { id: 'minimal' as Equipment, label: 'MINIMAL', desc: 'Bodyweight + basics' },
                { id: 'home_gym' as Equipment, label: 'HOME GYM', desc: 'Dumbbells · Bench · Rack' },
                { id: 'commercial_gym' as Equipment, label: 'FULL GYM', desc: 'Complete equipment access' },
              ].map(option => (
                <SelectionCard
                  key={option.id}
                  selected={equipment === option.id}
                  onClick={() => selectAndAdvance(() => setEquipment(option.id))}
                  label={option.label}
                  description={option.desc}
                />
              ))}
            </div>
          </QuestionCard>
        );

      case 'sessionLength':
        return (
          <QuestionCard
            headline="Session Length"
            subtext="Including warmup and cooldown"
          >
            <div className="grid grid-cols-3 gap-3 mt-8">
              {[
                { id: '30' as SessionLength },
                { id: '45' as SessionLength },
                { id: '60' as SessionLength },
                { id: '75' as SessionLength },
                { id: '90' as SessionLength },
              ].map(option => (
                <NumberCard
                  key={option.id}
                  selected={sessionLength === option.id}
                  onClick={() => selectAndAdvance(() => setSessionLength(option.id))}
                  value={option.id}
                  unit="min"
                />
              ))}
            </div>
          </QuestionCard>
        );

      case 'painPoints':
        return (
          <QuestionCard
            headline="Areas to Protect"
            subtext="We'll program around them (optional)"
          >
            <div className="flex flex-wrap gap-2 mt-8">
              {[
                { id: 'Knees' as PainPoint },
                { id: 'Lower Back' as PainPoint },
                { id: 'Shoulders' as PainPoint },
                { id: 'Wrists' as PainPoint },
              ].map(option => (
                <PillButton
                  key={option.id}
                  selected={painPoints.includes(option.id)}
                  onClick={() => {
                    haptic.light();
                    setPainPoints(prev =>
                      prev.includes(option.id)
                        ? prev.filter(p => p !== option.id)
                        : [...prev, option.id]
                    );
                  }}
                  label={option.id.toUpperCase()}
                />
              ))}
            </div>

            {/* Continue button for optional question */}
            <button
              onClick={() => {
                haptic.medium();
                goToNextQuestion();
              }}
              className={cn(
                'w-full h-14 mt-8 rounded-xl font-bold text-base uppercase tracking-wider',
                'bg-[#E07A5F] text-white',
                'active:scale-[0.98] transition-transform'
              )}
            >
              {painPoints.length > 0 ? 'Continue' : 'Skip'}
            </button>
          </QuestionCard>
        );

      default:
        return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: BUILDING PHASE
  // ═══════════════════════════════════════════════════════════════════════

  const renderBuilding = () => {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8">
        {/* Animated blocks */}
        <div className="relative w-32 h-32 mb-12">
          <BuildingBlocksAnimation progress={generationProgress} />
        </div>

        {/* Progress text */}
        <p className="text-white/60 text-sm font-medium tracking-wide text-center mb-2">
          {generationPhase || 'Initializing...'}
        </p>

        {/* Progress percentage */}
        <p className="text-white font-black text-4xl tabular-nums">
          {Math.round(generationProgress)}%
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-xs h-1 bg-white/10 rounded-full mt-8 overflow-hidden">
          <div
            className="h-full bg-[#E07A5F] transition-all duration-700 ease-out"
            style={{ width: `${generationProgress}%` }}
          />
        </div>

        {/* Time estimate */}
        <p className="text-white/30 text-xs mt-4">
          Plan generation takes about 1-2 minutes
        </p>

        {/* Error display */}
        {error && (
          <div className="absolute bottom-[max(6rem,env(safe-area-inset-bottom))] left-6 right-6">
            <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4">
              <p className="text-red-400 text-sm text-center">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setIsGenerating(false);
                  generatePlan();
                }}
                className="w-full mt-3 py-2 text-red-400 font-medium text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: REVEAL PHASE
  // ═══════════════════════════════════════════════════════════════════════

  const renderReveal = () => {
    const exerciseCount = generatedPlan?.weeklyPlan?.reduce(
      (acc, day) => acc + (day.blocks?.reduce((a, b) => a + (b.exercises?.length || 0), 0) || 0),
      0
    ) || 0;

    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Success animation */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {/* Checkmark burst */}
          <div className="w-24 h-24 rounded-full bg-[#E07A5F] flex items-center justify-center mb-8 animate-scale-in">
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-white font-black text-4xl text-center mb-2">
            Your Program
          </h1>
          <h2 className="text-white font-black text-4xl text-center mb-4">
            Is Ready
          </h2>

          <p className="text-white/40 text-center">
            {generatedPlan?.weeklyPlan?.length || 0} training days · {exerciseCount} exercises
          </p>

          {/* Summary pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <span className="px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm font-medium">
              {goal?.split(' ')[0]}
            </span>
            <span className="px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm font-medium">
              {experience}
            </span>
            <span className="px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm font-medium">
              {frequency} days/week
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="px-8 pb-[max(3rem,env(safe-area-inset-bottom))]">
          <button
            onClick={handleConfirmPlan}
            className={cn(
              'w-full h-16 rounded-2xl font-bold text-lg uppercase tracking-wider',
              'bg-[#E07A5F] text-white',
              'active:scale-[0.98] transition-transform',
              'shadow-[0_0_40px_rgba(224,122,95,0.3)]'
            )}
          >
            Start Training
          </button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: CUSTOM IMPORT
  // ═══════════════════════════════════════════════════════════════════════

  const renderCustom = () => {
    // TODO: Implement custom plan import flow
    // For now, redirect back to opening
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8">
        <p className="text-white/60 text-center mb-8">
          Custom plan import coming soon
        </p>
        <button
          onClick={() => setPhase('opening')}
          className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium"
        >
          Go Back
        </button>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════

  // Resume prompt modal
  if (showResumePrompt) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-6 z-50">
        <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
          <h3 className="text-white font-bold text-xl mb-2">
            Resume Setup?
          </h3>
          <p className="text-white/60 text-sm mb-6">
            You have an incomplete onboarding. Continue where you left off?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleStartFresh}
              className="flex-1 h-12 rounded-xl font-semibold text-sm text-white/60 bg-white/10 active:bg-white/20 transition-colors"
            >
              Start Over
            </button>
            <button
              onClick={handleResume}
              className="flex-1 h-12 rounded-xl font-bold text-sm text-white bg-[#E07A5F] active:scale-[0.98] transition-transform"
            >
              Resume
            </button>
          </div>
        </div>
      </div>
    );
  }

  switch (phase) {
    case 'opening':
      return renderOpening();
    case 'questions':
      return renderQuestions();
    case 'building':
      return renderBuilding();
    case 'reveal':
      return renderReveal();
    case 'custom':
      return renderCustom();
    default:
      return renderOpening();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

interface QuestionCardProps {
  headline: string;
  subtext: string;
  children: React.ReactNode;
}

function QuestionCard({ headline, subtext, children }: QuestionCardProps) {
  return (
    <div className="flex-1 flex flex-col">
      <h1 className="text-white font-black text-4xl leading-tight">
        {headline}
      </h1>
      <p className="text-white/40 text-base mt-2">
        {subtext}
      </p>
      {children}
    </div>
  );
}

interface SelectionCardProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  description: string;
}

function SelectionCard({ selected, onClick, label, description }: SelectionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-xl text-left transition-all duration-150 active:scale-[0.98]',
        'border-2',
        selected
          ? 'bg-[#E07A5F] border-[#E07A5F]'
          : 'bg-white/5 border-white/10 active:border-white/30'
      )}
    >
      <p className={cn(
        'font-bold text-sm tracking-wider',
        selected ? 'text-white' : 'text-white/90'
      )}>
        {label}
      </p>
      <p className={cn(
        'text-sm mt-0.5',
        selected ? 'text-white/70' : 'text-white/40'
      )}>
        {description}
      </p>
    </button>
  );
}

interface NumberCardProps {
  selected: boolean;
  onClick: () => void;
  value: string;
  unit?: string;
}

function NumberCard({ selected, onClick, value, unit }: NumberCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-150 active:scale-[0.97]',
        'border-2 min-h-[88px]',
        selected
          ? 'bg-[#E07A5F] border-[#E07A5F]'
          : 'bg-white/5 border-white/10 active:border-white/30'
      )}
    >
      <span className={cn(
        'font-black text-3xl',
        selected ? 'text-white' : 'text-white/90'
      )}>
        {value}
      </span>
      {unit && (
        <span className={cn(
          'text-xs mt-1 font-medium',
          selected ? 'text-white/70' : 'text-white/40'
        )}>
          {unit}
        </span>
      )}
    </button>
  );
}

interface PillButtonProps {
  selected: boolean;
  onClick: () => void;
  label: string;
}

function PillButton({ selected, onClick, label }: PillButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-5 py-3 rounded-full transition-all duration-150 active:scale-[0.97]',
        'border-2 font-semibold text-sm',
        selected
          ? 'bg-[#E07A5F] border-[#E07A5F] text-white'
          : 'bg-transparent border-white/20 text-white/60 active:border-white/40'
      )}
    >
      {label}
    </button>
  );
}

interface BuildingBlocksAnimationProps {
  progress: number;
}

function BuildingBlocksAnimation({ progress }: BuildingBlocksAnimationProps) {
  // 4x4 grid of blocks that fill based on progress
  const totalBlocks = 16;
  const filledBlocks = Math.floor((progress / 100) * totalBlocks);

  return (
    <div className="grid grid-cols-4 gap-2 w-full h-full">
      {Array.from({ length: totalBlocks }).map((_, i) => {
        const isFilled = i < filledBlocks;
        const isActive = i === filledBlocks;

        return (
          <div
            key={i}
            className={cn(
              'rounded-md transition-all duration-500',
              isFilled ? 'bg-[#E07A5F]' : 'bg-white/10',
              isActive && 'animate-pulse bg-[#E07A5F]/50'
            )}
            style={{
              transitionDelay: `${i * 30}ms`
            }}
          />
        );
      })}
    </div>
  );
}

// Add keyframes to global styles
const styles = `
@keyframes scale-in {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.animate-scale-in {
  animation: scale-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
