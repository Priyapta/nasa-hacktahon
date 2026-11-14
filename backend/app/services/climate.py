"""Adapt POWER daily area data to PRD climate statistics; no crop recommendation."""

import fcntl
import hashlib
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.core.climate import (
    ClimateInputError,
    climate_statistics,
    validate_window_request,
)
from app.schemas import ClimateContext, LocationInput
from app.services.power import PowerService
from app.services.power_archive import atomic_json, utc_now

METHOD_VERSION = "monthly-common-quality-contiguous-years-v1"


def last_complete_year():
    return datetime.now(ZoneInfo("Asia/Jakarta")).year - 1


class ClimateService:
    def __init__(self, power=None):
        self.power = power if power is not None else PowerService()

    def for_polygon(
        self,
        location,
        *,
        start_month,
        horizon_months=12,
        lang="id",
        allow_network=False,
    ):
        validate_window_request(start_month, horizon_months)
        if lang not in ("id", "en"):
            raise ClimateInputError("Unsupported language")
        location = (
            location
            if isinstance(location, LocationInput)
            else LocationInput.model_validate(location)
        )
        last_year = last_complete_year()
        expected_period = f"{last_year - 9}-01-01/{last_year}-12-31"
        key = hashlib.sha256(
            json.dumps(
                {
                    "location": location.model_dump(),
                    "reference_end_year": last_year,
                    "start_month": start_month,
                    "horizon": horizon_months,
                    "lang": lang,
                    "method": METHOD_VERSION,
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
        path = self.power.archive.root / "results" / f"climate-{key}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.with_suffix(".lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            cached = self._cached(path, expected_period)
            if cached is not None:
                return cached
            result = self._compute(
                location.model_dump(), start_month, horizon_months, lang, allow_network
            )
            result["provenance"]["cache_hit"] = False
            digest = hashlib.sha256(
                json.dumps(result, sort_keys=True, allow_nan=False).encode()
            ).hexdigest()
            atomic_json(path, {"result": result, "sha256": digest})
            return result

    def _cached(self, path, expected_period):
        try:
            envelope = json.loads(path.read_text())
            result = envelope["result"]
            digest = hashlib.sha256(
                json.dumps(result, sort_keys=True, allow_nan=False).encode()
            ).hexdigest()
            if (
                digest != envelope["sha256"]
                or result["climate"]["period"] != expected_period
            ):
                return None
            if result["provenance"]["statistics_method"] != METHOD_VERSION:
                return None
            ClimateContext.model_validate(result["climate"])
            sources = result["provenance"]["source_files"]
            if not sources:
                return None
            for filename, metadata in sources.items():
                if Path(filename).name != filename:
                    return None
                source = self.power.archive.root / "raw" / filename
                if source.stat().st_size != metadata["bytes"]:
                    return None
                if (
                    hashlib.sha256(source.read_bytes()).hexdigest()
                    != metadata["sha256"]
                ):
                    return None
            result["provenance"]["cache_hit"] = True
            return result
        except (OSError, ValueError, TypeError, KeyError, AttributeError):
            return None

    def _compute(self, location, start_month, horizon_months, lang, allow_network):
        daily = self.power.for_polygon(location, allow_network=allow_network)
        result = climate_statistics(daily, start_month, horizon_months, lang)
        # Enforce the existing FE contract; no new public response fields added.
        result["climate"] = ClimateContext.model_validate(result["climate"]).model_dump(
            by_alias=True
        )
        result["provenance"] = {
            "source": daily["source"],
            "time_standard": daily["time_standard"],
            "source_files": daily["source_files"],
            "source_assumptions": daily.get("assumptions", []),
            "spatial_method": daily["method"],
            "statistics_method": METHOD_VERSION,
            "computed_at": utc_now(),
            "rain_validation": daily["rain_validation"],
            "monthly_quality": "Common valid-year set across all six variables; <=3 missing days per variable/month.",
            "oldeman_thresholds_mm": {
                "basah": ">200",
                "lembap": "100-200 inclusive",
                "kering": "<100",
            },
            "temperature_profile": "t_mean: median monthly T2M; t_min: minimum monthly-mean T2M_MIN; t_max: maximum monthly-mean T2M_MAX.",
        }
        if daily["rain_validation"].get("status") == "unvalidated":
            result["notes"].append(
                "Hujan belum divalidasi terhadap dataset pembanding."
                if lang == "id"
                else "Rainfall has not been validated against a reference dataset."
            )
        result["assumptions"] = (
            [
                "Data area grid adalah estimasi, bukan pengukuran langsung di lahan.",
                "Estimasi berbasis pola historis, bukan prediksi atau peluang untuk tahun depan.",
                "Tidak ada ekstrapolasi tren; sepuluh tahun belum mewakili seluruh kejadian ekstrem.",
                "Hujan bulanan adalah jumlah observasi tanpa koreksi hari hilang; radiasi dan kelembapan adalah rata-rata.",
            ]
            if lang == "id"
            else [
                "Gridded area data are estimates, not direct field measurements.",
                "Estimates based on historical patterns, not forecasts or probabilities for next year.",
                "No trend extrapolation; ten years do not represent all rare extremes.",
                "Monthly rain sums observed days without correcting gaps; radiation and humidity are means.",
            ]
        )
        return result
