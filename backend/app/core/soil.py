"""Pure SoilGrids native-pixel weights and 0-30cm summaries. No network or I/O."""

import numpy as np
from pyproj import CRS, Transformer
from shapely import box, segmentize, transform

SOIL_CRS = CRS.from_proj4("+proj=igh +datum=WGS84 +units=m +no_defs")
DEPTHS = (("0-5cm", 5), ("5-15cm", 10), ("15-30cm", 15))
PROPERTIES = ("phh2o", "soc", "clay", "sand", "silt")
STATISTICS = ("mean", "Q0.05", "Q0.95")
# ISRIC layer documentation: mapped units / 10 -> pH, g/kg SOC, percent fractions.
CONVERSION_FACTOR = 10.0


def project_polygon(geometry):
    projected = transform(
        segmentize(geometry, max_segment_length=0.001),
        Transformer.from_crs("EPSG:4326", SOIL_CRS, always_xy=True).transform,
        interleaved=False,
    )
    if (
        not projected.is_valid
        or not np.isfinite(projected.bounds).all()
        or projected.area <= 0
    ):
        raise ValueError(
            "Polygon cannot be represented safely on the SoilGrids native projection"
        )
    return projected


def pixel_weights(polygon, affine, height, width):
    if affine.b or affine.d or affine.a != 250 or affine.e != -250:
        raise ValueError("Expected native unrotated 250 m SoilGrids grid")
    extent = box(
        affine.c, affine.f + affine.e * height, affine.c + affine.a * width, affine.f
    )
    if polygon.difference(extent).area > max(polygon.area * 1e-10, 1e-6):
        raise ValueError("Raster subset does not cover the full polygon")
    weights = np.zeros((height, width), dtype=float)
    for row in range(height):
        for col in range(width):
            x, y = affine.c + affine.a * col, affine.f + affine.e * row
            weights[row, col] = polygon.intersection(box(x, y - 250, x + 250, y)).area
    if weights.sum() <= 0:
        raise ValueError("No positive-area soil pixel intersections")
    return weights / weights.sum()


def summarize_layers(layers, weights, property_name):
    """Missing cells/depths stay missing; no renormalization or depth imputation."""
    result = {}
    coverage = {}
    selected = weights > 0
    for statistic in STATISTICS:
        total = 0.0
        valid_all = True
        for depth, thickness in DEPTHS:
            key = (property_name, depth, statistic)
            if key not in layers:
                valid_all = False
                coverage[depth + ":" + statistic] = 0.0
                continue
            values = np.asarray(layers[key], dtype=float) / CONVERSION_FACTOR
            if values.shape != weights.shape:
                raise ValueError("Misaligned soil raster layers")
            valid = np.isfinite(values) & (values >= 0)
            upper = (
                14
                if property_name == "phh2o"
                else (100 if property_name in ("clay", "sand", "silt") else 1000)
            )
            valid &= values <= upper
            fraction = float(weights[valid].sum())
            coverage[depth + ":" + statistic] = fraction
            if not valid[selected].all():
                valid_all = False
            else:
                total += (
                    float((values[selected] * weights[selected]).sum()) * thickness / 30
                )
        result[statistic] = total if valid_all else None
    if (
        result["Q0.05"] is not None
        and result["Q0.95"] is not None
        and result["Q0.05"] > result["Q0.95"]
    ):
        result["Q0.05"] = result["Q0.95"] = None
    return result, coverage


def usda_texture(sand, silt, clay):
    """USDA 12-class triangle, class of the normalized mean composition.

    Fractions from independent models/rounding may not sum exactly to 100.
    Raw values remain in provenance; normalize only the texture coordinates.
    """
    fractions = np.asarray([sand, silt, clay], dtype=float)
    if (
        not np.isfinite(fractions).all()
        or (fractions < 0).any()
        or (fractions > 100).any()
        or fractions.sum() <= 0
    ):
        raise ValueError("Invalid soil texture fractions")
    sand, silt, clay = fractions * (100 / fractions.sum())
    if silt + 1.5 * clay < 15:
        return "sand"
    if silt + 2 * clay < 30:
        return "loamy sand"
    if (7 <= clay < 20 and sand > 52) or (clay < 7 and silt < 50):
        return "sandy loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "loam"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "silt loam"
    if silt >= 80 and clay < 12:
        return "silt"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "sandy clay loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "clay loam"
    if 27 <= clay < 40 and sand <= 20:
        return "silty clay loam"
    if clay >= 35 and sand > 45:
        return "sandy clay"
    if clay >= 40 and silt >= 40:
        return "silty clay"
    if clay >= 40 and sand <= 45 and silt < 40:
        return "clay"
    raise ValueError("Composition falls outside supported USDA texture regions")
