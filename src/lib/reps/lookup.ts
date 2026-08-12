/**
 * The lookup orchestrator: address → geocode → resolve districts → reps.
 *
 * This is the pure-TS pipeline the UI calls. It does NOT call fetch directly
 * — the geocoder takes an injected FetchFn. The UI layer (step 4) wires the
 * real fetch from src/lib/net.
 *
 * The "did you mean" confirmation step (SPEC.md user flow #2) is handled by
 * the UI: this module returns the geocode matches, the UI shows them, the
 * user confirms, then the UI calls resolveDistricts with the chosen coord.
 */

import type { Result } from "../result.ts";
import { err, ok } from "../result.ts";
import {
  geocode,
  type GeocodeError,
  type GeocodeMatch,
} from "../geo/geocode.ts";
import type { FetchFn } from "../geo/geocode.ts";
import { isInCity, resolveLayer } from "../districts/resolve.ts";
import { districtLayers } from "../districts/registry.ts";
import type { LngLat } from "../geo/types.ts";
import type { DistrictLayer } from "../districts/types.ts";
import type { Official } from "./types.ts";
import type { LookupResult } from "./types.ts";

// Static imports for rep data files. Metro doesn't support dynamic requires.
import federalRepsRaw from "../../../assets/data/federal.json";
import stateRepsRaw from "../../../assets/data/state.json";
import cityRepsRaw from "../../../data/manual/philly-council.json";

// Type assertions for JSON imports.
const federalReps = federalRepsRaw as readonly Official[];
const stateReps = stateRepsRaw as readonly Official[];
const cityReps = cityRepsRaw as readonly Official[];

export type LookupError = GeocodeError | { kind: "out-of-bounds" };

export interface GeocodeStep {
  matches: readonly GeocodeMatch[];
}

/**
 * Step 1: geocode the address. Returns matches for the UI to show.
 * The UI lets the user confirm which match is right.
 */
export async function geocodeAddress(
  address: string,
  fetchFn: FetchFn,
): Promise<Result<GeocodeStep, LookupError>> {
  const r = await geocode(address, fetchFn);
  if (!r.ok) return err(r.error);
  return ok({ matches: r.value.matches });
}

/**
 * Step 2: resolve districts for a confirmed coordinate and look up reps.
 *
 * Returns the matched address, in-city flag, and the officials that
 * represent this point. Rep data comes from {@link lookupReps} — currently
 * a stub that returns empty (step 7 fills it in).
 */
export async function resolveAndLookup(
  match: GeocodeMatch,
): Promise<LookupResult> {
  const point: LngLat = match.coords;
  const inCityResult = await isInCity(point);
  const inCity = inCityResult.ok ? inCityResult.value : false;

  // Resolve every district layer (skip boundaries).
  const resolved: { layer: DistrictLayer; districtNumber: string | null }[] =
    [];
  for (const layer of districtLayers()) {
    if (layer.kind !== "district") continue;
    const r = await resolveLayer(layer, point);
    if (r.ok) {
      resolved.push({ layer, districtNumber: r.value.districtNumber });
    }
  }

  // Look up reps for the resolved districts. Step 7 fills this in; for now
  // it returns an empty list so the UI can ship with district resolution only.
  const officials = await lookupReps(resolved, inCity);

  return {
    matchedAddress: match.matchedAddress,
    coords: [point[0], point[1]],
    inCity,
    officials,
  };
}

const ALL_REPS: readonly Official[] = [
  ...federalReps,
  ...stateReps,
  ...cityReps,
];

/**
 * Rep lookup. Reads from assets/data/ and matches officials to resolved
 * districts + statewide/citywide offices.
 *
 * Matching logic:
 *   - District-based reps: match by layerId + districtNumber
 *   - Statewide reps (US Senators) and citywide reps (Council at-large):
 *     layerId or districtNumber is missing (null or omitted) — include
 *     whenever the point is in Philadelphia.
 */
async function lookupReps(
  resolved: readonly { layer: DistrictLayer; districtNumber: string | null }[],
  inCity: boolean,
): Promise<readonly Official[]> {
  // Build a map of resolved districts by layerId for fast lookup.
  const resolvedByLayer = new Map<string, string | null>();
  for (const { layer, districtNumber } of resolved) {
    resolvedByLayer.set(layer.id, districtNumber);
  }

  const matched: Official[] = [];
  for (const rep of ALL_REPS) {
    // Statewide / citywide offices have no layer or district — include if
    // the point is in Philadelphia. districtNumber may be omitted entirely
    // (at-large records) rather than explicit null, so check loosely.
    if (rep.office.layerId == null || rep.office.districtNumber == null) {
      if (inCity) matched.push(rep);
      continue;
    }
    // District-based — match layer + district.
    const resolvedDistrict = resolvedByLayer.get(rep.office.layerId);
    if (
      resolvedDistrict !== undefined &&
      resolvedDistrict === rep.office.districtNumber
    ) {
      matched.push(rep);
    }
  }

  return matched;
}
