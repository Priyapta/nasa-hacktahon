"""Four-input contract with the authorized polygon location override.

Crop IDs are the PRD's fixed MVP vocabulary, not an agronomic crop table.
Durations and agronomic thresholds will come from reviewed data later.
See contracts/location-polygon.md for the backend-only change to PRD location.
"""

import re
from datetime import datetime
from typing import Annotated, Literal, Self
from zoneinfo import ZoneInfo
from uuid import UUID

from shapely import Polygon, is_valid_reason

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
    model_validator,
)

Language = Literal["id", "en"]
CropId = Literal[
    "padi_sawah", "jagung", "kedelai", "kacang_hijau", "orok_orok", "bera"
]


def current_month_index() -> int:
    now = datetime.now(ZoneInfo("Asia/Jakarta"))
    return now.year * 12 + now.month - 1


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


Position = Annotated[
    list[Annotated[float, Field(allow_inf_nan=False)]],
    Field(min_length=2, max_length=2),
]
LinearRing = Annotated[list[Position], Field(min_length=4)]


class LocationInput(ContractModel):
    """GeoJSON geometry directly at location, matching the FE Polygon object.

    Coordinates are [longitude, latitude]. No centroid or sampling is computed.
    The first ring is the exterior; subsequent rings are interior holes.
    """

    type: Literal["Polygon"]
    coordinates: Annotated[list[LinearRing], Field(min_length=1)]

    @field_validator("coordinates")
    @classmethod
    def validate_polygon(cls, rings: list[list[list[float]]]) -> list[list[list[float]]]:
        for ring in rings:
            if any(not (-180 <= lon <= 180 and -90 <= lat <= 90) for lon, lat in ring):
                raise ValueError("Koordinat polygon harus [lon, lat] dalam rentang geografis.")
            if ring[0] != ring[-1]:
                raise ValueError("Ring polygon harus tertutup: titik pertama sama dengan terakhir.")
            if len({tuple(position) for position in ring[:-1]}) < 3:
                raise ValueError("Ring polygon membutuhkan minimal tiga titik berbeda.")
        geometry = Polygon(rings[0], holes=rings[1:])
        if geometry.is_empty or not geometry.is_valid or geometry.area <= 0:
            raise ValueError("Polygon tidak valid atau luasnya nol: " + is_valid_reason(geometry))
        return rings


class RotationStage(ContractModel):
    crop_id: CropId
    months: Annotated[int, Field(ge=1, le=6)] | None = None

    @model_serializer(mode="wrap")
    def serialize_duration(self, handler):
        result = handler(self)
        if self.crop_id != "bera":
            result.pop("months", None)
        return result

    @model_validator(mode="after")
    def validate_duration(self) -> Self:
        if self.crop_id == "bera" and self.months is None:
            raise ValueError("Tahap bera membutuhkan months, bilangan bulat 1–6.")
        if self.crop_id != "bera" and "months" in self.model_fields_set:
            raise ValueError("Field months hanya boleh diisi untuk bera.")
        return self


class RotationInput(ContractModel):
    has_pattern: bool
    stages: Annotated[list[RotationStage], Field(max_length=6)]

    @model_validator(mode="after")
    def validate_pattern(self) -> Self:
        if self.has_pattern and not self.stages:
            raise ValueError("Pola rotasi membutuhkan 1–6 tahap.")
        if not self.has_pattern and self.stages:
            raise ValueError("Tanpa pola, stages harus kosong.")
        return self


class TimeInput(ContractModel):
    start_month: Annotated[str, Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
    horizon_months: Literal[6, 12, 18, 24]

    @field_validator("horizon_months", mode="before")
    @classmethod
    def integer_horizon(cls, value: object) -> object:
        if type(value) is not int:
            raise ValueError("Horizon harus bilangan bulat 6, 12, 18, atau 24.")
        return value

    @field_validator("start_month")
    @classmethod
    def validate_start_month(cls, value: str) -> str:
        year, month = map(int, value.split("-"))
        offset = year * 12 + month - 1 - current_month_index()
        if not 0 <= offset <= 11:
            raise ValueError("Pilih bulan berjalan sampai 11 bulan berikutnya (WIB).")
        return value


class AnalysisContext(ContractModel):
    location: LocationInput
    rotation: RotationInput
    time: TimeInput
    water_source: Literal["tadah_hujan", "irigasi"]


class AnalysisInput(AnalysisContext):
    lang: Language = "id"


class HealthResponse(ContractModel):
    status: Literal["ok"] = "ok"


# Response fields follow PRD 7 / 7.1; input location uses the polygon override.
# Technical details are documented in
# backend/contracts/README.md. No fixture is used by application routes.
FiniteNumber = Annotated[float, Field(allow_inf_nan=False)]
NonNegative = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Count = Annotated[int, Field(ge=0)]
Month = Annotated[str, Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
Timestamp = Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")]
Level = Literal["rendah", "sedang", "tinggi"]
StrategyRole = Literal["pola_biasa", "hemat_air", "jaga_tanah", "seimbang"]
RuleId = Literal["K1", "K2", "K3", "K4", "K5"]


class MonthlyClimate(ContractModel):
    month: Annotated[int, Field(ge=1, le=12)]
    rain_median_mm: NonNegative | None
    rain_min_mm: NonNegative | None
    rain_max_mm: NonNegative | None
    # JSON key is prescribed by PRD; 'class' is a Python keyword.
    month_class: Literal["basah", "lembap", "kering"] | None = Field(alias="class")
    t_mean_c: FiniteNumber | None
    t_min_c: FiniteNumber | None
    t_max_c: FiniteNumber | None
    rad: NonNegative | None
    rh_pct: Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)] | None
    n_years: Annotated[int, Field(ge=0, le=10)]


