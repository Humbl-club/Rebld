import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { WorkoutPlan, PlanDay, DailyRoutine, UserProfile, WorkoutSession } from '../types';
import { cn } from '../lib/utils';
import { useHaptic } from '../hooks/useAnimations';
import { FlameIcon, TrophyIcon, TargetIcon } from '../components/icons';

/* ═══════════════════════════════════════════════════════════════
   ZEN HOME PAGE - Premium Athlete Dashboard v2

   Design Philosophy:
   - Personal & intelligent - knows you, speaks to you
   - Shows the AI working FOR you
   - Progress-focused - always showing momentum
   - Emotionally engaging - celebrates wins
   ═══════════════════════════════════════════════════════════════ */

type SessionType = PlanDay | DailyRoutine | WorkoutSession;

interface ZenHomePageProps {
  plan: WorkoutPlan;
  onStartSession: (session: SessionType) => void;
  onOpenChat: () => void;
  userProfile?: UserProfile | null;
}

// Dynamic greetings based on time + context
function getGreeting(hour: number, name?: string): { greeting: string; subtext: string } {
  const firstName = name?.split(' ')[0] || null;

  if (hour >= 5 && hour < 12) {
    return {
      greeting: firstName ? `Morning, ${firstName}` : 'Good Morning',
      subtext: 'Ready to build something great?'
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: firstName ? `Hey ${firstName}` : 'Good Afternoon',
      subtext: 'Let\'s keep the momentum going'
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: firstName ? `Evening, ${firstName}` : 'Good Evening',
      subtext: 'Time to earn that rest'
    };
  } else {
    return {
      greeting: firstName ? `Late one, ${firstName}?` : 'Night Owl Mode',
      subtext: 'Nothing stops a true athlete'
    };
  }
}

// Motivational insights based on workout
function getWorkoutInsight(type: string, focus: string, exerciseCount: number): string {
  const insights: Record<string, string[]> = {
    strength: [
      'Building raw power today',
      'Heavy lifts, heavy gains',
      'Strength is earned, not given'
    ],
    cardio: [
      'Heart and lungs working overtime',
      'Endurance day — mental toughness',
      'Every step makes you harder to beat'
    ],
    hybrid: [
      'Best of both worlds',
      'Complete athlete training',
      'Versatility is your weapon'
    ]
  };

  const typeInsights = insights[type] || insights.hybrid;
  return typeInsights[Math.floor(Math.random() * typeInsights.length)];
}

// Get week dates starting from Monday
function getWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

// Workout type detection
function getWorkoutType(session: PlanDay | WorkoutSession | null): 'cardio' | 'strength' | 'hybrid' | 'rest' {
  if (!session) return 'rest';

  const blocks = 'blocks' in session ? session.blocks : [];
  if (!blocks || blocks.length === 0) return 'rest';

  const exercises = blocks.flatMap(b => b.exercises || []);
  if (exercises.length === 0) return 'rest';

  const focus = ('focus' in session ? session.focus : ('session_name' in session ? session.session_name : '')) || '';
  const focusLower = focus.toLowerCase();

  if (focusLower.includes('cardio') || focusLower.includes('conditioning') || focusLower.includes('hiit') || focusLower.includes('run')) {
    return 'cardio';
  }
  if (focusLower.includes('strength') || focusLower.includes('power') || focusLower.includes('upper') || focusLower.includes('lower')) {
    return 'strength';
  }

  return 'hybrid';
}

// Format workout focus name
function formatFocusName(focus: string): string {
  return focus.replace(/^(AM|PM)\s+/i, '').trim();
}

