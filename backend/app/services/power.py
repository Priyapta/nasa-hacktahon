"""POWER source acquisition + polygon aggregation. No monthly/rotation rules yet."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr
from shapely import box
from shapely.geometry import shape

from app.core.power_grid import area_weighted_daily, intersecting_cells
from app.schemas import LocationInput
from app.services.power_archive import (
    PARAMETERS, DEFAULT_ROOT, INDONESIA_TILES, ArchiveError, DownloadSpec,
    PowerArchive, ProviderUnavailable, atomic_json, utc_now,
)

METHOD_VERSION = "native-cell-intersection-wgs84-v1"
EXPECTED_UNITS = {"T2M": "C", "T2M_MIN": "C", "T2M_MAX": "C", "PRECTOTCORR": "mm/day",
                  "RH2M": "%", "ALLSKY_SFC_SW_DWN": "MJ/m^2/day"}


def tiles_for_polygon(polygon):
    # Indonesia archive includes a border so source cells overlapping Indonesia
    # are present. Outside that box, generate equivalent <=10-degree requests.
    coverage = box(94, -12, 142, 7)
    if coverage.covers(polygon):
        tiles = INDONESIA_TILES
    else:
        tiles = [(s, min(s + 10, 90), w, min(w + 10, 180))
                 for s in range(-90, 90, 10) for w in range(-180, 180, 10)]
    # Include adjacent tiles whose source centers can cover polygon edges.
    return [tile for tile in tiles
            if box(tile[2] - 1, max(-90, tile[0] - 1), tile[3] + 1, min(90, tile[1] + 1)).intersection(polygon).area > 0]


def clean_values(array, attrs, encoding):
    values = np.array(array, dtype=float, copy=True)
    for sentinel in (-999, attrs.get("missing_value"), attrs.get("_FillValue"), encoding.get("_FillValue")):
        if sentinel is not None:
            values[values == sentinel] = np.nan
    values[~np.isfinite(values)] = np.nan
    if "valid_min" in attrs:
        values[values < float(attrs["valid_min"])] = np.nan
    if "valid_max" in attrs:
        values[values > float(attrs["valid_max"])] = np.nan
    return values


def convert_units(values, parameter, source_unit):
    """Units are validated from file metadata, never guessed from magnitudes."""
    normalized = source_unit.replace(" ", "")
    if parameter == "ALLSKY_SFC_SW_DWN":
        if normalized in ("MJ/m^2/day", "MJ/m2/day"):
            return values, "MJ/m^2/day"
        if normalized in ("kW-hr/m^2/day", "kWh/m^2/day"):
            return values * 3.6, "MJ/m^2/day"
    elif parameter in ("T2M", "T2M_MIN", "T2M_MAX") and normalized in ("C", "degC"):
        return values, "C"
    elif parameter == "PRECTOTCORR" and normalized == "mm/day":
        return values, "mm/day"
    elif parameter == "RH2M" and normalized in ("%", "percent"):
        return values, "%"
    raise ArchiveError(f"Unsupported {parameter} unit {source_unit!r}; verify source conversion")


class PowerService:
    def __init__(self, archive=None):
        self.archive = archive if archive is not None else PowerArchive()

    def for_polygon(self, location, *, start_year=None, end_year=None, allow_network=True, refresh=False):
        location = location if isinstance(location, LocationInput) else LocationInput.model_validate(location)
        polygon = shape(location.model_dump())
        # WIB determines the last complete calendar year, consistent with input validation.
        from zoneinfo import ZoneInfo
        latest = datetime.now(ZoneInfo("Asia/Jakarta")).year - 1
        end_year = latest if end_year is None else end_year
        start_year = end_year - 9 if start_year is None else start_year
        if start_year > end_year or end_year > latest:
            raise ValueError("Only complete historical calendar years are supported")
        tiles = tiles_for_polygon(polygon)
        sources, variables = {}, {}
        for parameter in PARAMETERS:
            daily, coverage_daily, cell_records = {}, {}, None
            for year in range(start_year, end_year + 1):
                specs = [DownloadSpec(parameter, year, *tile) for tile in tiles]
                datasets, year_sources = [], []
                try:
                    for spec in specs:
                        if allow_network:
                            metadata = self.archive.ensure(spec, refresh=refresh)
                        else:
                            metadata = self.archive.cached(spec)
                            if metadata is None:
                                raise ProviderUnavailable(f"Missing valid local POWER cache: {spec.filename}")
                            metadata = {**metadata, "cache_hit": True, "cached_fallback": False}
                        sources[spec.filename] = metadata
                        year_sources.append(spec.filename)
                        datasets.append(xr.open_dataset(self.archive.path(spec), engine="h5netcdf"))
                    centers = {(float(lat), float(lon)) for ds in datasets
                               for lat in ds.lat.values for lon in ds.lon.values}
                    step = sources[year_sources[0]]["grid_spacing_degrees"]
                    cells = intersecting_cells(polygon, centers, step["lat"], step["lon"])
                    keys = [(cell.latitude, cell.longitude) for cell in cells]
                    dates = pd.date_range(f"{year}-01-01", f"{year}-12-31", freq="D")
                    columns = {}
                    for ds in datasets:
                        variable = ds[parameter]
                        lats, lons = set(ds.lat.values), set(ds.lon.values)
                        for lat, lon in keys:
                            if lat not in lats or lon not in lons:
                                continue
                            raw = variable.sel(lat=lat, lon=lon).values
                            values = clean_values(raw, variable.attrs, variable.encoding)
                            values, unit = convert_units(values, parameter, str(variable.attrs["units"]))
                            if (lat, lon) in columns:
                                # Shared boundary cells may occur in two tile files. Do not
                                # count twice or silently accept contradictory source data.
                                if not np.allclose(columns[lat, lon], values, equal_nan=True):
                                    raise ArchiveError("Conflicting values for duplicated source cell")
                            else:
                                columns[lat, lon] = values
                    values, fractions = area_weighted_daily(
                        np.column_stack([columns[key] for key in keys]), [cell.weight for cell in cells])
                    for date, value, fraction in zip(dates, values, fractions):
                        date = date.strftime("%Y-%m-%d")
                        daily[date] = None if not np.isfinite(value) else float(value)
                        coverage_daily[date] = float(fraction)
                    records = [{"lat": c.latitude, "lon": c.longitude, "intersection_area_m2": c.area_m2,
                                "weight": c.weight} for c in cells]
                    if cell_records is not None and records != cell_records:
                        raise ArchiveError("Source grid changed between years")
                    cell_records = records
                finally:
                    for ds in datasets:
                        ds.close()
            variables[parameter] = {"unit": unit, "daily": daily, "spatial_coverage": coverage_daily,
                                    "missing_days": sum(v is None for v in daily.values()), "cells": cell_records}
        result = {"source": "NASA POWER", "period": f"{start_year}-01-01/{end_year}-12-31",
                  "location": location.model_dump(), "time_standard": "LST", "method": METHOD_VERSION,
                  "variables": variables, "source_files": sources, "computed_at": utc_now(),
                  "rain_validation": {"status": "unvalidated", "reference": None},
                  "assumptions": ["Historical gridded estimates, not a field measurement or weather forecast.",
                                  "Daily area-weighted source-cell summaries; missing cells are not renormalized.",
                                  "Rainfall has not been validated against a reference dataset."]}
        key = hashlib.sha256(json.dumps({"location": location.model_dump(), "years": [start_year, end_year],
                                        "method": METHOD_VERSION}, sort_keys=True).encode()).hexdigest()
        atomic_json(self.archive.root / "results" / f"{key}.json", result)
        return result
