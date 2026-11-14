"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { Pause, Play } from "lucide-react";
import { climateFor, growth, timeline, type MonthlyClimate, type RainClass, type Strategy } from "@/lib/analysis";
import { cloudPath, sceneGeometry, SCENE_H, SCENE_W } from "@/lib/field-scene";
import { formatMonth, type Dictionary } from "@/lib/i18n";
import type { Lang, OpenRing } from "@/lib/types";
import Plant from "./Plant";
import styles from "./FieldSeason.module.css";

export const RAIN_LOOK: Record<RainClass, { fill: string; tint: string; ink: string; sky: string }> = {
  basah: { fill: "#5E9FCC", tint: "#E3EEF6", ink: "#134A6E", sky: "#E4EBEE" },
  lembap: { fill: "#8FB3A0", tint: "#E8F0EA", ink: "#2F4A3C", sky: "#EEF3EC" },
  kering: { fill: "#D9A27F", tint: "#F8E9DF", ink: "#8E4220", sky: "#F7F2E6" },
};
const NO_DATA = { fill: "#C9CEC4", tint: "#F0F1EC", ink: "#5B6660", sky: "#F1F4EC" };

export const CROP_LOOK: Record<string, { bg: string; ink: string; tint: string }> = {
  padi_sawah: { bg: "#1F7A4D", ink: "#FFFFFF", tint: "rgba(31,122,77,0.10)" },
  jagung: { bg: "#E2B13C", ink: "#16201B", tint: "rgba(226,177,60,0.14)" },
  kedelai: { bg: "#6E9A3E", ink: "#FFFFFF", tint: "rgba(110,154,62,0.14)" },
  kacang_hijau: { bg: "#8CBF5F", ink: "#16201B", tint: "rgba(140,191,95,0.16)" },
  orok_orok: { bg: "#C9A82E", ink: "#16201B", tint: "rgba(201,168,46,0.14)" },
  bera: { bg: "#F8E9DF", ink: "#8E4220", tint: "transparent" },
};

const PHASE_LOOK = {
  tanam: ["#E3F1E8", "#145A37"],
  tumbuh: ["#E3F1E8", "#145A37"],
  panen: ["#FBF1D6", "#7A5A0E"],
  bera: ["#F8E9DF", "#8E4220"],
} as const;

const GAUGE_BASE = 240;
const GAUGE_SCALE = 230 / 400;
const DROPS = 40;

interface FieldSeasonProps {
  ring: OpenRing;
  hectares: string;
  strategy: Strategy;
  monthly: MonthlyClimate[];
  startMonth: string;
  horizon: number;
  offset: number;
  onOffset: Dispatch<SetStateAction<number>>;
  lang: Lang;
  t: Dictionary["results"];
}

