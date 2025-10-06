/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ads_functions from "../ads/functions.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as profile_functions from "../profile/functions.js";
import type * as subscriptions_functions from "../subscriptions/functions.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "ads/functions": typeof ads_functions;
  auth: typeof auth;
  http: typeof http;
  "profile/functions": typeof profile_functions;
  "subscriptions/functions": typeof subscriptions_functions;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
