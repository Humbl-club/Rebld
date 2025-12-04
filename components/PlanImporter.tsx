import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutPlan, TrainingPreferences, TrainingSplit, SpecificGoal, BodyMetrics } from '../types';
import { LogoIcon, UploadIcon, SparklesIcon, XCircleIcon, DocumentIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon } from './icons';
import { useUser } from '@clerk/clerk-react';
import useUserProfile from '../hooks/useUserProfile';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { hasExceededLimit, getLimitMessage, getRemainingUsage } from '../lib/rateLimiter';
import { analytics, EventTypes } from '../services/analyticsService';

// New onboarding step components
import TrainingSplitStep from './onboarding/TrainingSplitStep';
import SpecificGoalStep from './onboarding/SpecificGoalStep';
import PlanPreviewStep from './onboarding/PlanPreviewStep';

interface OnboardingProps {
  onPlanGenerated: (plan: Omit<WorkoutPlan, 'id'>) => void;
}

// Streamlined onboarding flow - 5 screens (was 9)
type OnboardingStep = 'welcome' | 'essentials' | 'goal' | 'customize' | 'generate' | 'preview' | 'custom';
type Goal = 'Aesthetic Physique' | 'Strength & Power' | 'Athletic Performance' | 'Health & Longevity' | 'Competition Prep';
type Experience = 'Beginner' | 'Intermediate' | 'Advanced';
type Frequency = '2-3' | '3-4' | '4-5' | '5+';
type PainPoint = 'Knees' | 'Lower Back' | 'Shoulders' | 'Wrists';

// Helper function to get pain point options with translations
const getPainPointsOptions = (t: (key: string) => string): { id: PainPoint, label: string }[] => [
    { id: 'Knees', label: t('onboarding.painPoints.knees.label') || 'Knees' },
    { id: 'Lower Back', label: t('onboarding.painPoints.lowerBack.label') || 'Lower Back' },
    { id: 'Shoulders', label: t('onboarding.painPoints.shoulders.label') || 'Shoulders' },
    { id: 'Wrists', label: t('onboarding.painPoints.wrists.label') || 'Wrists' },
];

// Helper function to get goal options with translations - Freeletics-style clean design
const getGoalOptions = (t: (key: string) => string): { id: Goal, label: string, subtitle: string }[] => [
    { id: 'Aesthetic Physique', label: t('onboarding.goals.aestheticPhysique.label'), subtitle: 'Build muscle, reduce body fat' },
    { id: 'Strength & Power', label: t('onboarding.goals.strengthPower.label'), subtitle: 'Increase 1RM and power output' },
    { id: 'Athletic Performance', label: t('onboarding.goals.athleticPerformance.label'), subtitle: 'Sport-specific conditioning' },
    { id: 'Health & Longevity', label: t('onboarding.goals.healthLongevity.label'), subtitle: 'Sustainable fitness for life' },
    { id: 'Competition Prep', label: 'Competition Prep', subtitle: 'Prepare for a specific event' },
];


