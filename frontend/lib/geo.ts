import { area, bbox, booleanValid, centroid, kinks, polygon } from "@turf/turf";
import type { Polygon } from "geojson";

export class InvalidBoundaryError extends Error {}

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
    throw new InvalidBoundaryError(
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
    throw new InvalidBoundaryError("Draw a valid, non-intersecting field boundary.");
  }
  return {
    areaHectares: squareMeters / 10000,
    centroid: centroid(feature).geometry.coordinates as [number, number],
  };
}

export function bounds(geometry: Polygon): [[number, number], [number, number]] {
  const [west, south, east, north] = bbox(geometry);
  return [
    [west, south],
    [east, north],
  ];
}
