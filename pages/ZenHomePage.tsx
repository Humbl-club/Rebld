import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { WorkoutPlan, PlanDay, DailyRoutine, UserProfile, WorkoutSession } from '../types';
import { cn } from '../lib/utils';
import { useHaptic } from '../hooks/useAnimations';
import { usePageBackground, BackgroundOverlay } from '../hooks/usePageBackground';

/* ═══════════════════════════════════════════════════════════════
   ZEN HOME PAGE - Clean, Sophisticated Design

   Design Philosophy:
   - Clean typography, easy on the eyes
   - Warm coral accent, not harsh red
   - Proper visual hierarchy
   - Breathable, spacious layout
   ═══════════════════════════════════════════════════════════════ */

type SessionType = PlanDay | DailyRoutine | WorkoutSession;

interface ZenHomePageProps {
  plan: WorkoutPlan;
  onStartSession: (session: SessionType) => void;
  onOpenChat: () => void;
  userProfile?: UserProfile | null;
}

// Accent color - rich red, distinct but not harsh
const ACCENT = '#E54D42';
const ACCENT_SOFT = 'rgba(229, 77, 66, 0.15)';
const ACCENT_GLOW = 'rgba(229, 77, 66, 0.3)';

// Simple greeting
function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good evening';
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

// Format workout focus name
function formatFocusName(focus: string): string {
  return focus.replace(/^(AM|PM)\s+/i, '').trim();
}

// Check if exercise is cardio-based (shows duration instead of sets/reps)
function isCardioExercise(name: string): boolean {
  const cardioKeywords = [
    'elliptical', 'treadmill', 'bike', 'cycling', 'running', 'walking',
    'rowing', 'stair', 'cardio', 'jogging', 'sprint', 'hiit', 'aerobic',
    'stepper', 'climber', 'jump rope', 'skipping'
  ];
  const lowerName = name.toLowerCase();
  return cardioKeywords.some(keyword => lowerName.includes(keyword));
}

