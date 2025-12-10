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
   ZEN ONBOARDING - COMPLETE VERSION

   Includes ALL required fields:
   - Goal, Experience, Frequency (required)
   - Equipment, Session Length (required)
   - Age, Sex (optional but important for AI)
   - Training Split (1x/2x daily, training type)
   - Cardio Preferences (type, duration)
   - Competition/Event Goal (conditional)
   - Pain Points (optional)
   - Current Strength (optional)

   Design: Cinematic opening → Full-screen questions → Day-by-day building animation
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

  // Progress animation synced to AI timing (~45-50 seconds)
  useEffect(() => {
    if (!isGenerating) return;

    const statusMessages = [
      { threshold: 0, text: 'Analyzing your goals...' },
      { threshold: 20, text: 'Selecting exercises...' },
      { threshold: 40, text: 'Building your week...' },
      { threshold: 60, text: 'Optimizing for recovery...' },
      { threshold: 80, text: 'Adding finishing touches...' },
      { threshold: 90, text: 'Almost ready...' },
    ];

    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev < 30) return prev + 2.5;
        if (prev < 60) return prev + 2;
        if (prev < 85) return prev + 1.4;
        return 85;
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
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8">
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

        <div className={cn(
          'mt-16 transition-all duration-700 ease-out',
          (openingBeat === 'logo' || openingBeat === 'begin') ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        )}>
          <div className="flex items-center justify-center">
            <span className="text-white font-black text-6xl tracking-tighter">RE</span>
            <span className="text-[#E07A5F] font-black text-6xl tracking-tighter">BLD</span>
          </div>
          <p className="text-white/40 text-center mt-2 text-sm tracking-[0.3em] uppercase">
            Transform
          </p>
        </div>

        <div className={cn(
          'absolute bottom-0 left-0 right-0 px-8 pb-[max(3rem,env(safe-area-inset-bottom))]',
          'transition-all duration-500 ease-out',
          openingBeat === 'begin' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}>
          <button
            onClick={handleBegin}
            className="w-full h-16 rounded-2xl font-bold text-lg uppercase tracking-wider bg-[#E07A5F] text-white active:scale-[0.98] transition-transform shadow-[0_0_40px_rgba(224,122,95,0.3)]"
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
              className="h-full bg-[#E07A5F] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-2 text-white/30 text-xs font-medium tracking-wider">
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
          <QuestionCard headline="What's Your Drive?" subtext="This shapes everything we build for you">
            <div className="space-y-3 mt-6">
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
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Age (optional)</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={age || ''}
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="25"
                  className="w-24 h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white text-lg font-bold text-center focus:border-[#E07A5F] outline-none transition-colors"
                />
              </div>

              {/* Sex */}
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Sex (optional)</p>
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
                          ? 'bg-[#E07A5F] text-white'
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
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Sessions Per Day</p>
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
                          ? 'bg-[#E07A5F] border-[#E07A5F]'
                          : 'bg-white/5 border-white/10'
                      )}
                    >
                      <span className={cn('font-bold text-2xl', trainingSplit.sessions_per_day === option.id ? 'text-white' : 'text-white/90')}>
                        {option.id}x
                      </span>
                      <span className={cn('block text-sm font-semibold mt-1', trainingSplit.sessions_per_day === option.id ? 'text-white' : 'text-white/70')}>
                        {option.label}
                      </span>
                      <span className={cn('block text-xs mt-0.5', trainingSplit.sessions_per_day === option.id ? 'text-white/70' : 'text-white/40')}>
                        {option.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Training Type */}
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Training Type</p>
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
                          ? 'bg-[#E07A5F] border-[#E07A5F]'
                          : 'bg-white/5 border-white/10'
                      )}
                    >
                      <div>
                        <span className={cn('font-bold text-sm', trainingSplit.training_type === option.id ? 'text-white' : 'text-white/90')}>
                          {option.label}
                        </span>
                        <span className={cn('block text-xs mt-0.5', trainingSplit.training_type === option.id ? 'text-white/70' : 'text-white/40')}>
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
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Cardio Types</p>
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
                          isSelected ? 'bg-[#E07A5F] border-[#E07A5F]' : 'bg-white/5 border-white/10'
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
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Session Length</p>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      onClick={() => setCardioDuration(mins)}
                      className={cn(
                        'py-3 rounded-xl font-bold text-sm transition-all border-2',
                        cardioDuration === mins ? 'bg-[#E07A5F] border-[#E07A5F] text-white' : 'bg-white/5 border-white/10 text-white/70'
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
        return (
          <QuestionCard headline="Your Event" subtext="We'll periodize your program">
            <div className="space-y-6 mt-6">
              {/* Event Type */}
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Event Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'hyrox', label: 'Hyrox' },
                    { id: 'marathon', label: 'Marathon' },
                    { id: 'half_marathon', label: 'Half' },
                    { id: 'triathlon', label: 'Triathlon' },
                    { id: 'powerlifting', label: 'Powerlifting' },
                    { id: 'bodybuilding', label: 'Bodybuilding' },
                    { id: 'crossfit', label: 'CrossFit' },
                    { id: 'spartan', label: 'Spartan' },
                    { id: 'custom', label: 'Other' },
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSpecificGoal(prev => ({ ...prev, event_type: option.id } as SpecificGoal))}
                      className={cn(
                        'p-3 rounded-xl text-center transition-all border-2',
                        specificGoal?.event_type === option.id ? 'bg-[#E07A5F] border-[#E07A5F]' : 'bg-white/5 border-white/10'
                      )}
                    >
                      <span className={cn('text-xs font-bold', specificGoal?.event_type === option.id ? 'text-white' : 'text-white/70')}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Date */}
              {specificGoal?.event_type && (
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Target Date</p>
                  <input
                    type="date"
                    value={specificGoal?.target_date || ''}
                    onChange={(e) => setSpecificGoal(prev => ({ ...prev, target_date: e.target.value || null } as SpecificGoal))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white focus:border-[#E07A5F] outline-none"
                  />
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
                  <p className="text-white/40 text-xs">8-10 rep max (kg)</p>
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
                          className="flex-1 h-10 px-3 bg-white/10 rounded-lg text-white text-sm text-center border border-white/20 focus:border-[#E07A5F] outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { haptic.medium(); goToNextQuestion(); }}
              className="w-full h-14 mt-8 rounded-xl font-bold text-base uppercase tracking-wider bg-[#E07A5F] text-white active:scale-[0.98] transition-transform"
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
                className="w-10 h-14 rounded-lg bg-[#E07A5F] flex flex-col items-center justify-center animate-[day-pop_0.4s_ease-out_backwards]"
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
                  isFilled ? 'bg-[#E07A5F]' : isActive ? 'bg-white/20' : 'bg-white/10'
                )}
              >
                <span className={cn('text-[11px] font-bold uppercase', isFilled ? 'text-white/80' : 'text-white/40')}>
                  {day}
                </span>

                {isActive && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-[#E07A5F] animate-[fill-up_2.5s_ease-out_forwards]" />
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
            className="h-full bg-[#E07A5F] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${generationProgress}%` }}
          />
        </div>

        {/* Current exercise indicator */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{exerciseTypes[currentExercise].split(' ')[0]}</span>
          <div>
            <p className="text-white font-bold text-sm">Adding {exerciseTypes[currentExercise].split(' ')[1]}</p>
            <p className="text-white/40 text-xs">Day {Math.min(filledDays.length + 1, 7)} of 7</p>
          </div>
        </div>

        <p className="text-white font-black text-lg uppercase tracking-wide mb-1">
          Building Your Week
        </p>
        <p className="text-white/40 text-xs mb-1">{statusText}</p>
        <p className="text-white/30 text-xs tabular-nums">{Math.round(generationProgress)}% complete</p>

        <p className="text-white/20 text-xs mt-6">
          Typically takes 1-2 minutes
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
          <div className="w-24 h-24 rounded-full bg-[#E07A5F] flex items-center justify-center mb-8 animate-[scale-in_0.5s_ease-out]">
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-white font-black text-4xl text-center mb-4">
            Your Program<br />Is Ready
          </h1>

          <p className="text-white/40 text-center">
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
            className="w-full h-16 rounded-2xl font-bold text-lg uppercase tracking-wider bg-[#E07A5F] text-white active:scale-[0.98] transition-transform shadow-[0_0_40px_rgba(224,122,95,0.3)]"
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

  const renderCustom = () => (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8">
      <p className="text-white/60 text-center mb-8">Custom plan import coming soon</p>
      <button
        onClick={() => setPhase('opening')}
        className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium"
      >
        Go Back
      </button>
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
      <p className="text-white/40 text-base mt-2">{subtext}</p>
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
        selected ? 'bg-[#E07A5F] border-[#E07A5F]' : 'bg-white/5 border-white/10 active:border-white/30'
      )}
    >
      <p className={cn('font-bold text-sm tracking-wider', selected ? 'text-white' : 'text-white/90')}>{label}</p>
      <p className={cn('text-sm mt-0.5', selected ? 'text-white/70' : 'text-white/40')}>{description}</p>
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
        selected ? 'bg-[#E07A5F] border-[#E07A5F]' : 'bg-white/5 border-white/10 active:border-white/30'
      )}
    >
      <span className={cn('font-black text-3xl', selected ? 'text-white' : 'text-white/90')}>{value}</span>
      {unit && <span className={cn('text-xs mt-1 font-medium', selected ? 'text-white/70' : 'text-white/40')}>{unit}</span>}
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
        selected ? 'bg-[#E07A5F] border-[#E07A5F] text-white' : 'bg-transparent border-white/20 text-white/60 active:border-white/40'
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
      className="w-full h-14 mt-8 rounded-xl font-bold text-base uppercase tracking-wider bg-[#E07A5F] text-white active:scale-[0.98] transition-transform"
    >
      {label}
    </button>
  );
}
