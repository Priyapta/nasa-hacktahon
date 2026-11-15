import { Calculator, CircleQuestionMark } from "lucide-react";
import { CROP_LOOK } from "./FieldSeason";
import CropIcon from "./CropIcon";
import type { Strategy } from "@/lib/analysis";
import { dictionary, formatMonth } from "@/lib/i18n";
import { addMonths } from "@/lib/query";
import { formatRevenue, formatRevenueShort, revenueRank, type RevenueProvenance } from "@/lib/revenue";
import type { Lang } from "@/lib/types";

const copy = {
  id: {
    title: "Estimasi omzet", highest: "Tertinggi di antara pola layak yang dinilai",
    rank: (rank: number, total: number) => `Peringkat ${rank} dari ${total} pola layak`,
    sales: "Omzet", perHa: "Per hektare", vsBaseline: "Dibanding pola biasa Anda", harvests: "Panen yang dihitung",
    harvestCount: (n: number) => `${n} panen`, afterCount: (n: number) => `+${n} setelah rentang`,
    allInside: "semua dalam rentang", baselineIs: (amount: string) => `pola biasa ${amount}`, isBaseline: "ini pola biasa Anda", noBaseline: "belum ada pola biasa",
    scope: "Acuan harga dan hasil panen rata-rata nasional 2023. Penjualan sebelum biaya, bukan keuntungan bersih atau prediksi hasil lahan Anda.",
    failed: "Pola ini belum lolos kelayakan. Angka omzet adalah simulasi, bukan rekomendasi untuk menjalankannya.",
    noHarvest: "Belum ada panen penjualan yang selesai dalam rentang ini.",
    timeline: "Kapan uang masuk", harvestOn: (month: string) => `panen ${month}`,
    afterNote: (crop: string, month: string) => `${crop} panen ${month}, setelah rentang analisis, jadi belum dihitung.`,
    breakdown: "Perbandingan pola dan cara hitung",
    compare: "Dibanding pola lain di petak ini", thisOne: "pola ini", notFeasible: "belum layak",
    compareNote: "Omzet lebih tinggi belum tentu lebih aman. Cek kecukupan hujan di kartu tiap pola.",
    method: "Cara hitung", harvest: "Panen", yield: "Hasil acuan", price: "× Harga acuan", area: "× Luas", total: "= Omzet",
    sold: (kg: string) => `${kg} kg dijual`, noSales: "Tidak dijual dalam model", after: "Panen setelah rentang, belum dihitung",
    totalRow: (n: number) => `Total ${n} panen`,
    maize: "Berat jagung disetarakan ke kadar air 15% dari data kadar air 28%. Harga 2023 berasal dari rata-rata kadar air yang bervariasi, bukan harga terukur khusus KA15%.",
    details: "Asumsi, angka acuan dan sumber", references: "Angka acuan nasional 2023", crop: "Tanaman", refYield: "Hasil kg/ha", refPrice: "Harga/kg", sources: "Sumber data",
    groups: (formula: string | null) => [
      { title: "Dasar perhitungan", points: ["Harga dan hasil panen rata-rata nasional 2023, sama untuk semua lokasi dan bulan. Bukan harga sekarang atau ramalan harga panen.", "Hasil panen tidak dihitung ulang dari suhu, hujan, pH, varietas atau kondisi lahan Anda.", "Omzet adalah penjualan sebelum biaya. Biaya produksi dan pengeringan belum dihitung."] },
      { title: "Per komoditas", points: ["Padi memakai harga gabah kering giling di tingkat petani, bukan harga beras eceran.", ...(formula ? [`Jagung: ${formula}. Susut, mutu dan biaya pengeringan tidak dimodelkan.`] : []), "Orok-orok dan bera tidak dijual dalam model, tetapi tetap bisa punya biaya dan manfaat lain."] },
      { title: "Batas estimasi", points: ["Hanya panen yang selesai dalam rentang analisis yang dihitung, tanpa prorata.", "Peringkat hanya membandingkan pola layak yang dinilai.", "Hasil panen dan keuntungan tidak dijamin."] },
    ],
    weight: "berat",
  },
  en: {
    title: "Estimated revenue", highest: "Highest among feasible evaluated patterns",
    rank: (rank: number, total: number) => `Rank ${rank} of ${total} feasible patterns`,
    sales: "Revenue", perHa: "Per hectare", vsBaseline: "Versus your usual pattern", harvests: "Harvests counted",
    harvestCount: (n: number) => `${n} ${n === 1 ? "harvest" : "harvests"}`, afterCount: (n: number) => `+${n} after the period`,
    allInside: "all within the period", baselineIs: (amount: string) => `usual pattern ${amount}`, isBaseline: "this is your usual pattern", noBaseline: "no usual pattern given",
    scope: "2023 national-average price and yield references. Sales before costs, not net profit or a forecast for your field.",
    failed: "This pattern did not pass feasibility. Revenue is a scenario, not a recommendation to grow it.",
    noHarvest: "No sales harvest is completed within this period.",
    timeline: "When money comes in", harvestOn: (month: string) => `harvest ${month}`,
    afterNote: (crop: string, month: string) => `${crop} is harvested in ${month}, after the analysis period, so it is not counted yet.`,
    breakdown: "Pattern comparison and calculation",
    compare: "Compared with other patterns on this field", thisOne: "this pattern", notFeasible: "not feasible",
    compareNote: "Higher revenue is not always safer. Check rain sufficiency on each pattern card.",
    method: "How it is calculated", harvest: "Harvest", yield: "Reference yield", price: "× Reference price", area: "× Area", total: "= Revenue",
    sold: (kg: string) => `${kg} kg sold`, noSales: "No modeled sales", after: "Harvest after the period, not counted",
    totalRow: (n: number) => `Total of ${n} ${n === 1 ? "harvest" : "harvests"}`,
    maize: "Maize weight is converted to 15% moisture from 28% moisture data. Its 2023 price averages varying moisture levels, not a measured price specifically at 15%.",
    details: "Assumptions, reference values and sources", references: "2023 national reference values", crop: "Crop", refYield: "Yield kg/ha", refPrice: "Price/kg", sources: "Data sources",
    groups: (formula: string | null) => [
      { title: "Calculation basis", points: ["Prices and yields are 2023 national averages, the same for every location and month. Not current prices or a harvest price forecast.", "Yields are not recalculated from temperature, rain, pH, variety or your field conditions.", "Revenue is sales before costs. Production and drying costs are not included."] },
      { title: "Per commodity", points: ["Rice uses the farm-gate price of dry milled grain, not the retail rice price.", ...(formula ? [`Maize: ${formula}. Shrinkage, quality and drying costs are not modeled.`] : []), "Sunn hemp and fallow have no modeled sales. They may still have costs and other benefits."] },
      { title: "Estimate limits", points: ["Only harvests completed within the analysis period count, without proration.", "The rank compares feasible evaluated patterns only.", "Harvests and profits are not guaranteed."] },
    ],
    weight: "weight",
  },
};

