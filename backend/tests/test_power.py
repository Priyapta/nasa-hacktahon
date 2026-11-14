"""Known-answer polygon weighting + synthetic archive/provider failure tests."""
import json
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
import pytest
import xarray as xr
from shapely import box
from shapely.geometry import Polygon

from app.core.power_grid import IncompleteSpatialCoverage, area_weighted_daily, intersecting_cells
from app.services.power import PowerService, clean_values, convert_units
from app.services.power_archive import (
    ArchiveError, DownloadSpec, PARAMETERS, PowerArchive, ProviderUnavailable,
    atomic_json, indonesia_specs, inspect_file,
)


def write_file(path, parameter="T2M", year=2025, missing=False, radiation=False, unit=None):
    dates = pd.date_range(f"{year}-01-01", f"{year}-12-31")
    lat = [-7.5, -6.5, -5.5] if radiation else [-7.5, -7, -6.5]
    lon = [110.5, 111.5, 112.5] if radiation else [110, 110.625, 111.25]
    values = np.full((len(dates), 3, 3), 20.0, dtype=np.float32)
    values[:, :, 2] = 40
    if missing:
        values[0, 1, 2] = -999
    ds = xr.Dataset({parameter: (("time", "lat", "lon"), values)}, coords={"time": dates, "lat": lat, "lon": lon}, attrs={"version": "TEST ONLY"})
    ds[parameter].attrs["units"] = unit or ("MJ/m^2/day" if radiation else "C")
    path.parent.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(path, engine="h5netcdf")
    return path


def test_known_equal_area_cells_and_boundary_touch_excluded():
    cells = intersecting_cells(box(0, 0, 2, 1), [(0.5, 0.5), (0.5, 1.5), (0.5, 2.5)], 1, 1)
    assert len(cells) == 2
    assert [c.weight for c in cells] == pytest.approx([0.5, 0.5])
    result, coverage = area_weighted_daily([[10, 30]], [c.weight for c in cells])
    assert result[0] == pytest.approx(20)
    assert coverage[0] == pytest.approx(1)


def test_unequal_intersections_and_hole_exclusion():
    cells = intersecting_cells(box(0, 0, 1.5, 1), [(0.5, 0.5), (0.5, 1.5)], 1, 1)
    assert cells[0].weight == pytest.approx(2 / 3, abs=1e-4)
    polygon = Polygon([(0, 0), (3, 0), (3, 3), (0, 3)], holes=[[(1, 1), (1, 2), (2, 2), (2, 1)]])
    cells = intersecting_cells(polygon, [(y + 0.5, x + 0.5) for y in range(3) for x in range(3)], 1, 1)
    assert len(cells) == 8
    assert (1.5, 1.5) not in [(c.latitude, c.longitude) for c in cells]
    assert sum(c.weight for c in cells) == pytest.approx(1)


def test_incomplete_spatial_archive_is_not_silently_averaged():
    with pytest.raises(IncompleteSpatialCoverage):
        intersecting_cells(box(0, 0, 2, 1), [(0.5, 0.5)], 1, 1)


def test_missing_cells_are_not_reweighted_and_zero_rain_is_valid():
    values, coverage = area_weighted_daily([[0, 0], [10, np.nan], [np.nan, np.nan]], [0.8, 0.2])
    assert values[0] == 0
    assert np.isnan(values[1:]).all()
    assert coverage == pytest.approx([1, 0.8, 0])
    assert np.isnan(clean_values([-999, -888, np.inf], {"missing_value": -888}, {})).all()


def test_units_must_match_metadata():
    values, unit = convert_units(np.array([2.0]), "ALLSKY_SFC_SW_DWN", "kW-hr/m^2/day")
    assert values[0] == pytest.approx(7.2)
    assert unit == "MJ/m^2/day"
    with pytest.raises(ArchiveError):
        convert_units(np.array([1.0]), "PRECTOTCORR", "unknown")


def test_download_manifest_has_complete_scope_without_duplicate_requests():
    specs = indonesia_specs()
    assert len(specs) == len({s.filename for s in specs}) == 600
    assert {s.year for s in specs} == set(range(2016, 2026))
    assert {s.parameter for s in specs} == set(PARAMETERS)
    assert all(s.north - s.south <= 10 and s.east - s.west <= 10 for s in specs)


def test_provider_retry_and_atomic_cache(tmp_path):
    sample = write_file(tmp_path / "sample.nc").read_bytes()
    calls = []
    def transport(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(429, headers={"Retry-After": "3"})
        return httpx.Response(200, content=sample)
    slept = []
    spec = DownloadSpec("T2M", 2025, -12, -2, 104, 114)
    with httpx.Client(transport=httpx.MockTransport(transport)) as client:
        archive = PowerArchive(tmp_path / "archive", client, slept.append)
        metadata = archive.ensure(spec)
        assert len(calls) == 2 and slept == [3]
        assert metadata["fetched_at"] and not metadata["cache_hit"]
        assert not archive.path(spec).with_suffix(".nc.part").exists()
        assert archive.ensure(spec)["cache_hit"]
        assert len(calls) == 2
        assert calls[0].url.params["time-standard"] == "LST"


def test_provider_failure_uses_valid_cache_but_never_invents_data(tmp_path):
    spec = DownloadSpec("T2M", 2025, -12, -2, 104, 114)
    with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(503))) as client:
        archive = PowerArchive(tmp_path, client, lambda _: None)
        with pytest.raises(ProviderUnavailable):
            archive.ensure(spec, retries=0)
        assert not archive.path(spec).exists()
        write_file(archive.path(spec))
        before = archive.path(spec).read_bytes()
        assert archive.ensure(spec, refresh=True, retries=0)["cached_fallback"]
        assert archive.path(spec).read_bytes() == before


