import type { Polygon, Position } from "geojson";

export type Lang = "id" | "en";
export type WaterSource = "tadah_hujan" | "irigasi";
export type Horizon = 6 | 12 | 18 | 24;
export type CropId =
  | "padi_sawah"
  | "jagung"
  | "kedelai"
  | "kacang_hijau"
  | "orok_orok"
  | "bera";

export const HORIZONS: readonly Horizon[] = [6, 12, 18, 24];
export const CROP_IDS: readonly CropId[] = [
  "padi_sawah",
  "jagung",
  "kedelai",
  "kacang_hijau",
  "orok_orok",
  "bera",
];
export const MAX_STAGES = 6;
export const FALLOW_MIN_MONTHS = 1;
export const FALLOW_MAX_MONTHS = 6;

export interface Stage {
  crop_id: CropId;
  months?: number;
}

export interface Rotation {
  has_pattern: boolean;
  stages: Stage[];
}

export interface AnalysisInput {
  location: Polygon;
  rotation: Rotation;
  time: { start_month: string; horizon_months: Horizon };
  water_source: WaterSource;
}

export interface AnalyzeRequest extends AnalysisInput {
  lang: Lang;
}

export interface Crop {
  crop_id: CropId;
  nama: string;
  peran: string[];
  slot_bulan: number | null;
}

export interface CropsResponse {
  crops: Crop[];
}

export interface ApiErrorBody {
  detail: { loc: (string | number)[]; msg: string }[] | string;
}

/** Outer ring without the repeated closing position, as kept in the URL. */
export type OpenRing = Position[];
