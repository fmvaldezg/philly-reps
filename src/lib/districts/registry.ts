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
 * Geometry paths point at the bundled simplified GeoJSON (stored as .json —
 * every bundler already treats that extension as a source module, so the
 * resolver can `import` it directly instead of touching the filesystem).
 */

import type {
  DistrictId,
  DistrictLayer,
  DistrictLevel,
  TabGroup,
} from "./types";

export const districtRegistry: readonly DistrictLayer[] = [
  {
    id: "city-limits",
    level: "city",
    kind: "boundary",
    label: "Philadelphia city limits",
    shortLabel: "City limits",
    geometryPath: "assets/districts/city-limits.json",
    districtProperty: null,
  },
  {
    id: "council",
    level: "city",
    kind: "district",
    label: "Philadelphia City Council",
    shortLabel: "City",
    geometryPath: "assets/districts/council.json",
    districtProperty: "district",
  },
  {
    id: "congress",
    level: "federal",
    kind: "district",
    label: "U.S. House of Representatives",
    shortLabel: "Federal",
    geometryPath: "assets/districts/congress.json",
    districtProperty: "LEG_DISTRI",
  },
  {
    id: "pa-senate",
    level: "state",
    kind: "district",
    label: "Pennsylvania State Senate",
    shortLabel: "State Senate",
    geometryPath: "assets/districts/pa-senate.json",
    districtProperty: "LEG_DISTRICT_NO",
  },
  {
    id: "pa-house",
    level: "state",
    kind: "district",
    label: "Pennsylvania House of Representatives",
    shortLabel: "State House",
    geometryPath: "assets/districts/pa-house.json",
    districtProperty: "LEG_DISTRI",
  },
] as const;

export function getDistrictLayer(id: DistrictId): DistrictLayer | undefined {
  return districtRegistry.find((l) => l.id === id);
}

export function districtLayers(): readonly DistrictLayer[] {
  return districtRegistry;
}

const DISTRICT_IDS = new Set<string>(districtRegistry.map((l) => l.id));

/** Narrows a generic string (e.g. an Office's layerId) to a known DistrictId. */
export function isDistrictId(id: string): id is DistrictId {
  return DISTRICT_IDS.has(id);
}

const LEVEL_ORDER: readonly DistrictLevel[] = ["federal", "state", "city"];
const LEVEL_LABELS: Record<DistrictLevel, string> = {
  federal: "Federal",
  state: "State",
  city: "City",
};

/**
 * The results tabs, derived from the registry — never hardcoded layer
 * names. A level with a single district layer gets one tab labeled by the
 * level ("Federal", "City"); a level with more than one (currently just
 * "state": PA Senate + PA House) gets one tab per layer, labeled by that
 * layer's `shortLabel`, so each tab maps to exactly one map layer.
 */
export function tabGroups(): readonly TabGroup[] {
  const groups: TabGroup[] = [];
  for (const level of LEVEL_ORDER) {
    const layers = districtRegistry.filter(
      (l) => l.level === level && l.kind === "district",
    );
    if (layers.length <= 1) {
      const layer = layers[0];
      if (!layer) continue;
      groups.push({
        key: level,
        level,
        layerId: layer.id,
        label: LEVEL_LABELS[level],
      });
      continue;
    }
    for (const layer of layers) {
      groups.push({
        key: `${level}:${layer.id}`,
        level,
        layerId: layer.id,
        label: layer.shortLabel,
      });
    }
  }
  return groups;
}
