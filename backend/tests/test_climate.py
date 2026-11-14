"""PRD 9 known-answer aggregation, quality boundaries, and genuine year windows."""

from copy import deepcopy
from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from app.core.climate import (
    ClimateInputError,
    VARIABLE_UNITS,
    aggregate_daily,
    seasonal_profile,
    oldeman_month,
    historical_windows,
    climate_statistics,
)
from app.schemas import ClimateContext
from app.services.climate import ClimateService


@pytest.fixture(autouse=True)
def fixed_reference_year(monkeypatch):
    monkeypatch.setattr("app.services.climate.last_complete_year", lambda: 2025)


def daily_fixture(start_year=2016, end_year=2025):
    defaults = {
        "PRECTOTCORR": 1.0,
        "T2M": 26.0,
        "T2M_MIN": 20.0,
        "T2M_MAX": 32.0,
        "ALLSKY_SFC_SW_DWN": 15.0,
        "RH2M": 80.0,
    }
    variables = {
        key: {"unit": unit, "daily": {}} for key, unit in VARIABLE_UNITS.items()
    }
    day = date(start_year, 1, 1)
    while day <= date(end_year, 12, 31):
        for variable in variables:
            variables[variable]["daily"][day.isoformat()] = defaults[variable]
        day += timedelta(days=1)
    return {
        "period": f"{start_year}-01-01/{end_year}-12-31",
        "variables": variables,
        "source": "NASA POWER",
        "time_standard": "LST",
        "source_files": {},
        "method": "test-spatial-method",
        "location": {
            "type": "Polygon",
            "coordinates": [
                [[110.9, -7.1], [110.92, -7.1], [110.92, -7.08], [110.9, -7.1]]
            ],
        },
        "rain_validation": {"status": "unvalidated", "reference": None},
    }


def test_rain_sums_temperature_radiation_and_humidity_means():
    data = daily_fixture(2024, 2024)
    data["variables"]["PRECTOTCORR"]["daily"]["2024-01-01"] = 0
    data["variables"]["T2M"]["daily"]["2024-01-01"] = 57
    rows = aggregate_daily(data["variables"], data["period"])
    january, february = rows[:2]
    assert january.values["PRECTOTCORR"] == 30
    assert january.values["T2M"] == pytest.approx(27)
    assert january.values["ALLSKY_SFC_SW_DWN"] == 15
    assert january.values["RH2M"] == 80
    assert february.values["PRECTOTCORR"] == 29  # Actual leap year.
    assert all(count == 0 for count in february.missing_days.values())


@pytest.mark.parametrize("missing,valid", [(0, True), (3, True), (4, False)])
def test_three_missing_days_are_allowed_four_are_excluded(missing, valid):
    data = daily_fixture(2025, 2025)
    for day in range(1, missing + 1):
        data["variables"]["PRECTOTCORR"]["daily"].pop(f"2025-01-{day:02d}")
    row = aggregate_daily(data["variables"], data["period"])[0]
    assert row.valid == valid
    assert row.missing_days["PRECTOTCORR"] == missing
    assert row.values["PRECTOTCORR"] == (31 - missing if valid else None)


def test_missing_leap_day_counts_and_nan_is_not_zero():
    data = daily_fixture(2024, 2024)
    data["variables"]["PRECTOTCORR"]["daily"].pop("2024-02-29")
    data["variables"]["PRECTOTCORR"]["daily"]["2024-02-28"] = float("nan")
    feb = aggregate_daily(data["variables"], data["period"])[1]
    assert feb.missing_days["PRECTOTCORR"] == 2
    assert feb.values["PRECTOTCORR"] == 27


@pytest.mark.parametrize(
    "rain,expected",
    [
        (None, None),
        (0, "kering"),
        (99.99, "kering"),
        (100, "lembap"),
        (150, "lembap"),
        (200, "lembap"),
        (200.01, "basah"),
    ],
)
def test_oldeman_boundaries_follow_prd(rain, expected):
    assert oldeman_month(rain) == expected


