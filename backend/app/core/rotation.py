from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Protocol, Sequence


class StageInput(Protocol):
    crop_id: str
    months: int | None


class CropFacts(Protocol):
    crop_id: str
    slot_bulan: int | None


def add_months(month: str, count: int) -> str:
    year, index = (int(part) for part in month.split("-"))
    year_offset, zero_index = divmod(year * 12 + index - 1 + count, 12)
    return f"{year_offset:04d}-{zero_index + 1:02d}"


def calendar_month(month: str) -> int:
    return int(month.split("-")[1])


@dataclass(frozen=True)
class PlannedStage:
    """One stage placed on the plan, counted in months after the start month."""

    crop_id: str
    offset: int
    length: int
    horizon_months: int

    @property
    def months_in_horizon(self) -> int:
        return max(0, min(self.length, self.horizon_months - self.offset))

    @property
    def continues_after_horizon(self) -> bool:
        return self.offset + self.length > self.horizon_months

    def months(self, start_month: str) -> list[str]:
        return [add_months(start_month, self.offset + i) for i in range(self.length)]

    def start(self, start_month: str) -> str:
        return add_months(start_month, self.offset)

    def end(self, start_month: str) -> str:
        return add_months(start_month, self.offset + self.length - 1)


class RotationError(ValueError):
    pass


def stage_length(stage: StageInput, crops: Mapping[str, CropFacts]) -> int:
    if stage.crop_id == "bera":
        if not stage.months:
            raise RotationError("Fallow needs a duration in months")
        return stage.months
    crop = crops.get(stage.crop_id)
    if crop is None or not crop.slot_bulan:
        raise RotationError(f"Unknown crop or missing slot: {stage.crop_id}")
    return crop.slot_bulan


def build_calendar(
    stages: Sequence[StageInput],
    crops: Mapping[str, CropFacts],
    horizon_months: int,
) -> tuple[PlannedStage, ...]:
    """PRD 10 step 3 and 4: repeat the pattern from its first stage until the
    horizon is covered. The last stage may run past the horizon and is flagged."""
    if not stages:
        return ()
    plan: list[PlannedStage] = []
    offset = 0
    index = 0
    while offset < horizon_months:
        stage = stages[index % len(stages)]
        length = stage_length(stage, crops)
        plan.append(PlannedStage(stage.crop_id, offset, length, horizon_months))
        offset += length
        index += 1
    return tuple(plan)


def signature(plan: Sequence[PlannedStage]) -> tuple[tuple[str, int, int], ...]:
    """Two strategies differ when any stage inside the horizon differs."""
    return tuple(
        (stage.crop_id, stage.offset, stage.months_in_horizon)
        for stage in plan
        if stage.months_in_horizon > 0
    )
