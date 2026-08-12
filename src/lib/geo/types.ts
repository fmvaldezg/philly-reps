/**
 * Coordinate + GeoJSON-ish types for `src/lib/`.
 *
 * Coordinates are `[lng, lat]` everywhere, matching GeoJSON. The Census geocoder
 * returns `{ x, y }` (x = lng, y = lat) — convert at the network boundary,
 * never pass raw API shapes inward.
 */

import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from "geojson";

export type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Point,
  Polygon,
  Position,
};

/**
 * Branded `[lng, lat]` tuple. Construct only via {@link asLngLat}, which validates
 * ranges, so a raw `number[]` can't be passed where a coordinate is expected.
 */
export type LngLat = readonly [number, number] & {
  readonly __lngLat: unique symbol;
};

const LNG_RANGE = 180;
const LAT_RANGE = 90;

export function asLngLat(lng: number, lat: number): LngLat {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new RangeError(
      `LngLat requires finite numbers, got [${lng}, ${lat}]`,
    );
  }
  if (lng < -LNG_RANGE || lng > LNG_RANGE) {
    throw new RangeError(`longitude ${lng} out of range [-180, 180]`);
  }
  if (lat < -LAT_RANGE || lat > LAT_RANGE) {
    throw new RangeError(`latitude ${lat} out of range [-90, 90]`);
  }
  return [lng, lat] as unknown as LngLat;
}

/** GeoJSON-style bounding box: `[west, south, east, north]` in lng/lat. */
export type BBox = readonly [number, number, number, number];

export function isLngLat(u: unknown): u is LngLat {
  if (!Array.isArray(u) || u.length !== 2) return false;
  const [a, b] = u as readonly unknown[];
  return typeof a === "number" && typeof b === "number";
}
