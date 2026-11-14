"""User-triggered bounded Nominatim search with persistent cache and shared rate gate."""

from __future__ import annotations

import fcntl
import hashlib
import json
import math
import tempfile
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from pydantic import ValidationError

from app.config import GeocodeSettings
from app.schemas import GeocodeInput, GeocodeResponse, GeocodeResult


class GeocodeUnavailable(RuntimeError):
    pass


class GeocodeRateLimited(RuntimeError):
    def __init__(self, retry_after=1):
        self.retry_after = max(1, math.ceil(retry_after))
        super().__init__("Pencarian terlalu cepat. Coba lagi setelah jeda.")


def atomic_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=path.parent, suffix=".part", delete=False
        ) as stream:
            temporary = Path(stream.name)
            json.dump(payload, stream, ensure_ascii=False, allow_nan=False)
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


@contextmanager
def file_lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        yield


def contains(bbox, lon, lat):
    west, south, east, north = bbox
    return west <= lon <= east and south <= lat <= north


def normalize_results(payload, bbox):
    if not isinstance(payload, list):
        raise GeocodeUnavailable("Invalid Nominatim result envelope")
    results, seen, malformed = [], set(), False
    zooms = {
        "country": 4,
        "state": 7,
        "county": 10,
        "city": 11,
        "town": 12,
        "municipality": 11,
        "village": 14,
        "hamlet": 15,
        "suburb": 14,
    }
    for row in payload:
        try:
            if (
                not isinstance(row, dict)
                or isinstance(row.get("lat"), bool)
                or isinstance(row.get("lon"), bool)
            ):
                raise ValueError("Invalid coordinate")
            lat, lon = float(row["lat"]), float(row["lon"])
            if (
                not math.isfinite(lat)
                or not math.isfinite(lon)
                or not (-90 <= lat <= 90 and -180 <= lon <= 180)
            ):
                raise ValueError("Invalid coordinate")
            osm_type, osm_id = row["osm_type"], row["osm_id"]
            if (
                osm_type not in ("node", "way", "relation")
                or isinstance(osm_id, bool)
                or not str(osm_id).isdigit()
                or int(osm_id) <= 0
            ):
                raise ValueError("Invalid OSM identifier")
            name = row["display_name"]
            if not isinstance(name, str) or not name.strip():
                raise ValueError("Invalid place name")
            if not contains(bbox, lon, lat):
                continue
            identifier = f"{osm_type}-{int(osm_id)}"
            if identifier in seen:
                continue
            seen.add(identifier)
            results.append(
                GeocodeResult(
                    id=identifier,
                    name=name.strip(),
                    center=(lon, lat),
                    zoom=zooms.get(row.get("addresstype"), 14),
                )
            )
        except (KeyError, TypeError, ValueError):
            malformed = True
    if malformed:
        # A broken provider response is not the same as a successful empty search.
        raise GeocodeUnavailable("Malformed Nominatim place result")
    return GeocodeResponse(results=results[:5])


def retry_delay(header, now):
    try:
        seconds = float(header)
        if math.isfinite(seconds):
            return max(1, math.ceil(seconds))
    except (TypeError, ValueError):
        pass
    try:
        return max(1, math.ceil(parsedate_to_datetime(header).timestamp() - now))
    except (TypeError, ValueError, OverflowError):
        return 1


class GeocodeService:
    def __init__(self, settings=None, client=None, clock=time.time):
        self.settings = settings if settings is not None else GeocodeSettings.from_env()
        self.root = Path(self.settings.cache_dir)
        self.client, self.clock = client, clock
        # Same provider host shares one budget even across bounding-box/UA changes.
        provider = urlsplit(self.settings.base_url).netloc.lower()
        self.provider_key = hashlib.sha256(provider.encode()).hexdigest()

    def _key(self, query):
        context = {
            "version": 1,
            "q": query.casefold(),
            "provider": self.settings.base_url,
            "bbox": self.settings.bbox,
            "language": "id,en",
            "limit": 5,
        }
        return hashlib.sha256(json.dumps(context, sort_keys=True).encode()).hexdigest()

    def _cached(self, path):
        try:
            cached = json.loads(path.read_text())
            if not isinstance(cached, dict):
                return None
            if (
                cached.get("version") != 1
                or type(cached["expires_at"]) not in (int, float)
                or not math.isfinite(cached["expires_at"])
            ):
                return None
            response = GeocodeResponse.model_validate_json(
                json.dumps(cached["response"])
            )
            if any(
                not contains(self.settings.bbox, *place.center)
                for place in response.results
            ):
                return None
            return response, cached["expires_at"] > self.clock()
        except (OSError, ValueError, TypeError, KeyError, ValidationError):
            return None

    def _rate_path(self):
        return self.root / ("provider-" + self.provider_key + ".json")

    def _reserve(self, cooldown=None):
        path = self._rate_path()
        with file_lock(path.with_suffix(".lock")):
            now = self.clock()
            try:
                state = json.loads(path.read_text())
                next_at = float(state["next_at"])
                if not math.isfinite(next_at):
                    raise ValueError("Invalid rate state")
            except FileNotFoundError:
                next_at = 0.0
            except (OSError, TypeError, ValueError, KeyError):
                next_at = now + 1  # Fail closed for a corrupt rate-state file.
            if cooldown is not None:
                atomic_json(path, {"next_at": max(next_at, now + cooldown)})
            elif now < next_at:
                raise GeocodeRateLimited(next_at - now)
            else:
                atomic_json(path, {"next_at": now + 1})

    def search(self, query):
        query = " ".join(GeocodeInput(q=query).q.split())
        key = self._key(query)
        path = self.root / "results" / (key + ".json")
        # Coalesce simultaneous requests for the same query, including workers.
        with file_lock(self.root / "locks" / (key + ".lock")):
            cached = self._cached(path)
            if cached and cached[1]:
                return cached[0], "hit"
            self._reserve()
            try:
                result = self._fetch(query)
            except GeocodeUnavailable:
                if cached:
                    return cached[0], "stale"
                raise
            atomic_json(
                path,
                {
                    "version": 1,
                    "fetched_at": datetime.fromtimestamp(
                        self.clock(), timezone.utc
                    ).isoformat(),
                    "expires_at": self.clock() + self.settings.cache_ttl_seconds,
                    "response": result.model_dump(mode="json"),
                },
            )
            return result, "miss"

    def _fetch(self, query):
        west, south, east, north = self.settings.bbox
        params = {
            "q": query,
            "format": "jsonv2",
            "countrycodes": "id",
            "bounded": 1,
            "viewbox": f"{west},{north},{east},{south}",
            "limit": 5,
            "accept-language": "id,en",
        }
        headers = {"User-Agent": self.settings.user_agent, "Accept": "application/json"}
        try:
            if self.client is None:
                with httpx.Client(timeout=10, follow_redirects=False) as client:
                    response = client.get(
                        self.settings.base_url.rstrip("/") + "/search",
                        params=params,
                        headers=headers,
                    )
            else:
                response = self.client.get(
                    self.settings.base_url.rstrip("/") + "/search",
                    params=params,
                    headers=headers,
                    timeout=10,
                )
            if response.status_code == 429:
                delay = retry_delay(response.headers.get("Retry-After"), self.clock())
                self._reserve(cooldown=delay)
                raise GeocodeRateLimited(delay)
            response.raise_for_status()
            return normalize_results(response.json(), self.settings.bbox)
        except (httpx.HTTPError, ValueError) as exc:
            raise GeocodeUnavailable(
                "Layanan pencarian lokasi belum tersedia. Coba lagi sebentar."
            ) from exc
