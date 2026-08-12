import { describe, expect, it } from "vitest";

import { districtLayers, districtRegistry, getDistrictLayer } from "./registry";
import type { DistrictId, DistrictLayer } from "./types";

describe("district registry", () => {
  it("is non-empty", () => {
    expect(districtRegistry.length).toBeGreaterThan(0);
  });

  it("has stable, unique ids", () => {
    const ids = districtRegistry.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every district layer declares a districtProperty", () => {
    for (const layer of districtRegistry) {
      if (layer.kind === "district") {
        expect(
          layer.districtProperty,
          `district layer ${layer.id} must name a districtProperty`,
        ).toBeTypeOf("string");
      } else {
        expect(layer.districtProperty).toBeNull();
      }
    }
  });

  it("getDistrictLayer returns the layer for a known id", () => {
    const council = getDistrictLayer("council") as DistrictLayer;
    expect(council.id).toBe("council");
    expect(council.level).toBe("city");
    expect(council.kind).toBe("district");
  });

  it("getDistrictLayer returns undefined for an unknown id", () => {
    expect(getDistrictLayer("nope" as DistrictId)).toBeUndefined();
  });

  it("districtLayers() mirrors the registry", () => {
    expect(districtLayers()).toBe(districtRegistry);
  });
});
