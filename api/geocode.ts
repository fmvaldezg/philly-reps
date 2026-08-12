/**
 * Vercel Edge Function: /api/geocode
 *
 * Proxies requests to the U.S. Census geocoder. Validates query params,
 * forwards only the allowed set, returns the Census response unchanged.
 * No state, no cache, no transformation.
 *
 * Valid params: address, benchmark, vintage, format.
 * Rejects anything else with 400 Bad Request.
 */

const CENSUS_BASE =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const ALLOWED_PARAMS = new Set(["address", "benchmark", "vintage", "format"]);

function validateQuery(url) {
  const params = new URL(url).searchParams;
  const invalid = [];
  for (const key of params.keys()) {
    if (!ALLOWED_PARAMS.has(key)) {
      invalid.push(key);
    }
  }
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `invalid query params: ${invalid.join(", ")}`,
    };
  }
  if (!params.has("address")) {
    return { valid: false, error: "missing required param: address" };
  }
  return { valid: true, params };
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed\n", { status: 405 });
  }

  const validation = validateQuery(request.url);
  if (!validation.valid) {
    return new Response(`Bad Request: ${validation.error}\n`, { status: 400 });
  }

  const upstreamUrl = `${CENSUS_BASE}?${validation.params.toString()}`;
  const upstream = await fetch(upstreamUrl, {
    headers: { "User-Agent": "philly-reps-proxy" },
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") || "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export const config = {
  runtime: "edge",
};
