/**
 * scripts/build-reps.ts
 *
 * Fetches representative contact sources (C1 + C2), filters to Pennsylvania,
 * transforms to the Official[] shape from src/lib/reps/types.ts, and writes
 * to assets/data/.
 *
 * Sources:
 *   C1 — unitedstates/congress-legislators (GitHub, public domain)
 *        - legislators-current.csv (current members + DC office)
 *        - legislators-district-offices.yaml (district offices, joined by bioguide_id)
 *   C2 — Open States / Plural bulk CSV (pa.csv — PA state legislators)
 *
 * C3 (5 Calls) is dropped — see docs/DATA-SOURCES.md.
 *
 * FAIL LOUDLY, not silently skip, on:
 *   - a C1 record that doesn't join to the district-offices YAML
 *   - a missing required field (name, office, source_url, verified_on)
 *   - a PA count that isn't 17 House + 2 Senate (C1) or unexpected (C2)
 *
 * Every output record carries source_url and verified_on. No exceptions.
 * Do not write to data/manual/ — those are hand-maintained.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import type { Official } from "../src/lib/reps/types.ts";

const TMP = "/tmp/philly-reps-reps";
const OUT_DIR = "assets/data";
const VERIFIED_ON = new Date().toISOString().slice(0, 10);

const C1_CSV_URL =
  "https://unitedstates.github.io/congress-legislators/legislators-current.csv";
const C1_OFFICES_YAML_URL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-district-offices.yaml";
const C2_CSV_URL = "https://data.openstates.org/people/current/pa.csv";

// --- fetch helpers ---------------------------------------------------------

function fetch(url: string, out: string): void {
  console.log(`  fetching ${url}`);
  execFileSync("curl", ["-sL", "-o", out, url], { stdio: "inherit" });
}

// --- CSV parser (minimal, handles quoted fields) ---------------------------

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n") {
        current.push(field);
        lines.push(current);
        current = [];
        field = "";
      } else if (ch === "\r") {
        // skip
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    lines.push(current);
  }

  const header = lines[0] ?? [];
  const rows = lines
    .slice(1)
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
  return { header, rows };
}

function rowToObject(header: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) {
    obj[header[i] ?? ""] = row[i] ?? "";
  }
  return obj;
}

// --- C1: congress-legislators ----------------------------------------------

interface DistrictOffice {
  address?: string;
  suite?: string;
  building?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  fax?: string;
  hours?: string;
  latitude?: string;
  longitude?: string;
}

interface DistrictOfficesEntry {
  id: { bioguide?: string; govtrack?: string; thomas?: string };
  offices?: DistrictOffice[];
}

function loadDistrictOffices(path: string): Map<string, DistrictOffice[]> {
  const yaml = readFileSync(path, "utf8");
  const entries = parseYaml(yaml) as DistrictOfficesEntry[];
  const map = new Map<string, DistrictOffice[]>();
  for (const entry of entries) {
    const bioguide = entry.id?.bioguide;
    if (!bioguide) continue;
    map.set(bioguide, entry.offices ?? []);
  }
  return map;
}

function buildAddressLine(office: DistrictOffice): string | undefined {
  const parts: string[] = [];
  if (office.address) parts.push(office.address);
  if (office.suite) parts.push(office.suite);
  if (office.building) parts.push(office.building);
  const line1 = parts.join(", ");
  const cityState = [office.city, office.state].filter(Boolean).join(", ");
  const line2 = [cityState, office.zip].filter(Boolean).join(" ");
  const full = [line1, line2].filter(Boolean).join("\n");
  return full.length > 0 ? full : undefined;
}

/** Build an OfficeLocation, including only keys that have values. */
function buildOfficeLocation(
  address: string | undefined,
  phone: string | undefined,
): { address?: string; phone?: string } {
  const loc: { address?: string; phone?: string } = {};
  if (address) loc.address = address;
  if (phone) loc.phone = phone;
  return loc;
}

/**
 * Spread helper for exactOptionalPropertyTypes: returns the object only if the
 * value is defined, so undefined never lands on an optional property.
 */
function optional<T>(obj: { [K in keyof T]: T[K] | undefined }): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

