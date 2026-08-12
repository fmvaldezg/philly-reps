/**
 * Zod schemas for the U.S. Census Geocoder `geographies/onelineaddress` response.
 *
 * The geography keys embed a Congress number and a vintage year (e.g.
 * "119th Congressional Districts", "2024 State Legislative Districts - Upper")
 * and WILL change after redistricting. We capture `geographies` as a record
 * and match by prefix in the resolver — not by exact key equality.
 *
 * The Census geocoder returns coordinates as `{ x, y }` where x = lng, y = lat.
 * The schema validates the raw shape; conversion to {@link LngLat} happens at
 * the boundary in the geocoder client (step 3).
 */

import { z } from "zod";

/** Census geocoder base URL. */
export const CENSUS_BASE_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";

/** Raw Census coordinate pair. x = longitude, y = latitude. */
export const CensusCoordinatesSchema = z.object({
  x: z.number(),
  y: z.number(),
});

/**
 * `geographies` is a record keyed by layer name. Each value is a non-empty
 * array of feature-ish objects whose shape varies per layer. We keep values
 * permissive here; the resolver narrows by key prefix.
 */
export const CensusGeographiesSchema = z.record(
  z.string(),
  z.array(z.record(z.string(), z.unknown())),
);

export const CensusAddressMatchSchema = z.object({
  coordinates: CensusCoordinatesSchema,
  matchedAddress: z.string(),
  // We don't consume tigerline or addressComponents — keep permissive so the
  // schema doesn't break on Census field variations.
  tigerline: z.unknown().optional(),
  addressComponents: z.unknown().optional(),
  geographies: CensusGeographiesSchema,
});

export const CensusGeocodeResponseSchema = z.object({
  result: z.object({
    addressMatches: z.array(CensusAddressMatchSchema),
    input: z
      .object({
        // Census nests the address in an object: { address: { address: "..." } } }.
        // Keep permissive — we don't consume input.
        address: z.unknown().optional(),
        vintage: z.unknown().optional(),
        benchmark: z.unknown().optional(),
      })
      .optional(),
  }),
});

export type CensusCoordinates = z.infer<typeof CensusCoordinatesSchema>;
export type CensusGeographies = z.infer<typeof CensusGeographiesSchema>;
export type CensusAddressMatch = z.infer<typeof CensusAddressMatchSchema>;
export type CensusGeocodeResponse = z.infer<typeof CensusGeocodeResponseSchema>;

/**
 * Prefixes for the geography keys we care about. Match keys with
 * `startsWith`, never exact equality — the embedded Congress number and
 * vintage year change.
 */
export const CONGRESS_GEOGRAPHY_PREFIX = "Congressional Districts";
export const STATE_SENATE_GEOGRAPHY_PREFIX =
  "State Legislative Districts - Upper";
export const STATE_HOUSE_GEOGRAPHY_PREFIX =
  "State Legislative Districts - Lower";
