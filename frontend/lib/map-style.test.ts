import { test } from "node:test";
import assert from "node:assert/strict";
import type { Map, TerrainSpecification } from "maplibre-gl";
import { clarityStyle, mapTilerTerrainUrl, syncTerrain } from "./map-style";

test("Clarity is a keyless raster globe with parent-tile fallback and visible attribution", () => {
  const style = clarityStyle();
  const source = style.sources.clarity;
  assert.equal(style.projection?.type, "globe");
  assert.ok(source.type === "raster" && source.tiles);
  const url = new URL(source.tiles[0]);
  assert.equal(url.hostname, "clarity.maptiles.arcgis.com");
  assert.equal(url.searchParams.get("blankTile"), "false");
  assert.equal(url.searchParams.has("key"), false);
  assert.ok(source.attribution?.includes("Esri"));
  assert.match(mapTilerTerrainUrl("key"), /terrain-rgb-v2/);
});
test("terrain activates at zoom 11, avoids repeated updates, and switches off below 11", () => {
  let zoom = 10.9,
    calls = 0;
  let terrain: TerrainSpecification | null = null;
  const map = {
    getZoom: () => zoom,
    getTerrain: () => terrain,
    setTerrain: (value: TerrainSpecification | null) => {
      calls++;
      terrain = value;
    },
  } as unknown as Pick<Map, "getZoom" | "getTerrain" | "setTerrain">;
  syncTerrain(map);
  assert.equal(calls, 0);
  zoom = 11;
  syncTerrain(map);
  assert.deepEqual(terrain, { source: "maptiler-terrain", exaggeration: 1.4 });
  syncTerrain(map);
  assert.equal(calls, 1);
  zoom = 10;
  syncTerrain(map);
  assert.equal(terrain, null);
  assert.equal(calls, 2);
  syncTerrain(map);
  assert.equal(calls, 2);
});
