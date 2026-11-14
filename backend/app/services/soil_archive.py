"""Read native SoilGrids WebDAV/VRT windows, preserving NoData and native pixels."""

from __future__ import annotations
import fcntl
import hashlib
import json
import math
import re
import time
from functools import lru_cache
from pyproj import Proj, Transformer
from dataclasses import dataclass
from pathlib import Path

import httpx
import numpy as np
import rasterio
from rasterio.windows import Window
from app.core.soil import SOIL_CRS, PROPERTIES, DEPTHS, STATISTICS
from app.services.power_archive import atomic_json, utc_now

ROOT = Path(__file__).resolve().parents[2] / "data" / "soilgrids"
SOURCE_BASE = "https://files.isric.org/soilgrids/latest/data"
SOURCE_DOC = "https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html"
MAX_PIXELS = 100_000
CATALOG_TIMEOUT_S = 60
_RELATIVE_TILE = re.compile(r'relativeToVRT="1">\./')
_SOURCE_BLOCK = re.compile(r"\s*<ComplexSource>.*?</ComplexSource>", re.S)
_DST_RECT = re.compile(r'<DstRect xOff="([\d.]+)" yOff="([\d.]+)" xSize="([\d.]+)" ySize="([\d.]+)"')
# Same lon/lat box as the NASA POWER Indonesia archive, so climate and soil
# share one fast local area. Fields outside it read the global catalog live.
CATALOG_BBOX = (94.0, -12.0, 142.0, 7.0)


@lru_cache(maxsize=1)
def catalog_extent() -> tuple[float, float, float, float]:
    """CATALOG_BBOX in SoilGrids Homolosine metres, sampled along its edges."""
    west, south, east, north = CATALOG_BBOX
    to_soil = Transformer.from_crs("EPSG:4326", SOIL_CRS, always_xy=True)
    steps = 48
    lons = [west + (east - west) * i / steps for i in range(steps + 1)]
    lats = [south + (north - south) * i / steps for i in range(steps + 1)]
    points = [(x, y) for x in lons for y in (south, north)] + [
        (x, y) for x in (west, east) for y in lats
    ]
    xs, ys = to_soil.transform(*zip(*points))
    return min(xs), min(ys), max(xs), max(ys)


def crop_catalog(text: str) -> tuple[str, int, int]:
    """Drop tile entries outside CATALOG_BBOX. Raster size and geotransform
    stay global, so pixel windows computed against the catalog do not change."""
    origin = re.search(r"<GeoTransform>\s*([-\d.e+]+),\s*([-\d.e+]+),[^,]*,\s*([-\d.e+]+),", text)
    if not origin:
        raise SoilDataError("SoilGrids catalog has no geotransform")
    x0, size, y0 = (float(v) for v in origin.groups())
    left, bottom, right, top = catalog_extent()
    col_min, col_max = (left - x0) / size, (right - x0) / size
    row_min, row_max = (y0 - top) / size, (y0 - bottom) / size
    kept = total = 0

    def keep(match):
        nonlocal kept, total
        total += 1
        rect = _DST_RECT.search(match.group(0))
        if not rect:
            raise SoilDataError("SoilGrids catalog tile without DstRect")
        x, y, w, h = (float(v) for v in rect.groups())
        if x + w > col_min and x < col_max and y + h > row_min and y < row_max:
            kept += 1
            return match.group(0)
        return ""

    cropped = _SOURCE_BLOCK.sub(keep, text)
    if not kept:
        raise SoilDataError("Cropped SoilGrids catalog has no tiles")
    return cropped, kept, total


class SoilDataError(RuntimeError):
    pass


@dataclass(frozen=True)
class SoilSpec:
    property: str
    depth: str
    statistic: str
    bounds: tuple[int, int, int, int]

    def __post_init__(self):
        if (
            self.property not in PROPERTIES
            or self.depth not in dict(DEPTHS)
            or self.statistic not in STATISTICS
        ):
            raise ValueError("Unknown SoilGrids layer")
        left, bottom, right, top = self.bounds
        if left >= right or bottom >= top or any(value % 250 for value in self.bounds):
            raise ValueError("Bounds must align to the 250m native grid")
        if (right - left) * (top - bottom) / 62500 > MAX_PIXELS:
            raise SoilDataError(
                "Soil subset exceeds local processing budget; prepare tiled cache first"
            )

    @property
    def coverage_id(self):
        return f"{self.property}_{self.depth}_{self.statistic}"

    @property
    def filename(self):
        return self.coverage_id + "_" + "_".join(str(x) for x in self.bounds) + ".tif"

    @property
    def url(self):
        return f"{SOURCE_BASE}/{self.property}/{self.coverage_id}.vrt"