def test_seasonal_median_and_envelopes_from_actual_yearly_values():
    data = daily_fixture()
    for variable, series in data["variables"].items():
        for day in series["daily"]:
            offset = int(day[:4]) - 2016
            if variable == "PRECTOTCORR":
                series["daily"][day] = offset + 1
            elif variable == "T2M":
                series["daily"][day] = 20 + offset
            elif variable == "T2M_MIN":
                series["daily"][day] = 10 + offset
            elif variable == "T2M_MAX":
                series["daily"][day] = 30 + offset
    rows = aggregate_daily(data["variables"], data["period"])
    profile, quality = seasonal_profile(rows)
    january = profile[0]
    assert january["rain_median_mm"] == 170.5
    assert january["rain_min_mm"] == 31
    assert january["rain_max_mm"] == 310
    assert january["t_mean_c"] == 24.5
    assert january["t_min_c"] == 10
    assert january["t_max_c"] == 39
    assert january["n_years"] == 10 and january["class"] == "lembap"
    assert not quality[0]["data_limited"]
    ClimateContext.model_validate({"period": data["period"], "monthly": profile})


@pytest.mark.parametrize("excluded,limited", [(2, False), (3, True), (10, True)])
def test_eight_year_boundary_and_no_data_profile(excluded, limited):
    data = daily_fixture()
    for year in range(2016, 2016 + excluded):
        for day in range(1, 5):
            data["variables"]["PRECTOTCORR"]["daily"][f"{year}-01-{day:02d}"] = None
    result = climate_statistics(data, "2026-11", 12)
    row = result["climate"]["monthly"][0]
    assert row["n_years"] == 10 - excluded
    assert result["quality"][0]["data_limited"] == limited
    if excluded == 10:
        assert row["rain_median_mm"] is None and row["class"] is None
        assert row["t_mean_c"] is None
        assert all(
            row[key] is None for key in ["rad", "rh_pct", "rain_min_mm", "rain_max_mm"]
        )
    assert result["notes"]


def test_shared_year_mask_makes_single_n_years_truthful():
    data = daily_fixture()
    for day in range(1, 5):
        data["variables"]["RH2M"]["daily"][f"2025-01-{day:02d}"] = None
    records = aggregate_daily(data["variables"], data["period"])
    january_2025 = next(row for row in records if row.key == "2025-01")
    assert january_2025.values["PRECTOTCORR"] == 31  # Per-variable audit retained.
    assert not january_2025.valid
    profile, quality = seasonal_profile(records)
    assert profile[0]["n_years"] == 9
    assert quality[0]["excluded_years"][0]["year"] == 2025


@pytest.mark.parametrize("horizon,count", [(6, 9), (12, 9), (18, 8), (24, 8)])
def test_november_windows_match_prd_examples(horizon, count):
    data = daily_fixture()
    records = aggregate_daily(data["variables"], data["period"])
    windows = historical_windows(records, "2026-11", horizon)
    assert len(windows) == count
    assert windows[0].start == "2016-11"
    assert windows[0].months[1].key == "2016-12"
    assert windows[0].months[2].key == "2017-01"
    assert all(len(window.months) == horizon for window in windows)
    if horizon == 12:
        assert windows[0].end == "2017-10" and windows[-1].end == "2025-10"
    if horizon == 24:
        assert windows[-1].start == "2023-11" and windows[-1].end == "2025-10"


@pytest.mark.parametrize("horizon,count", [(6, 10), (12, 10), (18, 9), (24, 9)])
def test_january_windows_have_different_calendar_counts(horizon, count):
    data = daily_fixture()
    records = aggregate_daily(data["variables"], data["period"])
    assert len(historical_windows(records, "2026-01", horizon)) == count


def test_windows_preserve_observed_years_not_monthly_medians():
    data = daily_fixture()
    data["variables"]["PRECTOTCORR"]["daily"]["2017-01-01"] = 1001
    result = climate_statistics(data, "2026-11", 12)
    first = result["historical_windows"][0]
    assert first["months"][2]["month"] == "2017-01"
    assert first["months"][2]["values"]["PRECTOTCORR"] == 1031
    assert result["climate"]["monthly"][0]["rain_median_mm"] == 31


def test_bad_month_invalidates_window_without_dropping_or_reordering_months():
    data = daily_fixture()
    for day in range(1, 5):
        data["variables"]["PRECTOTCORR"]["daily"][f"2017-07-{day:02d}"] = None
    result = climate_statistics(data, "2026-11", 12)
    assert result["window_summary"] == {"available": 9, "valid": 8, "invalid": 1}
    assert result["historical_windows"][0]["invalid_months"] == ["2017-07"]
    assert result["historical_windows"][1]["valid"]
    assert len(result["historical_windows"][0]["months"]) == 12


