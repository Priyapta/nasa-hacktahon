from types import SimpleNamespace

import httpx
import pytest

from app.services import soil_archive
from app.services.soil_archive import (
    SOURCE_BASE,
    SoilArchive,
    SoilDataError,
    SoilSpec,
    catalog_extent,
    crop_catalog,
    download_catalog,
)

X0, Y0, SIZE = -19949750.0, 8361000.0, 250.0


def tile(x, y, name, w=600, h=600):
    return (
        "    <ComplexSource>\n"
        f'      <SourceFilename relativeToVRT="1">./phh2o_0-5cm_mean/{name}.tif</SourceFilename>\n'
        "      <SourceBand>1</SourceBand>\n"
        f'      <DstRect xOff="{x}" yOff="{y}" xSize="{w}" ySize="{h}" />\n'
        "    </ComplexSource>\n"
    )


def catalog(*tiles):
    return (
        '<VRTDataset rasterXSize="159246" rasterYSize="58034">\n'
        f"  <GeoTransform> {X0:.16e},  {SIZE:.16e},  0.0000000000000000e+00,  {Y0:.16e},  0.0000000000000000e+00, -{SIZE:.16e}</GeoTransform>\n"
        '  <VRTRasterBand dataType="Int16" band="1">\n'
        + "".join(tiles)
        + "  </VRTRasterBand>\n</VRTDataset>\n"
    )


def indonesia_pixel():
    left, bottom, right, top = catalog_extent()
    return (left + right) / 2 - X0, Y0 - (bottom + top) / 2


def test_crop_keeps_indonesia_tiles_and_global_grid():
    x, y = (v / SIZE for v in indonesia_pixel())
    text = catalog(
        tile(int(x), int(y), "inside"),
        tile(f"{x + 10:.1f}", f"{y + 10:.1f}", "inside-decimal", 4, 2),
        tile(10, 10, "far-away"),
    )
    cropped, kept, total = crop_catalog(text)
    assert (kept, total) == (2, 3)
    assert "inside.tif" in cropped and "inside-decimal.tif" in cropped
    assert "far-away" not in cropped
    assert 'rasterXSize="159246"' in cropped
    assert "<GeoTransform>" in cropped


def test_crop_refuses_a_catalog_without_indonesia_tiles():
    with pytest.raises(SoilDataError):
        crop_catalog(catalog(tile(10, 10, "far-away")))


def test_download_rewrites_tile_paths_to_absolute_urls(tmp_path, monkeypatch):
    x, y = (int(v / SIZE) for v in indonesia_pixel())
    body = catalog(tile(x, y, "inside"))

    def fake_get(url, **kwargs):
        assert url == f"{SOURCE_BASE}/phh2o/phh2o_0-5cm_mean.vrt"
        return SimpleNamespace(text=body, raise_for_status=lambda: None)

    monkeypatch.setattr(soil_archive.httpx, "get", fake_get)
    spec = SoilSpec("phh2o", "0-5cm", "mean", (0, 0, 250, 250))
    destination = tmp_path / "catalogs" / "phh2o_0-5cm_mean.vrt"
    download_catalog(spec, destination)
    saved = destination.read_text()
    assert f'relativeToVRT="0">/vsicurl/{SOURCE_BASE}/phh2o/phh2o_0-5cm_mean/inside.tif' in saved
    assert 'relativeToVRT="1"' not in saved


def snapped(x, y):
    left = int(x // 250) * 250
    bottom = int(y // 250) * 250
    return (left, bottom, left + 500, bottom + 500)


def test_fields_inside_indonesia_use_the_local_catalog(tmp_path):
    left, bottom, right, top = catalog_extent()
    spec = SoilSpec("phh2o", "0-5cm", "mean", snapped((left + right) / 2, (bottom + top) / 2))
    archive = SoilArchive(tmp_path, catalog_fetcher=lambda spec, path: path.write_text("<VRTDataset/>"))
    assert archive.source(spec) == str(archive.catalog_path(spec))


def test_fields_outside_indonesia_keep_the_global_catalog(tmp_path):
    left, bottom, _, _ = catalog_extent()
    calls = []
    archive = SoilArchive(tmp_path, catalog_fetcher=lambda spec, path: calls.append(spec))
    spec = SoilSpec("phh2o", "0-5cm", "mean", snapped(left - 1_000_000, bottom))
    assert archive.source(spec).startswith("/vsicurl/https://")
    assert calls == []


def test_failed_catalog_download_falls_back_to_the_remote_catalog(tmp_path):
    left, bottom, right, top = catalog_extent()

    def broken(spec, path):
        raise httpx.ConnectError("offline")

    archive = SoilArchive(tmp_path, catalog_fetcher=broken)
    spec = SoilSpec("phh2o", "0-5cm", "mean", snapped((left + right) / 2, (bottom + top) / 2))
    assert archive.source(spec).startswith("/vsicurl/https://")
    assert not archive.catalog_path(spec).exists()


def test_injected_openers_never_fetch_catalogs(tmp_path):
    archive = SoilArchive(tmp_path, opener=lambda path: None)
    assert archive.fetch_catalog is None
