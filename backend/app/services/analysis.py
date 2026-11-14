from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

from shapely.geometry import shape

from app.catalog import Catalog, load_catalog
from app.config import DEFAULT_DEMO_BBOX
from app.core.climate import ClimateInputError
from app.core.dimensions import measure
from app.core.explain import selection_notes, strategy_payload
from app.core.feasibility import WATER_SHARE_THRESHOLD, evaluate
from app.core.rotation import build_calendar
from app.core.selector import Scored, select
from app.schemas import AnalysisContext, AnalysisInput, AnalysisResponse
from app.services.climate import ClimateService
from app.services.power_archive import ArchiveError
from app.services.soil import SoilService


# PRD 12.5: fetch climate and soil together, POWER within 15 s and SoilGrids
# within 8 s. A late fetch keeps running in the background and fills the cache.
CLIMATE_TIMEOUT_S = 15
SOIL_TIMEOUT_S = 8
_fetchers = ThreadPoolExecutor(max_workers=8, thread_name_prefix="analysis-fetch")
logger = logging.getLogger(__name__)


def soil_unavailable(lang: str) -> dict:
    return {
        "soil": {
            "status": "unavailable",
            "depth": "0-30cm",
            "texture_class": None,
            "ph": None,
            "soc_g_per_kg": None,
            "uncertainty": {},
        },
        "notes": [
            "Data tanah tidak tersedia untuk titik ini. Kesesuaian tanah belum dinilai."
            if lang == "id"
            else "Soil data is not available for this location. Soil suitability was not assessed."
        ],
        "provenance": {"source": "SoilGrids 2.0", "fetched_at": None, "resolution": "250 m"},
    }


class ClimateUnavailable(RuntimeError):
    """NASA POWER failed and no cache exists for this area (PRD 11, HTTP 502)."""


CLIMATE_UNAVAILABLE = {
    "id": "Data iklim belum bisa diambil. Coba lagi sebentar.",
    "en": "Climate data could not be retrieved yet. Please try again shortly.",
}


def _grid_resolution(provenance: dict, lang: str) -> str:
    spacing = next(
        (
            meta.get("grid_spacing_degrees")
            for meta in provenance.get("source_files", {}).values()
            if meta.get("grid_spacing_degrees")
        ),
        None,
    )
    if not spacing:
        return "NASA POWER grid"
    lat, lon = spacing["lat"], spacing["lon"]
    if lang == "id":
        return f"Sel grid {str(lat).replace('.', ',')}° x {str(lon).replace('.', ',')}°, sekitar 50 km. Nilai area, bukan pengukuran di lahan."
    return f"{lat}° x {lon}° grid cells, about 50 km. Area values, not field measurements."


def _fetched_at(provenance: dict) -> str:
    stamps = [
        meta["fetched_at"]
        for meta in provenance.get("source_files", {}).values()
        if meta.get("fetched_at")
    ]
    return max(stamps) if stamps else provenance["computed_at"]


def _outside_demo(location, bbox) -> bool:
    point = shape(location.model_dump()).representative_point()
    west, south, east, north = bbox
    return not (west <= point.x <= east and south <= point.y <= north)


