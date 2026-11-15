import { addMonths, currentMonth, START_MONTH_WINDOW } from "./query";
import type { Crop, CropId, Stage } from "./types";

export type StartStatus =
  | { kind: "this"; effective: string }
  | { kind: "next"; effective: string }
  | { kind: "later"; effective: string }
  | { kind: "late"; effective: string };

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return ty * 12 + tm - (fy * 12 + fm);
}

// Mirrors parseStartMonth: a saved month outside the allowed window runs from the current month.
export function startStatus(startMonth: string, now: Date): StartStatus {
  const current = currentMonth(now);
  const offset = monthsBetween(current, startMonth);
  if (offset < 0 || offset > START_MONTH_WINDOW) return { kind: "late", effective: current };
  if (offset === 0) return { kind: "this", effective: startMonth };
  if (offset === 1) return { kind: "next", effective: startMonth };
  return { kind: "later", effective: startMonth };
}

export interface StripSegment {
  crop: CropId;
  months: number;
}

// Repeats the pattern from the first stage until the horizon is filled, like the plan form preview.
export function patternStrip(stages: Stage[], crops: Crop[], horizon: number): StripSegment[] | null {
  if (!stages.length) return null;
  const slots = new Map(crops.map((crop) => [crop.crop_id, crop.slot_bulan]));
  const lengths = stages.map((stage) => (stage.crop_id === "bera" ? stage.months : slots.get(stage.crop_id)));
  if (lengths.some((months) => !months || !Number.isInteger(months) || months < 1)) return null;
  const segments: StripSegment[] = [];
  let filled = 0;
  for (let i = 0; filled < horizon; i = (i + 1) % stages.length) {
    const months = Math.min(lengths[i] as number, horizon - filled);
    segments.push({ crop: stages[i].crop_id, months });
    filled += months;
  }
  return segments;
}

export function lastMonth(startMonth: string, horizon: number): string {
  return addMonths(startMonth, horizon - 1);
}
