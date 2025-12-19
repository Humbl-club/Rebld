import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyAuthenticatedUser } from "./utils/accessControl";

/**
 * Updates the AI plan generation status for a user.
 * This is called by the `ai.ts` action to provide real-time feedback to the UI.
 */
export const updateGenerationStatus = mutation({
    args: {
        userId: v.string(),
        state: v.union(v.literal("idle"), v.literal("generating"), v.literal("completed"), v.literal("failed")),
        message: v.optional(v.string()),
        progress: v.optional(v.number()),
        currentStep: v.optional(v.string()),
        planId: v.optional(v.id("workoutPlans")),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // SECURITY: Verify the caller is the user they claim to be or an internal action
        // In this case, it's likely called by the `ai` action which runs as the user
        // We can use verifyAuthenticatedUser to ensure the caller matches the user ID
        await verifyAuthenticatedUser(ctx, args.userId);

        const user = await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        await ctx.db.patch(user._id, {
            generationStatus: {
                state: args.state,
                message: args.message,
                progress: args.progress,
                currentStep: args.currentStep,
                planId: args.planId,
                error: args.error,
                lastUpdated: new Date().toISOString(),
            },
        });
    },
});