function shortMonth(month: string, lang: Lang) {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, index - 1, 1)));
}

function monthIndex(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return ty * 12 + tm - (fy * 12 + fm);
}

export default function RevenuePanel({ strategy, strategies, provenance, startMonth, horizon, lang }: {
  strategy: Strategy;
  strategies: Strategy[];
  provenance?: RevenueProvenance;
  startMonth: string;
  horizon: number;
  lang: Lang;
}) {
  const value = strategy.revenue;
  if (!value || !provenance) return null;
  const t = copy[lang];
  const crops = dictionary(lang).results.crops;
  const number = (n: number, digits = 0) => new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-GB", { maximumFractionDigits: digits }).format(n);
  const reference = (crop: string) => provenance.references.find((row) => row.crop_id === crop);

  const rank = revenueRank(strategies.map((s) => ({ id: s.id, feasible: s.feasibility.passed, revenue: s.revenue })), strategy.id);
  const baseline = strategies.find((s) => s.role === "pola_biasa");
  const delta = baseline?.revenue && baseline.id !== strategy.id ? value.gross_idr - baseline.revenue.gross_idr : null;
  const harvests = value.stages.filter((stage) => stage.reason === "harvest");
  const later = value.stages.filter((stage) => stage.reason === "after_horizon");
  const maize = harvests.some((stage) => stage.crop_id === "jagung");
  const maizeRef = reference("jagung");
  const formula = maizeRef?.source_moisture_pct != null && maizeRef.model_moisture_pct != null
    ? `${t.weight} × (1 − ${number(maizeRef.source_moisture_pct / 100, 2)}) / (1 − ${number(maizeRef.model_moisture_pct / 100, 2)})`
    : null;

  const months = Array.from({ length: horizon }, (_, i) => addMonths(startMonth, i));
  const harvestMonths = new Set(harvests.map((stage) => stage.harvest_month));
  const compared = strategies.filter((s) => s.revenue).sort((a, b) => b.revenue!.gross_idr - a.revenue!.gross_idr);
  const top = Math.max(1, ...compared.map((s) => s.revenue!.gross_idr));

  return (
    <section className="surface flex flex-col gap-7 p-5 sm:p-7" aria-labelledby="revenue-title">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="revenue-title" className="m-0 text-lg font-bold">{t.title} · {strategy.label}</h2>
          {value.is_highest
            ? <span className="rounded-full bg-[#FFF1CF] px-3 py-1 text-sm font-bold text-[#765100]">{t.highest}</span>
            : rank && <span className="rounded-full bg-sawah-tint px-3 py-1 text-sm font-bold text-sawah-lip">{t.rank(rank.rank, rank.total)}</span>}
        </div>
        <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-xl border-2 border-hairline lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 flex flex-col gap-1 bg-[#F2F8F4] px-4 py-4 sm:px-5 lg:col-span-1">
            <dt className="text-xs text-muted">{t.sales} · {number(value.area_ha, 2)} ha</dt>
            <dd className="m-0 text-3xl font-bold leading-tight text-sawah sm:text-4xl">{formatRevenueShort(value.gross_idr, lang)}</dd>
            <dd className="m-0 text-xs tabular-nums text-muted">{formatRevenue(value.gross_idr, lang)}</dd>
          </div>
          <div className="flex flex-col gap-1 border-t-2 border-hairline px-4 py-4 sm:px-5 lg:border-l-2 lg:border-t-0">
            <dt className="text-xs text-muted">{t.perHa}</dt>
            <dd className="m-0 mt-auto text-lg font-bold">{formatRevenueShort(value.gross_per_ha_idr, lang)}</dd>
            <dd className="m-0 text-xs tabular-nums text-muted">{formatRevenue(value.gross_per_ha_idr, lang)}</dd>
          </div>
          <div className="flex flex-col gap-1 border-l-2 border-t-2 border-hairline px-4 py-4 sm:px-5 lg:border-t-0">
            <dt className="text-xs text-muted">{t.vsBaseline}</dt>
            {delta !== null
              ? <dd className={`m-0 mt-auto text-lg font-bold ${delta >= 0 ? "text-sawah-lip" : "text-tanah-strong"}`}>{delta >= 0 ? "+" : "−"}{formatRevenueShort(Math.abs(delta), lang)}</dd>
              : <dd className="m-0 mt-auto text-lg font-bold text-muted">–</dd>}
            <dd className="m-0 text-xs text-muted">{delta !== null ? t.baselineIs(formatRevenueShort(baseline!.revenue!.gross_idr, lang)) : baseline?.id === strategy.id ? t.isBaseline : t.noBaseline}</dd>
          </div>
          <div className="col-span-2 flex flex-col gap-1 border-t-2 border-hairline px-4 py-4 sm:px-5 lg:col-span-1 lg:border-l-2 lg:border-t-0">
            <dt className="text-xs text-muted">{t.harvests}</dt>
            <dd className="m-0 mt-auto text-lg font-bold">{t.harvestCount(value.completed_harvests)}</dd>
            <dd className="m-0 text-xs text-muted">{later.length > 0 ? t.afterCount(later.length) : t.allInside}</dd>
          </div>
        </dl>
        <p className="m-0 max-w-3xl text-sm text-muted">{t.scope}</p>
        {!strategy.feasibility.passed && <p className="m-0 rounded-lg bg-tanah-tint p-3 text-sm">{t.failed}</p>}
        {!value.completed_harvests && <p className="m-0 text-sm text-muted">{t.noHarvest}</p>}
      </header>

      <div className="flex flex-col gap-3">
        <h3 className="m-0 text-base font-bold">{t.timeline}</h3>
        <ol className="m-0 flex list-none flex-col gap-2 p-0 sm:hidden">
          {harvests.map((stage) => <li key={stage.stage_index} className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2.5">
            <CropIcon crop={stage.crop_id} size={28} />
            <span className="min-w-0 flex-1 text-sm">{crops[stage.crop_id]}<span className="block text-xs text-muted">{t.harvestOn(formatMonth(stage.harvest_month, lang, "short"))}</span></span>
            <b className="tabular-nums">{formatRevenueShort(stage.gross_idr, lang)}</b>
          </li>)}
        </ol>
        <div className="hidden sm:block">
          <div className="grid gap-x-1 gap-y-2" style={{ gridTemplateColumns: `repeat(${horizon}, minmax(0, 1fr))` }}>
            {strategy.calendar.map((stage, i) => {
              const from = monthIndex(startMonth, stage.start);
              if (from >= horizon) return null;
              const span = Math.min(monthIndex(startMonth, stage.end), horizon - 1) - from + 1;
              const look = CROP_LOOK[stage.crop_id];
              const after = stage.continues_after_horizon;
              const fallow = stage.crop_id === "bera";
              return <span key={i} className="truncate rounded-lg px-2.5 py-2 text-xs font-bold"
                style={{
                  gridColumn: `${from + 1} / span ${span}`, gridRow: 1,
                  background: after ? "repeating-linear-gradient(135deg, #E3F1E8 0 6px, #FFFFFF 6px 12px)" : look.bg,
                  color: after ? "#145A37" : look.ink,
                  border: after ? "2px dashed #8FB3A0" : fallow ? "2px dashed #CF9A7B" : undefined,
                }}>{crops[stage.crop_id]}{after ? " ›" : ""}</span>;
            })}
            {months.map((month, i) => <span key={month} className={`text-[11px] ${harvestMonths.has(month) ? "font-bold text-ink" : "text-muted"}`} style={{ gridColumn: i + 1, gridRow: 2 }}>{shortMonth(month, lang)}</span>)}
            {harvests.map((stage) => {
              const end = monthIndex(startMonth, stage.harvest_month);
              const from = Math.max(0, end - 2);
              return <div key={stage.stage_index} className="justify-self-end border-r-[3px] py-1 pr-2.5 text-right" style={{ gridColumn: `${from + 1} / ${end + 2}`, gridRow: 3, borderColor: CROP_LOOK[stage.crop_id].bg }}>
                <div className="whitespace-nowrap text-base font-bold">{formatRevenueShort(stage.gross_idr, lang)}</div>
                <div className="whitespace-nowrap text-[11px] text-muted">{t.harvestOn(formatMonth(stage.harvest_month, lang, "short"))}</div>
              </div>;
            })}
          </div>
        </div>
        {later.map((stage) => <p key={stage.stage_index} className="m-0 text-xs text-muted">{t.afterNote(crops[stage.crop_id], formatMonth(stage.harvest_month, lang, "short"))}</p>)}
      </div>

      <details className="border-t border-hairline pt-1">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-sawah-lip"><Calculator aria-hidden="true" size={18} strokeWidth={2.25} />{t.breakdown}</summary>
        <div className="flex flex-col gap-7 pb-2 pt-3">
      {compared.length > 1 && <div className="flex flex-col gap-3">
        <h3 className="m-0 text-base font-bold">{t.compare}</h3>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {compared.map((s) => {
            const current = s.id === strategy.id;
            return <li key={s.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-lg px-2.5 py-2 text-sm sm:grid-cols-[280px_minmax(0,1fr)_110px] ${current ? "bg-sawah-tint font-bold" : ""}`}>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{s.label}</span>
                {current && <span className="whitespace-nowrap rounded-full bg-sawah px-2 py-0.5 text-[11px] font-bold text-white">{t.thisOne}</span>}
                {!s.feasibility.passed && <span className="whitespace-nowrap rounded-full bg-tanah-tint px-2 py-0.5 text-[11px] font-bold text-tanah-strong">{t.notFeasible}</span>}
              </span>
              <span aria-hidden="true" className={`order-last col-span-2 block h-3 overflow-hidden rounded-md sm:order-none sm:col-span-1 ${current ? "bg-white" : "bg-[#EEF0E8]"}`}>
                <span className="block h-full rounded-md" style={{ width: `${s.revenue!.gross_idr / top * 100}%`, background: current ? "#1F7A4D" : "#A9B8AE" }} />
              </span>
              <span className="text-right tabular-nums">{formatRevenueShort(s.revenue!.gross_idr, lang)}</span>
            </li>;
          })}
        </ul>
        <p className="m-0 text-xs text-muted">{t.compareNote}</p>
      </div>}

        <div className="flex flex-col gap-3">
        <h3 className="m-0 text-base font-bold">{t.method}</h3>
        <ul className="m-0 flex list-none flex-col p-0 sm:hidden">
          {value.stages.map((stage) => {
            const ref = reference(stage.crop_id);
            const counted = stage.reason === "harvest";
            return <li key={stage.stage_index} className={`flex items-start gap-2.5 border-t border-hairline py-3 text-sm ${counted ? "" : "text-muted"}`}>
              <CropIcon crop={stage.crop_id} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={counted ? "text-ink" : ""}>{crops[stage.crop_id]}{stage.crop_id === "jagung" && counted && <sup className="text-tanah-strong">1</sup>}</span>
                  {counted && <b className="tabular-nums">{formatRevenueShort(stage.gross_idr, lang)}</b>}
                </span>
                <span className="block text-xs text-muted">{formatMonth(stage.harvest_month, lang, "short")}{counted ? ` · ${t.sold(number(stage.quantity_kg))}` : ""}</span>
                <span className="mt-1 block text-xs tabular-nums text-muted">
                  {counted
                    ? `${number(ref?.model_yield_kg_per_ha ?? 0, 2)} kg/ha × ${ref?.price_idr_per_kg == null ? "—" : formatRevenue(ref.price_idr_per_kg, lang, 2)} × ${number(value.area_ha, 2)} ha`
                    : stage.reason === "after_horizon" ? t.after : t.noSales}
                </span>
              </span>
            </li>;
          })}
          <li className="flex items-baseline justify-between border-t-2 border-ink py-3 text-sm font-bold">
            <span>{t.totalRow(value.completed_harvests)}</span>
            <span className="text-base text-sawah">{formatRevenueShort(value.gross_idr, lang)}</span>
          </li>
        </ul>
        <div className="hidden sm:block">
          <table className="w-full border-collapse text-sm tabular-nums [&_td+td]:pl-4 [&_th+th]:pl-4">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-medium">{t.harvest}</th>
                <th className="pb-2 text-right font-medium">{t.yield}</th>
                <th className="pb-2 text-right font-medium">{t.price}</th>
                <th className="pb-2 text-right font-medium">{t.area}</th>
                <th className="pb-2 text-right font-medium">{t.total}</th>
              </tr>
            </thead>
            <tbody>
              {value.stages.map((stage) => {
                const ref = reference(stage.crop_id);
                const counted = stage.reason === "harvest";
                return <tr key={stage.stage_index} className={`border-t border-hairline ${counted ? "" : "text-muted"}`}>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2.5">
                      <CropIcon crop={stage.crop_id} />
                      <span>
                        <span className={counted ? "text-ink" : ""}>{crops[stage.crop_id]}</span>
                        {stage.crop_id === "jagung" && counted && <sup className="text-tanah-strong">1</sup>}
                        <span className="block text-xs text-muted">{formatMonth(stage.harvest_month, lang, "short")}{counted ? ` · ${t.sold(number(stage.quantity_kg))}` : ""}</span>
                      </span>
                    </span>
                  </td>
                  {counted ? <>
                    <td className="text-right">{number(ref?.model_yield_kg_per_ha ?? 0, 2)} kg/ha</td>
                    <td className="text-right">{ref?.price_idr_per_kg == null ? "—" : `${formatRevenue(ref.price_idr_per_kg, lang, 2)}/kg`}</td>
                    <td className="text-right">{number(value.area_ha, 2)} ha</td>
                    <td className="text-right font-bold">{formatRevenueShort(stage.gross_idr, lang)}</td>
                  </> : <td colSpan={4} className="text-right text-xs">{stage.reason === "after_horizon" ? t.after : t.noSales}</td>}
                </tr>;
              })}
              <tr>
                <td className="border-t-2 border-ink py-3 font-bold">{t.totalRow(value.completed_harvests)}</td>
                <td className="border-t-2 border-ink" />
                <td className="border-t-2 border-ink" />
                <td className="border-t-2 border-ink" />
                <td className="border-t-2 border-ink text-right text-base font-bold text-sawah">{formatRevenueShort(value.gross_idr, lang)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {maize && <p className="m-0 text-xs leading-relaxed text-muted"><sup className="text-tanah-strong">1</sup> {t.maize}</p>}
        </div>
        </div>
      </details>

      <details className="-mt-6 border-t border-hairline pt-1">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-sawah-lip"><CircleQuestionMark aria-hidden="true" size={18} strokeWidth={2.25} />{t.details}</summary>
        <div className="flex flex-col gap-6 pb-1 pt-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {t.groups(formula).map((group) => <div key={group.title} className="rounded-xl bg-canvas p-4">
              <h4 className="m-0 mb-2 text-sm font-bold">{group.title}</h4>
              <ul className="m-0 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-muted">{group.points.map((point) => <li key={point}>{point}</li>)}</ul>
            </div>)}
          </div>
          <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-[1.1fr_1fr]">
            <div>
              <h4 className="m-0 mb-2 text-sm font-bold">{t.references}</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm tabular-nums">
                  <thead><tr className="text-left text-xs text-muted"><th className="pb-2 font-medium">{t.crop}</th><th className="pb-2 text-right font-medium">{t.refYield}</th><th className="pb-2 text-right font-medium">{t.refPrice}</th></tr></thead>
                  <tbody>{provenance.references.filter((row) => !row.non_market).map((row) => <tr key={row.crop_id} className="border-t border-hairline">
                    <td className="py-2">{crops[row.crop_id]}</td>
                    <td className="text-right">{number(row.model_yield_kg_per_ha, 2)}</td>
                    <td className="text-right">{row.price_idr_per_kg === null ? "—" : formatRevenue(row.price_idr_per_kg, lang, 2)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </div>
            <div>
              <h4 className="m-0 mb-2 text-sm font-bold">{t.sources}</h4>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">{provenance.sources.map((source) => <li key={source.id}>
                <a className="text-sm font-bold text-sawah-lip underline underline-offset-2" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                <p className="mb-0 mt-1 text-xs leading-relaxed text-muted">{source.locator}</p>
              </li>)}</ul>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
