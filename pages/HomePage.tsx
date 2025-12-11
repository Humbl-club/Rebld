import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutPlan, PlanDay, PlanExercise, DailyRoutine, UserProfile } from '../types';
import { CoffeeIcon, TimerIcon, ChevronDownIcon, SparklesIcon, RepeatIcon, ClockIcon, ZapIcon, PercentIcon, TrendingUpIcon, SpeedometerIcon, CogIcon, QuestionMarkCircleIcon, DumbbellIcon } from '../components/icons';
import { useClerk, useUser } from '@clerk/clerk-react';
import { notify } from '../components/layout/Toast';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { IntensityBadge } from '../components/ui/intensity-badge';
// NotificationSkeleton removed - was causing layout shift when notifications query resolved
import { cn } from '../lib/utils';
import { calculateWorkoutIntensity, getWorkoutType } from '../lib/workoutUtils';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { XMarkIcon } from '../components/icons';

/* ═══════════════════════════════════════════════════════════════
   HOMEPAGE - Phase 9.4 Page Redesign

   Main dashboard showing workout plan overview.
   iPhone-optimized with safe areas and touch targets.
   Uses design tokens throughout.
   ═══════════════════════════════════════════════════════════════ */

type SessionType = PlanDay | DailyRoutine;

interface HomePageProps {
    plan: WorkoutPlan;
    onStartSession: (session: SessionType) => void;
    onOpenChat: () => void;
    userProfile?: UserProfile | null;
    onRefreshPlan?: () => Promise<void>;
}

// Helper function to get weekday names with translations
const getWeekdays = (t: (key: string) => string): string[] => [
    t('plan.monday'),
    t('plan.tuesday'),
    t('plan.wednesday'),
    t('plan.thursday'),
    t('plan.friday'),
    t('plan.saturday'),
    t('plan.sunday')
];

// Helper function to get short day names with translations
const getShortDays = (t: (key: string) => string): string[] => [
    t('plan.mon'),
    t('plan.tue'),
    t('plan.wed'),
    t('plan.thu'),
    t('plan.fri'),
    t('plan.sat'),
    t('plan.sun')
];

// ─────────────────────────────────────────────────────────────
// METRIC TAG - Compact metric display
// ─────────────────────────────────────────────────────────────

const MetricTag: React.FC<{ icon: React.ElementType; value: string | number | null | undefined }> = ({ icon: Icon, value }) => {
    if (!value) return null;
    return (
        <div
            className={cn(
                "flex items-center gap-[var(--space-1-5)]",
                "bg-[var(--surface-secondary)]",
                "px-[var(--space-3)] py-[var(--space-1-5)]",
                "rounded-[var(--radius-md)]",
                "border border-[var(--border-subtle)]"
            )}
        >
            <Icon className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--text-secondary)]">
                {value}
            </span>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// EXERCISE ROW - Individual exercise display
// ─────────────────────────────────────────────────────────────

