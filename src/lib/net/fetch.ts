/**
 * Network boundary for `src/lib/`. Per AGENTS.md: no `fetch` outside this
 * directory. The geocoder and any future network calls import from here.
 *
 * This module is the ONLY place that touches the global `fetch`. Everything
 * else takes a `FetchFn` and stays testable without network.
 *
 * Metro resolves this file for native builds. Web builds resolve
 * `fetch.web.ts` (URL rewriting for the CORS proxy). Vitest resolves this
 * file (tests inject stubs, so `defaultFetch` isn't exercised, but the
 * import must resolve).
 */

import type { FetchFn } from "../geo/geocode.ts";

/**
 * Default fetch implementation — the global. Wrapped so tests can inject a
 * stub and the rest of `src/lib/` never references `fetch` directly.
 */
export const defaultFetch: FetchFn = async (url, init) => {
  // `fetch` is a Node 20 global and a browser global. We reference it only
  // here, at the boundary.
  const response = await fetch(url, init);
  return {
    status: response.status,
    text: () => response.text(),
  };
};
