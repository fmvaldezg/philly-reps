# Philly Reps — Spec

Goal: a resident types their home address and gets every elected official who represents
that address, with real contact information, on a map that shows each district boundary.
Philadelphia first; the architecture should not make a second city impossible.

## Decisions made

1. Scope beyond Philadelphia — city-only for v1. Everything below assumes city-only,
   with a graceful "outside Philadelphia" state.
2. Ward/division committeepeople — excluded from v1. Not government offices, and the
   source data is poorly maintained; revisit only if a user asks for it.
3. Judges (Common Pleas, Municipal) — omitted for v1.
4. The map is secondary to the results list, not a separate tab. Results render first
   and work with no map at all; the map (SPEC step 5) appears alongside them on the
   same screen and highlights whichever card is focused.

## User flow

1. Address entry. One text field, autocomplete off, plus "use my location" on native.
2. Geocode → `[lng, lat]` + a normalized display address. Show the match back to the user
   and let them correct it before results ("Did you mean 1234 Market St?").
3. If the point is outside the Philadelphia city boundary, stop with an explanatory
   state — do not render partial results.
4. Resolve districts locally, point-in-polygon, against every bundled layer.
5. Results: grouped by level (Federal → State → City), each card = office, name, party,
   district number, contact methods, "verified on" date.
6. Map: the user's point plus the boundary of whichever district card is focused. Tapping
   a card highlights its polygon; tapping a polygon scrolls to its card.

## Offices to cover

Philadelphia is coterminous with Philadelphia County, so there is no separate county
layer — city offices are the county offices.

**Federal**
- U.S. Senator ×2 (statewide, not district-based)
- U.S. Representative (congressional district)

**State (Pennsylvania)**
- Governor, Lieutenant Governor, Attorney General, Auditor General, Treasurer (statewide)
- PA State Senator (upper / SLDU)
- PA State Representative (lower / SLDL)

**City of Philadelphia**
- Mayor (citywide)
- City Council district member (1 of 10, district-based)
- City Council at-large members (7, citywide) — easy to forget, and constituents can
  contact any of them
- District Attorney, City Controller, Sheriff, City Commissioners ×3, Register of Wills
  (all citywide row offices)

**Notes on things people expect but that don't apply**
- Philadelphia's Board of Education is appointed by the Mayor, not elected. If a user
  looks for a school board member, say so explicitly rather than showing nothing.
- Ward and Division are political-party structures, not government offices. If included,
  label them clearly as party committee positions.

## Architecture

Single Expo + TypeScript codebase.

- Native: `@maplibre/maplibre-react-native` (wraps MapLibre Native iOS/Android).
- Web: `maplibre-gl`. Split at the component level — `Map.native.tsx` / `Map.web.tsx`
  behind one shared prop interface. Do not try to make one MapLibre binding cover both.
- Basemap: `https://tiles.openfreemap.org/styles/positron` on both platforms.
  OpenFreeMap needs no API key. Keep the OSM attribution visible — it is required.

**District resolution is local.** All Philadelphia district boundaries together are small
enough to bundle as simplified GeoJSON (target: under ~1.5 MB total after simplification
with mapshaper at ~0.5% tolerance, visually indistinguishable at city zoom levels). Use
`@turf/boolean-point-in-polygon`. Consequences worth stating: no API keys, no rate limits,
no per-lookup cost, results in milliseconds, and the whole app works offline after the
geocode. Build a bounding-box prefilter before the polygon test.

**Only geocoding needs the network.** Nothing else at runtime.

## Geocoding

Primary: **U.S. Census Geocoder**. No API key, no rate limit for interactive use, and
purpose-built for exactly this.

```
https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress
  ?address=<urlencoded>&benchmark=Public_AR_Current&vintage=Current_Current&format=json
```

With `returntype=geographies` it returns not only the coordinate but the congressional
district and both state legislative districts directly in `result.addressMatches[0]
.geographies` (keys look like `119th Congressional Districts`, `2024 State Legislative
Districts - Upper`, `... - Lower`). Use these as a **cross-check** against the local
point-in-polygon result. If they disagree, log a warning and trust the local geometry, but
surface the discrepancy in dev builds — a mismatch usually means the bundled boundary file
is stale.

Note the geography key names embed a Congress number and a vintage year and *will* change
after the next redistricting. Match them by prefix, not by exact string equality.

Fallback: **Nominatim**, only if Census returns no match. Its usage policy requires an
identifying `User-Agent`, caps you at roughly 1 request/second, and prohibits heavy or
bulk use — so it is a fallback, not a primary, and must be debounced hard. Do not ship a
Nominatim-only path.

Address entry should tolerate the messy input real people type: no ZIP, "Philly" instead
of "Philadelphia", missing unit numbers. Test with a fixture set of deliberately sloppy
inputs.

## Boundary data sources

Verified as of the date noted. Anything not on this list must be fetched and confirmed
before use, then added here with a date.

**Philadelphia City Council districts (2024)** — verified 2026-08-11
```
https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Council_Districts_2024/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson
```
GeoJSON download alternative:
```
https://hub.arcgis.com/api/v3/datasets/1ba5a5d68f4a4c75806e78b1d9245924_0/downloads/data?format=geojson&spatialRefId=4326&where=1%3D1
```
Catalog page (check here for newer vintages before assuming 2024 is current):
`https://opendataphilly.org/datasets/city-council-districts/`
Licensed under the City of Philadelphia terms of use — attribution required in the app's
about screen.

