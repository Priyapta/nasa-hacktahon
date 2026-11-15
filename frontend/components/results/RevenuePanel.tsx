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
    basis: "Perhitungan dan asumsi", source: "Sumber data", yield: "Hasil acuan kg/ha", price: "Harga acuan/kg",
  },
  en: {
    title: "Estimated revenue", highest: "Highest among feasible evaluated patterns",
    scope: "2023 national-average price and yield references. Sales before costs, not net profit or a field-yield forecast.",
    perHa: "Per-hectare reference", harvests: "Harvests counted", crop: "Crop", harvest: "Harvest", quantity: "Sales quantity", sales: "Revenue",
    after: "Not harvested within this period", none: "No modeled sales", noHarvest: "No sales harvest is completed within this period.",
    failed: "This pattern did not pass feasibility. Revenue is a scenario, not a recommendation to grow it.",
    maize: "Maize assumes equivalent weight at 15% moisture. Its 2023 price averages varying moisture levels, not a measured price specifically at 15%.",
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr>{[t.crop, t.harvest, t.quantity, t.sales].map((label) => <th className="border-b p-2" key={label}>{label}</th>)}</tr></thead>
            <tbody>{value.stages.map((stage) => <tr key={stage.stage_index}>
              <td className="border-b p-2">{crops[stage.crop_id]}</td>
              <td className="border-b p-2">{formatMonth(stage.harvest_month, lang, "short")}<span className="block text-xs text-muted">{stage.reason === "after_horizon" ? t.after : stage.reason === "no_sales" ? t.none : ""}</span></td>
              <td className="border-b p-2">{number(stage.quantity_kg)} kg</td>
              <td className="border-b p-2">{formatRevenue(stage.gross_idr, lang)}</td>
            </tr>)}</tbody>
          </table>
          <table className="mt-4 w-full text-left text-sm">
            <thead><tr>{[t.crop, t.yield, t.price].map((label) => <th className="border-b p-2" key={label}>{label}</th>)}</tr></thead>
            <tbody>{provenance.references.filter((row) => !row.non_market).map((row) => <tr key={row.crop_id}>
              <td className="border-b p-2">{crops[row.crop_id]}</td><td className="border-b p-2">{number(row.model_yield_kg_per_ha)}</td><td className="border-b p-2">{row.price_idr_per_kg === null ? "—" : formatRevenue(row.price_idr_per_kg, lang, 2)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <ul className="my-3 list-disc space-y-2 pl-5 text-sm text-muted">{provenance.assumptions.map((text) => <li key={text}>{text}</li>)}</ul>
        <h3 className="text-sm font-bold">{t.source}</h3>
        <ul className="list-disc space-y-2 pl-5 text-sm">{provenance.sources.map((source) => <li key={source.id}><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span className="block text-xs text-muted">{source.locator}</span></li>)}</ul>
      </details>
    </section>
  );
}