def bounds_for_polygon(polygon):
    left, bottom, right, top = polygon.bounds
    # Add one pixel buffer for numerical edge safety, never shrink the input.
    return (
        math.floor(left / 250) * 250 - 250,
        math.floor(bottom / 250) * 250 - 250,
        math.ceil(right / 250) * 250 + 250,
        math.ceil(top / 250) * 250 + 250,
    )


def matches_soil_crs(value):
    # The original VRT omits explicit zero projection parameters, while GeoTIFF
    # serialization adds them. PROJ's semantic equals can return False despite
    # the same IGH/WGS84 operation. Check the full normalized PROJ parameters
    # for this specific, fixed source projection rather than CRS display names.
    return Proj(value).srs == Proj(SOIL_CRS).srs


def inspect(path, spec):
    with rasterio.open(path) as ds:
        if ds.count != 1 or ds.crs is None or not matches_soil_crs(ds.crs):
            raise SoilDataError("Wrong raster CRS or band count")
        if (
            ds.res != (250, 250)
            or ds.transform.b
            or ds.transform.d
            or ds.nodata != -32768
        ):
            raise SoilDataError("SoilGrids native grid or NoData changed")
        if not np.allclose(ds.bounds, spec.bounds, rtol=0, atol=1e-6):
            raise SoilDataError("Raster bounds do not match cache key")
        if ds.tags().get("coverage_id") != spec.coverage_id:
            raise SoilDataError("Wrong SoilGrids property/depth/statistic")
        metadata = {
            "filename": spec.filename,
            "coverage_id": spec.coverage_id,
            "bounds": list(spec.bounds),
            "crs": ds.crs.to_wkt(),
            "resolution_m": 250,
            "nodata": -32768,
            "url": spec.url,
            "source": "SoilGrids 2.0",
            "source_version": ds.tags().get("source_version", "unknown"),
            "conversion_factor": 10,
            "conversion_reference": SOURCE_DOC,
        }
    metadata.update(
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(), bytes=path.stat().st_size
    )
    return metadata


def download_catalog(spec, destination: Path) -> None:
    """Keep a local Indonesia copy of the global VRT catalog with absolute tile URLs.

    Each SoilGrids layer catalog is 3.5 to 6 MB and lists every global tile,
    while a field needs only a few KB from one tile. Reading the catalog over
    HTTP for every field took about 12 s per layer (45 layers per field). The
    catalogs have not changed since June 2020, so one local copy is reused and
    only the needed tile blocks are still read from ISRIC."""
    response = httpx.get(spec.url, timeout=CATALOG_TIMEOUT_S, follow_redirects=True)
    response.raise_for_status()
    text = response.text
    if "<VRTDataset" not in text:
        raise SoilDataError("SoilGrids catalog is not a VRT document")
    text, _, _ = crop_catalog(text)
    absolute = f'relativeToVRT="0">/vsicurl/{SOURCE_BASE}/{spec.property}/'
    rewritten, count = _RELATIVE_TILE.subn(absolute, text)
    if not count or 'relativeToVRT="1"' in rewritten:
        raise SoilDataError("Unexpected SoilGrids catalog tile paths")
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(".vrt.part")
    partial.write_text(rewritten)
    partial.replace(destination)