export default function FieldSeason({ ring, hectares, strategy, monthly, startMonth, horizon, offset, onOffset, lang, t }: FieldSeasonProps) {
  const geo = useMemo(() => sceneGeometry(ring), [ring]);
  const months = useMemo(() => timeline(strategy.calendar, startMonth, horizon), [strategy, startMonth, horizon]);
  const [playing, setPlaying] = useState(false);
  const clipId = useId();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const number = useMemo(() => new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-GB", { maximumFractionDigits: 0 }), [lang]);
  const decimal = useMemo(() => new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [lang]);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    // Plants and rain are sized in pixels, so they follow the scene width on small screens.
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(entry.contentRect.width / SCENE_W, 1.2)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => onOffset((o) => (o + 1) % months.length), 1600);
    return () => window.clearInterval(timer);
  }, [playing, months.length, onOffset]);

  const now = months[Math.min(offset, months.length - 1)];
  if (!now) return null;
  const climate = climateFor(monthly, now.calendarMonth);
  const look = climate?.class ? RAIN_LOOK[climate.class] : NO_DATA;
  const crop = now.stage.crop_id;
  const g = growth(now);
  const index = Math.min(offset, months.length - 1);
  // Seedlings appear row by row only when the stage begins, not on every render.
  const newCrop = now.phase === "tanam" && (index === 0 || months[index - 1].stageIndex !== now.stageIndex);
  const size = 0.615 * scale * (crop === "kacang_hijau" || crop === "kedelai" ? 1.5 : 1);
  const plantStyle: CSSProperties =
    now.phase === "bera" ? { transform: `scale(${0.6 * size}, 0.02)` } : { transform: `scale(${((0.55 + 0.45 * g) * size).toFixed(3)}, ${(g * size).toFixed(3)})` };
  const warning = now.stage.warnings[0];
  const water = now.stage.water;
  const rain = climate?.rain_median_mm ?? null;
  const dry = climate?.class === "kering";
  const wet = climate?.class === "basah";
  const dropCount = dry || rain === null ? 0 : Math.round(Math.min(rain, 400) / 9);
  const rippleCount = crop === "padi_sawah" && rain !== null ? Math.min(geo.ripples.length, Math.round(rain / 36)) : 0;
  const rainTop = geo.cloud.y + 30;
  const rainHeight = Math.max(80, geo.centre[1] + 30 - rainTop);
  const fill = Math.min(rain ?? 0, 400) * GAUGE_SCALE;
  const high = Math.min(climate?.rain_max_mm ?? 0, 400) * GAUGE_SCALE;
  const low = (climate?.rain_min_mm ?? 0) * GAUGE_SCALE;
  const over = (climate?.rain_max_mm ?? 0) > 400;
  const pct = ([x, y]: [number, number]) => ({ left: `${((x / SCENE_W) * 100).toFixed(2)}%`, top: `${((y / SCENE_H) * 100).toFixed(2)}%` });
  const monthLabel = formatMonth(now.month, lang, "short");
  const phase = PHASE_LOOK[now.phase];

  let column = 1;
  const track = strategy.calendar
    .map((stage, index) => {
      const span = months.filter((m) => m.stageIndex === index).length;
      const item = { stage, index, column, span };
      column += span;
      return item;
    })
    .filter((item) => item.span > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
        <div className="relative flex flex-col gap-2 md:block">
          <div className="surface w-full !rounded-[12px] px-2.5 py-2 md:absolute md:left-3 md:top-3 md:z-10 md:w-[200px]" aria-live="polite">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">{monthLabel}</span>
              <span className="rounded-[7px] px-2 py-0.5 text-[11px] font-bold" style={{ background: phase[0], color: phase[1] }}>
                {t.phase[now.phase]}
              </span>
            </div>
            <div className="mt-0.5 text-[13px] font-bold">{t.crops[crop]}</div>
            <div className="mt-px text-[11px] leading-snug text-muted">
              {crop === "bera"
                ? t.fallowFor(now.n)
                : `${t.stageOf(now.k, now.n)}${water ? ` · ${t.stageRain(water.years_met, water.years_total)}` : ""}`}
            </div>
            {warning && (
              <div className="mt-1.5 rounded-[7px] bg-[#FBE7DA] px-2 py-1 text-[11px] font-bold leading-snug text-tanah-strong">⚠ {warning}</div>
            )}
          </div>
          <div ref={sceneRef} className={styles.scene} role="img" aria-label={`${monthLabel}: ${t.crops[crop]}, ${t.rainMedian.toLowerCase()} ${rain === null ? t.noData : `${number.format(rain)} mm`}`}>
            <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true">
              <defs>
                <clipPath id={clipId}>
                  <polygon points={geo.surface} />
                </clipPath>
              </defs>
              <rect width={SCENE_W} height={SCENE_H} className={styles.fade} style={{ fill: look.sky }} />
              <polygon points={geo.ground} fill="#DCE7CF" />
              <polygon points={geo.groundIn} fill="#E4EDD9" />
              <polygon points={geo.shadow} fill="#1F2A24" fillOpacity="0.14" />
              {geo.sides.map((side, i) => (
                <polygon key={i} points={side} fill={i % 2 ? "#6B4E38" : "#5A4130"} />
              ))}
              <polygon points={geo.surface} fill="#8A6A4C" />
              <g clipPath={`url(#${clipId})`}>
                <path d={geo.furrows} stroke="#6E5038" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path className={styles.fade} d={geo.cracks} stroke="#4E3826" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: crop === "bera" && dry ? 1 : 0 }} />
                <g className={styles.fade} style={{ opacity: crop === "padi_sawah" ? 1 : 0 }}>
                  <polygon points={geo.surface} fill="#6FA8D6" fillOpacity="0.8" />
                  <path d={geo.shine} stroke="#D9ECF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                </g>
              </g>
              <polygon className={styles.rim} points={geo.surface} fill="none" strokeLinejoin="round" style={{ stroke: warning ? "#E8743A" : "#A6CF6E", strokeWidth: warning ? 7 : 5 }} />
              <g className={styles.fade} style={{ opacity: dry ? 1 : 0 }}>
                <circle cx={SCENE_W - 70} cy={62} r={22} fill="#F2C14E" />
                <path
                  d={Array.from({ length: 8 }, (_, i) => {
                    const a = (i * Math.PI) / 4;
                    return `M${(SCENE_W - 70 + Math.cos(a) * 30).toFixed(1)} ${(62 + Math.sin(a) * 30).toFixed(1)}L${(SCENE_W - 70 + Math.cos(a) * 38).toFixed(1)} ${(62 + Math.sin(a) * 38).toFixed(1)}`;
                  }).join("")}
                  stroke="#F2C14E"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </g>
              <path
                className={styles.fade}
                d={cloudPath(geo.cloud.x, geo.cloud.y, 1.25, 5) + cloudPath(geo.cloud.x + 100, geo.cloud.y + 16, 0.74, 4)}
                style={{ fill: wet ? "#93A3B0" : "#D5DCE2", opacity: dry || rain === null ? 0 : 1 }}
              />
              <path
                className={styles.fade}
                d={cloudPath(geo.cloud.x, geo.cloud.y, 1.25) + cloudPath(geo.cloud.x + 100, geo.cloud.y + 16, 0.74)}
                style={{ fill: wet ? "#B4C0CA" : "#F3F6F8", opacity: dry || rain === null ? 0 : 1 }}
              />
            </svg>

            <div className={styles.layer} aria-hidden="true">
              {geo.ripples.map((p, i) => (
                <span key={i} className={`${styles.spot} ${styles.quick}`} style={{ ...pct(p), opacity: i < rippleCount ? 1 : 0 }}>
                  <span className={styles.ripple} style={{ animationDelay: `${-((i * 0.37) % 1.4)}s` }} />
                </span>
              ))}
            </div>

            <div className={styles.layer} aria-hidden="true">
              {geo.plants.map((p, i) => {
                const delay = newCrop ? `${(i % 9) * 35 + Math.floor(i / 9) * 35}ms` : "0ms";
                return (
                  <div key={i} className={styles.spot} style={pct(p)}>
                    <Plant crop={crop} ripe={now.phase === "panen"} cob={g >= 0.75} delay={delay} style={{ ...plantStyle, transitionDelay: delay }} />
                  </div>
                );
              })}
            </div>

            <div
              className={styles.rain}
              aria-hidden="true"
              style={{
                left: `${(((geo.cloud.x - 62) / SCENE_W) * 100).toFixed(2)}%`,
                top: `${((rainTop / SCENE_H) * 100).toFixed(2)}%`,
                width: `${((210 / SCENE_W) * 100).toFixed(2)}%`,
                height: `${((rainHeight / SCENE_H) * 100).toFixed(2)}%`,
              }}
            >
              {Array.from({ length: DROPS }, (_, i) => {
                const r = ((i * 29) % DROPS) / DROPS;
                return (
                  <span key={i} className={styles.dropWrap} style={{ left: `${(i * 37) % 97}%`, opacity: i < dropCount ? 1 : 0 }}>
                    <span
                      className={styles.drop}
                      style={{
                        animationDelay: `${(-r * 0.9).toFixed(2)}s`,
                        animationDuration: `${(0.8 + ((i * 7) % 5) / 25).toFixed(2)}s`,
                        transform: `translate(${(-12 * r).toFixed(1)}px, ${(rainHeight * scale * r).toFixed(0)}px)`,
                        ["--fall" as string]: `${(rainHeight * scale).toFixed(0)}px`,
                      }}
                    />
                  </span>
                );
              })}
            </div>

            <div className="absolute hidden md:block" style={{ ...pct(geo.tag), transform: "translate(-50%, 12px)" }}>
              <span className="absolute left-[calc(50%-6px)] -top-[5px] size-3 rotate-45 rounded-[2px] bg-white" />
              <span className="relative block whitespace-nowrap rounded-[8px] bg-white px-2.5 py-1 text-xs font-bold">{t.fieldTag(hectares)}</span>
            </div>

          </div>
        </div>

        <div className="flex flex-col rounded-xl bg-canvas px-2.5 py-3">
          <div className="text-xs text-muted">{t.rainThisMonth}</div>
          <div className="whitespace-nowrap text-[26px] font-bold tracking-tight" style={{ color: look.ink }}>
            {rain === null ? <span className="text-base">{t.noData}</span> : <>{number.format(rain)}<span className="ml-0.5 text-[15px]">mm</span></>}
          </div>
          <div>
            <span className="inline-block rounded-[7px] px-2 py-0.5 text-[11.5px] font-bold" style={{ background: look.tint, color: look.ink }}>
              {climate?.class ? t.rainClass[climate.class] : t.noData}
            </span>
          </div>
          <svg viewBox="0 0 130 250" className="my-2.5 h-[210px] w-full" aria-hidden="true">
            <g fontSize="11" fontWeight="700" textAnchor="end">
              {[0, 100, 200, 300, 400].map((v) => (
                <text key={v} x="42" y={GAUGE_BASE - v * GAUGE_SCALE + 4} fill={v === 200 ? "#134A6E" : "#7A8580"}>
                  {v}
                </text>
              ))}
            </g>
            <rect x="56" y="6" width="28" height="238" rx="14" fill="#FFFFFF" stroke="#C9CEC4" strokeWidth="2.5" />
            <rect className={styles.gaugeFill} x="59" width="22" rx="11" style={{ y: GAUGE_BASE + 1 - fill, height: Math.max(fill, 0.1), fill: look.fill } as CSSProperties} />
            <path d={`M46 ${GAUGE_BASE - 200 * GAUGE_SCALE}h56`} stroke="#134A6E" strokeWidth="2" strokeDasharray="4 3" />
            {climate?.rain_max_mm != null && (
              <>
                <rect className={styles.gaugeFill} x="95" width="3" fill="#3E4A43" style={{ y: GAUGE_BASE - high, height: Math.max(high - low, 2) } as CSSProperties} />
                <rect className={styles.gaugeFill} x="91.5" width="10" height="2.5" rx="1" fill="#3E4A43" style={{ y: GAUGE_BASE - low - 1.25 } as CSSProperties} />
                {over ? (
                  <path d="M91.5 10l5 -8l5 8z" fill="#3E4A43" />
                ) : (
                  <rect className={styles.gaugeFill} x="91.5" width="10" height="2.5" rx="1" fill="#3E4A43" style={{ y: GAUGE_BASE - high - 1.25 } as CSSProperties} />
                )}
              </>
            )}
          </svg>
          <div className="flex flex-col gap-1 border-t-2 border-[#E8EAE3] pt-2 text-[10.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded" style={{ background: look.fill }} />
              {t.legendMedian}
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2 1.5h8M6 1.5v9M2 10.5h8" stroke="#3E4A43" strokeWidth="2" fill="none" />
              </svg>
              {t.legendRange}
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M0 6h12" stroke="#134A6E" strokeWidth="2" strokeDasharray="3 2" />
              </svg>
              {t.legendWet}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 lg:grid-cols-4">
        <div className="min-h-[72px] rounded-[10px] px-3 py-2.5" style={{ background: look.tint }}>
          <div className="text-[11px] text-muted">{t.rainMedian}</div>
          <div className="text-[19px] font-bold" style={{ color: look.ink }}>
            {rain === null ? t.noData : `${number.format(rain)} mm`}{" "}
            <span className="block min-h-5 text-[13px] lg:inline">{climate?.class ? t.rainClass[climate.class] : ""}</span>
          </div>
        </div>
        <div className="min-h-[72px] rounded-[10px] bg-canvas px-3 py-2.5">
          <div className="text-[11px] text-muted">{t.range}</div>
          <div className="text-[17px] font-bold">
            {climate?.rain_min_mm != null && climate.rain_max_mm != null ? t.rangeValue(number.format(climate.rain_min_mm), number.format(climate.rain_max_mm)) : t.noData}
          </div>
        </div>
        <div className="min-h-[72px] rounded-[10px] bg-canvas px-3 py-2.5">
          <div className="text-[11px] text-muted">{t.temp}</div>
          <div className="text-[19px] font-bold">{climate?.t_mean_c != null ? `${decimal.format(climate.t_mean_c)}°C` : t.noData}</div>
        </div>
        <div className="min-h-[72px] rounded-[10px] bg-canvas px-3 py-2.5">
          <div className="text-[11px] text-muted">{crop === "bera" ? t.waterNeed : t.stageWater}</div>
          <div className="text-[17px] font-bold">
            {crop === "bera" ? t.none : water ? t.years(water.years_met, water.years_total) : t.notAssessed}
          </div>
          {/* Always rendered so the tile row keeps its height when a month has no water check. */}
          <div className={`mt-1.5 flex min-h-3 flex-wrap gap-[3px] ${water && crop !== "bera" ? "" : "invisible"}`} aria-hidden="true">
            {Array.from({ length: water?.years_total ?? strategy.dimensions.water_pressure.years_total }, (_, i) => (
              <span
                key={i}
                className={`size-3 rounded-[3px] ${water && i < water.years_met ? "bg-sawah" : "border-2 border-tanah-lip bg-white"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? t.pause : t.play}
          aria-pressed={playing}
          className="btn-primary size-12 min-h-12 shrink-0 p-0"
        >
          {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
        </button>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div style={{ minWidth: months.length * 40 }}>
            <div role="group" aria-label={t.pickMonth} className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
              {months.map((m, i) => {
                const on = i === offset;
                const c = climateFor(monthly, m.calendarMonth);
                return (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => onOffset(i)}
                    aria-pressed={on}
                    aria-label={t.monthAria(formatMonth(m.month, lang), c?.rain_median_mm != null ? number.format(c.rain_median_mm) : t.noData)}
                    className={`rounded-[8px] border-0 py-1.5 text-xs font-bold ${on ? "bg-ink-strong text-white" : "bg-transparent text-muted hover:bg-canvas"}`}
                  >
                    {new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${m.month}-01T00:00:00Z`))}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
              {track.map(({ stage, index, column: col, span }) => {
                const c = CROP_LOOK[stage.crop_id];
                const border = stage.crop_id === "bera" ? "2px dashed #CF9A7B" : stage.warnings.length ? "3px solid #E07A3F" : "0";
                return (
                  <div
                    key={index}
                    className="flex min-h-9 items-center justify-center overflow-hidden rounded-[8px] px-1 text-[12.5px] font-bold"
                    style={{ gridColumn: `${col} / span ${span}`, background: c.bg, color: c.ink, border, boxSizing: "border-box" }}
                  >
                    <span className="truncate">{t.crops[stage.crop_id]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
