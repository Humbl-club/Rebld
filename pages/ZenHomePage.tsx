import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { WorkoutPlan, PlanDay, DailyRoutine, UserProfile, WorkoutSession } from '../types';
import { cn } from '../lib/utils';
import { useHaptic } from '../hooks/useAnimations';
import { usePageBackground, BackgroundOverlay } from '../hooks/usePageBackground';

// ═══════════════════════════════════════════════════════════════════════════════
// ZEN HOME PAGE - Editorial Noir (Brutalist Edition)
// ═══════════════════════════════════════════════════════════════════════════════

type SessionType = PlanDay | DailyRoutine | WorkoutSession;

interface ZenHomePageProps {
  plan: WorkoutPlan;
  onStartSession: (session: SessionType) => void;
  onOpenChat: () => void;
  userProfile?: UserProfile | null;
}

// NOIR UTILS
const formatFocusName = (focus: string): string => focus.replace(/^(AM|PM)\s+/i, '').trim();
const isCardioExercise = (name: string): boolean => {
  const keywords = ['elliptical', 'treadmill', 'bike', 'cycling', 'running', 'walking', 'rowing', 'stair', 'cardio', 'jogging', 'sprint', 'hiit', 'ski'];
  return keywords.some(k => name.toLowerCase().includes(k));
};

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

  // Indices
  const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);
  const [sessionView, setSessionView] = useState<'am' | 'pm'>(isAfternoon ? 'pm' : 'am');

  // Dates
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const weekDates = useMemo(() => {
    // Logic from original to get dates (omitted for brevity, assume standard Mon start)
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(mon);
      date.setDate(mon.getDate() + i);
      return date;
    });
  }, []);

  // Data
  const weeklyPlan = plan?.weeklyPlan || [];
  const activeDayPlan = weeklyPlan[selectedDayIndex];

  // 2x Daily Logic
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

  const currentSession = useMemo(() => hasTwoADaySessions ? (sessionView === 'am' ? amSession : pmSession) : activeDayPlan, [hasTwoADaySessions, sessionView, amSession, pmSession, activeDayPlan]);

  const hasWorkout = useMemo(() => {
    if (!currentSession) return false;
    const blocks = 'blocks' in currentSession ? currentSession.blocks : [];
    return blocks && blocks.length > 0 && blocks.some(b => b.exercises && b.exercises.length > 0);
  }, [currentSession]);

  const workoutInfo = useMemo(() => {
    if (!currentSession || !hasWorkout) return null;
    const blocks = 'blocks' in currentSession ? currentSession.blocks : [];
    const exercises = blocks?.flatMap(b => b.exercises || []) || [];
    const focus = 'focus' in currentSession ? currentSession.focus : ('session_name' in currentSession ? currentSession.session_name : 'WORKOUT');
    const duration = 'estimated_duration' in currentSession ? currentSession.estimated_duration : Math.round(exercises.length * 4);

    return {
      focus: formatFocusName(focus || 'WORKOUT').toUpperCase(),
      exerciseCount: exercises.length,
      exercises: exercises.map(ex => ({
        name: ex.exercise_name,
        sets: ex.metrics_template?.target_sets || 3,
        reps: ex.metrics_template?.target_reps || '8-12',
        isCardio: isCardioExercise(ex.exercise_name),
        cardioMinutes: isCardioExercise(ex.exercise_name) ? (ex.metrics_template?.target_duration || 20) : null,
      })),
      duration: duration,
    };
  }, [currentSession, hasWorkout]);

  // Start Handler
  const handleStart = useCallback(() => {
    if (!currentSession) return;
    haptic.medium();
    if (hasTwoADaySessions && currentSession) {
      onStartSession({ ...currentSession, day_of_week: activeDayPlan?.day_of_week || todayIndex + 1 } as any);
    } else {
      onStartSession(currentSession as SessionType);
    }
  }, [currentSession, hasTwoADaySessions, activeDayPlan, todayIndex, onStartSession]);

  const isToday = selectedDayIndex === todayIndex;

  return (
    <div className="h-full bg-black flex flex-col pt-safe-top pb-safe-bottom">
      {/* HEADER: Noir Identity */}
      <header className="px-6 py-4 flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <p className="font-mono text-[10px] text-[#525252] mb-1 tracking-widest uppercase">
            {userProfile?.username || 'AGENT'}
          </p>
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
            AGENDA
          </h1>
        </div>

        {/* Week Status Pill */}
        <div className="flex items-center gap-2 border border-white/20 px-3 py-1 rounded-full">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="font-mono text-xs text-white">ONLINE</span>
        </div>
      </header>

      {/* CALENDAR: Minimalist Number Line */}
      <div className="px-4 py-6 border-b border-white/10">
        <div className="flex justify-between items-center">
          {weekDates.map((date, i) => {
            const isSelected = i === selectedDayIndex;
            const isTodayDay = i === todayIndex;
            return (
              <button
                key={i}
                onClick={() => { setSelectedDayIndex(i); haptic.light(); }}
                className="flex flex-col items-center gap-2 w-10 group"
              >
                <span className={cn(
                  "text-[10px] font-mono tracking-wider transition-colors uppercase",
                  isSelected ? "text-white" : "text-[#525252] group-hover:text-[#A3A3A3]"
                )}>
                  {dayNames[i].slice(0, 1)}
                </span>

                <div className={cn(
                  "w-8 h-8 flex items-center justify-center font-bold text-sm transition-all rounded-full border border-transparent",
                  isSelected ? "bg-white text-black scale-110" : "text-[#737373]",
                  isTodayDay && !isSelected && "border-white/30 text-white"
                )}>
                  {date.getDate()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        {hasWorkout && workoutInfo ? (
          <div className="animate-fade-in-up">
            {/* HERO CARD: Current Focus */}
            <div className="relative w-full aspect-[4/3] bg-[#111] border border-white/10 mb-8 group overflow-hidden">
              {/* Abstract Texture/Image Placeholder */}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/80 to-transparent z-10" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 p-6 z-20">
                <p className="font-mono text-xs text-[#A3A3A3] mb-2 tracking-widest uppercase">
                  PRIMARY OBJECTIVE
                </p>
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tight leading-none mb-4">
                  {workoutInfo.focus}
                </h2>
                <div className="flex gap-4">
                  <div className="border border-white/30 px-3 py-1 bg-black/50 backdrop-blur">
                    <span className="font-mono text-xs text-white">
                      {workoutInfo.exerciseCount} EXERCISES
                    </span>
                  </div>
                  <div className="border border-white/30 px-3 py-1 bg-black/50 backdrop-blur">
                    <span className="font-mono text-xs text-white">
                      ~{workoutInfo.duration} MIN
                    </span>
                  </div>
                </div>
              </div>

              {/* Start Overlay Button */}
              <button
                onClick={handleStart}
                className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm"
              >
                <div className="px-8 py-3 bg-white text-black font-black uppercase tracking-wider hover:scale-105 transition-transform">
                  INITIATE
                </div>
              </button>
            </div>

            {/* 2x Daily Toggle */}
            {hasTwoADaySessions && (
              <div className="flex border border-white/10 mb-8">
                <button
                  onClick={() => setSessionView('am')}
                  className={cn("flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors", sessionView === 'am' ? "bg-white text-black" : "text-[#737373] hover:text-white")}
                >
                  AM SESSION
                </button>
                <button
                  onClick={() => setSessionView('pm')}
                  className={cn("flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors", sessionView === 'pm' ? "bg-white text-black" : "text-[#737373] hover:text-white")}
                >
                  PM SESSION
                </button>
              </div>
            )}

            {/* LIST: Exercises */}
            <h3 className="font-mono text-xs text-[#525252] mb-4 tracking-widest uppercase pl-1">
              PROTOCOL
            </h3>
            <div className="space-y-0 border-t border-white/10">
              {workoutInfo.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between py-4 border-b border-white/10 group hover:bg-white/5 px-2 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-[#525252] w-4">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="font-bold text-sm text-white uppercase tracking-wide">
                      {ex.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-white bg-white/10 px-2 py-1">
                    {ex.isCardio ? `${ex.cardioMinutes} MIN` : `${ex.sets} × ${ex.reps}`}
                  </span>
                </div>
              ))}
            </div>

            {/* START BUTTON (Mobile/Bottom) */}
            <div className="h-24" /> {/* Spacer */}
            <button
              onClick={handleStart}
              className="w-full bg-white text-black h-16 font-black text-lg uppercase tracking-widest active:scale-[0.98] transition-all mb-8 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              START SESSION
            </button>
          </div>
        ) : (
          /* REST DAY STATE */
          <div className="h-full flex flex-col items-center justify-center opacity-50">
            <div className="w-24 h-24 border border-dashed border-white/20 rounded-full flex items-center justify-center mb-6">
              <span className="font-black text-2xl text-white">R</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">RECOVERY</h2>
            <p className="font-mono text-xs text-[#737373] uppercase tracking-widest">SYSTEM RECHARGE IN PROGRESS</p>
          </div>
        )}
      </main>
    </div>
  );
}
