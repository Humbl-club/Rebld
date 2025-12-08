/**
 * Scheduled Jobs for REBLD
 *
 * Handles background tasks that run on a schedule, including:
 * - Weekly plan generation for periodized training
 * - Data cleanup
 * - Analytics aggregation
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Check for users who need their next week generated
 * Runs every Monday at 5:00 AM UTC
 *
 * This ensures users wake up Monday with their new week ready
 */
crons.weekly(
  "generate-next-week-plans",
  { dayOfWeek: "monday", hourUTC: 5, minuteUTC: 0 },
  internal.periodizationJobs.checkAndGenerateNextWeeks
);

/**
 * Daily check for users approaching week end
 * Runs every day at 6:00 AM UTC
 *
 * Catches users who might be mid-week or in different timezones
 */
crons.daily(
  "daily-week-check",
  { hourUTC: 6, minuteUTC: 0 },
  internal.periodizationJobs.dailyWeekCheck
);

export default crons;
