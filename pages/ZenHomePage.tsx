import React, { useState, useMemo, useCallback, useRef } from 'react';
import { WorkoutPlan, PlanDay, DailyRoutine, UserProfile, WorkoutSession } from '../types';
import { cn } from '../lib/utils';
import { useHaptic } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   ZEN HOME PAGE - Premium Athlete Dashboard

   Design Philosophy:
   - Bold, confident branding
   - Functional calendar that shows real dates and allows past access
   - Premium typography with clear hierarchy
   - Exercise presentation that's scannable and informative
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
    if (dayIndex < todayIndex) return 'completed'; // Past days with workouts
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
      <header className="pt-[calc(env(safe-area-inset-top)+16px)] px-6 pb-6 flex-shrink-0">
        {/* REBLD Logo - Bold, prominent */}
        <div className="flex items-center justify-center mb-8">
          <h1
            className="text-[42px] font-black tracking-[-0.02em]"
            style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
          >
            <span className="text-white">RE</span>
            <span className="text-[#EF4444]">BLD</span>
          </h1>
        </div>

        {/* Week Calendar - Premium timeline */}
        <div className="relative">
          {/* Day cards */}
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
                    "flex-1 flex flex-col items-center py-3 rounded-xl transition-all",
                    "min-h-[72px]",
                    isSelected
                      ? "bg-[#EF4444]"
                      : isTodayDay
                        ? "bg-white/10"
                        : "bg-transparent",
                    !isSelected && "active:bg-white/10"
                  )}
                >
                  {/* Day name */}
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider mb-1",
                    isSelected ? "text-white/80" : "text-white/40"
                  )}>
                    {dayNames[i]}
                  </span>

                  {/* Date number */}
                  <span className={cn(
                    "text-lg font-bold tabular-nums",
                    isSelected ? "text-white" : isTodayDay ? "text-white" : "text-white/70"
                  )}>
                    {date.getDate()}
                  </span>

                  {/* Status indicator */}
                  <div className="h-2 mt-1">
                    {status === 'completed' && !isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    )}
                    {status === 'upcoming' && !isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    )}
                    {status === 'today' && !isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                    )}
                    {status === 'rest' && !isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 pb-32 overflow-y-auto">
        {/* 2x Daily Toggle */}
        {hasTwoADaySessions && (
          <div className="flex justify-center gap-3 mb-6">
            <button
              onClick={() => { setSessionView('am'); haptic.light(); }}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                sessionView === 'am'
                  ? "bg-[#EF4444] text-white"
                  : "bg-white/5 text-white/50 border border-white/10"
              )}
            >
              Morning
            </button>
            <button
              onClick={() => { setSessionView('pm'); haptic.light(); }}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                sessionView === 'pm'
                  ? "bg-[#EF4444] text-white"
                  : "bg-white/5 text-white/50 border border-white/10"
              )}
            >
              Evening
            </button>
          </div>
        )}

        {hasWorkout && workoutInfo ? (
          <div className="space-y-6">
            {/* Workout Header Card */}
            <div className="relative">
              {/* Past day badge */}
              {isPast && (
                <div className="absolute -top-2 left-4 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                  <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    {dayNames[selectedDayIndex]} · {selectedDate.getDate()}
                  </span>
                </div>
              )}

              {/* Main card */}
              <div className={cn(
                "rounded-2xl p-6 border",
                isPast
                  ? "bg-white/[0.02] border-white/10"
                  : "bg-gradient-to-br from-white/[0.06] to-white/[0.02] border-white/10"
              )}>
                {/* Session time label */}
                {hasTwoADaySessions && (
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">
                    {sessionView === 'am' ? 'Morning Session' : 'Evening Session'}
                  </p>
                )}

                {/* Workout name - BIG and bold */}
                <h2 className="text-white text-[32px] font-black leading-[1.1] tracking-tight mb-3">
                  {workoutInfo.focus}
                </h2>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#EF4444] font-bold">{workoutInfo.exerciseCount}</span>
                    <span className="text-white/50">exercises</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/70 font-bold">~{workoutInfo.duration}</span>
                    <span className="text-white/50">min</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    workoutInfo.type === 'cardio' && "bg-blue-500/20 text-blue-400",
                    workoutInfo.type === 'strength' && "bg-green-500/20 text-green-400",
                    workoutInfo.type === 'hybrid' && "bg-purple-500/20 text-purple-400"
                  )}>
                    {workoutInfo.type}
                  </span>
                </div>
              </div>
            </div>

            {/* Exercise List */}
            <div className="space-y-2">
              <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest px-1 mb-3">
                Exercises
              </h3>

              {workoutInfo.exercises.slice(0, 6).map((exercise, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl",
                    "bg-white/[0.03] border border-white/[0.06]",
                    "transition-colors"
                  )}
                >
                  {/* Number badge */}
                  <div className="w-8 h-8 rounded-lg bg-[#EF4444]/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#EF4444] text-sm font-bold">{i + 1}</span>
                  </div>

                  {/* Exercise info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-[15px] truncate">
                      {exercise.name}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {exercise.sets} sets × {exercise.reps} reps
                    </p>
                  </div>
                </div>
              ))}

              {workoutInfo.exercises.length > 6 && (
                <p className="text-white/30 text-xs text-center py-2">
                  +{workoutInfo.exercises.length - 6} more exercises
                </p>
              )}
            </div>

            {/* Start Button - Always enabled */}
            <div className="pt-4">
              <button
                onClick={handleStart}
                className={cn(
                  "w-full py-5 rounded-2xl",
                  "font-bold text-lg uppercase tracking-wider",
                  "transition-all active:scale-[0.98]",
                  "bg-[#EF4444] text-white",
                  "shadow-[0_0_40px_rgba(239,68,68,0.3)]"
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
                className="w-full text-center text-white/40 text-sm py-3 active:text-white/60"
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
          /* Rest Day */}
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            {/* Rest icon */}
            <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
              </svg>
            </div>

            <h2 className="text-white text-2xl font-black mb-2">Rest Day</h2>
            <p className="text-white/40 text-sm text-center max-w-[260px] leading-relaxed">
              Recovery is where growth happens.
              Your muscles rebuild stronger during rest.
            </p>

            {/* Quick recovery tip */}
            <div className="mt-8 p-4 rounded-xl bg-white/[0.03] border border-white/10 max-w-[280px]">
              <p className="text-white/60 text-sm text-center">
                💡 Try stretching, walking, or foam rolling
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Swipe hint - only show when relevant */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+90px)] left-0 right-0 text-center pointer-events-none">
        <p className="text-white/20 text-[10px] uppercase tracking-widest">
          {hasTwoADaySessions ? 'Swipe ↕ sessions · ↔ days' : 'Swipe to change days'}
        </p>
      </div>
    </div>
  );
}