export default function Onboarding({ onPlanGenerated }: OnboardingProps) {
  const { t } = useTranslation();
  const { user } = useUser();
  const { userProfile, updateUserProfile } = useUserProfile();
  const incrementPlanUsageMutation = useMutation(api.mutations.incrementPlanUsage);
  const incrementParseUsageMutation = useMutation(api.mutations.incrementParseUsage);
  const generatePlanAction = useAction(api.ai.generateWorkoutPlan);
  const parseWorkoutPlanAction = useAction(api.ai.parseWorkoutPlan);
  const [step, setStep] = useState<OnboardingStep>('welcome');

  // Core essentials (Step 2)
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);

  // Setup (Step 3)
  const [equipment, setEquipment] = useState<'minimal' | 'home_gym' | 'commercial_gym' | ''>('');
  const [sessionLength, setSessionLength] = useState<'30' | '45' | '60' | '75' | ''>('60'); // Default 60 min

  // Customize (Step 4 - optional)
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [sport, setSport] = useState('');

  // NEW: Advanced onboarding data
  const [trainingSplit, setTrainingSplit] = useState<TrainingSplit | null>(null);
  const [specificGoal, setSpecificGoal] = useState<SpecificGoal | null>(null);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetrics | null>(null);
  const [userSex, setUserSex] = useState<'male' | 'female' | 'other' | undefined>(undefined);

  // Custom plan import
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Generated plan for preview
  const [generatedPlan, setGeneratedPlan] = useState<Omit<WorkoutPlan, 'id'> | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [onboardingStartTime, setOnboardingStartTime] = useState<number | null>(null);

  // Track onboarding start
  useEffect(() => {
    if (step === 'welcome' && !onboardingStartTime) {
      setOnboardingStartTime(Date.now());
      if (user?.id) {
        analytics.track(EventTypes.ONBOARDING_STARTED, {
          entryPoint: 'home_screen',
        });
      }
    }
  }, [step, user?.id, onboardingStartTime]);

  // Streamlined 5-screen flow (was 9 screens)
  const getStepOrder = (): OnboardingStep[] => {
    const baseSteps: OnboardingStep[] = ['welcome', 'essentials'];

    // Add specific goal step only if Competition Prep is selected
    if (goal === 'Competition Prep') {
      baseSteps.push('goal');
    }

    // Customize includes training split, pain points, sport, and advanced options
    baseSteps.push('customize', 'generate');

    return baseSteps;
  };

  const getCurrentStepNumber = (): number => {
    if (step === 'custom') return 1;
    const steps = getStepOrder();
    const index = steps.indexOf(step);
    return index >= 0 ? index : 0;
  };

  const getTotalSteps = (): number => {
    if (step === 'custom') return 1;
    // Don't count welcome and generate in visible steps
    return getStepOrder().filter(s => s !== 'welcome' && s !== 'generate').length;
  };
  
  const handleGeneratePersonalizedPlan = useCallback(async () => {
    if (!goal || !experience || !frequency) {
        setError(t('onboarding.missingSelections'));
        return;
    }

    // Check rate limits before generating plan
    if (user?.id && userProfile) {
      const tier = userProfile.apiUsage?.tier || 'free';
      const usage = userProfile.apiUsage;

      if (usage && hasExceededLimit(usage, tier, 'plan')) {
        const remaining = getRemainingUsage(usage, tier);
        setError(getLimitMessage('plan', tier, remaining));
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    // Start timer for plan generation
    const endTimer = analytics.startTimer(EventTypes.PLAN_GENERATED);

    try {
        // Use server-side Convex action for secure API key handling
        const planData = await generatePlanAction({
          userId: user?.id,
          preferences: {
            primary_goal: goal,
            experience_level: experience,
            training_frequency: frequency,
            pain_points: painPoints,
            sport: sport || undefined,
            equipment: equipment || undefined,
            preferred_session_length: sessionLength || undefined,
            sex: userSex || undefined,
            training_split: trainingSplit || undefined,
            // Pass specific goal for competition prep/event training
            specific_goal: specificGoal || undefined,
          },
        });

        if (!planData || !planData.weeklyPlan || planData.weeklyPlan.length === 0) {
            throw new Error(t('onboarding.invalidPlan'));
        }

        const plan: Omit<WorkoutPlan, 'id'> = {
            ...planData,
            name: `${goal} Program`
        };

        // Track plan generation for rate limiting
        if (user?.id) {
            await incrementPlanUsageMutation({ userId: user.id });
        }

        // Save user preferences to profile (including new fields)
        if (user?.id) {
            const preferences: TrainingPreferences = {
                primary_goal: goal,
                goal_explanation: null,
                experience_level: experience,
                training_frequency: frequency,
                pain_points: painPoints,
                sport: sport.trim() || null,
                sport_specific: null,
                additional_notes: null,
                last_updated: new Date().toISOString(),
                equipment: equipment || undefined,
                preferred_session_length: sessionLength || undefined,
                sex: userSex,
                training_split: trainingSplit || undefined,
                specific_goal: specificGoal || undefined,
            };

            try {
                await updateUserProfile({
                    trainingPreferences: preferences,
                    bodyMetrics: bodyMetrics || undefined,
                });
            } catch (e) {
                // Don't block plan generation if preferences save fails
            }
        }

        // Track successful plan generation
        endTimer({
          goal,
          experience,
          frequency,
          painPointsCount: painPoints.length,
          hasSport: !!sport,
          equipment: equipment || 'not_specified',
          sessionLength: sessionLength || 'not_specified',
          hasSex: !!userSex,
        });

        // Store the generated plan and show preview
        setIsLoading(false);
        setShowSuccess(true);
        setGeneratedPlan(plan);

        // Navigate to preview after success animation
        setTimeout(() => {
            setShowSuccess(false);
            setStep('preview');
        }, 1500);
        return; // Don't reset isLoading since we're showing success
    } catch (e) {
        console.error('Error generating plan:', e);
        setError('We hit a temporary issue reaching the AI planner. Please try again.');

        // Track plan generation failure
        analytics.trackError(EventTypes.PLAN_GENERATION_FAILED, e as Error, {
          goal,
          experience,
          frequency,
        });

        setIsLoading(false);
        return;
    }
  }, [goal, experience, frequency, painPoints, sport, equipment, sessionLength, onPlanGenerated, user, userProfile, updateUserProfile, incrementPlanUsageMutation, t]);

  // Handle regenerating the plan with user feedback
  const handleRegenerateWithFeedback = useCallback(async (feedback: string) => {
    if (!goal || !experience || !frequency) return;

    setIsRegenerating(true);
    setError(null);

    try {
      // Combine original preferences with user feedback
      const planData = await generatePlanAction({
        userId: user?.id,
        preferences: {
          primary_goal: goal,
          experience_level: experience,
          training_frequency: frequency,
          pain_points: painPoints,
          sport: sport || undefined,
          additional_notes: `User Feedback on previous plan: ${feedback}`.trim(),
          equipment: equipment || undefined,
          preferred_session_length: sessionLength || undefined,
          sex: userSex || undefined,
          training_split: trainingSplit || undefined,
        },
      });

      if (!planData || !planData.weeklyPlan || planData.weeklyPlan.length === 0) {
        throw new Error(t('onboarding.invalidPlan'));
      }

      const plan: Omit<WorkoutPlan, 'id'> = {
        ...planData,
        name: `${goal} Program`
      };

      setGeneratedPlan(plan);
      setIsRegenerating(false);
    } catch (e) {
      console.error('Error regenerating plan:', e);
      setError('Failed to regenerate plan. Please try again.');
      setIsRegenerating(false);
    }
  }, [goal, experience, frequency, painPoints, sport, equipment, sessionLength, userSex, trainingSplit, generatePlanAction, user?.id, t]);

  // Confirm the plan and navigate to home
  const handleConfirmPlan = useCallback(() => {
    if (generatedPlan) {
      // Track onboarding completion
      if (user?.id && onboardingStartTime) {
        const timeSpent_ms = Date.now() - onboardingStartTime;
        analytics.track(EventTypes.ONBOARDING_COMPLETED, {
          timeSpent_ms,
          goal,
          experience,
          frequency,
          painPointsCount: painPoints.length,
          hasSport: !!sport,
        });
      }

      onPlanGenerated(generatedPlan);
    }
  }, [generatedPlan, onPlanGenerated, user?.id, onboardingStartTime, goal, experience, frequency, painPoints.length, sport]);

  const handleCustomPlanSubmit = useCallback(async () => {
    const inputToProcess = selectedFile || rawText;
    if (!inputToProcess || (typeof inputToProcess === 'string' && !inputToProcess.trim())) {
      setError(t('onboarding.noPlanProvided'));
      return;
    }

    // Check rate limits before parsing plan
    if (user?.id && userProfile) {
      const tier = userProfile.apiUsage?.tier || 'free';
      const usage = userProfile.apiUsage;

      if (usage && hasExceededLimit(usage, tier, 'parse')) {
        const remaining = getRemainingUsage(usage, tier);
        setError(getLimitMessage('parse', tier, remaining));
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    // Start timer for plan parsing
    const endTimer = analytics.startTimer(EventTypes.PLAN_PARSED);

    try {
      const inputText = typeof inputToProcess === 'string' ? inputToProcess : '';

      // Use Convex action for server-side AI parsing (keeps API key secure)
      const planData = await parseWorkoutPlanAction({
        planText: inputToProcess,
        userId: user?.id || 'anonymous'
      });
      const planName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : `Imported Plan ${new Date().toLocaleDateString()}`;
      const plan: Omit<WorkoutPlan, 'id'> = {
          ...planData,
          name: planName
      };

      // Track plan parsing for rate limiting
      if (user?.id) {
        await incrementParseUsageMutation({ userId: user.id });
      }

      // Track successful plan parsing
      endTimer({
        lineCount: inputText.split('\n').length,
        characterCount: inputText.length,
        isFile: !!selectedFile,
        daysInPlan: plan.weeklyPlan?.length || 0,
      });

      await onPlanGenerated(plan);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t('errors.unknownError');
      setError(errorMessage);

      // Track plan parsing failure
      analytics.trackError(EventTypes.PLAN_PARSING_FAILED, e as Error, {
        inputLength: typeof inputToProcess === 'string' ? inputToProcess.length : 0,
        isFile: !!selectedFile,
      });

      setIsLoading(false);
      // Navigate to home even on error after showing error message
      setTimeout(() => {
        onPlanGenerated({} as any); // This will navigate to home (handlePlanGenerated handles empty plan gracefully)
      }, 2000);
      return; // Exit early
    }
    setIsLoading(false);
  }, [rawText, selectedFile, onPlanGenerated, user?.id, incrementParseUsageMutation, t]);
  
  // Helper to navigate to next step
  const goToNextStep = () => {
    const steps = getStepOrder();
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  // Helper to navigate to previous step
  const goToPrevStep = () => {
    const steps = getStepOrder();
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return <WelcomeStep onNext={() => setStep('essentials')} onCustom={() => setStep('custom')} />;
      case 'essentials':
        return <EssentialsStep
          goal={goal}
          setGoal={setGoal}
          experience={experience}
          setExperience={setExperience}
          frequency={frequency}
          setFrequency={setFrequency}
          equipment={equipment}
          setEquipment={setEquipment}
          sessionLength={sessionLength}
          setSessionLength={setSessionLength}
          onNext={goToNextStep}
          onBack={() => setStep('welcome')}
        />;
      case 'goal':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-[20px] font-black text-[var(--text-primary)] mb-2">Competition Goal</h3>
              <p className="text-[14px] text-[var(--text-secondary)]">Tell us about your upcoming event</p>
            </div>
            <SpecificGoalStep value={specificGoal} onChange={setSpecificGoal} />
            <div className="flex gap-3 pt-2">
              <button onClick={goToPrevStep} className="h-12 px-6 rounded-xl font-semibold text-[14px] text-[var(--text-secondary)] bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)] transition-colors">Back</button>
              <button onClick={goToNextStep} className="flex-1 h-12 rounded-xl font-bold text-[14px] uppercase tracking-wide text-white bg-[var(--brand-primary)] active:scale-[0.98] transition-transform">Continue</button>
            </div>
          </div>
        );
      case 'customize':
        return <CustomizeStep
          painPoints={painPoints}
          setPainPoints={setPainPoints}
          sport={sport}
          setSport={setSport}
          trainingSplit={trainingSplit}
          setTrainingSplit={setTrainingSplit}
          onNext={() => setStep('generate')}
          onBack={goToPrevStep}
        />;
      case 'generate':
        return <GenerateStep onGenerate={handleGeneratePersonalizedPlan} onBack={() => setStep('customize')} isLoading={isLoading} error={error} showSuccess={showSuccess} />;
      case 'preview':
        return generatedPlan ? (
          <PlanPreviewStep
            plan={generatedPlan as WorkoutPlan}
            onConfirm={handleConfirmPlan}
            onRegenerate={handleRegenerateWithFeedback}
            isRegenerating={isRegenerating}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-[var(--text-secondary)]">No plan generated yet</p>
            <button
              onClick={() => setStep('generate')}
              className="mt-4 px-6 h-10 rounded-lg font-semibold text-[14px] text-white bg-[var(--brand-primary)]"
            >
              Generate Plan
            </button>
          </div>
        );
      case 'custom':
        return <CustomPlanStep
          rawText={rawText}
          setRawText={setRawText}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          isLoading={isLoading}
          error={error}
          setError={setError}
          onSubmit={handleCustomPlanSubmit}
          onBack={() => setStep('welcome')}
        />;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Freeletics-style minimal progress bar */}
      {step !== 'welcome' && step !== 'custom' && step !== 'generate' && step !== undefined && (
        <div className="px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="max-w-lg mx-auto">
            {/* Step counter - bold and minimal */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                {getCurrentStepNumber()} / {getTotalSteps()}
              </p>
            </div>
            {/* Progress bar - thicker, more prominent */}
            <div className="flex gap-2">
              {Array.from({ length: getTotalSteps() }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    i < getCurrentStepNumber()
                      ? "bg-[var(--brand-primary)]"
                      : i === getCurrentStepNumber()
                      ? "bg-[var(--brand-primary)]/50"
                      : "bg-[var(--border-strong)]"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content - mobile-first design with scroll support */}
      <div className="flex-1 flex flex-col px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto">
        <div className="w-full max-w-lg mx-auto my-auto">
          {step === 'welcome' && (
            <div className="text-center mb-6">
              {/* Bold logo treatment */}
              <div className="font-display text-4xl sm:text-5xl font-black tracking-tight">
                <span className="text-[var(--text-primary)]">RE</span>
                <span className="text-[var(--brand-primary)]">BLD</span>
              </div>
            </div>
          )}
          <div className={cn(
            "bg-[var(--surface-primary)] rounded-2xl p-4 sm:p-6 overflow-hidden",
            step === 'generate' && "text-center"
          )}>
            {renderStep()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Step Components

const WelcomeStep = ({ onNext, onCustom }: { onNext: () => void, onCustom: () => void }) => {
    const { t } = useTranslation();
    return (
        <div className="text-center">
            <h2 className="text-[28px] font-black text-[var(--text-primary)] tracking-tight leading-tight">
                BUILD YOUR<br />TRAINING PLAN
            </h2>
            <p className="mt-4 text-[var(--text-secondary)] text-[15px] leading-relaxed">
                AI-powered programming tailored to your goals, experience, and schedule.
            </p>
            <div className="mt-8 space-y-3">
                <button
                    onClick={onNext}
                    className="w-full h-14 bg-[var(--brand-primary)] text-white font-bold text-[15px] uppercase tracking-wide rounded-xl active:scale-[0.98] transition-transform"
                >
                    Create My Plan
                </button>
                <button
                    onClick={onCustom}
                    className="w-full h-12 text-[var(--text-secondary)] font-semibold text-[14px] rounded-xl hover:bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)] transition-colors"
                >
                    I have my own plan
                </button>
            </div>
        </div>
    );
};

// Essentials Step: Goal + Experience + Frequency + Equipment + Session Length (merged from CoreStep + SetupStep)
const EssentialsStep = ({
    goal, setGoal,
    experience, setExperience,
    frequency, setFrequency,
    equipment, setEquipment,
    sessionLength, setSessionLength,
    onNext, onBack
}: {
    goal: Goal | null, setGoal: (g: Goal) => void,
    experience: Experience | null, setExperience: (e: Experience) => void,
    frequency: Frequency | null, setFrequency: (f: Frequency) => void,
    equipment: string, setEquipment: (e: any) => void,
    sessionLength: string, setSessionLength: (s: any) => void,
    onNext: () => void, onBack: () => void
}) => {
    const { t } = useTranslation();
    const goalOptions = getGoalOptions(t);
    const [showValidation, setShowValidation] = useState(false);
    const canContinue = goal && experience && frequency;

    const equipmentOptions = [
        { id: 'minimal', label: 'Minimal', desc: 'Bodyweight + basics' },
        { id: 'home_gym', label: 'Home Gym', desc: 'Dumbbells, bench, rack' },
        { id: 'commercial_gym', label: 'Full Gym', desc: 'Complete access' },
    ];

    const timeOptions = [
        { id: '30', label: '30' },
        { id: '45', label: '45' },
        { id: '60', label: '60' },
        { id: '75', label: '75' },
    ];

    const handleContinue = () => {
        if (canContinue) {
            onNext();
        } else {
            setShowValidation(true);
        }
    };

    return (
        <div className="space-y-5">
            {/* Goal - Compact cards */}
            <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Primary Goal
                </h3>
                <div className={cn(
                    "space-y-1.5 transition-all",
                    showValidation && !goal && "ring-2 ring-[var(--status-error-bg)]/30 rounded-xl p-1 -m-1"
                )}>
                    {goalOptions.map(g => (
                        <button
                            key={g.id}
                            onClick={() => { setGoal(g.id); setShowValidation(false); }}
                            className={cn(
                                "w-full min-h-[44px] px-3 py-2 rounded-lg text-left transition-all flex items-center justify-between",
                                goal === g.id
                                    ? "bg-[var(--brand-primary)] text-white"
                                    : "bg-[var(--surface-secondary)] text-[var(--text-primary)] active:bg-[var(--surface-hover)]"
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <span className="text-[13px] font-bold block truncate">{g.label}</span>
                            </div>
                            {goal === g.id && (
                                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0 ml-2">
                                    <CheckIcon className="w-2.5 h-2.5 text-white" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Experience + Frequency in a row */}
            <div className="grid grid-cols-2 gap-4">
                {/* Experience */}
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                        Level
                    </h3>
                    <div className={cn(
                        "space-y-1.5 transition-all",
                        showValidation && !experience && "ring-2 ring-[var(--status-error-bg)]/30 rounded-lg p-1 -m-1"
                    )}>
                        {(['Beginner', 'Intermediate', 'Advanced'] as Experience[]).map(e => (
                            <button
                                key={e}
                                onClick={() => { setExperience(e); setShowValidation(false); }}
                                className={cn(
                                    "w-full min-h-[36px] px-2 py-2 rounded-lg text-[12px] font-bold transition-all",
                                    experience === e
                                        ? "bg-[var(--brand-primary)] text-white"
                                        : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] active:bg-[var(--surface-hover)]"
                                )}
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Frequency */}
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                        Days/Week
                    </h3>
                    <div className={cn(
                        "grid grid-cols-2 gap-1.5 transition-all",
                        showValidation && !frequency && "ring-2 ring-[var(--status-error-bg)]/30 rounded-lg p-1 -m-1"
                    )}>
                        {(['2-3', '3-4', '4-5', '5+'] as Frequency[]).map(f => (
                            <button
                                key={f}
                                onClick={() => { setFrequency(f); setShowValidation(false); }}
                                className={cn(
                                    "min-h-[36px] py-2 rounded-lg text-center transition-all",
                                    frequency === f
                                        ? "bg-[var(--brand-primary)] text-white"
                                        : "bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)]"
                                )}
                            >
                                <span className={cn(
                                    "text-[13px] font-black",
                                    frequency === f ? "text-white" : "text-[var(--text-primary)]"
                                )}>{f}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Equipment - Horizontal scroll */}
            <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Equipment
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                    {equipmentOptions.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setEquipment(opt.id)}
                            className={cn(
                                "min-h-[44px] px-2 py-2 rounded-lg text-center transition-all",
                                equipment === opt.id
                                    ? "bg-[var(--brand-primary)] text-white"
                                    : "bg-[var(--surface-secondary)] text-[var(--text-primary)] active:bg-[var(--surface-hover)]"
                            )}
                        >
                            <span className="text-[12px] font-bold block">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Session Length - Compact */}
            <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Session Length (min)
                </h3>
                <div className="grid grid-cols-4 gap-2">
                    {timeOptions.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setSessionLength(opt.id)}
                            className={cn(
                                "min-h-[36px] py-2 rounded-lg text-center transition-all",
                                sessionLength === opt.id
                                    ? "bg-[var(--brand-primary)] text-white"
                                    : "bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)]"
                            )}
                        >
                            <span className={cn(
                                "text-[12px] font-black",
                                sessionLength === opt.id ? "text-white" : "text-[var(--text-primary)]"
                            )}>{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Validation hint */}
            {showValidation && !canContinue && (
                <p className="text-[12px] text-[var(--status-error-bg)] text-center">
                    Select goal, level, and frequency to continue
                </p>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-1">
                <button
                    onClick={onBack}
                    className="h-11 px-5 rounded-xl font-semibold text-[13px] text-[var(--text-secondary)] bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)] transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={handleContinue}
                    className="flex-1 h-11 rounded-xl font-bold text-[13px] uppercase tracking-wide text-white bg-[var(--brand-primary)] active:scale-[0.98] transition-transform"
                >
                    Continue
                </button>
            </div>
        </div>
    );
};

// Customize Step: Training Split + Pain Points + Sport
const CustomizeStep = ({
    painPoints, setPainPoints,
    sport, setSport,
    trainingSplit, setTrainingSplit,
    onNext, onBack
}: {
    painPoints: PainPoint[], setPainPoints: (p: PainPoint[]) => void,
    sport: string, setSport: (s: string) => void,
    trainingSplit: TrainingSplit | null, setTrainingSplit: (s: TrainingSplit | null) => void,
    onNext: () => void, onBack: () => void
}) => {
    const { t } = useTranslation();
    const painOptions = getPainPointsOptions(t);

    const togglePain = (point: PainPoint) => {
        if (painPoints.includes(point)) {
            setPainPoints(painPoints.filter(p => p !== point));
        } else {
            setPainPoints([...painPoints, point]);
        }
    };

    // Default training split to 1x daily
    const currentSplit = trainingSplit || { sessions_per_day: '1' as const, training_type: 'combined' as const };

    return (
        <div className="space-y-5">
            <div className="text-center">
                <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-medium">All Optional</p>
            </div>

            {/* Training Split - Compact 2x daily toggle */}
            <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Daily Sessions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setTrainingSplit({ sessions_per_day: '1', training_type: 'combined' })}
                        className={cn(
                            "min-h-[44px] px-3 py-2 rounded-lg text-[13px] font-bold transition-all",
                            currentSplit.sessions_per_day === '1'
                                ? "bg-[var(--brand-primary)] text-white"
                                : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] active:bg-[var(--surface-hover)]"
                        )}
                    >
                        1x Daily
                    </button>
                    <button
                        onClick={() => setTrainingSplit({ sessions_per_day: '2', training_type: 'strength_plus_cardio' })}
                        className={cn(
                            "min-h-[44px] px-3 py-2 rounded-lg text-[13px] font-bold transition-all",
                            currentSplit.sessions_per_day === '2'
                                ? "bg-[var(--brand-primary)] text-white"
                                : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] active:bg-[var(--surface-hover)]"
                        )}
                    >
                        2x Daily
                    </button>
                </div>

                {/* Show training type options if 2x daily is selected */}
                {currentSplit.sessions_per_day === '2' && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                        {[
                            { id: 'strength_plus_cardio' as const, label: 'AM Cardio / PM Strength' },
                            { id: 'strength_only' as const, label: 'AM Heavy / PM Accessory' },
                            { id: 'combined' as const, label: 'Both Combined' },
                            { id: 'cardio_focused' as const, label: 'Cardio Focus' },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setTrainingSplit({
                                    sessions_per_day: '2',
                                    training_type: opt.id,
                                    cardio_preferences: currentSplit.cardio_preferences
                                })}
                                className={cn(
                                    "min-h-[32px] px-2 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                                    currentSplit.training_type === opt.id
                                        ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]"
                                        : "bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] active:bg-[var(--surface-hover)]"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Cardio preferences - show when cardio is part of training */}
                {(currentSplit.training_type === 'strength_plus_cardio' || currentSplit.training_type === 'cardio_focused') && (
                    <div className="mt-3 p-3 bg-[var(--surface-tertiary)] rounded-lg space-y-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                            Cardio Preferences
                        </h4>

                        {/* Cardio Type */}
                        <div className="flex flex-wrap gap-1.5">
                            {['Running', 'Cycling', 'Rowing', 'Swimming', 'Elliptical', 'Stairs'].map(type => {
                                const isSelected = currentSplit.cardio_preferences?.preferred_types?.includes(type.toLowerCase()) || false;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            const currentTypes = currentSplit.cardio_preferences?.preferred_types || [];
                                            const newTypes = isSelected
                                                ? currentTypes.filter(t => t !== type.toLowerCase())
                                                : [...currentTypes, type.toLowerCase()];
                                            setTrainingSplit({
                                                ...currentSplit,
                                                cardio_preferences: {
                                                    ...currentSplit.cardio_preferences,
                                                    preferred_types: newTypes,
                                                }
                                            });
                                        }}
                                        className={cn(
                                            "px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all",
                                            isSelected
                                                ? "bg-[var(--brand-primary)] text-white"
                                                : "bg-[var(--surface-secondary)] text-[var(--text-tertiary)] active:bg-[var(--surface-hover)]"
                                        )}
                                    >
                                        {type}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Cardio Duration */}
                        <div>
                            <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">Duration (minutes)</p>
                            <div className="flex gap-1.5">
                                {[20, 30, 45, 60].map(mins => (
                                    <button
                                        key={mins}
                                        onClick={() => setTrainingSplit({
                                            ...currentSplit,
                                            cardio_preferences: {
                                                ...currentSplit.cardio_preferences,
                                                preferred_types: currentSplit.cardio_preferences?.preferred_types || [],
                                                cardio_duration_minutes: mins,
                                            }
                                        })}
                                        className={cn(
                                            "flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all",
                                            currentSplit.cardio_preferences?.cardio_duration_minutes === mins
                                                ? "bg-[var(--brand-primary)] text-white"
                                                : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] active:bg-[var(--surface-hover)]"
                                        )}
                                    >
                                        {mins}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Pain Points - Compact */}
            <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Movement Limitations
                </h3>
                <div className="grid grid-cols-4 gap-1.5">
                    {painOptions.map(p => (
                        <button
                            key={p.id}
                            onClick={() => togglePain(p.id)}
                            className={cn(
                                "min-h-[36px] px-2 py-2 rounded-lg text-[11px] font-bold transition-all",
                                painPoints.includes(p.id)
                                    ? "bg-[var(--brand-primary)] text-white"
                                    : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] active:bg-[var(--surface-hover)]"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sport - Compact */}
            <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Sport Focus
                </h3>
                <input
                    type="text"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    placeholder="Hyrox, Soccer, MMA, Triathlon..."
                    className="w-full h-11 px-3 bg-[var(--surface-secondary)] rounded-lg text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--brand-primary)] outline-none transition-all"
                />
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
                <button
                    onClick={onBack}
                    className="h-11 px-5 rounded-xl font-semibold text-[13px] text-[var(--text-secondary)] bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)] transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    className="flex-1 h-11 rounded-xl font-bold text-[13px] uppercase tracking-wide text-white bg-[var(--brand-primary)] active:scale-[0.98] transition-transform"
                >
                    Generate Plan
                </button>
            </div>
        </div>
    );
};

// Generate Step - Sophisticated animated loading experience synced with AI generation
const GenerateStep = ({ onGenerate, onBack, isLoading, error, showSuccess }: {
    onGenerate: () => void, onBack: () => void, isLoading: boolean, error: string | null, showSuccess: boolean
}) => {
    const { t } = useTranslation();
    const hasAutoTriggered = useRef(false);
    const [activeDay, setActiveDay] = useState(0);
    const [filledDays, setFilledDays] = useState<number[]>([]);
    const [currentExercise, setCurrentExercise] = useState(0);
    const [progress, setProgress] = useState(0); // 0-100 progress estimate
    const [statusText, setStatusText] = useState('');

    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const exerciseTypes = [
        { name: 'Warmup', icon: '🔥' },
        { name: 'Compound', icon: '💪' },
        { name: 'Accessory', icon: '🎯' },
        { name: 'Core', icon: '⚡' },
        { name: 'Cooldown', icon: '🧘' },
    ];

    // Status messages based on progress
    const statusMessages = [
        { threshold: 0, text: 'Analyzing your goals...' },
        { threshold: 20, text: 'Selecting exercises...' },
        { threshold: 40, text: 'Building your week...' },
        { threshold: 60, text: 'Optimizing for recovery...' },
        { threshold: 80, text: 'Adding finishing touches...' },
        { threshold: 90, text: 'Almost ready...' },
    ];

    useEffect(() => {
        if (!hasAutoTriggered.current && !isLoading && !showSuccess) {
            hasAutoTriggered.current = true;
            onGenerate();
        }
    }, [isLoading, showSuccess, onGenerate]);

    // Progress-driven animation - syncs with AI generation timing
    // AI typically takes 45-50 seconds, so we pace accordingly
    useEffect(() => {
        if (isLoading) {
            setFilledDays([]);
            setActiveDay(0);
            setProgress(0);

            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    // Curve: slow start, steady middle, hold at 85% until done
                    // Total time to 85%: ~45 seconds to match AI generation
                    // 0-30% in ~12 seconds (2.5% per second)
                    // 30-60% in ~15 seconds (2% per second)
                    // 60-85% in ~18 seconds (1.4% per second)
                    if (prev < 30) return prev + 2.5;
                    if (prev < 60) return prev + 2;
                    if (prev < 85) return prev + 1.4;
                    return 85; // Hold at 85% until generation completes
                });
            }, 1000);

            return () => clearInterval(progressInterval);
        } else if (!showSuccess) {
            // Reset when not loading and not showing success
            setProgress(0);
        }
    }, [isLoading]);

    // Map progress to days filled
    useEffect(() => {
        if (isLoading || showSuccess) {
            // Map progress to number of days (0-85% = 0-6 days, 100% = 7 days)
            const targetProgress = showSuccess ? 100 : progress;
            const dayCount = Math.min(Math.floor((targetProgress / 100) * 7), showSuccess ? 7 : 6);

            // Update filled days array
            setFilledDays(prev => {
                const newFilled = [];
                for (let i = 0; i < dayCount; i++) {
                    newFilled.push(i);
                }
                return newFilled;
            });

            // Set active day (currently filling)
            setActiveDay(Math.min(dayCount, 6));
        }
    }, [progress, isLoading, showSuccess]);

    // When generation completes (showSuccess), rapidly fill remaining days
    useEffect(() => {
        if (showSuccess) {
            setProgress(100);
            // Quick fill animation for any remaining days
            const fillDelay = setTimeout(() => {
                setFilledDays([0, 1, 2, 3, 4, 5, 6]);
            }, 200);
            return () => clearTimeout(fillDelay);
        }
    }, [showSuccess]);

    // Update status text based on progress
    useEffect(() => {
        const message = [...statusMessages]
            .reverse()
            .find(m => progress >= m.threshold);
        if (message) {
            setStatusText(message.text);
        }
    }, [progress]);

    // Cycle through exercise types (purely visual)
    useEffect(() => {
        if (isLoading) {
            const exerciseInterval = setInterval(() => {
                setCurrentExercise(prev => (prev + 1) % exerciseTypes.length);
            }, 800);
            return () => clearInterval(exerciseInterval);
        }
    }, [isLoading]);

    // Success state
    if (showSuccess) {
        return (
            <div className="py-8 text-center">
                {/* Week complete visualization */}
                <div className="flex justify-center gap-2 mb-8">
                    {days.map((day, idx) => (
                        <div
                            key={idx}
                            className="w-10 h-14 rounded-lg bg-[var(--brand-primary)] flex flex-col items-center justify-center"
                            style={{
                                animation: `day-pop 0.4s var(--ease-spring) ${idx * 0.08}s backwards`,
                            }}
                        >
                            <span className="text-[10px] font-bold text-white/70 uppercase">{day}</span>
                            <CheckIcon className="w-4 h-4 text-white mt-0.5" />
                        </div>
                    ))}
                </div>

                <h3
                    className="text-[22px] font-black text-[var(--text-primary)] mb-2 uppercase tracking-tight"
                    style={{ animation: 'fade-in-up 0.5s var(--ease-out) 0.6s backwards' }}
                >
                    Your Week is Ready
                </h3>
                <p
                    className="text-[14px] text-[var(--text-secondary)]"
                    style={{ animation: 'fade-in-up 0.5s var(--ease-out) 0.7s backwards' }}
                >
                    7 days of personalized training
                </p>
            </div>
        );
    }

    return (
        <div className="py-6">
            {error && (
                <div className="mb-6 bg-[var(--status-error-bg)]/10 text-[var(--status-error-bg)] px-4 py-4 rounded-xl flex items-start gap-3">
                    <XCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="text-[14px]">{error}</span>
                </div>
            )}

            {isLoading && (
                <div className="flex flex-col items-center">
                    {/* Week builder visualization */}
                    <div className="relative mb-8">
                        {/* Days of the week */}
                        <div className="flex gap-2">
                            {days.map((day, idx) => {
                                const isFilled = filledDays.includes(idx);
                                const isActive = activeDay === idx;

                                return (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "relative w-10 h-16 rounded-lg transition-all duration-500 flex flex-col items-center justify-center overflow-hidden",
                                            isFilled
                                                ? "bg-[var(--brand-primary)]"
                                                : isActive
                                                ? "bg-[var(--surface-tertiary)]"
                                                : "bg-[var(--surface-secondary)]"
                                        )}
                                    >
                                        {/* Day letter */}
                                        <span className={cn(
                                            "text-[11px] font-bold uppercase transition-colors duration-300",
                                            isFilled ? "text-white/80" : "text-[var(--text-tertiary)]"
                                        )}>
                                            {day}
                                        </span>

                                        {/* Fill animation */}
                                        {isActive && !isFilled && (
                                            <div className="absolute inset-0 overflow-hidden">
                                                <div
                                                    className="absolute bottom-0 left-0 right-0 bg-[var(--brand-primary)]"
                                                    style={{
                                                        animation: 'fill-up 2.5s ease-out forwards',
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* Exercise blocks being added */}
                                        {isActive && !isFilled && (
                                            <div className="absolute inset-x-1 top-6 flex flex-col gap-0.5">
                                                {[0, 1, 2].map(blockIdx => (
                                                    <div
                                                        key={blockIdx}
                                                        className="h-2 rounded-sm bg-white/30"
                                                        style={{
                                                            animation: `block-slide 0.8s ease-out ${blockIdx * 0.6}s infinite`,
                                                            opacity: 0,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Completed checkmark */}
                                        {isFilled && (
                                            <CheckIcon
                                                className="w-4 h-4 text-white mt-1"
                                                style={{ animation: 'pop-in 0.3s var(--ease-spring)' }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Progress line under days - synced with generation */}
                        <div className="mt-3 h-1 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Current action indicator */}
                    <div className="flex items-center gap-3 mb-6 h-8">
                        <div
                            className="text-2xl"
                            style={{ animation: 'bounce-in 0.3s var(--ease-spring)' }}
                            key={currentExercise}
                        >
                            {exerciseTypes[currentExercise].icon}
                        </div>
                        <div className="text-left">
                            <p
                                className="text-[13px] font-bold text-[var(--text-primary)]"
                                key={`name-${currentExercise}`}
                                style={{ animation: 'slide-in-text 0.3s ease-out' }}
                            >
                                Adding {exerciseTypes[currentExercise].name}
                            </p>
                            <p className="text-[11px] text-[var(--text-tertiary)]">
                                Day {Math.min(filledDays.length + 1, 7)} of 7
                            </p>
                        </div>
                    </div>

                    {/* Status text - synced with generation progress */}
                    <p className="text-[18px] font-black text-[var(--text-primary)] uppercase tracking-wide mb-1">
                        Building Your Week
                    </p>
                    <p className="text-[12px] text-[var(--text-tertiary)] transition-opacity duration-300">
                        {statusText || 'Analyzing your goals...'}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-2 tabular-nums">
                        {Math.round(progress)}% complete
                    </p>
                </div>
            )}

            <div className={cn("flex gap-3 pt-6", isLoading && "opacity-30 pointer-events-none")}>
                <button
                    onClick={onBack}
                    disabled={isLoading}
                    className="h-12 px-6 rounded-xl font-semibold text-[14px] text-[var(--text-secondary)] bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                >
                    Back
                </button>
                <button
                    onClick={onGenerate}
                    disabled={isLoading}
                    className="flex-1 h-12 rounded-xl font-bold text-[14px] uppercase tracking-wide text-white bg-[var(--brand-primary)] active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                    {isLoading ? 'Generating...' : 'Retry'}
                </button>
            </div>

            {/* Custom keyframes */}
            <style>{`
                @keyframes fill-up {
                    0% { height: 0%; }
                    100% { height: 100%; }
                }
                @keyframes block-slide {
                    0% { opacity: 0; transform: translateX(-100%); }
                    20% { opacity: 1; transform: translateX(0); }
                    80% { opacity: 1; transform: translateX(0); }
                    100% { opacity: 0; transform: translateX(100%); }
                }
                @keyframes pop-in {
                    0% { transform: scale(0); }
                    70% { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
                @keyframes day-pop {
                    0% { transform: scale(0) translateY(20px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                @keyframes bounce-in {
                    0% { transform: scale(0.5); opacity: 0; }
                    70% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes slide-in-text {
                    0% { transform: translateX(-10px); opacity: 0; }
                    100% { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

// Custom Plan Import Step - Freeletics-style
const CustomPlanStep = ({ rawText, setRawText, selectedFile, setSelectedFile, isLoading, error, setError, onSubmit, onBack }: any) => {
    const { t } = useTranslation();
    const MAX_FILE_SIZE_MB = 5;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                setError(t('onboarding.fileTooLarge', { maxSize: MAX_FILE_SIZE_MB }));
                setSelectedFile(null);
            } else if (file.type === 'text/plain' || file.type === 'text/markdown' || file.type === 'application/pdf') {
                setSelectedFile(file);
                setRawText('');
                setError(null);
            } else {
                setError(t('onboarding.invalidFileType'));
                setSelectedFile(null);
            }
        }
        event.target.value = '';
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Import Plan
                </h3>
                <p className="text-[14px] text-[var(--text-secondary)]">
                    Paste your workout plan or upload a file
                </p>
            </div>

            <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={selectedFile ? "File selected" : "Paste your workout plan..."}
                className="w-full h-36 p-4 text-[15px] text-[var(--text-primary)] bg-[var(--surface-secondary)] rounded-xl placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--brand-primary)] resize-none disabled:opacity-50 outline-none"
                disabled={!!selectedFile}
            />

            {selectedFile && (
                <div className="bg-[var(--surface-secondary)] p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <DocumentIcon className="w-5 h-5 text-[var(--text-tertiary)]" />
                        <div>
                            <p className="font-bold text-[var(--text-primary)] text-[14px]">{selectedFile.name}</p>
                            <p className="text-[12px] text-[var(--text-tertiary)]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSelectedFile(null)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--surface-hover)] active:bg-[var(--border-default)]"
                    >
                        <XCircleIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                </div>
            )}

            {error && (
                <div className="bg-[var(--status-error-bg)]/10 text-[var(--status-error-bg)] px-4 py-3 rounded-xl flex items-center gap-3 text-[13px]">
                    <XCircleIcon className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                    <div className="h-12 flex items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)] transition-colors">
                        <UploadIcon className="w-4 h-4" />
                        Upload File
                    </div>
                    <input type="file" className="sr-only" accept=".txt,.md,.pdf" onChange={handleFileChange} />
                </label>
                <button
                    onClick={onBack}
                    className="h-12 px-6 rounded-xl font-semibold text-[14px] text-[var(--text-secondary)] bg-[var(--surface-secondary)] active:bg-[var(--surface-hover)] transition-colors"
                >
                    Back
                </button>
            </div>

            <button
                onClick={onSubmit}
                disabled={isLoading}
                className="w-full h-14 rounded-xl font-bold text-[15px] uppercase tracking-wide text-white bg-[var(--brand-primary)] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
                {isLoading ? 'Parsing...' : 'Import Plan'}
            </button>
        </div>
    );
};
