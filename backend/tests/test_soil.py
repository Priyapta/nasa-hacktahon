"""Known-answer soil aggregation and native-raster cache tests; no network."""

import json
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from shapely import box, transform
from shapely.geometry import mapping
from pyproj import Transformer

from app.core.soil import (
    SOIL_CRS,
    DEPTHS,
    PROPERTIES,
    STATISTICS,
    pixel_weights,
    summarize_layers,
    usda_texture,
)
from app.services.soil_archive import SoilArchive, SoilDataError, SoilSpec, inspect
from app.services.soil import SoilService
from app.services.power_archive import atomic_json
from app.schemas import SoilAvailable, SoilUnavailable


@pytest.mark.parametrize(
    "fractions,expected",
    [
        ((95, 3, 2), "sand"),
        ((85, 10, 5), "loamy sand"),
        ((60, 30, 10), "sandy loam"),
        ((40, 40, 20), "loam"),
        ((20, 65, 15), "silt loam"),
        ((5, 90, 5), "silt"),
        ((60, 15, 25), "sandy clay loam"),
        ((35, 30, 35), "clay loam"),
        ((10, 55, 35), "silty clay loam"),
        ((55, 5, 40), "sandy clay"),
        ((10, 45, 45), "silty clay"),
        ((25, 20, 55), "clay"),
    ],
)
def test_usda_classes(fractions, expected):
    assert usda_texture(*fractions) == expected


def test_triangle_boundary_compositions_have_a_class():
    for sand in range(101):
        for silt in range(101 - sand):
            assert usda_texture(sand, silt, 100 - sand - silt)
    with pytest.raises(ValueError):
        usda_texture(-1, 50, 51)


def test_exact_pixel_intersections_and_holes():
    affine = from_origin(0, 500, 250, 250)
    weights = pixel_weights(box(0, 250, 375, 500), affine, 2, 2)
    assert weights == pytest.approx(np.array([[2 / 3, 1 / 3], [0, 0]]))
    polygon = box(0, 0, 500, 500).difference(box(0, 250, 250, 500))
    weights = pixel_weights(polygon, affine, 2, 2)
    assert weights[0, 0] == 0 and weights.sum() == pytest.approx(1)
    with pytest.raises(ValueError):
        pixel_weights(box(-1, 0, 500, 500), affine, 2, 2)


def test_depth_thickness_and_units_are_not_simple_layer_average():
    layers = {
        ("phh2o", depth, stat): np.array([[value]])
        for (depth, _), value in zip(DEPTHS, [50, 60, 70])
        for stat in STATISTICS
    }
    summary, coverage = summarize_layers(layers, np.array([[1.0]]), "phh2o")
    assert summary["mean"] == pytest.approx((5 * 5 + 6 * 10 + 7 * 15) / 30)
    assert all(value == pytest.approx(1) for value in coverage.values())
    layers.pop(("phh2o", "5-15cm", "mean"))
    assert summarize_layers(layers, np.array([[1.0]]), "phh2o")[0]["mean"] is None


def test_missing_pixel_does_not_renormalize_and_zero_soc_stays_valid():
    layers = {
        ("soc", depth, stat): np.array([[0.0, 200]])
        for depth, _ in DEPTHS
        for stat in STATISTICS
    }
    weights = np.array([[0.8, 0.2]])
    assert summarize_layers(layers, weights, "soc")[0]["mean"] == pytest.approx(4)
    layers["soc", "0-5cm", "mean"][0, 1] = np.nan
    summary, coverage = summarize_layers(layers, weights, "soc")
    assert summary["mean"] is None
    assert coverage["0-5cm:mean"] == pytest.approx(0.8)


