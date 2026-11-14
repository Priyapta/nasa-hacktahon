import { addMonths } from "./query";
import type { Crop, Stage } from "./types";

/** First pass through the user's pattern, using the same fixed slots as the BE. */
export function previewPattern(stages: Stage[], crops: Crop[], start: string, horizon: number) {
  const slots = new Map(crops.map((crop) => [crop.crop_id, crop.slot_bulan]));
  let offset = 0;
  const rows = [];
  for (const stage of stages) {
    const months = stage.crop_id === "bera" ? stage.months : slots.get(stage.crop_id);
    if (!months || !Number.isInteger(months) || months < 1) return null;
    rows.push({
      start: addMonths(start, offset),
      end: addMonths(start, offset + months - 1),
      outside: offset >= horizon,
      continues: offset < horizon && offset + months > horizon,
    });
    offset += months;
  }
  return { rows, total: offset, outside: rows.filter((row) => row.outside).length };
}