// Get muscle groups from workout
function getMuscleGroups(exercises: { name: string }[]): string[] {
  const muscleMap: Record<string, string[]> = {
    chest: ['bench', 'push-up', 'fly', 'press', 'dip'],
    back: ['row', 'pull', 'lat', 'deadlift', 'chin'],
    shoulders: ['shoulder', 'delt', 'overhead', 'lateral'],
    legs: ['squat', 'lunge', 'leg', 'hamstring', 'quad', 'calf'],
    arms: ['curl', 'tricep', 'bicep', 'extension'],
    core: ['plank', 'crunch', 'ab', 'core', 'twist']
  };

  const found = new Set<string>();
  exercises.forEach(ex => {
    const nameLower = ex.name.toLowerCase();
    Object.entries(muscleMap).forEach(([muscle, keywords]) => {
      if (keywords.some(kw => nameLower.includes(kw))) {
        found.add(muscle);
      }
    });
  });

  return Array.from(found).slice(0, 3);
}

export default function ZenHomePage({ plan, onStartSession, userProfile }: ZenHomePageProps) {
  const haptic = useHaptic();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const now = new Date();
  const currentHour = now.getHours();
  const isAfternoon = currentHour >= 14;

  // Get greeting
  const { greeting, subtext } = useMemo(() =>
    getGreeting(currentHour, userProfile?.name),
    [currentHour, userProfile?.name]
  );

  // Get today's index (0=Mon, 6=Sun)
  const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);
  const [sessionView, setSessionView] = useState<'am' | 'pm'>(isAfternoon ? 'pm' : 'am');

  // Week dates for the calendar
  const weekDates = useMemo(() => getWeekDates(), []);
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Swipe handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const weeklyPlan = plan?.weeklyPlan || [];
  const activeDayPlan = weeklyPlan[selectedDayIndex];

  // Calculate week stats
  const weekStats = useMemo(() => {
    let completed = 0;
    let total = 0;

    weeklyPlan.forEach((day, i) => {
      const blocks = day?.blocks || [];
      const sessions = (day as any)?.sessions;
      const hasExercises = blocks.some(b => b.exercises?.length > 0) ||
                          sessions?.some((s: any) => s.blocks?.some((b: any) => b.exercises?.length > 0));

      if (hasExercises) {
        total++;
        if (i < todayIndex) completed++;
      }
    });

    return { completed, total, remaining: total - completed };
  }, [weeklyPlan, todayIndex]);

  // Detect 2x daily sessions
  const { amSession, pmSession, hasTwoADaySessions } = useMemo(() => {
    if (!activeDayPlan) return { amSession: null, pmSession: null, hasTwoADaySessions: false };

    const sessions = (activeDayPlan as any).sessions as WorkoutSession[] | undefined;
    if (sessions && sessions.length >= 2) {
      const am = sessions.find(s => s.time_of_day === 'morning') || sessions[0];
      const pm = sessions.find(s => s.time_of_day === 'evening') || sessions[1];
      return { amSession: am, pmSession: pm, hasTwoADaySessions: true };
    }
    return { amSession: null, pmSession: null, hasTwoADaySessions: false };
  }, [activeDayPlan]);

  // Current session
  const currentSession = useMemo(() => {
    if (hasTwoADaySessions) {
      return sessionView === 'am' ? amSession : pmSession;
    }
    return activeDayPlan;
  }, [hasTwoADaySessions, sessionView, amSession, pmSession, activeDayPlan]);

  // Check if workout exists
  const hasWorkout = useMemo(() => {
    if (!currentSession) return false;
    const blocks = 'blocks' in currentSession ? currentSession.blocks : [];
    return blocks && blocks.length > 0 && blocks.some(b => b.exercises && b.exercises.length > 0);
  }, [currentSession]);

  // Workout info
  const workoutInfo = useMemo(() => {
    if (!currentSession || !hasWorkout) return null;

    const blocks = 'blocks' in currentSession ? currentSession.blocks : [];
    const exercises = blocks?.flatMap(b => b.exercises || []) || [];
    const focus = 'focus' in currentSession ? currentSession.focus : ('session_name' in currentSession ? currentSession.session_name : 'Workout');
    const duration = 'estimated_duration' in currentSession ? currentSession.estimated_duration : null;
    const type = getWorkoutType(currentSession as PlanDay);
    const muscleGroups = getMuscleGroups(exercises.map(ex => ({ name: ex.exercise_name })));

    return {
      focus: formatFocusName(focus || 'Workout'),
      exerciseCount: exercises.length,
      exercises: exercises.map(ex => ({
        name: ex.exercise_name,
        sets: ex.metrics_template?.target_sets || 3,
        reps: ex.metrics_template?.target_reps || '8-12',
      })),
      duration: duration || Math.round(exercises.length * 4),
      type,
      muscleGroups,
      insight: getWorkoutInsight(type, focus || '', exercises.length)
    };
  }, [currentSession, hasWorkout]);

  // Day status for calendar
  const getDayStatus = useCallback((dayIndex: number): 'completed' | 'today' | 'upcoming' | 'rest' => {
    const dayPlan = weeklyPlan[dayIndex];
    if (!dayPlan) return 'rest';

    const blocks = dayPlan.blocks || [];
    const sessions = (dayPlan as any).sessions;
    const hasExercises = blocks.some(b => b.exercises?.length > 0) ||
                         sessions?.some((s: any) => s.blocks?.some((b: any) => b.exercises?.length > 0));

    if (!hasExercises) return 'rest';
    if (dayIndex < todayIndex) return 'completed';
    if (dayIndex === todayIndex) return 'today';
    return 'upcoming';
  }, [weeklyPlan, todayIndex]);

  // Swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(deltaX) < 50 && Math.abs(deltaY) < 50) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 50 && selectedDayIndex > 0) {
        setSelectedDayIndex(prev => prev - 1);
        haptic.light();
      } else if (deltaX < -50 && selectedDayIndex < 6) {
        setSelectedDayIndex(prev => prev + 1);
        haptic.light();
      }
    } else if (hasTwoADaySessions) {
      if (deltaY > 50 && sessionView === 'am') {
        setSessionView('pm');
        haptic.light();
      } else if (deltaY < -50 && sessionView === 'pm') {
        setSessionView('am');
        haptic.light();
      }
    }
  }, [selectedDayIndex, sessionView, hasTwoADaySessions, haptic]);

  // Start workout
  const handleStart = useCallback(() => {
    if (!currentSession) return;
    haptic.medium();

    if (hasTwoADaySessions && currentSession) {
      onStartSession({
        ...currentSession,
        day_of_week: activeDayPlan?.day_of_week || todayIndex + 1
      } as any);
    } else {
      onStartSession(currentSession as SessionType);
    }
  }, [currentSession, hasTwoADaySessions, activeDayPlan, todayIndex, onStartSession, haptic]);

  const isToday = selectedDayIndex === todayIndex;
  const isPast = selectedDayIndex < todayIndex;

  return (
    <div
      className="min-h-screen w-full bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <header className="pt-[calc(env(safe-area-inset-top)+16px)] px-5 pb-4 flex-shrink-0">
        {/* Greeting + Week Progress */}
        <div
          className={cn(
            "flex items-start justify-between mb-6 transition-all duration-500",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          )}
        >
          <div>
            <h1
              className="text-white text-[28px] font-black leading-tight"
              style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
            >
              {greeting}
            </h1>
            <p className="text-white/40 text-sm mt-0.5">{subtext}</p>
          </div>

          {/* REBLD Mini Logo */}
          <div className="flex flex-col items-end">
            <span
              className="text-[20px] font-black tracking-tight"
              style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
            >
              <span className="text-white/60">RE</span>
              <span className="text-[#EF4444]">BLD</span>
            </span>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div
          className={cn(
            "flex gap-2 mb-5 transition-all duration-500 delay-100",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          {/* Week Progress */}
          <div className="flex-1 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <TargetIcon className="w-3.5 h-3.5 text-[#EF4444]" />
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">This Week</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-white text-xl font-black">{weekStats.completed}</span>
              <span className="text-white/30 text-sm">/</span>
              <span className="text-white/50 text-sm font-bold">{weekStats.total}</span>
            </div>
            {/* Mini progress bar */}
            <div className="mt-2 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#EF4444] rounded-full transition-all duration-500"
                style={{ width: `${weekStats.total > 0 ? (weekStats.completed / weekStats.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Streak */}
          <div className="w-[90px] p-3 rounded-xl bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20">
            <div className="flex items-center gap-1.5 mb-1">
              <FlameIcon className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Streak</span>
            </div>
            <span className="text-orange-400 text-xl font-black">
              {weekStats.completed}
            </span>
          </div>
        </div>

        {/* Compact Week Calendar */}
        <div
          className={cn(
            "transition-all duration-500 delay-150",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <div className="flex justify-between gap-1 px-1">
            {weekDates.map((date, i) => {
              const status = getDayStatus(i);
              const isSelected = i === selectedDayIndex;
              const isTodayDay = i === todayIndex;

              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedDayIndex(i);
                    haptic.light();
                  }}
                  className={cn(
                    "flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all duration-200",
                    "min-h-[56px]",
                    isSelected
                      ? "bg-[#EF4444]"
                      : isTodayDay
                        ? "bg-white/[0.06]"
                        : "bg-transparent",
                    !isSelected && "active:scale-90"
                  )}
                >
                  {/* Day letter */}
                  <span className={cn(
                    "text-[9px] font-bold uppercase mb-0.5",
                    isSelected ? "text-white/80" : "text-white/30"
                  )}>
                    {dayNames[i]}
                  </span>

                  {/* Date number */}
                  <span className={cn(
                    "text-base font-black tabular-nums",
                    isSelected ? "text-white" : isTodayDay ? "text-white" : "text-white/50"
                  )}>
                    {date.getDate()}
                  </span>

                  {/* Status dot */}
                  <div className="h-2 mt-0.5 flex items-center">
                    {status === 'completed' && !isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    )}
                    {status === 'today' && !isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                    )}
                    {status === 'upcoming' && !isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-5 pb-32 overflow-y-auto">
        {/* 2x Daily Toggle */}
        {hasTwoADaySessions && (
          <div
            className={cn(
              "flex gap-2 mb-5 transition-all duration-500 delay-200",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <button
              onClick={() => { setSessionView('am'); haptic.light(); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                sessionView === 'am'
                  ? "bg-[#EF4444] text-white"
                  : "bg-white/[0.04] text-white/40 border border-white/10 active:scale-95"
              )}
            >
              AM
            </button>
            <button
              onClick={() => { setSessionView('pm'); haptic.light(); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                sessionView === 'pm'
                  ? "bg-[#EF4444] text-white"
                  : "bg-white/[0.04] text-white/40 border border-white/10 active:scale-95"
              )}
            >
              PM
            </button>
          </div>
        )}

        {hasWorkout && workoutInfo ? (
          <div className="space-y-4">
            {/* Workout Card - Hero */}
            <div
              className={cn(
                "relative transition-all duration-500 delay-200",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              {/* Past day badge */}
              {isPast && (
                <div className="absolute -top-2 left-4 z-10 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40">
                  <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    Catch Up
                  </span>
                </div>
              )}

              <div className={cn(
                "rounded-2xl overflow-hidden",
                "bg-gradient-to-br from-white/[0.04] to-transparent",
                "border border-white/[0.08]"
              )}>
                {/* Main content */}
                <div className="p-5">
                  {/* Insight - AI speaking */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-[#EF4444]/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                    </div>
                    <span className="text-white/50 text-xs font-medium italic">
                      {workoutInfo.insight}
                    </span>
                  </div>

                  {/* Workout name */}
                  <h2
                    className="text-white text-[32px] font-black leading-[1.05] tracking-tight mb-4"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    {workoutInfo.focus}
                  </h2>

                  {/* Muscle groups */}
                  {workoutInfo.muscleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {workoutInfo.muscleGroups.map((muscle, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-[#EF4444]/10 text-[#EF4444] text-xs font-bold uppercase tracking-wide"
                        >
                          {muscle}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-white text-2xl font-black">{workoutInfo.exerciseCount}</span>
                      <span className="text-white/40 text-sm ml-1.5">exercises</span>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div>
                      <span className="text-white text-2xl font-black">~{workoutInfo.duration}</span>
                      <span className="text-white/40 text-sm ml-1.5">min</span>
                    </div>
                  </div>
                </div>

                {/* Exercise preview strip */}
                <div className="border-t border-white/[0.06] px-5 py-4 bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      {workoutInfo.exercises.slice(0, 3).map((ex, i) => (
                        <span
                          key={i}
                          className="text-white/50 text-xs font-medium truncate"
                        >
                          {ex.name}
                          {i < 2 && <span className="text-white/20 ml-3">·</span>}
                        </span>
                      ))}
                    </div>
                    {workoutInfo.exercises.length > 3 && (
                      <span className="text-white/30 text-xs font-bold ml-2">
                        +{workoutInfo.exercises.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Exercise List - Compact */}
            <div
              className={cn(
                "transition-all duration-500 delay-300",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="space-y-1.5">
                {workoutInfo.exercises.slice(0, 5).map((exercise, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl",
                      "bg-white/[0.02] border border-white/[0.05]",
                      "active:scale-[0.98] active:bg-white/[0.04] transition-all duration-200"
                    )}
                  >
                    {/* Number */}
                    <div className="w-8 h-8 rounded-lg bg-[#EF4444]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#EF4444] text-xs font-black">{i + 1}</span>
                    </div>

                    {/* Exercise info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-[14px] truncate">
                        {exercise.name}
                      </p>
                    </div>

                    {/* Sets x Reps */}
                    <span className="text-white/30 text-xs font-medium shrink-0">
                      {exercise.sets}×{exercise.reps}
                    </span>
                  </div>
                ))}
              </div>

              {workoutInfo.exercises.length > 5 && (
                <button className="w-full text-center text-white/30 text-xs py-3 font-medium">
                  +{workoutInfo.exercises.length - 5} more exercises
                </button>
              )}
            </div>

            {/* Start Button */}
            <div
              className={cn(
                "pt-2 transition-all duration-500 delay-400",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <button
                onClick={handleStart}
                className={cn(
                  "w-full py-5 rounded-2xl relative overflow-hidden",
                  "bg-[#EF4444]",
                  "font-bold text-[15px] uppercase tracking-wider text-white",
                  "shadow-[0_8px_32px_rgba(239,68,68,0.4)]",
                  "active:scale-[0.97] active:shadow-[0_4px_16px_rgba(239,68,68,0.3)] transition-all duration-200"
                )}
              >
                <span className="relative z-10">
                  {isPast ? 'Start Catch-Up' : 'Begin Workout'}
                </span>
              </button>

              {/* Encouragement text */}
              {isToday && weekStats.remaining > 0 && (
                <p className="text-white/25 text-[11px] text-center mt-3 font-medium">
                  {weekStats.remaining === 1
                    ? 'Last workout of the week — finish strong!'
                    : `${weekStats.remaining} more sessions this week`}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Rest Day */
          <div
            className={cn(
              "flex flex-col items-center justify-center min-h-[50vh] transition-all duration-700",
              mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
            )}
          >
            {/* Rest icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-green-500/10 blur-3xl rounded-full" />
              <div className="relative w-24 h-24 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
                </svg>
              </div>
            </div>

            <h2
              className="text-white text-2xl font-black mb-2"
              style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
            >
              Rest Day
            </h2>
            <p className="text-white/40 text-sm text-center max-w-[240px] leading-relaxed mb-8">
              Recovery is where growth happens.
              Your muscles rebuild stronger.
            </p>

            {/* Week progress reminder */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <p className="text-white/50 text-sm">
                <span className="text-white font-bold">{weekStats.completed}</span>
                <span className="text-white/30"> / </span>
                <span>{weekStats.total}</span>
                <span className="text-white/30"> workouts done this week</span>
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
