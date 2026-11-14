import type { Polygon } from "geojson";
import { measure } from "./geo";
import {
  CROP_IDS,
  FALLOW_MAX_MONTHS,
  FALLOW_MIN_MONTHS,
  HORIZONS,
  MAX_STAGES,
  type AnalysisInput,
  type CropId,
  type Horizon,
  type Lang,
  type OpenRing,
  type Stage,
  type WaterSource,
} from "./types";

export interface PlanState {
  step: 1 | 2;
  area: OpenRing | null;
  hasPattern: boolean;
  stages: Stage[];
  startMonth: string;
  horizon: Horizon;
  water: WaterSource | null;
  lang: Lang;
}

export const START_MONTH_WINDOW = 11;
const AREA_DECIMALS = 6;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

// The backend validates start_month against the Asia/Jakarta calendar, so the
// default and the allowed window follow the same zone.
export function currentMonth(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export function addMonths(month: string, count: number): string {
  const [year, index] = month.split("-").map(Number);
  const total = year * 12 + (index - 1) + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return ty * 12 + tm - (fy * 12 + fm);
}

export function startMonthOptions(now: Date): string[] {
  const first = currentMonth(now);
  return Array.from({ length: START_MONTH_WINDOW + 1 }, (_, i) =>
    addMonths(first, i),
  );
}

function parseStartMonth(value: string | null, now: Date): string {
  const first = currentMonth(now);
  if (!value || !MONTH.test(value)) return first;
  const offset = monthsBetween(first, value);
  return offset >= 0 && offset <= START_MONTH_WINDOW ? value : first;
}

export function parseArea(value: string | null): OpenRing | null {
  if (!value) return null;
  const ring = value.split(";").map((pair) => pair.split(",").map(Number));
  const valid = ring.every(
    (position) =>
      position.length === 2 &&
      position.every(Number.isFinite) &&
      Math.abs(position[0]) <= 180 &&
      Math.abs(position[1]) <= 90,
  );
  if (!valid) return null;
  const [first, last] = [ring[0], ring[ring.length - 1]];
  if (ring.length > 1 && first[0] === last[0] && first[1] === last[1])
    ring.pop();
  return ring.length >= 3 ? ring : null;
}

export function serializeArea(ring: OpenRing): string {
  return ring
    .map(([lon, lat]) =>
      [lon, lat].map((n) => Number(n.toFixed(AREA_DECIMALS))).join(","),
    )
    .join(";");
}

export function ringFromPolygon(polygon: Polygon): OpenRing {
  return parseArea(serializeArea(polygon.coordinates[0])) ?? [];
}

export function polygonFromRing(ring: OpenRing): Polygon {
  return { type: "Polygon", coordinates: [[...ring, ring[0]]] };
}

function clampFallow(months: number): number {
  if (!Number.isInteger(months)) return FALLOW_MIN_MONTHS;
  return Math.min(FALLOW_MAX_MONTHS, Math.max(FALLOW_MIN_MONTHS, months));
}

export function parsePattern(value: string | null): {
  hasPattern: boolean;
  stages: Stage[];
} {
  if (value === "kosong") return { hasPattern: false, stages: [] };
  if (!value) return { hasPattern: true, stages: [] };
  const stages = value
    .split(",")
    .flatMap((token): Stage[] => {
      const [id, months] = token.split(":");
      if (!CROP_IDS.includes(id as CropId)) return [];
      return id === "bera"
        ? [{ crop_id: "bera", months: clampFallow(Number(months)) }]
        : [{ crop_id: id as CropId }];
    })
    .slice(0, MAX_STAGES);
  return { hasPattern: true, stages };
}

export function serializePattern(hasPattern: boolean, stages: Stage[]) {
  if (!hasPattern) return "kosong";
  return stages
    .map((stage) =>
      stage.crop_id === "bera"
        ? `bera:${clampFallow(stage.months ?? FALLOW_MIN_MONTHS)}`
        : stage.crop_id,
    )
    .join(",");
}

export function parsePlan(params: URLSearchParams, now: Date): PlanState {
  const area = parseArea(params.get("area"));
  const horizon = Number(params.get("horizon"));
  const water = params.get("air");
  return {
    step: params.get("langkah") === "2" && area ? 2 : 1,
    area,
    ...parsePattern(params.get("pola")),
    startMonth: parseStartMonth(params.get("mulai"), now),
    horizon: HORIZONS.includes(horizon as Horizon) ? (horizon as Horizon) : 12,
    water: water === "tadah_hujan" || water === "irigasi" ? water : null,
    lang: params.get("lang") === "en" ? "en" : "id",
  };
}

export function serializePlan(
  plan: PlanState,
  { includeStep = true } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  if (includeStep && plan.step === 2) params.set("langkah", "2");
  if (plan.area) params.set("area", serializeArea(plan.area));
  const pattern = serializePattern(plan.hasPattern, plan.stages);
  if (pattern) params.set("pola", pattern);
  params.set("mulai", plan.startMonth);
  params.set("horizon", String(plan.horizon));
  if (plan.water) params.set("air", plan.water);
  params.set("lang", plan.lang);
  return params;
}

export function toAnalysisInput(plan: PlanState): AnalysisInput | null {
  if (!plan.area || !plan.water) return null;
  if (plan.hasPattern && plan.stages.length === 0) return null;
  try { measure(polygonFromRing(plan.area)); } catch { return null; }
  return {
    location: polygonFromRing(plan.area),
    rotation: {
      has_pattern: plan.hasPattern,
      stages: plan.hasPattern ? plan.stages : [],
    },
    time: { start_month: plan.startMonth, horizon_months: plan.horizon },
    water_source: plan.water,
  };
}

export function resultsHref(plan: PlanState): string {
  return `/hasil?${serializePlan(plan, { includeStep: false })}`;
}
