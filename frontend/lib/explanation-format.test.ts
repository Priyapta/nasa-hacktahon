import assert from "node:assert/strict";
import test from "node:test";
import { countSegments, isRainValidationNote, pointTone, sentences, splitLead } from "./explanation-format";

test("a stage point is split into its crop and period lead and the rest", () => {
  assert.deepEqual(splitLead("Padi sawah, Nov 2026–Feb 2027: hujan memenuhi batas kebutuhan pada 9 dari 9 tahun acuan."), {
    lead: "Padi sawah, Nov 2026–Feb 2027",
    body: "hujan memenuhi batas kebutuhan pada 9 dari 9 tahun acuan.",
  });
  assert.deepEqual(splitLead("Padi sawah ditempatkan pada Nov 2026 sampai Feb 2027."), { lead: null, body: "Padi sawah ditempatkan pada Nov 2026 sampai Feb 2027." });
});

test("year counts become separate segments in both languages", () => {
  assert.deepEqual(countSegments("hujan cukup pada 7 dari 9 tahun acuan; gagal.", "id"), [
    { text: "hujan cukup pada " }, { met: 7, total: 9, label: "7 dari 9 tahun" }, { text: "; gagal." },
  ]);
  assert.deepEqual(countSegments("rain met the need in 8 of 9 reference years.", "en"), [
    { text: "rain met the need in " }, { met: 8, total: 9, label: "8 of 9 years" }, { text: "." },
  ]);
  assert.deepEqual(countSegments("Tidak ada angka.", "id"), [{ text: "Tidak ada angka." }]);
  assert.deepEqual(countSegments("hanya punya 1 dari 4 bulan basah.", "id"), [{ text: "hanya punya 1 dari 4 bulan basah." }]);
});

test("tone flags failed checks and unassessed fallow", () => {
  assert.equal(pointTone("Padi sawah, Agu–Nov 2027: hujan memenuhi batas pada 7 dari 9 tahun acuan; pemeriksaan aturan K5 gagal."), "warn");
  assert.equal(pointTone("Jagung, Mar–Jun 2027: hujan memenuhi batas kebutuhan pada 9 dari 9 tahun acuan."), "ok");
  assert.equal(pointTone("Bera, Jul 2027: tidak dinilai untuk kecukupan hujan."), "neutral");
});

test("semicolon joined ideas become separate sentences", () => {
  assert.deepEqual(sentences("Frekuensi historis bukan ramalan; hitungan menganggap cukup bila 60% tahun tercapai"), [
    "Frekuensi historis bukan ramalan.", "Hitungan menganggap cukup bila 60% tahun tercapai.",
  ]);
});

test("rainfall validation notes are recognised in both languages", () => {
  assert.equal(isRainValidationNote("Hujan belum divalidasi terhadap dataset pembanding."), true);
  assert.equal(isRainValidationNote("Rainfall has not been validated against a reference dataset."), true);
  assert.equal(isRainValidationNote("Validasi hujan berstatus unvalidated."), true);
  assert.equal(isRainValidationNote("Hujan adalah estimasi area."), false);
});
