import { useQuery, useMutation } from "convex/react";
import { useUser } from '@clerk/clerk-react';
import { api } from "../convex/_generated/api";
import { WorkoutPlan } from '../types';
import { Id } from "../convex/_generated/dataModel";
// NOTE: saveExercisesFromExtractedList disabled - causes 200+ client-side Gemini API errors
// import { saveExercisesFromExtractedList } from '../services/exerciseDatabaseService';
import useUserProfile from './useUserProfile';

export default function useWorkoutPlan() {
    const { user } = useUser();
    const userId = user?.id || null;
    const { userProfile } = useUserProfile();
    
    const allPlans = useQuery(
        api.queries.getWorkoutPlans,
        userId ? { userId } : "skip"
    );
    const activePlan = useQuery(
        api.queries.getActivePlan,
        userId ? { userId } : "skip"
    );
    const createPlanMutation = useMutation(api.mutations.createWorkoutPlan);
    const updatePlanMutation = useMutation(api.mutations.updateWorkoutPlan);
    const deletePlanMutation = useMutation(api.mutations.deleteWorkoutPlan);
    const setActivePlanMutation = useMutation(api.mutations.setActivePlan);
    const cacheExerciseMutation = useMutation(api.mutations.cacheExerciseExplanation);
    const updateSportBucketMutation = useMutation(api.sportBucketMutations.updateSportBucket);
    const incrementPlanUsageMutation = useMutation(api.mutations.incrementPlanUsage);

    const setActivePlan = async (planId: Id<"workoutPlans">) => {
        if (!userId) return;
        
        try {
            await setActivePlanMutation({ userId, planId });
        } catch (error) {
            console.error("Error setting active plan:", error);
        }
    };

    // Normalize plan data to ensure it matches Convex schema exactly
    // This creates a clean structure that matches Convex validators precisely
    // Handles both single-session days (blocks) and 2x daily training (sessions)
    const normalizePlanForConvex = (plan: Omit<WorkoutPlan, 'id' | 'createdAt'>) => {
        // Helper to normalize a single block
        const normalizeBlock = (block: any, blockIndex: number, totalBlocks: number) => {
            const exercises = (block.exercises || []).map((ex: any) => {
                // Infer category if missing (fallback for AI inconsistency)
                let category = ex.category;
                if (!category) {
                    const exerciseName = ex.exercise_name?.toLowerCase() || '';
                    const isWarmup = exerciseName.includes('stretch') ||
                                    exerciseName.includes('warmup') ||
                                    exerciseName.includes('mobility') ||
                                    exerciseName.includes('activation') ||
                                    exerciseName.includes('cat-cow') ||
                                    exerciseName.includes('foam roll') ||
                                    exerciseName.includes('band pull') ||
                                    exerciseName.includes('circle') ||
                                    blockIndex === 0;

                    const isCooldown = exerciseName.includes('cooldown') ||
                                      exerciseName.includes('static stretch') ||
                                      blockIndex === totalBlocks - 1;

                    category = isWarmup ? 'warmup' : (isCooldown ? 'cooldown' : 'main');
                }

                return {
                    exercise_name: ex.exercise_name,
                    category: category,
                    metrics_template: ex.metrics_template,
                    notes: ex.notes !== undefined && ex.notes !== null ? ex.notes : null,
                    original_exercise_name: ex.original_exercise_name !== undefined && ex.original_exercise_name !== null
                        ? ex.original_exercise_name
                        : null,
                    rpe: ex.rpe !== undefined && ex.rpe !== null ? ex.rpe : null,
                };
            });

            // Build block based on type
            const baseBlock: any = {
                type: block.type || 'single',
                title: block.title !== undefined && block.title !== null ? block.title : null,
                exercises: exercises,
            };

            // Add type-specific fields
            if (block.type === 'superset') {
                baseBlock.rounds = block.rounds;
            } else if (block.type === 'amrap') {
                baseBlock.duration_minutes = block.duration_minutes;
            }

            return baseBlock;
        };

        // Helper to normalize a session (for 2x daily training)
        const normalizeSession = (session: any) => {
            const blocks = (session.blocks || []).map((block: any, idx: number) =>
                normalizeBlock(block, idx, session.blocks?.length || 0)
            );

            return {
                session_name: session.session_name || null,
                time_of_day: session.time_of_day || null,
                estimated_duration: session.estimated_duration || null,
                blocks: blocks,
            };
        };

        return {
            name: plan.name,
            weeklyPlan: plan.weeklyPlan.map(day => {
                const dayData: any = {
                    day_of_week: day.day_of_week,
                    focus: day.focus,
                    notes: day.notes !== undefined && day.notes !== null ? day.notes : null,
                };

                // Check if this is a 2x daily training day (has sessions array)
                const sessions = (day as any).sessions;
                if (sessions && Array.isArray(sessions) && sessions.length > 0) {
                    // 2x daily training: normalize sessions
                    dayData.sessions = sessions.map(normalizeSession);
                    // Set blocks to empty array for 2x daily days
                    dayData.blocks = [];
                } else {
                    // Single session day: normalize blocks directly
                    dayData.blocks = (day.blocks || []).map((block: any, idx: number) =>
                        normalizeBlock(block, idx, day.blocks?.length || 0)
                    );
                }

                return dayData;
            }),
            dailyRoutine: plan.dailyRoutine || null,
        };
    };

    const addPlan = async (newPlanData: Omit<WorkoutPlan, 'id' | 'createdAt'>) => {
        if (!userId) return;
        
        try {
            // Normalize the plan to ensure schema compliance - single normalization pass
            const normalizedPlan = normalizePlanForConvex(newPlanData);
            
            // Debug: Log first block structure to verify it matches schema
            if (normalizedPlan.weeklyPlan[0]?.blocks[0]) {
                console.log("First block structure:", JSON.stringify(normalizedPlan.weeklyPlan[0].blocks[0], null, 2));
            }
            
            const result = await createPlanMutation({
                userId,
                name: normalizedPlan.name,
                weeklyPlan: normalizedPlan.weeklyPlan as any,
                dailyRoutine: normalizedPlan.dailyRoutine || undefined,
            });

            // Track plan generation for rate limiting
            await incrementPlanUsageMutation({ userId });

            // Extract exercises is now done server-side - use the returned exercises
            const planId = result.planId;
            const extractedExercises = result.extractedExercises || [];
            
            // After plan is saved, save all exercises to database with explanations
            // This builds the exercise database over time
            // Run in background (don't block plan creation)
            const planWithId: WorkoutPlan = {
                ...normalizedPlan,
                id: planId,
                createdAt: new Date().toISOString(),
            };
            
            // NOTE: Automatic exercise saving with explanations disabled.
            // The saveExercisesFromExtractedList function calls Gemini API for each exercise,
            // which causes 200+ errors when API key isn't available client-side.
            // Exercise explanations can be fetched on-demand via getExerciseExplanation query.
            // TODO: Move to backend Convex action if automatic saving is needed.
            //
            // if (extractedExercises.length > 0) {
            //     saveExercisesFromExtractedList(extractedExercises, cacheExerciseMutation).catch(error => {
            //         console.error("Failed to save exercises to database:", error);
            //     });
            // }
            console.log(`📝 Plan created with ${extractedExercises.length} exercises (explanation caching disabled)`)
            
            // Save to sport buckets if user has sport-specific training
            if (userProfile?.trainingPreferences?.sport_specific && userId) {
                savePlanToSportBuckets(planWithId, userProfile.trainingPreferences.sport_specific).catch(error => {
                    console.error("Failed to save to sport buckets:", error);
                    // Don't throw - this is optional optimization
                });
            }
            
            // Plan is automatically set as active when created
            return planId;
        } catch (error) {
            console.error("Error adding new plan:", error);
            // Log the normalized plan structure for debugging
            try {
                const normalizedPlan = normalizePlanForConvex(newPlanData);
                console.error("Normalized plan structure:", JSON.stringify(normalizedPlan.weeklyPlan[0]?.blocks[0], null, 2));
            } catch (e) {
                console.error("Could not log normalized plan:", e);
            }
            throw error; // Re-throw so caller can handle it
        }
    };
    
    // Save plan exercises to sport buckets for intelligent selection
    // Handles both single-session days (blocks) and 2x daily training (sessions)
    const savePlanToSportBuckets = async (plan: WorkoutPlan, sport: string) => {
        if (!userId) return;

        // Helper to save exercises from blocks
        const saveExercisesFromBlocks = async (blocks: any[]) => {
            for (const block of blocks) {
                for (const exercise of block.exercises || []) {
                    try {
                        await updateSportBucketMutation({
                            sport,
                            exercise_name: exercise.exercise_name,
                            category: exercise.category || 'main',
                            placement: exercise.category || 'main',
                            userId,
                        });
                    } catch (error) {
                        console.error(`Failed to save ${exercise.exercise_name} to sport bucket:`, error);
                        // Continue with other exercises
                    }
                }
            }
        };

        for (const day of plan.weeklyPlan) {
            // Handle 2x daily training (sessions array)
            const sessions = (day as any).sessions;
            if (sessions && Array.isArray(sessions) && sessions.length > 0) {
                for (const session of sessions) {
                    if (session.blocks) {
                        await saveExercisesFromBlocks(session.blocks);
                    }
                }
            }
            // Handle single session day (blocks array)
            if (day.blocks && day.blocks.length > 0) {
                await saveExercisesFromBlocks(day.blocks);
            }
        }
    };
    
    const updatePlan = async (updatedPlan: WorkoutPlan) => {
        if (!updatedPlan.id || !userId) return;
        
        try {
            await updatePlanMutation({
                userId,
                planId: updatedPlan.id as Id<"workoutPlans">,
                name: updatedPlan.name,
                weeklyPlan: updatedPlan.weeklyPlan,
                dailyRoutine: updatedPlan.dailyRoutine || undefined,
            });
        } catch(error) {
            console.error("Error updating plan:", error);
        }
    };

    const deletePlan = async (planId: Id<"workoutPlans">) => {
        if (!userId) return;
        
        try {
            await deletePlanMutation({ userId, planId });
        } catch (error) {
            console.error("Error deleting plan:", error);
        }
    };

    // Convert Convex plans to WorkoutPlan format
    const plans: WorkoutPlan[] | null = allPlans && Array.isArray(allPlans) ? allPlans.map(plan => ({
        id: plan._id,
        name: plan.name,
        weeklyPlan: plan.weeklyPlan,
        dailyRoutine: plan.dailyRoutine || undefined,
        createdAt: plan.createdAt,
    })) : null;

    const activePlanFormatted: WorkoutPlan | null = activePlan ? {
        id: activePlan._id,
        _id: activePlan._id, // Required for Chatbot to send messages
        name: activePlan.name,
        weeklyPlan: activePlan.weeklyPlan,
        dailyRoutine: activePlan.dailyRoutine || undefined,
        createdAt: activePlan.createdAt,
    } : null;

    const planLoaded = (allPlans !== undefined && activePlan !== undefined) || !userId;

    return { 
        allPlans: plans, 
        activePlan: activePlanFormatted, 
        addPlan, 
        updatePlan, 
        deletePlan, 
        setActivePlan, 
        planLoaded 
    };
}
