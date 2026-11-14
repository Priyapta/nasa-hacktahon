import type { LocationResult } from "@field-atlas/shared";
import type { AnalyzeRequest, AnalysisResponse, ApiErrorBody, Crop, CropsResponse, Lang } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, headers: { Accept: "application/json", ...options.headers } });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      message =
        typeof body.detail === "string"
          ? body.detail
          : body.detail.map((item) => item.msg).join(" ");
    } catch {}
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

export async function fetchCrops(lang: Lang, signal?: AbortSignal): Promise<Crop[]> {
  const body = await requestJson<CropsResponse>(`/api/v1/crops?lang=${lang}`, { signal });
  return body.crops;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<LocationResult[]> {
  const body = await requestJson<{ results: LocationResult[] }>(
    `/api/v1/geocode?q=${encodeURIComponent(query)}`,
    { signal },
  );
  return body.results;
}

export function analyze(request: AnalyzeRequest, signal?: AbortSignal): Promise<AnalysisResponse> {
  return requestJson<AnalysisResponse>("/api/v1/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
}
