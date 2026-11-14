import { test } from "node:test";
import assert from "node:assert/strict";
import { measure } from "./geo";
test("measures geographic area in hectares and returns center", () => {
  const m = measure({
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01],
        [0, 0],
      ],
    ],
  });
  assert.ok(m.areaHectares > 123 && m.areaHectares < 124);
  assert.deepEqual(m.centroid, [0.005, 0.005]);
});
test("rejects a zero-area boundary", () =>
  assert.throws(() =>
    measure({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      ],
    }),
  ));

test("rejects invalid coordinates and intersecting rings", () => {
  assert.throws(() =>
    measure({
      type: "Polygon",
      coordinates: [
        [
          [181, 0],
          [182, 0],
          [182, 1],
          [181, 0],
        ],
      ],
    }),
  );
  assert.throws(() =>
    measure({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0.02, 0.02],
          [0.02, 0],
          [0, 0.01],
          [0, 0],
        ],
      ],
    }),
  );
  assert.throws(() =>
    measure({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0.01, 0],
          [0.01, NaN],
          [0, 0],
        ],
      ],
    }),
  );
});
