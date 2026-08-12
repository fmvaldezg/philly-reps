/**
 * Zod schema for the golden address fixtures in `fixtures.json`.
 *
 * Fixtures are the contract — if a change breaks them, the change is wrong
 * until proven otherwise (AGENTS.md "Done means"). Step 1 ships the schema
 * and an empty fixtures file; step 2 fills in hand-verified addresses.
 */

import { z } from "zod";

import type { DistrictId } from "./types";

const districtIds: readonly DistrictId[] = [
  "city-limits",
  "council",
  "congress",
  "pa-senate",
  "pa-house",
];

/**
 * Expected resolution for one layer. `"out-of-bounds"` is the sentinel for
 * the city-limits check failing; a string is a district number; `null` means
 * the layer is at-large / citywide or was not resolved.
 */
export const ExpectedDistrictSchema = z.union([
  z.string(),
  z.literal("out-of-bounds"),
  z.null(),
]);

export const FixtureSchema = z.object({
  /** Free-text address as a user would type it. */
  address: z.string().min(1),
  /** Hand-verified [lng, lat] for the test runner. Tests do not geocode. */
  coords: z.tuple([z.number(), z.number()]),
  /** Expected resolution per layer. Keys are DistrictId values. */
  expected: z.record(
    z.enum(districtIds as [DistrictId, ...DistrictId[]]),
    ExpectedDistrictSchema,
  ),
  /** Where this expectation was hand-verified (URL or tool name). */
  verifiedVia: z.string().optional(),
  note: z.string().optional(),
});

export const FixturesSchema = z.array(FixtureSchema);

export type Fixture = z.infer<typeof FixtureSchema>;
export type ExpectedDistrict = z.infer<typeof ExpectedDistrictSchema>;
