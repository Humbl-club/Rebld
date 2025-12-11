import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { WorkoutPlan, PlanDay, DailyRoutine, UserProfile, WorkoutSession } from '../types';
import { cn } from '../lib/utils';
import { useHaptic } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   ZEN HOME PAGE - Premium Athlete Dashboard

   Design Philosophy:
   - Bold, confident branding with animated logo
   - Premium cards with depth and subtle animations
   - Staggered entrance animations for polish
   - Functional calendar with strong visual hierarchy
   ═══════════════════════════════════════════════════════════════ */

type SessionType = PlanDay | DailyRoutine | WorkoutSession;

interface ZenHomePageProps {
  plan: WorkoutPlan;
  onStartSession: (session: SessionType) => void;
  onOpenChat: () => void;
  userProfile?: UserProfile | null;
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

// Format workout focus name (remove "AM/PM" prefix if present)
function formatFocusName(focus: string): string {
  return focus.replace(/^(AM|PM)\s+/i, '').trim();
}

export default function ZenHomePage({ plan, onStartSession, userProfile }: ZenHomePageProps) {
  const haptic = useHaptic();
  const [mounted, setMounted] = useState(false);

  // Trigger mount animation
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const now = new Date();
  const currentHour = now.getHours();
  const isAfternoon = currentHour >= 14;

  // Get today's index (0=Mon, 6=Sun)
  const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);
  const [sessionView, setSessionView] = useState<'am' | 'pm'>(isAfternoon ? 'pm' : 'am');

  // Week dates for the calendar
  const weekDates = useMemo(() => getWeekDates(), []);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Swipe handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const weeklyPlan = plan?.weeklyPlan || [];
  const activeDayPlan = weeklyPlan[selectedDayIndex];

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

    return {
      focus: formatFocusName(focus || 'Workout'),
      exerciseCount: exercises.length,
      exercises: exercises.map(ex => ({
        name: ex.exercise_name,
        sets: ex.metrics_template?.target_sets || 3,
        reps: ex.metrics_template?.target_reps || '8-12',
      })),
      duration: duration || Math.round(exercises.length * 4),
      type: getWorkoutType(currentSession as PlanDay)
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
  const selectedDate = weekDates[selectedDayIndex];

  return (
    <div
      className="min-h-screen w-full bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with Premium Logo */}
      <header className="pt-[calc(env(safe-area-inset-top)+20px)] px-6 pb-6 flex-shrink-0">
        {/* REBLD Logo - MASSIVE, with glow */}
        <div
          className={cn(
            "flex items-center justify-center mb-10 transition-all duration-700",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          )}
        >
          <div className="relative">
            {/* Glow effect behind BLD */}
            <div
              className="absolute inset-0 blur-2xl opacity-40"
              style={{
                background: 'radial-gradient(circle at 60% 50%, #EF4444 0%, transparent 60%)',
                transform: 'scale(1.5)',
              }}
            />
            <h1
              className="relative text-[56px] font-black tracking-[0.02em]"
              style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
            >
              <span className="text-white">RE</span>
              <span
                className="text-[#EF4444]"
                style={{ textShadow: '0 0 30px rgba(239, 68, 68, 0.5)' }}
              >
                BLD
              </span>
            </h1>
          </div>
        </div>

        {/* Week Calendar - Premium styling */}
        <div
          className={cn(
            "relative transition-all duration-500 delay-100",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          {/* Calendar container with border */}
          <div className="bg-white/[0.02] rounded-2xl p-2 border border-white/[0.06]">
            <div className="flex justify-between gap-1">
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
                      "flex-1 flex flex-col items-center py-3 rounded-xl transition-all duration-200",
                      "min-h-[76px]",
                      isSelected
                        ? "bg-[#EF4444] shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                        : isTodayDay
                          ? "bg-white/[0.08] border border-white/10"
                          : "bg-transparent",
                      !isSelected && "active:scale-95"
                    )}
                  >
                    {/* Day name */}
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider mb-1",
                      isSelected ? "text-white" : isTodayDay ? "text-white/70" : "text-white/40"
                    )}>
                      {dayNames[i]}
                    </span>