class AnalysisService:
    """One orchestrator for /analyze and for the agent's scenario tool, so both
    use the same data access and the same pure engine (BE-09)."""

    def __init__(
        self,
        *,
        climate: ClimateService | None = None,
        soil: SoilService | None = None,
        catalog: Catalog | None = None,
        demo_bbox=DEFAULT_DEMO_BBOX,
        allow_network: bool = True,
    ):
        self.climate = climate or ClimateService()
        self.soil = soil or SoilService()
        self.catalog = catalog or load_catalog()
        self.demo_bbox = demo_bbox
        self.allow_network = allow_network

    def analyze(self, request: AnalysisContext, lang: str = "id") -> AnalysisResponse:
        if isinstance(request, AnalysisInput):
            lang = request.lang
        start, horizon = request.time.start_month, request.time.horizon_months
        climate_job = _fetchers.submit(
            self.climate.for_polygon,
            request.location,
            start_month=start,
            horizon_months=horizon,
            lang=lang,
            allow_network=self.allow_network,
        )
        soil_job = _fetchers.submit(
            self.soil.for_polygon,
            request.location,
            allow_network=self.allow_network,
            lang=lang,
        )
        try:
            climate = climate_job.result(timeout=CLIMATE_TIMEOUT_S)
        except (ArchiveError, ClimateInputError, OSError, FutureTimeout) as exc:
            logger.warning("Climate analysis failed: %s", type(exc).__name__, exc_info=True)
            raise ClimateUnavailable(CLIMATE_UNAVAILABLE[lang]) from exc
        try:
            soil = soil_job.result(timeout=SOIL_TIMEOUT_S)
        except Exception:
            soil = soil_unavailable(lang)

        crops = {crop.crop_id: crop for crop in self.catalog.crops}
        profile = {
            row["month"]: {"t_mean_c": row["t_mean_c"], "class": row["class"]}
            for row in climate["climate"]["monthly"]
        }
        monthly_rain = {
            row["month"]: row["values"]["PRECTOTCORR"] if row["valid"] else None
            for row in climate["monthly_by_year"]
        }
        window_starts = [window["start"] for window in climate["historical_windows"]]
        limited = {row["month"] for row in climate["quality"] if row["data_limited"]}
        soil_ph = soil["soil"]["ph"] if soil["soil"]["status"] == "ok" else None

        def score(identifier, stages) -> Scored:
            plan = build_calendar(stages, crops, horizon)
            evaluation = evaluate(
                plan,
                start_month=start,
                crops=crops,
                profile=profile,
                monthly_rain=monthly_rain,
                window_starts=window_starts,
                soil_ph=soil_ph,
                water_source=request.water_source,
                limited_months=limited,
            )
            dims = measure(plan, evaluation, start_month=start, crops=crops, profile=profile)
            return Scored(identifier, plan, evaluation, dims)

        baseline = (
            score("baseline", request.rotation.stages)
            if request.rotation.has_pattern
            else None
        )
        candidates = [
            score(rotation.id, rotation.stages)
            for rotation in self.catalog.candidate_rotations()
        ]
        selection = select(candidates, baseline)

        common = {
            "baseline": baseline,
            "crops": crops,
            "start_month": start,
            "water_source": request.water_source,
            "lang": lang,
        }
        strategies = []
        if baseline is not None:
            strategies.append(strategy_payload("pola_biasa", baseline, **common))
        strategies += [strategy_payload(role, item, **common) for role, item in selection.alternatives]

        notes = list(climate["notes"])
        if soil["soil"]["status"] != "ok":
            notes += soil["notes"]
        if _outside_demo(request.location, self.demo_bbox):
            notes.append(
                "Daftar tanaman disusun untuk Grobogan dan mungkin tidak cocok di sini."
                if lang == "id"
                else "The crop list was prepared for Grobogan and may not fit this location."
            )
        notes += selection_notes(selection, has_pattern=request.rotation.has_pattern, lang=lang)

        power = climate["provenance"]
        rain_missing = sum(row["missing_days"]["PRECTOTCORR"] for row in climate["monthly_by_year"])
        threshold = int(WATER_SHARE_THRESHOLD * 100)
        assumptions = list(climate["assumptions"]) + [
            (
                f"Hujan dianggap cukup bila mencapai batas bawah kebutuhan air tanaman pada minimal {threshold}% tahun acuan. Penguapan, limpasan, dan simpanan air tanah tidak dihitung."
                if lang == "id"
                else f"Rain counts as enough when it reaches the crop's lower water need in at least {threshold}% of reference years. Evaporation, runoff and soil storage are not counted."
            ),
            (
                "Hitungan X dari N tahun adalah frekuensi historis, bukan peluang untuk tahun depan."
                if lang == "id"
                else "X of N year counts are historical frequencies, not chances for next year."
            ),
        ]
        if request.water_source == "irigasi":
            assumptions.append(
                "Irigasi dianggap tersedia, jumlah airnya tidak dihitung."
                if lang == "id"
                else "Irrigation is assumed available. The amount of water is not calculated."
            )

        payload = {
            "context": {"climate": climate["climate"], "soil": soil["soil"]},
            "strategies": strategies,
            "notes": notes,
            "provenance": {
                "climate": {
                    "source": power["source"],
                    "fetched_at": _fetched_at(power),
                    "resolution": _grid_resolution(power, lang),
                    "missing_days": rain_missing,
                    "rain_source": "POWER",
                    "rain_validation": {
                        "reference": power.get("rain_validation", {}).get("reference"),
                        "annual_diff_pct": None,
                        "months_class_differs": None,
                        "status": power.get("rain_validation", {}).get("status", "unvalidated"),
                    },
                },
                "soil": soil["provenance"],
                "crop_table_version": self.catalog.version,
                "assumptions": assumptions,
            },
        }
        return AnalysisResponse.model_validate(payload)
