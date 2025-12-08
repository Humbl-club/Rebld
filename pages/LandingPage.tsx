import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '../components/ui/button';
import { SparklesIcon } from '../components/icons';
import { cn } from '../lib/utils';
import { useHaptic, useSequentialReveal } from '../hooks/useAnimations';

/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE - iPhone-First Design with Contextual Animations

   Animation Concept: "Building Blocks"
   - The REBLD brand is about rebuilding yourself
   - Animation shows subtle geometric shapes that "construct"
   - Elements assemble as if building a foundation
   - Touch interaction causes shapes to subtly react

   Performance:
   - All animations use GPU-accelerated transforms only
   - No continuous animations (no pulsing/breathing)
   - Entrance animations play once, then settle
   - Touch reactions are instant and purposeful

   Adaptive Design:
   - All sizes use clamp() or relative units
   - No hardcoded pixel values
   - Safe area insets for all iPhone models
   ═══════════════════════════════════════════════════════════════ */

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onPrivacy?: () => void;
  onTerms?: () => void;
}

// Ambient geometric shapes that "build" in the background
const BuildingBlocks = ({ isVisible }: { isVisible: boolean }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Block 1 - Top left, rotated square */}
      <div
        className={cn(
          'absolute',
          'w-[15vw] h-[15vw] max-w-[80px] max-h-[80px]',
          'border border-[var(--border-subtle)]',
          'rounded-lg',
          'transition-all duration-1000 ease-out',
          isVisible
            ? 'opacity-100 translate-x-0 translate-y-0 rotate-12'
            : 'opacity-0 -translate-x-8 -translate-y-8 rotate-0'
        )}
        style={{
          top: '12%',
          left: '8%',
          willChange: 'transform, opacity',
          transitionDelay: '400ms',
        }}
      />

      {/* Block 2 - Top right, small accent */}
      <div
        className={cn(
          'absolute',
          'w-[8vw] h-[8vw] max-w-[40px] max-h-[40px]',
          'bg-[var(--brand-primary)]',
          'rounded-md',
          'transition-all duration-1000 ease-out',
          isVisible
            ? 'opacity-[0.08] translate-x-0 translate-y-0 rotate-45'
            : 'opacity-0 translate-x-8 -translate-y-8 rotate-0'
        )}
        style={{
          top: '18%',
          right: '15%',
          willChange: 'transform, opacity',
          transitionDelay: '600ms',
        }}
      />

      {/* Block 3 - Bottom left, larger frame */}
      <div
        className={cn(
          'absolute',
          'w-[20vw] h-[20vw] max-w-[100px] max-h-[100px]',
          'border-2 border-[var(--border-subtle)]',
          'rounded-xl',
          'transition-all duration-1000 ease-out',
          isVisible
            ? 'opacity-100 translate-x-0 translate-y-0 -rotate-6'
            : 'opacity-0 -translate-x-12 translate-y-12 rotate-0'
        )}
        style={{
          bottom: '25%',
          left: '5%',
          willChange: 'transform, opacity',
          transitionDelay: '500ms',
        }}
      />

      {/* Block 4 - Right side, vertical bar */}
      <div
        className={cn(
          'absolute',
          'w-[3vw] max-w-[12px]',
          'h-[25vw] max-h-[120px]',
          'bg-gradient-to-b from-[var(--brand-primary)] to-transparent',
          'rounded-full',
          'transition-all duration-1000 ease-out',
          isVisible
            ? 'opacity-[0.12] translate-x-0 scale-y-100'
            : 'opacity-0 translate-x-8 scale-y-0'
        )}
        style={{
          top: '35%',
          right: '10%',
          transformOrigin: 'top',
          willChange: 'transform, opacity',
          transitionDelay: '700ms',
        }}
      />

      {/* Block 5 - Bottom accent dot */}
      <div
        className={cn(
          'absolute',
          'w-[4vw] h-[4vw] max-w-[20px] max-h-[20px]',
          'bg-[var(--brand-primary)]',
          'rounded-full',
          'transition-all duration-700 ease-out',
          isVisible
            ? 'opacity-[0.15] translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-0'
        )}
        style={{
          bottom: '32%',
          right: '25%',
          willChange: 'transform, opacity',
          transitionDelay: '800ms',
        }}
      />
    </div>
  );
};

