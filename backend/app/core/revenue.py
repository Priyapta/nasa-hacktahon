"""Deterministic national-reference sales scenarios. No network, IO or forecasts."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.core.rotation import PlannedStage


@dataclass(frozen=True)
class RevenueCrop:
    crop_id: str
    price: Decimal | None
    yield_kg_ha: Decimal
    non_market: bool


def rupiah(value: Decimal) -> int:
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


@dataclass(frozen=True)
class RevenueCalculation:
    area_ha: Decimal
    per_ha: Decimal
    total: Decimal
    harvests: int
    stages: tuple[dict, ...]

    def payload(self, highest=False) -> dict:
        return {
            "reference_year": 2023,
            "currency": "IDR",
            "area_ha": float(self.area_ha),
            "gross_idr": rupiah(self.total),
            "gross_per_ha_idr": rupiah(self.per_ha),
            "completed_harvests": self.harvests,
            "is_highest": highest,
            "stages": list(self.stages),
        }


def estimate_revenue(
    plan: Sequence[PlannedStage],
    crops: Mapping[str, RevenueCrop],
    *,
    area_ha: Decimal,
    start_month: str,
) -> RevenueCalculation:
    if not area_ha.is_finite() or area_ha <= 0:
        raise ValueError("Revenue needs a finite positive field area")
    per_ha = Decimal(0)
    rows = []
    harvests = 0
    for index, stage in enumerate(plan):
        crop = crops[stage.crop_id]  # Missing facts must never silently become zero.
        completed = not stage.continues_after_horizon
        reason = (
            "no_sales"
            if crop.non_market
            else "after_horizon"
            if not completed
            else "harvest"
        )
        amount = Decimal(0)
        quantity = Decimal(0)
        if reason == "harvest":
            if crop.price is None or crop.price <= 0 or crop.yield_kg_ha <= 0:
                raise ValueError("Missing cash-crop economic reference")
            amount = crop.price * crop.yield_kg_ha
            quantity = crop.yield_kg_ha * area_ha
            per_ha += amount
            harvests += 1
        rows.append(
            {
                "stage_index": index,
                "crop_id": stage.crop_id,
                "harvest_month": stage.end(start_month),
                "reason": reason,
                "quantity_kg": float(quantity),
                "gross_idr": rupiah(amount * area_ha),
            }
        )
    # Round only for display. Selection uses exact per-hectare Decimal totals.
    return RevenueCalculation(area_ha, per_ha, per_ha * area_ha, harvests, tuple(rows))
