/**
 * Web fetch wrapper — rewrites Census geocoder URLs to the local proxy.
 *
 * Metro resolves this file for web builds. Native builds resolve
 * `fetch.ts` (passthrough). Vitest resolves `fetch.ts` (tests inject stubs).
 *
 * The proxy at `/api/geocode` forwards to the Census API. This module
 * simply rewrites the URL; it holds no state and makes no decisions.
 */

import type { FetchFn } from "../geo/geocode.ts";
import { CENSUS_BASE_URL } from "../geo/census.ts";

/**
 * Default fetch for web. Rewrites Census URLs to `/api/geocode` before
 * calling the global `fetch`. All other URLs pass through unchanged.
 */
export const defaultFetch: FetchFn = async (url, init) => {
  let target = url;
  if (url.startsWith(CENSUS_BASE_URL)) {
    // Replace the Census base with the proxy path, preserving the query string.
    const query = url.slice(CENSUS_BASE_URL.length);
    target = `/api/geocode${query}`;
  }
  const response = await fetch(target, init);
  return {
    status: response.status,
    text: () => response.text(),
  };
};