class ClimateContext(ContractModel):
    period: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}/\d{4}-\d{2}-\d{2}$")]
    monthly: Annotated[list[MonthlyClimate], Field(min_length=12, max_length=12)]

    @model_validator(mode="after")
    def unique_months(self) -> Self:
        if {m.month for m in self.monthly} != set(range(1, 13)):
            raise ValueError("monthly harus memuat masing-masing bulan 1-12 sekali.")
        return self


class QuantileRange(ContractModel):
    q05: FiniteNumber
    q95: FiniteNumber

    @model_validator(mode="after")
    def ordered_bounds(self) -> Self:
        if self.q05 > self.q95:
            raise ValueError("q05 tidak boleh melebihi q95.")
        return self


SoilProperty = Literal["clay", "sand", "silt", "phh2o", "soc"]


class SoilAvailable(ContractModel):
    status: Literal["ok"]
    depth: Literal["0-30cm"]
    texture_class: Annotated[str, Field(min_length=1)]
    ph: Annotated[float, Field(ge=0, le=14, allow_inf_nan=False)]
    soc_g_per_kg: NonNegative
    uncertainty: dict[SoilProperty, QuantileRange]


class SoilUnavailable(ContractModel):
    status: Literal["unavailable"]
    depth: Literal["0-30cm"]
    texture_class: None
    ph: None
    soc_g_per_kg: None
    uncertainty: dict[SoilProperty, QuantileRange]

    @model_validator(mode="after")
    def no_invented_uncertainty(self) -> Self:
        if self.uncertainty:
            raise ValueError("Tanah unavailable harus memiliki uncertainty kosong.")
        return self


class EnvironmentalContext(ContractModel):
    climate: ClimateContext
    soil: Annotated[SoilAvailable | SoilUnavailable, Field(discriminator="status")]


class StageRain(ContractModel):
    years_met: Count
    years_total: Count

    @model_validator(mode="after")
    def valid_counts(self) -> Self:
        if self.years_met > self.years_total:
            raise ValueError("years_met tidak boleh melebihi years_total.")
        return self


class CalendarStage(ContractModel):
    crop_id: CropId
    start: Month
    end: Month
    continues_after_horizon: bool
    water: StageRain | None
    warnings: list[str]

    @model_validator(mode="after")
    def ordered_months(self) -> Self:
        if self.end < self.start:
            raise ValueError("end tidak boleh sebelum start; kedua bulan inklusif.")
        return self


class Feasibility(ContractModel):
    passed: bool
    failed_rules: list[RuleId]

    @model_validator(mode="after")
    def consistent_result(self) -> Self:
        if self.passed != (not self.failed_rules):
            raise ValueError("passed harus sesuai dengan failed_rules.")
        if len(set(self.failed_rules)) != len(self.failed_rules):
            raise ValueError("failed_rules tidak boleh berulang.")
        return self


class ClimateFit(ContractModel):
    level: Level
    evidence: str


class WaterPressure(ContractModel):
    level: Level
    years_met: Count
    years_total: Count

    @model_validator(mode="after")
    def valid_counts(self) -> Self:
        if self.years_met > self.years_total:
            raise ValueError("years_met tidak boleh melebihi years_total.")
        return self


class SoilContribution(ContractModel):
    legume: bool
    cover_crop: bool
    families: Count


class Dimensions(ContractModel):
    climate_fit: ClimateFit
    water_pressure: WaterPressure
    bare_months: Count
    soil_contribution: SoilContribution
    risks: list[str]


ExplanationPoints = Annotated[
    list[Annotated[str, Field(min_length=1, max_length=600, pattern=r"\S")]],
    Field(min_length=1, max_length=6),
]


class StrategyExplanation(ContractModel):
    assessment: ExplanationPoints
    basis: ExplanationPoints
    cautions: ExplanationPoints