                    {/* Date number */}
                    <span className={cn(
                      "text-xl font-black tabular-nums",
                      isSelected ? "text-white" : isTodayDay ? "text-white" : "text-white/60"
                    )}>
                      {date.getDate()}
                    </span>

                    {/* Status indicator */}
                    <div className="h-3 mt-1 flex items-center justify-center">
                      {status === 'completed' && !isSelected && (
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      )}
                      {status === 'upcoming' && !isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                      )}
                      {status === 'today' && !isSelected && (
                        <div className="w-2 h-2 rounded-full bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
                      )}
                      {status === 'rest' && !isSelected && (
                        <div className="w-1.5 h-0.5 rounded-full bg-white/10" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 pb-32 overflow-y-auto">
        {/* 2x Daily Toggle */}
        {hasTwoADaySessions && (
          <div
            className={cn(
              "flex justify-center gap-3 mb-6 transition-all duration-500 delay-200",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <button
              onClick={() => { setSessionView('am'); haptic.light(); }}
              className={cn(
                "px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                sessionView === 'am'
                  ? "bg-[#EF4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                  : "bg-white/[0.04] text-white/50 border border-white/10 active:scale-95"
              )}
            >
              Morning
            </button>
            <button
              onClick={() => { setSessionView('pm'); haptic.light(); }}
              className={cn(
                "px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                sessionView === 'pm'
                  ? "bg-[#EF4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                  : "bg-white/[0.04] text-white/50 border border-white/10 active:scale-95"
              )}
            >
              Evening
            </button>
          </div>
        )}

        {hasWorkout && workoutInfo ? (
          <div className="space-y-5">
            {/* Workout Header Card */}
            <div
              className={cn(
                "relative transition-all duration-500 delay-200",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              {/* Past day badge */}
              {isPast && (
                <div className="absolute -top-2 left-4 z-10 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40">
                  <span className="text-amber-400 text-[11px] font-bold uppercase tracking-wider">
                    Catch Up · {dayNames[selectedDayIndex]}
                  </span>
                </div>
              )}

              {/* Main card with gradient border effect */}
              <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-white/20 via-white/5 to-transparent">
                <div className={cn(
                  "rounded-2xl p-6 bg-black",
                  isPast ? "bg-gradient-to-br from-amber-500/5 to-transparent" : "bg-gradient-to-br from-[#EF4444]/10 via-black to-black"
                )}>
                  {/* Session time label */}
                  {hasTwoADaySessions && (
                    <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">
                      {sessionView === 'am' ? 'Morning Session' : 'Evening Session'}
                    </p>
                  )}

                  {/* Workout name - HERO */}
                  <h2
                    className="text-white text-[36px] font-black leading-[1.05] tracking-tight mb-4"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    {workoutInfo.focus}
                  </h2>

                  {/* Stats row - more pronounced */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05]">
                      <span className="text-[#EF4444] font-black text-lg">{workoutInfo.exerciseCount}</span>
                      <span className="text-white/50 text-sm">exercises</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05]">
                      <span className="text-white font-black text-lg">~{workoutInfo.duration}</span>
                      <span className="text-white/50 text-sm">min</span>
                    </div>
                    <span className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide",
                      workoutInfo.type === 'cardio' && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                      workoutInfo.type === 'strength' && "bg-green-500/20 text-green-400 border border-green-500/30",
                      workoutInfo.type === 'hybrid' && "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    )}>
                      {workoutInfo.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Exercise List - Staggered animation */}
            <div>
              <h3
                className={cn(
                  "text-white/50 text-xs font-bold uppercase tracking-widest px-1 mb-4 transition-all duration-500 delay-300",
                  mounted ? "opacity-100" : "opacity-0"
                )}
              >
                Today's Exercises
              </h3>

              <div className="space-y-2">
                {workoutInfo.exercises.slice(0, 6).map((exercise, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl",
                      "bg-white/[0.03] border border-white/[0.08]",
                      "transition-all duration-300 active:scale-[0.98] active:bg-white/[0.06]",
                      mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                    )}
                    style={{ transitionDelay: mounted ? `${300 + i * 50}ms` : '0ms' }}
                  >
                    {/* Number badge with glow */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#EF4444] blur-lg opacity-30" />
                      <div className="relative w-10 h-10 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/30 flex items-center justify-center">
                        <span className="text-[#EF4444] text-sm font-black">{i + 1}</span>
                      </div>
                    </div>

                    {/* Exercise info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-[15px] truncate">
                        {exercise.name}
                      </p>
                      <p className="text-white/40 text-xs mt-0.5 font-medium">
                        {exercise.sets} sets × {exercise.reps} reps
                      </p>
                    </div>

                    {/* Chevron */}
                    <svg className="w-5 h-5 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                ))}
              </div>

              {workoutInfo.exercises.length > 6 && (
                <p className="text-white/30 text-xs text-center py-3 font-medium">
                  +{workoutInfo.exercises.length - 6} more exercises
                </p>
              )}
            </div>

            {/* Start Button - Premium, no animation */}
            <div
              className={cn(
                "pt-4 transition-all duration-500 delay-500",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <button
                onClick={handleStart}
                className={cn(
                  "w-full py-5 rounded-2xl",
                  "bg-[#EF4444] text-white",
                  "font-bold text-base uppercase tracking-wider",
                  "shadow-[0_4px_20px_rgba(239,68,68,0.4)]",
                  "transition-all duration-200 active:scale-[0.97] active:shadow-[0_2px_10px_rgba(239,68,68,0.3)]"
                )}
              >
                {isPast ? 'Start Catch-Up' : 'Start Workout'}
              </button>
            </div>

            {/* Other session hint */}
            {hasTwoADaySessions && (
              <button
                onClick={() => {
                  setSessionView(sessionView === 'am' ? 'pm' : 'am');
                  haptic.light();
                }}
                className="w-full text-center text-white/40 text-sm py-3 active:text-white/60 font-medium"
              >
                {sessionView === 'am' ? (
                  <>Also today: {pmSession?.session_name || 'Evening'} →</>
                ) : (
                  <>← {amSession?.session_name || 'Morning'}</>
                )}
              </button>
            )}
          </div>
        ) : (
          /* Rest Day */
          <div
            className={cn(
              "flex flex-col items-center justify-center min-h-[50vh] transition-all duration-700",
              mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
            )}
          >
            {/* Rest icon with glow */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full" />
              <div className="relative w-28 h-28 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center">
                <svg className="w-12 h-12 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
                </svg>
              </div>
            </div>

            <h2
              className="text-white text-3xl font-black mb-3"
              style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
            >
              Rest Day
            </h2>
            <p className="text-white/40 text-sm text-center max-w-[260px] leading-relaxed">
              Recovery is where growth happens.
              Your muscles rebuild stronger during rest.
            </p>

            {/* Quick recovery tip */}
            <div className="mt-8 p-5 rounded-2xl bg-white/[0.03] border border-white/10 max-w-[300px]">
              <p className="text-white/60 text-sm text-center leading-relaxed">
                Try stretching, walking, or foam rolling to enhance recovery
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Swipe hint */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+90px)] left-0 right-0 text-center pointer-events-none">
        <p className="text-white/15 text-[10px] uppercase tracking-[0.2em] font-medium">
          {hasTwoADaySessions ? 'Swipe ↕ sessions · ↔ days' : 'Swipe to change days'}
        </p>
      </div>

    </div>
  );
}
