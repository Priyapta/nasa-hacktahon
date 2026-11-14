import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { previewPattern } from "./plan-preview";
import type { Crop } from "./types";

const crops: Crop[] = JSON.parse(readFileSync(new URL("../../backend/contracts/fixtures/crops.json", import.meta.url), "utf8")).crops;

test("six four-month crops do not appear as six months of planting", () => {
  const preview = previewPattern(Array.from({ length: 6 }, () => ({ crop_id: "jagung" as const })), crops, "2027-01", 6)!;
  assert.equal(preview.total, 24);
  assert.deepEqual(preview.rows[0], { start: "2027-01", end: "2027-04", outside: false, continues: false });
  assert.deepEqual(preview.rows[1], { start: "2027-05", end: "2027-08", outside: false, continues: true });
  assert.equal(preview.outside, 4);
});

test("fallow length, year transitions and missing crop metadata stay explicit", () => {
  const stages = [{ crop_id: "padi_sawah" as const }, { crop_id: "bera" as const, months: 2 }];
  const preview = previewPattern(stages, crops, "2026-11", 12)!;
  assert.equal(preview.total, 6);
  assert.deepEqual(preview.rows.map(({ start, end }) => [start, end]), [["2026-11", "2027-02"], ["2027-03", "2027-04"]]);
  assert.equal(preview.outside, 0);
  assert.equal(previewPattern(stages, [], "2026-11", 12), null);
});
