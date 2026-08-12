# docs/DATA-SOURCES.md

Every source the app depends on. **A source is not usable until someone has fetched it and
filled in the Verified block.** The agent must not use a URL from this file that has no
Verified block, and must not add a URL to this file without fetching it first.

Status key: ✅ fetched and confirmed · 🔍 URL known, not yet confirmed · ❓ URL unknown

---

## A. Boundary layers

For each one, record: **feature count · property names · CRS · vintage year · file size
after simplification.** The property names matter most — every layer names its district
field differently (`DISTRICT`, `district_no`, `LEG_DISTRI`, `WARD_NUM`…) and guessing is
how you get a map that renders but resolves nothing.

### A1. City limits 🔍
Needed for the "outside Philadelphia" check before any lookup runs.
```
https://hub.arcgis.com/api/v3/datasets/405ec3da942d4e20869d4e1449a2be48_0/downloads/data?format=geojson&spatialRefId=4326&where=1%3D1
```
Verified: yes · Features: 1 · Fields: Geometry, objectid, Shape_Area, Shape_Length.

### A2. City Council districts, 2024 ✅
Confirmed present on OpenDataPhilly; the endpoint itself still needs a shape check.
```
https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Council_Districts_2024/FeatureServer/0/query?where=1=1&outFields=*&f=geojson
```
Catalog page: `https://opendataphilly.org/datasets/city-council-districts/`
Check the catalog page first — if a 2028 vintage has appeared, use it.
Verified: Yes · Features: 10 · Fields: Geometry, objectid, district, shape_leng, district_num, Shape__Area, Shape__Length.

### A3. PA congressional districts, 2024 🔍
PennDOT-digitized, hosted by PASDA. Direct GeoJSON:
```
https://www.pasda.psu.edu/json/PaCongressional2024_03.geojson
```
Catalog page: `https://opendataphilly.org/datasets/pa-dot-congressional-districts/`
⚠️ License listed as "not specified" on OpenDataPhilly. Confirm attribution terms before
shipping, or fall back to Census TIGER, which is public domain.
⚠️ Statewide file — clip to city limits (A1) before bundling.
Verified: Yes · Features: 17 (expect 17 statewide, ~4 touching Philly) · Fields: Geometry, MSLINK, AREA, URL, LEN, GPID, C_FIRSTNAM, HOME_COUNT, PARTY, C_LASTNAME, LEG_DISTRI, Shape_Length.

### A4. PA Senate districts ❓
PASDA hosts these as a PennDOT layer, but I have not confirmed the filename. Start at the
PASDA dataset browser and the PennDOT MapServer directory:
```
https://data-pennshare.opendata.arcgis.com/datasets/PennShare::pennsylvania-senate-districts/about
```
List the layers, find the state senate one, note its layer index, then query it. Do not
pattern-match a filename off A3's URL — verify the real one.
Verified: Yes · Features: 50 (expect 50 statewide, ~7 in Philly) · Fields: Geometry, OBJECTID, MSLINK, LEG_DISTRICT_NO, S_LASTNAME, S_FIRSTNAME, HOME_COUNTY, PARTY.

### A5. PA House districts ❓
https://www.pasda.psu.edu/json/PaHouse2024_03.geojson
Verified: Yes · Features: 203 (expect 203 statewide, ~26 in Philly) · Fields: Geometry, MSLINK, H_FIRSTNAM, AREA, URL, H_LASTNAME LEN, GPID, HOME_COUNT, Shape_Leng, PARTY, LEG_DISTRI.

### A6. Political wards 🔍 *(optional — only if you include committee people)*
```
https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Political_Wards/FeatureServer/0/query?where=1=1&outFields=*&f=geojson
```
Verified: Yes · Features: 66 (expect 66) · Fields: objectid, ward_num, Shape_Area, Shape_Length.

### A7. Ward divisions 🔍 *(optional)*
Catalog page: `https://opendataphilly.org/datasets/political-ward-divisions/`
Pull the current resource URL from there. Roughly 1,700 features — this one is big enough
that bundling it needs a second look at your size budget.
Verified: Yes · Features: 1703 · Fields: OBJECTID, SHORT_DIV_NUM, DIVISION_NUM, Shape_Area, Shape_Length.

**Cross-check for all of the above:** the PennDOT layers carry legislator name and party
as attributes. Useful for sanity-checking your contact data, but treat them as stale —
they are transportation-planning layers, not an officials roster.

---

## B. Geocoding