@pytest.mark.parametrize(
    "mutation",
    ["unit", "missing_variable", "outside_period", "non_numeric", "partial_year"],
)
def test_invalid_source_data_rejected(mutation):
    data = daily_fixture(2025, 2025)
    if mutation == "unit":
        data["variables"]["PRECTOTCORR"]["unit"] = "mm/year"
    elif mutation == "missing_variable":
        data["variables"].pop("T2M")
    elif mutation == "outside_period":
        data["variables"]["T2M"]["daily"]["2026-01-01"] = 25
    elif mutation == "non_numeric":
        data["variables"]["T2M"]["daily"]["2025-01-01"] = "25"
    else:
        data["period"] = "2025-02-01/2025-12-31"
    with pytest.raises(ClimateInputError):
        aggregate_daily(data["variables"], data["period"])


def test_no_mutation_and_structural_missing_month_is_rejected():
    data = daily_fixture(2025, 2025)
    before = deepcopy(data)
    records = aggregate_daily(data["variables"], data["period"])
    historical_windows(records, "2026-01", 12)
    assert data == before
    with pytest.raises(ClimateInputError):
        historical_windows([row for row in records if row.month != 7], "2026-01", 12)


def test_service_rejects_bad_request_before_reading_or_downloading(tmp_path):
    def forbidden(*args, **kwargs):
        raise AssertionError("Source must not be called")

    power = SimpleNamespace(
        archive=SimpleNamespace(root=tmp_path), for_polygon=forbidden
    )
    with pytest.raises(ClimateInputError):
        ClimateService(power).for_polygon({}, start_month="2026-13")
    with pytest.raises(ClimateInputError):
        ClimateService(power).for_polygon(
            {}, start_month="2026-11", horizon_months=12.0
        )
    with pytest.raises(ClimateInputError):
        ClimateService(power).for_polygon({}, start_month="2026-11", lang="xx")


def test_service_preserves_contract_provenance_and_unvalidated_rain(tmp_path):
    data = daily_fixture()
    calls = []

    def fetch(location, **kwargs):
        calls.append(kwargs)
        return data

    power = SimpleNamespace(archive=SimpleNamespace(root=tmp_path), for_polygon=fetch)
    result = ClimateService(power).for_polygon(
        data["location"], start_month="2026-11", lang="en"
    )
    ClimateContext.model_validate(result["climate"])
    assert calls == [{"allow_network": False}]
    assert result["provenance"]["rain_validation"]["status"] == "unvalidated"
    assert any("not been validated" in note for note in result["notes"])
    assert result["window_summary"]["valid"] == 9
    assert len(list((tmp_path / "results").glob("climate-*.json"))) == 1


def test_derived_cache_reuses_result_and_invalidates_on_source_or_result_change(
    tmp_path,
):
    import hashlib
    import json

    data = daily_fixture()
    source = tmp_path / "raw" / "source.nc"
    source.parent.mkdir()
    source.write_bytes(b"source-version-1")
    calls = []

    def fetch(location, **kwargs):
        calls.append(kwargs)
        data["source_files"] = {
            source.name: {
                "bytes": source.stat().st_size,
                "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            }
        }
        return data

    power = SimpleNamespace(archive=SimpleNamespace(root=tmp_path), for_polygon=fetch)
    service = ClimateService(power)
    first = service.for_polygon(data["location"], start_month="2026-11")
    second = service.for_polygon(data["location"], start_month="2026-11")
    assert not first["provenance"]["cache_hit"] and second["provenance"]["cache_hit"]
    assert len(calls) == 1
    source.write_bytes(b"source-version-2")
    assert not service.for_polygon(data["location"], start_month="2026-11")[
        "provenance"
    ]["cache_hit"]
    assert len(calls) == 2
    cache = next((tmp_path / "results").glob("climate-*.json"))
    envelope = json.loads(cache.read_text())
    envelope["result"]["climate"]["monthly"][0]["rain_median_mm"] = 9999
    cache.write_text(json.dumps(envelope))
    third = service.for_polygon(data["location"], start_month="2026-11")
    assert third["climate"]["monthly"][0]["rain_median_mm"] == 31
    assert len(calls) == 3
    service.for_polygon(data["location"], start_month="2026-11", horizon_months=24)
    assert len(calls) == 4
