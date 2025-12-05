import React from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

/**
 * Exercise Explanation Caching Service
 * Checks Convex cache before calling Gemini API
 */

/**
 * Hook to get cached exercise explanation from Convex
 * Returns the explanation if cached, null otherwise
 */
export const useCachedExplanation = (exerciseName: string) => {
  const cached = useQuery(
    api.queries.getCachedExercise,
    exerciseName ? { exerciseName } : "skip"
  );
  const updateAccess = useMutation(api.mutations.updateCachedExerciseAccess);
  const cacheExplanation = useMutation(api.mutations.cacheExerciseExplanation);

  const getCachedExplanation = async (): Promise<string | null> => {
    if (!cached) return null;

    // Update hit count and last accessed
    try {
      await updateAccess({ exerciseName });
    } catch (error) {
      console.error('Error updating cached exercise access:', error);
    }

    return cached.explanation || null;
  };

  const cacheExplanationLocal = async (
    explanation: string,
    source: 'gemini_ultra' | 'gemini_api' = 'gemini_api'
  ) => {
    try {
      await cacheExplanation({
        exerciseName,
        explanation,
        source,
      });
    } catch (error) {
      console.error('Error caching explanation:', error);
    }
  };

  return { getCachedExplanation, cacheExplanationLocal, cached };
};

/**
 * Get exercise explanation with caching (hook version)
 * Checks cache first, falls back to API
 */
export const useExerciseExplanationWithCache = (
  exerciseName: string,
  exerciseNotes?: string
) => {
  const { getCachedExplanation, cacheExplanationLocal } = useCachedExplanation(exerciseName);
  const [explanation, setExplanation] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchExplanation = async () => {
      setLoading(true);
      
      // Try cache first
      const cached = await getCachedExplanation();
      if (cached) {
        console.log(`Cache HIT for: ${exerciseName}`);
        setExplanation(cached);
        setLoading(false);
        return;
      }

      console.log(`Cache MISS for: ${exerciseName} - calling API`);

      // Not cached - call Gemini API
      const apiExplanation = await explainExercise(exerciseName, exerciseNotes);

      // Cache it for next time
      await cacheExplanationLocal(apiExplanation, 'gemini_api');

      setExplanation(apiExplanation);
      setLoading(false);
    };

    if (exerciseName) {
      fetchExplanation();
    }
  }, [exerciseName, exerciseNotes]);

  return { explanation, loading };
};

// Legacy functions removed - use hooks instead:
// - useCachedExplanation for getting/setting cached explanations
// - useExerciseExplanationWithCache for fetching with cache