### B1. U.S. Census Geocoder 🔍
```
curl -s "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=1400+John+F+Kennedy+Blvd,+Philadelphia,+PA+19107&benchmark=Public_AR_Current&vintage=Current_Current&format=json" \
  | jq '.result.addressMatches[0] | {coords: .coordinates, geo: (.geographies|keys)}'
```
Record the **exact geography key strings** it returns — they embed a Congress number and a
vintage year (`119th Congressional Districts`, `2024 State Legislative Districts - Upper`)
and will change. Save the whole response to `src/lib/geo/__fixtures__/census-response.json`
so tests don't hit the network.
Verified: yes · Geography keys: "119th Congressional Districts", "2020 Census Blocks","2024 State Legislative Districts - Lower", "2024 State Legislative Districts - Upper", "Census Tracts", "Combined Statistical Areas", "Counties", "County Subdivisions", "Incorporated Places", "States","Urban Areas"

### B2. Nominatim (fallback only) 🔍
`https://nominatim.openstreetmap.org/search?format=jsonv2&q=...`
Read the usage policy before writing the client — it requires an identifying User-Agent,
caps you near 1 req/sec, and prohibits bulk use. Confirm the current terms yourself.
Verified: Yes

---

## C. Representatives and contact information

This is the part with no single source. Everything here needs a `verified_on` date per
record in the output.

### C1. `unitedstates/congress-legislators` 🔍
`https://github.com/unitedstates/congress-legislators` — public domain YAML/CSV, current
members, offices, phones, contact forms. Confirm the raw file paths and which file carries
district office addresses (it's split across several).
Verified: Yes · Files used: `https://unitedstates.github.io/congress-legislators/legislators-current.csv`

### C2. Open States API v3 🔍
`https://v3.openstates.org/` — free key, sent as `X-API-KEY`. Register, then confirm the
geo endpoint's response shape for a Philadelphia lat/lng. Bulk downloads at
`https://open.pluralpolicy.com/data/` are the better build-time input.
⚠️ Now operated by Plural. Treat as a build-time dependency you could survive losing.
Verified: Yes · Key obtained: f6bd6eec-1b28-4e76-8d7a-5f26b4ea2436

### C3. 5 Calls representatives API ❌
`https://api.5calls.org/v1/representatives?location=<lat>,<lng>` — was a free
cross-check on phone numbers, covering Congress plus statewide officials.
Dropped: the API key recorded here returns `{"error":"not authorized"}` as of
2026-08-11. The 5 Calls API page (https://5calls.org/representatives-api/)
now gates API docs behind an email signup form. Not usable until access is
re-established. C1 + C2 are sufficient as primary sources.
Verified: No · Key 1d1b5346a681af3f4fe770e3 rejected on 2026-08-11

### C4. Philadelphia City Council — **manual, no API** ❓
Ten district members plus seven at-large. Source: `phlcouncil.com` and `phila.gov`.
Capture per member: name, district or at-large, party, City Hall office + phone, district
office + phone, email, website, source URL, date checked.
⚠️ This file is the highest-risk data in the project. It is hand-typed, it goes stale on
election cycles, and it is the number people will actually dial.
Compiled by: FV on 8/11/26 file: /data/c4_philadelphia_city_council.csv

### C5. Citywide row offices — **manual** ❓
Mayor, DA, City Controller, Sheriff, City Commissioners ×3, Register of Wills.
Source: `phila.gov`. Same fields as C4.
Compiled by: ______ on ______

### C6. PA statewide officials — **manual or C3** ❓
Governor, Lt. Governor, AG, Auditor General, Treasurer.
Compiled by: ______ on ______

---

## D. Ground truth for the golden fixtures

Not a data source the app uses — the reference you check your results *against*. Without
this, "the tests pass" only means the code agrees with itself.

### D1. The city's own address lookup ❓
Philadelphia runs a property/address atlas that reports council district, ward, and
division for an address. Find the current one on `phila.gov`, confirm it's authoritative,
and use it to hand-verify every fixture.
Tool used: ______

### D2. Fixture set — hand-verify each one
- [ ] A Center City address
- [ ] Three addresses in three different council districts
- [ ] One address on a council district boundary line
- [ ] One in a ZIP that spans two districts
- [ ] One just outside the city line → expected: out of bounds
- [ ] One malformed input → expected: geocoder no-match

For each, record the expected congressional / state senate / state house / council
district in `src/lib/districts/fixtures.json`, with a note on where you verified it.

---

## Re-verification

Boundaries change with redistricting (roughly decennial, plus court orders — PA's
congressional map was redrawn by the state Supreme Court in 2022). People change every
election. Set a calendar reminder to re-check section C after each general election, and
add a CI warning when any record's `verified_on` is more than 180 days old.
