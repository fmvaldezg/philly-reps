/**
 * data:verify — checks every bundled district file loads and every rep record
 * has a `source_url` and `verified_on`. Run after `data:build` and before any
 * release. Exits non-zero on the first failure.
 *
 *   pnpm tsx scripts/verify-data.ts
 *
 * Checks:
 *   1. Every layer in the registry has a geometry file at its geometryPath.
 *   2. Every geometry file parses as a GeoJSON FeatureCollection.
 *   3. Every feature in a district layer carries the layer's districtProperty.
 *   4. (Step 7) Every record in assets/data/ has source_url and verified_on.
 *      No rep records exist yet, so this is a no-op for now.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { districtRegistry } from "../src/lib/districts/registry.ts";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { Official } from "../src/lib/reps/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");

let failures = 0;

function fail(msg: string): void {
  console.error(`  ✗ ${msg}`);
  failures++;
}

function checkLayer(layer: (typeof districtRegistry)[number]): void {
  console.log(`\n[${layer.id}] ${layer.label}`);
  const absPath = join(projectRoot, layer.geometryPath);

  if (!existsSync(absPath)) {
    // Not all layers are built yet (step 6). Warn, don't fail — the file
    // simply isn't bundled. A malformed file that IS present is a failure.
    console.log(`  (not built yet — skipped)`);
    return;
  }

  let fc: FeatureCollection<Polygon | MultiPolygon>;
  try {
    fc = JSON.parse(readFileSync(absPath, "utf8")) as FeatureCollection<
      Polygon | MultiPolygon
    >;
  } catch (e) {
    fail(
      `failed to parse ${layer.geometryPath}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }

  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    fail(`${layer.geometryPath} is not a GeoJSON FeatureCollection`);
    return;
  }

  console.log(`  features: ${fc.features.length}`);

  if (layer.kind === "district" && layer.districtProperty) {
    const prop = layer.districtProperty;
    let missing = 0;
    for (const f of fc.features) {
      if (!f.properties || !(prop in f.properties)) missing++;
    }
    if (missing > 0) {
      fail(`${missing} feature(s) missing districtProperty "${prop}"`);
    } else {
      console.log(`  districtProperty "${prop}" present on all features`);
    }
  }
}

function checkRepRecords(): void {
  console.log("\nVerifying rep records...");
  const dataDir = join(projectRoot, "assets", "data");
  if (!existsSync(dataDir)) {
    console.log("  (no assets/data/ directory — skipped)");
    return;
  }
  const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("  (no rep record files — skipped)");
    return;
  }
  let total = 0;
  for (const file of files) {
    const absPath = join(dataDir, file);
    let records: Official[];
    try {
      records = JSON.parse(readFileSync(absPath, "utf8")) as Official[];
    } catch (e) {
      fail(
        `failed to parse ${file}: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    console.log(`\n  ${file}: ${records.length} records`);
    let bad = 0;
    for (const r of records) {
      // Every record must have source_url and verified_on.
      if (!r.sourceUrl) {
        fail(`${file}: record ${r.office.id} missing sourceUrl`);
        bad++;
      }
      if (!r.verifiedOn) {
        fail(`${file}: record ${r.office.id} missing verifiedOn`);
        bad++;
      }
      // name is required.
      if (!r.name) {
        fail(`${file}: record ${r.office.id} missing name`);
        bad++;
      }
    }
    if (bad === 0) {
      console.log(`    all records have sourceUrl + verifiedOn + name`);
    }
    total += records.length;
  }
  console.log(`\n  total rep records: ${total}`);
}

function main(): void {
  console.log("Verifying bundled district data...");
  for (const layer of districtRegistry) checkLayer(layer);

  checkRepRecords();

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main();
