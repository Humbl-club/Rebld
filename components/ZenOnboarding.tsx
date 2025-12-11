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
import { CheckIcon } from './icons';

/* ═══════════════════════════════════════════════════════════════════════════
   INTELLIGENT ONBOARDING - Full Redesign

   NEW: Shows users what the AI will do with their data
   NEW: Integrated plan import (paste or upload)
   NEW: Sport selector dropdown with periodization preview
   NEW: Premium typography and information-dense design

   Features:
   - Two clear paths: Build My Plan / Import My Plan
   - Goal explanations show AI capabilities
   - Competition prep shows 4-phase periodization preview
   - Generation screen shows real AI actions
   - Premium typography throughout

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
type Sex = 'male' | 'female' | 'other';
type TrainingType = 'strength_only' | 'strength_plus_cardio' | 'combined' | 'cardio_focused';
type CardioType = 'running' | 'incline_walk' | 'cycling' | 'rowing' | 'swimming' | 'elliptical' | 'stair_climber' | 'hiking';

// Flow phases
type Phase = 'opening' | 'questions' | 'building' | 'reveal' | 'custom';
type OpeningBeat = 'dark' | 'name' | 'logo' | 'begin';

// Question IDs in order
const QUESTION_ORDER = [
  'goal',
  'experience',
  'frequency',
  'equipment',
  'sessionLength',
  'ageAndSex',
  'trainingSplit',
  'cardioPrefs',      // Conditional: shows if training type includes cardio
  'specificGoal',     // Conditional: shows if goal is Competition Prep or Athletic Performance
  'painPoints',
  'strength',         // Optional: collapsible
] as const;

type QuestionId = typeof QUESTION_ORDER[number];

export default function ZenOnboarding({ onPlanGenerated }: ZenOnboardingProps) {
  const { user } = useUser();
  const haptic = useHaptic();
  const { userProfile, updateUserProfile } = useUserProfile();

  // Convex
  const incrementPlanUsageMutation = useMutation(api.mutations.incrementPlanUsage);
  const generatePlanAction = useAction(api.ai.generateWorkoutPlan);
  const parsePlanAction = useAction(api.ai.parseWorkoutPlan);

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

  // Core data
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [sessionLength, setSessionLength] = useState<SessionLength>('60');

  // Demographics
  const [age, setAge] = useState<number | undefined>(undefined);
  const [sex, setSex] = useState<Sex | undefined>(undefined);

  // Training structure
  const [trainingSplit, setTrainingSplit] = useState<TrainingSplit>({
    sessions_per_day: '1',
    training_type: 'combined'
  });

  // Cardio
  const [selectedCardioTypes, setSelectedCardioTypes] = useState<CardioType[]>([]);
  const [cardioDuration, setCardioDuration] = useState<number>(30);
  const [favoriteCardio, setFavoriteCardio] = useState<CardioType | undefined>(undefined);

  // Competition/Sport
  const [specificGoal, setSpecificGoal] = useState<SpecificGoal | null>(null);

  // Optional
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [currentStrength, setCurrentStrength] = useState<CurrentStrength>({});
  const [showStrengthInputs, setShowStrengthInputs] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [filledDays, setFilledDays] = useState<number[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<Omit<WorkoutPlan, 'id'> | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Plan import state
  const [importText, setImportText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [generationSteps, setGenerationSteps] = useState<{ step: string; done: boolean }[]>([]);

  // Tracking
  const [startTime] = useState(Date.now());
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════
  // QUESTION VISIBILITY LOGIC
  // ═══════════════════════════════════════════════════════════════════════

  const getVisibleQuestions = useCallback((): QuestionId[] => {
    const visible: QuestionId[] = ['goal', 'experience', 'frequency', 'equipment', 'sessionLength', 'ageAndSex', 'trainingSplit'];

    // Show cardio prefs if training type includes cardio
    const hasCardio = trainingSplit.training_type === 'strength_plus_cardio' ||
                      trainingSplit.training_type === 'combined' ||
                      trainingSplit.training_type === 'cardio_focused';
    if (hasCardio) {
      visible.push('cardioPrefs');
    }

    // Show specific goal for Competition Prep or Athletic Performance
    if (goal === 'Competition Prep' || goal === 'Athletic Performance') {
      visible.push('specificGoal');
    }

    // Always show pain points and strength (optional)
    visible.push('painPoints', 'strength');

    return visible;
  }, [goal, trainingSplit.training_type]);

  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENCE & RESTORATION
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (isRestored && hasExistingSession) {
      setShowResumePrompt(true);
    }
  }, [isRestored, hasExistingSession]);

  const handleResume = useCallback(() => {
    if (persistedState.goal) setGoal(persistedState.goal as Goal);
    if (persistedState.experience) setExperience(persistedState.experience as Experience);
    if (persistedState.frequency) setFrequency(persistedState.frequency as Frequency);
    if (persistedState.equipment) setEquipment(persistedState.equipment as Equipment);
    if (persistedState.sessionLength) setSessionLength(persistedState.sessionLength as SessionLength);
    if (persistedState.painPoints) setPainPoints(persistedState.painPoints as PainPoint[]);
    if (persistedState.trainingSplit) setTrainingSplit(persistedState.trainingSplit);
    if (persistedState.userAge) setAge(persistedState.userAge);
    if (persistedState.userSex) setSex(persistedState.userSex);
    if (persistedState.specificGoal) setSpecificGoal(persistedState.specificGoal);
    if (persistedState.currentStrength) setCurrentStrength(persistedState.currentStrength);

    setPhase('questions');
    setShowResumePrompt(false);
    setCurrentQuestionIndex(0);
  }, [persistedState]);

  const handleStartFresh = useCallback(() => {
    startFresh();
    setShowResumePrompt(false);
  }, [startFresh]);

  // Persist state changes
  useEffect(() => {
    if (!isRestored || phase === 'opening') return;

    updatePersistedState({
      currentStep: getVisibleQuestions()[currentQuestionIndex] || 'goal',
      goal,
      experience,
      frequency,
      equipment: equipment || '',
      sessionLength: sessionLength || '60',
      painPoints,
      trainingSplit,
      userAge: age,
      userSex: sex,
      specificGoal,
      currentStrength,
    });
  }, [isRestored, phase, currentQuestionIndex, goal, experience, frequency, equipment, sessionLength, painPoints, trainingSplit, age, sex, specificGoal, currentStrength, updatePersistedState, getVisibleQuestions]);

  // ═══════════════════════════════════════════════════════════════════════
  // OPENING SEQUENCE
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (phase !== 'opening' || showResumePrompt) return;

    if (user?.id) {
      analytics.track(EventTypes.ONBOARDING_STARTED, { entryPoint: 'zen_onboarding' });
    }

    const timers: NodeJS.Timeout[] = [];
    const timings = [
      { beat: 'name' as OpeningBeat, delay: 500 },
      { beat: 'logo' as OpeningBeat, delay: 2000 },
      { beat: 'begin' as OpeningBeat, delay: 3500 },
    ];

    timings.forEach(({ beat, delay }) => {
      const timer = setTimeout(() => setOpeningBeat(beat), delay);
      timers.push(timer);
    });

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [phase, showResumePrompt, user?.id]);

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

  const visibleQuestions = getVisibleQuestions();
  const currentQuestion = visibleQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / visibleQuestions.length) * 100;

  const goToNextQuestion = useCallback(() => {
    const questions = getVisibleQuestions();
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setPhase('building');
    }
  }, [currentQuestionIndex, getVisibleQuestions]);

  const goToPrevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      haptic.light();
      setCurrentQuestionIndex(prev => prev - 1);
    } else {
      setPhase('opening');
      setOpeningBeat('begin');
    }
  }, [currentQuestionIndex, haptic]);

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
    setFilledDays([]);
    setActiveDay(0);

    try {
      // Build cardio preferences
      const cardioPrefs = (trainingSplit.training_type !== 'strength_only' && selectedCardioTypes.length > 0) ? {
        preferred_types: selectedCardioTypes,
        favorite_exercise: favoriteCardio,
        cardio_duration_minutes: cardioDuration,
      } : undefined;

      const planData = await generatePlanAction({
        userId: user?.id,
        preferences: {
          primary_goal: goal,
          experience_level: experience,
          training_frequency: frequency,
          pain_points: painPoints,
          equipment: equipment || undefined,
          preferred_session_length: sessionLength || undefined,
          sex: sex || undefined,
          age: age || undefined,
          current_strength: Object.keys(currentStrength).length > 0 ? currentStrength : undefined,
          training_split: {
            ...trainingSplit,
            cardio_preferences: cardioPrefs,
          },
          specific_goal: specificGoal || undefined,
        },
      });

      if (!planData || !planData.weeklyPlan || planData.weeklyPlan.length === 0) {
        throw new Error('Invalid plan generated');
      }

      const plan: Omit<WorkoutPlan, 'id'> = {
        ...planData,
        name: `${goal} Program`
      };

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
          sex: sex || undefined,
          age: age || undefined,
          current_strength: Object.keys(currentStrength).length > 0 ? currentStrength : undefined,
          training_split: trainingSplit || undefined,
          specific_goal: specificGoal || undefined,
        };

        await updateUserProfile({ trainingPreferences: preferences }).catch(() => {});
      }

      setGenerationProgress(100);
      setGeneratedPlan(plan);
      setShowSuccess(true);

      setTimeout(() => {
        setPhase('reveal');
        haptic.heavy();
      }, 1500);

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
  }, [goal, experience, frequency, painPoints, equipment, sessionLength, sex, age, currentStrength, trainingSplit, selectedCardioTypes, cardioDuration, favoriteCardio, specificGoal, user?.id, userProfile, generatePlanAction, incrementPlanUsageMutation, updateUserProfile, haptic]);

  // Trigger generation
  useEffect(() => {
    if (phase === 'building' && !isGenerating && !generatedPlan) {
      generatePlan();
    }
  }, [phase, isGenerating, generatedPlan, generatePlan]);

  // Progress animation synced to AI timing (~2-4 minutes for deepseek-reasoner)
  // Slower progress that matches actual backend generation time
  useEffect(() => {
    if (!isGenerating) return;

    // Progress rate designed to reach ~85% in ~3 minutes (180 seconds)
    // Phase 1: 0-30% in 45 seconds (0.67%/sec)
    // Phase 2: 30-60% in 60 seconds (0.5%/sec)
    // Phase 3: 60-85% in 75 seconds (0.33%/sec)
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev < 30) return prev + 0.67;      // ~45 seconds to reach 30%
        if (prev < 60) return prev + 0.5;       // ~60 more seconds to reach 60%
        if (prev < 85) return prev + 0.33;      // ~75 more seconds to reach 85%
        return 85; // Cap at 85% until actual completion
      });
    }, 1000);

    return () => clearInterval(progressInterval);
  }, [isGenerating]);

  // Map progress to filled days
  useEffect(() => {
    if (!isGenerating && !showSuccess) return;

    const targetProgress = showSuccess ? 100 : generationProgress;
    const dayCount = Math.min(Math.floor((targetProgress / 100) * 7), showSuccess ? 7 : 6);

    setFilledDays(Array.from({ length: dayCount }, (_, i) => i));
    setActiveDay(Math.min(dayCount, 6));

    // Update status text
    const statusMessages = [
      { threshold: 0, text: 'Analyzing your goals...' },
      { threshold: 20, text: 'Selecting exercises...' },
      { threshold: 40, text: 'Building your week...' },
      { threshold: 60, text: 'Optimizing for recovery...' },
      { threshold: 80, text: 'Adding finishing touches...' },
    ];
    const msg = [...statusMessages].reverse().find(m => targetProgress >= m.threshold);
    if (msg) setStatusText(msg.text);
  }, [generationProgress, isGenerating, showSuccess]);

  // Exercise type cycling
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setCurrentExercise(prev => (prev + 1) % 5);
    }, 800);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Success fill
  useEffect(() => {
    if (showSuccess) {
      setFilledDays([0, 1, 2, 3, 4, 5, 6]);
    }
  }, [showSuccess]);

  // ═══════════════════════════════════════════════════════════════════════
  // PLAN CONFIRMATION
  // ═══════════════════════════════════════════════════════════════════════

  const handleConfirmPlan = useCallback(() => {
    if (generatedPlan) {
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
  // RENDER: OPENING
  // ═══════════════════════════════════════════════════════════════════════

  const renderOpening = () => {
    const userName = user?.firstName || 'Athlete';

    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Top section with greeting */}
        <div className="pt-[max(4rem,env(safe-area-inset-top))] px-8">
          <div className={cn(
            'transition-all duration-1000 ease-out',
            openingBeat === 'dark' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          )}>
            {(openingBeat === 'name' || openingBeat === 'logo' || openingBeat === 'begin') && (
              <p className="text-white/70 text-sm font-medium tracking-wider uppercase mb-2">
                Welcome{userName !== 'Athlete' ? ` back, ${userName}` : ''}
              </p>
            )}
          </div>

          {/* Logo */}
          <div className={cn(
            'transition-all duration-700 ease-out mt-2',
            (openingBeat === 'logo' || openingBeat === 'begin') ? 'opacity-100' : 'opacity-0'
          )}>
            <div className="flex items-center">
              <span className="text-white font-black text-5xl tracking-tighter">RE</span>
              <span className="text-[#EF4444] font-black text-5xl tracking-tighter">BLD</span>
            </div>
          </div>
        </div>

        {/* Center section - Main choices */}
        <div className={cn(
          'flex-1 flex flex-col justify-center px-8',
          'transition-all duration-500 ease-out',
          openingBeat === 'begin' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}>
          <h2 className="text-white/90 text-2xl font-bold mb-8">
            Build Your<br />Training Plan
          </h2>

          {/* Option 1: AI Build */}
          <button
            onClick={handleBegin}
            className="w-full p-5 rounded-2xl bg-[#EF4444] text-left active:scale-[0.98] transition-transform mb-4 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-bold text-lg">CREATE MY PLAN</p>
                <p className="text-white/70 text-sm mt-1">
                  AI builds your personalized program
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <span className="px-2 py-1 rounded-md bg-white/20 text-white/90 text-xs font-medium">Periodization</span>
              <span className="px-2 py-1 rounded-md bg-white/20 text-white/90 text-xs font-medium">Sport-specific</span>
              <span className="px-2 py-1 rounded-md bg-white/20 text-white/90 text-xs font-medium">Smart weights</span>
            </div>
          </button>

          {/* Option 2: Import */}
          <button
            onClick={handleImportOwn}
            className="w-full p-5 rounded-2xl bg-white/[0.06] border border-white/10 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-bold text-lg">IMPORT MY PLAN</p>
                <p className="text-white/70 text-sm mt-1">
                  Paste or upload your existing program
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 8l-5-5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <span className="px-2 py-1 rounded-md bg-white/10 text-white/60 text-xs font-medium">Any format</span>
              <span className="px-2 py-1 rounded-md bg-white/10 text-white/60 text-xs font-medium">AI parsing</span>
            </div>
          </button>
        </div>

        {/* Bottom safe area */}
        <div className="pb-[max(2rem,env(safe-area-inset-bottom))]" />
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: QUESTIONS
  // ═══════════════════════════════════════════════════════════════════════

  const renderQuestions = () => {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <div className="pt-[max(1rem,env(safe-area-inset-top))] px-6">
          <button
            onClick={goToPrevQuestion}
            className="flex items-center gap-2 text-white/60 py-2 -ml-2 px-2 active:text-white transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="mt-4 h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#EF4444] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-2 text-white/70 text-xs font-medium tracking-wider">
            {currentQuestionIndex + 1} / {visibleQuestions.length}
          </p>
        </div>

        <div className="flex-1 flex flex-col px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] overflow-y-auto">
          {renderQuestionContent()}
        </div>
      </div>
    );
  };

  const renderQuestionContent = () => {
    switch (currentQuestion) {
      case 'goal':
        return (
          <QuestionCard headline="Your Goal" subtext="We'll optimize your entire program for this">
            <div className="space-y-3 mt-6">
              {[
                { id: 'Aesthetic Physique' as Goal, label: 'AESTHETIC', desc: 'Hypertrophy focus with strategic cardio', aiNote: '→ Volume-based training, muscle isolation' },
                { id: 'Strength & Power' as Goal, label: 'STRENGTH & POWER', desc: 'Progressive overload, compound-focused', aiNote: '→ Heavy compounds, deload weeks built in' },
                { id: 'Athletic Performance' as Goal, label: 'ATHLETIC', desc: 'Sport-specific conditioning', aiNote: '→ We\'ll ask about your sport next' },
                { id: 'Health & Longevity' as Goal, label: 'HEALTH & LONGEVITY', desc: 'Sustainable, balanced approach', aiNote: '→ Full-body, mobility, injury prevention' },
                { id: 'Competition Prep' as Goal, label: 'COMPETITION PREP', desc: 'Periodized peaking for your event', aiNote: '→ 4-phase periodization: base → build → peak → taper' },
              ].map(option => (
                <GoalCard
                  key={option.id}
                  selected={goal === option.id}
                  onClick={() => selectAndAdvance(() => setGoal(option.id))}
                  label={option.label}
                  description={option.desc}
                  aiNote={option.aiNote}
                />
              ))}
            </div>
          </QuestionCard>
        );

      case 'experience':
        return (
          <QuestionCard headline="Training History" subtext="We'll match your intensity">
            <div className="space-y-3 mt-6">
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
          <QuestionCard headline="Weekly Commitment" subtext="Days per week you can train">
            <div className="grid grid-cols-2 gap-3 mt-6">
              {[
                { id: '2-3' as Frequency, desc: 'Great start' },
                { id: '3-4' as Frequency, desc: 'Balanced' },
                { id: '4-5' as Frequency, desc: 'Serious' },
                { id: '5+' as Frequency, desc: 'Athlete' },
              ].map(option => (
                <NumberCard
                  key={option.id}
                  selected={frequency === option.id}
                  onClick={() => selectAndAdvance(() => setFrequency(option.id))}
                  value={option.id}
                  unit={option.desc}
                />
              ))}
            </div>
          </QuestionCard>
        );

      case 'equipment':
        return (
          <QuestionCard headline="Your Setup" subtext="We'll work with what you have">
            <div className="space-y-3 mt-6">
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
          <QuestionCard headline="Session Length" subtext="Including warmup and cooldown">
            <div className="grid grid-cols-3 gap-3 mt-6">
              {['30', '45', '60', '75', '90'].map(mins => (
                <NumberCard
                  key={mins}
                  selected={sessionLength === mins}
                  onClick={() => selectAndAdvance(() => setSessionLength(mins as SessionLength))}
                  value={mins}
                  unit="min"
                />
              ))}
            </div>
          </QuestionCard>
        );

      case 'ageAndSex':
        return (
          <QuestionCard headline="About You" subtext="Helps optimize recovery and intensity">
            <div className="space-y-6 mt-6">
              {/* Age */}
              <div>
                <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Age (optional)</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={age || ''}
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="25"
                  className="w-24 h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white text-lg font-bold text-center focus:border-[#EF4444] outline-none transition-colors"
                />
              </div>

              {/* Sex */}
              <div>
                <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Sex (optional)</p>
                <div className="flex gap-2">
                  {[
                    { id: 'male' as Sex, label: 'Male' },
                    { id: 'female' as Sex, label: 'Female' },
                    { id: 'other' as Sex, label: 'Other' },
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSex(option.id)}
                      className={cn(
                        'flex-1 h-12 rounded-xl font-semibold text-sm transition-all',
                        sex === option.id
                          ? 'bg-[#EF4444] text-white'
                          : 'bg-white/10 text-white/60 border border-white/20'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ContinueButton onClick={() => { haptic.medium(); goToNextQuestion(); }} />
          </QuestionCard>
        );

      case 'trainingSplit':
        return (
          <QuestionCard headline="Training Structure" subtext="Sessions per day and training type">
            <div className="space-y-6 mt-6">
              {/* Sessions per day */}
              <div>
                <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Sessions Per Day</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: '1' as const, label: 'Once Daily', desc: 'Single focused session' },
                    { id: '2' as const, label: 'Twice Daily', desc: 'AM/PM split' },
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setTrainingSplit(prev => ({ ...prev, sessions_per_day: option.id }))}
                      className={cn(
                        'p-4 rounded-xl text-left transition-all border-2',
                        trainingSplit.sessions_per_day === option.id
                          ? 'bg-[#EF4444] border-[#EF4444]'
                          : 'bg-white/5 border-white/10'
                      )}
                    >
                      <span className={cn('font-bold text-2xl', trainingSplit.sessions_per_day === option.id ? 'text-white' : 'text-white/90')}>
                        {option.id}x
                      </span>
                      <span className={cn('block text-sm font-semibold mt-1', trainingSplit.sessions_per_day === option.id ? 'text-white' : 'text-white/70')}>
                        {option.label}
                      </span>
                      <span className={cn('block text-xs mt-0.5', trainingSplit.sessions_per_day === option.id ? 'text-white/70' : 'text-white/70')}>
                        {option.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Training Type */}
              <div>
                <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Training Type</p>
                <div className="space-y-2">
                  {[
                    { id: 'strength_only' as TrainingType, label: 'Strength Only', desc: 'Pure resistance training' },
                    { id: 'strength_plus_cardio' as TrainingType, label: 'Strength + Cardio', desc: 'Separate sessions' },
                    { id: 'combined' as TrainingType, label: 'Combined', desc: 'Strength with cardio finishers' },
                    { id: 'cardio_focused' as TrainingType, label: 'Cardio Focused', desc: 'Endurance priority' },
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setTrainingSplit(prev => ({ ...prev, training_type: option.id }))}
                      className={cn(
                        'w-full p-4 rounded-xl text-left transition-all border-2 flex items-center justify-between',
                        trainingSplit.training_type === option.id
                          ? 'bg-[#EF4444] border-[#EF4444]'
                          : 'bg-white/5 border-white/10'
                      )}
                    >
                      <div>
                        <span className={cn('font-bold text-sm', trainingSplit.training_type === option.id ? 'text-white' : 'text-white/90')}>
                          {option.label}
                        </span>
                        <span className={cn('block text-xs mt-0.5', trainingSplit.training_type === option.id ? 'text-white/70' : 'text-white/70')}>
                          {option.desc}
                        </span>
                      </div>
                      {trainingSplit.training_type === option.id && (
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                          <CheckIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ContinueButton onClick={() => { haptic.medium(); goToNextQuestion(); }} />
          </QuestionCard>
        );

      case 'cardioPrefs':
        return (
          <QuestionCard headline="Cardio Preferences" subtext="Select your preferred types">
            <div className="space-y-6 mt-6">
              {/* Cardio Types */}
              <div>
                <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Cardio Types</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'running' as CardioType, emoji: '🏃', label: 'Run' },
                    { id: 'incline_walk' as CardioType, emoji: '🚶', label: 'Walk' },
                    { id: 'cycling' as CardioType, emoji: '🚴', label: 'Cycle' },
                    { id: 'rowing' as CardioType, emoji: '🚣', label: 'Row' },
                    { id: 'swimming' as CardioType, emoji: '🏊', label: 'Swim' },
                    { id: 'elliptical' as CardioType, emoji: '⚡', label: 'Ellip' },
                    { id: 'stair_climber' as CardioType, emoji: '🪜', label: 'Stairs' },
                    { id: 'hiking' as CardioType, emoji: '🥾', label: 'Hike' },
                  ].map(option => {
                    const isSelected = selectedCardioTypes.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          haptic.light();
                          setSelectedCardioTypes(prev =>
                            isSelected ? prev.filter(t => t !== option.id) : [...prev, option.id]
                          );
                        }}
                        className={cn(
                          'p-3 rounded-xl flex flex-col items-center justify-center transition-all border-2 min-h-[72px]',
                          isSelected ? 'bg-[#EF4444] border-[#EF4444]' : 'bg-white/5 border-white/10'
                        )}
                      >
                        <span className="text-xl mb-1">{option.emoji}</span>
                        <span className={cn('text-[10px] font-medium', isSelected ? 'text-white' : 'text-white/60')}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Session Length</p>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      onClick={() => setCardioDuration(mins)}
                      className={cn(
                        'py-3 rounded-xl font-bold text-sm transition-all border-2',
                        cardioDuration === mins ? 'bg-[#EF4444] border-[#EF4444] text-white' : 'bg-white/5 border-white/10 text-white/70'
                      )}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ContinueButton onClick={() => { haptic.medium(); goToNextQuestion(); }} />
          </QuestionCard>
        );

      case 'specificGoal':
        // Calculate weeks until event
        const weeksUntilEvent = specificGoal?.target_date
          ? Math.ceil((new Date(specificGoal.target_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
          : null;

        // Calculate phases (35% base, 35% build, 15% peak, 15% taper)
        const getPhases = (totalWeeks: number) => {
          const base = Math.max(1, Math.floor(totalWeeks * 0.35));
          const build = Math.max(1, Math.floor(totalWeeks * 0.35));
          const peak = Math.max(1, Math.floor(totalWeeks * 0.15));
          const taper = Math.max(1, totalWeeks - base - build - peak);
          return { base, build, peak, taper };
        };

        const phases = weeksUntilEvent && weeksUntilEvent > 0 ? getPhases(weeksUntilEvent) : null;

        return (
          <QuestionCard headline="Your Event" subtext="We'll create a periodized program to peak on time">
            <div className="space-y-6 mt-6">
              {/* Event Type */}
              <div>
                <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Event Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'hyrox', label: 'Hyrox', emoji: '🏃' },
                    { id: 'marathon', label: 'Marathon', emoji: '🏅' },
                    { id: 'half_marathon', label: 'Half', emoji: '🏅' },
                    { id: 'triathlon', label: 'Triathlon', emoji: '🏊' },
                    { id: 'powerlifting', label: 'Powerlifting', emoji: '🏋️' },
                    { id: 'bodybuilding', label: 'Bodybuilding', emoji: '💪' },
                    { id: 'crossfit', label: 'CrossFit', emoji: '⚡' },
                    { id: 'spartan', label: 'Spartan', emoji: '🏔️' },
                    { id: 'custom', label: 'Other', emoji: '🎯' },
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        haptic.light();
                        setSpecificGoal(prev => ({ ...prev, event_type: option.id } as SpecificGoal));
                      }}
                      className={cn(
                        'p-3 rounded-xl text-center transition-all border-2',
                        specificGoal?.event_type === option.id ? 'bg-[#EF4444] border-[#EF4444]' : 'bg-white/5 border-white/10'
                      )}
                    >
                      <span className="text-lg mb-1 block">{option.emoji}</span>
                      <span className={cn('text-[10px] font-bold', specificGoal?.event_type === option.id ? 'text-white' : 'text-white/70')}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Date */}
              {specificGoal?.event_type && (
                <div>
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Target Date</p>
                  <input
                    type="date"
                    value={specificGoal?.target_date || ''}
                    onChange={(e) => setSpecificGoal(prev => ({ ...prev, target_date: e.target.value || null } as SpecificGoal))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white focus:border-[#EF4444] outline-none"
                  />
                </div>
              )}

              {/* Periodization Preview */}
              {phases && weeksUntilEvent && weeksUntilEvent > 0 && (
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-white font-bold text-sm">Your Training Phases</p>
                    <p className="text-[#EF4444] font-bold text-sm">{weeksUntilEvent} weeks</p>
                  </div>

                  {/* Phase bars */}
                  <div className="flex h-2 rounded-full overflow-hidden mb-4">
                    <div style={{ width: `${(phases.base / weeksUntilEvent) * 100}%` }} className="bg-blue-500" />
                    <div style={{ width: `${(phases.build / weeksUntilEvent) * 100}%` }} className="bg-yellow-500" />
                    <div style={{ width: `${(phases.peak / weeksUntilEvent) * 100}%` }} className="bg-orange-500" />
                    <div style={{ width: `${(phases.taper / weeksUntilEvent) * 100}%` }} className="bg-green-500" />
                  </div>

                  {/* Phase details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-white/70">Base ({phases.base}w)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-white/70">Build ({phases.build}w)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      <span className="text-white/70">Peak ({phases.peak}w)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-white/70">Taper ({phases.taper}w)</span>
                    </div>
                  </div>

                  <p className="text-white/70 text-[10px] mt-3">
                    Deload weeks automatically scheduled every 4 weeks
                  </p>
                </div>
              )}
            </div>

            <ContinueButton onClick={() => { haptic.medium(); goToNextQuestion(); }} label={specificGoal?.event_type ? 'Continue' : 'Skip'} />
          </QuestionCard>
        );

      case 'painPoints':
        return (
          <QuestionCard headline="Areas to Protect" subtext="We'll program around them (optional)">
            <div className="flex flex-wrap gap-2 mt-6">
              {(['Knees', 'Lower Back', 'Shoulders', 'Wrists'] as PainPoint[]).map(point => (
                <PillButton
                  key={point}
                  selected={painPoints.includes(point)}
                  onClick={() => {
                    haptic.light();
                    setPainPoints(prev => prev.includes(point) ? prev.filter(p => p !== point) : [...prev, point]);
                  }}
                  label={point.toUpperCase()}
                />
              ))}
            </div>

            <ContinueButton onClick={() => { haptic.medium(); goToNextQuestion(); }} label={painPoints.length > 0 ? 'Continue' : 'Skip'} />
          </QuestionCard>
        );

      case 'strength':
        return (
          <QuestionCard headline="Current Numbers" subtext="Helps us estimate starting weights (optional)">
            <div className="mt-6">
              <button
                onClick={() => setShowStrengthInputs(!showStrengthInputs)}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-semibold text-sm border border-white/20"
              >
                {showStrengthInputs ? 'Hide Strength Inputs' : 'Add Strength Numbers'}
              </button>

              {showStrengthInputs && (
                <div className="mt-4 space-y-4 p-4 bg-white/5 rounded-xl">
                  <p className="text-white/70 text-xs">8-10 rep max (kg)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'squat_kg', label: 'Squat' },
                      { key: 'bench_kg', label: 'Bench' },
                      { key: 'deadlift_kg', label: 'Deadlift' },
                      { key: 'row_kg', label: 'Row' },
                      { key: 'overhead_press_kg', label: 'OHP' },
                    ].map(field => (
                      <div key={field.key} className="flex items-center gap-2">
                        <span className="text-white/60 text-xs w-16">{field.label}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={(currentStrength as any)[field.key] || ''}
                          onChange={(e) => setCurrentStrength(prev => ({ ...prev, [field.key]: e.target.value ? parseInt(e.target.value) : undefined }))}
                          placeholder="kg"
                          className="flex-1 h-10 px-3 bg-white/10 rounded-lg text-white text-sm text-center border border-white/20 focus:border-[#EF4444] outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { haptic.medium(); goToNextQuestion(); }}
              className="w-full h-14 mt-8 rounded-xl font-bold text-base uppercase tracking-wider bg-[#EF4444] text-white active:scale-[0.98] transition-transform"
            >
              Generate My Plan
            </button>
          </QuestionCard>
        );

      default:
        return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: BUILDING (Day-by-day animation)
  // ═══════════════════════════════════════════════════════════════════════

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const exerciseTypes = ['🔥 Warmup', '💪 Compound', '🎯 Accessory', '⚡ Core', '🧘 Cooldown'];

  const renderBuilding = () => {
    if (showSuccess) {
      return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8">
          <div className="flex gap-2 mb-8">
            {days.map((day, idx) => (
              <div
                key={idx}
                className="w-10 h-14 rounded-lg bg-[#EF4444] flex flex-col items-center justify-center animate-[day-pop_0.4s_ease-out_backwards]"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <span className="text-[10px] font-bold text-white/70 uppercase">{day}</span>
                <CheckIcon className="w-4 h-4 text-white mt-0.5" />
              </div>
            ))}
          </div>

          <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
            Your Week is Ready
          </h3>
          <p className="text-white/60 text-sm">
            7 days of personalized training
          </p>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8">
        {error && (
          <div className="absolute top-[max(6rem,env(safe-area-inset-top))] left-6 right-6">
            <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4">
              <p className="text-red-400 text-sm text-center">{error}</p>
              <button
                onClick={() => { setError(null); setIsGenerating(false); generatePlan(); }}
                className="w-full mt-3 py-2 text-red-400 font-medium text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Week builder */}
        <div className="flex gap-2 mb-8">
          {days.map((day, idx) => {
            const isFilled = filledDays.includes(idx);
            const isActive = activeDay === idx && !isFilled;

            return (
              <div
                key={idx}
                className={cn(
                  'relative w-10 h-16 rounded-lg transition-all duration-500 flex flex-col items-center justify-center overflow-hidden',
                  isFilled ? 'bg-[#EF4444]' : isActive ? 'bg-white/20' : 'bg-white/10'
                )}
              >
                <span className={cn('text-[11px] font-bold uppercase', isFilled ? 'text-white/80' : 'text-white/70')}>
                  {day}
                </span>

                {isActive && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-[#EF4444] animate-[fill-up_2.5s_ease-out_forwards]" />
                  </div>
                )}

                {isFilled && <CheckIcon className="w-4 h-4 text-white mt-1 animate-[pop-in_0.3s_ease-out]" />}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs h-1 bg-white/10 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-[#EF4444] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${generationProgress}%` }}
          />
        </div>

        {/* Current exercise indicator */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{exerciseTypes[currentExercise].split(' ')[0]}</span>
          <div>
            <p className="text-white font-bold text-sm">Adding {exerciseTypes[currentExercise].split(' ')[1]}</p>
            <p className="text-white/70 text-xs">Day {Math.min(filledDays.length + 1, 7)} of 7</p>
          </div>
        </div>

        <p className="text-white font-black text-lg uppercase tracking-wide mb-1">
          Building Your Week
        </p>
        <p className="text-white/70 text-xs mb-1">{statusText}</p>
        <p className="text-white/70 text-xs tabular-nums">{Math.round(generationProgress)}% complete</p>

        <p className="text-white/70 text-xs mt-6">
          Typically takes 2-4 minutes
        </p>

        <style>{`
          @keyframes fill-up { 0% { height: 0%; } 100% { height: 100%; } }
          @keyframes pop-in { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
          @keyframes day-pop { 0% { transform: scale(0) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        `}</style>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: REVEAL
  // ═══════════════════════════════════════════════════════════════════════

  const renderReveal = () => {
    const exerciseCount = generatedPlan?.weeklyPlan?.reduce(
      (acc, day) => acc + (day.blocks?.reduce((a, b) => a + (b.exercises?.length || 0), 0) || 0), 0
    ) || 0;

    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-24 h-24 rounded-full bg-[#EF4444] flex items-center justify-center mb-8 animate-[scale-in_0.5s_ease-out]">
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-white font-black text-4xl text-center mb-4">
            Your Program<br />Is Ready
          </h1>

          <p className="text-white/70 text-center">
            {generatedPlan?.weeklyPlan?.length || 0} training days · {exerciseCount} exercises
          </p>

          <div className="flex flex-wrap justify-center gap-2 mt-6">
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

        <div className="px-8 pb-[max(3rem,env(safe-area-inset-bottom))]">
          <button
            onClick={handleConfirmPlan}
            className="w-full h-16 rounded-2xl font-bold text-lg uppercase tracking-wider bg-[#EF4444] text-white active:scale-[0.98] transition-transform shadow-[0_0_40px_rgba(239,68,68,0.3)]"
          >
            Start Training
          </button>
        </div>

        <style>{`
          @keyframes scale-in { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        `}</style>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: CUSTOM IMPORT
  // ═══════════════════════════════════════════════════════════════════════

  // Plan import handler
  const handleParsePlan = async () => {
    if (!importText.trim()) {
      setError('Please paste your workout plan');
      return;
    }

    setIsParsing(true);
    setError(null);
    setParseProgress(0);

    try {
      // Progress simulation
      const progressInterval = setInterval(() => {
        setParseProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await parsePlanAction({
        userId: user?.id,
        planText: importText,
      });

      clearInterval(progressInterval);
      setParseProgress(100);

      if (result && result.weeklyPlan) {
        const plan: Omit<WorkoutPlan, 'id'> = {
          ...result,
          name: 'Imported Program'
        };
        setGeneratedPlan(plan);

        setTimeout(() => {
          setPhase('reveal');
          haptic.heavy();
        }, 500);
      } else {
        throw new Error('Could not parse your plan');
      }
    } catch (e: any) {
      console.error('Parse failed:', e);
      setError(e?.message || 'Failed to parse plan. Try a different format.');
      setIsParsing(false);
    }
  };

  const renderCustom = () => (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="pt-[max(1rem,env(safe-area-inset-top))] px-6">
        <button
          onClick={() => { setPhase('opening'); setImportText(''); setError(null); }}
          className="flex items-center gap-2 text-white/60 py-2 -ml-2 px-2 active:text-white transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <h1 className="text-white font-black text-3xl leading-tight">Import Your Plan</h1>
        <p className="text-white/70 text-sm mt-2 mb-6">
          Paste your workout program below. Our AI will convert it into a trackable format.
        </p>

        {/* Text area */}
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={`Example:

Day 1 - Upper
Bench Press 4x8-10
Rows 4x8-10
OHP 3x10-12
Pulldowns 3x10-12

Day 2 - Lower
Squats 4x6-8
RDL 3x10-12
Leg Press 3x12-15
...`}
          className="flex-1 w-full p-4 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm resize-none focus:border-[#EF4444] outline-none placeholder:text-white/70"
          disabled={isParsing}
        />

        {/* Supported formats */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="px-2 py-1 rounded-md bg-white/[0.06] text-white/70 text-xs">Text</span>
          <span className="px-2 py-1 rounded-md bg-white/[0.06] text-white/70 text-xs">Markdown</span>
          <span className="px-2 py-1 rounded-md bg-white/[0.06] text-white/70 text-xs">Coach notes</span>
          <span className="px-2 py-1 rounded-md bg-white/[0.06] text-white/70 text-xs">Spreadsheet copy</span>
          <span className="px-2 py-1 rounded-md bg-white/[0.06] text-white/70 text-xs">Any format</span>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Progress */}
        {isParsing && (
          <div className="mt-4">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#EF4444] transition-all duration-300"
                style={{ width: `${parseProgress}%` }}
              />
            </div>
            <p className="text-white/70 text-xs mt-2">Analyzing your program...</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleParsePlan}
          disabled={isParsing || !importText.trim()}
          className={cn(
            'w-full h-14 mt-6 rounded-xl font-bold text-base uppercase tracking-wider transition-all',
            isParsing || !importText.trim()
              ? 'bg-white/10 text-white/70'
              : 'bg-[#EF4444] text-white active:scale-[0.98]'
          )}
        >
          {isParsing ? 'Parsing...' : 'Import Plan'}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════

  if (showResumePrompt) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-6 z-50">
        <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
          <h3 className="text-white font-bold text-xl mb-2">Resume Setup?</h3>
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
              className="flex-1 h-12 rounded-xl font-bold text-sm text-white bg-[#EF4444] active:scale-[0.98] transition-transform"
            >
              Resume
            </button>
          </div>
        </div>
      </div>
    );
  }

  switch (phase) {
    case 'opening': return renderOpening();
    case 'questions': return renderQuestions();
    case 'building': return renderBuilding();
    case 'reveal': return renderReveal();
    case 'custom': return renderCustom();
    default: return renderOpening();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function QuestionCard({ headline, subtext, children }: { headline: string; subtext: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <h1 className="text-white font-black text-3xl leading-tight">{headline}</h1>
      <p className="text-white/70 text-base mt-2">{subtext}</p>
      {children}
    </div>
  );
}

interface SelectionCardProps extends React.HTMLAttributes<HTMLButtonElement> {
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
        'w-full p-4 rounded-xl text-left transition-all duration-150 active:scale-[0.98] border-2',
        selected ? 'bg-[#EF4444] border-[#EF4444]' : 'bg-white/5 border-white/10 active:border-white/30'
      )}
    >
      <p className={cn('font-bold text-sm tracking-wider', selected ? 'text-white' : 'text-white/90')}>{label}</p>
      <p className={cn('text-sm mt-0.5', selected ? 'text-white/70' : 'text-white/70')}>{description}</p>
    </button>
  );
}

interface NumberCardProps extends React.HTMLAttributes<HTMLButtonElement> {
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
        'flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-150 active:scale-[0.97] border-2 min-h-[88px]',
        selected ? 'bg-[#EF4444] border-[#EF4444]' : 'bg-white/5 border-white/10 active:border-white/30'
      )}
    >
      <span className={cn('font-black text-3xl', selected ? 'text-white' : 'text-white/90')}>{value}</span>
      {unit && <span className={cn('text-xs mt-1 font-medium', selected ? 'text-white/70' : 'text-white/60')}>{unit}</span>}
    </button>
  );
}

interface PillButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  onClick: () => void;
  label: string;
}

function PillButton({ selected, onClick, label }: PillButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-5 py-3 rounded-full transition-all duration-150 active:scale-[0.97] border-2 font-semibold text-sm',
        selected ? 'bg-[#EF4444] border-[#EF4444] text-white' : 'bg-transparent border-white/20 text-white/60 active:border-white/40'
      )}
    >
      {label}
    </button>
  );
}

function ContinueButton({ onClick, label = 'Continue' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-14 mt-8 rounded-xl font-bold text-base uppercase tracking-wider bg-[#EF4444] text-white active:scale-[0.98] transition-transform"
    >
      {label}
    </button>
  );
}

// Goal card with AI explanation
interface GoalCardProps extends React.HTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  onClick: () => void;
  label: string;
  description: string;
  aiNote: string;
}

function GoalCard({ selected, onClick, label, description, aiNote }: GoalCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-xl text-left transition-all duration-150 active:scale-[0.98] border-2',
        selected ? 'bg-[#EF4444] border-[#EF4444]' : 'bg-white/5 border-white/10 active:border-white/30'
      )}
    >
      <p className={cn('font-bold text-sm tracking-wider', selected ? 'text-white' : 'text-white/90')}>{label}</p>
      <p className={cn('text-sm mt-0.5', selected ? 'text-white/70' : 'text-white/70')}>{description}</p>
      <p className={cn('text-xs mt-2 italic', selected ? 'text-white/60' : 'text-white/70')}>{aiNote}</p>
    </button>
  );
}
