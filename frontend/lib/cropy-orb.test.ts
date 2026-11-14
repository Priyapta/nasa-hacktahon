import assert from "node:assert/strict";
import test from "node:test";
import { orbContour } from "./cropy-orb";

test("the liquid outline stays inside its viewport throughout a minute of motion", () => {
  for (const intensity of [1, 1.6, 2.4]) {
    for (let phase = 0; phase <= 60; phase += .25) {
      const path = orbContour(phase, intensity);
      assert.equal((path.match(/C/g) ?? []).length, 4);
      assert.ok(path.trim().endsWith("Z"));
      const coordinates = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      assert.ok(coordinates.every(value => Number.isFinite(value) && value >= 2 && value <= 98));
    }
  }
});

test("the outline flows continuously rather than jumping at loop boundaries", () => {
  const coordinates = (phase: number) => orbContour(phase).match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  for (const phase of [0, 5.4, 12, 24, 60]) {
    const before = coordinates(phase);
    const after = coordinates(phase + 1 / 60);
    assert.ok(before.some((value, index) => value !== after[index]));
    assert.ok(before.every((value, index) => Math.abs(value - after[index]) < .02));
  }
});
