import { CROP_LOOK } from "./FieldSeason";
import type { Strategy } from "@/lib/analysis";
import { dictionary, formatMonth } from "@/lib/i18n";
import { formatRevenue, type RevenueProvenance } from "@/lib/revenue";
import type { Lang } from "@/lib/types";

const copy = {
  id: {
    title: "Estimasi omzet", highest: "Tertinggi di antara pola layak yang dinilai",
    scope: "Acuan harga dan produktivitas rata-rata nasional 2023. Penjualan sebelum biaya, bukan keuntungan bersih atau prediksi hasil lahan.",
    perHa: "Acuan per hektare", harvests: "Panen yang dihitung", crop: "Tanaman", harvest: "Panen", quantity: "Hasil jual", sales: "Omzet",
    after: "Belum panen dalam rentang ini", none: "Tidak dijual dalam model", noHarvest: "Belum ada panen penjualan yang selesai dalam rentang ini.",
    failed: "Pola ini belum lolos kelayakan. Angka omzet adalah simulasi, bukan rekomendasi untuk menjalankannya.",
    maize: "Jagung memakai asumsi berat setara kadar air 15%. Harga 2023 berasal dari rata-rata kadar air yang bervariasi, bukan harga terukur khusus KA15%.",
    chart: "Omzet per panen", chartHint: "Panjang batang menunjukkan omzet tiap panen. Klik untuk melihat rincian.",
    references: "Lihat angka acuan", assumptions: "Asumsi lengkap dan sumber", detail: "Rincian panen",
    brief: "Hanya panen selesai dalam rentang analisis yang dihitung. Orok-orok dan bera tidak menghasilkan penjualan dalam model.",
    basis: "Perhitungan dan asumsi", source: "Sumber data", yield: "Hasil acuan kg/ha", price: "Harga acuan/kg",
  },
  en: {
    title: "Estimated revenue", highest: "Highest among feasible evaluated patterns",
    scope: "2023 national-average price and yield references. Sales before costs, not net profit or a field-yield forecast.",
    perHa: "Per-hectare reference", harvests: "Harvests counted", crop: "Crop", harvest: "Harvest", quantity: "Sales quantity", sales: "Revenue",
    after: "Not harvested within this period", none: "No modeled sales", noHarvest: "No sales harvest is completed within this period.",
    failed: "This pattern did not pass feasibility. Revenue is a scenario, not a recommendation to grow it.",
    maize: "Maize assumes equivalent weight at 15% moisture. Its 2023 price averages varying moisture levels, not a measured price specifically at 15%.",
    chart: "Revenue per harvest", chartHint: "Bar length shows revenue for each harvest. Click to see the details.",
    references: "View reference values", assumptions: "Full assumptions and sources", detail: "Harvest details",
    brief: "Only harvests completed within the analysis period count. Sunn hemp and fallow have no modeled sales.",
    basis: "Calculation and assumptions", source: "Data sources", yield: "Reference yield kg/ha", price: "Reference price/kg",
  },
};

