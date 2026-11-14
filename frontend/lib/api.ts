import type { LocationResult } from "@field-atlas/shared";
import type { ApiErrorBody, Crop, CropsResponse, Lang } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: "application/json" } });
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
  const body = await getJson<CropsResponse>(`/api/v1/crops?lang=${lang}`, signal);
  return body.crops;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<LocationResult[]> {
  const body = await getJson<{ results: LocationResult[] }>(
    `/api/v1/geocode?q=${encodeURIComponent(query)}`,
    signal,
  );
  return body.results;
}