class Strategy(ContractModel):
    id: Annotated[str, Field(min_length=1)]
    role: StrategyRole
    label: Annotated[str, Field(min_length=1)]
    calendar: Annotated[list[CalendarStage], Field(min_length=1)]
    feasibility: Feasibility
    dimensions: Dimensions
    reasons: list[str]
    tradeoffs: list[str]
    explanation: StrategyExplanation | None = Field(default=None, exclude_if=lambda value: value is None)


class RainValidation(ContractModel):
    reference: str | None
    annual_diff_pct: FiniteNumber | None
    months_class_differs: Annotated[int, Field(ge=0, le=12)] | None
    # PRD does not define a closed vocabulary for these statuses.
    status: Annotated[str, Field(min_length=1)]


class ClimateProvenance(ContractModel):
    source: str
    fetched_at: Timestamp
    resolution: str
    missing_days: Count
    rain_source: str
    rain_validation: RainValidation


class SoilProvenance(ContractModel):
    source: str
    fetched_at: Timestamp | None
    resolution: str


class Provenance(ContractModel):
    climate: ClimateProvenance
    soil: SoilProvenance
    crop_table_version: str
    assumptions: list[str]


class AnalysisResponse(ContractModel):
    context: EnvironmentalContext
    strategies: Annotated[list[Strategy], Field(max_length=3)]
    notes: list[str]
    provenance: Provenance

    @model_validator(mode="after")
    def unique_strategies(self) -> Self:
        if len({s.id for s in self.strategies}) != len(self.strategies):
            raise ValueError("ID strategi harus unik.")
        if len({s.role for s in self.strategies}) != len(self.strategies):
            raise ValueError("Role strategi tidak boleh berulang.")
        if any(s.role == "pola_biasa" for s in self.strategies) and any(
            s.role == "seimbang" for s in self.strategies
        ):
            raise ValueError("seimbang hanya untuk hasil tanpa pola biasa.")
        if any(not s.feasibility.passed for s in self.strategies if s.role != "pola_biasa"):
            raise ValueError("Alternatif harus lolos aturan kelayakan.")
        return self


class CropOption(ContractModel):
    crop_id: CropId
    nama: str
    peran: Annotated[list[str], Field(min_length=1)]
    slot_bulan: Annotated[int, Field(ge=1)] | None

    @model_validator(mode="after")
    def crop_duration(self) -> Self:
        if (self.crop_id == "bera") != (self.slot_bulan is None):
            raise ValueError("Hanya bera memakai slot_bulan=null.")
        return self


class CropsResponse(ContractModel):
    crops: list[CropOption]


class GeocodeInput(ContractModel):
    q: Annotated[str, Field(min_length=1)]

    @field_validator("q", mode="before")
    @classmethod
    def trimmed_query(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class GeocodeResult(ContractModel):
    id: str
    name: str
    # Map component's existing order: longitude, latitude.
    center: tuple[
        Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)],
        Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)],
    ]
    zoom: Annotated[float, Field(ge=0)]


class GeocodeResponse(ContractModel):
    results: list[GeocodeResult]


class ErrorDetail(ContractModel):
    loc: list[str | int]
    msg: str


class ErrorResponse(ContractModel):
    detail: Annotated[list[ErrorDetail], Field(min_length=1)]


ChatText = Annotated[str, Field(min_length=1, max_length=2000)]


class ChatMessage(ContractModel):
    role: Literal["user", "assistant"]
    content: ChatText

    @field_validator("content", mode="before")
    @classmethod
    def trim_content(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ChatInput(ContractModel):
    message: ChatText
    history: Annotated[list[ChatMessage], Field(max_length=10)]
    analysis_input: AnalysisContext | None
    lang: Language = "id"
    field_id: UUID | None = Field(default=None, exclude_if=lambda value: value is None)

    @field_validator("message", mode="before")
    @classmethod
    def trim_message(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ChatSource(ContractModel):
    id: Annotated[str, Field(pattern=r"^S[1-9]\d*$")]
    title: str
    url: Annotated[str, Field(pattern=r"^https?://[^\s]+$")]
    period: str | None


class ChatScenario(ContractModel):
    input: AnalysisInput
    result: AnalysisResponse


class ChatResponse(ContractModel):
    answer: str
    sources: list[ChatSource]
    scenario: ChatScenario | None


    @model_validator(mode="after")
    def source_references(self) -> Self:
        ids = [source.id for source in self.sources]
        if len(set(ids)) != len(ids):
            raise ValueError("ID sumber harus unik.")
        unknown = set(re.findall(r"\[(S[1-9]\d*)\]", self.answer)) - set(ids)
        if unknown:
            raise ValueError("Jawaban merujuk ID sumber yang tidak tersedia.")
        return self
