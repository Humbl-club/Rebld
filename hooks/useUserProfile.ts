import { useQuery, useMutation } from "convex/react";
import { useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { api } from "../convex/_generated/api";
import { UserProfile } from '../types';

export default function useUserProfile() {
    const { user } = useUser();
    const userId = user?.id || null;
    
    const userProfile = useQuery(
        api.queries.getUserProfile,
        userId ? { userId } : "skip"
    );
    const updateProfileMutation = useMutation(api.mutations.updateUserProfile);
    const ensureUserExistsMutation = useMutation(api.mutations.ensureUserExists);

    // Automatically create user in Convex if they don't exist
    useEffect(() => {
        if (userId && userProfile === null) {
            // User is signed in but doesn't exist in Convex yet - create them
            ensureUserExistsMutation({ userId }).catch((error) => {
                console.error("Failed to ensure user exists in Convex", error);
            });
        }
    }, [userId, userProfile, ensureUserExistsMutation]);

    const updateUserProfile = async (profileData: Partial<UserProfile> & { activePlanId?: string | null; strengthProfile?: any }) => {
        if (!userId) return;

        try {
            await updateProfileMutation({
                userId,
                activePlanId: profileData.activePlanId !== undefined ? (profileData.activePlanId as any) : undefined,
                lastProgressionApplied: profileData.lastProgressionApplied || undefined,
                bodyMetrics: profileData.bodyMetrics || undefined,
                goals: profileData.goals || undefined,
                trainingPreferences: profileData.trainingPreferences || undefined,
                strengthProfile: profileData.strengthProfile || undefined,
            });
        } catch (e) {
            console.error("Failed to update user profile in Convex", e);
        }
    };

    // Convert Convex user to UserProfile format
    const profile: UserProfile | null = userProfile ? {
        userCode: userProfile.userCode || undefined,
        lastProgressionApplied: userProfile.lastProgressionApplied || undefined,
        bodyMetrics: userProfile.bodyMetrics || undefined,
        goals: userProfile.goals || undefined,
        trainingPreferences: userProfile.trainingPreferences || undefined,
        strengthProfile: userProfile.strengthProfile || undefined,
        apiUsage: userProfile.apiUsage || undefined,
    } : null;

    const profileLoaded = userProfile !== undefined || !userId;

    return { 
        userProfile: profile, 
        updateUserProfile, 
        profileLoaded 
    };
}
