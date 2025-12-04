import { useQuery, useMutation } from "convex/react";
import { useUser } from '@clerk/clerk-react';
import { api } from "../convex/_generated/api";
import { WorkoutLog } from '../types';

// Omit 'id' and 'date' because Convex will generate them
type NewLog = Omit<WorkoutLog, 'id' | 'date'>;

// Return type for addLog - includes success status
interface AddLogResult {
    success: boolean;
    error?: string;
}

export default function useWorkoutLogs() {
    const { user } = useUser();
    const userId = user?.id || null;

    const logsResult = useQuery(
        api.queries.getWorkoutLogs,
        userId ? { userId, limit: 100 } : "skip" // Fetch up to 100 logs
    );
    const addLogMutation = useMutation(api.mutations.addWorkoutLog);

    const addLog = async (newLog: NewLog): Promise<AddLogResult> => {
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        // Guard: Ensure focus is a valid non-empty string
        const focus = newLog.focus;
        if (!focus || typeof focus !== 'string' || !focus.trim()) {
            const error = "Failed to save workout: missing workout name";
            console.error(error, { focus, newLog });
            return { success: false, error };
        }

        // Guard: Ensure exercises array exists
        if (!newLog.exercises || !Array.isArray(newLog.exercises)) {
            const error = "Failed to save workout: no exercises recorded";
            console.error(error, { exercises: newLog.exercises });
            return { success: false, error };
        }

        try {
            await addLogMutation({
                userId,
                focus: focus.trim(),
                exercises: newLog.exercises,
                durationMinutes: newLog.durationMinutes || undefined,
            });
            return { success: true };
        } catch (e) {
            const error = "Failed to save workout to database";
            console.error(error, e);
            return { success: false, error };
        }
    };

    // Handle paginated result from Convex
    // The query returns { page: [...], isDone: boolean, continueCursor: string }
    const rawLogs = logsResult?.page || logsResult || [];

    // Convert Convex logs to WorkoutLog format
    const formattedLogs: WorkoutLog[] = Array.isArray(rawLogs) ? rawLogs.map((log: any) => ({
        id: log._id,
        date: log.date,
        focus: log.focus,
        exercises: log.exercises,
        durationMinutes: log.durationMinutes || undefined,
    })) : [];

    const logsLoaded = logsResult !== undefined || !userId;

    return {
        logs: formattedLogs,
        addLog,
        logsLoaded
    };
}
