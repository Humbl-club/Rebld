import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutLog } from '../types';
import { useCountUp, useHaptic } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   ZEN VICTORY SCREEN

   A meditative, minimal workout complete experience.
   Inspired by zen gardens, breathing exercises, and stillness.

   Design philosophy:
   - No confetti, no fireworks - just calm accomplishment
   - Breathing circle as the focal point
   - Stats reveal slowly, like ripples in water
   - Black and coral only - pure OLED aesthetic
   ═══════════════════════════════════════════════════════════════ */

interface ZenVictoryScreenProps {
  sessionLog: WorkoutLog;
  onDone: () => void;
}

export default function ZenVictoryScreen({ sessionLog, onDone }: ZenVictoryScreenProps) {
  const { t } = useTranslation();
  const haptic = useHaptic();
  const [phase, setPhase] = useState<'breathing' | 'reveal' | 'complete'>('breathing');
  const [breathCount, setBreathCount] = useState(0);
  const [statsRevealed, setStatsRevealed] = useState(0);
  const breathRef = useRef<HTMLDivElement>(null);

  // Calculate stats
  const exercises = Array.isArray(sessionLog.exercises) ? sessionLog.exercises : [];
  const totalVolume = exercises.reduce((sum, ex) => {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    return sum + sets.reduce((setSum, set) => {
      if ('weight' in set && 'reps' in set) {
        return setSum + (Number(set.weight) * Number(set.reps));
      }
      return setSum;
    }, 0);
  }, 0);
  const totalSets = exercises.reduce((sum, ex) => {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    return sum + sets.length;
  }, 0);

  // Animated counts (only when revealed)
  const durationCount = useCountUp(
    phase !== 'breathing' ? (sessionLog.durationMinutes || 0) : 0,
    1500
  );
  const volumeCount = useCountUp(
    phase !== 'breathing' ? Math.round(totalVolume) : 0,
    2000
  );

  // Breathing phase - 3 breath cycles then reveal
  useEffect(() => {
    haptic.heavy();

    const breathInterval = setInterval(() => {
      setBreathCount(prev => {
        const next = prev + 1;
        if (next >= 3) {
          clearInterval(breathInterval);
          setTimeout(() => {
            haptic.success();
            setPhase('reveal');
          }, 500);
        }
        return next;
      });
      haptic.light();
    }, 4000); // 4 seconds per breath (2s in, 2s out)

    return () => clearInterval(breathInterval);
  }, []);

  // Stats reveal phase
  useEffect(() => {
    if (phase !== 'reveal') return;

    const revealInterval = setInterval(() => {
      setStatsRevealed(prev => {
        if (prev >= 4) {
          clearInterval(revealInterval);
          setTimeout(() => setPhase('complete'), 800);
          return prev;
        }
        haptic.light();
        return prev + 1;
      });
    }, 600);

    return () => clearInterval(revealInterval);
  }, [phase]);

  const handleDone = () => {
    haptic.medium();
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Safe area padding */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">

        {/* Breathing Circle - Always visible, changes based on phase */}
        <div className="relative mb-12">
          {/* Outer ring - subtle pulse */}
          <div
            className="absolute inset-0 rounded-full border border-white/5"
            style={{
              width: '200px',
              height: '200px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              animation: phase === 'breathing' ? 'zenPulse 4s ease-in-out infinite' : 'none'
            }}
          />

          {/* Middle ring */}
          <div
            className="absolute inset-0 rounded-full border border-white/10"
            style={{
              width: '160px',
              height: '160px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              animation: phase === 'breathing' ? 'zenPulse 4s ease-in-out infinite 0.2s' : 'none'
            }}
          />

          {/* Main breathing circle */}
          <div
            ref={breathRef}
            className="relative rounded-full flex items-center justify-center"
            style={{
              width: phase === 'breathing' ? '120px' : '100px',
              height: phase === 'breathing' ? '120px' : '100px',
              background: phase === 'complete'
                ? 'linear-gradient(135deg, #E07A5F 0%, #C45D45 100%)'
                : 'transparent',
              border: phase === 'complete' ? 'none' : '2px solid rgba(224, 122, 95, 0.4)',
              animation: phase === 'breathing' ? 'zenBreath 4s ease-in-out infinite' : 'none',
              transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Inner glow for breathing phase */}
            {phase === 'breathing' && (
              <div
                className="absolute inset-2 rounded-full bg-[#E07A5F]/20"
                style={{ animation: 'zenBreath 4s ease-in-out infinite' }}
              />
            )}

            {/* Checkmark for complete phase */}
            {phase !== 'breathing' && (
              <svg
                className="w-10 h-10 text-white"
                style={{
                  opacity: phase === 'complete' ? 1 : 0.6,
                  transform: phase === 'complete' ? 'scale(1)' : 'scale(0.8)',
                  transition: 'all 0.5s ease-out'
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5L19 7" />
              </svg>
            )}
          </div>
        </div>

        {/* Text Section */}
        <div className="text-center mb-12">
          {phase === 'breathing' ? (
            <>
              <p className="text-white/30 text-xs uppercase tracking-[0.3em] mb-3">
                {breathCount < 1 ? 'Breathe' : breathCount < 2 ? 'Feel' : 'Done'}
              </p>
              <h1 className="text-white text-2xl font-light tracking-tight">
                {breathCount < 1 ? 'Take a moment' : breathCount < 2 ? 'You earned this' : 'Well done'}
              </h1>
            </>
          ) : (
            <>
              <p
                className="text-[#E07A5F] text-xs uppercase tracking-[0.3em] mb-3"
                style={{
                  opacity: statsRevealed > 0 ? 1 : 0,
                  transform: statsRevealed > 0 ? 'translateY(0)' : 'translateY(10px)',
                  transition: 'all 0.5s ease-out'
                }}
              >
                Complete
              </p>
              <h1
                className="text-white text-3xl font-bold tracking-tight"
                style={{
                  opacity: statsRevealed > 0 ? 1 : 0,
                  transform: statsRevealed > 0 ? 'translateY(0)' : 'translateY(10px)',
                  transition: 'all 0.5s ease-out 0.1s'
                }}
              >
                {sessionLog.focus || 'Workout'}
              </h1>
            </>
          )}
        </div>

        {/* Stats - Horizontal minimal layout */}
        {phase !== 'breathing' && (
          <div className="w-full max-w-sm">
            {/* Main stats row */}
            <div className="flex justify-between items-center mb-8 px-4">
              {/* Duration */}
              <div
                className="text-center"
                style={{
                  opacity: statsRevealed > 1 ? 1 : 0,
                  transform: statsRevealed > 1 ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'all 0.6s ease-out'
                }}
              >
                <p className="text-white text-4xl font-black tabular-nums mb-1">
                  {durationCount}
                </p>
                <p className="text-white/40 text-xs uppercase tracking-wider">min</p>
              </div>

              {/* Divider */}
              <div
                className="w-px h-12 bg-white/10"
                style={{
                  opacity: statsRevealed > 2 ? 1 : 0,
                  transition: 'opacity 0.4s ease-out'
                }}
              />

              {/* Volume */}
              <div
                className="text-center"
                style={{
                  opacity: statsRevealed > 2 ? 1 : 0,
                  transform: statsRevealed > 2 ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'all 0.6s ease-out'
                }}
              >
                <p className="text-white text-4xl font-black tabular-nums mb-1">
                  {volumeCount.toLocaleString()}
                </p>
                <p className="text-white/40 text-xs uppercase tracking-wider">kg</p>
              </div>

              {/* Divider */}
              <div
                className="w-px h-12 bg-white/10"
                style={{
                  opacity: statsRevealed > 3 ? 1 : 0,
                  transition: 'opacity 0.4s ease-out'
                }}
              />

              {/* Exercises */}
              <div
                className="text-center"
                style={{
                  opacity: statsRevealed > 3 ? 1 : 0,
                  transform: statsRevealed > 3 ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'all 0.6s ease-out'
                }}
              >
                <p className="text-white text-4xl font-black tabular-nums mb-1">
                  {exercises.length}
                </p>
                <p className="text-white/40 text-xs uppercase tracking-wider">exercises</p>
              </div>
            </div>

            {/* Secondary stat */}
            <div
              className="text-center mb-8"
              style={{
                opacity: statsRevealed > 3 ? 1 : 0,
                transform: statsRevealed > 3 ? 'translateY(0)' : 'translateY(10px)',
                transition: 'all 0.6s ease-out 0.2s'
              }}
            >
              <span className="text-white/30 text-sm">
                {totalSets} sets completed
              </span>
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Done button - appears after complete */}
        <div
          className="w-full max-w-sm px-6 pb-8"
          style={{
            opacity: phase === 'complete' ? 1 : 0,
            transform: phase === 'complete' ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s ease-out',
            pointerEvents: phase === 'complete' ? 'auto' : 'none'
          }}
        >
          <button
            onClick={handleDone}
            className="w-full py-4 rounded-xl bg-[#E07A5F] text-white font-bold text-base active:scale-[0.98] transition-transform"
          >
            {t('victory.done', 'Done')}
          </button>

          {/* Subtle hint */}
          <p className="text-center text-white/20 text-xs mt-4">
            Your progress has been saved
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes zenBreath {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
        }

        @keyframes zenPulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.3;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.1;
          }
        }
      `}</style>
    </div>
  );
}
