/**
 * Offline district resolution: point-in-polygon against bundled GeoJSON.
 *
 * The whole app works offline after the geocode. No API keys, no rate limits,
 * results in milliseconds. Bounding-box prefilter before the polygon test.
 *
 * Coordinates are [lng, lat] everywhere (GeoJSON convention). Layer geometry
 * is bundled via static imports (below) so it ships in the web and native
 * bundles the same way `assets/data/*.json` already does — this module must
 * never touch the filesystem, since it runs in the browser and in the native
 * app, not just in Node.
 */

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import bbox from "@turf/bbox";
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from "geojson";

import { err, ok, type Result } from "../result.ts";
import { type LngLat } from "../geo/types.ts";
import { districtLayers } from "./registry.ts";
import type { DistrictId, DistrictLayer, ResolvedDistrict } from "./types.ts";

import cityLimitsGeoJSON from "../../../assets/districts/city-limits.json";
import councilGeoJSON from "../../../assets/districts/council.json";
import congressGeoJSON from "../../../assets/districts/congress.json";
import paSenateGeoJSON from "../../../assets/districts/pa-senate.json";
import paHouseGeoJSON from "../../../assets/districts/pa-house.json";

export type ResolveError =
  | { kind: "out-of-bounds" }
  | { kind: "layer-not-found"; layerId: string }
  | { kind: "layer-load-failed"; layerId: string; message: string }
  | { kind: "no-match"; layerId: string };

export interface ResolveResult {
  /** True if the point is inside the city-limits boundary. */
  inCity: boolean;
  /** One entry per district layer (boundaries excluded). null on error. */
  districts: ReadonlyArray<ResolvedDistrict | ResolveError>;
}

type DistrictFeatureCollection = FeatureCollection<Polygon | MultiPolygon>;

/**
 * Bundled layer geometry, keyed by layer id. Only layers that have been
 * built (`pnpm data:build <id>`) appear here — `getLayerGeoJSON` reports the
 * rest as `layer-load-failed` rather than throwing at import time.
 */
const BUNDLED_GEOJSON: Partial<Record<DistrictId, DistrictFeatureCollection>> =
  {
    "city-limits": cityLimitsGeoJSON as unknown as DistrictFeatureCollection,
    council: councilGeoJSON as unknown as DistrictFeatureCollection,
    congress: congressGeoJSON as unknown as DistrictFeatureCollection,
    "pa-senate": paSenateGeoJSON as unknown as DistrictFeatureCollection,
    "pa-house": paHouseGeoJSON as unknown as DistrictFeatureCollection,
  };

/** Look up a layer's bundled GeoJSON. Also used by the map to draw a polygon. */
export function getLayerGeoJSON(
  layerId: DistrictId,
): DistrictFeatureCollection | undefined {
  return BUNDLED_GEOJSON[layerId];
}

function inBBox(point: LngLat, box: [number, number, number, number]): boolean {
  const [lng, lat] = point;
  return lng >= box[0] && lng <= box[2] && lat >= box[1] && lat <= box[3];
}

/**
 * Resolve a single district layer for a point. Returns the district number
 * from the feature's `districtProperty`, or a no-match error.
 */
export async function resolveLayer(
  layer: DistrictLayer,
  point: LngLat,
): Promise<Result<ResolvedDistrict, ResolveError>> {
  if (layer.kind !== "district" || layer.districtProperty === null) {
    return err({ kind: "layer-not-found", layerId: layer.id });
  }

  const fc = getLayerGeoJSON(layer.id);
  if (!fc) {
    return err({
      kind: "layer-load-failed",
      layerId: layer.id,
      message: "layer not bundled yet — run pnpm data:build",
    });
  }

  const pt: { type: "Point"; coordinates: [number, number] } = {
    type: "Point",
    coordinates: [point[0], point[1]],
  };

  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    const typedFeature = feature as Feature<Polygon | MultiPolygon>;
    // Bounding-box prefilter before the (more expensive) polygon test.
    if (
      !inBBox(point, bbox(typedFeature) as [number, number, number, number])
    ) {
      continue;
    }

    if (booleanPointInPolygon(pt, typedFeature)) {
      const raw = (feature.properties ?? {})[layer.districtProperty];
      const districtNumber =
        raw === null || raw === undefined ? null : String(raw);
      return ok({
        layerId: layer.id,
        level: layer.level,
        districtNumber,
      });
    }
  }

  return err({ kind: "no-match", layerId: layer.id });
}

/**
 * Check whether a point is inside the city-limits boundary.
 */
export async function isInCity(
  point: LngLat,
): Promise<Result<boolean, ResolveError>> {
  const boundaryLayer = districtLayers().find((l) => l.id === "city-limits");
  if (!boundaryLayer) {
    return err({ kind: "layer-not-found", layerId: "city-limits" });
  }

  const fc = getLayerGeoJSON("city-limits");
  if (!fc) {
    return err({
      kind: "layer-load-failed",
      layerId: "city-limits",
      message: "layer not bundled yet — run pnpm data:build",
    });
  }

  const pt = {
    type: "Point" as const,
    coordinates: [point[0], point[1]] as [number, number],
  };
  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    if (booleanPointInPolygon(pt, feature as Feature<Polygon | MultiPolygon>)) {
      return ok(true);
    }
  }
  return ok(false);
}

/**
 * Resolve every district layer for a point. Skips boundary layers.
 * Does NOT short-circuit on out-of-bounds — the caller decides whether to
 * render partial results (SPEC.md says don't, but the resolver reports).
 */
export async function resolveDistricts(point: LngLat): Promise<ResolveResult> {
  const inCityResult = await isInCity(point);
  const inCity = inCityResult.ok ? inCityResult.value : false;

  const districts: Array<ResolvedDistrict | ResolveError> = [];
  for (const layer of districtLayers()) {
    if (layer.kind !== "district") continue;
    const r = await resolveLayer(layer, point);
    districts.push(r.ok ? r.value : r.error);
  }

  return { inCity, districts };
}
