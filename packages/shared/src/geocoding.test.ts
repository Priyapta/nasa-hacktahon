import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLocations, parseCoordinates } from "./geocoding.js";

test("coordinate search converts latitude, longitude into GeoJSON order", () => {
  assert.deepEqual(parseCoordinates("-7.8, 110.36")?.center, [110.36, -7.8]);
  assert.equal(parseCoordinates("Yogyakarta"), undefined);
  assert.equal(parseCoordinates(",110"), undefined);
  assert.throws(() => parseCoordinates("91,110"));
  assert.throws(() => parseCoordinates("-7,181"));
});

test("Photon results provide real coordinates, a readable label, and location zoom", () => {
  const results = normalizeLocations({
    features: [
      {
        geometry: { type: "Point", coordinates: [110.36, -7.8] },
        properties: {
          osm_type: "R",
          osm_id: 123,
          name: "Yogyakarta",
          state: "Yogyakarta",
          country: "Indonesia",
          type: "city",
        },
      },
      {
        geometry: { type: "Point", coordinates: [NaN, 0] },
        properties: { name: "Invalid" },
      },
      {
        geometry: { type: "Polygon", coordinates: [] },
        properties: { name: "Invalid" },
      },
    ],
  });
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].center, [110.36, -7.8]);
  assert.equal(results[0].name, "Yogyakarta, Indonesia");
  assert.equal(results[0].zoom, 11);
  assert.throws(() => normalizeLocations({ error: "upstream failed" }));
});