def test_bad_download_cannot_replace_good_cache(tmp_path):
    spec = DownloadSpec("T2M", 2025, -12, -2, 104, 114)
    with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"not a NetCDF file"))) as client:
        archive = PowerArchive(tmp_path, client, lambda _: None)
        write_file(archive.path(spec))
        before = archive.path(spec).read_bytes()
        result = archive.ensure(spec, refresh=True, retries=0)
        assert result["cached_fallback"]
        assert archive.path(spec).read_bytes() == before


def test_reject_wrong_year_wrong_variable_and_grid(tmp_path):
    path = write_file(tmp_path / "sample.nc")
    with pytest.raises(ArchiveError):
        inspect_file(path, DownloadSpec("T2M", 2024, -12, -2, 104, 114))
    with pytest.raises(ArchiveError):
        inspect_file(path, DownloadSpec("RH2M", 2025, -12, -2, 104, 114))


def test_service_uses_native_grids_and_marks_missing_day(tmp_path):
    archive = PowerArchive(tmp_path)
    for parameter in PARAMETERS:
        spec = DownloadSpec(parameter, 2025, -12, -2, 104, 114)
        unit = {"PRECTOTCORR": "mm/day", "RH2M": "%"}.get(parameter)
        write_file(archive.path(spec), parameter, missing=parameter == "T2M", radiation=parameter == "ALLSKY_SFC_SW_DWN", unit=unit)
    location = {"type": "Polygon", "coordinates": [[[110.8, -7.1], [111.1, -7.1], [111.1, -6.9], [110.8, -6.9], [110.8, -7.1]]]}
    result = PowerService(archive).for_polygon(location, start_year=2025, end_year=2025, allow_network=False)
    met = result["variables"]["T2M"]
    assert len(met["cells"]) == 2
    assert met["daily"]["2025-01-01"] is None
    assert met["spatial_coverage"]["2025-01-01"] < 1
    assert met["daily"]["2025-01-02"] == pytest.approx(30.833, abs=0.01)
    assert len(result["variables"]["ALLSKY_SFC_SW_DWN"]["cells"]) == 4
    assert result["rain_validation"]["status"] == "unvalidated"
    assert len(list((tmp_path / "results").glob("*.json"))) == 1


def test_service_missing_local_file_fails_instead_of_partial_polygon(tmp_path):
    archive = PowerArchive(tmp_path)
    location = {"type": "Polygon", "coordinates": [[[110.9, -7.1], [110.92, -7.1], [110.92, -7.08], [110.9, -7.1]]]}
    with pytest.raises(ProviderUnavailable):
        PowerService(archive).for_polygon(location, start_year=2025, end_year=2025, allow_network=False)


def test_provider_valid_range_excludes_bad_values_without_clamping():
    values = clean_values([-1, 0, 50, 101], {"valid_min": 0, "valid_max": 100}, {})
    assert np.isnan(values[[0, 3]]).all()
    assert values[1:3] == pytest.approx([0, 50])


def test_duplicate_tile_boundaries_count_once_and_conflicts_rejected(tmp_path, monkeypatch):
    from app.services import power
    tiles = [(-12, -2, 104, 114), (-12, -2, 103, 113)]
    monkeypatch.setattr(power, "tiles_for_polygon", lambda _: tiles)
    archive = PowerArchive(tmp_path)
    for parameter in PARAMETERS:
        for tile in tiles:
            unit = {"PRECTOTCORR": "mm/day", "RH2M": "%"}.get(parameter)
            write_file(archive.path(DownloadSpec(parameter, 2025, *tile)), parameter,
                       radiation=parameter == "ALLSKY_SFC_SW_DWN", unit=unit)
    location = {"type": "Polygon", "coordinates": [[[110.8, -7.1], [111.1, -7.1], [111.1, -6.9], [110.8, -6.9], [110.8, -7.1]]]}
    result = PowerService(archive).for_polygon(location, start_year=2025, end_year=2025, allow_network=False)
    assert len(result["variables"]["T2M"]["cells"]) == 2
    path = archive.path(DownloadSpec("T2M", 2025, *tiles[1]))
    with xr.open_dataset(path, engine="h5netcdf") as ds:
        modified = ds.load()
    modified["T2M"][:] += 1
    modified.to_netcdf(path, engine="h5netcdf", mode="w")
    with pytest.raises(ArchiveError, match="Conflicting"):
        PowerService(archive).for_polygon(location, start_year=2025, end_year=2025, allow_network=False)
