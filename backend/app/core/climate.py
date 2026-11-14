"""PRD 9: deterministic monthly climate and contiguous historical windows.

Pure functions only: no provider calls, filesystem, system clock, crop rules,
or mixing independently chosen monthly quantiles into hypothetical years.
"""

from __future__ import annotations

import calendar
import math
from dataclasses import dataclass
from datetime import date
from statistics import mean, median

VARIABLE_UNITS = {
    "PRECTOTCORR": "mm/day",
    "T2M": "C",
    "T2M_MIN": "C",
    "T2M_MAX": "C",
    "ALLSKY_SFC_SW_DWN": "MJ/m^2/day",
    "RH2M": "%",
}
MAX_MISSING_DAYS = 3
MIN_PROFILE_YEARS = 8


class ClimateInputError(ValueError):
    pass


@dataclass(frozen=True)
class MonthlyAggregate:
    year: int
    month: int
    values: dict[str, float | None]
    missing_days: dict[str, int]

    @property
    def key(self):
        return f"{self.year:04d}-{self.month:02d}"

    @property
    def valid(self):
        # The public monthly contract has one n_years. Use the common set of
        # valid years for all six variables, preserving per-variable audits.
        return all(value is not None for value in self.values.values())

    def to_dict(self):
        return {
            "month": self.key,
            "valid": self.valid,
            "values": self.values,
            "missing_days": self.missing_days,
        }


@dataclass(frozen=True)
class HistoricalWindow:
    start: str
    end: str
    months: tuple[MonthlyAggregate, ...]

    @property
    def valid(self):
        return all(month.valid for month in self.months)

    @property
    def invalid_months(self):
        return [month.key for month in self.months if not month.valid]

    def to_dict(self):
        return {
            "start": self.start,
            "end": self.end,
            "valid": self.valid,
            "invalid_months": self.invalid_months,
            "months": [month.to_dict() for month in self.months],
        }


def _observed(value, variable):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ClimateInputError("Daily values must be numeric or null")
    value = float(value)
    if not math.isfinite(value) or value == -999:
        return None
    if variable in ("PRECTOTCORR", "ALLSKY_SFC_SW_DWN") and value < 0:
        return None
    if variable == "RH2M" and not 0 <= value <= 100:
        return None
    return value


def aggregate_daily(variables, period):
    """Monthly observed rain sums and daily means, with per-variable quality.

    Missing date keys count as missing days, including leap days. At most three
    missing days are accepted without imputation, scaling, or zero-filling.
    """
    try:
        start_text, end_text = period.split("/")
        start, end = date.fromisoformat(start_text), date.fromisoformat(end_text)
    except (ValueError, TypeError, AttributeError) as exc:
        raise ClimateInputError("Invalid reference period") from exc
    if (
        start > end
        or (start.month, start.day) != (1, 1)
        or (end.month, end.day) != (12, 31)
    ):
        raise ClimateInputError("Reference period must contain full calendar years")
    for variable, unit in VARIABLE_UNITS.items():
        try:
            series = variables[variable]
            if series["unit"] != unit or not isinstance(series["daily"], dict):
                raise ClimateInputError(f"Invalid daily series/unit for {variable}")
            for key in series["daily"]:
                day = date.fromisoformat(key)
                if day.isoformat() != key or not start <= day <= end:
                    raise ClimateInputError(
                        "Daily dates must belong to the declared period"
                    )
        except (KeyError, TypeError, ValueError) as exc:
            raise ClimateInputError(
                f"Invalid daily series for {variable}: {exc}"
            ) from exc
    records = []
    for year in range(start.year, end.year + 1):
        for month in range(1, 13):
            values, missing = {}, {}
            for variable in VARIABLE_UNITS:
                daily = variables[variable]["daily"]
                observed = [
                    _observed(daily.get(date(year, month, day).isoformat()), variable)
                    for day in range(1, calendar.monthrange(year, month)[1] + 1)
                ]
                available = [value for value in observed if value is not None]
                missing[variable] = len(observed) - len(available)
                if missing[variable] > MAX_MISSING_DAYS or not available:
                    values[variable] = None
                elif variable == "PRECTOTCORR":
                    values[variable] = math.fsum(available)
                else:
                    values[variable] = mean(available)
            records.append(MonthlyAggregate(year, month, values, missing))
    return records


def oldeman_month(rain_mm):
    """PRD boundary convention: 100 and 200 mm are both lembap."""
    if rain_mm is None:
        return None
    if (
        isinstance(rain_mm, bool)
        or not isinstance(rain_mm, (int, float))
        or not math.isfinite(rain_mm)
        or rain_mm < 0
    ):
        raise ClimateInputError("Rainfall must be finite and nonnegative")
    return "basah" if rain_mm > 200 else ("lembap" if rain_mm >= 100 else "kering")


