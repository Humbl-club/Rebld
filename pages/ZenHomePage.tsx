import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { WorkoutPlan, PlanDay, DailyRoutine, UserProfile, WorkoutSession } from '../types';
import { cn } from '../lib/utils';
import { useHaptic } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   ZEN HOME PAGE - Hero-Focused Dashboard

   Philosophy: One thing. Right now.
   - Time-aware: Shows AM or PM based on current time
   - Hero-focused: One workout dominates the screen
   - Visual emotion: Abstract shapes convey workout energy
   - Swipe to explore: Days accessible but not cluttering
   ═══════════════════════════════════════════════════════════════ */

type SessionType = PlanDay | DailyRoutine | WorkoutSession;

interface ZenHomePageProps {
  plan: WorkoutPlan;
  onStartSession: (session: SessionType) => void;
  onOpenChat: () => void;
  userProfile?: UserProfile | null;
}

// ─────────────────────────────────────────────────────────────
// ABSTRACT WORKOUT VISUALS - Emotional shapes
// ─────────────────────────────────────────────────────────────

function CardioVisual() {
  // Flowing, rhythmic lines for cardio
  return (
    <div className="relative w-full h-48 overflow-hidden">
      <svg viewBox="0 0 400 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        {/* Animated flowing waves */}
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M-50,${100 + i * 15} Q100,${60 + i * 20} 200,${100 + i * 10} T450,${90 + i * 15}`}
            fill="none"
            stroke={`rgba(224, 122, 95, ${0.15 + i * 0.08})`}
            strokeWidth={3 - i * 0.3}
            className="animate-flow"
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${3 + i * 0.5}s`
            }}
          />
        ))}
        {/* Pulse circles */}
        <circle cx="200" cy="100" r="40" fill="none" stroke="rgba(224, 122, 95, 0.1)" strokeWidth="2" className="animate-ping-slow" />
        <circle cx="200" cy="100" r="60" fill="none" stroke="rgba(224, 122, 95, 0.05)" strokeWidth="1" className="animate-ping-slow" style={{ animationDelay: '0.5s' }} />
      </svg>
    </div>
  );
}

function StrengthVisual() {
  // Bold, powerful blocks for strength
  return (
    <div className="relative w-full h-48 overflow-hidden">
      <svg viewBox="0 0 400 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        {/* Stacked power blocks */}
        <g className="animate-pulse-subtle">
          <rect x="140" y="60" width="120" height="20" rx="4" fill="rgba(224, 122, 95, 0.3)" />
          <rect x="120" y="90" width="160" height="25" rx="4" fill="rgba(224, 122, 95, 0.4)" />
          <rect x="100" y="125" width="200" height="30" rx="4" fill="rgba(224, 122, 95, 0.5)" />
        </g>
        {/* Side weights */}
        <circle cx="80" cy="115" r="25" fill="rgba(224, 122, 95, 0.2)" />
        <circle cx="320" cy="115" r="25" fill="rgba(224, 122, 95, 0.2)" />
        {/* Bar */}
        <rect x="60" y="110" width="280" height="10" rx="5" fill="rgba(224, 122, 95, 0.15)" />
      </svg>
    </div>
  );
}

function MixedVisual() {
  // Combination of flow and power
  return (
    <div className="relative w-full h-48 overflow-hidden">
      <svg viewBox="0 0 400 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        {/* Central diamond */}
        <g className="animate-pulse-subtle">
          <polygon points="200,40 260,100 200,160 140,100" fill="none" stroke="rgba(224, 122, 95, 0.3)" strokeWidth="2" />
          <polygon points="200,60 240,100 200,140 160,100" fill="rgba(224, 122, 95, 0.15)" />
        </g>
        {/* Orbiting elements */}
        <circle cx="200" cy="100" r="70" fill="none" stroke="rgba(224, 122, 95, 0.1)" strokeWidth="1" strokeDasharray="10 5" className="animate-spin-slow" />
      </svg>
    </div>
  );
}

function RestVisual() {
  // Calm, breathing circles for rest
  return (
    <div className="relative w-full h-48 overflow-hidden flex items-center justify-center">
      <svg viewBox="0 0 400 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        {/* Breathing circles */}
        <circle cx="200" cy="100" r="60" fill="rgba(124, 179, 66, 0.1)" className="animate-breathe" />
        <circle cx="200" cy="100" r="45" fill="rgba(124, 179, 66, 0.15)" className="animate-breathe" style={{ animationDelay: '0.5s' }} />
        <circle cx="200" cy="100" r="30" fill="rgba(124, 179, 66, 0.2)" className="animate-breathe" style={{ animationDelay: '1s' }} />
        {/* Moon icon */}
        <path
          d="M200,70 A30,30 0 1,1 200,130 A20,20 0 1,0 200,70"
          fill="rgba(124, 179, 66, 0.3)"
        />
      </svg>
    </div>
  );
}