class SoilArchive:
    def __init__(self, root=ROOT, opener=None, sleeper=time.sleep, catalog_fetcher=None):
        self.root = Path(root)
        self.opener = opener or rasterio.open
        self.sleep = sleeper
        # Injected openers (tests) never reach the network for catalogs either.
        self.fetch_catalog = catalog_fetcher or (download_catalog if opener is None else None)

    def path(self, spec):
        return self.root / "raw" / spec.filename

    def catalog_path(self, spec):
        return self.root / "catalogs" / f"{spec.coverage_id}.vrt"

    def source(self, spec):
        """Local Indonesia catalog when the field lies inside it, otherwise the
        remote global VRT as before."""
        local = self.catalog_path(spec)
        left, bottom, right, top = catalog_extent()
        a, b, c, d = spec.bounds
        if not (left <= a and bottom <= b and right >= c and top >= d):
            return "/vsicurl/" + spec.url
        if not local.exists() and self.fetch_catalog is not None:
            local.parent.mkdir(parents=True, exist_ok=True)
            with local.with_suffix(".lock").open("a") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                if not local.exists():
                    try:
                        self.fetch_catalog(spec, local)
                    except (OSError, httpx.HTTPError, SoilDataError):
                        local.with_suffix(".vrt.part").unlink(missing_ok=True)
        if local.exists():
            return str(local)
        return "/vsicurl/" + spec.url

    def cached(self, spec):
        path = self.path(spec)
        if not path.exists():
            return None
        try:
            metadata = inspect(path, spec)
            saved = json.loads(path.with_suffix(".json").read_text())
            if saved["sha256"] != metadata["sha256"]:
                return None
            metadata["fetched_at"] = saved.get("fetched_at")
            return metadata
        except (
            OSError,
            ValueError,
            SoilDataError,
            KeyError,
            rasterio.errors.RasterioError,
        ):
            return None

    def find_cached(self, spec):
        exact = self.cached(spec)
        if exact:
            return spec, exact
        candidates = []
        for sidecar in (self.root / "raw").glob(spec.coverage_id + "_*.json"):
            try:
                saved = json.loads(sidecar.read_text())
                bounds = tuple(saved["bounds"])
                left, bottom, right, top = bounds
                a, b, c, d = spec.bounds
                if left <= a and bottom <= b and right >= c and top >= d:
                    candidates.append(
                        (
                            (right - left) * (top - bottom),
                            SoilSpec(spec.property, spec.depth, spec.statistic, bounds),
                        )
                    )
            except (OSError, ValueError, TypeError, KeyError, SoilDataError):
                continue
        for _, candidate in sorted(candidates, key=lambda item: item[0]):
            metadata = self.cached(candidate)
            if metadata:
                return candidate, metadata
        return None

    def ensure(self, spec, *, allow_network=True, refresh=False, retries=1):
        path = self.path(spec)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.with_suffix(".lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            found = self.find_cached(spec)
            cached = found[1] if found else None
            if cached and (not refresh or not allow_network):
                return {**cached, "cache_hit": True, "cached_fallback": False}
            if not allow_network:
                raise SoilDataError("No valid local cache: " + spec.filename)
            temporary = path.with_suffix(".tif.part")
            error = None
            for attempt in range(retries + 1):
                try:
                    with rasterio.Env(
                        GDAL_HTTP_TIMEOUT="25",
                        GDAL_HTTP_MAX_RETRY="1",
                        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                        CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".vrt,.tif",
                    ):
                        with self.opener(self.source(spec)) as source:
                            if (
                                source.crs is None
                                or not matches_soil_crs(source.crs)
                                or source.res != (250, 250)
                                or source.nodata != -32768
                            ):
                                raise SoilDataError(
                                    "Native source CRS/grid/NoData differs from verified SoilGrids data"
                                )
                            left, bottom, right, top = spec.bounds
                            # Origin is checked explicitly, so snapped requests preserve all pixels.
                            if (
                                source.transform.b
                                or source.transform.d
                                or source.transform.c % 250
                                or source.transform.f % 250
                            ):
                                raise SoilDataError("Unexpected native pixel alignment")
                            col = int(round((left - source.transform.c) / 250))
                            row = int(round((source.transform.f - top) / 250))
                            width = (right - left) // 250
                            height = (top - bottom) // 250
                            window = Window(col, row, width, height)
                            values = source.read(
                                1, window=window, boundless=True, fill_value=-32768
                            )
                            affine = source.window_transform(window)
                            tags = source.tags()
                            with rasterio.open(
                                temporary,
                                "w",
                                driver="GTiff",
                                width=width,
                                height=height,
                                count=1,
                                dtype="int16",
                                crs=source.crs,
                                transform=affine,
                                nodata=-32768,
                                compress="deflate",
                            ) as target:
                                target.write(values, 1)
                                target.update_tags(
                                    coverage_id=spec.coverage_id,
                                    source_version=tags.get(
                                        "Code_version", "SoilGrids 2.0 rolling/latest"
                                    ),
                                )
                    metadata = inspect(temporary, spec)
                    metadata["fetched_at"] = utc_now()
                    temporary.replace(path)
                    atomic_json(path.with_suffix(".json"), metadata)
                    return {**metadata, "cache_hit": False, "cached_fallback": False}
                except (
                    OSError,
                    ValueError,
                    SoilDataError,
                    rasterio.errors.RasterioError,
                ) as exc:
                    error = exc
                    temporary.unlink(missing_ok=True)
                    if attempt < retries:
                        self.sleep(2 ** (attempt + 1))
            if cached:
                return {**cached, "cache_hit": True, "cached_fallback": True}
            raise SoilDataError(
                f"SoilGrids unavailable without valid cache: {spec.coverage_id}: {error}"
            ) from error
