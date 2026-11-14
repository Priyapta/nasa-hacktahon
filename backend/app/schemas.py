"""Four-input contract from PRD section 7 and architecture section 3.

Crop IDs are the PRD's fixed MVP vocabulary, not an agronomic crop table.
Durations and agronomic thresholds will come from reviewed data later.
"""

from datetime import datetime
from typing import Annotated, Literal, Self
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Language = Literal["id", "en"]
CropId = Literal[
    "padi_sawah", "jagung", "kedelai", "kacang_hijau", "orok_orok", "bera"
]


def current_month_index() -> int:
    now = datetime.now(ZoneInfo("Asia/Jakarta"))
    return now.year * 12 + now.month - 1


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class LocationInput(ContractModel):
    lat: Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
    lon: Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]


class RotationStage(ContractModel):
    crop_id: CropId
    months: Annotated[int, Field(ge=1, le=6)] | None = None

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


class AnalysisInput(ContractModel):
    location: LocationInput
    rotation: RotationInput
    time: TimeInput
    water_source: Literal["tadah_hujan", "irigasi"]
    lang: Language = "id"


class HealthResponse(ContractModel):
    status: Literal["ok"] = "ok"
