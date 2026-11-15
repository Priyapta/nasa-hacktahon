import type { RevenueEstimate, RevenueProvenance } from "./revenue";
import { ApiError } from "./api";
import { addMonths } from "./query";
import type { AnalyzeRequest, ApiErrorBody, CropId } from "./types";

export type RainClass = "basah" | "lembap" | "kering";
export type Level = "rendah" | "sedang" | "tinggi";
export type Role = "pola_biasa" | "hemat_air" | "jaga_tanah" | "seimbang" | "omzet_tertinggi";
export type Phase = "tanam" | "tumbuh" | "panen" | "bera";

export interface MonthlyClimate {
  month: number;
  rain_median_mm: number | null;
  rain_min_mm: number | null;
  rain_max_mm: number | null;
  class: RainClass | null;
  t_mean_c: number | null;
  n_years: number;
}

export interface SoilAvailable {
  status: "ok";
  depth: string;
  texture_class: string;
  ph: number;
  soc_g_per_kg: number;
  uncertainty: { phh2o?: { q05: number; q95: number } };
}

export interface SoilUnavailable {
  status: "unavailable";
}

export interface CalendarStage {
  crop_id: CropId;
  start: string;
  end: string;
  continues_after_horizon: boolean;
  water: { years_met: number; years_total: number } | null;
  warnings: string[];
}

export interface Strategy {
  id: string;
  role: Role;
  label: string;
  calendar: CalendarStage[];
  feasibility: { passed: boolean; failed_rules: string[] };
  dimensions: {
    climate_fit: { level: Level; evidence: string };
    water_pressure: { level: Level; years_met: number; years_total: number };
    bare_months: number;
    soil_contribution: { legume: boolean; cover_crop: boolean; families: number };
    risks: string[];
  };
  reasons: string[];
  tradeoffs: string[];
  revenue?: RevenueEstimate;
  explanation?: {
    assessment: string[];
    basis: string[];
    cautions: string[];
  } | null;
}

export interface AnalysisResponse {
  context: {
    climate: { period: string; monthly: MonthlyClimate[] };
    soil: SoilAvailable | SoilUnavailable;
  };
  strategies: Strategy[];
  notes: string[];
  provenance: {
    climate: { source: string; resolution: string; missing_days: number; rain_validation: { status: string; reference?: string | null } };
    soil: { source: string; resolution: string } | null;
    economics?: RevenueProvenance;
    crop_table_version: string;
    assumptions: string[];
  };
}

export async function analyze(body: AnalyzeRequest, signal?: AbortSignal): Promise<AnalysisResponse> {
  const response = await fetch("/api/v1/analyze", {
    method: "POST",
    signal,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const error = (await response.json()) as ApiErrorBody;
      message = typeof error.detail === "string" ? error.detail : error.detail.map((item) => item.msg).join(" ");
    } catch {}
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as AnalysisResponse;
}

export function periodYears(period: string): [string, string] {
  const [from, to] = period.split("/");
  return [from.slice(0, 4), (to ?? from).slice(0, 4)];
}

export function monthIndex(month: string): number {
  const [year, index] = month.split("-").map(Number);
  return year * 12 + index - 1;
}

export interface TimelineMonth {
  month: string;
  calendarMonth: number;
  stageIndex: number;
  stage: CalendarStage;
  k: number;
  n: number;
  phase: Phase;
}

/** One entry per month of the horizon, each pointing at the stage that occupies it. */
export function timeline(calendar: CalendarStage[], startMonth: string, horizon: number): TimelineMonth[] {
  return Array.from({ length: horizon }, (_, offset) => {
    const month = addMonths(startMonth, offset);
    const at = monthIndex(month);
    const stageIndex = calendar.findIndex((s) => monthIndex(s.start) <= at && at <= monthIndex(s.end));
    const stage = calendar[stageIndex];
    if (!stage) return null;
    const n = monthIndex(stage.end) - monthIndex(stage.start) + 1;
    const k = at - monthIndex(stage.start) + 1;
    const phase: Phase =
      stage.crop_id === "bera" ? "bera" : k === 1 ? "tanam" : k === n ? "panen" : "tumbuh";
    return { month, calendarMonth: Number(month.slice(5)), stageIndex, stage, k, n, phase };
  }).filter((m): m is TimelineMonth => m !== null);
}

/** Growth from 0 to 1 used for plant height. Seedlings start small so they stay visible. */
export function growth(m: Pick<TimelineMonth, "phase" | "k" | "n">): number {
  if (m.phase === "bera") return 0;
  if (m.phase === "tanam") return 0.32;
  return m.k / m.n;
}

export function climateFor(monthly: MonthlyClimate[], calendarMonth: number): MonthlyClimate | undefined {
  return monthly.find((m) => m.month === calendarMonth);
}

export function seasonSummary(monthly: MonthlyClimate[]) {
  const counts: Record<RainClass, number> = { basah: 0, lembap: 0, kering: 0 };
  for (const m of monthly) if (m.class) counts[m.class] += 1;
  const temps = monthly.map((m) => m.t_mean_c).filter((t): t is number => t !== null);
  return {
    counts,
    totalMedianMm: monthly.reduce((sum, m) => sum + (m.rain_median_mm ?? 0), 0),
    tempMin: temps.length ? Math.min(...temps) : null,
    tempMax: temps.length ? Math.max(...temps) : null,
  };
}

/** Three-step meter (more filled is better) for the side-by-side table. */
export function meters(s: Strategy, horizon: number) {
  const d = s.dimensions;
  const level = { tinggi: 3, sedang: 2, rendah: 1 } as const;
  const pressure = { rendah: 3, sedang: 2, tinggi: 1 } as const;
  const bareShare = d.bare_months / horizon;
  const soilChecks = Number(d.soil_contribution.legume) + Number(d.soil_contribution.cover_crop) + Number(d.soil_contribution.families > 1);
  return {
    climate: level[d.climate_fit.level],
    water: pressure[d.water_pressure.level],
    bare: bareShare <= 0.2 ? 3 : bareShare <= 0.4 ? 2 : 1,
    soil: soilChecks,
    soilChecks,
    risk: d.risks.length === 0 ? 3 : d.risks.length === 1 ? 2 : 1,
  };
}

// pH classes follow the Indonesian soil chemistry criteria (Balai Penelitian Tanah).
export function phClass(ph: number): "sangat_masam" | "masam" | "agak_masam" | "netral" | "agak_alkalis" | "alkalis" {
  if (ph < 4.5) return "sangat_masam";
  if (ph < 5.5) return "masam";
  if (ph < 6.6) return "agak_masam";
  if (ph < 7.6) return "netral";
  if (ph <= 8.5) return "agak_alkalis";
  return "alkalis";
}
