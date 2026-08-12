/**
 * The district registry. The UI iterates this; it does not hardcode layer names.
 *
 * Property names come from DATA-SOURCES.md A1–A5 verified blocks:
 *   - city-limits: A1 (boundary, no district number)
 *   - council:     A2 — `district` (numeric, e.g. 1..10)
 *   - congress:    A3 — `LEG_DISTRI`
 *   - pa-senate:   A4 — `LEG_DISTRICT_NO`
 *   - pa-house:    A5 — `LEG_DISTRI`
 *
 * Geometry paths point at where the bundled simplified GeoJSON WILL live
 * after step 2's data build. The files don't exist yet — that's expected at
 * step 1; the resolver (step 2) is what loads them.
 */

import type { DistrictId, DistrictLayer } from "./types";

export const districtRegistry: readonly DistrictLayer[] = [
  {
    id: "city-limits",
    level: "city",
    kind: "boundary",
    label: "Philadelphia city limits",
    geometryPath: "assets/districts/city-limits.geojson",
    districtProperty: null,
  },
  {
    id: "council",
    level: "city",
    kind: "district",
    label: "Philadelphia City Council",
    geometryPath: "assets/districts/council.geojson",
    districtProperty: "district",
  },
  {
    id: "congress",
    level: "federal",
    kind: "district",
    label: "U.S. House of Representatives",
    geometryPath: "assets/districts/congress.geojson",
    districtProperty: "LEG_DISTRI",
  },
  {
    id: "pa-senate",
    level: "state",
    kind: "district",
    label: "Pennsylvania State Senate",
    geometryPath: "assets/districts/pa-senate.geojson",
    districtProperty: "LEG_DISTRICT_NO",
  },
  {
    id: "pa-house",
    level: "state",
    kind: "district",
    label: "Pennsylvania House of Representatives",
    geometryPath: "assets/districts/pa-house.geojson",
    districtProperty: "LEG_DISTRI",
  },
] as const;

export function getDistrictLayer(id: DistrictId): DistrictLayer | undefined {
  return districtRegistry.find((l) => l.id === id);
}

export function districtLayers(): readonly DistrictLayer[] {
  return districtRegistry;
}
