/**
 * Offline district resolution: point-in-polygon against bundled GeoJSON.
 *
 * The whole app works offline after the geocode. No API keys, no rate limits,
 * results in milliseconds. Bounding-box prefilter before the polygon test.
 *
 * Coordinates are [lng, lat] everywhere (GeoJSON convention). The resolver
 * never calls a network — it reads bundled files from assets/districts/.
 */

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from "geojson";

import { err, ok, type Result } from "../result.ts";
import { type LngLat } from "../geo/types.ts";
import { districtLayers } from "./registry.ts";
import type { DistrictLayer, ResolvedDistrict } from "./types.ts";

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

/**
 * In-memory cache of loaded layers. Keyed by geometryPath so a layer is
 * parsed once per process. Tests can clear it with {@link clearLayerCache}.
 */
const layerCache = new Map<string, FeatureCollection<Polygon | MultiPolygon>>();

/**
 * Resolve a layer's geometryPath (project-relative) to an absolute path.
 * geometryPath is like "assets/districts/council.geojson"; we anchor it to
 * the project root (two levels up from this file: src/lib/districts -> root).
 */
function resolveGeometryPath(geometryPath: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(here, "..", "..", "..");
  return join(projectRoot, geometryPath);
}

/** Load a layer's GeoJSON from disk. Cached per process. */
export function loadLayer(
  layer: DistrictLayer,
): FeatureCollection<Polygon | MultiPolygon> {
  const cached = layerCache.get(layer.geometryPath);
  if (cached) return cached;

  const absPath = resolveGeometryPath(layer.geometryPath);
  const raw = readFileSync(absPath, "utf8");
  const fc = JSON.parse(raw) as FeatureCollection<Polygon | MultiPolygon>;
  layerCache.set(layer.geometryPath, fc);
  return fc;
}

export function clearLayerCache(): void {
  layerCache.clear();
}

/** Bounding box of a feature's coordinates, [west, south, east, north]. */
function featureBBox(
  feature: Feature<Polygon | MultiPolygon>,
): [number, number, number, number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const geom = feature.geometry;
  if (!geom) return [0, 0, 0, 0];

  // Walk every position in every ring. Polygon: Position[][]; MultiPolygon:
  // Position[][][]. Position is `number | Position[]` per @types/geojson, so we
  // recurse until we hit a number.
  const visit = (pos: unknown): void => {
    if (typeof pos === "number") return;
    if (!Array.isArray(pos)) return;
    if (pos.length === 0) return;
    // If the first element is a number, this is a coordinate pair.
    if (typeof pos[0] === "number") {
      const lng = pos[0] as number;
      const lat = pos[1] as number | undefined;
      if (lat !== undefined) {
        if (lng < west) west = lng;
        if (lat < south) south = lat;
        if (lng > east) east = lng;
        if (lat > north) north = lat;
      }
      return;
    }
    // Otherwise it's a nested array — recurse.
    for (const child of pos) visit(child);
  };

  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) for (const pos of ring) visit(pos);
  } else {
    for (const poly of geom.coordinates)
      for (const ring of poly) for (const pos of ring) visit(pos);
  }
  return [west, south, east, north];
}

function inBBox(
  point: LngLat,
  bbox: [number, number, number, number],
): boolean {
  const [lng, lat] = point;
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
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

  let fc: FeatureCollection<Polygon | MultiPolygon>;
  try {
    fc = loadLayer(layer);
  } catch (e) {
    return err({
      kind: "layer-load-failed",
      layerId: layer.id,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  const pt: { type: "Point"; coordinates: [number, number] } = {
    type: "Point",
    coordinates: [point[0], point[1]],
  };

  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    // Bounding-box prefilter before the (more expensive) polygon test.
    const bbox = featureBBox(feature as Feature<Polygon | MultiPolygon>);
    if (!inBBox(point, bbox)) continue;

    if (booleanPointInPolygon(pt, feature as Feature<Polygon | MultiPolygon>)) {
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

  let fc: FeatureCollection<Polygon | MultiPolygon>;
  try {
    fc = loadLayer(boundaryLayer);
  } catch (e) {
    return err({
      kind: "layer-load-failed",
      layerId: "city-limits",
      message: e instanceof Error ? e.message : String(e),
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
