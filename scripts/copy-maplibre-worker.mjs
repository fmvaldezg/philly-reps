/**
 * maplibre-gl ships its tile-parsing worker as a separate file
 * (dist/maplibre-gl-worker.mjs) that it loads at runtime via
 * `new Worker(new URL(...))`. Metro doesn't understand that bundling
 * pattern (it's a Vite/Webpack convention), so the worker never gets
 * emitted into the web build and tiles silently never render — only the
 * basemap background and controls show up. The worker itself then imports
 * a second file, maplibre-gl-shared.mjs (code shared with the main-thread
 * bundle), as a relative ES module import resolved against wherever the
 * worker script was served from — that has to ship alongside it too.
 *
 * The fix: copy both files into public/, which Expo's web export copies
 * verbatim to the site root, then Map.web.tsx points maplibre-gl at the
 * worker directly with setWorkerUrl(). Runs on every install so the copies
 * never drift from whatever maplibre-gl version is actually installed.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = join("node_modules", "maplibre-gl", "dist");
const DEST_DIR = "public";
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

mkdirSync(DEST_DIR, { recursive: true });
for (const file of FILES) {
  const src = join(DIST_DIR, file);
  const dest = join(DEST_DIR, file);
  copyFileSync(src, dest);
  console.log(`copied ${src} -> ${dest}`);
}
