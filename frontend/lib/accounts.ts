import { requestJson } from "./api";
import { parsePlan, ringFromPolygon, resultsHref, serializePlan, type PlanState } from "./query";
import type { AnalysisInput, Lang } from "./types";

export type User = { id: string; username: string };
export type SavedField = { id: string; name: string; plan: AnalysisInput & { lang: Lang }; created_at: string };

export function accountRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return requestJson<T>(`/api/v1/${path}`, {
    method, cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Field-Request": "1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function savedFieldHref(field: SavedField, now = new Date()): string {
  const plan: PlanState = {
    fieldId: field.id,
    step: 2, area: ringFromPolygon(field.plan.location),
    hasPattern: field.plan.rotation.has_pattern, stages: field.plan.rotation.stages,
    startMonth: field.plan.time.start_month, horizon: field.plan.time.horizon_months,
    water: field.plan.water_source, lang: field.plan.lang,
  };
  // A saved planting month can expire; reuse the existing current-month fallback.
  return resultsHref(parsePlan(serializePlan(plan), now));
}
