# Progress

## What's done

### Core library (`src/lib/`)
- **Types & Result**: `src/lib/result.ts` (Result<T,E>), `src/lib/geo/types.ts` (LngLat), `src/lib/districts/types.ts` (DistrictLayer, DistrictLevel), `src/lib/reps/types.ts` (Official, Office, LookupResult)
- **District registry**: `src/lib/districts/registry.ts` — 5 layers (city-limits, council, congress, pa-senate, pa-house), all built
- **Resolver**: `src/lib/districts/resolve.ts` — point-in-polygon against bundled GeoJSON, loaded via static imports (not the filesystem — this runs in the browser and the native app, not just Node). `getLayerGeoJSON()` also backs the map's polygon drawing.
- **Geocoder**: `src/lib/geo/geocode.ts` — Census geocoder client with zod validation, `normalizeAddress()` appends "Philadelphia, PA" when missing
- **Rep lookup**: `src/lib/reps/lookup.ts` — `resolveAndLookup()` orchestrates geocode → resolve districts → match reps against all 5 layers plus statewide/citywide offices

### Data
- `assets/districts/city-limits.json`, `council.json`, `congress.json`, `pa-senate.json`,
  `pa-house.json` — all 5 district layers, clipped & simplified, ~516 KB total (SPEC budget: ~1.5 MB)
- `assets/data/federal.json` — 19 PA federal reps (17 House + 2 Senate), from congress-legislators
- `assets/data/state.json` — 252 PA state reps, from Open States
- `data/manual/philly-council.json` — 17 city council members (10 districts + 7 at-large), hand-maintained

### UI (web verified; native written but unverified — see below)
- `src/components/HomeScreen.tsx` — address input → geocode → confirm → resolve → results + map
- `src/components/ResultsList.tsx` / `OfficialCard.tsx` — grouped by level; cards for district-based
  offices are tappable and highlight their polygon on the map
- `src/components/Map.web.tsx` (maplibre-gl) / `Map.native.tsx` (@maplibre/maplibre-react-native) —
  OpenFreeMap Positron basemap, marker at the geocoded point, focused district's boundary
- Uses design tokens from `src/styles/tokens.ts` — no hardcoded hex

### CORS proxy
- `metro.config.js` — dev proxy middleware, `/api/geocode` → Census, validates query params against allowlist
- `api/geocode.ts` — Vercel Edge Function for prod, same path & contract
- `src/lib/net/fetch.ts` (native passthrough) vs `src/lib/net/fetch.web.ts` (rewrites Census URLs to `/api/geocode`)

### Build scripts
- `scripts/build-districts.ts` — fetches a district layer, clips to city limits, simplifies, writes
  `assets/districts/<id>.json` (`pnpm data:build <id>` or `--all`)
- `scripts/build-reps.ts` — fetches C1 (congress-legislators) + C2 (Open States), filters to PA, joins
  on bioguide_id, writes `assets/data/federal.json` + `state.json` (`pnpm data:build:reps`)
- `scripts/verify-data.ts` — `pnpm data:verify`, checks every district file loads and every rep has
  source_url + verified_on

## What's left
1. Citywide row offices (Mayor, DA, Controller, Sheriff, Commissioners, Register of Wills) and PA
   statewide officials (Governor, Lt. Gov, AG, Auditor General, Treasurer) — `DATA-SOURCES.md` C5/C6,
   still unbuilt.
2. Native map is written but not visually verified — no iOS/Android simulator in this environment.
   Needs `expo prebuild` + a dev-client rebuild (it has native modules, won't run in Expo Go), then a
   real device/simulator check.
3. Step 8: Accessibility pass.
4. "Tapping a polygon scrolls to its card" (SPEC user flow #6, the map→card direction) is not wired —
   only card→map is.
