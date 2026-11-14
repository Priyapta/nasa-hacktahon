import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { AnalysisResponse } from "./analysis";
import { recommendationExplanation, recommendationSources } from "./recommendation";

function fixture(): AnalysisResponse {
  return JSON.parse(readFileSync(join(import.meta.dirname, "../tests/fixtures/analyze.json"), "utf8"));
}

test("explanations keep the introduction and each crop reason as separate points", () => {
  const strategy = fixture().strategies[0];
  for (const lang of ["id", "en"] as const) {
    const points = recommendationExplanation(strategy, lang);
    assert.equal(points.length, 3);
    assert.deepEqual(points.slice(1), strategy.reasons.slice(0, 2));
  }
});

test("LLM assessment points are used when the backend supplies them", () => {
  const strategy = fixture().strategies[0];
  strategy.explanation = { assessment: ["Penjelasan AI per tanaman."], basis: ["Sumber data."], cautions: ["Catatan."] };
  assert.deepEqual(recommendationExplanation(strategy, "id"), strategy.explanation.assessment);
});

test("usual patterns are identified as user input and keep their failed-rule evidence", () => {
  const result = fixture();
  const text = recommendationExplanation(result.strategies[0], "id").join(" ");
  assert.match(text, /bukan rekomendasi baru/);
  assert.match(text, /1 dari 4 bulan basah/);
  assert.match(text, /Mar 2027/);
});

test("recommendation counts and periods come from the supplied evidence", () => {
  const strategy = fixture().strategies[1];
  strategy.reasons = ["Jagung ditempatkan pada Mar 2027 sampai Jun 2027 karena hujan mencukupi di 5 dari 7 tahun acuan."];
  const text = recommendationExplanation(strategy, "id").join(" ");
  assert.match(text, /Jagung.*Mar 2027.*Jun 2027/);
  assert.match(text, /5 dari 7 tahun/);
  assert.doesNotMatch(text, /9 dari 9|pasti berhasil/);
});

test("missing evidence shows the known crop and period without inventing rain counts", () => {
  const strategy = fixture().strategies[1];
  strategy.reasons = [];
  const text = recommendationExplanation(strategy, "id").join(" ");
  assert.match(text, /Padi sawah/);
  assert.match(text, /2026.*2027/);
  assert.match(text, /belum tersedia/);
  assert.doesNotMatch(text, /9 dari 9/);
});

test("sources only claim soil that was available and do not infer unknown validation", () => {
  const result = fixture();
  assert.match(recommendationSources(result, "id").join(" "), /NASA POWER.*2016.*2025.*SoilGrids.*belum divalidasi/);
  result.context.soil = { status: "unavailable" };
  result.provenance.climate.rain_validation.status = "unknown";
  const text = recommendationSources(result, "id").join(" ");
  assert.doesNotMatch(text, /SoilGrids|telah dibandingkan/);
  assert.match(text, /Data tanah belum tersedia/);
  assert.match(text, /belum dapat dikonfirmasi/);
});

test("validation claims need both an explicit validated status and a named reference", () => {
  const result = fixture();
  result.provenance.climate.rain_validation = { status: "validated", reference: null };
  assert.match(recommendationSources(result, "id").join(" "), /belum dapat dikonfirmasi/);
  result.provenance.climate.rain_validation.reference = "dataset pembanding uji";
  assert.match(recommendationSources(result, "id").join(" "), /telah dibandingkan dengan dataset pembanding uji/);
  assert.match(recommendationSources(result, "en").join(" "), /compared against dataset pembanding uji/);
});
