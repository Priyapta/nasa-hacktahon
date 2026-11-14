import { meters, periodYears, timeline, type AnalysisResponse, type Strategy } from "@/lib/analysis";
import type { Dictionary } from "@/lib/i18n";
import { recommendationExplanation, recommendationSources } from "@/lib/recommendation";
import type { Lang } from "@/lib/types";
import { CROP_LOOK } from "./FieldSeason";

type T = Dictionary["results"];

function Meter({ filled }: { filled: number }) {
  return (
    <span className="mb-1 flex gap-[3px]" aria-hidden="true">
      {[0, 1, 2].map((b) => (
        <span key={b} className={`h-2 w-[22px] rounded-[3px] ${b < filled ? "bg-sawah" : "bg-hairline"}`} />
      ))}
    </span>
  );
}

function Status({ passed, t }: { passed: boolean; t: T }) {
  return (
    <span className={`rounded-[8px] px-2 py-1 text-xs font-bold ${passed ? "bg-sawah-tint text-sawah-lip" : "bg-tanah-tint text-tanah-strong"}`}>
      {passed ? `✓ ${t.passed}` : t.failed}
    </span>
  );
}

interface CardsProps {
  strategies: Strategy[];
  selected: number;
  onSelect: (index: number) => void;
  startMonth: string;
  horizon: number;
  t: T;
}

