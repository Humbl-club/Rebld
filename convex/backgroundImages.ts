import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Background Images - Admin-only file storage for page backgrounds
 *
 * Pages supported: "home", "goals", "profile", "auth", "onboarding"
 */

// Valid page targets
const VALID_PAGES = ["home", "goals", "profile", "auth", "onboarding"] as const;
type PageTarget = typeof VALID_PAGES[number];

/**
 * Generate upload URL - Admin only
 * Client uploads directly to this URL, then calls saveBackgroundImage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Get user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Must be logged in");
    }

    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Forbidden: Admin access required");
    }

    // Generate the upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save background image metadata after upload
 */
export const saveBackgroundImage = mutation({
  args: {
    storageId: v.id("_storage"),
    pageTarget: v.string(),
    name: v.string(),
    setActive: v.optional(v.boolean()),
    opacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Must be logged in");
    }

    // Admin check
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Forbidden: Admin access required");
    }

    // Validate page target
    if (!VALID_PAGES.includes(args.pageTarget as PageTarget)) {
      throw new Error(`Invalid page target. Must be one of: ${VALID_PAGES.join(", ")}`);
    }

    // If setting as active, deactivate others for this page
    if (args.setActive !== false) {
      const existingActive = await ctx.db
        .query("backgroundImages")
        .withIndex("by_pageTarget", (q) => q.eq("pageTarget", args.pageTarget))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const bg of existingActive) {
        await ctx.db.patch(bg._id, { isActive: false });
      }
    }

    // Save the new background
    const id = await ctx.db.insert("backgroundImages", {
      storageId: args.storageId,
      pageTarget: args.pageTarget,
      name: args.name,
      isActive: args.setActive !== false,
      opacity: args.opacity ?? 0.7,
      uploadedAt: new Date().toISOString(),
      uploadedBy: identity.subject,
    });

    return { id, success: true };
  },
});

/**
 * Get active background for a specific page
 * Returns the URL and opacity settings
 */
export const getActiveBackground = query({
  args: {
    pageTarget: v.string(),
  },
  handler: async (ctx, args) => {
    const background = await ctx.db
      .query("backgroundImages")
      .withIndex("by_pageTarget", (q) => q.eq("pageTarget", args.pageTarget))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!background) {
      return null;
    }

    // Get the file URL
    const url = await ctx.storage.getUrl(background.storageId);

    return {
      url,
      opacity: background.opacity ?? 0.7,
      name: background.name,
    };
  },
});

/**
 * Get all backgrounds for admin management
 */
export const getAllBackgrounds = query({
  args: {},
  handler: async (ctx) => {
    const backgrounds = await ctx.db.query("backgroundImages").collect();

    // Get URLs for all backgrounds
    const withUrls = await Promise.all(
      backgrounds.map(async (bg) => {
        const url = await ctx.storage.getUrl(bg.storageId);
        return {
          ...bg,
          url,
        };
      })
    );

    return withUrls;
  },
});

/**
 * Toggle background active state
 */
export const toggleBackgroundActive = mutation({
  args: {
    backgroundId: v.id("backgroundImages"),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Admin check
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Forbidden: Admin access required");
    }

    const background = await ctx.db.get(args.backgroundId);
    if (!background) {
      throw new Error("Background not found");
    }

    const newActiveState = !background.isActive;

    // If activating, deactivate others for this page
    if (newActiveState) {
      const existingActive = await ctx.db
        .query("backgroundImages")
        .withIndex("by_pageTarget", (q) => q.eq("pageTarget", background.pageTarget))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const bg of existingActive) {
        if (bg._id !== args.backgroundId) {
          await ctx.db.patch(bg._id, { isActive: false });
        }
      }
    }

    await ctx.db.patch(args.backgroundId, { isActive: newActiveState });

    return { success: true, isActive: newActiveState };
  },
});

/**
 * Update background opacity
 */
export const updateBackgroundOpacity = mutation({
  args: {
    backgroundId: v.id("backgroundImages"),
    opacity: v.number(),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Admin check
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Forbidden: Admin access required");
    }

    // Validate opacity (0-1)
    const opacity = Math.max(0, Math.min(1, args.opacity));

    await ctx.db.patch(args.backgroundId, { opacity });

    return { success: true };
  },
});

/**
 * Delete a background image
 */
export const deleteBackgroundImage = mutation({
  args: {
    backgroundId: v.id("backgroundImages"),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Admin check
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Forbidden: Admin access required");
    }

    const background = await ctx.db.get(args.backgroundId);
    if (!background) {
      throw new Error("Background not found");
    }

    // Delete the file from storage
    await ctx.storage.delete(background.storageId);

    // Delete the database record
    await ctx.db.delete(args.backgroundId);

    return { success: true };
  },
});
