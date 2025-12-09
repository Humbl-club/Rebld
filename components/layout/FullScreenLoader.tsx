import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

/**
 * Fallback loader - only shows if user already dismissed splash
 * but returns to app and data needs to reload.
 * Uses brand colors from design tokens.
 */
export default function FullScreenLoader() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-0 flex flex-col items-center justify-center z-50',
        'bg-[var(--bg-secondary)]'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'mb-8 transition-all duration-[400ms] ease-out',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[10px]'
        )}
      >
        <div className="flex items-center justify-center">
          <span className="text-[var(--text-hero)] font-black tracking-tight text-[var(--text-primary)]">RE</span>
          <span className="text-[var(--text-hero)] font-black tracking-tight text-[var(--brand-primary)]">BLD</span>
        </div>
      </div>

      {/* Spinner */}
      <div
        className={cn(
          'transition-opacity duration-300 ease-out delay-200',
          mounted ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="relative w-9 h-9">
          <div
            className="absolute inset-0 rounded-full border-2 border-[var(--border-default)]"
          />
          <svg
            className="absolute inset-0 w-full h-full animate-spin"
            viewBox="0 0 36 36"
          >
            <circle
              cx="18"
              cy="18"
              r="16"
              className="stroke-[var(--brand-primary)]"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="50 100"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