// Detect workout type from exercises
function getWorkoutVisualType(session: PlanDay | WorkoutSession | null): 'cardio' | 'strength' | 'mixed' | 'rest' {
  if (!session) return 'rest';

  const blocks = 'blocks' in session ? session.blocks : [];
  if (!blocks || blocks.length === 0) return 'rest';

  const exercises = blocks.flatMap(b => b.exercises || []);
  if (exercises.length === 0) return 'rest';

  const focus = ('focus' in session ? session.focus : ('session_name' in session ? session.session_name : '')) || '';
  const focusLower = focus.toLowerCase();

  // Check focus name first
  if (focusLower.includes('cardio') || focusLower.includes('conditioning') || focusLower.includes('hiit') || focusLower.includes('run')) {
    return 'cardio';
  }
  if (focusLower.includes('strength') || focusLower.includes('power') || focusLower.includes('upper') || focusLower.includes('lower') || focusLower.includes('push') || focusLower.includes('pull') || focusLower.includes('leg')) {
    return 'strength';
  }

  // Check exercise names
  const cardioKeywords = ['cardio', 'run', 'bike', 'row', 'elliptical', 'treadmill', 'swim', 'jump rope', 'burpee'];
  const strengthKeywords = ['bench', 'squat', 'deadlift', 'press', 'curl', 'row', 'pull', 'push'];

  let cardioCount = 0;
  let strengthCount = 0;

  exercises.forEach(ex => {
    const name = ex.exercise_name.toLowerCase();
    if (cardioKeywords.some(k => name.includes(k))) cardioCount++;
    if (strengthKeywords.some(k => name.includes(k))) strengthCount++;
  });

  if (cardioCount > strengthCount * 2) return 'cardio';
  if (strengthCount > cardioCount * 2) return 'strength';
  return 'mixed';
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function ZenHomePage({ plan, onStartSession, userProfile }: ZenHomePageProps) {
  const haptic = useHaptic();

  // Time awareness
  const now = new Date();
  const currentHour = now.getHours();
  const isAfternoon = currentHour >= 14; // After 2pm

  // Day navigation
  const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon, 6=Sun
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);
  const [sessionView, setSessionView] = useState<'am' | 'pm'>(isAfternoon ? 'pm' : 'am');

  // Swipe handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Current session to display
  const currentSession = useMemo(() => {
    if (hasTwoADaySessions) {
      return sessionView === 'am' ? amSession : pmSession;
    }
    return activeDayPlan;
  }, [hasTwoADaySessions, sessionView, amSession, pmSession, activeDayPlan]);

  // Check if there's a workout
  const hasWorkout = useMemo(() => {
    if (!currentSession) return false;
    const blocks = 'blocks' in currentSession ? currentSession.blocks : [];
    return blocks && blocks.length > 0 && blocks.some(b => b.exercises && b.exercises.length > 0);
  }, [currentSession]);

  // Get workout info
  const workoutInfo = useMemo(() => {
    if (!currentSession || !hasWorkout) return null;

    const blocks = 'blocks' in currentSession ? currentSession.blocks : [];
    const exercises = blocks?.flatMap(b => b.exercises || []) || [];
    const focus = 'focus' in currentSession ? currentSession.focus : ('session_name' in currentSession ? currentSession.session_name : 'Workout');
    const duration = 'estimated_duration' in currentSession ? currentSession.estimated_duration : null;

    return {
      focus: focus || 'Workout',
      exerciseCount: exercises.length,
      duration: duration || Math.round(exercises.length * 4), // Estimate 4min per exercise
      visualType: getWorkoutVisualType(currentSession as PlanDay)
    };
  }, [currentSession, hasWorkout]);

  // Day names
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const shortDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Handle swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Minimum swipe distance
    if (absX < 50 && absY < 50) return;

    if (absX > absY) {
      // Horizontal swipe - change days
      if (deltaX > 50 && selectedDayIndex > 0) {
        setSelectedDayIndex(prev => prev - 1);
        haptic.light();
      } else if (deltaX < -50 && selectedDayIndex < 6) {
        setSelectedDayIndex(prev => prev + 1);
        haptic.light();
      }
    } else if (hasTwoADaySessions) {
      // Vertical swipe - change AM/PM
      if (deltaY > 50 && sessionView === 'am') {
        setSessionView('pm');
        haptic.light();
      } else if (deltaY < -50 && sessionView === 'pm') {
        setSessionView('am');
        haptic.light();
      }
    }
  }, [selectedDayIndex, sessionView, hasTwoADaySessions, haptic]);

  // Handle start
  const handleStart = useCallback(() => {
    if (!currentSession) return;
    haptic.medium();

    // Normalize for the session tracker
    if (hasTwoADaySessions && currentSession) {
      // Pass the WorkoutSession with day_of_week added
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
      ref={containerRef}
      className="h-screen w-full bg-black overflow-hidden flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Minimal Header */}
      <header className="pt-[calc(env(safe-area-inset-top)+8px)] px-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="text-2xl font-black tracking-tight">
            <span className="text-white">RE</span>
            <span className="text-[var(--brand-primary)]">BLD</span>
          </div>

          {/* Day indicator - subtle dots */}
          <div className="flex items-center gap-1.5">
            {shortDays.map((d, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedDayIndex(i);
                  haptic.light();
                }}
                className={cn(
                  "w-7 h-7 rounded-full text-[10px] font-bold transition-all",
                  i === selectedDayIndex
                    ? "bg-[var(--brand-primary)] text-white scale-110"
                    : i === todayIndex
                      ? "bg-white/20 text-white"
                      : i < todayIndex
                        ? "text-white/30"
                        : "text-white/50"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Current day label */}
        <p className={cn(
          "text-sm mt-3 font-medium",
          isToday ? "text-white" : isPast ? "text-white/40" : "text-white/60"
        )}>
          {isToday ? 'Today' : dayNames[selectedDayIndex]}
          {!isToday && isPast && ' (Past)'}
        </p>
      </header>

      {/* Hero Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 relative">
        {/* 2x Daily Session Toggle */}
        {hasTwoADaySessions && (
          <div className="absolute top-0 left-0 right-0 flex justify-center gap-4 py-2">
            <button
              onClick={() => {
                setSessionView('am');
                haptic.light();
              }}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition-all",
                sessionView === 'am'
                  ? "bg-[var(--brand-primary)] text-white"
                  : "bg-white/10 text-white/60"
              )}
            >
              Morning
            </button>
            <button
              onClick={() => {
                setSessionView('pm');
                haptic.light();
              }}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition-all",
                sessionView === 'pm'
                  ? "bg-[var(--brand-primary)] text-white"
                  : "bg-white/10 text-white/60"
              )}
            >
              Evening
            </button>
          </div>
        )}

        {hasWorkout && workoutInfo ? (
          <>
            {/* Time of day indicator for 2x daily */}
            {hasTwoADaySessions && (
              <p className="text-white/40 text-sm uppercase tracking-widest mb-2">
                {sessionView === 'am' ? 'Morning Session' : 'Evening Session'}
              </p>
            )}

            {/* Abstract Visual */}
            <div className="w-full max-w-sm mb-6">
              {workoutInfo.visualType === 'cardio' && <CardioVisual />}
              {workoutInfo.visualType === 'strength' && <StrengthVisual />}
              {workoutInfo.visualType === 'mixed' && <MixedVisual />}
            </div>

            {/* Workout Title */}
            <h1 className="text-white text-3xl font-black text-center mb-3 leading-tight">
              {workoutInfo.focus}
            </h1>

            {/* Subtle metrics */}
            <div className="flex items-center gap-4 text-white/50 text-sm mb-10">
              <span>{workoutInfo.exerciseCount} exercises</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span>~{workoutInfo.duration} min</span>
            </div>

            {/* THE Button */}
            <button
              onClick={handleStart}
              disabled={isPast}
              className={cn(
                "w-full max-w-xs py-5 rounded-2xl",
                "text-xl font-black uppercase tracking-wider",
                "transition-all duration-300",
                "active:scale-95",
                isPast
                  ? "bg-white/10 text-white/30 cursor-not-allowed"
                  : "bg-[var(--brand-primary)] text-white shadow-[0_0_40px_rgba(224,122,95,0.4)]"
              )}
            >
              {isPast ? 'Past' : 'Start'}
            </button>

            {/* Other session preview for 2x daily */}
            {hasTwoADaySessions && (
              <button
                onClick={() => {
                  setSessionView(sessionView === 'am' ? 'pm' : 'am');
                  haptic.light();
                }}
                className="mt-8 text-white/40 text-sm active:text-white/60"
              >
                {sessionView === 'am' ? (
                  <>Later: {pmSession?.session_name || 'Evening Session'}</>
                ) : (
                  <>{amSession?.session_name || 'Morning Session'}</>
                )}
              </button>
            )}
          </>
        ) : (
          /* Rest Day */
          <>
            <RestVisual />

            <h1 className="text-white text-3xl font-black text-center mb-3 mt-6">
              Rest Day
            </h1>

            <p className="text-white/50 text-center max-w-xs mb-8 leading-relaxed">
              Recovery is where growth happens. Your muscles rebuild stronger during rest.
            </p>

            {/* Breathing exercise suggestion */}
            <div className={cn(
              "px-6 py-4 rounded-2xl",
              "bg-white/5 border border-white/10",
              "text-center"
            )}>
              <p className="text-white/70 text-sm">
                Try 5 minutes of deep breathing
              </p>
              <p className="text-white/40 text-xs mt-1">
                4 seconds in, 4 seconds hold, 4 seconds out
              </p>
            </div>
          </>
        )}
      </main>

      {/* Swipe hint */}
      <footer className="pb-[calc(env(safe-area-inset-bottom)+100px)] text-center">
        <p className="text-white/20 text-xs">
          {hasTwoADaySessions ? 'Swipe ↕ sessions • Swipe ↔ days' : 'Swipe ↔ to see other days'}
        </p>
      </footer>

      {/* CSS for custom animations */}
      <style>{`
        @keyframes flow {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(20px); }
        }
        .animate-flow {
          animation: flow 3s ease-in-out infinite;
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-ping-slow {
          animation: ping-slow 2s ease-out infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        .animate-breathe {
          animation: breathe 4s ease-in-out infinite;
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
