/**
 * Golden tests: every fixture in fixtures.json must resolve to its expected
 * district. These fixtures are the contract — if a change breaks them, the
 * change is wrong until proven otherwise (AGENTS.md "Done means").
 *
 * Step 2 only covers the council layer. Other layers' expectations are null
 * until their data is built (step 6). The test only checks layers whose
 * expected value is non-null.
 */

import { describe, expect, it } from "vitest";

import { FixturesSchema, type Fixture } from "./fixtures.schema";
import fixturesRaw from "./fixtures.json";
import { resolveDistricts } from "./resolve";
import { asLngLat } from "../geo/types";

const parsed = FixturesSchema.safeParse(fixturesRaw);
if (!parsed.success) {
  throw new Error(`fixtures.json failed schema validation: ${parsed.error}`);
}
const fixtures = parsed.data as Fixture[];

describe("golden fixtures: council district resolution", () => {
  for (const fixture of fixtures) {
    const councilExpected = fixture.expected.council;
    // Skip fixtures that don't assert a council district.
    if (councilExpected === null) continue;

    it(`${fixture.note ?? fixture.address} → council ${councilExpected}`, async () => {
      const point = asLngLat(fixture.coords[0], fixture.coords[1]);
      const result = await resolveDistricts(point);

      // Find the council resolution in the results.
      const councilResult = result.districts.find(
        (d) => "layerId" in d && d.layerId === "council",
      );

      expect(councilResult, "council layer should have resolved").toBeDefined();
      expect(councilResult).toMatchObject({
        layerId: "council",
        districtNumber: councilExpected,
      });
    });
  }
});

describe("golden fixtures: out-of-bounds is reported", () => {
  // A point well outside Philadelphia — in the Atlantic off NJ.
  it("a point far outside the city is not in the city", async () => {
    const point = asLngLat(-74.5, 39.0);
    const result = await resolveDistricts(point);
    expect(result.inCity).toBe(false);
  });
});

describe("golden fixtures: City Hall is in the city", () => {
  it("City Hall is inside the city limits", async () => {
    const point = asLngLat(-75.1653, 39.9526);
    const result = await resolveDistricts(point);
    expect(result.inCity).toBe(true);
  });
});
