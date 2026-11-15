import type { CropId, Lang } from "./types";

export interface RevenueEstimate {
  reference_year: 2023;
  currency: "IDR";
  area_ha: number;
  gross_idr: number;
  gross_per_ha_idr: number;
  completed_harvests: number;
  is_highest: boolean;
  stages: { stage_index: number; crop_id: CropId; harvest_month: string; reason: "harvest" | "after_horizon" | "no_sales"; quantity_kg: number; gross_idr: number }[];
}

export interface RevenueProvenance {
  version: string;
  reference_year: 2023;
  scope: "Indonesia";
  sources: { id: string; title: string; url: string; locator: string; sha256: string | null }[];
  references: { crop_id: CropId; product: string; non_market: boolean; price_idr_per_kg: number | null; source_yield_kg_per_ha: number; model_yield_kg_per_ha: number; source_moisture_pct: number | null; model_moisture_pct: number | null }[];
  assumptions: string[];
}

export function formatRevenue(amount: number, lang: Lang, decimals = 0): string {
  return new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-GB", { style: "currency", currency: "IDR", maximumFractionDigits: decimals }).format(amount);
}

const SCALES = [
  { size: 1e12, id: "triliun", en: "trillion" },
  { size: 1e9, id: "miliar", en: "billion" },
  { size: 1e6, id: "juta", en: "million" },
] as const;

// "Rp229,6 juta" reads faster than "Rp 229.606.706". The full figure stays next to it.
export function formatRevenueShort(amount: number, lang: Lang): string {
  const scale = SCALES.find((s) => Math.abs(amount) >= s.size);
  if (!scale) return formatRevenue(amount, lang);
  const value = new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-GB", { maximumFractionDigits: 1 }).format(amount / scale.size);
  return lang === "id" ? `Rp${value} ${scale.id}` : `IDR ${value} ${scale.en}`;
}

type Ranked = { id: string; feasible: boolean; revenue?: Pick<RevenueEstimate, "gross_idr"> };

// Position among feasible patterns by the backend revenue, highest first.
export function revenueRank(strategies: Ranked[], id: string): { rank: number; total: number } | null {
  const pool = strategies.filter((s) => s.feasible && s.revenue).sort((a, b) => b.revenue!.gross_idr - a.revenue!.gross_idr);
  const index = pool.findIndex((s) => s.id === id);
  return index < 0 ? null : { rank: index + 1, total: pool.length };
}
