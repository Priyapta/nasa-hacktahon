import { normalizeLocations, type LocationResult } from "@field-atlas/shared";

let nextRequestAt = 0;
const cache = new Map<string, { results: LocationResult[]; expires: number }>();

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2 || query.length > 120) {
    return Response.json(
      { error: "Enter a location between 2 and 120 characters." },
      { status: 400 },
    );
  }
  // shortcut: this throttle is per server process; use shared rate limiting before deploying multiple instances.
  if (Date.now() < nextRequestAt) {
    return Response.json(
      { error: "Please wait a moment before searching again." },
      { status: 429, headers: { "Retry-After": "1" } },
    );
  }
  nextRequestAt = Date.now() + 1000;
  const cached = cache.get(query);
  if (cached && cached.expires > Date.now())
    return Response.json({ results: cached.results });
  cache.delete(query);
  try {
    const url = new URL(
      process.env.PHOTON_API_URL || "https://photon.komoot.io/api/",
    );
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "5");
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FieldAtlas/1.0 (agricultural field mapping)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Location provider unavailable.");
    const results = normalizeLocations(await response.json());
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(query, { results, expires: Date.now() + 86400000 });
    return Response.json({ results });
  } catch {
    return Response.json(
      {
        error:
          "Location search is unavailable. Try again later or enter latitude, longitude.",
      },
      { status: 502 },
    );
  }
}
