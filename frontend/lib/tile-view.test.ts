import assert from "node:assert/strict";
import test from "node:test";
import { tileView } from "./tile-view";

const field: [number, number][] = [[110.90733, -7.0891], [110.907364, -7.088561], [110.90682, -7.088561], [110.906786, -7.0891]];

test("a small field is shown close up, centered and inside the window", () => {
  const view = tileView(field, 400, 170);
  assert.equal(view.zoom, 17);
  const xs = view.points.map((p) => p[0]);
  const ys = view.points.map((p) => p[1]);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 200) < 1e-6);
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - 85) < 1e-6);
  assert.ok(Math.min(...xs) > 0 && Math.max(...xs) < 400 && Math.min(...ys) > 0 && Math.max(...ys) < 170);
});

test("tiles cover the whole window and use the Clarity endpoint", () => {
  const view = tileView(field, 400, 170);
  assert.ok(view.tiles.every((t) => t.url.startsWith("https://clarity.maptiles.arcgis.com/") && t.url.includes(`/tile/${view.zoom}/`)));
  assert.ok(Math.min(...view.tiles.map((t) => t.left)) <= 0 && Math.min(...view.tiles.map((t) => t.top)) <= 0);
  assert.ok(Math.max(...view.tiles.map((t) => t.left + 256)) >= 400 && Math.max(...view.tiles.map((t) => t.top + 256)) >= 170);
});

test("a large field zooms out until it fits", () => {
  const big: [number, number][] = [[121.4, -3.5], [121.5, -3.5], [121.5, -3.56], [121.4, -3.56]];
  const view = tileView(big, 400, 170);
  assert.ok(view.zoom < 15);
  const xs = view.points.map((p) => p[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) <= 400 * 0.55);
});
