"use client";

import { useEffect, useState } from "react";
import { analyze } from "@/lib/api";
import { toAnalysisInput, type PlanState } from "@/lib/query";
import type { AnalysisResponse, AnalyzeRequest } from "@/lib/types";

const copy = {
  id: {
    loading: "Sedang menganalisis lahan…", failed: "Analisis belum berhasil. Silakan coba lagi.",
    retry: "Coba lagi", incomplete: "Lengkapi batas lahan, pola tanam, dan sumber air terlebih dahulu.",
    historical: "Estimasi berbasis pola historis", soil: "Tanah", unavailable: "Data tanah tidak tersedia. Kesesuaian pH belum dinilai.",
    passed: "Lolos aturan kelayakan", failedRules: "Aturan yang belum terpenuhi", empty: "Belum ada alternatif yang lolos untuk input ini.",
    calendar: "Kalender tanam", continues: "berlanjut setelah horizon", reasons: "Alasan", tradeoffs: "Kompromi", risks: "Risiko",
    climate: "Kesesuaian iklim", water: "Tekanan air", bare: "Bulan lahan terbuka", soilContribution: "Kontribusi tanah",
    legume: "Penambat N", cover: "Penutup tanah", families: "Famili", yes: "Ya", no: "Tidak",
    sources: "Sumber dan asumsi", rain: "Validasi hujan", cropVersion: "Versi tabel tanaman",
    crops: { padi_sawah: "Padi sawah", jagung: "Jagung", kedelai: "Kedelai", kacang_hijau: "Kacang hijau", orok_orok: "Orok-orok", bera: "Bera" },
    levels: { rendah: "rendah", sedang: "sedang", tinggi: "tinggi" },
  },
  en: {
    loading: "Analyzing your field…", failed: "Analysis could not be completed. Please try again.",
    retry: "Try again", incomplete: "Complete the field boundary, cropping pattern, and water source first.",
    historical: "Estimate based on historical patterns", soil: "Soil", unavailable: "Soil data is unavailable. pH suitability has not been assessed.",
    passed: "Passed feasibility rules", failedRules: "Rules not met", empty: "No alternatives passed for these inputs.",
    calendar: "Planting calendar", continues: "continues beyond the horizon", reasons: "Reasons", tradeoffs: "Tradeoffs", risks: "Risks",
    climate: "Climate fit", water: "Water pressure", bare: "Bare months", soilContribution: "Soil contribution",
    legume: "Nitrogen fixer", cover: "Cover crop", families: "Families", yes: "Yes", no: "No",
    sources: "Sources and assumptions", rain: "Rainfall validation", cropVersion: "Crop table version",
    crops: { padi_sawah: "Paddy rice", jagung: "Maize", kedelai: "Soybean", kacang_hijau: "Mung bean", orok_orok: "Sunn hemp", bera: "Fallow" },
    levels: { rendah: "low", sedang: "medium", tinggi: "high" },
  },
};

function TextList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <div><h3 className="mb-1 text-base font-bold">{title}</h3><ul className="m-0 list-disc space-y-1 pl-5">{items.map((text, i) => <li key={i}>{text}</li>)}</ul></div>;
}

export default function AnalysisResults({ plan }: { plan: PlanState }) {
  const t = copy[plan.lang];
  const input = toAnalysisInput(plan);
  const request = input ? JSON.stringify({ ...input, lang: plan.lang }) : null;
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    setData(null);
    setError(null);
    analyze(JSON.parse(request) as AnalyzeRequest, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : t.failed);
      });
    return () => controller.abort();
  }, [request, attempt, t.failed]);

  if (!request) return <p role="alert">{t.incomplete}</p>;
  if (error) return <div role="alert" className="surface p-5"><p>{error}</p><button type="button" className="btn-primary" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button></div>;
  if (!data) return <p role="status" aria-live="polite">{t.loading}</p>;

  const level = (value: string) => t.levels[value as keyof typeof t.levels] ?? value;
  return (
    <div className="flex flex-col gap-5" data-testid="analysis-results">
      <section className="surface p-5">
        <p className="m-0 font-bold">{t.historical} · {data.context.climate.period}</p>
        <p className="mb-0">{t.soil}: {data.context.soil.status === "ok"
          ? `pH ${data.context.soil.ph} · ${data.context.soil.texture_class} · SOC ${data.context.soil.soc_g_per_kg?.toFixed(1)} g/kg (${data.context.soil.depth})`
          : t.unavailable}</p>
        <ul className="mb-0 list-disc space-y-1 pl-5">{data.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
      </section>
      {!data.strategies.length && <p role="status">{t.empty}</p>}
      <div className="grid items-start gap-5 lg:grid-cols-3">
        {data.strategies.map((strategy) => <article key={strategy.id} className="surface flex flex-col gap-4 p-5">
          <h2 className="m-0 text-xl font-bold">{strategy.label}</h2>
          <p className="m-0 font-bold">{strategy.feasibility.passed ? t.passed : `${t.failedRules}: ${strategy.feasibility.failed_rules.join(", ")}`}</p>
          <div><h3 className="mb-1 text-base font-bold">{t.calendar}</h3><ol className="m-0 list-decimal space-y-2 pl-5">{strategy.calendar.map((stage, i) =>
            <li key={i}>{t.crops[stage.crop_id]} · {stage.start} – {stage.end}{stage.continues_after_horizon && ` (${t.continues})`}</li>)}</ol></div>
          <dl className="m-0 space-y-2 text-sm">
            <div><dt className="font-bold">{t.climate}</dt><dd className="m-0">{level(strategy.dimensions.climate_fit.level)} — {strategy.dimensions.climate_fit.evidence}</dd></div>
            <div><dt className="font-bold">{t.water}</dt><dd className="m-0">{level(strategy.dimensions.water_pressure.level)} ({strategy.dimensions.water_pressure.years_met}/{strategy.dimensions.water_pressure.years_total})</dd></div>
            <div><dt className="font-bold">{t.bare}</dt><dd className="m-0">{strategy.dimensions.bare_months}</dd></div>
            <div><dt className="font-bold">{t.soilContribution}</dt><dd className="m-0">{t.legume}: {strategy.dimensions.soil_contribution.legume ? t.yes : t.no} · {t.cover}: {strategy.dimensions.soil_contribution.cover_crop ? t.yes : t.no} · {t.families}: {strategy.dimensions.soil_contribution.families}</dd></div>
          </dl>
          <TextList title={t.reasons} items={strategy.reasons} />
          <TextList title={t.tradeoffs} items={strategy.tradeoffs} />
          <TextList title={t.risks} items={strategy.dimensions.risks} />
        </article>)}
      </div>
      <details className="surface p-5"><summary className="cursor-pointer font-bold">{t.sources}</summary>
        <p>{data.provenance.climate.source} · {data.provenance.soil.source}</p>
        <p>{t.rain}: {data.provenance.climate.rain_validation.status}</p>
        <p>{t.cropVersion}: {data.provenance.crop_table_version}</p>
        <ul className="list-disc space-y-1 pl-5">{data.provenance.assumptions.map((note, i) => <li key={i}>{note}</li>)}</ul>
      </details>
    </div>
  );
}
