/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as achievementMutations from "../achievementMutations.js";
import type * as achievementQueries from "../achievementQueries.js";
import type * as adminQueries from "../adminQueries.js";
import type * as ai from "../ai.js";
import type * as analyticsQueries from "../analyticsQueries.js";
import type * as auth from "../auth.js";
import type * as backgroundImages from "../backgroundImages.js";
import type * as buddyMutations from "../buddyMutations.js";
import type * as buddyQueries from "../buddyQueries.js";
import type * as eventTracking from "../eventTracking.js";
import type * as healthMetrics from "../healthMetrics.js";
import type * as metricsTemplateReference from "../metricsTemplateReference.js";
import type * as mutations from "../mutations.js";
import type * as periodizationJobs from "../periodizationJobs.js";
import type * as photoMutations from "../photoMutations.js";
import type * as photoQueries from "../photoQueries.js";
import type * as planExamples from "../planExamples.js";
import type * as planSchema from "../planSchema.js";
import type * as planValidator from "../planValidator.js";
import type * as populateData from "../populateData.js";
import type * as promptBuilder from "../promptBuilder.js";
import type * as queries from "../queries.js";
import type * as rateLimiter from "../rateLimiter.js";
import type * as rehab_injuryProtocolsData from "../rehab/injuryProtocolsData.js";
import type * as scheduledJobs from "../scheduledJobs.js";
import type * as sportBucketMutations from "../sportBucketMutations.js";
import type * as sportBucketQueries from "../sportBucketQueries.js";
import type * as sportData from "../sportData.js";
import type * as supplementData from "../supplementData.js";
import type * as userCodeMutations from "../userCodeMutations.js";
import type * as utils_accessControl from "../utils/accessControl.js";
import type * as utils_aiHelpers from "../utils/aiHelpers.js";
import type * as utils_constants from "../utils/constants.js";
import type * as utils_errorHandling from "../utils/errorHandling.js";
import type * as utils_logger from "../utils/logger.js";
import type * as utils_pagination from "../utils/pagination.js";
import type * as utils_performanceMetrics from "../utils/performanceMetrics.js";
import type * as utils_periodization from "../utils/periodization.js";
import type * as utils_queryCache from "../utils/queryCache.js";
import type * as utils_rateLimiting from "../utils/rateLimiting.js";
import type * as utils_transactionHelpers from "../utils/transactionHelpers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  achievementMutations: typeof achievementMutations;
  achievementQueries: typeof achievementQueries;
  adminQueries: typeof adminQueries;
  ai: typeof ai;
  analyticsQueries: typeof analyticsQueries;
  auth: typeof auth;
  backgroundImages: typeof backgroundImages;
  buddyMutations: typeof buddyMutations;
  buddyQueries: typeof buddyQueries;
  eventTracking: typeof eventTracking;
  healthMetrics: typeof healthMetrics;
  metricsTemplateReference: typeof metricsTemplateReference;
  mutations: typeof mutations;
  periodizationJobs: typeof periodizationJobs;
  photoMutations: typeof photoMutations;
  photoQueries: typeof photoQueries;
  planExamples: typeof planExamples;
  planSchema: typeof planSchema;
  planValidator: typeof planValidator;
  populateData: typeof populateData;
  promptBuilder: typeof promptBuilder;
  queries: typeof queries;
  rateLimiter: typeof rateLimiter;
  "rehab/injuryProtocolsData": typeof rehab_injuryProtocolsData;
  scheduledJobs: typeof scheduledJobs;
  sportBucketMutations: typeof sportBucketMutations;
  sportBucketQueries: typeof sportBucketQueries;
  sportData: typeof sportData;
  supplementData: typeof supplementData;
  userCodeMutations: typeof userCodeMutations;
  "utils/accessControl": typeof utils_accessControl;
  "utils/aiHelpers": typeof utils_aiHelpers;
  "utils/constants": typeof utils_constants;
  "utils/errorHandling": typeof utils_errorHandling;
  "utils/logger": typeof utils_logger;
  "utils/pagination": typeof utils_pagination;
  "utils/performanceMetrics": typeof utils_performanceMetrics;
  "utils/periodization": typeof utils_periodization;
  "utils/queryCache": typeof utils_queryCache;
  "utils/rateLimiting": typeof utils_rateLimiting;
  "utils/transactionHelpers": typeof utils_transactionHelpers;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