function transformC1(): Official[] {
  console.log("\n=== C1: unitedstates/congress-legislators ===");

  const csvPath = `${TMP}/legislators-current.csv`;
  fetch(C1_CSV_URL, csvPath);
  const yamlPath = `${TMP}/legislators-district-offices.yaml`;
  fetch(C1_OFFICES_YAML_URL, yamlPath);

  const { header, rows } = parseCsv(readFileSync(csvPath, "utf8"));
  const officesByBioguide = loadDistrictOffices(yamlPath);

  const paRows = rows
    .map((r) => rowToObject(header, r))
    .filter((r) => r["state"] === "PA");

  // Validate count: 17 House + 2 Senate = 19.
  const houseCount = paRows.filter((r) => r["type"] === "rep").length;
  const senateCount = paRows.filter((r) => r["type"] === "sen").length;
  console.log(
    `  PA records: ${paRows.length} (${houseCount} House, ${senateCount} Senate)`,
  );
  if (houseCount !== 17 || senateCount !== 2) {
    throw new Error(
      `C1 PA count mismatch: expected 17 House + 2 Senate, got ${houseCount} House + ${senateCount} Senate`,
    );
  }

  const officials: Official[] = [];
  const unjoined: string[] = [];

  for (const row of paRows) {
    const bioguide = row["bioguide_id"];
    const name = row["full_name"];
    if (!bioguide)
      throw new Error(`C1: record missing bioguide_id — name=${name}`);
    if (!name)
      throw new Error(`C1: record missing full_name — bioguide=${bioguide}`);

    const districtOffices = officesByBioguide.get(bioguide);
    if (!districtOffices) {
      unjoined.push(`${bioguide} (${name})`);
      continue;
    }

    // DC office from the CSV (address + phone columns).
    const capitolAddress = row["address"] || undefined;
    const capitolPhone = row["phone"] || undefined;
    const hasCapitol = capitolAddress || capitolPhone;

    // District office: take the first one with a PA state field, else the first.
    const paOffice =
      districtOffices.find((o) => o.state === "PA") ?? districtOffices[0];
    if (!paOffice) {
      unjoined.push(`${bioguide} (${name}) — offices list empty`);
      continue;
    }
    const districtAddress = buildAddressLine(paOffice);
    const districtPhone = paOffice.phone || undefined;
    const hasDistrict = districtAddress || districtPhone;

    const isSenator = row["type"] === "sen";
    const officeId = isSenator
      ? `us-senator-pa-${row["senate_class"]}`
      : `us-house-pa-${row["district"]}`;
    const title = isSenator
      ? "U.S. Senator"
      : `U.S. Representative, District ${row["district"]}`;

    const official: Official = {
      office: {
        id: officeId,
        title,
        level: "federal",
        districtNumber: isSenator ? null : row["district"] || null,
        layerId: isSenator ? null : "congress",
      },
      name,
      ...optional({ party: row["party"] }),
      ...optional({
        capitolOffice: hasCapitol
          ? buildOfficeLocation(capitolAddress, capitolPhone)
          : undefined,
      }),
      ...optional({
        districtOffice: hasDistrict
          ? buildOfficeLocation(districtAddress, districtPhone)
          : undefined,
      }),
      ...optional({ contactFormUrl: row["contact_form"] }),
      ...optional({ website: row["url"] }),
      sourceUrl: C1_CSV_URL,
      verifiedOn: VERIFIED_ON,
    };

    officials.push(official);
  }

  if (unjoined.length > 0) {
    throw new Error(
      `C1: ${unjoined.length} record(s) could not be joined to district offices:\n  ${unjoined.join("\n  ")}`,
    );
  }

  console.log(`  transformed: ${officials.length} officials`);
  return officials;
}

// --- C2: Open States / Plural ----------------------------------------------

