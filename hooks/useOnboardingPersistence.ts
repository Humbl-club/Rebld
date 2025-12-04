/**
 * useOnboardingPersistence Hook
 *
 * Persists onboarding state to localStorage to prevent data loss
 * if user navigates away, refreshes, or closes the app mid-onboarding.
 *
 * Features:
 * - Auto-saves state after each change
 * - Auto-restores state on mount
 * - Clears state on completion
 * - Expires after 24 hours to prevent stale data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { TrainingSplit, SpecificGoal, BodyMetrics, CurrentStrength } from '../types';

const STORAGE_KEY = 'rebld:onboarding:state';
const EXPIRY_HOURS = 24;

// All onboarding state in one object
export interface OnboardingState {
  // Step tracking
  currentStep: string;
  startedAt: number;

  // Core essentials (Step 2)
  goal: string | null;
  experience: string | null;
  frequency: string | null;

  // Setup (Step 3)
  equipment: string;
  sessionLength: string;

  // Customize (Step 4)
  painPoints: string[];
  sport: string;

  // Advanced data
  trainingSplit: TrainingSplit;
  specificGoal: SpecificGoal | null;
  bodyMetrics: BodyMetrics | null;
  userSex: 'male' | 'female' | 'other' | undefined;
  userAge: number | undefined;
  currentStrength: CurrentStrength;

  // Custom plan import
  rawText: string;
}

const DEFAULT_STATE: OnboardingState = {
  currentStep: 'welcome',
  startedAt: Date.now(),
  goal: null,
  experience: null,
  frequency: null,
  equipment: '',
  sessionLength: '60',
  painPoints: [],
  sport: '',
  trainingSplit: {
    sessions_per_day: '1',
    training_type: 'combined'
  },
  specificGoal: null,
  bodyMetrics: null,
  userSex: undefined,
  userAge: undefined,
  currentStrength: {},
  rawText: '',
};

interface UseOnboardingPersistenceReturn {
  // State
  state: OnboardingState;
  isRestored: boolean;
  hasExistingSession: boolean;

  // Setters (update individual fields)
  updateState: (partial: Partial<OnboardingState>) => void;

  // Actions
  clearState: () => void;
  startFresh: () => void;
}

export function useOnboardingPersistence(userId?: string): UseOnboardingPersistenceReturn {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [isRestored, setIsRestored] = useState(false);
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const isInitialMount = useRef(true);

  // Storage key includes userId for multi-user support
  const storageKey = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as OnboardingState;

        // Check if expired (older than 24 hours)
        const hoursOld = (Date.now() - parsed.startedAt) / (1000 * 60 * 60);
        if (hoursOld > EXPIRY_HOURS) {
          // Expired - clear and start fresh
          localStorage.removeItem(storageKey);
          setIsRestored(true);
          return;
        }

        // Valid session found - check if it's in progress
        const isInProgress = parsed.currentStep !== 'welcome' ||
                             parsed.goal !== null ||
                             parsed.experience !== null;

        setHasExistingSession(isInProgress);

        // Restore the state
        setState(parsed);
        setIsRestored(true);
      } else {
        setIsRestored(true);
      }
    } catch (e) {
      console.error('[useOnboardingPersistence] Failed to restore state:', e);
      localStorage.removeItem(storageKey);
      setIsRestored(true);
    }
  }, [storageKey]);

  // Save state to localStorage whenever it changes (after initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!isRestored) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.error('[useOnboardingPersistence] Failed to save state:', e);
    }
  }, [state, storageKey, isRestored]);

  // Update state partially
  const updateState = useCallback((partial: Partial<OnboardingState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  // Clear all state (on completion or explicit clear)
  const clearState = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState(DEFAULT_STATE);
    setHasExistingSession(false);
  }, [storageKey]);

  // Start fresh (clear and reset timestamp)
  const startFresh = useCallback(() => {
    const freshState = { ...DEFAULT_STATE, startedAt: Date.now() };
    setState(freshState);
    setHasExistingSession(false);
    localStorage.setItem(storageKey, JSON.stringify(freshState));
  }, [storageKey]);

  return {
    state,
    isRestored,
    hasExistingSession,
    updateState,
    clearState,
    startFresh,
  };
}

export default useOnboardingPersistence;
