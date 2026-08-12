/**
 * Native map — @maplibre/maplibre-react-native (MapLibre Native iOS/Android).
 * Same prop interface and behavior as `Map.web.tsx`: the OpenFreeMap Positron
 * basemap, a marker at the geocoded point, and the focused district layer:
 * every district in that layer as a light wash in the level color, with the
 * one containing the searched address picked out in the accent color
 * (SPEC.md user flow #6).
 *
 * Not visually verified — this environment has no iOS/Android simulator.
 * `@maplibre/maplibre-react-native` has native modules, so it needs
 * `expo prebuild` + a dev-client rebuild; it won't run in plain Expo Go.
 */

import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  Camera,
  type CameraRef,
  type FilterSpecification,
  GeoJSONSource,
  Layer,
  Map as MapLibreMapView,
  Marker,
} from "@maplibre/maplibre-react-native";
import bbox from "@turf/bbox";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { colors } from "../styles/tokens";
import { getDistrictLayer } from "../lib/districts/registry";
import { getLayerGeoJSON } from "../lib/districts/resolve";
import type { DistrictId } from "../lib/districts/types";
import type { LngLat } from "../lib/geo/types";

const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const SOURCE_ID = "focused-layer";

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
  const cameraRef = useRef<CameraRef>(null);
  const data = focusedLayerId
    ? (getLayerGeoJSON(focusedLayerId) as unknown as
        FeatureCollection<Polygon | MultiPolygon> | undefined)
    : undefined;
  const districtProperty = focusedLayerId
    ? getDistrictLayer(focusedLayerId)?.districtProperty
    : null;
  const highlightFilter: FilterSpecification | null =
    districtProperty && focusedDistrictNumber !== null
      ? ["==", ["to-string", ["get", districtProperty]], focusedDistrictNumber]
      : null;

  useEffect(() => {
    if (!data) return;
    const matching =
      districtProperty && focusedDistrictNumber !== null
        ? data.features.filter(
            (f) =>
              String(f.properties?.[districtProperty]) ===
              focusedDistrictNumber,
          )
        : [];
    const target: FeatureCollection<Polygon | MultiPolygon> =
      matching.length > 0
        ? { type: "FeatureCollection", features: matching }
        : data;
    const box = bbox(target) as [number, number, number, number];
    cameraRef.current?.fitBounds(box, {
      padding: { top: 40, bottom: 40, left: 40, right: 40 },
      duration: 500,
    });
  }, [data, districtProperty, focusedDistrictNumber]);

  const levelColorValue = focusedLayerId
    ? levelColorFor(focusedLayerId)
    : colors.city;

  return (
    <MapLibreMapView style={styles.map} mapStyle={BASEMAP_STYLE}>
      <Camera
        ref={cameraRef}
        center={toLngLatLike(point)}
        zoom={13}
        duration={300}
      />
      <Marker id="user-point" lngLat={toLngLatLike(point)}>
        <View style={[styles.marker, { backgroundColor: colors.accentInk }]} />
      </Marker>
      {data ? (
        <GeoJSONSource id={SOURCE_ID} data={data}>
          <Layer
            id="focused-layer-wash-fill"
            type="fill"
            paint={{ "fill-color": levelColorValue, "fill-opacity": 0.1 }}
          />
          <Layer
            id="focused-layer-wash-line"
            type="line"
            paint={{
              "line-color": levelColorValue,
              "line-opacity": 0.5,
              "line-width": 1,
            }}
          />
          {highlightFilter ? (
            <>
              <Layer
                id="focused-layer-highlight-fill"
                type="fill"
                filter={highlightFilter}
                paint={{ "fill-color": colors.accent, "fill-opacity": 0.35 }}
              />
              <Layer
                id="focused-layer-highlight-line"
                type="line"
                filter={highlightFilter}
                paint={{ "line-color": colors.accentInk, "line-width": 3 }}
              />
            </>
          ) : null}
        </GeoJSONSource>
      ) : null}
    </MapLibreMapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
});
