import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  currentMonth,
  parseArea,
  parsePattern,
  parsePlan,
  resultsHref,
  serializePlan,
  startMonthOptions,
  toAnalysisInput,
} from "./query";

// 2026-11-30 18:00 UTC is already 1 December in Jakarta (UTC+7).
const lateNovemberUtc = new Date("2026-11-30T18:00:00Z");
const midNovember = new Date("2026-11-14T05:00:00Z");
const ring = "110.9,-7.1;110.92,-7.1;110.92,-7.08;110.9,-7.08";

test("current month follows the Asia/Jakarta calendar", () => {
  assert.equal(currentMonth(midNovember), "2026-11");
  assert.equal(currentMonth(lateNovemberUtc), "2026-12");
});

test("start month window covers the current month and 11 more", () => {
  const options = startMonthOptions(midNovember);
  assert.equal(options.length, 12);
  assert.equal(options[0], "2026-11");
  assert.equal(options[11], "2027-10");
  assert.equal(addMonths("2026-12", 1), "2027-01");
});

test("empty URL gives defaults and stays on step 1", () => {
  const plan = parsePlan(new URLSearchParams(), midNovember);
  assert.deepEqual(plan, {
    step: 1,
    area: null,
    hasPattern: true,
    stages: [],
    startMonth: "2026-11",
    horizon: 12,
    water: null,
    lang: "id",
  });
});

test("step 2 requires a valid area", () => {
  const withoutArea = parsePlan(new URLSearchParams("langkah=2"), midNovember);
  assert.equal(withoutArea.step, 1);
  const withArea = parsePlan(
    new URLSearchParams({ langkah: "2", area: ring }),
    midNovember,
  );
  assert.equal(withArea.step, 2);
});

test("area parsing drops a repeated closing point and rejects bad input", () => {
  assert.equal(parseArea(`${ring};110.9,-7.1`)?.length, 4);
  assert.equal(parseArea("110.9,-7.1;110.92,-7.1"), null);
  assert.equal(parseArea("190,-7.1;110.92,-7.1;110.92,-7.08"), null);
  assert.equal(parseArea("a,b;c,d;e,f"), null);
});

test("pattern keeps known crops, clamps fallow months and caps six stages", () => {
  assert.deepEqual(parsePattern("kosong"), { hasPattern: false, stages: [] });
  assert.deepEqual(parsePattern("padi_sawah,bera:9,sorgum,bera:x").stages, [
    { crop_id: "padi_sawah" },
    { crop_id: "bera", months: 6 },
    { crop_id: "bera", months: 1 },
  ]);
  assert.equal(parsePattern(Array(8).fill("jagung").join(",")).stages.length, 6);
});

test("invalid horizon, start month, water and language fall back", () => {
  const plan = parsePlan(
    new URLSearchParams({
      horizon: "10",
      mulai: "2028-01",
      air: "sumur",
      lang: "fr",
    }),
    midNovember,
  );
  assert.equal(plan.horizon, 12);
  assert.equal(plan.startMonth, "2026-11");
  assert.equal(plan.water, null);
  assert.equal(plan.lang, "id");
});

test("serialize and parse round trip", () => {
  const params = new URLSearchParams({
    langkah: "2",
    area: ring,
    pola: "padi_sawah,padi_sawah,bera:4",
    mulai: "2027-03",
    horizon: "18",
    air: "irigasi",
    lang: "en",
    lahan: "existing-field",
  });
  const plan = parsePlan(params, midNovember);
  assert.equal(plan.fieldId, "existing-field");
  assert.deepEqual(parsePlan(serializePlan(plan), midNovember), plan);
});

test("analysis input closes the polygon ring and needs every input", () => {
  const base = parsePlan(
    new URLSearchParams({ area: ring, pola: "padi_sawah,bera:4" }),
    midNovember,
  );
  assert.equal(toAnalysisInput(base), null);
  const input = toAnalysisInput({ ...base, water: "tadah_hujan" });
  assert.ok(input);
  const outer = input.location.coordinates[0];
  assert.equal(outer.length, 5);
  assert.deepEqual(outer[0], outer[4]);
  assert.deepEqual(input.rotation, {
    has_pattern: true,
    stages: [{ crop_id: "padi_sawah" }, { crop_id: "bera", months: 4 }],
  });
  assert.equal(toAnalysisInput({ ...base, water: "irigasi", stages: [] }), null);
  const noPattern = toAnalysisInput({
    ...base,
    water: "irigasi",
    hasPattern: false,
  });
  assert.deepEqual(noPattern?.rotation, { has_pattern: false, stages: [] });
});

test("results link carries the inputs without the step flag", () => {
  const plan = parsePlan(
    new URLSearchParams({ langkah: "2", area: ring, pola: "kosong", air: "irigasi" }),
    midNovember,
  );
  const href = resultsHref(plan);
  assert.ok(href.startsWith("/hasil?"));
  assert.ok(!href.includes("langkah"));
  assert.ok(href.includes("pola=kosong"));
});
