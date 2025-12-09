import { useEffect, useState, useCallback } from 'react';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'rebld:theme:v1';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
    const root = document.documentElement;
    // Set data-theme attribute for CSS variable switching
    root.setAttribute('data-theme', theme);
    // Also toggle class for any legacy selectors
    root.classList.toggle('theme-dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, setTheme, toggleTheme };
}
