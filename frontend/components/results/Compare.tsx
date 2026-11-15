import { meters, periodYears, timeline, type AnalysisResponse, type Strategy } from "@/lib/analysis";
import type { Dictionary } from "@/lib/i18n";
import { recommendationExplanation } from "@/lib/recommendation";
import type { Lang } from "@/lib/types";
import { formatRevenue } from "@/lib/revenue";
import { CircleCheck, CircleMinus, Info, TriangleAlert } from "lucide-react";
import { countSegments, isRainValidationNote, pointTone, sentences, splitLead, type Tone } from "@/lib/explanation-format";
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
  lang: Lang;
  strategies: Strategy[];
  selected: number;
  onSelect: (index: number) => void;
  startMonth: string;
  horizon: number;
  t: T;
}

export function StrategyCards({ strategies, selected, onSelect, startMonth, horizon, t, lang }: CardsProps) {
  return (
    <section aria-labelledby="pick-title" className="flex flex-col gap-3">
      <h2 id="pick-title" className="m-0 text-xl font-bold">{t.pickTitle}</h2>
      <div role="radiogroup" aria-labelledby="pick-title" className={`grid grid-cols-1 gap-3.5 ${strategies.length > 3 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}>
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
              {s.revenue && <span className={`flex w-full flex-col gap-1 rounded-[10px] px-3 py-2 ${s.revenue.is_highest ? "bg-[#FFF1CF]" : "bg-canvas"}`}>
                <span className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted">{t.cardRevenue}{s.revenue.is_highest && <b className="text-[#765100]">{t.highestRevenue}</b>}</span>
                <span className="text-lg font-bold">{formatRevenue(s.revenue.gross_idr, lang)}</span>
              </span>}
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

const TONE_ICON = { ok: CircleCheck, warn: TriangleAlert, neutral: CircleMinus } as const;
const TONE_ICON_CLASS = { ok: "text-sawah", warn: "text-[#b4562a]", neutral: "text-muted" } as const;

function cropFromText(text: string, names: Record<string, string>): string | null {
  const lower = text.toLowerCase();
  const hit = Object.entries(names).find(([, name]) => lower.startsWith(name.toLowerCase()));
  return hit ? hit[0] : null;
}

function Highlighted({ text, tone, lang }: { text: string; tone: Tone; lang: Lang }) {
  return <>{countSegments(text, lang).map((segment, i) => "label" in segment
    ? <span key={i} className={`ml-0.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[13px] font-bold ${tone === "warn" ? "bg-[#f8e9df] text-[#8e4220]" : "bg-sawah-tint text-sawah-lip"}`}>{segment.label}</span>
    : <span key={i}>{segment.text}</span>)}</>;
}

export function WhyCard({ strategy, lang, t }: { strategy: Strategy; lang: Lang; t: T }) {
  const explanation = recommendationExplanation(strategy, lang);
  const notes = [...new Set([
    ...strategy.reasons.filter((reason) => !explanation.includes(reason)),
    ...strategy.tradeoffs,
    ...strategy.dimensions.risks,
  ])];
  const cautions = (strategy.explanation?.cautions ?? t.disclaimer).flatMap(sentences).filter((point) => !isRainValidationNote(point));
  const shown = cautions.slice(0, 3);
  const hidden = cautions.slice(3);
  return (
    <section className="surface flex flex-col gap-5 px-5 py-[18px]" aria-labelledby="recommendation-title">
      <div className="flex flex-col gap-3">
        <h2 id="recommendation-title" className="m-0 text-lg font-bold">{strategy.role === "pola_biasa" ? t.usualWhyTitle : t.whyTitle}</h2>
        <ul aria-label={t.assessmentList} className="m-0 flex list-none flex-col gap-2 p-0">
          {explanation.map((point) => {
            const tone = pointTone(point);
            const { lead, body } = splitLead(point);
            const crop = cropFromText(lead ?? point, t.crops);
            const Icon = TONE_ICON[tone];
            return (
              <li key={point} className="flex gap-3 rounded-md bg-canvas px-3.5 py-3 text-sm leading-relaxed">
                <Icon size={18} className={`mt-0.5 shrink-0 ${TONE_ICON_CLASS[tone]}`} aria-hidden="true" />
                <span className="min-w-0">
                  {lead && <span className="flex items-center gap-2 font-bold text-ink-strong">
                    {crop && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: CROP_LOOK[crop].bg, border: crop === "bera" ? "1.5px dashed #cf9a7b" : undefined }} />}
                    {lead}
                  </span>}
                  {sentences(body).map((sentence) => <span key={sentence} className="block"><Highlighted text={sentence} tone={tone} lang={lang} /></span>)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col gap-2.5 border-t-2 border-hairline pt-4">
        <h3 className="m-0 text-base font-bold">{t.importantNote}</h3>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm leading-relaxed">
          {shown.map((point) => <li key={point} className="flex gap-2.5"><Info size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{point}</li>)}
        </ul>
        {hidden.length > 0 && <details className="text-sm leading-relaxed">
          <summary className="min-h-11 cursor-pointer py-3 font-bold text-sawah-lip">{t.moreNotes(hidden.length)}</summary>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">{hidden.map((point) => <li key={point} className="flex gap-2.5"><Info size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{point}</li>)}</ul>
        </details>}
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
  const notes = [...new Set(result.notes)].filter((note) =>
    !isRainValidationNote(note) && !(p.economics && /^(Omzet memakai|Revenue uses)/.test(note)),
  );
  const assumptions = [...new Set(p.assumptions)].filter((note) => !isRainValidationNote(note));
  return (
    <details className="surface px-5 py-4">
      <summary className="cursor-pointer text-base font-bold">{t.sourcesTitle}</summary>
      <div className="mt-4 grid grid-cols-1 items-start gap-6 text-sm leading-relaxed md:grid-cols-2 md:gap-8">
        <div>
          <h3 className="m-0 mb-3 text-sm font-bold">{t.sourceListTitle}</h3>
          <dl className="m-0 flex flex-col gap-4">
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <dt className="text-muted">{t.climateLabel}</dt>
              <dd className="m-0">
                <span className="block font-bold">{p.climate.source}</span>
                <span className="block">{t.yearRange(...periodYears(result.context.climate.period))} · {t.missingDays(p.climate.missing_days)}</span>
                <span className="mt-1 block text-xs text-muted">{p.climate.resolution}</span>
              </dd>
            </div>
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <dt className="text-muted">{t.soilLabel}</dt>
              <dd className="m-0">{result.context.soil.status === "ok" && p.soil ? <><span className="font-bold">{p.soil.source}</span><span className="block text-xs text-muted">{p.soil.resolution}</span></> : t.soilUnavailable}</dd>
            </div>
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <dt className="text-muted">{t.cropTable}</dt>
              <dd className="m-0 break-words">{p.crop_table_version.split(":")[0]}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h3 className="m-0 mb-3 text-sm font-bold">{t.readingTitle}</h3>
          <ul className="m-0 list-disc space-y-2 pl-5 text-muted">
            <li>{t.readingNote}</li>
            {notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
          {p.economics && <p className="mb-0 mt-3"><a className="text-sawah-lip underline underline-offset-2" href="#revenue-title">{t.revenueDetails}</a></p>}
        </div>
      </div>
      {assumptions.length > 0 && <details className="mt-5 border-t border-hairline pt-1 text-sm leading-relaxed">
        <summary className="min-h-11 cursor-pointer py-3 font-bold text-sawah-lip">{t.methodDetails}</summary>
        <ul className="m-0 max-w-3xl list-disc space-y-2 pb-2 pl-5 text-muted">{assumptions.map((note) => <li key={note}>{note}</li>)}</ul>
      </details>}
    </details>
  );
}
