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
