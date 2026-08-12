/**
 * Data build script for district boundary layers.
 *
 * Usage:
 *   pnpm tsx scripts/build-districts.ts <layerId>
 *   pnpm tsx scripts/build-districts.ts --all
 *
 * For each layer in the registry, this script:
 *   1. Fetches the upstream GeoJSON from the URL recorded in docs/DATA-SOURCES.md.
 *   2. Validates the response shape (feature count, expected property names).
 *   3. Simplifies with mapshaper at ~0.5% tolerance (SPEC.md target).
 *   4. Writes the simplified GeoJSON to the layer's geometryPath (registry.ts),
 *      as plain .json — the app bundles it via a static import, same as
 *      assets/data/*.json, so it must be an extension every bundler already
 *      treats as JSON.
 *
 * The bundled file is the only thing the app reads at runtime. The upstream
 * URL is a build-time dependency only.
 *
 * Hard rules enforced here:
 *   - No invented URLs. Every URL comes from docs/DATA-SOURCES.md.
 *   - The districtProperty recorded in the registry must exist on every feature.
 *   - Output is EPSG:4326 (lng, lat), matching the project convention.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";

import { districtRegistry } from "../src/lib/districts/registry.ts";
import type { DistrictId, DistrictLayer } from "../src/lib/districts/types.ts";

/**
 * Upstream sources. ONE entry per layer. URLs come from docs/DATA-SOURCES.md
 * verified blocks — do not edit a URL here without updating the verified block
 * with a fresh fetch date.
 */
const UPSTREAM: Record<
  DistrictId,
  { url: string; expectedFeatures: number | null }
> = {
  "city-limits": {
    url: "https://hub.arcgis.com/api/v3/datasets/405ec3da942d4e20869d4e1449a2be48_0/downloads/data?format=geojson&spatialRefId=4326&where=1%3D1",
    expectedFeatures: 1,
  },
  council: {
    url: "https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Council_Districts_2024/FeatureServer/0/query?where=1=1&outFields=*&f=geojson",
    expectedFeatures: 10,
  },
  congress: {
    url: "https://www.pasda.psu.edu/json/PaCongressional2024_03.geojson",
    expectedFeatures: 17,
  },
  "pa-senate": {
    url: "https://data-pennshare.opendata.arcgis.com/api/download/v1/items/90adf2f516544dfebbe346a11eefce97/geojson?layers=0",
    expectedFeatures: 50,
  },
  "pa-house": {
    url: "https://www.pasda.psu.edu/json/PaHouse2024_03.geojson",
    expectedFeatures: 203,
  },
};

const OUT_DIR = "assets/districts";
const TMP_DIR = "/tmp/philly-reps-build";

function fetchUpstream(layer: DistrictLayer): string {
  const src = UPSTREAM[layer.id];
  if (!src) throw new Error(`no upstream URL recorded for layer ${layer.id}`);
  const tmpFile = join(TMP_DIR, `${layer.id}-raw.geojson`);
  console.log(`  fetching ${src.url}`);
  // Use curl for the fetch — no runtime fetch in src/lib, but this is a build
  // script (Node, not bundled into the app), so a shell call is fine.
  execFileSync("curl", ["-sL", "-o", tmpFile, src.url], { stdio: "inherit" });
  return tmpFile;
}

function validateRaw(layer: DistrictLayer, rawPath: string): void {
  const fc = JSON.parse(readFileSync(rawPath, "utf8")) as {
    type: string;
    features?: unknown[];
  };
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    throw new Error(`${layer.id}: response is not a GeoJSON FeatureCollection`);
  }
  const count = fc.features.length;
  const expected = UPSTREAM[layer.id].expectedFeatures;
  if (expected !== null && count !== expected) {
    throw new Error(`${layer.id}: expected ${expected} features, got ${count}`);
  }
  console.log(`  features: ${count}`);

  if (layer.kind === "district" && layer.districtProperty) {
    const prop = layer.districtProperty;
    for (const f of fc.features as Array<{
      properties?: Record<string, unknown>;
    }>) {
      if (!f.properties || !(prop in f.properties)) {
        throw new Error(
          `${layer.id}: feature missing required property "${prop}"`,
        );
      }
    }
    console.log(`  districtProperty "${prop}" present on all features`);
  }
}