export function StrategyCards({ strategies, selected, onSelect, startMonth, horizon, t }: CardsProps) {
  return (
    <section aria-labelledby="pick-title" className="flex flex-col gap-3">
      <h2 id="pick-title" className="m-0 text-xl font-bold">{t.pickTitle}</h2>
      <div role="radiogroup" aria-labelledby="pick-title" className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {strategies.map((s, i) => {
          const on = i === selected;
          const months = timeline(s.calendar, startMonth, horizon);
          const m = meters(s, horizon);
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(i)}
              className={`flex flex-col gap-3 rounded-2xl bg-white p-4 text-left ${on ? "border-[3px] border-b-[6px] border-sawah border-b-sawah-lip" : "border-2 border-b-4 border-hairline border-b-hairline-lip"}`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-lg font-bold text-ink-strong">{s.label}</span>
                <Status passed={s.feasibility.passed} t={t} />
              </span>
              <span className="grid w-full gap-0.5" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }} aria-hidden="true">
                {months.map((mo) => (
                  <span
                    key={mo.month}
                    className="h-3 rounded-[4px]"
                    style={{
                      background: CROP_LOOK[mo.stage.crop_id].bg,
                      border: mo.stage.crop_id === "bera" ? "2px dashed #CF9A7B" : undefined,
                      boxSizing: "border-box",
                    }}
                  />
                ))}
              </span>
              <span className="flex w-full gap-2">
                {[
                  [t.cardWater, t.ofTotal(s.dimensions.water_pressure.years_met, s.dimensions.water_pressure.years_total)],
                  [t.cardBare, t.monthsN(s.dimensions.bare_months)],
                  [t.cardSoil, t.ofThree(m.soilChecks)],
                ].map(([label, value]) => (
                  <span key={label} className="flex flex-1 flex-col gap-1 rounded-[10px] bg-canvas px-2.5 py-2">
                    <span className="text-[11px] text-muted">{label}</span>
                    <span className="text-[15px] font-bold">{value}</span>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function DimensionTable({ strategies, selected, horizon, t }: { strategies: Strategy[]; selected: number; horizon: number; t: T }) {
  const rows = [
    { name: t.rows.climate, cell: (s: Strategy) => [meters(s, horizon).climate, t.level[s.dimensions.climate_fit.level]] as const },
    {
      name: t.rows.water,
      cell: (s: Strategy) =>
        [meters(s, horizon).water, `${t.level[s.dimensions.water_pressure.level]} · ${s.dimensions.water_pressure.years_met}/${s.dimensions.water_pressure.years_total}`] as const,
    },
    { name: t.rows.bare, cell: (s: Strategy) => [meters(s, horizon).bare, t.monthsN(s.dimensions.bare_months)] as const },
    { name: t.rows.soil, cell: (s: Strategy) => [meters(s, horizon).soil, t.ofThree(meters(s, horizon).soilChecks)] as const },
    { name: t.rows.risk, cell: (s: Strategy) => [meters(s, horizon).risk, t.riskCount(s.dimensions.risks.length)] as const },
  ];
  return (
    <div className="surface overflow-x-auto px-5 py-[18px]">
      <h2 className="m-0 mb-2.5 text-lg font-bold">{t.tableTitle}</h2>
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="px-1.5 py-2" />
            {strategies.map((s, i) => (
              <th
                key={s.id}
                scope="col"
                className={`px-2.5 py-2 text-left text-[13px] font-bold ${i === selected ? "rounded-t-[10px] bg-sawah-tint text-sawah-lip" : "text-[#3E4A43]"}`}
              >
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row" className="w-32 border-t-2 border-[#EEF0EA] px-1.5 py-2.5 text-left font-bold text-[#3E4A43]">
                {row.name}
              </th>
              {strategies.map((s, i) => {
                const [filled, text] = row.cell(s);
                return (
                  <td key={s.id} className={`border-t-2 border-[#EEF0EA] p-2.5 align-top ${i === selected ? "bg-[#F4F9F5]" : ""}`}>
                    <Meter filled={filled} />
                    <span className="font-bold">{text}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 mt-2.5 text-xs text-muted">{t.tableNote}</p>
    </div>
  );
}

export function WhyCard({ strategy, result, lang, t }: { strategy: Strategy; result: AnalysisResponse; lang: Lang; t: T }) {
  const explanation = recommendationExplanation(strategy, lang);
  const notes = [...new Set([
    ...strategy.reasons.filter((reason) => !explanation.includes(reason)),
    ...strategy.tradeoffs,
    ...strategy.dimensions.risks,
  ])];
  return (
    <section className="surface flex flex-col gap-5 px-5 py-[18px]" aria-labelledby="recommendation-title">
      <div className="flex flex-col gap-2">
        <h2 id="recommendation-title" className="m-0 text-lg font-bold">{strategy.role === "pola_biasa" ? t.usualWhyTitle : t.whyTitle}</h2>
        <ul className="m-0 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {explanation.map((point) => <li key={point}>{point}</li>)}
        </ul>
      </div>
      <div className="flex flex-col gap-2 border-t-2 border-hairline pt-4">
        <h3 className="m-0 text-base font-bold">{t.recommendationBasis}</h3>
        <ul className="m-0 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
          {(strategy.explanation?.basis ?? recommendationSources(result, lang)).map((source) => <li key={source}>{source}</li>)}
        </ul>
      </div>
      <div className="flex flex-col gap-2 border-t-2 border-hairline pt-4">
        <h3 className="m-0 text-base font-bold">{t.importantNote}</h3>
        <ul className="m-0 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {(strategy.explanation?.cautions ?? t.disclaimer).map((point) => <li key={point}>{point}</li>)}
        </ul>
        {notes.length > 0 && <details className="mt-1 text-sm leading-relaxed">
          <summary className="min-h-11 cursor-pointer py-3 font-bold text-sawah-lip">{t.notesTitle}</summary>
          <ul className="m-0 space-y-2 pl-5 text-muted">{notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </details>}
      </div>
    </section>
  );
}

export function Sources({ result, t }: { result: AnalysisResponse; t: T }) {
  const p = result.provenance;
  return (
    <details className="surface px-5 py-4">
      <summary className="cursor-pointer text-base font-bold">
        {t.sourcesTitle}
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-5 text-[13px] leading-relaxed md:grid-cols-2">
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5">
          <dt className="text-muted">{t.climateLabel}</dt>
          <dd className="m-0">
            {p.climate.source} {t.yearRange(...periodYears(result.context.climate.period))}, {t.missingDays(p.climate.missing_days)}. {p.climate.resolution}
          </dd>
          <dt className="text-muted">{t.soilLabel}</dt>
          <dd className="m-0">{result.context.soil.status === "ok" && p.soil ? `${p.soil.source}, ${p.soil.resolution}` : t.soilUnavailable}</dd>
          <dt className="text-muted">{t.cropTable}</dt>
          <dd className="m-0">{p.crop_table_version.split(":")[0]}</dd>
        </dl>
        <ul className="m-0 pl-[18px]">
          {[...result.notes, ...p.assumptions].map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