export default function ZenHomePage({ plan, onStartSession, userProfile }: ZenHomePageProps) {
  const haptic = useHaptic();
  const [mounted, setMounted] = useState(false);
  const { backgroundStyles, hasBackground } = usePageBackground('home');

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const now = new Date();
  const currentHour = now.getHours();
  const isAfternoon = currentHour >= 14;
  const greeting = getGreeting(currentHour);

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

    return {
      focus: formatFocusName(focus || 'Workout'),
      exerciseCount: exercises.length,
      exercises: exercises.map(ex => {
        const isCardio = isCardioExercise(ex.exercise_name);
        const targetDuration = ex.metrics_template?.target_duration || ex.metrics_template?.duration;

        return {
          name: ex.exercise_name,
          sets: ex.metrics_template?.target_sets || 3,
          reps: ex.metrics_template?.target_reps || '8-12',
          isCardio,
          // For cardio: show duration in minutes (default 20 min if not specified)
          cardioMinutes: isCardio ? (targetDuration || 20) : null,
        };
      }),
      duration: duration || Math.round(exercises.length * 4),
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
      className="min-h-screen w-full bg-[#0A0A0A] flex flex-col relative"
      style={backgroundStyles}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background overlay for readability */}
      {hasBackground && <BackgroundOverlay opacity={0.7} />}

      {/* Header */}
      <header className="pt-[calc(env(safe-area-inset-top)+20px)] px-6 pb-5 flex-shrink-0 relative z-10">
        {/* Logo + Greeting */}
        <div
          className={cn(
            "flex items-center justify-between mb-8 transition-all duration-500",
            mounted ? "opacity-100" : "opacity-0"
          )}
        >
          {/* REBLD Logo - Only place we use display font */}
          <h1
            className="text-[28px] font-bold tracking-tight"
            style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
          >
            <span className="text-white">RE</span>
            <span style={{ color: ACCENT }}>BLD</span>
          </h1>

          {/* Week Progress Pill */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: ACCENT_SOFT }}
          >
            <span className="text-white/70 text-xs font-medium">Week</span>
            <span className="text-white text-sm font-semibold">{weekStats.completed}/{weekStats.total}</span>
          </div>
        </div>

        {/* Greeting */}
        <div
          className={cn(
            "mb-6 transition-all duration-500 delay-100",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
        >
          <p className="text-white/50 text-sm font-medium mb-1">{greeting}</p>
          <h2 className="text-white text-2xl font-semibold tracking-tight">
            {isToday ? "Today's Workout" : isPast ? "Missed Workout" : dayNames[selectedDayIndex] + "'s Workout"}
          </h2>
        </div>

        {/* Week Calendar - Contained Card Design */}
        <div
          className={cn(
            "transition-all duration-500 delay-150",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
        >
          {/* Calendar Card Container */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            {/* Week Days Row */}
            <div className="flex justify-between items-center">
              {weekDates.map((date, i) => {
                const status = getDayStatus(i);
                const isSelected = i === selectedDayIndex;
                const isTodayDay = i === todayIndex;
                const hasWorkoutDay = status !== 'rest';
                const isCompleted = status === 'completed';

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDayIndex(i);
                      haptic.light();
                    }}
                    className={cn(
                      "flex flex-col items-center transition-all duration-200",
                      "min-w-[40px] py-2",
                      !isSelected && "active:scale-95"
                    )}
                  >
                    {/* Day letter */}
                    <span className={cn(
                      "text-[11px] font-medium mb-2",
                      isSelected ? "text-white" : "text-white/40"
                    )}>
                      {dayNames[i].slice(0, 3)}
                    </span>

                    {/* Date circle with status */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center relative transition-all duration-200",
                        isSelected && "scale-110"
                      )}
                      style={{
                        backgroundColor: isSelected ? ACCENT : 'transparent',
                        boxShadow: isSelected ? `0 4px 20px ${ACCENT_GLOW}` : 'none'
                      }}
                    >
                      {/* Today ring indicator (when not selected) */}
                      {isTodayDay && !isSelected && (
                        <div
                          className="absolute inset-0 rounded-full border-2"
                          style={{ borderColor: ACCENT }}
                        />
                      )}

                      {/* Workout indicator ring (when has workout but not today/selected) */}
                      {hasWorkoutDay && !isTodayDay && !isSelected && !isCompleted && (
                        <div className="absolute inset-0 rounded-full border border-white/20" />
                      )}

                      {/* Completed checkmark or date number */}
                      {isCompleted && !isSelected ? (
                        <div className="w-full h-full rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      ) : (
                        <span className={cn(
                          "text-[15px] font-semibold tabular-nums",
                          isSelected ? "text-white" :
                          isTodayDay ? "text-white" :
                          hasWorkoutDay ? "text-white/70" : "text-white/30"
                        )}>
                          {date.getDate()}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Morning/Evening Toggle - Inside Calendar Card */}
            {hasTwoADaySessions && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-white/[0.06]">
                {['am', 'pm'].map((view) => (
                  <button
                    key={view}
                    onClick={() => { setSessionView(view as 'am' | 'pm'); haptic.light(); }}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    )}
                    style={{
                      backgroundColor: sessionView === view ? ACCENT : 'rgba(255,255,255,0.04)',
                      color: sessionView === view ? 'white' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {view === 'am' ? '☀️ Morning' : '🌙 Evening'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Legend - Below calendar */}
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-2 h-2 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-[10px] text-white/40">Done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border" style={{ borderColor: ACCENT }} />
              <span className="text-[10px] text-white/40">Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border border-white/20" />
              <span className="text-[10px] text-white/40">Scheduled</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 pb-32 overflow-y-auto relative z-10">
        {hasWorkout && workoutInfo ? (
          <div className="space-y-5">
            {/* Workout Card */}
            <div
              className={cn(
                "transition-all duration-500 delay-200",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              {/* Past day indicator */}
              {isPast && (
                <div
                  className="mb-3 px-3 py-2 rounded-lg inline-flex items-center gap-2"
                  style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-amber-400 text-xs font-medium">
                    Catch up available
                  </span>
                </div>
              )}

              <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/[0.06]">
                {/* Workout name */}
                <h3 className="text-white text-[22px] font-semibold tracking-tight mb-4">
                  {workoutInfo.focus}
                </h3>

                {/* Stats */}
                <div className="flex items-center gap-6 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-lg font-semibold">{workoutInfo.exerciseCount}</span>
                    <span className="text-white/40 text-sm">exercises</span>
                  </div>
                  <div className="w-px h-4 bg-white/10" />
                  <div className="flex items-center gap-2">
                    <span className="text-white text-lg font-semibold">~{workoutInfo.duration}</span>
                    <span className="text-white/40 text-sm">min</span>
                  </div>
                </div>

                {/* Exercise preview */}
                <div className="flex flex-wrap gap-2">
                  {workoutInfo.exercises.slice(0, 4).map((ex, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-white/60 text-xs font-medium"
                    >
                      {ex.name}
                    </span>
                  ))}
                  {workoutInfo.exercises.length > 4 && (
                    <span className="px-3 py-1.5 rounded-lg text-white/30 text-xs font-medium">
                      +{workoutInfo.exercises.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Exercise List */}
            <div
              className={cn(
                "transition-all duration-500 delay-300",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3 px-1">
                Exercises
              </p>
              <div className="space-y-2">
                {workoutInfo.exercises.slice(0, 5).map((exercise, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] active:scale-[0.98] transition-transform"
                  >
                    {/* Number */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: ACCENT_SOFT }}
                    >
                      <span style={{ color: ACCENT }} className="text-sm font-semibold">{i + 1}</span>
                    </div>

                    {/* Exercise info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white/90 font-medium text-[15px] truncate">
                        {exercise.name}
                      </p>
                    </div>

                    {/* Metrics: Duration for cardio, Sets × Reps for strength */}
                    <span className="text-white/30 text-sm font-medium shrink-0">
                      {exercise.isCardio
                        ? `${exercise.cardioMinutes} min`
                        : `${exercise.sets} × ${exercise.reps}`
                      }
                    </span>
                  </div>
                ))}
              </div>

              {workoutInfo.exercises.length > 5 && (
                <p className="text-white/25 text-xs text-center py-3 font-medium">
                  +{workoutInfo.exercises.length - 5} more
                </p>
              )}
            </div>

            {/* Start Button */}
            <div
              className={cn(
                "pt-4 transition-all duration-500 delay-400",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <button
                onClick={handleStart}
                className="w-full py-4 rounded-2xl font-semibold text-[15px] text-white transition-all duration-200 active:scale-[0.97]"
                style={{
                  backgroundColor: ACCENT,
                  boxShadow: `0 8px 32px ${ACCENT_GLOW}`
                }}
              >
                {isPast ? 'Start Catch-Up' : 'Start Workout'}
              </button>

              {/* Subtle hint */}
              {isToday && weekStats.remaining > 1 && (
                <p className="text-white/20 text-xs text-center mt-4">
                  {weekStats.remaining - 1} more {weekStats.remaining - 1 === 1 ? 'session' : 'sessions'} after this
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Rest Day */
          <div
            className={cn(
              "flex flex-col items-center justify-center min-h-[50vh] transition-all duration-700",
              mounted ? "opacity-100" : "opacity-0"
            )}
          >
            <div className="w-20 h-20 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
              </svg>
            </div>

            <h2 className="text-white text-xl font-semibold mb-2">
              Rest Day
            </h2>
            <p className="text-white/40 text-sm text-center max-w-[240px] leading-relaxed">
              Recovery is part of the process. Your body builds back stronger.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
