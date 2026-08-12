# Philly Reps

Type in a Philadelphia address, get every elected official who represents it — federal,
state, and city — with real contact info and a map of the district boundaries. One Expo
codebase, runs on web and native.

**Live:** https://philly-reps.vercel.app

## How it works

1. You type an address (or tap "Use my location") — the U.S. Census Geocoder resolves an
   address to a coordinate; location skips that step entirely.
2. The app checks that coordinate against bundled district boundaries (Council, Congress,
   PA Senate, PA House) entirely offline — no API calls, no rate limits.
3. Results are grouped into tabs (Federal, State Senate, State House, City), each with a
   map showing the matching district highlighted.

Full product spec: [`docs/SPEC.md`](docs/SPEC.md). Contributor conventions and hard rules:
[`AGENTS.md`](AGENTS.md).

## Development

```bash
pnpm install
pnpm dev          # expo start --web — press w for web, i/a for simulators
pnpm test         # unit + district-resolution golden tests
pnpm typecheck
pnpm lint
```

## Keeping representative data current

This is the part that actually needs upkeep. There's no single API for "every elected
official in Philadelphia," so data comes from three places with two very different update
processes.

### Federal & state legislators — automated, just re-run the script

U.S. Senators, U.S. Representative, and PA state legislators come from public data
sources ([`unitedstates/congress-legislators`](https://github.com/unitedstates/congress-legislators)
and Open States/Plural). To refresh them:

```bash
pnpm data:build:reps
```

This fetches both sources fresh, filters to Pennsylvania, and overwrites
`assets/data/federal.json` and `assets/data/state.json`. It fails loudly (not silently) if
a record is missing a required field or the record count looks wrong — if it fails, don't
patch the output by hand, fix the script or wait for the upstream source to stabilize.

Run this after every Congressional term change or PA legislative election, or whenever you
suspect the data is stale.

### Philadelphia City Council — manual, no API exists

There is no public API for city council contact info, so
[`data/manual/philly-council.json`](data/manual/philly-council.json) is hand-maintained
against [`phlcouncil.com`](https://phlcouncil.com) and [`phila.gov`](https://phila.gov).
This is the highest-risk file in the repo — it's hand-typed, it goes stale every election,
and it's the number a constituent will actually dial.

To update a member's record, edit their entry directly:

```json
{
  "name": "Full Name",
  "office": {
    "title": "City Council, District N",
    "level": "city",
    "layerId": "council",
    "districtNumber": "N",
    "id": "philly-council-N"
  },
  "cityHallOffice": { "address": "...", "phone": "..." },
  "districtOffice": { "address": "...", "phone": "..." },
  "email": "...",
  "website": "...",
  "sourceUrl": "the exact page you checked",
  "verifiedOn": "YYYY-MM-DD"
}
```

At-large members use `"districtNumber": null` instead of a district number. Every field
except `name` and `office` is optional — **if you can't verify a field, omit it. Never
guess or carry over an old value you can't confirm.** A wrong phone number sends someone to
a stranger, which is the single most important rule in this repo (see `AGENTS.md`).

Always update `verifiedOn` to the date you actually checked the source, even if nothing
changed — it's how the rest of us know the entry hasn't gone stale.

### Verifying everything

```bash
pnpm data:verify
```

Confirms every bundled district file loads and every representative record has a
`sourceUrl` and `verifiedOn`. Run this before committing any data change.

### What's not built yet

Citywide row offices (Mayor, DA, Controller, Sheriff, Commissioners, Register of Wills)
and PA statewide officials (Governor, Lt. Governor, AG, Auditor General, Treasurer) aren't
in the app yet — see `docs/DATA-SOURCES.md` sections C5/C6 if you want to add them; same
manual process as City Council.

## Updating district boundaries

Boundaries change roughly once a decade (redistricting) or by court order. To rebuild a
layer from its upstream source:

```bash
pnpm data:build council      # or congress / pa-senate / pa-house / city-limits
pnpm data:build --all        # rebuild every layer
```

Upstream URLs are recorded in [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md) — the build
script refuses to use a URL that isn't listed there. If a source moves, verify the new URL
and its shape first, then update that file with the date you checked it.

## Deployment

Hosted on Vercel — the web build and the `/api/geocode` proxy (a stateless pass-through to
the Census geocoder, needed because it doesn't send CORS headers) deploy together from one
`vercel.json`. Every push to `main` redeploys automatically.
