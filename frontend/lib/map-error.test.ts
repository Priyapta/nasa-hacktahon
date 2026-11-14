import { test } from "node:test";
import assert from "node:assert/strict";
import { mapErrorMessage } from "./map-error";
test("MapTiler authentication, quota, and terrain failures explain the next action without exposing the key", () => {
  const url =
    "https://api.maptiler.com/maps/hybrid/style.json?key=private-value";
  for (const status of [401, 403, 429, 503]) {
    const message = mapErrorMessage({ error: { url, status } });
    assert.match(message, /MapTiler/);
    assert.match(message, new RegExp(String(status)));
    assert.ok(!message.includes("private-value"));
  }
  assert.match(
    mapErrorMessage({
      sourceId: "maptiler-terrain",
      error: new Error("Failed to fetch"),
    }),
    /terrain/,
  );
  assert.match(mapErrorMessage({ sourceId: "fields" }), /field boundary/);
  assert.doesNotThrow(() => mapErrorMessage({ error: null }));
});

test("Clarity errors name the satellite provider without demanding a MapTiler key", () => {
  const message = mapErrorMessage({
    sourceId: "clarity",
    error: { status: 503 },
  });
  assert.match(message, /Esri Clarity/);
  assert.match(message, /503/);
  assert.ok(!message.includes("MAPTILER"));
});
