"""Validated, versioned local economic reference. Sources are never scraped at runtime."""

import hashlib
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Self, get_args

from pydantic import Field, model_validator
from pyproj import Geod
from shapely.geometry import shape
from shapely.geometry.polygon import orient

from app.core.revenue import RevenueCrop
from app.schemas import ContractModel, CropId

DecimalText = Annotated[str, Field(pattern=r"^\d+(?:\.\d+)?$")]

DATA_FILE = Path(__file__).resolve().parents[1] / "data/economics/national-2023.json"


class EconomicSource(ContractModel):
    id: str
    title: str
    url: str
    locator: str
    sha256: str | None


class EconomicCrop(ContractModel):
    crop_id: CropId
    product: str
    price_idr_per_kg: DecimalText | None
    yield_quintals_per_ha: DecimalText
    non_market: bool
    source_moisture_pct: DecimalText | None
    model_moisture_pct: DecimalText | None
    sources: list[str]

    @model_validator(mode="after")
    def coherent(self) -> Self:
        y = Decimal(self.yield_quintals_per_ha)
        p = (
            Decimal(self.price_idr_per_kg)
            if self.price_idr_per_kg is not None
            else None
        )
        if (
            not y.is_finite()
            or y < 0
            or (p is not None and (not p.is_finite() or p <= 0))
        ):
            raise ValueError("Invalid price or yield")
        if self.non_market != (self.crop_id in ("bera", "orok_orok")):
            raise ValueError("Only fallow and green manure have no modeled sales")
        if self.non_market:
            if y != 0 or p is not None:
                raise ValueError(
                    "No-sales crops need explicit zero modeled output and no market price"
                )
        elif y <= 0 or p is None or not self.sources:
            raise ValueError("Cash crop needs price, yield and evidence")
        if (self.source_moisture_pct is None) != (self.model_moisture_pct is None):
            raise ValueError("Both moisture references are required")
        if self.source_moisture_pct is not None:
            a, b = Decimal(self.source_moisture_pct), Decimal(self.model_moisture_pct)
            if not a.is_finite() or not b.is_finite() or not 0 <= b <= a < 100:
                raise ValueError("Invalid dry-matter adjustment")
        return self

    def core(self) -> RevenueCrop:
        y = Decimal(self.yield_quintals_per_ha) * 100
        if self.source_moisture_pct is not None:
            y = (
                y
                * (100 - Decimal(self.source_moisture_pct))
                / (100 - Decimal(self.model_moisture_pct))
            )
        return RevenueCrop(
            self.crop_id,
            Decimal(self.price_idr_per_kg) if self.price_idr_per_kg else None,
            y,
            self.non_market,
        )


class RevenueTable(ContractModel):
    version: str
    reference_year: Literal[2023]
    scope: Literal["Indonesia"]
    sources: list[EconomicSource]
    crops: list[EconomicCrop]
    assumptions: dict[Literal["id", "en"], list[str]]

    @model_validator(mode="after")
    def complete(self) -> Self:
        if len(self.crops) != len(get_args(CropId)) or {
            c.crop_id for c in self.crops
        } != set(get_args(CropId)):
            raise ValueError("Economic table must cover all six crop IDs explicitly")
        ids = {s.id for s in self.sources}
        if len(ids) != len(self.sources) or any(
            not s.url.startswith("https://") for s in self.sources
        ):
            raise ValueError("Invalid source registry")
        if any(not set(c.sources) <= ids for c in self.crops):
            raise ValueError("Unresolved economic evidence")
        if set(self.assumptions) != {"id", "en"} or any(
            not a for a in self.assumptions.values()
        ):
            raise ValueError("Both assumption languages are required")
        return self

    def core(self) -> dict[str, RevenueCrop]:
        return {crop.crop_id: crop.core() for crop in self.crops}

    def provenance(self, lang: str) -> dict:
        return {
            "version": self.version,
            "reference_year": self.reference_year,
            "scope": self.scope,
            "sources": [s.model_dump() for s in self.sources],
            "references": [
                {
                    "crop_id": c.crop_id,
                    "product": c.product,
                    "non_market": c.non_market,
                    "price_idr_per_kg": float(c.price_idr_per_kg)
                    if c.price_idr_per_kg
                    else None,
                    "source_yield_kg_per_ha": float(
                        Decimal(c.yield_quintals_per_ha) * 100
                    ),
                    "model_yield_kg_per_ha": float(c.core().yield_kg_ha),
                    "source_moisture_pct": float(c.source_moisture_pct)
                    if c.source_moisture_pct
                    else None,
                    "model_moisture_pct": float(c.model_moisture_pct)
                    if c.model_moisture_pct
                    else None,
                }
                for c in self.crops
            ],
            "assumptions": self.assumptions[lang],
        }


@lru_cache(maxsize=8)
def load_revenue_table(path: Path = DATA_FILE) -> RevenueTable:
    raw = Path(path).read_bytes()
    table = RevenueTable.model_validate_json(raw)
    return table.model_copy(
        update={"version": table.version + ":" + hashlib.sha256(raw).hexdigest()[:12]}
    )


def field_area_ha(location: dict) -> Decimal:
    # Same mean Earth radius as Turf on the FE. Normalize hole orientation.
    area, _ = Geod(a=6371008.8, f=0).geometry_area_perimeter(
        orient(shape(location), sign=1)
    )
    return Decimal(str(abs(area) / 10000))