def seasonal_profile(records):
    if not records:
        raise ClimateInputError("No monthly records")
    months, quality = [], []
    for calendar_month in range(1, 13):
        selected = [record for record in records if record.month == calendar_month]
        valid = [record for record in selected if record.valid]
        row = {
            "month": calendar_month,
            "rain_median_mm": None,
            "rain_min_mm": None,
            "rain_max_mm": None,
            "class": None,
            "t_mean_c": None,
            "t_min_c": None,
            "t_max_c": None,
            "rad": None,
            "rh_pct": None,
            "n_years": len(valid),
        }
        if valid:
            rain = [record.values["PRECTOTCORR"] for record in valid]
            row.update(
                rain_median_mm=median(rain),
                rain_min_mm=min(rain),
                rain_max_mm=max(rain),
                t_mean_c=median(record.values["T2M"] for record in valid),
                t_min_c=min(record.values["T2M_MIN"] for record in valid),
                t_max_c=max(record.values["T2M_MAX"] for record in valid),
                rad=median(record.values["ALLSKY_SFC_SW_DWN"] for record in valid),
                rh_pct=median(record.values["RH2M"] for record in valid),
            )
            row["class"] = oldeman_month(row["rain_median_mm"])
        months.append(row)
        quality.append(
            {
                "month": calendar_month,
                "data_limited": len(valid) < MIN_PROFILE_YEARS,
                "valid_years": [record.year for record in valid],
                "excluded_years": [
                    {"year": record.year, "missing_days": record.missing_days}
                    for record in selected
                    if not record.valid
                ],
            }
        )
    return months, quality


def validate_window_request(start_month, horizon_months):
    try:
        selected = date.fromisoformat(start_month + "-01")
        if selected.strftime("%Y-%m") != start_month:
            raise ValueError("Noncanonical month")
    except (TypeError, ValueError) as exc:
        raise ClimateInputError("start_month must be YYYY-MM") from exc
    if type(horizon_months) is not int or horizon_months not in (6, 12, 18, 24):
        raise ClimateInputError("Unsupported horizon")
    return selected.month


def historical_windows(records, start_month, horizon_months):
    """Map only the selected month-of-year onto genuine contiguous source months."""
    selected_month = validate_window_request(start_month, horizon_months)
    indexed = {record.key: record for record in records}
    if not records or len(indexed) != len(records):
        raise ClimateInputError("Reference monthly records must be nonempty and unique")
    first = min((record.year, record.month) for record in records)
    last = max((record.year, record.month) for record in records)
    windows = []
    for year in range(first[0], last[0] + 1):
        keys = []
        for offset in range(horizon_months):
            ordinal = year * 12 + selected_month - 1 + offset
            y, zero_month = divmod(ordinal, 12)
            keys.append(f"{y:04d}-{zero_month + 1:02d}")
        if (
            keys[0] < f"{first[0]:04d}-{first[1]:02d}"
            or keys[-1] > f"{last[0]:04d}-{last[1]:02d}"
        ):
            continue
        try:
            rows = tuple(indexed[key] for key in keys)
        except KeyError as exc:
            raise ClimateInputError(
                "Missing calendar month; cannot construct a continuous window"
            ) from exc
        windows.append(HistoricalWindow(keys[0], keys[-1], rows))
    return windows


def climate_statistics(daily_result, start_month, horizon_months, lang="id"):
    if lang not in ("id", "en"):
        raise ClimateInputError("Unsupported language")
    validate_window_request(start_month, horizon_months)
    records = aggregate_daily(daily_result["variables"], daily_result["period"])
    profile, quality = seasonal_profile(records)
    windows = historical_windows(records, start_month, horizon_months)
    notes = []
    names = (
        [
            "Januari",
            "Februari",
            "Maret",
            "April",
            "Mei",
            "Juni",
            "Juli",
            "Agustus",
            "September",
            "Oktober",
            "November",
            "Desember",
        ]
        if lang == "id"
        else list(calendar.month_name)[1:]
    )
    for row, audit in zip(profile, quality):
        if audit["data_limited"] or audit["excluded_years"]:
            label = names[row["month"] - 1]
            notes.append(
                (
                    f"Data {label} terbatas: {row['n_years']} tahun sah."
                    if audit["data_limited"]
                    else f"Sebagian tahun {label} dikeluarkan karena data tidak lengkap; dipakai {row['n_years']} tahun sah."
                )
                if lang == "id"
                else (
                    f"Limited {label} data: {row['n_years']} valid years."
                    if audit["data_limited"]
                    else f"Some {label} years were excluded for incomplete data; {row['n_years']} valid years remain."
                )
            )
    if any(record.valid and any(record.missing_days.values()) for record in records):
        notes.append(
            "Sebagian agregat bulanan memiliki 1-3 hari hilang; nilai dihitung dari observasi yang tersedia tanpa imputasi."
            if lang == "id"
            else "Some monthly aggregates have 1-3 missing days; values use available observations without imputation."
        )
    valid_windows = sum(window.valid for window in windows)
    if valid_windows < len(windows):
        notes.append(
            (
                f"{len(windows) - valid_windows} jendela historis tidak lengkap dan dikeluarkan dari perbandingan."
                if lang == "id"
                else f"{len(windows) - valid_windows} incomplete historical windows are excluded from comparison."
            )
        )
    if valid_windows == 0:
        notes.append(
            "Tidak ada jendela historis sah untuk horizon ini."
            if lang == "id"
            else "No valid historical windows are available for this horizon."
        )
    return {
        "climate": {"period": daily_result["period"], "monthly": profile},
        "monthly_by_year": [record.to_dict() for record in records],
        "quality": quality,
        "historical_windows": [window.to_dict() for window in windows],
        "window_summary": {
            "available": len(windows),
            "valid": valid_windows,
            "invalid": len(windows) - valid_windows,
        },
        "notes": notes,
    }
