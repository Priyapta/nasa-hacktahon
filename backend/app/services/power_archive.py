"""Resumable POWER daily regional archive. No network calls on import/startup."""
from __future__ import annotations

import fcntl
import hashlib
import json
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import numpy as np
import pandas as pd
import xarray as xr

PARAMETERS = ("T2M", "T2M_MIN", "T2M_MAX", "PRECTOTCORR", "RH2M", "ALLSKY_SFC_SW_DWN")
BACKEND = Path(__file__).resolve().parents[2]
DEFAULT_ROOT = BACKEND / "data" / "power"
BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/regional"
# The regional API limits each axis to 10 degrees and requests to 366 days.
INDONESIA_TILES = [(s, n, w, e) for s, n in [(-12, -2), (-2, 7)]
                   for w, e in [(104, 114), (94, 104), (114, 124), (124, 134), (134, 142)]]


class ArchiveError(RuntimeError):
    pass


class ProviderUnavailable(ArchiveError):
    """Map to PRD HTTP 502 when analysis routes are implemented."""


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                         prefix=f".{path.name}.", suffix=".part", delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


@dataclass(frozen=True)
class DownloadSpec:
    parameter: str
    year: int
    south: float
    north: float
    west: float
    east: float

    def __post_init__(self):
        if self.parameter not in PARAMETERS:
            raise ValueError("Unknown POWER parameter")
        if not (-90 <= self.south < self.north <= 90 and -180 <= self.west < self.east <= 180):
            raise ValueError("Invalid download bounds")
        if self.north - self.south > 10 or self.east - self.west > 10:
            raise ValueError("Each regional request must be at most 10 degrees per axis")
        if not 1981 <= self.year < datetime.now(ZoneInfo("Asia/Jakarta")).year:
            raise ValueError("Use complete historical calendar years")

    @property
    def filename(self):
        return (f"{self.parameter}_{self.year}_lat{self.south:g}_{self.north:g}"
                f"_lon{self.west:g}_{self.east:g}.nc")

    @property
    def query(self):
        return {"parameters": self.parameter, "community": "AG", "start": f"{self.year}0101",
                "end": f"{self.year}1231", "latitude-min": self.south, "latitude-max": self.north,
                "longitude-min": self.west, "longitude-max": self.east,
                "format": "NETCDF", "time-standard": "LST"}


def indonesia_specs(start_year=2016, end_year=2025):
    # First six requests populate the small 2025 Java-area sample.
    return [DownloadSpec(parameter, year, *tile)
            for year in range(end_year, start_year - 1, -1)
            for tile in INDONESIA_TILES for parameter in PARAMETERS]


def inspect_file(path: Path, spec: DownloadSpec):
    """Reject partial/error/wrong-variable files before making them visible."""
    with xr.open_dataset(path, engine="h5netcdf") as ds:
        if spec.parameter not in ds or set(ds[spec.parameter].dims) != {"time", "lat", "lon"}:
            raise ArchiveError("Wrong variable or dimensions in POWER response")
        expected = pd.date_range(f"{spec.year}-01-01", f"{spec.year}-12-31", freq="D")
        if not np.array_equal(ds.time.values, expected.values):
            raise ArchiveError("Incomplete or unordered calendar year in POWER response")
        unit = str(ds[spec.parameter].attrs.get("units", ""))
        if not unit:
            raise ArchiveError("Missing parameter units")
        spacings = {}
        for axis in ("lat", "lon"):
            values = ds[axis].values
            if len(values) < 2 or not np.isfinite(values).all() or not (np.diff(values) > 0).all():
                raise ArchiveError("Invalid grid coordinates")
            steps = np.diff(values)
            if not np.allclose(steps, steps[0]):
                raise ArchiveError("Nonuniform source grid")
            spacings[axis] = float(steps[0])
        # Verified against actual source coordinates, not regional API display grid.
        expected_spacing = (1.0, 1.0) if spec.parameter == "ALLSKY_SFC_SW_DWN" else (0.5, 0.625)
        if not np.allclose([spacings["lat"], spacings["lon"]], expected_spacing):
            raise ArchiveError("Source grid changed; review polygon weighting before ingest")
        metadata = {"parameter": spec.parameter, "year": spec.year, "unit": unit,
                    "grid_spacing_degrees": spacings, "days": len(expected),
                    "bounds_requested": [spec.west, spec.south, spec.east, spec.north],
                    "source": "NASA POWER", "source_version": str(ds.attrs.get("version", "")),
                    "time_standard": "LST", "url": str(httpx.URL(BASE_URL, params=spec.query))}
    metadata.update(bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    return metadata


class PowerArchive:
    def __init__(self, root=DEFAULT_ROOT, client=None, sleeper=time.sleep):
        self.root = Path(root)
        self.client = client
        self.sleep = sleeper

    def path(self, spec):
        return self.root / "raw" / spec.filename

    def cached(self, spec):
        path = self.path(spec)
        if not path.exists():
            return None
        try:
            metadata = inspect_file(path, spec)
        except (OSError, ValueError, ArchiveError):
            return None
        sidecar = path.with_suffix(".json")
        if sidecar.exists():
            try:
                saved = json.loads(sidecar.read_text())
                if saved.get("sha256") == metadata["sha256"]:
                    metadata["fetched_at"] = saved.get("fetched_at")
            except (ValueError, OSError):
                pass
        # An imported .nc without metadata has unknown fetch time, not today's time.
        metadata.setdefault("fetched_at", None)
        return metadata

    def ensure(self, spec, *, refresh=False, retries=3):
        # Single writer per archive file, including on-demand service requests.
        path = self.path(spec)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.with_suffix(".lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            return self._ensure(spec, refresh=refresh, retries=retries)

    def _ensure(self, spec, *, refresh=False, retries=3):
        cached = self.cached(spec)
        if cached and not refresh:
            return {**cached, "cache_hit": True, "cached_fallback": False}
        if self.client is None:
            with httpx.Client(timeout=90, follow_redirects=True) as client:
                return PowerArchive(self.root, client, self.sleep)._ensure(spec, refresh=refresh, retries=retries)
        path = self.path(spec)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".nc.part")
        error = None
        for attempt in range(retries + 1):
            retry_after = 0.0
            try:
                with self.client.stream("GET", BASE_URL, params=spec.query) as response:
                    if response.status_code == 429:
                        try:
                            retry_after = min(300, max(0, float(response.headers.get("Retry-After", "0"))))
                        except ValueError:
                            pass
                    response.raise_for_status()
                    with temporary.open("wb") as stream:
                        for chunk in response.iter_bytes():
                            stream.write(chunk)
                metadata = inspect_file(temporary, spec)
                metadata["fetched_at"] = utc_now()
                temporary.replace(path)
                atomic_json(path.with_suffix(".json"), metadata)
                return {**metadata, "cache_hit": False, "cached_fallback": False}
            except (httpx.HTTPError, OSError, ValueError, ArchiveError) as exc:
                error = exc
                temporary.unlink(missing_ok=True)
                if isinstance(exc, httpx.HTTPStatusError) and 400 <= exc.response.status_code < 500 and exc.response.status_code not in (408, 429):
                    break
                if attempt < retries:
                    self.sleep(max(retry_after, min(60, 2 ** (attempt + 1))))
        if cached:
            return {**cached, "cache_hit": True, "cached_fallback": True}
        raise ProviderUnavailable(f"POWER unavailable without valid cache: {spec.filename}: {error}") from error
