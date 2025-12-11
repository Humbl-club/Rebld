import React, { CSSProperties, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

type PageTarget = 'home' | 'goals' | 'profile' | 'auth' | 'onboarding';

interface PageBackgroundResult {
  /** Whether background data is still loading */
  isLoading: boolean;
  /** The background image URL (null if none set) */
  backgroundUrl: string | null;
  /** CSS styles to apply to the page container */
  backgroundStyles: CSSProperties;
  /** Whether a background image is active */
  hasBackground: boolean;
}

/**
 * Hook to get background image for a specific page
 *
 * Usage:
 * ```tsx
 * const { backgroundStyles, hasBackground } = usePageBackground('home');
 *
 * return (
 *   <div
 *     className="min-h-screen bg-[#0A0A0A]"
 *     style={backgroundStyles}
 *   >
 *     {hasBackground && <div className="absolute inset-0 bg-black/70 z-0" />}
 *     <div className="relative z-10">
 *       {children}
 *     </div>
 *   </div>
 * );
 * ```
 */
export function usePageBackground(pageTarget: PageTarget): PageBackgroundResult {
  const background = useQuery(api.backgroundImages.getActiveBackground, {
    pageTarget,
  });

  const result = useMemo<PageBackgroundResult>(() => {
    // Loading state
    if (background === undefined) {
      return {
        isLoading: true,
        backgroundUrl: null,
        backgroundStyles: {},
        hasBackground: false,
      };
    }

    // No background set
    if (!background || !background.url) {
      return {
        isLoading: false,
        backgroundUrl: null,
        backgroundStyles: {},
        hasBackground: false,
      };
    }

    // Background exists - return styles
    const opacity = background.opacity ?? 0.7;

    return {
      isLoading: false,
      backgroundUrl: background.url,
      backgroundStyles: {
        backgroundImage: `url(${background.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed', // Parallax effect on scroll
      },
      hasBackground: true,
    };
  }, [background]);

  return result;
}

/**
 * Component helper - renders overlay for text readability
 * Use inside the page container when hasBackground is true
 */
export function BackgroundOverlay({
  opacity = 0.7,
  className = '',
}: {
  opacity?: number;
  className?: string;
}) {
  return (
    <div
      className={`absolute inset-0 z-0 pointer-events-none ${className}`}
      style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }}
    />
  );
}

export default usePageBackground;
