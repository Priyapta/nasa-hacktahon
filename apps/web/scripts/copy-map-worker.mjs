import { copyFileSync, mkdirSync, statSync } from "node:fs";
import assert from "node:assert/strict";
const source = new URL(".", import.meta.resolve("maplibre-gl"));

const target = new URL("../public/maplibre/", import.meta.url);
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(
    new URL(file, source),
    new URL(file, target),
  );
}
assert.ok(
  statSync(new URL("maplibre-gl-worker.mjs", target)).size > 0,
  "MapLibre worker must be present",
);