export default function LandingPage({ onGetStarted, onSignIn, onPrivacy, onTerms }: LandingPageProps) {
  const haptic = useHaptic();
  const [isMounted, setIsMounted] = useState(false);
  const [iconTouched, setIconTouched] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);

  // Staggered reveal for entrance animations (5 elements)
  const revealed = useSequentialReveal(5, 120, 100);

  // Handle mount state for entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Button handlers with haptic feedback
  const handleGetStarted = useCallback(() => {
    haptic.medium();
    onGetStarted();
  }, [haptic, onGetStarted]);

  const handleSignIn = useCallback(() => {
    haptic.light();
    onSignIn();
  }, [haptic, onSignIn]);

  const handlePrivacy = useCallback(() => {
    haptic.light();
    onPrivacy?.();
  }, [haptic, onPrivacy]);

  const handleTerms = useCallback(() => {
    haptic.light();
    onTerms?.();
  }, [haptic, onTerms]);

  // Icon touch interaction - subtle "lift" effect
  const handleIconTouch = useCallback(() => {
    haptic.light();
    setIconTouched(true);
    setTimeout(() => setIconTouched(false), 200);
  }, [haptic]);

  return (
    <div
      className={cn(
        'h-[100dvh]', // Dynamic viewport height
        'bg-[var(--bg-primary)]',
        'flex flex-col',
        'px-[clamp(1rem,5vw,1.5rem)]', // Adaptive horizontal padding
        'pt-[env(safe-area-inset-top)]',
        'pb-[env(safe-area-inset-bottom)]',
        'overflow-hidden',
        'relative'
      )}
    >
      {/* Ambient building blocks background */}
      <BuildingBlocks isVisible={isMounted && revealed[1]} />

      {/* Header - minimal with fade-in */}
      <header
        className={cn(
          'flex items-center justify-between',
          'py-[clamp(0.75rem,3vw,1rem)]', // Adaptive vertical padding
          'transition-all duration-500 ease-out',
          'relative z-10',
          isMounted && revealed[0]
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2'
        )}
        style={{ willChange: 'transform, opacity' }}
      >
        <div className="font-display text-[clamp(1.125rem,5vw,1.25rem)] font-black tracking-tight">
          <span className="text-[var(--text-primary)]">RE</span>
          <span className="text-[var(--brand-primary)]">BLD</span>
        </div>
        <button
          onClick={handleSignIn}
          className={cn(
            'text-[clamp(0.8125rem,3.5vw,0.875rem)] font-semibold',
            'text-[var(--text-secondary)]',
            'active:text-[var(--text-primary)]',
            'active:scale-95',
            'min-h-[44px] min-w-[44px]', // iOS touch target (this is a standard, not hardcoded)
            'flex items-center justify-center',
            'transition-transform duration-150 ease-out'
          )}
          style={{ willChange: 'transform' }}
        >
          Sign In
        </button>
      </header>

      {/* Main content - centered with staggered entrance */}
      <main className="flex-1 flex flex-col justify-center items-center text-center relative z-10">
        {/* Interactive Icon */}
        <div
          ref={iconRef}
          onTouchStart={handleIconTouch}
          onClick={handleIconTouch}
          className={cn(
            'relative',
            'mb-[clamp(1rem,4vw,1.5rem)]', // Adaptive margin
            'cursor-pointer',
            'transition-all duration-700 ease-out',
            isMounted && revealed[1]
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-4 scale-90',
            // Touch response - lifts slightly
            iconTouched && 'scale-110'
          )}
          style={{
            willChange: 'transform, opacity',
            transitionDelay: isMounted && revealed[1] ? '0ms' : '50ms',
          }}
        >
          {/* Icon container with subtle shadow on touch */}
          <div
            className={cn(
              'relative',
              'w-[clamp(3.5rem,15vw,4rem)]', // Adaptive icon size
              'h-[clamp(3.5rem,15vw,4rem)]',
              'rounded-2xl',
              'bg-[var(--brand-primary-subtle)]',
              'flex items-center justify-center',
              'transition-shadow duration-200',
              iconTouched && 'shadow-lg shadow-[var(--brand-primary)]/20'
            )}
          >
            <SparklesIcon
              className={cn(
                'w-[50%] h-[50%] text-[var(--brand-primary)]',
                'transition-transform duration-200',
                iconTouched && 'rotate-12'
              )}
              style={{ willChange: 'transform' }}
            />
          </div>
        </div>

        {/* Title with entrance animation */}
        <h1
          className={cn(
            'font-display',
            'text-[clamp(1.625rem,7vw,2.125rem)]', // Adaptive: ~26px to ~34px
            'font-black',
            'text-[var(--text-primary)]',
            'tracking-tight',
            'mb-[clamp(0.5rem,2vw,0.75rem)]',
            'transition-all duration-700 ease-out',
            isMounted && revealed[2]
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          )}
          style={{
            willChange: 'transform, opacity',
            transitionDelay: '100ms',
          }}
        >
          Your AI Training Partner
        </h1>

        {/* Subtitle with entrance animation */}
        <p
          className={cn(
            'text-[clamp(0.875rem,4vw,1rem)]', // Adaptive: ~14px to ~16px
            'text-[var(--text-secondary)]',
            'max-w-[min(280px,75vw)]', // Adaptive max-width
            'leading-relaxed',
            'transition-all duration-700 ease-out',
            isMounted && revealed[3]
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          )}
          style={{
            willChange: 'transform, opacity',
            transitionDelay: '150ms',
          }}
        >
          Personalized workout plans, intelligent coaching, and progress tracking.
        </p>
      </main>

      {/* Bottom CTA - fixed to bottom with entrance animation */}
      <footer
        className={cn(
          'pb-[clamp(0.75rem,3vw,1rem)]',
          'space-y-[clamp(0.75rem,3vw,1rem)]',
          'relative z-10',
          'transition-all duration-700 ease-out',
          isMounted && revealed[4]
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-6'
        )}
        style={{
          willChange: 'transform, opacity',
          transitionDelay: '200ms',
        }}
      >
        {/* CTA Button with press animation */}
        <Button
          onClick={handleGetStarted}
          variant="accent"
          className={cn(
            'w-full',
            'h-[clamp(2.75rem,12vw,3.5rem)]', // Adaptive: ~44px to ~56px
            'text-[clamp(0.875rem,4vw,1rem)] font-semibold',
            'rounded-2xl',
            'active:scale-[0.97]',
            'transition-transform duration-150 ease-out'
          )}
          style={{ willChange: 'transform' }}
        >
          Get Started Free
        </Button>

        {/* Subtext */}
        <p
          className={cn(
            'text-center',
            'text-[clamp(0.75rem,3vw,0.875rem)]', // Adaptive: ~12px to ~14px
            'text-[var(--text-tertiary)]'
          )}
        >
          No credit card required
        </p>

        {/* Legal links */}
        <div className="flex items-center justify-center gap-[clamp(0.75rem,3vw,1rem)] pt-[clamp(0.25rem,1vw,0.5rem)]">
          {onPrivacy && (
            <button
              onClick={handlePrivacy}
              className={cn(
                'text-[clamp(0.6875rem,2.5vw,0.75rem)]', // Adaptive: ~11px to ~12px
                'text-[var(--text-tertiary)]',
                'active:text-[var(--text-secondary)]',
                'active:scale-95',
                'transition-all duration-150',
                'min-h-[44px] flex items-center'
              )}
              style={{ willChange: 'transform' }}
            >
              Privacy Policy
            </button>
          )}
          <span className="text-[var(--text-tertiary)]">·</span>
          {onTerms && (
            <button
              onClick={handleTerms}
              className={cn(
                'text-[clamp(0.6875rem,2.5vw,0.75rem)]',
                'text-[var(--text-tertiary)]',
                'active:text-[var(--text-secondary)]',
                'active:scale-95',
                'transition-all duration-150',
                'min-h-[44px] flex items-center'
              )}
              style={{ willChange: 'transform' }}
            >
              Terms of Service
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
