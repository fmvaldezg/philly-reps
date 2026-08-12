# Progress

## What's done

### Core library (`src/lib/`)
- **Types & Result**: `src/lib/result.ts` (Result<T,E>), `src/lib/geo/types.ts` (LngLat), `src/lib/districts/types.ts` (DistrictLayer, DistrictLevel), `src/lib/reps/types.ts` (Official, Office, LookupResult)
- **District registry**: `src/lib/districts/registry.ts` — 5 layers (city-limits, council, congress, pa-senate, pa-house)
- **Resolver**: `src/lib/districts/resolve.ts` — point-in-polygon against bundled GeoJSON, skips boundary layers
- **Geocoder**: `src/lib/geo/geocode.ts` — Census geocoder client with zod validation, `normalizeAddress()` appends "Philadelphia, PA" when missing
- **Rep lookup**: `src/lib/reps/lookup.ts` — `resolveAndLookup()` orchestrates geocode → resolve districts → match reps

### Data
- `assets/districts/city-limits.geojson` — Philly boundary (1 feature)
- `assets/districts/council-2024.geojson` — 10 council districts, clipped & simplified
- `assets/data/federal.json` — 19 PA federal reps (17 House + 2 Senate), from congress-legislators
- `assets/data/state.json` — 252 PA state reps, from Open States
- `data/manual/philly-council.json` — 17 city council members (10 districts + 7 at-large), hand-maintained

### UI (web only)
- `src/components/HomeScreen.tsx` — address input → geocode → confirm → resolve → results
- `src/components/ResultsList.tsx` — groups officials by Federal / State / City
- `src/components/OfficialCard.tsx` — renders office, name, party, contact methods; "Not listed" for missing fields
- Uses design tokens from `src/styles/tokens.ts` — no hardcoded hex

### CORS proxy
- `metro.config.js` — dev proxy middleware, `/api/geocode` → Census, validates query params against allowlist
- `api/geocode.ts` — Vercel Edge Function for prod, same path & contract
- `src/lib/net/fetch.ts` (native passthrough) vs `src/lib/net/fetch.web.ts` (rewrites Census URLs to `/api/geocode`)

### Build scripts
- `scripts/build-council.ts` — fetches council districts, clips to city limits, simplifies, writes GeoJSON
- `scripts/build-reps.ts` — fetches C1 (congress-legislators) + C2 (Open States), filters to PA, joins on bioguide_id, writes `assets/data/federal.json` + `assets/data/state.json`
- `scripts/verify-data.ts` — `pnpm data:verify`, checks every district file loads and every rep has source_url + verified_on

## Current issue

`lookupReps()` in `src/lib/reps/lookup.ts` was a stub returning `[]`. Wired it up to load the three rep data files and match by layerId + districtNumber. Added debug logging to diagnose why the UI still shows "representative contact data is not available yet" — the JSON imports may not be reaching the Metro bundle.

## What's left
1. Fix rep lookup (in progress — debugging JSON import resolution)
2. Step 5: Map with user's point + highlighted polygon
3. Step 6: Remaining district layers (congress, pa-senate, pa-house)
4. Step 8: Accessibility pass