**Congressional, PA Senate, PA House boundaries** — not yet verified. Two candidate
sources, both need confirming before use:
- Census cartographic boundary files under `https://www2.census.gov/geo/tiger/` — filter
  to state FIPS 42, then clip to the Philadelphia city boundary.
- PASDA (`https://mapservices.pasda.psu.edu/`), which hosts PA legislative layers.

Pick one, verify the response shape and the vintage year, clip to the city, simplify, and
record the exact URL and retrieval date here.

**City boundary, wards, divisions** — OpenDataPhilly, `https://opendataphilly.org/datasets/`.
Look up the current resource URLs there; do not guess them.

## Representative contact data

There is no single free API for this anymore — Google's Civic Information Representatives
API (`representativeInfoByAddress`) was shut down on 30 April 2025. Assemble from these
instead, at build time, into static JSON:

- **Congress**: `unitedstates/congress-legislators` on GitHub. Public-domain YAML/CSV with
  current members, offices, phone numbers, contact forms, social accounts. Well maintained.
- **PA state legislators**: Open States. API v3 at `https://v3.openstates.org/` (free key,
  passed as `X-API-KEY`), including a geo endpoint that returns legislators for a lat/lng.
  Bulk downloads at `https://open.pluralpolicy.com/data/` are better for a build step.
  Note Open States is now operated by Plural; the free API still exists but treat it as a
  build-time dependency you can survive losing, not a runtime one.
- **5 Calls** publishes a free representatives API (`https://5calls.org/representatives-api/`)
  covering Congress plus statewide officials — useful as a cross-check on phone numbers.
- **Philadelphia city offices**: no API. Maintain `data/manual/philly-council.json` by hand
  from `phila.gov` and `phlcouncil.com`, with `source_url` and `verified_on` per record.
  Include both district and at-large members. Add a CI check that warns when any record's
  `verified_on` is more than 180 days old.

Contact fields to capture per official, all optional except name and office:
`district_office` (address + phone), `capitol_office` (address + phone), `email` or
`contact_form_url`, `website`, `party`, `term_end`, `photo_url`, `source_url`,
`verified_on`.

## Design tokens

Your palette, with the line-of-sight semantics from the previous project remapped. Keep
these in `src/styles/tokens.ts` as the single source; the web build re-exports them as CSS
custom properties so both platforms stay in sync.

```
/* surface */
--bg:          rgb(254,254,254)   /* page background */
--surface:     #ffffff            /* cards, popups, header */
--surface-alt: #f6f6f6            /* hover, inactive tabs, map panel */
--border:      #e3e3e3            /* dividers, card borders */
--shadow:      rgba(0,0,0,0.07)

/* text */
--text:        #111111
--muted:       #888888            /* metadata, "verified on" dates */

/* brand */
--accent:      #FF5A5F            /* brand red — fills, borders, focus ring */
--accent-ink:  #C0272D            /* darkened accent for text and small icons */

/* level colors — one per tier of government, used for district polygon
   fills and the left rule on each card. These do the work --teal and
   --warn used to do. */
--fed:         #1F6FEB            /* federal */
--state:       #7C3AED            /* state */
--city:        #0d9488            /* city — your old --teal, reused */

/* status */
--ok:          #0d9488
--warn:        #D97706            /* stale data, low-confidence geocode match */
--error:       #C0272D

/* geometry */
--r:           10px
--r-sm:        6px
--header-h:    56px
```

Notes:

- `--accent` at #FF5A5F on white lands near a 3:1 contrast ratio — fine for borders,
  large text, and non-text UI, but it fails WCAG AA for body copy. Use `--accent-ink` for
  any text under 18pt. Verify with a contrast checker rather than trusting this note.
- The three level colors need to survive being polygon fills at ~25% opacity over a
  Positron basemap *and* work as solid 3px rules on white. Check both before committing.
- Do not encode meaning in color alone. Every level color pairs with a text label
  ("Federal", "State", "City") — a meaningful fraction of users won't distinguish
  blue/purple fills.
- Positron is deliberately desaturated, which is why these fills read well on it. If the
  basemap ever changes, the fill opacities need rechecking.
- Add a dark mode by inverting the surface and text ramps only; keep the level colors,
  lightening `--fed` and `--state` for contrast on dark.

## Build order

1. `src/lib/` scaffold: types, `Result`, zod schemas, the district registry.
2. Data build script → one district layer end to end (Council districts — the URL is
   already verified) → golden tests against ~10 known addresses.
3. Census geocoder client with zod validation and the "did you mean" confirmation step.
4. Results list, no map. This is a usable product on its own; ship it internally.
5. Map with the user's point and one highlighted polygon.
6. Remaining district layers.
7. Rep contact data build + the manual Philadelphia file.
8. Accessibility pass: screen-reader labels on cards, focus order, reduced motion,
   the map is never the only way to get information.

Do not start step 5 before step 4's tests pass.

## Golden test fixtures

`src/lib/districts/fixtures.json` holds addresses with hand-verified expected districts,
covering: a Center City address, one in each of at least three council districts, one on a
district boundary line, one address that spans a ZIP crossing two districts, an address
just outside the city line (expected: out-of-bounds), and one malformed input. Verify each
expectation by hand against the city's own lookup tool before adding it. These fixtures are
the contract — if a change breaks them, the change is wrong until proven otherwise.