function transformC2(): Official[] {
  console.log("\n=== C2: Open States / Plural (pa.csv) ===");

  const csvPath = `${TMP}/openstates-pa.csv`;
  fetch(C2_CSV_URL, csvPath);

  const { header, rows } = parseCsv(readFileSync(csvPath, "utf8"));
  const allRows = rows.map((r) => rowToObject(header, r));

  console.log(`  total records: ${allRows.length}`);

  const officials: Official[] = [];
  const missingField: string[] = [];

  for (const row of allRows) {
    const id = row["id"];
    const name = row["name"];
    const chamber = row["current_chamber"]; // "lower" or "upper"
    const district = row["current_district"];

    if (!id) throw new Error(`C2: record missing id`);
    if (!name) {
      missingField.push(`id=${id} missing name`);
      continue;
    }
    if (!chamber) {
      missingField.push(`id=${id} (${name}) missing current_chamber`);
      continue;
    }
    if (!district) {
      missingField.push(`id=${id} (${name}) missing current_district`);
      continue;
    }

    const isSenate = chamber === "upper";
    const isHouse = chamber === "lower";
    if (!isSenate && !isHouse) {
      missingField.push(`id=${id} (${name}) unexpected chamber="${chamber}"`);
      continue;
    }

    const officeId = isSenate
      ? `pa-senate-${district}`
      : `pa-house-${district}`;
    const title = isSenate
      ? `PA State Senator, District ${district}`
      : `PA State Representative, District ${district}`;

    const capitolAddress = row["capitol_address"] || undefined;
    const capitolPhone = row["capitol_voice"] || undefined;
    const hasCapitol = capitolAddress || capitolPhone;

    const districtAddress = row["district_address"] || undefined;
    const districtPhone = row["district_voice"] || undefined;
    const hasDistrict = districtAddress || districtPhone;

    const official: Official = {
      office: {
        id: officeId,
        title,
        level: "state",
        districtNumber: district,
        layerId: isSenate ? "pa-senate" : "pa-house",
      },
      name,
      ...optional({ party: row["current_party"] }),
      ...optional({
        capitolOffice: hasCapitol
          ? buildOfficeLocation(capitolAddress, capitolPhone)
          : undefined,
      }),
      ...optional({
        districtOffice: hasDistrict
          ? buildOfficeLocation(districtAddress, districtPhone)
          : undefined,
      }),
      ...optional({ email: row["email"] }),
      ...optional({ photoUrl: row["image"] }),
      sourceUrl: C2_CSV_URL,
      verifiedOn: VERIFIED_ON,
    };

    officials.push(official);
  }

  if (missingField.length > 0) {
    throw new Error(
      `C2: ${missingField.length} record(s) with missing/invalid required fields:\n  ${missingField.join("\n  ")}`,
    );
  }

  const houseCount = officials.filter(
    (o) => o.office.layerId === "pa-house",
  ).length;
  const senateCount = officials.filter(
    (o) => o.office.layerId === "pa-senate",
  ).length;
  console.log(
    `  transformed: ${officials.length} (${houseCount} House, ${senateCount} Senate)`,
  );

  return officials;
}

// --- write -----------------------------------------------------------------

function writeOfficials(officials: Official[], filename: string): void {
  const outPath = join(OUT_DIR, filename);
  writeFileSync(outPath, JSON.stringify(officials, null, 2));
  const sizeKb = Math.round(readFileSync(outPath).byteLength / 1024);
  console.log(`  wrote ${outPath} (${sizeKb} KB, ${officials.length} records)`);
}

function main(): void {
  console.log("Building representative contact data...");
  mkdirSync(OUT_DIR, { recursive: true });
  execFileSync("mkdir", ["-p", TMP], { stdio: "inherit" });

  const c1 = transformC1();
  const c2 = transformC2();

  console.log("\n=== final counts ===");
  const federalHouse = c1.filter((o) => o.office.layerId === "congress").length;
  const federalSenate = c1.filter((o) => o.office.layerId === null).length;
  const stateHouse = c2.filter((o) => o.office.layerId === "pa-house").length;
  const stateSenate = c2.filter((o) => o.office.layerId === "pa-senate").length;
  console.log(
    `  federal: ${federalHouse} House + ${federalSenate} Senate = ${c1.length}`,
  );
  console.log(
    `  state:   ${stateHouse} House + ${stateSenate} Senate = ${c2.length}`,
  );
  console.log(`  total:   ${c1.length + c2.length}`);

  writeOfficials(c1, "federal.json");
  writeOfficials(c2, "state.json");

  console.log("\nDone.");
}

main();
