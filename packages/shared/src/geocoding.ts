export interface LocationResult {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
}

export function parseCoordinates(query: string): LocationResult | undefined {
  if (!/^\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*$/.test(query))
    return;
  const [latitude, longitude] = query.split(",").map(Number);
  if (Math.abs(latitude) > 85 || Math.abs(longitude) > 180) {
    throw new Error(
      "Use latitude between −85 and 85 and longitude between −180 and 180.",
    );
  }
  return {
    id: "coordinates",
    name: `${latitude}, ${longitude}`,
    center: [longitude, latitude],
    zoom: 15,
  };
}

export function normalizeLocations(data: unknown): LocationResult[] {
  if (
    !data ||
    typeof data !== "object" ||
    !("features" in data) ||
    !Array.isArray(data.features)
  ) {
    throw new Error("The location service returned an invalid response.");
  }
  return data.features.flatMap((feature: unknown, index: number) => {
    if (!feature || typeof feature !== "object") return [];
    const f = feature as {
      geometry?: { type?: string; coordinates?: unknown[] };
      properties?: Record<string, unknown>;
    };
    const coordinates = f.geometry?.coordinates;
    const p = f.properties;
    if (
      f.geometry?.type !== "Point" ||
      !coordinates ||
      coordinates.length !== 2 ||
      !p
    )
      return [];
    const [longitude, latitude] = coordinates;
    if (
      typeof longitude !== "number" ||
      typeof latitude !== "number" ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 ||
      Math.abs(latitude) > 85
    )
      return [];
    const parts = [p.name, p.street, p.city, p.state, p.country].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );
    if (!parts.length) return [];
    const zoom =
      p.type === "country"
        ? 4
        : p.type === "state"
          ? 7
          : p.type === "city"
            ? 11
            : p.type === "town"
              ? 12
              : p.type === "village"
                ? 14
                : 15;
    return [
      {
        id: `${p.osm_type}-${p.osm_id}-${index}`,
        name: [...new Set(parts)].join(", "),
        center: [longitude, latitude] as [number, number],
        zoom,
      },
    ];
  });
}