export default function RevenuePanel({ strategy, provenance, lang }: { strategy: Strategy; provenance?: RevenueProvenance; lang: Lang }) {
  const value = strategy.revenue;
  if (!value || !provenance) return null;
  const t = copy[lang];
  const crops = dictionary(lang).results.crops;
  const number = (n: number) => new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-GB", { maximumFractionDigits: 2 }).format(n);
  const maize = value.stages.some((stage) => stage.crop_id === "jagung" && stage.reason === "harvest");
  const maxRevenue = Math.max(1, ...value.stages.map((stage) => stage.gross_idr));
  return (
    <section className="surface flex flex-col gap-3 p-5" aria-labelledby="revenue-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="revenue-title" className="m-0 text-lg font-bold">{t.title} · {strategy.label}</h2>
        {value.is_highest && <span className="rounded-lg bg-[#FFF1CF] px-3 py-1 text-sm font-bold text-[#765100]">{t.highest}</span>}
      </div>
      <p className="m-0 max-w-4xl text-sm text-muted">{t.scope}</p>
      <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><dt className="text-xs text-muted">{t.sales} · {number(value.area_ha)} ha</dt><dd className="m-0 text-2xl font-bold text-sawah">{formatRevenue(value.gross_idr, lang)}</dd></div>
        <div><dt className="text-xs text-muted">{t.perHa}</dt><dd className="m-0 text-lg font-bold">{formatRevenue(value.gross_per_ha_idr, lang)}</dd></div>
        <div><dt className="text-xs text-muted">{t.harvests}</dt><dd className="m-0 text-lg font-bold">{value.completed_harvests}</dd></div>
      </dl>
      {!strategy.feasibility.passed && <p className="m-0 rounded-lg bg-[#FAE9DF] p-3 text-sm">{t.failed}</p>}
      {!value.completed_harvests && <p className="m-0 text-sm text-muted">{t.noHarvest}</p>}
      {maize && <p className="m-0 rounded-lg bg-[#FFF8E8] p-3 text-sm">{t.maize}</p>}
      <details>
        <summary className="cursor-pointer py-2 text-sm font-bold text-sawah-lip">{t.basis}</summary>
        <div className="mt-2 rounded-xl bg-canvas p-4 sm:p-5">
          <h3 className="m-0 text-base font-bold">{t.chart}</h3>
          <p className="mb-4 mt-1 text-xs text-muted">{t.chartHint}</p>
          <div className="mb-2 flex justify-between text-[11px] text-muted" aria-hidden="true">
            <span>{formatRevenue(0, lang)}</span><span>{formatRevenue(maxRevenue === 1 ? 0 : maxRevenue, lang)}</span>
          </div>
          <div role="list" aria-label={t.chart} className="flex flex-col gap-3">
            {value.stages.map((stage) => {
              const look = CROP_LOOK[stage.crop_id];
              const reference = provenance.references.find((row) => row.crop_id === stage.crop_id);
              const status = stage.reason === "after_horizon" ? t.after : stage.reason === "no_sales" ? t.none : null;
              return <div role="listitem" key={stage.stage_index}>
                <details className="group rounded-lg border border-[#DFE3D9] bg-white open:border-[#8FB3A0]">
                  <summary className="cursor-pointer list-none rounded-lg p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sawah">
                    <span className="mb-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="flex items-start gap-2">
                        <span aria-hidden="true" className="mt-0.5 text-muted group-open:rotate-90">▸</span>
                        <span><b>{crops[stage.crop_id]}</b><span className="block text-xs text-muted">{formatMonth(stage.harvest_month, lang, "short")}</span></span>
                      </span>
                      <b className="tabular-nums">{formatRevenue(stage.gross_idr, lang)}</b>
                    </span>
                    <span aria-hidden="true" className="block h-5 overflow-hidden rounded-md bg-[#EEF0E8]">
                      <span className="block h-full rounded-md" style={{ width: `${stage.gross_idr / maxRevenue * 100}%`, backgroundColor: look.bg }} />
                    </span>
                    {status && <span className="mt-2 block text-xs text-muted">{status}</span>}
                  </summary>
                  <dl aria-label={t.detail} className="m-0 grid gap-3 border-t border-[#EEF0E8] px-3 py-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-xs text-muted">{t.quantity}</dt><dd className="m-0 font-bold">{number(stage.quantity_kg)} kg</dd></div>
                    <div><dt className="text-xs text-muted">{t.price}</dt><dd className="m-0 font-bold">{reference?.price_idr_per_kg == null ? "—" : formatRevenue(reference.price_idr_per_kg, lang, 2)}</dd></div>
                    <div><dt className="text-xs text-muted">{t.sales}</dt><dd className="m-0 font-bold">{formatRevenue(stage.gross_idr, lang)}</dd></div>
                  </dl>
                </details>
              </div>;
            })}
          </div>
          <p className="mb-0 mt-4 text-xs leading-relaxed text-muted">{t.brief}</p>
        </div>
        <details className="mt-3 rounded-xl border border-[#DFE3D9] px-4">
          <summary className="cursor-pointer py-3 text-sm font-bold text-sawah-lip">{t.references}</summary>
          <div className="overflow-x-auto pb-3">
            <table className="w-full text-left text-sm">
              <thead><tr>{[t.crop, t.yield, t.price].map((label) => <th className="border-b p-2" key={label}>{label}</th>)}</tr></thead>
              <tbody>{provenance.references.filter((row) => !row.non_market).map((row) => <tr key={row.crop_id}>
                <td className="border-b p-2">{crops[row.crop_id]}</td><td className="border-b p-2">{number(row.model_yield_kg_per_ha)}</td><td className="border-b p-2">{row.price_idr_per_kg === null ? "—" : formatRevenue(row.price_idr_per_kg, lang, 2)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </details>
        <details className="mt-3 rounded-xl border border-[#DFE3D9] px-4 pb-1">
          <summary className="cursor-pointer py-3 text-sm font-bold text-sawah-lip">{t.assumptions}</summary>
          <ul className="my-3 list-disc space-y-2 pl-5 text-sm text-muted">{provenance.assumptions.map((text) => <li key={text}>{text}</li>)}</ul>
          <h3 className="text-sm font-bold">{t.source}</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm">{provenance.sources.map((source) => <li key={source.id}><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span className="block text-xs text-muted">{source.locator}</span></li>)}</ul>
        </details>
      </details>
    </section>
  );
}
