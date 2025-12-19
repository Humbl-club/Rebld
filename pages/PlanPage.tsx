import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutPlan, PlanDay } from '../types';
import { Share2 } from 'lucide-react';
import { notify } from '../components/layout/Toast';
import { cn } from '../lib/utils';
import SharePlanDialog from '../components/SharePlanDialog';
import { useUser } from '@clerk/clerk-react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/ui/PullToRefreshIndicator';
import { startOfWeek, addDays, isSameDay } from 'date-fns';
import { Id } from '../convex/_generated/dataModel';

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN PAGE - Editorial Noir (Brutalist Edition)
// ═══════════════════════════════════════════════════════════════════════════════

interface PlanPageProps {
  activePlan: WorkoutPlan;
  onStartSession: (session: PlanDay) => void;
}

// Helpers
const getExercisesFromDay = (day: PlanDay): any[] => {
  const exercises: any[] = [];
  if (day.blocks) day.blocks.forEach(b => b.exercises && exercises.push(...b.exercises));
  if ((day as any).sessions) (day as any).sessions.forEach((s: any) => s.blocks?.forEach((b: any) => b.exercises && exercises.push(...b.exercises)));
  return exercises;
};

const hasTwoADaySessions = (day: PlanDay): boolean => !!(day as any).sessions && (day as any).sessions.length > 0;

export default function PlanPage({ activePlan, onStartSession }: PlanPageProps) {
  const { t } = useTranslation();
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showShareDialog, setShowShareDialog] = useState(false);

  const weeklyPlan = Array.isArray(activePlan?.weeklyPlan) ? activePlan.weeklyPlan : [];
  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: async () => await new Promise(r => setTimeout(r, 500)) });

  // Map Generation
  const dateToPlanDay = useMemo(() => {
    const map = new Map<number, PlanDay>();
    weeklyPlan.forEach((day) => {
      const date = addDays(weekStart, day.day_of_week - 1);
      map.set(date.getTime(), day);
    });
    return map;
  }, [weeklyPlan, weekStart]);

  // Selected Day Logic
  const selectedPlanDay = useMemo(() => {
    // Find matching day logic
    for (const [timestamp, day] of dateToPlanDay.entries()) {
      const planDate = new Date(timestamp);
      if (isSameDay(planDate, selectedDate)) return day;
    }
    return null;
  }, [selectedDate, dateToPlanDay]);

  const exercises = selectedPlanDay ? getExercisesFromDay(selectedPlanDay) : [];
  const hasWorkout = exercises.length > 0;

  // Week Dates Array
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="h-full bg-black flex flex-col pt-safe-top">
      <PullToRefreshIndicator distance={pullDistance} isRefreshing={isRefreshing} isTriggered={pullDistance >= 80} />

      {/* HEADER: Noir Identity */}
      <header className="px-6 py-6 border-b border-white/10 flex justify-between items-end">
        <div>
          <p className="font-mono text-[10px] text-[#525252] mb-1 tracking-widest uppercase">
            TRAINING ARCHITECTURE
          </p>
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
            PLAN
          </h1>
        </div>
        <button
          onClick={() => setShowShareDialog(true)}
          className="w-10 h-10 border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* WEEKLY CALENDAR STRIP */}
        <div className="flex justify-between mb-8 pb-4 border-b border-white/10">
          {weekDates.map((date, i) => {
            const isSelected = isSameDay(date, selectedDate);
            const dayHasWorkout = dateToPlanDay.get(date.getTime());
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className="flex flex-col items-center gap-2 group"
              >
                <span className={cn(
                  "font-mono text-[10px] uppercase tracking-wider",
                  isSelected ? "text-white" : "text-[#525252] group-hover:text-[#A3A3A3]"
                )}>
                  {DAYS[i].slice(0, 1)}
                </span>
                <div className={cn(
                  "w-8 h-8 flex items-center justify-center text-sm font-bold transition-all border",
                  isSelected ? "bg-white text-black border-white" : "bg-transparent text-[#737373] border-transparent",
                  !isSelected && dayHasWorkout && "border-white/20"
                )}>
                  {date.getDate()}
                </div>
              </button>
            );
          })}
        </div>

        {/* DAY VIEW */}
        <div className="animate-fade-in">
          <div className="flex justify-between items-baseline mb-4">
            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
            </h2>
            <span className="font-mono text-xs text-[#525252] tracking-widest uppercase">
              {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {hasWorkout && selectedPlanDay ? (
            <div className="border border-white/10 p-6 bg-[#0A0A0A] group hover:border-white/30 transition-colors cursor-pointer" onClick={() => onStartSession(selectedPlanDay)}>
              <p className="font-mono text-[10px] text-[#525252] mb-2 uppercase tracking-widest">
                PRIMARY FOCUS
              </p>
              <h3 className="text-3xl font-black text-white uppercase leading-none tracking-tight mb-6">
                {selectedPlanDay.focus}
              </h3>

              <div className="space-y-3 mb-6">
                {exercises.slice(0, 4).map((ex, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-sm font-bold text-white uppercase tracking-wide">{ex.exercise_name}</span>
                    <span className="font-mono text-[10px] text-[#737373]">
                      {ex.metrics_template?.target_sets}x{ex.metrics_template?.target_reps}
                    </span>
                  </div>
                ))}
                {exercises.length > 4 && (
                  <p className="font-mono text-[10px] text-[#525252] pt-2 text-center uppercase tracking-widest">
                    + {exercises.length - 4} ADDITIONAL EXERCISES
                  </p>
                )}
              </div>

              <button className="w-full h-12 border border-white text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
                VIEW DETAILS
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-white/10 opacity-50">
              <p className="font-mono text-xs text-[#525252] uppercase tracking-widest mb-2">NO PROGRAMMED SESSION</p>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">REST DAY</h3>
            </div>
          )}
        </div>
      </div>

      {/* Share Dialog */}
      <SharePlanDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        planId={activePlan._id as Id<"workoutPlans">}
        planName={activePlan.name}
        userId={user?.id || ''}
      />
    </div>
  );
}
