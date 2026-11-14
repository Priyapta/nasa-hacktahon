import { test } from "node:test";
import assert from "node:assert/strict";
import { growth, meters, periodYears, phClass, seasonSummary, timeline, type CalendarStage, type MonthlyClimate, type Strategy } from "./analysis";
import { cloudPath, sceneGeometry, SCENE_H, SCENE_W } from "./field-scene";

const stage = (crop_id: CalendarStage["crop_id"], start: string, end: string): CalendarStage => ({
  crop_id,
  start,
  end,
  continues_after_horizon: false,
  water: crop_id === "bera" ? null : { years_met: 9, years_total: 9 },
  warnings: [],
});

const calendar = [stage("padi_sawah", "2026-11", "2027-02"), stage("jagung", "2027-03", "2027-06"), stage("bera", "2027-07", "2027-10")];

test("timeline gives each horizon month its stage, position and phase", () => {
  const months = timeline(calendar, "2026-11", 12);
  assert.equal(months.length, 12);
  assert.deepEqual(
    months.map((m) => m.phase),
    ["tanam", "tumbuh", "tumbuh", "panen", "tanam", "tumbuh", "tumbuh", "panen", "bera", "bera", "bera", "bera"],
  );
  assert.equal(months[3].calendarMonth, 2);
  assert.equal(months[3].k, 4);
  assert.equal(months[4].stageIndex, 1);
});

test("a stage that continues past the horizon is cut at the horizon", () => {
  const months = timeline([stage("padi_sawah", "2026-11", "2027-02")], "2026-11", 2);
  assert.deepEqual(months.map((m) => [m.k, m.n, m.phase]), [[1, 4, "tanam"], [2, 4, "tumbuh"]]);
});

test("seedlings stay visible and fallow has no plants", () => {
  assert.equal(growth({ phase: "tanam", k: 1, n: 4 }), 0.32);
  assert.equal(growth({ phase: "tumbuh", k: 3, n: 4 }), 0.75);
  assert.equal(growth({ phase: "bera", k: 2, n: 4 }), 0);
});

test("season summary counts classes and skips missing values", () => {
  const month = (m: number, rain: number | null, cls: MonthlyClimate["class"], temp: number | null): MonthlyClimate => ({
    month: m, rain_median_mm: rain, rain_min_mm: null, rain_max_mm: null, class: cls, t_mean_c: temp, n_years: 10,
  });
  const summary = seasonSummary([month(1, 300, "basah", 26.3), month(2, 31, "kering", 27.1), month(3, null, null, null)]);
  assert.deepEqual(summary.counts, { basah: 1, lembap: 0, kering: 1 });
  assert.equal(summary.totalMedianMm, 331);
  assert.equal(summary.tempMin, 26.3);
  assert.equal(summary.tempMax, 27.1);
});

test("meters favour low water pressure, little open land and soil care", () => {
  const strategy = {
    dimensions: {
      climate_fit: { level: "sedang", evidence: "" },
      water_pressure: { level: "rendah", years_met: 9, years_total: 9 },
      bare_months: 6,
      soil_contribution: { legume: true, cover_crop: false, families: 2 },
      risks: ["a"],
    },
  } as unknown as Strategy;
  assert.deepEqual(meters(strategy, 12), { climate: 2, water: 3, bare: 1, soil: 2, soilChecks: 2, risk: 2 });
});

test("pH classes follow the Indonesian criteria and period years are read from the range", () => {
  assert.equal(phClass(5.47), "masam");
  assert.equal(phClass(6.0), "agak_masam");
  assert.equal(phClass(7.0), "netral");
  assert.deepEqual(periodYears("2016-01-01/2025-12-31"), ["2016", "2025"]);
});

test("scene geometry keeps any field shape inside the scene and plants inside the field", () => {
  const square = sceneGeometry([[110.892, -7.0915], [110.8928, -7.0914], [110.8928, -7.092], [110.892, -7.0921]]);
  const concave = sceneGeometry([[110.9, -7.1], [110.904, -7.1], [110.904, -7.096], [110.902, -7.098], [110.9, -7.096]]);
  for (const geo of [square, concave]) {
    assert.ok(geo.plants.length >= 30 && geo.plants.length <= 80, `plants ${geo.plants.length}`);
    for (const [x, y] of geo.plants) assert.ok(x > 0 && x < SCENE_W && y > 0 && y < SCENE_H);
    assert.ok(geo.sides.length >= 1);
  }
  assert.ok(cloudPath(100, 80, 1).startsWith("M"));
});