def write_raster(path, spec, value=60, nodata=-32768):
    left, bottom, right, top = spec.bounds
    data = np.full(((top - bottom) // 250, (right - left) // 250), value, dtype="int16")
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=data.shape[1],
        height=data.shape[0],
        count=1,
        dtype="int16",
        crs=SOIL_CRS,
        transform=from_origin(left, top, 250, 250),
        nodata=nodata,
    ) as ds:
        ds.write(data, 1)
        ds.update_tags(coverage_id=spec.coverage_id, source_version="TEST ONLY")
    return path


def cache_raster(archive, spec, value):
    path = write_raster(archive.path(spec), spec, value)
    metadata = inspect(path, spec)
    metadata["fetched_at"] = "2026-11-14T08:00:00+00:00"
    atomic_json(path.with_suffix(".json"), metadata)


def test_cache_integrity_fallback_and_no_network_when_valid(tmp_path):
    spec = SoilSpec("phh2o", "0-5cm", "mean", (0, 0, 500, 500))

    def unavailable(_):
        raise SoilDataError("simulated provider failure")

    archive = SoilArchive(tmp_path, opener=unavailable, sleeper=lambda _: None)
    with pytest.raises(SoilDataError):
        archive.ensure(spec, retries=0)
    cache_raster(archive, spec, 60)
    assert archive.ensure(spec)["cache_hit"]
    assert archive.ensure(spec, refresh=True, retries=0)["cached_fallback"]
    archive.path(spec).write_bytes(b"corrupt")
    with pytest.raises(SoilDataError):
        archive.ensure(spec, allow_network=False)


def test_native_download_preserves_nodata_and_larger_cache_reused(tmp_path):
    spec = SoilSpec("phh2o", "0-5cm", "mean", (0, 0, 500, 500))
    source = write_raster(tmp_path / "source.tif", spec, value=-32768)
    calls = []

    def opener(url):
        calls.append(url)
        return rasterio.open(source)

    archive = SoilArchive(tmp_path / "cache", opener=opener)
    archive.ensure(spec)
    with rasterio.open(archive.path(spec)) as ds:
        assert ds.nodata == -32768 and ds.read(1, masked=True).mask.all()
    smaller = SoilSpec("phh2o", "0-5cm", "mean", (0, 0, 250, 250))
    assert archive.ensure(smaller)["cache_hit"]
    assert len(calls) == 1


def synthetic_location():
    inverse = Transformer.from_crs(SOIL_CRS, "EPSG:4326", always_xy=True)
    # Small field near Grobogan; native grid extent is known for test rasters.
    return json.loads(
        json.dumps(
            mapping(
                transform(
                    box(12371020, -789230, 12371080, -789170),
                    inverse.transform,
                    interleaved=False,
                )
            )
        )
    )


def prepare_all_layers(archive, missing_quantile=False, missing_mean=False):
    bounds = (12370500, -789750, 12371500, -788750)
    for property_name in PROPERTIES:
        mean = {"phh2o": 60, "soc": 150, "clay": 200, "sand": 400, "silt": 400}[
            property_name
        ]
        for depth, _ in DEPTHS:
            for statistic in STATISTICS:
                if missing_quantile and property_name == "soc" and statistic == "Q0.95":
                    continue
                value = mean + ({"mean": 0, "Q0.05": -10, "Q0.95": 10}[statistic])
                if missing_mean and property_name == "phh2o" and statistic == "mean":
                    value = -32768
                cache_raster(
                    archive, SoilSpec(property_name, depth, statistic, bounds), value
                )


def test_service_returns_contract_soil_and_source_provenance(tmp_path):
    archive = SoilArchive(tmp_path)
    prepare_all_layers(archive)
    result = SoilService(archive).for_polygon(synthetic_location(), allow_network=False)
    parsed = SoilAvailable.model_validate(result["soil"])
    assert parsed.ph == pytest.approx(6)
    assert parsed.soc_g_per_kg == pytest.approx(15)
    assert parsed.texture_class == "loam"
    assert len(parsed.uncertainty) == 5 and result["skipped_rules"] == []
    assert len(result["details"]["source_files"]) == 45
    assert len(list((tmp_path / "results").glob("*.json"))) == 1


def test_quantile_failure_does_not_hide_valid_mean(tmp_path):
    archive = SoilArchive(tmp_path)
    prepare_all_layers(archive, missing_quantile=True)
    result = SoilService(archive).for_polygon(synthetic_location(), allow_network=False)
    assert result["soil"]["status"] == "ok"
    assert "soc" not in result["soil"]["uncertainty"]
    assert result["notes"]


@pytest.mark.parametrize("mode", ["empty_cache", "nodata"])
def test_missing_soil_is_partial_and_k3_skipped(tmp_path, mode):
    archive = SoilArchive(tmp_path)
    if mode == "nodata":
        prepare_all_layers(archive, missing_mean=True)
    result = SoilService(archive).for_polygon(
        synthetic_location(), allow_network=False, lang="en"
    )
    SoilUnavailable.model_validate(result["soil"])
    assert result["skipped_rules"] == ["K3"]
    assert result["soil"]["ph"] is None
    assert result["soil"]["uncertainty"] == {}
    assert not list((tmp_path / "results").glob("*.json"))


def test_original_vrt_projection_without_explicit_zero_parameters_is_accepted():
    from app.services.soil_archive import matches_soil_crs

    assert matches_soil_crs(
        'PROJCS["Interrupted_Goode_Homolosine",GEOGCS["GCS_WGS_1984 ellipse",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]],PROJECTION["Interrupted_Goode_Homolosine"],UNIT["Meter",1]]'
    )
    assert not matches_soil_crs("EPSG:4326")


def test_provider_without_nodata_is_rejected_not_interpreted_as_zero(tmp_path):
    spec = SoilSpec("phh2o", "0-5cm", "mean", (0, 0, 500, 500))
    source = write_raster(tmp_path / "ambiguous.tif", spec, value=0, nodata=None)
    archive = SoilArchive(
        tmp_path / "archive",
        opener=lambda _: rasterio.open(source),
        sleeper=lambda _: None,
    )
    with pytest.raises(SoilDataError, match="NoData"):
        archive.ensure(spec, retries=0)
    assert not archive.path(spec).exists()


def test_quantile_order_is_not_fabricated():
    layers = {
        ("soc", depth, statistic): np.array([[100.0]])
        for depth, _ in DEPTHS
        for statistic in STATISTICS
    }
    for depth, _ in DEPTHS:
        layers["soc", depth, "Q0.05"][:] = 200
    result, _ = summarize_layers(layers, np.array([[1.0]]), "soc")
    assert result["mean"] == pytest.approx(10)
    assert result["Q0.05"] is result["Q0.95"] is None


def test_corrupt_covering_cache_metadata_is_ignored(tmp_path):
    archive = SoilArchive(tmp_path)
    spec = SoilSpec("phh2o", "0-5cm", "mean", (0, 0, 250, 250))
    (tmp_path / "raw").mkdir()
    (tmp_path / "raw" / "phh2o_0-5cm_mean_bad.json").write_text('{"bounds": null}')
    assert archive.find_cached(spec) is None
    with pytest.raises(SoilDataError):
        archive.ensure(spec, allow_network=False)
