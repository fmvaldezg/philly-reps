/**
 * Native current-position boundary. Metro resolves this file for native
 * builds; `currentPosition.web.ts` is the browser counterpart. This is the
 * only place `src/lib/` touches a location API directly.
 */

import * as Location from "expo-location";

import { err, ok, type Result } from "../result.ts";
import { asLngLat, type LngLat } from "./types.ts";

export type CurrentPositionError =
  | { kind: "permission-denied" }
  | { kind: "unavailable"; message: string }
  | { kind: "unsupported" };

export async function getCurrentPosition(): Promise<
  Result<LngLat, CurrentPositionError>
> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    return err({ kind: "permission-denied" });
  }

  try {
    const position = await Location.getCurrentPositionAsync({});
    return ok(asLngLat(position.coords.longitude, position.coords.latitude));
  } catch (e) {
    return err({
      kind: "unavailable",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
