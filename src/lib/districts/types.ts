/**
 * District-level types shared by the registry, the resolver, and the UI.
 *
 * A "layer" is one bundled GeoJSON file. Some layers resolve a district
 * number (council, congress, pa-senate, pa-house); others are boundaries
 * used for containment checks (city-limits). The resolver skips boundary
 * layers when computing district numbers.
 */

export type DistrictLevel = "federal" | "state" | "city";

/**
 * Stable layer identifiers. Add new layers here AND in `registry.ts` — the
 * union gives exhaustiveness checks; the registry is the data the UI iterates.
 */
export type DistrictId =
  "city-limits" | "council" | "congress" | "pa-senate" | "pa-house";

export type DistrictLayerKind = "boundary" | "district";

/**
 * One bundled GeoJSON layer.
 *
 * `districtProperty` is the GeoJSON feature property that carries the
 * district number. Every layer names this field differently (DATA-SOURCES.md
 * A1–A5) — guessing is how you get a map that renders but resolves nothing.
 * Boundary layers set `districtProperty` to `null`.
 */
export interface DistrictLayer {
  readonly id: DistrictId;
  readonly level: DistrictLevel;
  readonly kind: DistrictLayerKind;
  readonly label: string;
  /**
   * Short label for a results tab, used when a level has more than one
   * district layer (e.g. "State Senate" / "State House" instead of one
   * "State" tab that hides which chamber's boundary is on the map).
   */
  readonly shortLabel: string;
  /** Path to the bundled simplified GeoJSON, relative to the project root. */
  readonly geometryPath: string;
  /** GeoJSON property name carrying the district number, or null for boundaries. */
  readonly districtProperty: string | null;
}

/**
 * A resolved district for one layer. `districtNumber` is null for at-large /
 * citywide layers and for boundary layers (which the resolver skips).
 */
export interface ResolvedDistrict {
  readonly layerId: DistrictId;
  readonly level: DistrictLevel;
  readonly districtNumber: string | null;
}

/**
 * A results tab. One per level normally; a level splits into one tab per
 * layer when it has more than one district layer (SPEC.md: PA Senate and PA
 * House are different districts and shouldn't share a "State" tab). Every
 * tab maps to exactly one layer, so the map always has a concrete layer to
 * draw whenever a tab is active.
 */
export interface TabGroup {
  /** Unique, stable key — the level alone, or "level:layerId" when split. */
  readonly key: string;
  readonly level: DistrictLevel;
  readonly layerId: DistrictId;
  readonly label: string;
}
