import assert from "node:assert/strict";
import test from "node:test";
import { formatRevenueShort, revenueRank } from "./revenue";

test("large revenue is shortened to millions or billions in both languages", () => {
  assert.equal(formatRevenueShort(229_606_706, "id"), "Rp229,6 juta");
  assert.equal(formatRevenueShort(229_606_706, "en"), "IDR 229.6 million");
  assert.equal(formatRevenueShort(43_563_848_324, "id"), "Rp43,6 miliar");
  assert.equal(formatRevenueShort(44_700_000, "en"), "IDR 44.7 million");
});

test("small revenue keeps the full rupiah value", () => {
  assert.equal(formatRevenueShort(0, "id").replace(/\s/g, " "), "Rp 0");
});

test("rank counts only feasible patterns with revenue, highest first", () => {
  const strategies = [
    { id: "biasa", feasible: true, revenue: { gross_idr: 185 } },
    { id: "jaga", feasible: true, revenue: { gross_idr: 230 } },
    { id: "tinggi", feasible: true, revenue: { gross_idr: 280 } },
    { id: "gagal", feasible: false, revenue: { gross_idr: 999 } },
    { id: "kosong", feasible: true },
  ];
  assert.deepEqual(revenueRank(strategies, "jaga"), { rank: 2, total: 3 });
  assert.deepEqual(revenueRank(strategies, "tinggi"), { rank: 1, total: 3 });
  assert.equal(revenueRank(strategies, "gagal"), null);
});
