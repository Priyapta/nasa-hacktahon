import type { Lang } from "./types";

export type Tone = "ok" | "warn" | "neutral";
export type Segment = { text: string } | { met: number; total: number; label: string };

const COUNT = /(\d+) (?:dari|of) (\d+) (?:tahun acuan|tahun|reference years|years)/g;
const WARN = /gagal|failed|kurang|tidak cukup|not enough|too little|hanya|only \d|risiko|risk/i;
const NEUTRAL = /tidak dinilai|not assessed|bera\b|fallow/i;

// Splits "Padi sawah, Nov 2026–Feb 2027: hujan ..." into a short lead and the rest.
export function splitLead(point: string): { lead: string | null; body: string } {
  const index = point.indexOf(": ");
  if (index <= 0 || index > 70) return { lead: null, body: point };
  return { lead: point.slice(0, index), body: point.slice(index + 2) };
}

export function countSegments(text: string, lang: Lang): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(COUNT)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start) });
    const met = Number(match[1]);
    const total = Number(match[2]);
    segments.push({ met, total, label: lang === "en" ? `${met} of ${total} years` : `${met} dari ${total} tahun` });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

export function pointTone(point: string): Tone {
  if (NEUTRAL.test(point) && !/\d+ (?:dari|of) \d+/.test(point)) return "neutral";
  if (WARN.test(point)) return "warn";
  return "ok";
}

// LLM points often join two ideas with a semicolon. Show them as separate sentences.
export function sentences(point: string): string[] {
  return point
    .split(/;\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const capital = part.charAt(0).toUpperCase() + part.slice(1);
      return /[.!?]$/.test(capital) ? capital : `${capital}.`;
    });
}

// The product team chose not to show rainfall validation status to farmers.
export function isRainValidationNote(text: string): boolean {
  return /divalidasi|validat|dataset pembanding|reference dataset/i.test(text);
}
