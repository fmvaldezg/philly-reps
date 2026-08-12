/**
 * Census geocoder client — the only network call at runtime.
 *
 * Endpoint: geographies/onelineaddress. Returns the coordinate AND the
 * congressional + state legislative districts directly in `geographies`,
 * which we use as a cross-check against the local point-in-polygon result
 * (SPEC.md). The local geometry is authoritative on disagreement.
 *
 * Geography keys embed a Congress number and a vintage year and WILL change
 * after redistricting — match by prefix, never exact equality.
 *
 * The Census geocoder returns coordinates as `{ x, y }` where x = lng, y = lat.
 * Conversion to {@link LngLat} happens here, at the boundary, before any
 * inward code sees the value.
 *
 * Returns Result; throws only on programmer error. Tests do not hit the
 * network — they inject a `fetch` stub.
 */

import { err, ok, type Result } from "../result.ts";
import { asLngLat, type LngLat } from "./types.ts";
import { defaultFetch } from "../net/fetch.ts";
import {
  CensusGeocodeResponseSchema,
  CENSUS_BASE_URL,
  CONGRESS_GEOGRAPHY_PREFIX,
  STATE_HOUSE_GEOGRAPHY_PREFIX,
  STATE_SENATE_GEOGRAPHY_PREFIX,
} from "./census.ts";

export type GeocodeError =
  | { kind: "network"; message: string }
  | { kind: "http"; status: number; body: string }
  | { kind: "malformed"; message: string }
  | { kind: "no-match" }
  | { kind: "out-of-bounds" };

/** A single geocode match, with the coordinate converted to LngLat. */
export interface GeocodeMatch {
  /** [lng, lat] — converted from Census {x, y}. */
  coords: LngLat;
  /** Census-formatted display address, e.g. "1400 JOHN F KENNEDY BLVD, ...". */
  matchedAddress: string;
  /** Cross-check districts from the Census geographies, keyed by our layer ids. */
  geographies: {
    congress: string | null;
    "pa-senate": string | null;
    "pa-house": string | null;
  };
}

export interface GeocodeResult {
  matches: readonly GeocodeMatch[];
}

/**
 * Fetch function type. The real client uses global fetch; tests inject a
 * stub. Kept minimal — just enough for the geocoder.
 */
export type FetchFn = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{ status: number; text: () => Promise<string> }>;

/**
 * Normalize an address string. If the input has no city or state, append
 * "Philadelphia, PA" to help the Census geocoder find the right match.
 */
function normalizeAddress(input: string): string {
  const lower = input.toLowerCase();
  const hasCity = /\bphiladelphia\b|\bphilly\b/.test(lower);
  const hasState = /\bpa\b|\bpennsylvania\b/.test(lower);
  if (hasCity && hasState) return input.trim();
  if (hasCity) return `${input.trim()}, PA`;
  if (hasState) return `${input.trim()}, Philadelphia`;
  return `${input.trim()}, Philadelphia, PA`;
}

/**
 * Find the first geography key matching a prefix and return its district
 * number. Census geography features carry `BASENAME` (the district number
 * as a string, e.g. "3", "182"). Returns null if the key is absent or empty.
 */
function extractDistrict(
  geographies: Record<string, unknown>,
  prefix: string,
): string | null {
  for (const key of Object.keys(geographies)) {
    if (!key.includes(prefix)) continue;
    const value = geographies[key];
    if (!Array.isArray(value) || value.length === 0) continue;
    const first = value[0] as Record<string, unknown> | undefined;
    if (!first) continue;
    const base = first["BASENAME"];
    if (typeof base === "string" && base.length > 0) return base;
  }
  return null;
}

/**
 * Geocode an address. Returns Result; never throws.
 *
 * @param address Free-text address as a user types it.
 * @param fetchFn Injected fetch (defaults to global fetch). Tests stub this.
 * @param options Optional: `inCity` — if provided, matches outside the city
 *   are filtered out. If all matches are outside, returns `out-of-bounds`.
 */
export async function geocode(
  address: string,
  fetchFn: FetchFn = defaultFetch,
  options?: { inCity?: (point: LngLat) => Promise<boolean> },
): Promise<Result<GeocodeResult, GeocodeError>> {
  const normalized = normalizeAddress(address);
  const url = `${CENSUS_BASE_URL}?address=${encodeURIComponent(normalized)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;

  let response: Awaited<ReturnType<FetchFn>>;
  try {
    response = await fetchFn(url);
  } catch (e) {
    return err({
      kind: "network",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  if (response.status !== 200) {
    const body = await response.text();
    return err({ kind: "http", status: response.status, body });
  }

  let raw: unknown;
  try {
    const text = await response.text();
    raw = JSON.parse(text);
  } catch (e) {
    return err({
      kind: "malformed",
      message: e instanceof Error ? e.message : "JSON parse failed",
    });
  }

  const parsed = CensusGeocodeResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return err({
      kind: "malformed",
      message: `schema validation failed: ${parsed.error.message}`,
    });
  }

  const matches: GeocodeMatch[] = [];
  for (const m of parsed.data.result.addressMatches) {
    // Census {x, y} -> LngLat. x = lng, y = lat.
    let coords: LngLat;
    try {
      coords = asLngLat(m.coordinates.x, m.coordinates.y);
    } catch {
      // Skip matches with out-of-range coordinates rather than failing the
      // whole call. Shouldn't happen with Census data, but be defensive.
      continue;
    }

    const geographies = m.geographies as Record<string, unknown>;
    matches.push({
      coords,
      matchedAddress: m.matchedAddress,
      geographies: {
        congress: extractDistrict(geographies, CONGRESS_GEOGRAPHY_PREFIX),
        "pa-senate": extractDistrict(
          geographies,
          STATE_SENATE_GEOGRAPHY_PREFIX,
        ),
        "pa-house": extractDistrict(geographies, STATE_HOUSE_GEOGRAPHY_PREFIX),
      },
    });
  }

  if (matches.length === 0) {
    return err({ kind: "no-match" });
  }

  // If a city-boundary check is provided, filter matches to those inside.
  if (options?.inCity) {
    const inside: GeocodeMatch[] = [];
    for (const m of matches) {
      if (await options.inCity(m.coords)) inside.push(m);
    }
    if (inside.length === 0) {
      return err({ kind: "out-of-bounds" });
    }
    return ok({ matches: inside });
  }

  return ok({ matches });
}
