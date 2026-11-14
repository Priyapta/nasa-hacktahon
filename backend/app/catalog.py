"""Versioned, source-checked crop facts and candidate sequences. No network."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Self, get_args

from pydantic import Field, model_validator

from app.schemas import (
    ContractModel,
    CropId,
    CropOption,
    CropsResponse,
    Language,
    RotationStage,
)

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "catalog"
Number = Annotated[float, Field(allow_inf_nan=False)]
Text = Annotated[str, Field(min_length=1)]


class Evidence(ContractModel):
    source_id: Text
    locator: Text
    basis: Literal[
        "direct", "prd_decision", "proxy", "model_assumption", "mapping", "adaptation"
    ]


class Source(ContractModel):
    id: Text
    title: Text
    url: str | None
    document: str | None
    accessed: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    verification: Literal["primary_page", "indexed_primary_excerpt", "project_document"]

    @model_validator(mode="after")
    def identified(self) -> Self:
        if not self.url and not self.document:
            raise ValueError("Source needs a URL or project document")
        if self.url and not self.url.startswith(("https://", "http://")):
            raise ValueError("Source URL must be HTTP(S)")
        return self


class DayRange(ContractModel):
    min: Annotated[int, Field(ge=1)]
    max: Annotated[int, Field(ge=1)]

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if self.min > self.max:
            raise ValueError("Reversed crop-cycle range")
        return self


class SequenceRule(ContractModel):
    kind: Literal["not_after_crop"]
    crop_ids: Annotated[list[CropId], Field(min_length=1)]
    sumber: Annotated[list[Evidence], Field(min_length=1)]


class CropRecord(ContractModel):
    crop_id: CropId
    nama: dict[Language, Text]
    scientific_name: Text | None
    famili: Literal["Poaceae", "Fabaceae"] | None
    peran: dict[Language, Annotated[list[Text], Field(min_length=1)]]
    slot_bulan: Annotated[int, Field(ge=1)] | None
    t_abs_min: Number | None
    t_abs_max: Number | None
    t_opt_min: Number | None
    t_opt_max: Number | None
    ph_abs_min: Number | None
    ph_abs_max: Number | None
    air_min_mm: Number | None
    air_max_mm: Number | None
    water_basis: Literal["direct_fao", "bean_proxy", "unknown", "not_applicable"]
    k5_mode: Literal["assessed", "exempt_unknown_water", "not_applicable"]
    butuh_bulan_basah: bool
    penambat_n: bool
    penutup_tanah: bool
    crop_cycle_days: DayRange | None
    local_cycle_days: DayRange | None
    aturan_urutan: list[SequenceRule]
    catatan: dict[Language, Annotated[list[Text], Field(min_length=1)]]
    sumber: dict[str, Annotated[list[Evidence], Field(min_length=1)]]

    @model_validator(mode="after")
    def coherent_facts(self) -> Self:
        for labels in (self.nama, self.peran, self.catatan):
            if set(labels) != {"id", "en"}:
                raise ValueError("Both id/en labels are required")
        climate = [
            self.t_abs_min,
            self.t_opt_min,
            self.t_opt_max,
            self.t_abs_max,
            self.ph_abs_min,
            self.ph_abs_max,
        ]
        if self.crop_id == "bera":
            if self.slot_bulan is not None or any(
                value is not None for value in climate
            ):
                raise ValueError("Fallow has no fixed slot or crop climate thresholds")
            if (
                self.famili is not None
                or self.scientific_name is not None
                or self.crop_cycle_days is not None
            ):
                raise ValueError("Fallow is not a biological crop")
            if (self.air_min_mm, self.air_max_mm, self.water_basis, self.k5_mode) != (
                0,
                0,
                "not_applicable",
                "not_applicable",
            ):
                raise ValueError(
                    "Fallow crop water demand must be explicitly not applicable"
                )
        else:
            if self.slot_bulan is None or any(value is None for value in climate):
                raise ValueError("A crop needs duration, temperature and pH facts")
            if not self.t_abs_min <= self.t_opt_min <= self.t_opt_max <= self.t_abs_max:
                raise ValueError("Inconsistent temperature thresholds")
            if not 0 <= self.ph_abs_min <= self.ph_abs_max <= 14:
                raise ValueError("Invalid pH interval")
            if (
                self.scientific_name is None
                or self.famili is None
                or self.crop_cycle_days is None
            ):
                raise ValueError("Missing biological identity or source cycle")
            if self.crop_id == "orok_orok":
                if (
                    self.air_min_mm,
                    self.air_max_mm,
                    self.water_basis,
                    self.k5_mode,
                ) != (None, None, "unknown", "exempt_unknown_water"):
                    raise ValueError(
                        "Sunn-hemp unknown water must not become zero demand"
                    )
            elif self.k5_mode != "assessed":
                raise ValueError("Food crops require seasonal-water assessment")
            elif (
                self.air_min_mm is None
                or self.air_max_mm is None
                or not 0 < self.air_min_mm <= self.air_max_mm
            ):
                raise ValueError("Missing seasonal crop water range")
        if self.crop_id == "kacang_hijau" and self.water_basis != "bean_proxy":
            raise ValueError("Mung-bean proxy must remain explicit")
        if self.butuh_bulan_basah != (self.crop_id == "padi_sawah"):
            raise ValueError("Wet-month requirement follows the PRD paddy rule")
        return self


class RotationRecord(ContractModel):
    id: Text
    stages: Annotated[list[RotationStage], Field(min_length=1, max_length=6)]
    status: Literal["source_checked", "draft"]
    evidence_scope: Literal["grobogan", "proposed_adaptation"]
    evidence_basis: Literal[
        "reported_sequence", "local_pattern_mapping", "proposed_adaptation"
    ]
    catatan: dict[Language, Annotated[list[Text], Field(min_length=1)]]
    sumber: Annotated[list[Evidence], Field(min_length=1)]

    @model_validator(mode="after")
    def disclosure(self) -> Self:
        if set(self.catatan) != {"id", "en"}:
            raise ValueError("Both languages are required")
        if self.evidence_scope == "proposed_adaptation" and self.status != "draft":
            raise ValueError("An unverified local adaptation cannot be enabled")
        if (
            self.status == "source_checked"
            and self.evidence_basis == "proposed_adaptation"
        ):
            raise ValueError("Draft adaptation is not a verified sequence")
        return self


class SourceDocument(ContractModel):
    version: Text
    sources: list[Source]


class CropDocument(ContractModel):
    version: Text
    crops: list[CropRecord]


class RotationDocument(ContractModel):
    version: Text
    rotations: list[RotationRecord]


@dataclass(frozen=True)
class Catalog:
    version: str
    crops: tuple[CropRecord, ...]
    rotations: tuple[RotationRecord, ...]
    sources: tuple[Source, ...]

    def crop_options(self, lang: Language = "id") -> CropsResponse:
        if lang not in ("id", "en"):
            raise ValueError("Unsupported language")
        return CropsResponse(
            crops=[
                CropOption(
                    crop_id=crop.crop_id,
                    nama=crop.nama[lang],
                    peran=crop.peran[lang],
                    slot_bulan=crop.slot_bulan,
                )
                for crop in self.crops
            ]
        )

    def candidate_rotations(self) -> tuple[RotationRecord, ...]:
        # Having a source does not mean a candidate passes climate/water/soil rules.
        return tuple(
            rotation
            for rotation in self.rotations
            if rotation.status == "source_checked"
        )


@lru_cache(maxsize=8)
def load_catalog(root: Path = DATA_DIR) -> Catalog:
    root = Path(root)
    texts = [
        (root / name).read_text(encoding="utf-8")
        for name in ("sources.json", "crops.json", "rotations.json")
    ]
    sources = SourceDocument.model_validate_json(texts[0])
    crops = CropDocument.model_validate_json(texts[1])
    rotations = RotationDocument.model_validate_json(texts[2])
    if len({sources.version, crops.version, rotations.version}) != 1:
        raise ValueError("Catalog document versions differ")
    source_ids = {source.id for source in sources.sources}
    if len(source_ids) != len(sources.sources):
        raise ValueError("Duplicate source ID")
    crop_ids = {crop.crop_id for crop in crops.crops}
    if crop_ids != set(get_args(CropId)) or len(crops.crops) != len(crop_ids):
        raise ValueError("Catalog must contain exactly the six PRD crop IDs")

    def check_refs(refs):
        if not refs or any(ref.source_id not in source_ids for ref in refs):
            raise ValueError("Missing or unresolved evidence")

    for crop in crops.crops:
        fields = set(CropRecord.model_fields) - {
            "crop_id",
            "sumber",
            "catatan",
            "local_cycle_days",
            "crop_cycle_days",
        }
        if crop.crop_cycle_days is not None:
            fields.add("crop_cycle_days")
        if crop.local_cycle_days is not None:
            fields.add("local_cycle_days")
        if not fields <= set(crop.sumber):
            raise ValueError(
                f"Missing field provenance for {crop.crop_id}: {fields - set(crop.sumber)}"
            )
        for refs in crop.sumber.values():
            check_refs(refs)
        for rule in crop.aturan_urutan:
            check_refs(rule.sumber)
    ids = set()
    signatures = set()
    for rotation in rotations.rotations:
        check_refs(rotation.sumber)
        signature = tuple((stage.crop_id, stage.months) for stage in rotation.stages)
        if rotation.id in ids or signature in signatures:
            raise ValueError("Duplicate rotation ID or exact sequence")
        ids.add(rotation.id)
        signatures.add(signature)
        if rotation.status == "source_checked" and not any(
            ref.basis in ("direct", "mapping") and ref.source_id != "PRD"
            for ref in rotation.sumber
        ):
            raise ValueError("Enabled sequence needs external evidence")
    digest = hashlib.sha256("\n".join(texts).encode()).hexdigest()[:12]
    return Catalog(
        crops.version + ":" + digest,
        tuple(crops.crops),
        tuple(rotations.rotations),
        tuple(sources.sources),
    )
