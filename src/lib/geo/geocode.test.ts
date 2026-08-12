/**
 * Geocoder client tests. No network — every test injects a `fetch` stub
 * returning canned responses. The real fixture (census-response.json) drives
 * the happy-path test; the others are constructed inline.
 */

import { describe, expect, it } from "vitest";

import { geocode, type FetchFn } from "./geocode";
import { isErr, isOk } from "../result";

// Load the real Census fixture once.
import realResponse from "./__fixtures__/census-response.json";

/** Build a stub fetch that returns a canned response. */
function stubFetch(status: number, body: string): FetchFn {
  return async () => ({
    status,
    text: async () => body,
  });
}

/** Stub that returns the real fixture. */
const realFetch: FetchFn = async () => ({
  status: 200,
  text: async () => JSON.stringify(realResponse),
});

describe("geocode — happy path (real fixture)", () => {
  it("returns one match with converted coords and cross-check districts", async () => {
    const r = await geocode(
      "1400 John F Kennedy Blvd, Philadelphia, PA 19107",
      realFetch,
    );
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;

    expect(r.value.matches).toHaveLength(1);
    const m = r.value.matches[0];
    if (!m) throw new Error("expected match");

    // Census returned x=-75.163..., y=39.953... → [lng, lat]
    expect(m.coords[0]).toBeCloseTo(-75.1634, 4);
    expect(m.coords[1]).toBeCloseTo(39.9533, 4);
    expect(m.matchedAddress).toContain("JOHN F KENNEDY BLVD");

    // Geography cross-check: prefix-matched, not exact-key-matched.
    expect(m.geographies.congress).toBe("3");
    expect(m.geographies["pa-senate"]).toBe("1");
    expect(m.geographies["pa-house"]).toBe("182");
  });
});

describe("geocode — zero matches", () => {
  it("returns no-match when addressMatches is empty", async () => {
    const empty = { result: { addressMatches: [], input: { address: "x" } } };
    const r = await geocode("nowhere", stubFetch(200, JSON.stringify(empty)));
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("no-match");
  });
});

describe("geocode — multiple matches", () => {
  it("returns all matches when Census returns more than one", async () => {
    // Two matches: the real one + a synthetic second.
    const real = (realResponse as { result: { addressMatches: unknown[] } })
      .result.addressMatches[0];
    const second = JSON.parse(JSON.stringify(real)) as Record<string, unknown>;
    // Move the second match to a different coordinate.
    const coords = second.coordinates as { x: number; y: number };
    coords.x = -75.2;
    coords.y = 39.95;

    const multi = {
      result: {
        addressMatches: [real, second],
        input: { address: "ambiguous" },
      },
    };
    const r = await geocode("ambiguous", stubFetch(200, JSON.stringify(multi)));
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.matches).toHaveLength(2);
  });
});

describe("geocode — out-of-bounds filtering", () => {
  it("returns out-of-bounds when all matches fall outside the city", async () => {
    // Real fixture coordinate is inside Philly. Stub inCity to say "outside".
    const alwaysOutside = async () => false;
    const r = await geocode("1400 JFK", realFetch, { inCity: alwaysOutside });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("out-of-bounds");
  });

  it("filters to inside matches when some are outside", async () => {
    const real = (realResponse as { result: { addressMatches: unknown[] } })
      .result.addressMatches[0];
    const second = JSON.parse(JSON.stringify(real)) as Record<string, unknown>;
    const coords = second.coordinates as { x: number; y: number };
    coords.x = -74.0; // well outside Philly
    coords.y = 40.0;

    const multi = {
      result: {
        addressMatches: [real, second],
        input: { address: "x" },
      },
    };

    // inCity: true only for the real coordinate.
    const inCity = async (p: { readonly [0]: number; readonly [1]: number }) =>
      p[0] < -75.0 && p[1] < 40.0;

    const r = await geocode("x", stubFetch(200, JSON.stringify(multi)), {
      inCity,
    });
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.matches).toHaveLength(1);
  });
});

describe("geocode — malformed / non-200", () => {
  it("returns http error on non-200 status", async () => {
    const r = await geocode("x", stubFetch(500, "server error"));
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("http");
    if (r.error.kind === "http") {
      expect(r.error.status).toBe(500);
      expect(r.error.body).toBe("server error");
    }
  });

  it("returns malformed on invalid JSON", async () => {
    const r = await geocode("x", stubFetch(200, "not json{"));
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("malformed");
  });

  it("returns malformed on schema-invalid JSON", async () => {
    // Valid JSON, wrong shape — no `result` key.
    const r = await geocode("x", stubFetch(200, JSON.stringify({ foo: 1 })));
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("malformed");
  });
});

describe("geocode — network error", () => {
  it("returns network error when fetch throws", async () => {
    const throwing: FetchFn = async () => {
      throw new Error("connection refused");
    };
    const r = await geocode("x", throwing);
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("network");
    if (r.error.kind === "network") {
      expect(r.error.message).toContain("connection refused");
    }
  });
});

describe("geocode — geography prefix matching", () => {
  it("matches geography keys by prefix, not exact equality", async () => {
    // Rename the keys to future vintage names to prove prefix matching works.
    const renamed = JSON.parse(JSON.stringify(realResponse)) as {
      result: {
        addressMatches: Array<{ geographies: Record<string, unknown> }>;
      };
    };
    const firstMatch = renamed.result.addressMatches[0];
    if (!firstMatch) throw new Error("fixture has no matches");
    const geo = firstMatch.geographies;
    geo["121st Congressional Districts"] = geo["119th Congressional Districts"];
    geo["2026 State Legislative Districts - Upper"] =
      geo["2024 State Legislative Districts - Upper"];
    geo["2026 State Legislative Districts - Lower"] =
      geo["2024 State Legislative Districts - Lower"];
    delete geo["119th Congressional Districts"];
    delete geo["2024 State Legislative Districts - Upper"];
    delete geo["2024 State Legislative Districts - Lower"];

    const r = await geocode("x", stubFetch(200, JSON.stringify(renamed)));
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    const m = r.value.matches[0];
    if (!m) throw new Error("expected match");
    expect(m.geographies.congress).toBe("3");
    expect(m.geographies["pa-senate"]).toBe("1");
    expect(m.geographies["pa-house"]).toBe("182");
  });
});
