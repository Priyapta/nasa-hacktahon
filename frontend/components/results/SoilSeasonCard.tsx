"use client";

import dynamic from "next/dynamic";
import { phClass, seasonSummary, type AnalysisResponse, type RainClass } from "@/lib/analysis";
import type { Dictionary } from "@/lib/i18n";
import type { Lang, OpenRing } from "@/lib/types";
import { RAIN_LOOK } from "./FieldSeason";

const FieldMap = dynamic(() => import("./FieldMap"), { ssr: false, loading: () => <div className="h-[150px] bg-[#2E4A22]" /> });

const PH_MIN = 4;
const PH_MAX = 9;
const phAt = (ph: number) => `${(((Math.min(Math.max(ph, PH_MIN), PH_MAX) - PH_MIN) / (PH_MAX - PH_MIN)) * 100).toFixed(1)}%`;

interface SoilSeasonCardProps {
  ring: OpenRing;
  hectares: string;
  context: AnalysisResponse["context"];
  calendarMonths: number[];
  activeCalendarMonth: number;
  onPickCalendarMonth: (month: number) => void;
  lang: Lang;
  t: Dictionary["results"];
}

export default function SoilSeasonCard({ ring, hectares, context, calendarMonths, activeCalendarMonth, onPickCalendarMonth, lang, t }: SoilSeasonCardProps) {
  const locale = lang === "id" ? "id-ID" : "en-GB";
  const one = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const soil = context.soil;
  const summary = seasonSummary(context.climate.monthly);
  const ordered = calendarMonths.map((m) => context.climate.monthly.find((c) => c.month === m)).filter((m) => m !== undefined);
  const monthName = (m: number, style: "narrow" | "long") =>
    new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 1)));

  return (
    <div className="surface flex flex-col overflow-hidden">
      <FieldMap ring={ring} label={`${hectares} ha`} />
      <div className="flex flex-col gap-3.5 px-[18px] py-4">
        <h2 className="m-0 text-base font-bold">{t.soilTitle}</h2>
        {soil.status === "ok" ? (
          <>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-muted">{t.ph}</span>
                <span>
                  <b className="text-[22px] font-bold">{one.format(soil.ph)}</b>{" "}
                  <span className="text-[13px] text-muted">{t.phClass[phClass(soil.ph)]}</span>
                </span>
              </div>
              <div className="relative mt-2 h-3.5 rounded-[7px] bg-[linear-gradient(90deg,#E9B9A0_0%,#F3E2B8_40%,#CFE6B8_60%,#A9CDE0_100%)]" aria-hidden="true">
                <div
                  className="absolute -bottom-1 -top-1 box-border rounded-[9px] border-2 border-[#3E4A43]"
                  style={{ left: phAt(soil.uncertainty.phh2o.q05), right: `calc(100% - ${phAt(soil.uncertainty.phh2o.q95)})` }}
                />
                <div className="absolute -top-[7px] h-7 w-1 rounded-[2px] bg-ink-strong" style={{ left: `calc(${phAt(soil.ph)} - 2px)` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted">
                <span>{t.phLow}</span>
                <span>{t.phRange(one.format(soil.uncertainty.phh2o.q05), one.format(soil.uncertainty.phh2o.q95))}</span>
                <span>{t.phHigh}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[10px] bg-canvas px-3 py-2.5">
                <div className="text-xs text-muted">{t.texture}</div>
                <div className="text-[15px] font-bold">{t.textures[soil.texture_class] ?? soil.texture_class}</div>
              </div>
              <div className="rounded-[10px] bg-canvas px-3 py-2.5">
                <div className="text-xs text-muted">{t.soc}</div>
                <div className="text-[15px] font-bold">{one.format(soil.soc_g_per_kg)} g/kg</div>
              </div>
            </div>
          </>
        ) : (
          <p className="m-0 rounded-[10px] bg-tanah-tint px-3 py-2.5 text-[13px] leading-relaxed text-tanah-strong">{t.soilUnavailable}</p>
        )}

        <div className="flex flex-col gap-3 border-t-2 border-[#EEF0EA] pt-3.5">
          <h2 className="m-0 text-base font-bold">{t.seasonTitle}</h2>
          <div role="group" aria-label={t.seasonAria} className="grid grid-cols-12 gap-[3px]">
            {ordered.map((m) => {
              const on = m.month === activeCalendarMonth;
              const fill = m.class ? RAIN_LOOK[m.class].fill : "#C9CEC4";
              return (
                <button
                  key={m.month}
                  type="button"
                  onClick={() => onPickCalendarMonth(m.month)}
                  aria-pressed={on}
                  aria-label={`${monthName(m.month, "long")}: ${m.class ? t.rainClass[m.class] : t.noData}${m.rain_median_mm != null ? `, ${whole.format(m.rain_median_mm)} mm` : ""}`}
                  className="flex flex-col items-center gap-[3px] border-0 bg-transparent p-0"
                >
                  <span
                    className="block h-[26px] w-full rounded-[6px]"
                    style={{ background: fill, outline: on ? "2px solid #16201B" : undefined, outlineOffset: on ? 2 : undefined }}
                  />
                  <span className={`text-[11px] font-bold ${on ? "text-ink-strong" : "text-[#7A8580]"}`}>{monthName(m.month, "narrow")}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["basah", "lembap", "kering"] as RainClass[]).map((k) => (
              <div key={k} className="rounded-[10px] px-2.5 py-2" style={{ background: RAIN_LOOK[k].tint, color: RAIN_LOOK[k].ink }}>
                <div className="text-lg font-bold">{summary.counts[k]}</div>
                <div className="text-[11px] font-bold">{t.seasonMonths(t.rainClass[k])}</div>
              </div>
            ))}
          </div>
          <div className="rounded-[10px] bg-canvas px-3 py-1">
            <div className="flex items-baseline justify-between gap-2 border-b-2 border-[#ECEDE6] py-2">
              <span className="text-xs text-muted">{t.totalMedian}</span>
              <span className="whitespace-nowrap text-[15px] font-bold">{whole.format(summary.totalMedianMm)} mm</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 py-2">
              <span className="text-xs text-muted">{t.temp}</span>
              <span className="whitespace-nowrap text-[15px] font-bold">
                {summary.tempMin !== null && summary.tempMax !== null ? t.tempRange(one.format(summary.tempMin), one.format(summary.tempMax)) : t.noData}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
