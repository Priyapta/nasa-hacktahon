import { test } from "node:test";
import assert from "node:assert/strict";
import type { FarmField } from "@/types";
import { fieldsGeoJSON, measure } from "./geo";

test("saved field GeoJSON survives a JSON round trip with metadata and measurements", () => {
  const geometry: FarmField["geometry"] = {
    type: "Polygon",
    coordinates: [
      [
        [110, -7],
        [110.001, -7],
        [110.001, -7.001],
        [110, -7.001],
        [110, -7],
      ],
    ],
  };
  const field: FarmField = {
    id: "field-1",
    farmId: "farm-1",
    name: "North Field",
    locationName: "Yogyakarta",
    geometry,
    ...measure(geometry),
    currentCrop: "Rice",
    previousCrop: "Soybean",
    soilType: "",
    irrigationType: "Rainfed",
    notes: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  const collection = JSON.parse(JSON.stringify(fieldsGeoJSON([field])));
  assert.equal(collection.type, "FeatureCollection");
  assert.equal(collection.features[0].type, "Feature");
  assert.equal(collection.features[0].id, field.id);
  assert.equal(collection.features[0].properties.farmId, field.farmId);
  assert.equal(collection.features[0].properties.name, field.name);
  assert.deepEqual(collection.features[0].geometry, geometry);
  assert.equal(
    measure(collection.features[0].geometry).areaHectares,
    field.areaHectares,
  );
  assert.deepEqual(fieldsGeoJSON([]), {
    type: "FeatureCollection",
    features: [],
  });
});
