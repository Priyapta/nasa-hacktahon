"""Small environment configuration; no provider calls during startup."""

import math
import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit


def allowed_origins() -> list[str]:
    """Comma-separated exact origins for optional direct frontend access."""
    return [
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]


# OSM relation 9687051 bounding box, checked 2026-11-14. This agronomic demo
# rectangle is not an administrative polygon containment test.
DEFAULT_DEMO_BBOX = (110.5415518, -7.2832140, 111.2468490, -6.9094001)
# Search scope was expanded to Indonesia by the owner; agronomic demo stays Grobogan.
DEFAULT_GEOCODE_BBOX = (94.0, -12.0, 142.0, 7.0)


@dataclass(frozen=True)
class GeocodeSettings:
    cache_dir: Path = field(
        default_factory=lambda: Path(__file__).resolve().parents[1] / "data" / "geocode"
    )
    base_url: str = "https://nominatim.openstreetmap.org"
    user_agent: str = "FieldShift/0.1 (+https://github.com/Priyapta/nasa-hacktahon)"
    bbox: tuple[float, float, float, float] = DEFAULT_GEOCODE_BBOX
    cache_ttl_seconds: float = 7 * 24 * 60 * 60

    def __post_init__(self):
        parsed = urlsplit(self.base_url)
        if (
            parsed.scheme not in ("http", "https")
            or not parsed.hostname
            or parsed.query
            or parsed.fragment
            or parsed.username
        ):
            raise ValueError(
                "NOMINATIM_BASE_URL must be a provider base URL without credentials/query"
            )
        if not self.user_agent.strip() or self.user_agent.lower().startswith(
            ("python-httpx", "python-requests", "curl/")
        ):
            raise ValueError("NOMINATIM_USER_AGENT must identify the application")
        west, south, east, north = self.bbox
        if not all(math.isfinite(x) for x in self.bbox) or not (
            -180 <= west < east <= 180 and -90 <= south < north <= 90
        ):
            raise ValueError("GEOCODE_BBOX must be west,south,east,north")
        if not math.isfinite(self.cache_ttl_seconds) or self.cache_ttl_seconds <= 0:
            raise ValueError("Geocode cache TTL must be positive")

    @classmethod
    def from_env(cls):
        root = Path(
            os.getenv("CACHE_DIR", str(Path(__file__).resolve().parents[1] / "data"))
        ).expanduser()
        raw = os.getenv("GEOCODE_BBOX")
        bbox = (
            tuple(float(x.strip()) for x in raw.split(","))
            if raw
            else DEFAULT_GEOCODE_BBOX
        )
        if len(bbox) != 4:
            raise ValueError("GEOCODE_BBOX needs four coordinates")
        return cls(
            cache_dir=root / "geocode",
            base_url=os.getenv("NOMINATIM_BASE_URL", cls.base_url).rstrip("/"),
            user_agent=os.getenv("NOMINATIM_USER_AGENT", cls.user_agent),
            bbox=bbox,
        )
