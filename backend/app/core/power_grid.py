"""Pure polygon/grid intersection and missing-aware area aggregation. No I/O."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from pyproj import Geod
from shapely import box, union_all
from shapely.geometry.polygon import orient

GEOD = Geod(ellps="WGS84")


class IncompleteSpatialCoverage(ValueError):
    pass


@dataclass(frozen=True)
class WeightedCell:
    latitude: float
    longitude: float
    area_m2: float
    weight: float


def geodesic_area(geometry):
    if geometry.is_empty:
        return 0.0
    if geometry.geom_type == "Polygon":
        return abs(GEOD.geometry_area_perimeter(orient(geometry, sign=1.0))[0])
    return sum(geodesic_area(part) for part in getattr(geometry, "geoms", ()))


def intersecting_cells(polygon, centers, latitude_step, longitude_step):
    """centers are unique source (lat, lon), not sample points.

    Clip in geographic coordinates, measure each positive-area intersection on
    WGS84, then normalize its measured area. Holes are preserved. Geodesic
    measurements follow polygon vertices, not projected degree-square areas.
    """
    if latitude_step <= 0 or longitude_step <= 0:
        raise ValueError("Grid spacing must be positive")
    selected, covered = [], []
    for lat, lon in sorted(set(centers)):
        cell = box(lon - longitude_step / 2, max(-90, lat - latitude_step / 2),
                   lon + longitude_step / 2, min(90, lat + latitude_step / 2))
        if not cell.intersects(polygon):
            continue
        intersection = cell.intersection(polygon)
        area = geodesic_area(intersection)
        if area > 0:
            selected.append((float(lat), float(lon), area))
            covered.append(intersection)
    uncovered = polygon.difference(union_all(covered))
    if not selected or uncovered.area > max(polygon.area * 1e-10, 1e-14):
        raise IncompleteSpatialCoverage("Archive cells do not cover the entire polygon")
    total = sum(area for _, _, area in selected)
    return [WeightedCell(lat, lon, area, area / total) for lat, lon, area in selected]


def area_weighted_daily(values, weights):
    """Do not renormalize over missing cells: incomplete dates remain missing.

    values is (day, cell). Coverage is retained separately for provenance.
    """
    values = np.asarray(values, dtype=float)
    weights = np.asarray(weights, dtype=float)
    if values.ndim != 2 or values.shape[1] != len(weights):
        raise ValueError("Expected (day, cell) values")
    if not np.isfinite(weights).all() or (weights <= 0).any() or not np.isclose(weights.sum(), 1):
        raise ValueError("Weights must be finite, positive, and sum to one")
    valid = np.isfinite(values)
    coverage = valid @ weights
    averages = np.where(valid, values, 0.0) @ weights
    complete = valid.all(axis=1)
    averages[~complete] = np.nan
    return averages, coverage