function clipToCityLimits(layer: DistrictLayer, rawPath: string): string {
  // Council districts are already coterminous with the city, so clipping is a
  // no-op for them — but state/federal layers (step 6) are statewide and MUST
  // be clipped. We run the clip unconditionally so the pipeline is uniform.
  const cityLimits = districtRegistry.find((l) => l.id === "city-limits");
  if (!cityLimits) throw new Error("city-limits missing from registry");
  const cityLimitsPath = cityLimits.geometryPath;
  if (!existsSync(cityLimitsPath)) {
    throw new Error(
      `${cityLimits.geometryPath} not built — run "pnpm data:build city-limits" first`,
    );
  }
  const clippedPath = join(TMP_DIR, `${layer.id}-clipped.geojson`);
  // mapshaper: import both layers, name them, clip the layer to the boundary.
  const args = [
    "-i",
    rawPath,
    "name=input",
    "-i",
    cityLimitsPath,
    "name=clip",
    "-clip",
    "clip",
    "target=input",
    "-o",
    clippedPath,
    "format=geojson",
  ];
  console.log(`  clipping to city limits`);
  execFileSync("mapshaper", args, { stdio: "inherit" });
  return clippedPath;
}

function simplify(
  layer: DistrictLayer,
  inputPath: string,
  outName: string,
): string {
  const outPath = join(OUT_DIR, outName);
  const tmpSimplified = join(TMP_DIR, `${layer.id}-simplified.geojson`);

  // mapshaper CLI: commands separated by `-`. Simplify at 0.5% planar
  // tolerance, keep-shapes prevents dropping small polygons, precision keeps
  // coordinates compact. SPEC.md target: under ~1.5 MB total, visually
  // indistinguishable at city zoom levels.
  const args = [
    inputPath,
    "-simplify",
    "percentage=0.5",
    "keep-shapes",
    "-o",
    tmpSimplified,
    "format=geojson",
    "precision=0.000001",
  ];
  console.log(`  simplifying (mapshaper 0.5%)`);
  execFileSync("mapshaper", args, { stdio: "inherit" });

  // Re-read to pretty-print and confirm shape.
  const simplified = JSON.parse(readFileSync(tmpSimplified, "utf8")) as {
    features: Array<{ properties?: Record<string, unknown> }>;
  };
  console.log(`  simplified feature count: ${simplified.features.length}`);

  // Verify the districtProperty survived simplification.
  if (layer.kind === "district" && layer.districtProperty) {
    const prop = layer.districtProperty;
    for (const f of simplified.features) {
      if (!f.properties || !(prop in f.properties)) {
        throw new Error(
          `${layer.id}: simplified feature missing property "${prop}"`,
        );
      }
    }
  }

  writeFileSync(outPath, JSON.stringify(simplified));
  const sizeKb = Math.round(readFileSync(outPath).byteLength / 1024);
  console.log(`  wrote ${outPath} (${sizeKb} KB)`);
  return outPath;
}

function buildLayer(id: DistrictId, outName?: string): void {
  const layer = districtRegistry.find((l) => l.id === id);
  if (!layer) throw new Error(`unknown layer id: ${id}`);
  console.log(`\n[${id}] ${layer.label}`);
  const rawPath = fetchUpstream(layer);
  validateRaw(layer, rawPath);
  const clippedPath = clipToCityLimits(layer, rawPath);
  const name = outName ?? basename(layer.geometryPath);
  simplify(layer, clippedPath, name);
}

function main(): void {
  const args = process.argv.slice(2);
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });

  if (args[0] === "--all") {
    for (const layer of districtRegistry) buildLayer(layer.id);
  } else if (args.length >= 1) {
    // Optional --out=<name>.geojson flag for a custom output filename.
    const outFlag = args.find((a) => a.startsWith("--out="));
    const outName = outFlag ? outFlag.slice("--out=".length) : undefined;
    buildLayer(args[0] as DistrictId, outName);
  } else {
    console.error(
      "usage: pnpm tsx scripts/build-districts.ts <layerId | --all>",
    );
    process.exit(1);
  }
}

main();
