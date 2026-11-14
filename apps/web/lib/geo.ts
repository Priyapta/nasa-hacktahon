import { area, centroid, polygon, booleanValid, kinks } from "@turf/turf";
import type { FeatureCollection, Polygon } from "geojson";
import type { FarmField } from "@/types";

export function measure(geometry: Polygon) {
  if (
    geometry.type !== "Polygon" ||
    !geometry.coordinates.length ||
    geometry.coordinates.some((ring) =>
      ring.some(
        (position) =>
          position.length < 2 ||
          !Number.isFinite(position[0]) ||
          !Number.isFinite(position[1]) ||
          Math.abs(position[0]) > 180 ||
          Math.abs(position[1]) > 90,
      ),
    )
  ) {
    throw new Error(
      "Field boundaries must contain valid longitude and latitude coordinates.",
    );
  }
  const feature = polygon(geometry.coordinates);
  const squareMeters = area(feature);
  if (
    !booleanValid(feature) ||
    !Number.isFinite(squareMeters) ||
    squareMeters <= 0 ||
    kinks(feature).features.length
  ) {
    throw new Error("Draw a valid, non-intersecting field boundary.");
  }
  return {
    areaHectares: squareMeters / 10000,
    centroid: centroid(feature).geometry.coordinates as [number, number],
  };
}

export function fieldsGeoJSON(
  fields: FarmField[],
): FeatureCollection<Polygon, Omit<FarmField, "geometry">> {
  return {
    type: "FeatureCollection",
    features: fields.map(({ geometry, ...properties }) => ({
      type: "Feature",
      id: properties.id,
      properties,
      geometry,
    })),
  };
}
