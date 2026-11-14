import { periodYears, type AnalysisResponse, type Strategy } from "./analysis";
import { dictionary, formatMonth } from "./i18n";
import type { Lang } from "./types";

export function recommendationExplanation(strategy: Strategy, lang: Lang): string[] {
  if (strategy.explanation) return strategy.explanation.assessment;
  const t = dictionary(lang).results;
  const introduction = strategy.role === "pola_biasa" ? [t.usualPatternNote] : [];
  const reasons = [...new Set(strategy.reasons.filter((reason) => reason.trim()))];
  if (!reasons.length) {
    const stage = strategy.calendar.find((item) => item.crop_id !== "bera");
    reasons.push(stage ? t.missingStageEvidence(t.crops[stage.crop_id], formatMonth(stage.start, lang), formatMonth(stage.end, lang)) : t.missingExplanation);
  }
  return [...introduction, ...reasons.slice(0, 3 - introduction.length)];
}

export function recommendationSources(result: AnalysisResponse, lang: Lang): string[] {
  const t = dictionary(lang).results;
  const { climate, soil } = result.provenance;
  const validation = climate.rain_validation;
  const sources = [t.climateBasis(climate.source, ...periodYears(result.context.climate.period))];
  if (result.context.soil.status === "ok") sources.push(soil ? t.soilBasis(soil.source) : t.unknownSoilBasis);
  else sources.push(t.missingSoilBasis);
  sources.push(validation.status === "unvalidated" ? t.rainUnvalidated
    : validation.status === "validated" && validation.reference ? t.rainValidated(validation.reference)
    : t.rainValidationUnknown);
  if (climate.missing_days > 0) sources.push(`${t.missingDays(climate.missing_days)}.`);
  return sources;
}