const ExerciseRow: React.FC<{ exercise: PlanExercise, style: React.CSSProperties; index: number }> = ({ exercise, style, index }) => {
    const { t } = useTranslation();
    const { metrics_template: mt, rpe } = exercise;
    let setsReps = '';
    if (mt?.target_sets && mt.target_reps) {
        setsReps = `${mt.target_sets} × ${mt.target_reps}`;
    } else if (mt?.type === 'sets_duration' && mt.target_duration_s) {
       setsReps = `${mt.target_sets} × ${mt.target_duration_s}s`;
    }

    const handleExerciseInfo = () => {
        notify({ type: 'info', message: t('home.exerciseExplanationsComingSoon') });
    };

    return (
        <div
            className="py-[var(--space-4)] flex flex-col items-start animate-fade-in-up"
            style={{ ...style, animationDelay: `${index * 40}ms` }}
        >
            <div className="flex items-center gap-[var(--space-2-5)] w-full">
                <p className="font-[var(--weight-semibold)] text-[var(--text-base)] text-[var(--text-primary)] flex-1">
                    {exercise.exercise_name}
                </p>
                <button
                    onClick={handleExerciseInfo}
                    className={cn(
                        "p-[var(--space-2)] rounded-[var(--radius-lg)]",
                        "min-w-[var(--height-touch-min)] min-h-[var(--height-touch-min)]",
                        "flex items-center justify-center",
                        "hover:bg-[var(--surface-secondary)]",
                        "active:bg-[var(--surface-hover)]",
                        "transition-all duration-[var(--duration-fast)]"
                    )}
                    aria-label={`Info about ${exercise.exercise_name}`}
                >
                    <QuestionMarkCircleIcon className="w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] transition-colors" />
                </button>
            </div>
            {exercise.notes && (
                <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-[var(--space-1-5)] leading-[var(--leading-relaxed)]">
                    {exercise.notes}
                </p>
            )}
            <div className="flex items-center flex-wrap gap-[var(--space-2)] mt-[var(--space-3)]">
                {setsReps && <MetricTag icon={RepeatIcon} value={setsReps} />}
                {mt?.rest_period_s && <MetricTag icon={ClockIcon} value={`${mt.rest_period_s}s`} />}
                {rpe && <MetricTag icon={ZapIcon} value={`RPE ${rpe}`} />}
                {mt?.one_rep_max_percentage && <MetricTag icon={PercentIcon} value={`${mt.one_rep_max_percentage}%`} />}
                {mt?.incline && <MetricTag icon={TrendingUpIcon} value={mt.incline} />}
                {mt?.speed && <MetricTag icon={SpeedometerIcon} value={mt.speed} />}
                {mt?.resistance && <MetricTag icon={CogIcon} value={mt.resistance} />}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// WORKOUT CARD - Today's workout display
// ─────────────────────────────────────────────────────────────

const WorkoutCard: React.FC<{
    session: SessionType;
    title: string;
    onStartSession: (session: SessionType) => void;
    isPrimary?: boolean;
}> = ({ session, title, onStartSession, isPrimary = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const exercises = useMemo(() => {
        if ('blocks' in session && Array.isArray(session.blocks)) {
            return session.blocks.flatMap(b => Array.isArray(b.exercises) ? b.exercises : []);
        }
        if ('exercises' in session && Array.isArray(session.exercises)) {
            return session.exercises;
        }
        return [];
    }, [session]);

    const hasWorkout = exercises.length > 0;

    const intensity = useMemo(() => {
        if ('blocks' in session && session.blocks) {
            return calculateWorkoutIntensity(session as PlanDay);
        }
        return { level: 'Moderate' as const, value: 50, color: 'accent', gradient: 'gradient-accent' };
    }, [session]);

    const estimatedDuration = useMemo(() => {
        // Use session's estimated_duration if available (especially for cardio sessions)
        if ((session as any).estimated_duration) {
            return (session as any).estimated_duration;
        }

        // Calculate based on exercises, accounting for cardio duration
        let total = 0;
        for (const ex of exercises) {
            const name = (ex.exercise_name || '').toLowerCase();
            const isCardio = name.includes('run') || name.includes('bike') || name.includes('row') ||
                            name.includes('cycle') || name.includes('swim') || name.includes('treadmill') ||
                            name.includes('elliptical') || name.includes('cardio') || name.includes('jog') ||
                            name.includes('walk') || name.includes('sprint') || name.includes('hiit');

            if (isCardio) {
                const metrics = ex.metrics_template as any;

                // Check for interval training (sets × (work + rest))
                if (metrics?.target_sets && (metrics?.work_duration_s || metrics?.rest_duration_s)) {
                    const sets = metrics.target_sets || 8;
                    const workTime = metrics.work_duration_s || 20;
                    const restTime = metrics.rest_duration_s || 40;
                    total += (sets * (workTime + restTime)) / 60; // Convert to minutes
                }
                // Check for regular duration
                else if (metrics?.target_duration_minutes) {
                    total += metrics.target_duration_minutes;
                }
                else if (metrics?.target_duration_s) {
                    total += metrics.target_duration_s / 60; // Convert seconds to minutes
                }
                // Check for distance-based (estimate ~5 min per km, 3 min per 500m)
                else if (metrics?.target_distance_km) {
                    total += metrics.target_distance_km * 5;
                }
                else if (metrics?.target_distance_m) {
                    total += (metrics.target_distance_m / 500) * 3;
                }
                else {
                    total += 20; // Default cardio: 20 min
                }
            } else {
                total += 4; // Strength exercises: ~4 min each
            }
        }
        return Math.round(total);
    }, [exercises, session]);

    return (
        <Card
            variant={isPrimary ? "premium" : "default"}
            className={cn(
                "group relative overflow-hidden",
                "transition-all duration-[var(--duration-normal)]"
            )}
        >
            {/* Gradient overlay on hover */}
            <div
                className={cn(
                    "absolute inset-0",
                    "bg-gradient-to-br from-[var(--brand-primary)]/8 via-[var(--brand-primary)]/5 to-transparent",
                    "opacity-0 group-hover:opacity-100",
                    "transition-opacity duration-[var(--duration-normal)]",
                    "pointer-events-none"
                )}
            />

            <CardHeader className={cn("p-[var(--space-4)] sm:p-[var(--space-5)] relative z-10")}>
                <div className="flex justify-between items-start gap-[var(--space-3)]">
                    <div className="flex-1 min-w-0 space-y-[var(--space-2)]">
                        {/* Label row - brighter subtitle */}
                        <div className="flex items-center gap-[var(--space-2)] flex-wrap">
                            <span className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-widest)] text-white/70 font-[var(--weight-bold)]">
                                {title}
                            </span>
                            {isPrimary && (
                                <Badge variant="default" size="sm">
                                    <SparklesIcon className="w-3 h-3" />
                                    Today
                                </Badge>
                            )}
                            {hasWorkout && (
                                <IntensityBadge level={intensity.level} />
                            )}
                        </div>

                        {/* Title - high contrast white */}
                        <h3 className="text-[var(--text-lg)] font-[var(--weight-extrabold)] text-white leading-[var(--leading-tight)]">
                            {(session as any).focus || (session as any).session_name || 'Workout'}
                        </h3>

                        {/* Metrics row - brighter for readability */}
                        <div className="flex items-center gap-[var(--space-2)] flex-wrap text-[var(--text-xs)] text-[var(--text-secondary)]">
                            <span className="flex items-center gap-[var(--space-1)] text-white/80">
                                <ClockIcon className="w-3.5 h-3.5 text-white/60" />
                                ~{estimatedDuration} min
                            </span>
                            <span className="w-1 h-1 rounded-full bg-white/30" />
                            <span className="flex items-center gap-[var(--space-1)] text-white/80">
                                <DumbbellIcon className="w-3.5 h-3.5 text-white/60" />
                                {exercises.length} exercises
                            </span>
                        </div>
                    </div>

                    {/* Expand button - prominent and visible */}
                    {hasWorkout && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={cn(
                                "px-[var(--space-3)] py-[var(--space-2)]",
                                "min-h-[var(--height-touch-min)]",
                                "flex items-center gap-[var(--space-1-5)]",
                                "rounded-[var(--radius-lg)]",
                                "border",
                                isExpanded
                                    ? "bg-[var(--brand-primary-subtle)] border-[var(--brand-primary)]/30 text-[var(--brand-primary)]"
                                    : "bg-[var(--surface-tertiary)] border-[var(--border-strong)] text-white",
                                "hover:bg-[var(--brand-primary-subtle)]",
                                "hover:border-[var(--brand-primary)]/50",
                                "hover:text-[var(--brand-primary)]",
                                "transition-all duration-[var(--duration-fast)]",
                                "active:scale-95"
                            )}
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            <span className="text-[10px] font-[var(--weight-bold)] uppercase tracking-wider">
                                {isExpanded ? 'Hide' : 'View'}
                            </span>
                            <ChevronDownIcon className={cn(
                                "w-4 h-4 transition-transform duration-[var(--duration-fast)]",
                                isExpanded && "rotate-180"
                            )} />
                        </button>
                    )}
                </div>
            </CardHeader>

            {/* Expandable exercise list with block separation */}
            <div className={cn(
                "overflow-hidden transition-all duration-[var(--duration-normal)]",
                isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <CardContent className="px-[var(--space-4)] sm:px-[var(--space-5)] pt-0">
                    <div className="pt-[var(--space-4)] border-t border-[var(--border-subtle)] space-y-[var(--space-6)]">
                        {('blocks' in session && Array.isArray(session.blocks)) ? (
                            // Display with block separation
                            session.blocks.map((block, blockIdx) => {
                                const blockExercises = Array.isArray(block.exercises) ? block.exercises : [];
                                if (blockExercises.length === 0) return null;

                                return (
                                    <div key={blockIdx} className="space-y-[var(--space-2)]">
                                        {/* Block header */}
                                        <div className="flex items-center gap-[var(--space-2)]">
                                            <div className="h-px flex-1 bg-[var(--border-default)]"></div>
                                            <p className="text-[var(--text-2xs)] font-[var(--weight-bold)] text-[var(--text-tertiary)] uppercase tracking-wider">
                                                {block.title || `Block ${blockIdx + 1}`}
                                                {block.type === 'superset' && ' • Superset'}
                                                {block.type === 'amrap' && ' • AMRAP'}
                                            </p>
                                            <div className="h-px flex-1 bg-[var(--border-default)]"></div>
                                        </div>

                                        {/* Block exercises */}
                                        <div className="divide-y divide-[var(--border-subtle)]">
                                            {blockExercises.map((ex, exIdx) => (
                                                <ExerciseRow
                                                    key={`${ex.exercise_name}-${blockIdx}-${exIdx}`}
                                                    exercise={ex}
                                                    index={exIdx}
                                                    style={{ animationDelay: `${exIdx * 40}ms` }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            // Fallback: flat list
                            <div className="divide-y divide-[var(--border-subtle)]">
                                {exercises.map((ex, index) => (
                                    <ExerciseRow
                                        key={`${ex.exercise_name}-${index}`}
                                        exercise={ex}
                                        index={index}
                                        style={{ animationDelay: `${index * 40}ms` }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </div>

            {hasWorkout && (
                <CardFooter className="p-[var(--space-4)] sm:p-[var(--space-5)] pt-[var(--space-3)]">
                    <div className="flex gap-[var(--space-2)] w-full">
                        <Button
                            onClick={() => onStartSession(session)}
                            variant={isPrimary ? "primary" : "secondary"}
                            size="lg"
                            fullWidth
                            leftIcon={<TimerIcon className="w-4 h-4" />}
                        >
                            Start Workout
                        </Button>
                    </div>
                </CardFooter>
            )}
        </Card>
    );
};

// ─────────────────────────────────────────────────────────────
// DAY SELECTOR BUTTON
// ─────────────────────────────────────────────────────────────

interface DaySelectorButtonProps {
    day: PlanDay;
    index: number;
    isToday: boolean;
    isSelected: boolean;
    isPast: boolean;
    shortDay: string;
    onClick: () => void;
    buttonRef: (el: HTMLButtonElement | null) => void;
}

const DaySelectorButton: React.FC<DaySelectorButtonProps> = ({
    day,
    index,
    isToday,
    isSelected,
    isPast,
    shortDay,
    onClick,
    buttonRef,
}) => {
    const hasExercises = (day.blocks || []).flatMap(b => b.exercises || []).length > 0;

    return (
        <button
            ref={buttonRef}
            onClick={onClick}
            role="tab"
            aria-selected={isSelected}
            aria-label={`${shortDay}${hasExercises ? ', workout day' : ', rest day'}${isToday ? ', today' : ''}`}
            className={cn(
                // Base - iPhone touch target compliant, flex to fill available space
                "relative flex-1",
                "min-h-[var(--height-button)]",
                "py-[var(--space-2-5)]",
                "rounded-[var(--radius-xl)]",
                "font-[var(--weight-bold)] text-[var(--text-sm)]",
                "transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)]",
                "border",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2",
                "active:scale-[0.96]",

                // Selected state - glowing highlight
                isSelected && [
                    "border-[var(--brand-primary)]",
                    "bg-[var(--brand-primary-subtle)]",
                    "text-[var(--brand-primary)]",
                    "shadow-[0_0_20px_rgba(239,68,68,0.4)]",
                ],

                // Today (not selected) - pure white text
                isToday && !isSelected && [
                    "border-[var(--brand-primary)]/50",
                    "bg-[var(--surface-secondary)]",
                    "text-white",
                ],

                // Future day with workout - bright white text
                !isSelected && !isToday && !isPast && hasExercises && [
                    "border-[var(--border-strong)]",
                    "bg-[var(--surface-primary)]",
                    "text-white",
                    "hover:border-[var(--brand-primary)]/50",
                    "hover:bg-[var(--surface-secondary)]",
                ],

                // Future day without workout - muted
                !isSelected && !isToday && !isPast && !hasExercises && [
                    "border-[var(--border-default)]",
                    "bg-[var(--surface-primary)]",
                    "text-[var(--text-tertiary)]",
                    "hover:border-[var(--border-strong)]",
                    "hover:bg-[var(--surface-secondary)]",
                ],

                // Past day (not selected)
                isPast && !isSelected && [
                    "border-[var(--border-subtle)]",
                    "bg-[var(--surface-primary)]",
                    "text-[var(--text-tertiary)]",
                    "opacity-50 hover:opacity-70",
                ]
            )}
        >
            <div className="text-center">
                {/* Day abbreviation - ALWAYS visible, high contrast */}
                <div className={cn(
                    "text-[11px] font-[var(--weight-extrabold)] uppercase tracking-[0.08em] mb-[var(--space-1)]",
                    isSelected ? "text-[var(--brand-primary)]" : hasExercises && !isPast ? "text-white" : ""
                )}>
                    {shortDay}
                </div>

                {/* Workout indicator - larger, glowing when has workout */}
                <div className={cn(
                    "w-2.5 h-2.5 rounded-full mx-auto transition-all duration-[var(--duration-fast)]",
                    hasExercises
                        ? isSelected
                            ? "bg-[var(--brand-primary)] shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                            : "bg-[var(--brand-primary)] shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                        : "bg-[var(--border-default)] w-1.5 h-1.5"
                )} />
            </div>

            {/* Today badge - more prominent */}
            {isToday && !isSelected && (
                <div className={cn(
                    "absolute -top-1.5 left-1/2 -translate-x-1/2",
                    "px-[var(--space-2)] py-[var(--space-0-5)]",
                    "rounded-full",
                    "bg-[var(--brand-primary)]",
                    "text-white",
                    "text-[8px] font-[var(--weight-extrabold)]",
                    "uppercase tracking-[0.05em]",
                    "shadow-[0_2px_8px_rgba(239,68,68,0.5)]"
                )}>
                    Today
                </div>
            )}
        </button>
    );
};

// ─────────────────────────────────────────────────────────────
// HOMEPAGE MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function HomePage({ plan, onStartSession, onOpenChat, userProfile, onRefreshPlan }: HomePageProps) {
    const { t } = useTranslation();
    const { user } = useUser();
    const userId = user?.id || null;
    const shortDays = getShortDays(t);
    const todayDayOfWeek = new Date().getDay();
    const todayIndex = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;
    const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);
    const daySelectorRef = useRef<HTMLDivElement>(null);
    const dayButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Get buddy notifications
    const notifications = useQuery(
        api.buddyQueries.getBuddyNotifications,
        userId ? { userId } : "skip"
    );

    const markNotificationReadMutation = useMutation(api.buddyMutations.markNotificationRead);

    const weeklyPlan = Array.isArray(plan?.weeklyPlan) ? plan.weeklyPlan : [];
    const activeDayPlan = weeklyPlan[selectedDayIndex];
    const dailyRoutine = plan?.dailyRoutine;

    // Handle 2x daily training - check if day has sessions array
    const hasTwoADaySessions = activeDayPlan?.sessions && Array.isArray(activeDayPlan.sessions) && activeDayPlan.sessions.length > 0;

    // For 2x daily, get AM and PM sessions
    const amSession = hasTwoADaySessions
        ? activeDayPlan.sessions.find((s: any) => s.time_of_day === 'morning')
        : null;
    const pmSession = hasTwoADaySessions
        ? activeDayPlan.sessions.find((s: any) => s.time_of_day === 'evening' || s.time_of_day === 'afternoon')
        : null;

    // Auto-scroll to selected day
    useEffect(() => {
        const selectedButton = dayButtonRefs.current[selectedDayIndex];
        const container = daySelectorRef.current;

        if (selectedButton && container) {
            const buttonLeft = selectedButton.offsetLeft;
            const buttonWidth = selectedButton.offsetWidth;
            const containerWidth = container.offsetWidth;
            const scrollLeft = container.scrollLeft;
            const buttonRight = buttonLeft + buttonWidth;
            const containerRight = scrollLeft + containerWidth;

            if (buttonLeft < scrollLeft) {
                container.scrollTo({ left: buttonLeft - 8, behavior: 'smooth' });
            } else if (buttonRight > containerRight) {
                container.scrollTo({ left: buttonRight - containerWidth + 8, behavior: 'smooth' });
            }
        }
    }, [selectedDayIndex]);

    const { signOut } = useClerk();

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('home.greeting.morning');
        if (hour < 18) return t('home.greeting.afternoon');
        return t('home.greeting.evening');
    };

    // Error state
    if (!activeDayPlan) {
        return (
            <div className={cn(
                "w-full max-w-2xl mx-auto",
                "px-[var(--space-5)] py-[var(--space-8)]",
                "flex-1 flex flex-col items-center justify-center text-center"
            )}>
                <div className={cn(
                    "w-20 h-20",
                    "bg-[var(--surface-secondary)]",
                    "rounded-full",
                    "flex items-center justify-center",
                    "mb-[var(--space-4)]"
                )}>
                    <CoffeeIcon className="w-12 h-12 text-[var(--status-error-bg)]" />
                </div>
                <h2 className="text-[var(--text-2xl)] font-[var(--weight-bold)] text-[var(--text-primary)]">
                    Something went wrong
                </h2>
                <p className="text-[var(--text-secondary)] mt-[var(--space-2)] max-w-xs">
                    Could not find a workout plan for today.
                </p>
            </div>
        );
    }

    // Check if there's a workout - handle both single session and 2x daily
    const hasWorkout = hasTwoADaySessions
        ? (amSession || pmSession) // 2x daily: has at least one session
        : (Array.isArray(activeDayPlan.blocks) ? activeDayPlan.blocks : [])
            .flatMap(b => Array.isArray(b.exercises) ? b.exercises : [])
            .length > 0;

    return (
            <div className={cn(
                "w-full max-w-lg mx-auto",
                "px-[var(--space-4)]",
                "flex flex-col",
                "h-screen" // Full viewport height
            )}>
                {/* ─────────────────────────────────────────────────────────────
                    HEADER - Fixed at top, right below Dynamic Island
                   ───────────────────────────────────────────────────────────── */}
            <header className={cn(
                "pt-[env(safe-area-inset-top)]", // Tight to Dynamic Island
                "pb-[var(--space-2)]",
                "flex-shrink-0"
            )}>
                <div className="flex items-center justify-between mb-[var(--space-3)] sm:mb-[var(--space-4)]">
                    <div className="space-y-[var(--space-1)]">
                        {/* Logo */}
                        <div
                            className="text-[26px] sm:text-[28px] font-[var(--weight-black)] tracking-normal leading-tight"
                            style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
                        >
                            <span className="text-[var(--text-primary)]">RE</span>
                            <span className="text-[var(--brand-primary)]">BLD</span>
                        </div>
                        {/* Date - brighter, more prominent */}
                        <p className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-white/80">
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </p>
                    </div>
                    {/* Greeting - bright white */}
                    <p className="text-[var(--text-sm)] font-[var(--weight-bold)] text-white">
                        {getGreeting()}
                    </p>
                </div>

                {/* ─────────────────────────────────────────────────────────────
                    DAY SELECTOR - Responsive grid, no scrolling
                   ───────────────────────────────────────────────────────────── */}
                <div
                    ref={daySelectorRef}
                    className={cn(
                        "flex justify-between gap-[var(--space-1)]",
                        "py-[var(--space-2)]"
                    )}
                    role="tablist"
                    aria-label="Select workout day"
                >
                        {weeklyPlan.map((day, index) => (
                            <DaySelectorButton
                                key={index}
                                day={day}
                                index={index}
                                isToday={index === todayIndex}
                                isSelected={index === selectedDayIndex}
                                isPast={index < todayIndex}
                                shortDay={shortDays[index]}
                                onClick={() => setSelectedDayIndex(index)}
                                buttonRef={(el) => { dayButtonRefs.current[index] = el; }}
                            />
                        ))}
                </div>
            </header>

            {/* ─────────────────────────────────────────────────────────────
                MAIN CONTENT - Only this area scrolls
               ───────────────────────────────────────────────────────────── */}
            <main
                className={cn(
                    "flex-1 min-h-0", // min-h-0 is critical for flex children to scroll
                    "overflow-y-auto overflow-x-hidden",
                    "space-y-[var(--space-3)]",
                    "pb-[calc(var(--height-tab-bar)+env(safe-area-inset-bottom)+120px)]", // Extra space to scroll content above navbar
                    "-mx-[var(--space-4)] px-[var(--space-4)]" // Extend scroll area to edges
                )}
                style={{
                    WebkitOverflowScrolling: 'touch' // iOS momentum scrolling
                }}
            >
                {/* Buddy notification banner - NO skeleton to avoid layout shift */}
                {notifications && notifications.length > 0 && (
                    <div className={cn(
                        "mb-[var(--space-4)]",
                        "p-[var(--space-4)]",
                        "bg-[var(--brand-primary)]",
                        "text-[var(--text-on-brand)]",
                        "rounded-[var(--radius-2xl)]",
                        "shadow-[var(--shadow-md)]",
                        "animate-fade-in"
                    )}>
                        <div className="flex items-center justify-between gap-[var(--space-3)]">
                            <div className="flex-1">
                                <p className="text-[var(--text-sm)] font-[var(--weight-bold)]">
                                    {notifications[0].buddyName} {notifications[0].message}
                                </p>
                                <p className="text-[var(--text-xs)] opacity-80 mt-[var(--space-1)]">
                                    {new Date(notifications[0].createdAt).toLocaleTimeString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-[var(--space-2)]">
                                {hasWorkout && (
                                    <button
                                        onClick={() => onStartSession(activeDayPlan)}
                                        className={cn(
                                            "px-[var(--space-4)] py-[var(--space-2)]",
                                            "bg-white/20 hover:bg-white/30",
                                            "rounded-[var(--radius-lg)]",
                                            "font-[var(--weight-bold)] text-[var(--text-sm)]",
                                            "transition-all duration-[var(--duration-fast)]",
                                            "active:scale-95"
                                        )}
                                    >
                                        Start Now!
                                    </button>
                                )}
                                <button
                                    onClick={async () => {
                                        await markNotificationReadMutation({
                                            notificationId: notifications[0]._id
                                        });
                                    }}
                                    className={cn(
                                        "p-[var(--space-2)]",
                                        "min-w-[var(--height-touch-min)] min-h-[var(--height-touch-min)]",
                                        "flex items-center justify-center",
                                        "rounded-[var(--radius-lg)]",
                                        "bg-white/10 hover:bg-white/20",
                                        "transition-all duration-[var(--duration-fast)]"
                                    )}
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Today's workout or rest day */}
                {hasWorkout ? (
                    hasTwoADaySessions ? (
                        // 2x Daily Training - Show AM and PM cards
                        <div className="space-y-[var(--space-3)]">
                            {amSession && (
                                <WorkoutCard
                                    session={{ ...amSession, day_of_week: activeDayPlan.day_of_week }}
                                    title={`☀️ ${amSession.session_name || 'Morning Session'}`}
                                    onStartSession={onStartSession}
                                    isPrimary={true}
                                />
                            )}
                            {pmSession && (
                                <WorkoutCard
                                    session={{ ...pmSession, day_of_week: activeDayPlan.day_of_week }}
                                    title={`🌙 ${pmSession.session_name || 'Evening Session'}`}
                                    onStartSession={onStartSession}
                                    isPrimary={!amSession}
                                />
                            )}
                        </div>
                    ) : (
                        // Single session day
                        <WorkoutCard
                            session={activeDayPlan}
                            title={t('home.todaysWorkout')}
                            onStartSession={onStartSession}
                            isPrimary={true}
                        />
                    )
                ) : (
                    <Card variant="default" className="text-center py-[var(--space-10)] sm:py-[var(--space-12)]">
                        <CardContent className="pt-[var(--space-6)]">
                            <div className={cn(
                                "w-16 h-16 sm:w-20 sm:h-20",
                                "bg-[var(--status-success-bg)]",
                                "rounded-full",
                                "flex items-center justify-center",
                                "mx-auto mb-[var(--space-4)] sm:mb-[var(--space-5)]",
                                "shadow-[var(--shadow-md)]"
                            )}>
                                <CoffeeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white"/>
                            </div>
                            <CardTitle className="text-[var(--text-2xl)] sm:text-[var(--text-3xl)] font-[var(--weight-extrabold)] text-[var(--text-primary)] mb-[var(--space-2)]">
                                {t('home.restDay')}
                            </CardTitle>
                            <CardDescription className="text-[var(--text-sm)] sm:text-[var(--text-base)] mb-[var(--space-6)] px-[var(--space-4)] max-w-sm mx-auto leading-[var(--leading-relaxed)]">
                                {t('home.restDayMessage')}
                            </CardDescription>
                            <Button
                                onClick={() => onOpenChat()}
                                variant="secondary"
                                leftIcon={<SparklesIcon className="w-4 h-4" />}
                            >
                                {t('home.restDayOptions.generate')}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Daily routine card */}
                {dailyRoutine && (dailyRoutine.exercises || []).length > 0 && (
                    <Card
                        variant="interactive"
                        pressable
                        onClick={() => onStartSession(dailyRoutine)}
                        className="overflow-hidden relative"
                    >
                        {/* Gradient background on hover */}
                        <div className={cn(
                            "absolute inset-0",
                            "bg-gradient-to-r from-[var(--brand-primary)]/5 to-[var(--status-success-bg)]/5",
                            "opacity-0 group-hover:opacity-100",
                            "transition-opacity duration-[var(--duration-fast)]",
                            "pointer-events-none"
                        )} />

                        <CardContent className="px-[var(--space-4)] sm:px-[var(--space-5)] py-[var(--space-4)] sm:py-[var(--space-5)] flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-[var(--space-3)] flex-1 min-w-0">
                                {/* Icon */}
                                <div className={cn(
                                    "w-12 h-12",
                                    "rounded-[var(--radius-xl)]",
                                    "bg-gradient-to-br from-[var(--brand-primary-subtle)] to-[var(--surface-secondary)]",
                                    "flex items-center justify-center",
                                    "shrink-0",
                                    "group-hover:scale-110 transition-transform duration-[var(--duration-fast)]"
                                )}>
                                    <RepeatIcon className="w-6 h-6 text-[var(--brand-primary)]" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-[var(--text-2xs)] uppercase tracking-[var(--tracking-wider)] text-[var(--text-tertiary)] font-[var(--weight-bold)] mb-[var(--space-1)]">
                                        {t('home.dailyRoutine')}
                                    </p>
                                    <h4 className="text-[var(--text-base)] sm:text-[var(--text-lg)] font-[var(--weight-bold)] text-[var(--text-primary)] truncate">
                                        {dailyRoutine?.focus || 'Daily Routine'}
                                    </h4>
                                </div>
                            </div>

                            <ChevronDownIcon className={cn(
                                "w-5 h-5",
                                "text-[var(--text-tertiary)]",
                                "group-hover:text-[var(--brand-primary)]",
                                "group-hover:translate-x-1",
                                "transition-all duration-[var(--duration-fast)]",
                                "-rotate-90 shrink-0"
                            )} />
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
