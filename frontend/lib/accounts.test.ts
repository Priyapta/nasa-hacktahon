import assert from "node:assert/strict";
import test from "node:test";
import { savedFieldHref, type SavedField } from "./accounts";

test("reopening saved land preserves settings and refreshes expired planting months", () => {
  const field: SavedField = {
    id: "id", name: "Sawah", created_at: "2026-01-01",
    plan: {
      location: { type: "Polygon", coordinates: [[[110.9, -7.1], [110.91, -7.1], [110.91, -7.09], [110.9, -7.1]]] },
      rotation: { has_pattern: false, stages: [] },
      time: { start_month: "2026-01", horizon_months: 18 }, water_source: "irigasi", lang: "en",
    },
  };
  const url = new URL(savedFieldHref(field, new Date("2026-11-14T10:00:00Z")), "http://localhost");
  assert.equal(url.pathname, "/hasil");
  assert.equal(url.searchParams.get("lahan"), field.id);
  assert.equal(url.searchParams.get("mulai"), "2026-11");
  assert.equal(url.searchParams.get("horizon"), "18");
  assert.equal(url.searchParams.get("pola"), "kosong");
  assert.equal(url.searchParams.get("air"), "irigasi");
  assert.equal(url.searchParams.get("lang"), "en");
  assert.ok(url.searchParams.get("area")?.includes("110.9,-7.1"));
  field.plan.time.start_month = "2027-01";
  assert.equal(new URL(savedFieldHref(field, new Date("2026-11-14")), "http://localhost").searchParams.get("mulai"), "2027-01");
});
