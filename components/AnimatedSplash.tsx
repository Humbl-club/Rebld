import React, { useEffect, useState, useRef } from 'react';

/**
 * Unified Animated Splash Screen
 *
 * Creative "building/construction" concept - letters construct themselves
 * piece by piece, like building your best self. Brand colors: white + coral.
 */

interface AnimatedSplashProps {
  onComplete: () => void;
  isReady?: boolean;
  minDuration?: number;
}

export default function AnimatedSplash({
  onComplete,
  isReady = false,
  minDuration = 2200
}: AnimatedSplashProps) {
  const [phase, setPhase] = useState(0);
  const [canExit, setCanExit] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const hasTriggeredComplete = useRef(false);

  // Animation phases
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setPhase(1), 50));    // Container appears
    timers.push(setTimeout(() => setPhase(2), 200));   // R drops in
    timers.push(setTimeout(() => setPhase(3), 320));   // E drops in
    timers.push(setTimeout(() => setPhase(4), 440));   // B drops in (coral)
    timers.push(setTimeout(() => setPhase(5), 560));   // L drops in
    timers.push(setTimeout(() => setPhase(6), 680));   // D drops in
    timers.push(setTimeout(() => setPhase(7), 900));   // Underline sweeps
    timers.push(setTimeout(() => setPhase(8), 1200));  // Pulse glow
    timers.push(setTimeout(() => setCanExit(true), minDuration));

    return () => timers.forEach(clearTimeout);
  }, [minDuration]);

  // Exit when ready
  useEffect(() => {
    if (isReady && canExit && !hasTriggeredComplete.current) {
      hasTriggeredComplete.current = true;
      setIsExiting(true);
      setTimeout(onComplete, 500);
    }
  }, [isReady, canExit, onComplete]);

  // Letter animation helper
  const getLetterStyle = (letterPhase: number, color: string, delay: number = 0) => ({
    color,
    opacity: phase >= letterPhase ? 1 : 0,
    transform: phase >= letterPhase
      ? 'translateY(0) rotateX(0deg)'
      : 'translateY(-40px) rotateX(-90deg)',
    transition: `all 400ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
    transformOrigin: 'center bottom',
    textShadow: phase >= 8 && color === '#EF4444'
      ? '0 0 30px rgba(224, 122, 95, 0.6)'
      : 'none',
  });

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0A0A0A 0%, #0E0E0F 50%, #0A0A0A 100%)',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1), transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Ambient glow behind logo */}
      <div
        className="absolute"
        style={{
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224, 122, 95, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          opacity: phase >= 4 ? 1 : 0,
          transform: `scale(${phase >= 8 ? 1.3 : 1})`,
          transition: 'all 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Floating particles */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${3 + (i % 3) * 2}px`,
            height: `${3 + (i % 3) * 2}px`,
            backgroundColor: i % 2 === 0 ? 'rgba(224, 122, 95, 0.5)' : 'rgba(255, 255, 255, 0.3)',
            left: `${15 + (i * 10)}%`,
            top: `${30 + (i % 4) * 15}%`,
            opacity: phase >= 2 && !isExiting ? 0.7 : 0,
            transform: `translateY(${phase >= 2 ? (i % 2 === 0 ? -30 : -20) : 0}px)`,
            transition: `all ${2 + i * 0.3}s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.1}s`,
            filter: 'blur(1px)',
          }}
        />
      ))}

      {/* Main logo container */}
      <div
        className="relative z-10"
        style={{
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? 'scale(1)' : 'scale(0.9)',
          transition: 'all 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Letters container */}
        <div
          className="flex items-baseline justify-center"
          style={{ perspective: '1000px' }}
        >
          <span
            className="text-[56px] font-black tracking-tight"
            style={getLetterStyle(2, '#FFFFFF')}
          >
            R
          </span>
          <span
            className="text-[56px] font-black tracking-tight"
            style={getLetterStyle(3, '#FFFFFF')}
          >
            E
          </span>
          <span
            className="text-[56px] font-black tracking-tight"
            style={getLetterStyle(4, '#EF4444')}
          >
            B
          </span>
          <span
            className="text-[56px] font-black tracking-tight"
            style={getLetterStyle(5, '#EF4444')}
          >
            L
          </span>
          <span
            className="text-[56px] font-black tracking-tight"
            style={getLetterStyle(6, '#EF4444')}
          >
            D
          </span>
        </div>

        {/* Animated underline */}
        <div
          className="mx-auto mt-3 rounded-full"
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, transparent 0%, #EF4444 50%, transparent 100%)',
            width: phase >= 7 ? '140px' : '0px',
            opacity: phase >= 7 ? 1 : 0,
            transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />

        {/* Tagline */}
        <p
          className="text-center mt-5"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.4)',
            opacity: phase >= 7 ? 1 : 0,
            transform: `translateY(${phase >= 7 ? 0 : 10}px)`,
            transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1) 100ms',
          }}
        >
          Build Your Best
        </p>
      </div>

      {/* Loading indicator - morphing dots */}
      <div
        className="absolute bottom-24 flex items-center gap-2"
        style={{
          opacity: phase >= 7 && !isExiting ? 1 : 0,
          transition: 'opacity 300ms ease',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: '#EF4444',
              animation: phase >= 7 ? `pulse-loading 1.4s ease-in-out ${i * 0.15}s infinite` : 'none',
            }}
          />
        ))}
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes pulse-loading {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          40% {
            opacity: 1;
            transform: scale(1.4);
          }
        }
      `}</style>
    </div>
  );
}
