/**
 * Web map — MapLibre GL JS. Renders the OpenFreeMap Positron basemap
 * (SPEC.md), a marker at the geocoded point, and the focused district
 * layer: every district in that layer as a light wash in the level color,
 * with the one containing the searched address picked out in the accent
 * color (SPEC.md user flow #6: tapping a result card / tab highlights it).
 *
 * Metro resolves this file for web builds; `Map.native.tsx` is the native
 * counterpart behind the same prop interface.
 */

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type FilterSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import bbox from "@turf/bbox";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";

import { colors } from "../styles/tokens";
import { getDistrictLayer } from "../lib/districts/registry";
import { getLayerGeoJSON } from "../lib/districts/resolve";
import type { DistrictId } from "../lib/districts/types";
import type { LngLat } from "../lib/geo/types";

// maplibre-gl parses tiles in a worker it loads via a relative URL computed
// from its own module URL. Metro doesn't bundle that worker file (that's a
// Vite/Webpack convention), so left to its own detection the worker 404s and
// tiles silently never render — only the basemap background/controls show.
// scripts/copy-maplibre-worker.mjs copies the matching worker file to
// public/ (served at the site root) on every install; point maplibre-gl at
// it directly, before any Map is constructed.
setWorkerUrl("/maplibre-gl-worker.mjs");

const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const SOURCE_ID = "focused-layer";
const WASH_FILL_ID = "focused-layer-wash-fill";
const WASH_LINE_ID = "focused-layer-wash-line";
const HIGHLIGHT_FILL_ID = "focused-layer-highlight-fill";
const HIGHLIGHT_LINE_ID = "focused-layer-highlight-line";
const LAYER_IDS = [
  WASH_FILL_ID,
  WASH_LINE_ID,
  HIGHLIGHT_FILL_ID,
  HIGHLIGHT_LINE_ID,
];

function levelColorFor(layerId: DistrictId): string {
  if (layerId === "congress") return colors.fed;
  if (layerId === "pa-senate" || layerId === "pa-house") return colors.state;
  return colors.city;
}

/** MapLibre wants a plain mutable tuple; LngLat is branded + readonly. */
function toLngLatLike(point: LngLat): [number, number] {
  return [point[0], point[1]];
}

export interface MapProps {
  /** The geocoded point to mark. */
  point: LngLat;
  /** Which district layer to draw, or null for none. */
  focusedLayerId: DistrictId | null;
  /** Which district within that layer to highlight, or null for none. */
  focusedDistrictNumber: string | null;
}

export function Map({
  point,
  focusedLayerId,
  focusedDistrictNumber,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: toLngLatLike(point),
      zoom: 13,
    });
    map.addControl(new NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Deliberately empty deps — the map is created once; point/focus updates
    // are handled by the effects below via imperative calls.
  }, []);

  // Marker at the geocoded point.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      markerRef.current = new Marker({ color: colors.accentInk })
        .setLngLat(toLngLatLike(point))
        .addTo(map);
    } else {
      markerRef.current.setLngLat(toLngLatLike(point));
    }
    map.easeTo({ center: toLngLatLike(point) });
  }, [point]);

  // Focused layer: every district as a light wash, the matching one highlighted.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function applyFocus(): void {
      if (!map) return;
      for (const id of LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

      if (!focusedLayerId) return;
      const fc = getLayerGeoJSON(focusedLayerId);
      if (!fc) return;
      const data = fc as unknown as FeatureCollection<Polygon | MultiPolygon>;
      const districtProperty =
        getDistrictLayer(focusedLayerId)?.districtProperty;
      const levelColorValue = levelColorFor(focusedLayerId);

      map.addSource(SOURCE_ID, { type: "geojson", data });

      // Every district in the layer, as a light wash.
      map.addLayer({
        id: WASH_FILL_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": levelColorValue, "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: WASH_LINE_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": levelColorValue,
          "line-opacity": 0.5,
          "line-width": 1,
        },
      });

      // The one district the searched address falls in, picked out in the
      // accent color (matches the pin and the focused card border).
      let fitFeatures = data.features;
      if (districtProperty && focusedDistrictNumber !== null) {
        const filter: FilterSpecification = [
          "==",
          ["to-string", ["get", districtProperty]],
          focusedDistrictNumber,
        ];
        map.addLayer({
          id: HIGHLIGHT_FILL_ID,
          type: "fill",
          source: SOURCE_ID,
          filter,
          paint: { "fill-color": colors.accent, "fill-opacity": 0.35 },
        });
        map.addLayer({
          id: HIGHLIGHT_LINE_ID,
          type: "line",
          source: SOURCE_ID,
          filter,
          paint: { "line-color": colors.accentInk, "line-width": 3 },
        });

        const matching = data.features.filter(
          (f) =>
            String(f.properties?.[districtProperty]) === focusedDistrictNumber,
        );
        if (matching.length > 0) fitFeatures = matching;
      }

      const box = bbox({ type: "FeatureCollection", features: fitFeatures });
      map.fitBounds(
        [
          [box[0], box[1]],
          [box[2], box[3]],
        ],
        { padding: 40, maxZoom: 15, duration: 500 },
      );
    }

    if (map.isStyleLoaded()) applyFocus();
    else map.once("load", applyFocus);
  }, [focusedLayerId, focusedDistrictNumber]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 10,
        overflow: "hidden",
      }}
    />
  );
}
