import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage, WorkoutPlan, PlanExercise, PlanDay, WorkoutBlock } from '../types';
import { XMarkIcon, SendIcon, SparklesIcon, LogoIcon, XCircleIcon } from './icons';
import { notify } from './layout/Toast';
import { useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useUser } from '@clerk/clerk-react';
import { hasExceededLimit, getLimitMessage, getRemainingUsage } from '../lib/rateLimiter';
import useUserProfile from '../hooks/useUserProfile';
import { cn } from '../lib/utils';
import { analytics, EventTypes } from '../services/analyticsService';

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  plan: WorkoutPlan | null;
  onPlanUpdate: (updatedPlan: WorkoutPlan) => void;
  initialMessage?: string;
  dayOfWeek: number;
}

export default function Chatbot({ isOpen, onClose, plan, onPlanUpdate, initialMessage, dayOfWeek }: ChatbotProps) {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const { userProfile } = useUserProfile();
  const incrementChatUsageMutation = useMutation(api.mutations.incrementChatUsage);
  const handleChatMessageAction = useAction(api.ai.handleChatMessage);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'model', content: string }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialMessageSet = useRef(false);


  useEffect(() => {
    if (isOpen) {
      if (plan && messages.length === 0) {
        // Initialize with welcome message
        setMessages([{ role: 'model', text: t('chat.hello') }]);
      }
      if (initialMessage && !initialMessageSet.current) {
        setInput(initialMessage);
        initialMessageSet.current = true;
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } else {
      initialMessageSet.current = false;
      setInput('');
    }
  }, [isOpen, plan, initialMessage, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleFunctionCall = (functionCall: any): string => {
    let updatedPlan = plan ? JSON.parse(JSON.stringify(plan)) : null; // Deep copy
    let functionResponseText = '';

    if (functionCall.name === 'substituteExercise' && updatedPlan) {
        const { day_of_week, original_exercise_name, new_exercise_name, new_exercise_metrics_template, rpe } = functionCall.args;
        
        const dayIndex = (updatedPlan.weeklyPlan || []).findIndex((d: PlanDay) => d.day_of_week === day_of_week);
        
        if (dayIndex !== -1) {
            const dayToUpdate = updatedPlan.weeklyPlan[dayIndex];
            let substituted = false;
            (dayToUpdate.blocks || []).forEach((block: WorkoutBlock) => {
                block.exercises = block.exercises.map((ex: PlanExercise) => {
                    if (ex.exercise_name === original_exercise_name) {
                        substituted = true;
                        return {
                            ...ex,
                            exercise_name: new_exercise_name,
                            metrics_template: new_exercise_metrics_template,
                            original_exercise_name: ex.exercise_name, // Store original name
                            rpe: rpe || ex.rpe,
                        };
                    }
                    return ex;
                });
            });

            if (substituted) {
              onPlanUpdate(updatedPlan);
              notify({ type: 'success', message: t('chat.exerciseReplaced', { original: original_exercise_name, new: new_exercise_name }) });
              functionResponseText = t('chat.exerciseSubstituted', { original: original_exercise_name, new: new_exercise_name });
            } else {
              functionResponseText = t('chat.exerciseNotFound', { exercise: original_exercise_name });
            }
        } else {
            functionResponseText = t('chat.dayNotFound', { day: day_of_week });
        }
    } else if (functionCall.name === 'addExercise' && updatedPlan) {
        const { day_of_week, category, new_exercise_name, new_exercise_metrics_template, rpe } = functionCall.args;

        const dayIndex = (updatedPlan.weeklyPlan || []).findIndex((d: PlanDay) => d.day_of_week === day_of_week);
        if (dayIndex !== -1) {
            const dayToUpdate = updatedPlan.weeklyPlan[dayIndex];
            const newExercise: PlanExercise = {
                exercise_name: new_exercise_name,
                metrics_template: new_exercise_metrics_template,
                rpe: rpe || null,
                category: category,
            };

            const newBlock: WorkoutBlock = {
                type: 'single',
                title: new_exercise_name,
                exercises: [newExercise]
            };

            if (!dayToUpdate.blocks) {
              dayToUpdate.blocks = [];
            }

            let blocks = [...(dayToUpdate.blocks || [])];

            if (category === 'warmup') {
                blocks.unshift(newBlock);
            } else if (category === 'cooldown') {
                blocks.push(newBlock);
            } else { // 'main'
                let lastWarmupIndex = -1;
                blocks.forEach((b, i) => {
                    if(b.exercises.some(ex => ex.category === 'warmup')) {
                        lastWarmupIndex = i;
                    }
                });
                blocks.splice(lastWarmupIndex + 1, 0, newBlock);
            }

            dayToUpdate.blocks = blocks;

            onPlanUpdate(updatedPlan);
            notify({ type: 'success', message: t('chat.exerciseAdded', { exercise: new_exercise_name, day: day_of_week }) });
            functionResponseText = t('chat.exerciseAddedMessage', { exercise: new_exercise_name });
        } else {
            functionResponseText = t('chat.dayNotFound', { day: day_of_week });
        }
    } else if (functionCall.name === 'modifyExercise' && updatedPlan) {
        const { day_of_week, exercise_name, new_sets, new_reps, new_rest_period_s, new_rpe } = functionCall.args;

        const dayIndex = (updatedPlan.weeklyPlan || []).findIndex((d: PlanDay) => d.day_of_week === day_of_week);
        if (dayIndex !== -1) {
            const dayToUpdate = updatedPlan.weeklyPlan[dayIndex];
            let modified = false;
            (dayToUpdate.blocks || []).forEach((block: WorkoutBlock) => {
                block.exercises = block.exercises.map((ex: PlanExercise) => {
                    if (ex.exercise_name.toLowerCase() === exercise_name.toLowerCase()) {
                        modified = true;
                        const updatedEx = { ...ex };
                        if (new_sets !== undefined && updatedEx.metrics_template) {
                            updatedEx.metrics_template = { ...updatedEx.metrics_template, target_sets: new_sets };
                        }
                        if (new_reps !== undefined && updatedEx.metrics_template) {
                            updatedEx.metrics_template = { ...updatedEx.metrics_template, target_reps: new_reps };
                        }
                        if (new_rest_period_s !== undefined && updatedEx.metrics_template) {
                            updatedEx.metrics_template = { ...updatedEx.metrics_template, rest_period_s: new_rest_period_s };
                        }
                        if (new_rpe !== undefined) {
                            updatedEx.rpe = new_rpe;
                        }
                        return updatedEx;
                    }
                    return ex;
                });
            });

            if (modified) {
                onPlanUpdate(updatedPlan);
                notify({ type: 'success', message: `Modified ${exercise_name}` });
                functionResponseText = `Successfully modified ${exercise_name}`;
            } else {
                functionResponseText = `Could not find exercise "${exercise_name}" on day ${day_of_week}`;
            }
        } else {
            functionResponseText = t('chat.dayNotFound', { day: day_of_week });
        }
    } else if (functionCall.name === 'removeExercise' && updatedPlan) {
        const { day_of_week, exercise_name } = functionCall.args;

        const dayIndex = (updatedPlan.weeklyPlan || []).findIndex((d: PlanDay) => d.day_of_week === day_of_week);
        if (dayIndex !== -1) {
            const dayToUpdate = updatedPlan.weeklyPlan[dayIndex];
            let removed = false;

            dayToUpdate.blocks = (dayToUpdate.blocks || []).map((block: WorkoutBlock) => {
                const filteredExercises = block.exercises.filter((ex: PlanExercise) => {
                    if (ex.exercise_name.toLowerCase() === exercise_name.toLowerCase()) {
                        removed = true;
                        return false;
                    }
                    return true;
                });
                return { ...block, exercises: filteredExercises };
            }).filter((block: WorkoutBlock) => block.exercises.length > 0); // Remove empty blocks

            if (removed) {
                onPlanUpdate(updatedPlan);
                notify({ type: 'success', message: `Removed ${exercise_name}` });
                functionResponseText = `Successfully removed ${exercise_name} from day ${day_of_week}`;
            } else {
                functionResponseText = `Could not find exercise "${exercise_name}" on day ${day_of_week}`;
            }
        } else {
            functionResponseText = t('chat.dayNotFound', { day: day_of_week });
        }
    } else if (functionCall.name === 'adjustDifficulty' && updatedPlan) {
        const { day_of_week, direction, method } = functionCall.args;

        const dayIndex = (updatedPlan.weeklyPlan || []).findIndex((d: PlanDay) => d.day_of_week === day_of_week);
        if (dayIndex !== -1) {
            const dayToUpdate = updatedPlan.weeklyPlan[dayIndex];
            let modifications: string[] = [];

            (dayToUpdate.blocks || []).forEach((block: WorkoutBlock) => {
                block.exercises = block.exercises.map((ex: PlanExercise) => {
                    if (ex.category !== 'main') return ex; // Only modify main exercises

                    const updatedEx = { ...ex };

                    if (method === 'volume' || method === 'all') {
                        if (updatedEx.metrics_template?.target_sets) {
                            const currentSets = updatedEx.metrics_template.target_sets;
                            if (direction === 'harder') {
                                updatedEx.metrics_template = { ...updatedEx.metrics_template, target_sets: currentSets + 1 };
                            } else if (currentSets > 2) {
                                updatedEx.metrics_template = { ...updatedEx.metrics_template, target_sets: currentSets - 1 };
                            }
                        }
                    }

                    if (method === 'intensity' || method === 'all') {
                        const currentRpe = parseInt(ex.rpe || '7') || 7;
                        if (direction === 'harder' && currentRpe < 10) {
                            updatedEx.rpe = String(Math.min(currentRpe + 1, 10));
                        } else if (direction === 'easier' && currentRpe > 5) {
                            updatedEx.rpe = String(Math.max(currentRpe - 1, 5));
                        }
                    }

                    modifications.push(ex.exercise_name);
                    return updatedEx;
                });
            });

            if (modifications.length > 0) {
                onPlanUpdate(updatedPlan);
                notify({ type: 'success', message: `Made workout ${direction}` });
                functionResponseText = `Adjusted ${modifications.length} exercises to be ${direction} using ${method} method`;
            } else {
                functionResponseText = `No exercises found to modify on day ${day_of_week}`;
            }
        } else {
            functionResponseText = t('chat.dayNotFound', { day: day_of_week });
        }
    } else if (functionCall.name === 'swapDayFocus' && updatedPlan) {
        const { day_from, day_to } = functionCall.args;

        const dayFromIndex = (updatedPlan.weeklyPlan || []).findIndex((d: PlanDay) => d.day_of_week === day_from);
        const dayToIndex = (updatedPlan.weeklyPlan || []).findIndex((d: PlanDay) => d.day_of_week === day_to);

        if (dayFromIndex !== -1 && dayToIndex !== -1) {
            // Swap the blocks and focus
            const tempBlocks = updatedPlan.weeklyPlan[dayFromIndex].blocks;
            const tempFocus = updatedPlan.weeklyPlan[dayFromIndex].focus;
            const tempNotes = updatedPlan.weeklyPlan[dayFromIndex].notes;

            updatedPlan.weeklyPlan[dayFromIndex].blocks = updatedPlan.weeklyPlan[dayToIndex].blocks;
            updatedPlan.weeklyPlan[dayFromIndex].focus = updatedPlan.weeklyPlan[dayToIndex].focus;
            updatedPlan.weeklyPlan[dayFromIndex].notes = updatedPlan.weeklyPlan[dayToIndex].notes;

            updatedPlan.weeklyPlan[dayToIndex].blocks = tempBlocks;
            updatedPlan.weeklyPlan[dayToIndex].focus = tempFocus;
            updatedPlan.weeklyPlan[dayToIndex].notes = tempNotes;

            onPlanUpdate(updatedPlan);
            const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            notify({ type: 'success', message: `Swapped ${dayNames[day_from - 1]} and ${dayNames[day_to - 1]}` });
            functionResponseText = `Successfully swapped day ${day_from} and day ${day_to}`;
        } else {
            functionResponseText = `Could not find one or both days to swap`;
        }
    } else if (functionCall.name === 'extendWorkout' && updatedPlan) {
        // For extend/shorten, we let the AI decide what to add/remove
        // Just acknowledge and let AI make suggestions
        const { day_of_week } = functionCall.args;
        functionResponseText = `I'll suggest exercises to add to day ${day_of_week}. Use the addExercise function for each exercise you want to include.`;
    } else if (functionCall.name === 'shortenWorkout' && updatedPlan) {
        const { day_of_week } = functionCall.args;
        const dayIndex = (updatedPlan.weeklyPlan || []).findIndex((d: PlanDay) => d.day_of_week === day_of_week);
        if (dayIndex !== -1) {
            const dayToUpdate = updatedPlan.weeklyPlan[dayIndex];
            const mainExercises = (dayToUpdate.blocks || [])
                .flatMap((b: WorkoutBlock) => b.exercises)
                .filter((ex: PlanExercise) => ex.category === 'main')
                .map((ex: PlanExercise) => ex.exercise_name);
            functionResponseText = `Day ${day_of_week} has ${mainExercises.length} main exercises. I can remove any of these: ${mainExercises.join(', ')}. Which would you like to remove?`;
        } else {
            functionResponseText = t('chat.dayNotFound', { day: day_of_week });
        }
    } else if (functionCall.name === 'createSuperset' && updatedPlan) {
        // NEW: Create a superset block from multiple exercises
        const { day_of_week, exercises, rounds, rest_between_rounds } = functionCall.args;

        const dayIndex = (updatedPlan.weeklyPlan || []).findIndex((d: PlanDay) => d.day_of_week === day_of_week);
        if (dayIndex !== -1 && exercises && exercises.length >= 2) {
            const dayToUpdate = updatedPlan.weeklyPlan[dayIndex];

            // Create exercises for the superset
            const supersetExercises: PlanExercise[] = exercises.map((ex: any, idx: number) => ({
                exercise_name: `${String.fromCharCode(65 + idx)}${idx + 1}: ${ex.exercise_name}`, // A1, A2, etc.
                metrics_template: ex.metrics_template,
                category: ex.category || 'main',
                rpe: null,
                notes: null,
            }));

            // Create the superset block
            const supersetBlock: WorkoutBlock = {
                type: 'superset',
                title: `Superset: ${exercises.map((ex: any) => ex.exercise_name).join(' + ')}`,
                rounds: rounds || 3,
                exercises: supersetExercises
            };

            // Initialize blocks if needed
            if (!dayToUpdate.blocks) {
                dayToUpdate.blocks = [];
            }

            // Find position for the superset (after warmups, before cooldowns)
            const blocks = [...(dayToUpdate.blocks || [])];
            let insertIndex = blocks.length;

            // Find the first cooldown block
            const firstCooldownIndex = blocks.findIndex(b =>
                b.exercises.some(ex => ex.category === 'cooldown')
            );
            if (firstCooldownIndex !== -1) {
                insertIndex = firstCooldownIndex;
            }

            blocks.splice(insertIndex, 0, supersetBlock);
            dayToUpdate.blocks = blocks;

            onPlanUpdate(updatedPlan);
            const exerciseNames = exercises.map((ex: any) => ex.exercise_name).join(', ');
            notify({ type: 'success', message: `Created superset: ${exerciseNames}` });
            functionResponseText = `Successfully created a ${rounds}-round superset with: ${exerciseNames}${rest_between_rounds ? ` (${rest_between_rounds}s rest between rounds)` : ''}`;
        } else if (!exercises || exercises.length < 2) {
            functionResponseText = 'A superset needs at least 2 exercises. Please specify which exercises to combine.';
        } else {
            functionResponseText = t('chat.dayNotFound', { day: day_of_week });
        }
    } else {
        functionResponseText = t('chat.planNotAvailable');
    }

    return functionResponseText;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !plan?._id) return;

    // Check rate limits
    if (user?.id && userProfile) {
      const tier = userProfile.apiUsage?.tier || 'free';
      const usage = userProfile.apiUsage;

      if (usage && hasExceededLimit(usage, tier, 'chat')) {
        const remaining = getRemainingUsage(usage, tier);
        setError(getLimitMessage('chat', tier, remaining));
        return;
      }
    }

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    setError(null);

    // Track chatbot message sent
    if (user?.id) {
      analytics.track(EventTypes.CHATBOT_MESSAGE_SENT, {
        messageLength: currentInput.length,
        hasActivePlan: !!plan,
        dayOfWeek,
      });
    }

    try {
      // Call secure Convex action
      const result = await handleChatMessageAction({
        message: currentInput,
        planId: plan._id,
        dayOfWeek,
        conversationHistory,
        language: i18n.language,
      });

      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: currentInput },
      ]);

      if (result.type === 'function_call') {
        // AI wants to modify the plan
        const functionCall = {
          name: result.functionName,
          args: result.functionArgs,
        };

        // Track function call
        if (user?.id) {
          analytics.track(EventTypes.CHATBOT_FUNCTION_CALLED, {
            functionName: functionCall.name,
            success: true,
          });
        }

        // Execute function locally and get response text
        const functionResponseText = handleFunctionCall(functionCall);

        // Add the function response to conversation
        setConversationHistory(prev => [
          ...prev,
          { role: 'model', content: functionResponseText },
        ]);

        // Show the response to user
        setMessages(prev => [...prev, { role: 'model', text: functionResponseText }]);

      } else if (result.type === 'text') {
        // Simple text response
        const aiResponse = result.textResponse || t('chat.hello');
        setMessages(prev => [...prev, { role: 'model', text: aiResponse }]);

        // Update conversation history
        setConversationHistory(prev => [
          ...prev,
          { role: 'model', content: aiResponse },
        ]);
      }

      // Track chat message for rate limiting
      if (user?.id) {
        await incrementChatUsageMutation({ userId: user.id });
      }
    } catch (err) {
      const e = err as Error;
      console.error("Chatbot error:", e);
      const errorMessage = e.message || t('errors.unknownError');
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'model', text: t('chat.errorMessage', { error: errorMessage }) }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    {isOpen && (
        <div className={cn(
          'fixed inset-0',
          'z-[var(--z-modal)]',
          'flex items-end justify-center sm:items-center'
        )}>
        <div
          className={cn(
            'fixed inset-0',
            'bg-black/50',
            'animate-fade-in'
          )}
          onClick={onClose}
        />
        <div className={cn(
          'relative z-[var(--z-modal)]',
          'bg-[var(--surface-primary)]',
          'border border-[var(--border-default)]',
          'w-full max-w-lg',
          'h-[90vh] sm:h-[70vh]',
          'rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)]',
          'shadow-[var(--shadow-lg)]',
          'flex flex-col',
          'animate-fade-in-up-custom'
        )}>
            <header className={cn(
              'flex items-center justify-between',
              'p-[var(--space-4)]',
              'border-b border-[var(--border-default)]',
              'bg-gradient-to-r from-[var(--brand-primary-subtle)] to-[var(--surface-secondary)]',
              'shrink-0'
            )}>
                <div className="flex items-center gap-[var(--space-3)]">
                    <div className={cn(
                      'w-12 h-12',
                      'rounded-full',
                      'bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)]',
                      'flex items-center justify-center',
                      'shadow-[var(--shadow-md)]'
                    )}>
                      <SparklesIcon className="w-6 h-6 text-[var(--text-on-brand)]" />
                    </div>
                    <div>
                        <h2 className={cn(
                          'text-[var(--text-lg)]',
                          'font-[var(--weight-bold)]',
                          'text-[var(--text-primary)]'
                        )}>{t('chat.assistantTitle')}</h2>
                        <p className={cn(
                          'text-[var(--text-xs)]',
                          'text-[var(--text-secondary)]'
                        )}>{t('chat.poweredBy')}</p>
                    </div>
                </div>
                <button
                  onClick={onClose}
                  className={cn(
                    'min-w-[44px] min-h-[44px]',
                    'flex items-center justify-center',
                    'rounded-full',
                    'text-[var(--text-secondary)]',
                    'hover:bg-[var(--surface-hover)]',
                    'hover:text-[var(--text-primary)]',
                    'transition-colors duration-[var(--duration-fast)]',
                    'active:scale-95'
                  )}
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </header>

            {messages.length === 1 && (
              <div className={cn(
                'p-[var(--space-4)]',
                'border-b border-[var(--border-default)]',
                'bg-[var(--surface-secondary)]/30',
                'shrink-0'
              )}>
                <p className={cn(
                  'text-[var(--text-2xs)]',
                  'uppercase tracking-[var(--tracking-wider)]',
                  'text-[var(--text-tertiary)]',
                  'font-[var(--weight-bold)]',
                  'mb-[var(--space-3)]'
                )}>Quick Actions</p>
                <div className="grid grid-cols-2 gap-[var(--space-2)]">
                  {[
                    {
                      svg: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
                      label: 'Make Harder',
                      prompt: 'Make today\'s workout harder'
                    },
                    {
                      svg: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
                      label: 'Make Easier',
                      prompt: 'Make today\'s workout easier'
                    },
                    {
                      svg: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
                      label: 'Swap Exercise',
                      prompt: 'Help me swap an exercise'
                    },
                    {
                      svg: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                      label: 'Short on Time',
                      prompt: 'I only have 30 minutes today'
                    },
                  ].map((action, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(action.prompt);
                        inputRef.current?.focus();
                      }}
                      className={cn(
                        'p-[var(--space-3-5)]',
                        'bg-[var(--surface-primary)]',
                        'border-2 border-[var(--border-default)]',
                        'rounded-[var(--radius-xl)]',
                        'hover:border-[var(--brand-primary)]',
                        'hover:bg-[var(--brand-primary-subtle)]',
                        'transition-all duration-[var(--duration-fast)]',
                        'text-left',
                        'group',
                        'active:scale-95'
                      )}
                    >
                      <div className={cn(
                        'w-9 h-9',
                        'rounded-[var(--radius-lg)]',
                        'bg-gradient-to-br from-[var(--brand-primary-subtle)] to-[var(--surface-secondary)]',
                        'flex items-center justify-center',
                        'mb-[var(--space-2)]',
                        'text-[var(--brand-primary)]',
                        'group-hover:scale-110',
                        'transition-transform duration-[var(--duration-fast)]'
                      )}>
                        {action.svg}
                      </div>
                      <p className={cn(
                        'text-[var(--text-sm)]',
                        'font-[var(--weight-bold)]',
                        'text-[var(--text-primary)]'
                      )}>{action.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-[var(--space-4)] space-y-[var(--space-4)]">
                {messages.map((msg, index) => (
                    <div key={index} className={cn(
                      'flex gap-[var(--space-3)]',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}>
                        {msg.role === 'model' && (
                          <div className={cn(
                            'w-8 h-8',
                            'rounded-full',
                            'bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)]',
                            'flex items-center justify-center',
                            'shrink-0',
                            'shadow-[var(--shadow-sm)]'
                          )}>
                            <SparklesIcon className="w-5 h-5 text-[var(--text-on-brand)]"/>
                          </div>
                        )}
                        <div className={cn(
                          'max-w-xs md:max-w-md',
                          'p-[var(--space-3-5)]',
                          'rounded-[var(--radius-2xl)]',
                          'shadow-[var(--shadow-sm)]',
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] text-[var(--text-on-brand)] rounded-br-[var(--radius-lg)]'
                            : 'bg-[var(--surface-primary)] border-2 border-[var(--border-default)] text-[var(--text-primary)] rounded-bl-[var(--radius-lg)]'
                        )}>
                            <p className={cn(
                              'text-[var(--text-sm)]',
                              'leading-relaxed',
                              'whitespace-pre-wrap',
                              'font-[var(--weight-medium)]'
                            )}>{msg.text}</p>
                        </div>
                    </div>
                ))}
                 {isLoading && (
                    <div className="flex gap-[var(--space-3)] justify-start">
                        <div className={cn(
                          'w-8 h-8',
                          'rounded-full',
                          'bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)]',
                          'flex items-center justify-center',
                          'shrink-0',
                          'shadow-[var(--shadow-sm)]'
                        )}>
                          <SparklesIcon className="w-5 h-5 text-[var(--text-on-brand)]"/>
                        </div>
                        <div className={cn(
                          'max-w-xs md:max-w-md',
                          'p-[var(--space-3-5)]',
                          'rounded-[var(--radius-2xl)]',
                          'bg-[var(--surface-primary)]',
                          'border-2 border-[var(--border-default)]',
                          'text-[var(--text-primary)]',
                          'rounded-bl-[var(--radius-lg)]',
                          'shadow-[var(--shadow-sm)]'
                        )}>
                            <div className="flex items-center space-x-1">
                                <span className="h-2.5 w-2.5 bg-[var(--brand-primary)] rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                                <span className="h-2.5 w-2.5 bg-[var(--brand-primary)] rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                                <span className="h-2.5 w-2.5 bg-[var(--brand-primary)] rounded-full animate-pulse"></span>
                            </div>
                        </div>
                    </div>
                 )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies - Show when AI asks a question */}
            {messages.length > 1 &&
             messages[messages.length - 1].role === 'model' &&
             (messages[messages.length - 1].text.includes('?') ||
              messages[messages.length - 1].text.toLowerCase().includes('why')) && (
              <div className="px-[var(--space-4)] pb-[var(--space-2)] shrink-0">
                <p className={cn(
                  'text-[var(--text-2xs)]',
                  'text-[var(--text-tertiary)]',
                  'font-[var(--weight-bold)]',
                  'uppercase tracking-[var(--tracking-wider)]',
                  'mb-[var(--space-2)]'
                )}>
                  Quick Replies
                </p>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {[
                    "Because of pain",
                    "Preference",
                    "Don't have equipment",
                    "Too difficult",
                    "Too easy",
                    "Want variation"
                  ].map((reply, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(reply);
                        inputRef.current?.focus();
                      }}
                      className={cn(
                        'px-[var(--space-4)] py-[var(--space-3)]',
                        'min-h-[44px]',
                        'bg-[var(--surface-primary)]',
                        'border-2 border-[var(--border-default)]',
                        'rounded-[var(--radius-lg)]',
                        'text-[var(--text-sm)]',
                        'font-[var(--weight-bold)]',
                        'text-[var(--text-primary)]',
                        'hover:border-[var(--brand-primary)]',
                        'hover:bg-[var(--brand-primary-subtle)]',
                        'transition-all duration-[var(--duration-fast)]',
                        'active:scale-95',
                        'shadow-[var(--shadow-sm)]'
                      )}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
                <div className="p-[var(--space-4)] pt-0">
                    <div className={cn(
                      'bg-[var(--status-error-bg)]/10',
                      'border border-[var(--status-error-bg)]/30',
                      'text-[var(--status-error-bg)]',
                      'px-[var(--space-4)] py-[var(--space-2)]',
                      'rounded-[var(--radius-lg)]',
                      'flex items-center',
                      'text-[var(--text-sm)]'
                    )} role="alert">
                        <XCircleIcon className="w-5 h-5 mr-[var(--space-2)] flex-shrink-0"/>
                        <span>{error}</span>
                    </div>
                </div>
            )}

            <footer className={cn(
              'p-[var(--space-4)]',
              'border-t border-[var(--border-default)]',
              'shrink-0',
              'bg-[var(--surface-secondary)]'
            )}>
                <form onSubmit={handleSubmit} className="flex items-center gap-[var(--space-2)]">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={plan ? t('chat.askAboutPlan') : t('chat.loading')}
                      disabled={isLoading || !plan}
                      className={cn(
                        'flex-1',
                        'px-[var(--space-4)] py-[var(--space-3)]',
                        'text-[var(--text-sm)]',
                        'font-[var(--weight-medium)]',
                        'text-[var(--text-primary)]',
                        'bg-[var(--surface-primary)]',
                        'rounded-full',
                        'border-2 border-[var(--border-default)]',
                        'placeholder:text-[var(--text-tertiary)]',
                        'focus:ring-2 focus:ring-[var(--brand-primary)]/20',
                        'focus:border-[var(--brand-primary)]',
                        'focus:outline-none',
                        'transition-all duration-[var(--duration-fast)]',
                        'disabled:opacity-70',
                        'shadow-[var(--shadow-sm)]'
                      )}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className={cn(
                        'p-[var(--space-3)]',
                        'bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)]',
                        'text-[var(--text-on-brand)]',
                        'rounded-full',
                        'shadow-[var(--shadow-md)]',
                        'hover:shadow-[var(--shadow-lg)]',
                        'hover:scale-105',
                        'focus:outline-none',
                        'focus:ring-2 focus:ring-offset-2',
                        'focus:ring-offset-[var(--surface-primary)]',
                        'focus:ring-[var(--brand-primary)]',
                        'disabled:opacity-50',
                        'disabled:cursor-not-allowed',
                        'transition-all duration-[var(--duration-fast)]'
                      )}
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                </form>
            </footer>
        </div>
        </div>
    )}
    </>
  );
}
