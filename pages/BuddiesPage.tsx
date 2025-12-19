import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/clerk-react';
import { api } from '../convex/_generated/api';
import BuddyComparisonCard from '../components/BuddyComparisonCard';
import BuddyWorkoutLog from '../components/BuddyWorkoutLog';
import EnterCodeDialog from '../components/EnterCodeDialog';
import { notify } from '../components/layout/Toast';
import { cn } from '../lib/utils';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/ui/PullToRefreshIndicator';
import useWorkoutPlan from '../hooks/useWorkoutPlan';

// ═══════════════════════════════════════════════════════════════════════════════
// BUDDIES PAGE - Editorial Noir (Brutalist Edition)
// ═══════════════════════════════════════════════════════════════════════════════

export default function BuddiesPage() {
  const { user } = useUser();
  const userId = user?.id || null;
  const [showEnterCode, setShowEnterCode] = useState(false);
  const { activePlan } = useWorkoutPlan();

  // Queries
  const buddies = useQuery(api.buddyQueries.getWorkoutBuddies, userId ? { userId } : 'skip');
  const removeBuddyMutation = useMutation(api.buddyMutations.removeBuddy);
  const sendBuddyRequestMutation = useMutation(api.userCodeMutations.sendBuddyRequest);

  // Logic for PR Comparison (Same as before)
  const todaysExercises = useMemo(() => {
    if (!activePlan?.weeklyPlan) return [];
    const today = new Date().getDay();
    const todayPlan = activePlan.weeklyPlan.find(d => d.day_of_week === today);
    if (!todayPlan) return [];
    const exercises: string[] = [];
    if (todayPlan.blocks) todayPlan.blocks.forEach((b, i) => i > 0 && b.exercises?.forEach(ex => ex.category === 'main' && exercises.push(ex.exercise_name)));
    if (todayPlan.sessions) todayPlan.sessions.forEach(s => s.blocks.forEach((b, i) => i > 0 && b.exercises?.forEach(ex => ex.category === 'main' && exercises.push(ex.exercise_name))));
    return exercises;
  }, [activePlan]);

  // Pull to Refresh
  const { pullDistance, isRefreshing, isTriggered } = usePullToRefresh({ onRefresh: async () => await new Promise(r => setTimeout(r, 800)) });

  // Handlers
  const handleRemoveBuddy = async (buddyId: string) => {
    if (!userId || !confirm('REMOVE AGENT FROM CIRCLE?')) return;
    try {
      await removeBuddyMutation({ userId, buddyId });
      notify({ type: 'success', message: 'AGENT REMOVED' });
    } catch { notify({ type: 'error', message: 'ERROR REMOVING AGENT' }); }
  };

  const handleCodeEntered = async (code: string) => {
    if (!userId) return;
    try {
      await sendBuddyRequestMutation({ fromUserId: userId, toUserCode: code });
      notify({ type: 'success', message: 'REQUEST SENT' });
      setShowEnterCode(false);
    } catch (e: any) { notify({ type: 'error', message: e.message }); }
  };

  return (
    <>
      <PullToRefreshIndicator distance={pullDistance} isTriggered={isTriggered} isRefreshing={isRefreshing} />

      <div className="h-full bg-black flex flex-col pt-safe-top">
        {/* HEADER: Noir Identity */}
        <header className="px-6 py-6 border-b border-white/10 flex justify-between items-end">
          <div>
            <p className="font-mono text-[10px] text-[#525252] mb-1 tracking-widest uppercase">
              NETWORK
            </p>
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
              CIRCLE
            </h1>
          </div>

          <button
            onClick={() => setShowEnterCode(true)}
            className="w-10 h-10 rounded-full border border-white flex items-center justify-center hover:bg-white hover:text-black transition-colors"
            aria-label="Add Buddy"
          >
            <span className="text-xl font-light leading-none mb-1">+</span>
          </button>
        </header>

        {/* MAIN LIST */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          {!buddies || buddies.length === 0 ? (
            /* EMPTY STATE - Brutalist */
            <div className="flex flex-col items-center justify-center h-[50vh] opacity-50">
              <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center mb-6">
                <span className="text-2xl text-white/50">∅</span>
              </div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-2">CIRCLE EMPTY</h3>
              <p className="font-mono text-xs text-[#525252] uppercase tracking-widest mb-8">NO ACTIVE AGENTS</p>
              <button
                onClick={() => setShowEnterCode(true)}
                className="px-6 py-3 border border-white text-white font-bold uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-colors"
              >
                INITIATE CONNECTION
              </button>
            </div>
          ) : (
            <div className="space-y-12">
              {/* STORIES ROW (Online Status) */}
              <div className="flex gap-4 overflow-x-auto pb-4 border-b border-white/10 hide-scrollbar">
                {buddies.map((buddy, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                    <div className="w-16 h-16 rounded-full border-2 border-white p-1">
                      <div className="w-full h-full bg-[#1A1A1A] rounded-full flex items-center justify-center font-black text-xl text-white">
                        {buddy.buddyId.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>

              {/* DETAILED LIST */}
              <div className="divide-y divide-white/10">
                {buddies.map((buddy, i) => (
                  <div key={i} className="py-8">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight italic">
                          BUDDY {i + 1}
                        </h3>
                        <p className="font-mono text-[10px] text-[#525252] uppercase tracking-widest mt-1">
                          ID: {buddy.buddyId.slice(0, 8)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveBuddy(buddy.buddyId)}
                        className="text-[10px] font-mono text-[#525252] hover:text-red-500 uppercase tracking-widest"
                      >
                        DISCONNECT
                      </button>
                    </div>

                    {/* PR COMPARE */}
                    <div className="mb-6">
                      <p className="font-mono text-[10px] text-white/40 mb-3 uppercase tracking-widest">PERFORMANCE DELTA</p>
                      <BuddyComparisonCard
                        userId={userId!}
                        buddyId={buddy.buddyId}
                        buddyName={`Buddy ${i + 1}`}
                        exerciseFilter={todaysExercises.length > 0 ? todaysExercises : undefined}
                      // Pass a 'variant' prop if the component supported it, or wrap/style it globally
                      />
                    </div>

                    {/* RECENT LOGS */}
                    <div>
                      <p className="font-mono text-[10px] text-white/40 mb-3 uppercase tracking-widest">ACTIVITY LOG</p>
                      <BuddyWorkoutLog
                        userId={userId!}
                        buddyId={buddy.buddyId}
                        buddyName={`Buddy ${i + 1}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        <EnterCodeDialog isOpen={showEnterCode} onClose={() => setShowEnterCode(false)} onCodeEntered={handleCodeEntered} />
      </div>
    </>
  );
}
