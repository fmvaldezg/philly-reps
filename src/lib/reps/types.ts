/**
 * Representative / official contact data types.
 *
 * Contact fields are all optional except name and office — a missing field
 * renders as "Not listed" in the UI, never a placeholder. Per AGENTS.md hard
 * rule: never invent a phone, email, address, or name.
 *
 * Every record carries source_url and verified_on (ISO date). No exceptions.
 */

import type { DistrictLevel } from "../districts/types.ts";

/** A government office, independent of who holds it. */
export interface Office {
  /** Stable id, e.g. "us-senator-pa", "pa-house-182", "philly-council-5". */
  id: string;
  /** Human label, e.g. "U.S. Senator", "PA State Representative, District 182". */
  title: string;
  /** Federal / state / city — drives grouping and the level color. */
  level: DistrictLevel;
  /** District number if district-based, or null for at-large / citywide. */
  districtNumber: string | null;
  /** Which district layer this office is drawn from, or null for statewide. */
  layerId: string | null;
}

/** A contact method bundle for one office location. */
export interface OfficeLocation {
  address?: string;
  phone?: string;
}

/** One elected official and their contact information. */
export interface Official {
  /** The office they hold. */
  office: Office;
  /** Full name. Required — never invented. */
  name: string;
  party?: string;
  /** District office (in the district they represent). */
  districtOffice?: OfficeLocation;
  /** Capitol / main office (Harrisburg, Washington). */
  capitolOffice?: OfficeLocation;
  /** City Hall office (for city-level officials). */
  cityHallOffice?: OfficeLocation;
  email?: string;
  contactFormUrl?: string;
  website?: string;
  termEnd?: string;
  photoUrl?: string;
  /** Where this record came from. Required. */
  sourceUrl: string;
  /** ISO date this record was last verified. Required. */
  verifiedOn: string;
}

/** A resolved result: the offices that represent one address. */
export interface LookupResult {
  /** The matched address, as Census formatted it. */
  matchedAddress: string;
  /** The coordinate we resolved against. */
  coords: readonly [number, number];
  /** True if the point is inside the city limits. */
  inCity: boolean;
  /** Officials grouped by level: federal, state, city. */
  officials: readonly Official[];
}
