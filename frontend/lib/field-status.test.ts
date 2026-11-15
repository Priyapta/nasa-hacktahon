import assert from "node:assert/strict";
import test from "node:test";
import { lastMonth, patternStrip, startStatus } from "./field-status";
import type { Crop } from "./types";

const now = new Date("2026-11-14T05:00:00Z");
const crops: Crop[] = [
  { crop_id: "padi_sawah", nama: "Padi sawah", peran: [], slot_bulan: 4 },
  { crop_id: "jagung", nama: "Jagung", peran: [], slot_bulan: 4 },
  { crop_id: "kacang_hijau", nama: "Kacang hijau", peran: [], slot_bulan: 2 },
];

test("start status follows the same window as reopening a saved field", () => {
  assert.deepEqual(startStatus("2026-11", now), { kind: "this", effective: "2026-11" });
  assert.deepEqual(startStatus("2026-12", now), { kind: "next", effective: "2026-12" });
  assert.deepEqual(startStatus("2027-03", now), { kind: "later", effective: "2027-03" });
  assert.deepEqual(startStatus("2026-09", now), { kind: "late", effective: "2026-11" });
  assert.deepEqual(startStatus("2027-11", now), { kind: "late", effective: "2026-11" });
});

test("pattern strip repeats stages and clips at the horizon", () => {
  const strip = patternStrip([{ crop_id: "jagung" }, { crop_id: "bera", months: 2 }], crops, 12);
  assert.deepEqual(strip, [
    { crop: "jagung", months: 4 }, { crop: "bera", months: 2 },
    { crop: "jagung", months: 4 }, { crop: "bera", months: 2 },
  ]);
  const clipped = patternStrip([{ crop_id: "padi_sawah" }, { crop_id: "padi_sawah" }], crops, 6);
  assert.deepEqual(clipped, [{ crop: "padi_sawah", months: 4 }, { crop: "padi_sawah", months: 2 }]);
});

test("pattern strip needs every stage duration", () => {
  assert.equal(patternStrip([], crops, 12), null);
  assert.equal(patternStrip([{ crop_id: "kedelai" }], crops, 12), null);
  assert.equal(patternStrip([{ crop_id: "bera" }], crops, 12), null);
});

test("last month of the plan counts the start month", () => {
  assert.equal(lastMonth("2026-11", 12), "2027-10");
  assert.equal(lastMonth("2026-09", 6), "2027-02");
});
