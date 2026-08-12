/**
 * Web current-position boundary — the browser Geolocation API. Metro
 * resolves this file for web builds; `currentPosition.ts` is the native
 * counterpart. This is the only place `src/lib/` touches a location API
 * directly.
 */

import { err, ok, type Result } from "../result.ts";
import { asLngLat, type LngLat } from "./types.ts";

export type CurrentPositionError =
  | { kind: "permission-denied" }
  | { kind: "unavailable"; message: string }
  | { kind: "unsupported" };

export async function getCurrentPosition(): Promise<
  Result<LngLat, CurrentPositionError>
> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return err({ kind: "unsupported" });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          resolve(
            ok(asLngLat(position.coords.longitude, position.coords.latitude)),
          );
        } catch {
          resolve(err({ kind: "unavailable", message: "Invalid coordinates" }));
        }
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          resolve(err({ kind: "permission-denied" }));
        } else {
          resolve(err({ kind: "unavailable", message: geoError.message }));
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
