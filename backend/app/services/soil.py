"""SoilGrids polygon service. Missing soil produces PRD partial-assessment data."""

from __future__ import annotations
import hashlib
import json

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from shapely.geometry import shape

from app.core.soil import (
    DEPTHS,
    PROPERTIES,
    STATISTICS,
    pixel_weights,
    project_polygon,
    summarize_layers,
    usda_texture,
)
from app.schemas import LocationInput, SoilAvailable, SoilUnavailable
from app.services.power_archive import atomic_json
from app.services.soil_archive import (
    SoilArchive,
    SoilDataError,
    SoilSpec,
    bounds_for_polygon,
)

METHOD = "native-pixel-area-depth-0-30cm-v1"


def read_layer(archive, spec, metadata):
    with rasterio.open(archive.root / "raw" / metadata["filename"]) as ds:
        window = (
            from_bounds(*spec.bounds, transform=ds.transform)
            .round_offsets()
            .round_lengths()
        )
        values = ds.read(1, window=window, masked=True).astype(float).filled(np.nan)
        return values, ds.window_transform(window)


class SoilService:
    def __init__(self, archive=None):
        self.archive = archive if archive is not None else SoilArchive()

    def for_polygon(self, location, *, allow_network=True, refresh=False, lang="id"):
        location = (
            location
            if isinstance(location, LocationInput)
            else LocationInput.model_validate(location)
        )
        if lang not in ("id", "en"):
            raise ValueError("Unsupported language")
        sources, coverages, notes, means, uncertainty = {}, {}, [], {}, {}
        details = {
            "method": METHOD,
            "source_files": sources,
            "coverage": coverages,
            "uncertainty_method": "Area/depth weighted source q05/q95; not a joint 90% prediction interval.",
        }
        try:
            projected = project_polygon(shape(location.model_dump()))
            bounds = bounds_for_polygon(projected)
            for property_name in PROPERTIES:
                layers = {}
                weights = None
                for statistic in STATISTICS:
                    for depth, _ in DEPTHS:
                        spec = SoilSpec(property_name, depth, statistic, bounds)
                        try:
                            metadata = self.archive.ensure(
                                spec, allow_network=allow_network, refresh=refresh
                            )
                            values, affine = read_layer(self.archive, spec, metadata)
                            if weights is None:
                                weights = pixel_weights(
                                    projected, affine, *values.shape
                                )
                            layers[property_name, depth, statistic] = values
                            sources[metadata["filename"]] = metadata
                        except SoilDataError:
                            if statistic == "mean":
                                raise
                            # Mean can remain available while quantile is unavailable.
                summary, coverage = summarize_layers(layers, weights, property_name)
                coverages[property_name] = coverage
                if summary["mean"] is None:
                    raise SoilDataError(
                        "Missing mean soil data for part of the polygon or depth profile"
                    )
                means[property_name] = summary["mean"]
                if summary["Q0.05"] is not None and summary["Q0.95"] is not None:
                    uncertainty[property_name] = {
                        "q05": summary["Q0.05"],
                        "q95": summary["Q0.95"],
                    }
                else:
                    notes.append(
                        (
                            f"Ketidakpastian {property_name} tidak lengkap; rentang tidak ditampilkan."
                            if lang == "id"
                            else f"Uncertainty for {property_name} is incomplete; no range is shown."
                        )
                    )
            texture = usda_texture(means["sand"], means["silt"], means["clay"])
            soil = SoilAvailable(
                status="ok",
                depth="0-30cm",
                texture_class=texture,
                ph=means["phh2o"],
                soc_g_per_kg=means["soc"],
                uncertainty=uncertainty,
            )
            details["texture_fractions_pct"] = {
                key: means[key] for key in ("sand", "silt", "clay")
            }
            details["texture_fraction_sum_pct"] = sum(
                means[key] for key in ("sand", "silt", "clay")
            )
            notes.append(
                (
                    "Tekstur diklasifikasikan dari fraksi rata-rata yang dinormalisasi ke 100%."
                    if lang == "id"
                    else "Texture is classified from the mean fractions normalized to 100%."
                )
            )
            notes.append(
                (
                    "Rentang ketidakpastian adalah ringkasan kuantil berbobot, bukan interval prediksi gabungan 90% untuk lahan."
                    if lang == "id"
                    else "Uncertainty ranges summarize weighted quantiles, not a joint 90% field prediction interval."
                )
            )
            skipped = []
        except (SoilDataError, ValueError, rasterio.errors.RasterioError) as exc:
            soil = SoilUnavailable(
                status="unavailable",
                depth="0-30cm",
                texture_class=None,
                ph=None,
                soc_g_per_kg=None,
                uncertainty={},
            )
            notes = [
                (
                    "Data tanah tidak tersedia untuk seluruh polygon dan kedalaman 0-30 cm. Kesesuaian tanah belum dinilai; penilaian parsial, K3 dilewati."
                    if lang == "id"
                    else "Soil data are unavailable for the full polygon and 0-30 cm profile. Soil suitability is unassessed; assessment is partial and K3 is skipped."
                )
            ]
            details["unavailable_reason"] = str(exc)
            skipped = ["K3"]
        fetched = [
            metadata["fetched_at"]
            for metadata in sources.values()
            if metadata.get("fetched_at")
        ]
        result = {
            "soil": soil.model_dump(),
            "notes": notes,
            "skipped_rules": skipped,
            "provenance": {
                "source": "SoilGrids 2.0",
                "fetched_at": max(fetched) if fetched else None,
                "resolution": "250 m",
            },
            "details": details,
        }
        key = hashlib.sha256(
            json.dumps(
                {"location": location.model_dump(), "method": METHOD, "lang": lang},
                sort_keys=True,
            ).encode()
        ).hexdigest()
        # Do not persist transient unavailable results as reusable environmental data.
        if soil.status == "ok":
            atomic_json(self.archive.root / "results" / (key + ".json"), result)
        return result
