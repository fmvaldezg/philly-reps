/**
 * Metro config. Expo Router reads the `root` from app.config.js extra.router.
 * This version of expo-router doesn't ship a metro-config wrapper; the
 * default Expo metro config is sufficient.
 *
 * Dev proxy: `/api/geocode?...` → Census geocoder. Forwards the validated
 * query string, returns the response body unchanged. Logs each request.
 */

const { getDefaultConfig } = require("expo/metro-config");
const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

const CENSUS_BASE =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";

/** Valid Census query parameters. Anything else is rejected. */
const ALLOWED_PARAMS = new Set(["address", "benchmark", "vintage", "format"]);

/**
 * Validate query params. Returns {valid: true, params: URLSearchParams} or
 * {valid: false, error: string}.
 */
function validateQuery(rawQuery) {
  const params = new URLSearchParams(rawQuery);
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

/** Proxy middleware for Metro dev server. */
function proxyMiddleware(req, res, next) {
  if (!req.url?.startsWith("/api/geocode")) {
    return next();
  }

  const parsed = new URL(req.url, "http://localhost");
  const query = parsed.search.slice(1); // strip leading '?'

  const validation = validateQuery(query);
  if (!validation.valid) {
    console.log(`[proxy] /api/geocode rejected: ${validation.error}`);
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end(`Bad Request: ${validation.error}\n`);
    return;
  }

  const upstreamUrl = `${CENSUS_BASE}?${validation.params.toString()}`;
  console.log(`[proxy] /api/geocode → ${upstreamUrl}`);

  const client = upstreamUrl.startsWith("https") ? https : http;
  const proxyReq = client.request(
    upstreamUrl,
    { method: "GET", headers: { "User-Agent": "philly-reps-dev-proxy" } },
    (proxyRes) => {
      res.statusCode = proxyRes.statusCode ?? 500;
      res.setHeader(
        "Content-Type",
        proxyRes.headers["content-type"] || "application/json",
      );
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    console.error("[proxy] upstream error:", err.message);
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain");
    res.end(`Bad Gateway: ${err.message}\n`);
  });

  proxyReq.end();
}

const config = getDefaultConfig(__dirname);

// Attach the proxy middleware to Metro's dev server.
config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    proxyMiddleware(req, res, () => middleware(req, res, next));
  };
};

module.exports = config;
