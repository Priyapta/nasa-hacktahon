from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Mapping, Sequence

from app.core.feasibility import Evaluation, Risk
from app.core.rotation import PlannedStage, calendar_month

Level = Literal["rendah", "sedang", "tinggi"]


@dataclass(frozen=True)
class Dimensions:
    climate_fit_level: Level
    climate_months_ok: int
    climate_months_total: int
    water_level: Level
    years_met: int
    years_total: int
    weakest_crop: str | None
    water_need_mm: float
    bare_months: int
    legume: bool
    cover_crop: bool
    families: int
    soil_checks: int
    has_production: bool
    risks: tuple[Risk, ...]

    @property
    def climate_fit_share(self) -> float | None:
        if not self.climate_months_total:
            return None
        return self.climate_months_ok / self.climate_months_total

    @property
    def water_share(self) -> float:
        return self.years_met / self.years_total if self.years_total else 1.0


def climate_level(share: float | None) -> Level:
    # PRD 10: high 80% and up, medium 50 to 79%, low below 50%.
    if share is None:
        return "rendah"
    if share >= 0.8:
        return "tinggi"
    return "sedang" if share >= 0.5 else "rendah"


def water_level(share: float) -> Level:
    # PRD 10: pressure is low at 80% and up, medium 60 to 79%, high below 60%.
    if share >= 0.8:
        return "rendah"
    return "sedang" if share >= 0.6 else "tinggi"


def measure(
    plan: Sequence[PlannedStage],
    evaluation: Evaluation,
    *,
    start_month: str,
    crops: Mapping[str, object],
    profile: Mapping[int, Mapping[str, object]],
) -> Dimensions:
    months_ok = months_total = 0
    for stage in plan:
        if stage.crop_id == "bera":
            continue
        crop = crops[stage.crop_id]
        for month in (calendar_month(m) for m in stage.months(start_month)):
            row = profile.get(month, {})
            mean = row.get("t_mean_c")
            if mean is None:
                continue
            months_total += 1
            in_optimum = crop.t_opt_min <= mean <= crop.t_opt_max
            wet_enough = not crop.butuh_bulan_basah or row.get("class") == "basah"
            if in_optimum and wet_enough:
                months_ok += 1

    assessed = [water for water in evaluation.stage_water if water.total]
    weakest = min(assessed, key=lambda water: (water.share, water.stage_index), default=None)
    years_met = weakest.met if weakest else 0
    years_total = weakest.total if weakest else 0

    grown = [crops[s.crop_id] for s in plan if s.crop_id != "bera"]
    legume = any(crop.penambat_n for crop in grown)
    cover = any(crop.penutup_tanah for crop in grown)
    families = len({crop.famili for crop in grown if crop.famili})
    # PRD 10 soil checklist: a nitrogen fixer, a green manure or cover crop,
    # and more than one plant family.
    soil_checks = int(legume) + int(cover) + int(families > 1)

    share = months_ok / months_total if months_total else None
    return Dimensions(
        climate_fit_level=climate_level(share),
        climate_months_ok=months_ok,
        climate_months_total=months_total,
        water_level=water_level(years_met / years_total if years_total else 1.0),
        years_met=years_met,
        years_total=years_total,
        weakest_crop=weakest.crop_id if weakest else None,
        water_need_mm=sum(water.need_mm for water in evaluation.stage_water),
        bare_months=sum(s.months_in_horizon for s in plan if s.crop_id == "bera"),
        legume=legume,
        cover_crop=cover,
        families=families,
        soil_checks=soil_checks,
        has_production=any("produksi" in crop.peran["id"] for crop in grown),
        risks=evaluation.risks,
    )
