import { useEffect } from 'react';

/**
 * REBLD uses dark theme only - no light mode
 * This hook ensures dark theme is always set
 */
export function useTheme() {
  const theme = 'dark' as const;

  useEffect(() => {
    const root = document.documentElement;
    // Always set dark theme
    root.setAttribute('data-theme', 'dark');
    root.classList.add('theme-dark');
    root.classList.remove('theme-light');
  }, []);

  // toggleTheme is a no-op since we're dark only
  const toggleTheme = () => {};
  const setTheme = () => {};

  return { theme, setTheme, toggleTheme };
}
