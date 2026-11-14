from __future__ import annotations

from dataclasses import dataclass, field
from typing import Collection, Literal, Mapping, Sequence

from app.core.rotation import PlannedStage, add_months, calendar_month

# PRD 10: rainfall must reach the crop's lower water need in at least 60% of
# the historical windows. Kept as a named parameter as the PRD asks.
WATER_SHARE_THRESHOLD = 0.6
# PRD 10 says paddy "must be in wet-class months" without saying how many.
# Implementation decision: at least half of the paddy stage months are wet.
PADDY_MIN_WET_SHARE = 0.5
# Margins used only to raise "almost failed" risks, never to fail a rule.
NEAR_TEMPERATURE_C = 1.0
NEAR_WATER_SHARE = 0.7

RuleId = Literal["K1", "K2", "K3", "K4", "K5"]
WaterSource = Literal["tadah_hujan", "irigasi"]


@dataclass(frozen=True)
class Risk:
    code: str
    crop_id: str | None = None
    values: tuple[tuple[str, object], ...] = ()

    def get(self, key: str):
        return dict(self.values).get(key)


@dataclass(frozen=True)
class StageWater:
    stage_index: int
    crop_id: str
    met: int
    total: int
    need_mm: float

    @property
    def share(self) -> float | None:
        return self.met / self.total if self.total else None


@dataclass(frozen=True)
class Evaluation:
    failed_rules: tuple[RuleId, ...]
    skipped_rules: tuple[RuleId, ...]
    stage_water: tuple[StageWater, ...]
    risks: tuple[Risk, ...] = field(default=())

    @property
    def passed(self) -> bool:
        return not self.failed_rules


def _rule_order(rules: set[str]) -> tuple[RuleId, ...]:
    return tuple(rule for rule in ("K1", "K2", "K3", "K4", "K5") if rule in rules)


def stage_rainfall(
    stage: PlannedStage,
    window_starts: Sequence[str],
    monthly_rain: Mapping[str, float | None],
    need_mm: float,
) -> tuple[int, int]:
    """Count windows where rain over the whole stage reached the need. A window
    whose stage months are missing or invalid is left out of the total, never
    filled in."""
    met = total = 0
    offset = stage.offset
    for window_start in window_starts:
        months = [add_months(window_start, offset + i) for i in range(stage.length)]
        values = [monthly_rain.get(month) for month in months]
        if any(value is None for value in values):
            continue
        total += 1
        if sum(values) >= need_mm:
            met += 1
    return met, total


def evaluate(
    plan: Sequence[PlannedStage],
    *,
    start_month: str,
    crops: Mapping[str, object],
    profile: Mapping[int, Mapping[str, object]],
    monthly_rain: Mapping[str, float | None],
    window_starts: Sequence[str],
    soil_ph: float | None,
    water_source: WaterSource,
    limited_months: Collection[int] = (),
) -> Evaluation:
    failed: set[str] = set()
    skipped: set[str] = set()
    risks: list[Risk] = []
    waters: list[StageWater] = []
    flagged_unknown: set[str] = set()
    limited: set[int] = set()

    expected = 0
    for stage in plan:
        if stage.offset != expected or stage.length < 1:
            failed.add("K1")
        expected = stage.offset + stage.length

    if soil_ph is None:
        skipped.add("K3")
        risks.append(Risk("soil_unavailable"))
    if water_source == "irigasi":
        skipped.add("K5")
        risks.append(Risk("irrigation_assumed"))

    for index, stage in enumerate(plan):
        if stage.continues_after_horizon:
            risks.append(
                Risk(
                    "continues_after_horizon",
                    stage.crop_id,
                    (("end", stage.end(start_month)),),
                )
            )
        if stage.crop_id == "bera":
            continue
        crop = crops[stage.crop_id]
        months = [calendar_month(m) for m in stage.months(start_month)]

        for month in months:
            mean = profile.get(month, {}).get("t_mean_c")
            if month in limited_months or mean is None:
                limited.add(month)
            if mean is None:
                continue
            if mean < crop.t_abs_min or mean > crop.t_abs_max:
                failed.add("K2")
            elif (
                mean - crop.t_abs_min < NEAR_TEMPERATURE_C
                or crop.t_abs_max - mean < NEAR_TEMPERATURE_C
            ):
                risks.append(Risk("near_temperature", stage.crop_id, (("month", month),)))

        if soil_ph is not None and not (crop.ph_abs_min <= soil_ph <= crop.ph_abs_max):
            failed.add("K3")

        if index > 0:
            previous = plan[index - 1].crop_id
            for rule in crop.aturan_urutan:
                if rule.kind == "not_after_crop" and previous in rule.crop_ids:
                    failed.add("K4")

        if crop.k5_mode == "exempt_unknown_water":
            if stage.crop_id not in flagged_unknown:
                risks.append(Risk("water_unknown", stage.crop_id))
                flagged_unknown.add(stage.crop_id)
            continue
        if crop.water_basis == "bean_proxy" and stage.crop_id not in flagged_unknown:
            risks.append(Risk("water_proxy", stage.crop_id))
            flagged_unknown.add(stage.crop_id)

        met, total = stage_rainfall(stage, window_starts, monthly_rain, crop.air_min_mm)
        water = StageWater(index, stage.crop_id, met, total, crop.air_min_mm)
        waters.append(water)
        if total == 0:
            risks.append(Risk("water_unassessed", stage.crop_id))
            continue
        share = water.share
        if water_source == "tadah_hujan":
            if share < WATER_SHARE_THRESHOLD:
                failed.add("K5")
            elif share < NEAR_WATER_SHARE:
                risks.append(
                    Risk("near_water", stage.crop_id, (("met", met), ("total", total)))
                )

        if crop.butuh_bulan_basah:
            wet = sum(1 for m in months if profile.get(m, {}).get("class") == "basah")
            if wet / len(months) < PADDY_MIN_WET_SHARE:
                if water_source == "tadah_hujan":
                    failed.add("K5")
                risks.append(
                    Risk(
                        "paddy_outside_wet",
                        stage.crop_id,
                        (("wet", wet), ("months", len(months)), ("start", stage.start(start_month))),
                    )
                )

    for month in sorted(limited):
        risks.append(Risk("data_limited", None, (("month", month),)))

    return Evaluation(
        failed_rules=_rule_order(failed),
        skipped_rules=_rule_order(skipped),
        stage_water=tuple(waters),
        risks=tuple(dict.fromkeys(risks)),
    )
