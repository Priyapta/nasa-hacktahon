from types import SimpleNamespace

import pytest

from app.catalog import load_catalog
from app.core.dimensions import measure
from app.core.feasibility import evaluate
from app.core.rotation import add_months, build_calendar, signature
from app.core.selector import Scored, select

CROPS = {crop.crop_id: crop for crop in load_catalog().crops}
WET = {11, 12, 1, 2, 3}
START = "2026-11"
WINDOWS = [f"{year}-11" for year in range(2016, 2025)]


def stages(*items):
    result = []
    for item in items:
        crop_id, _, months = item.partition(":")
        result.append(SimpleNamespace(crop_id=crop_id, months=int(months) if months else None))
    return result


def profile(t=26.0, wet=WET):
    return {
        month: {"t_mean_c": t, "class": "basah" if month in wet else "lembap"}
        for month in range(1, 13)
    }


def rain(mm_per_month=150.0, overrides=None):
    data = {
        f"{year}-{month:02d}": mm_per_month
        for year in range(2016, 2026)
        for month in range(1, 13)
    }
    data.update(overrides or {})
    return data


def run(pattern, *, horizon=12, prof=None, monthly=None, ph=6.0, water="tadah_hujan", limited=()):
    prof = prof or profile()
    plan = build_calendar(stages(*pattern), CROPS, horizon)
    evaluation = evaluate(
        plan,
        start_month=START,
        crops=CROPS,
        profile=prof,
        monthly_rain=monthly if monthly is not None else rain(),
        window_starts=WINDOWS,
        soil_ph=ph,
        water_source=water,
        limited_months=limited,
    )
    dims = measure(plan, evaluation, start_month=START, crops=CROPS, profile=prof)
    return plan, evaluation, dims


def test_calendar_repeats_from_first_stage_and_flags_overflow():
    plan = build_calendar(stages("padi_sawah", "padi_sawah", "bera:4"), CROPS, 18)
    assert [(s.crop_id, s.offset, s.length) for s in plan] == [
        ("padi_sawah", 0, 4),
        ("padi_sawah", 4, 4),
        ("bera", 8, 4),
        ("padi_sawah", 12, 4),
        ("padi_sawah", 16, 4),
    ]
    assert plan[-1].continues_after_horizon
    assert plan[-1].months_in_horizon == 2
    assert not plan[0].continues_after_horizon
    assert plan[0].start(START) == "2026-11"
    assert plan[0].end(START) == "2027-02"
    assert add_months("2026-12", 1) == "2027-01"


def test_known_rain_answer_counts_windows():
    # Paddy needs 450 mm over 4 months. 120 mm/month gives 480 mm in all 9 windows.
    _, evaluation, dims = run(["padi_sawah", "bera:6", "bera:2"], monthly=rain(120))
    assert evaluation.stage_water[0].met == 9
    assert evaluation.stage_water[0].total == 9
    assert evaluation.passed
    assert (dims.years_met, dims.years_total, dims.water_level) == (9, 9, "rendah")

    _, evaluation, dims = run(["padi_sawah", "bera:6", "bera:2"], monthly=rain(100))
    assert evaluation.stage_water[0].met == 0
    assert "K5" in evaluation.failed_rules
    assert dims.water_level == "tinggi"


def test_sixty_percent_boundary():
    # Paddy stage Nov-Feb at 120 mm/month gives 480 mm. Dropping December to 0
    # in the first N windows leaves 360 mm against a 450 mm need.
    def with_dry_windows(count):
        return rain(120, {f"{2016 + i}-12": 0.0 for i in range(count)})

    _, passing, _ = run(["padi_sawah", "bera:6", "bera:2"], monthly=with_dry_windows(3))
    assert (passing.stage_water[0].met, passing.stage_water[0].total) == (6, 9)
    assert passing.passed

    _, failing, _ = run(["padi_sawah", "bera:6", "bera:2"], monthly=with_dry_windows(4))
    assert (failing.stage_water[0].met, failing.stage_water[0].total) == (5, 9)
    assert "K5" in failing.failed_rules


def test_missing_months_leave_the_window_out_instead_of_filling_it():
    _, evaluation, _ = run(
        ["padi_sawah", "bera:6", "bera:2"], monthly=rain(150, {"2018-12": None, "2020-01": None})
    )
    assert evaluation.stage_water[0].total == 7
    assert evaluation.stage_water[0].met == 7


def test_irrigation_never_fails_k5_but_keeps_the_count():
    _, evaluation, _ = run(["padi_sawah", "bera:6", "bera:2"], monthly=rain(50), water="irigasi")
    assert evaluation.passed
    assert "K5" in evaluation.skipped_rules
    assert evaluation.stage_water[0].met == 0
    assert any(risk.code == "irrigation_assumed" for risk in evaluation.risks)


def test_paddy_needs_wet_months_when_rainfed():
    dry_season = profile(wet={1})
    _, rainfed, _ = run(["padi_sawah", "bera:6", "bera:2"], prof=dry_season)
    assert "K5" in rainfed.failed_rules
    assert any(risk.code == "paddy_outside_wet" for risk in rainfed.risks)
    _, irrigated, _ = run(["padi_sawah", "bera:6", "bera:2"], prof=dry_season, water="irigasi")
    assert irrigated.passed
    assert any(risk.code == "paddy_outside_wet" for risk in irrigated.risks)


def test_temperature_rule_and_near_limit_risk():
    _, cold, _ = run(["jagung", "bera:6", "bera:2"], prof=profile(t=9.0))
    assert "K2" in cold.failed_rules
    _, near, _ = run(["jagung", "bera:6", "bera:2"], prof=profile(t=10.5))
    assert "K2" not in near.failed_rules
    assert any(risk.code == "near_temperature" for risk in near.risks)


def test_soil_rule_skips_without_data_and_fails_out_of_range():
    _, missing, _ = run(["padi_sawah", "bera:6", "bera:2"], ph=None)
    assert "K3" in missing.skipped_rules
    assert any(risk.code == "soil_unavailable" for risk in missing.risks)
    _, acid, _ = run(["padi_sawah", "bera:6", "bera:2"], ph=4.0)
    assert "K3" in acid.failed_rules


def test_unknown_water_is_exempt_and_flagged_not_zero():
    _, evaluation, _ = run(["orok_orok", "bera:6", "bera:4"])
    assert evaluation.stage_water == ()
    assert any(risk.code == "water_unknown" for risk in evaluation.risks)
    _, proxy, _ = run(["kacang_hijau", "bera:6", "bera:4"])
    assert any(risk.code == "water_proxy" for risk in proxy.risks)


def test_limited_data_months_become_risks():
    _, evaluation, _ = run(["padi_sawah", "bera:6", "bera:2"], limited=(12,))
    assert any(risk.code == "data_limited" and risk.get("month") == 12 for risk in evaluation.risks)


def test_dimensions_count_bare_months_inside_the_horizon_and_soil_checks():
    _, _, dims = run(["padi_sawah", "kedelai", "bera:6"], horizon=12)
    assert dims.bare_months == 5
    assert dims.legume and not dims.cover_crop
    assert dims.families == 2
    assert dims.soil_checks == 2
    assert dims.has_production
    assert dims.climate_months_total == 7


ALL_WET = profile(wet=set(range(1, 13)))


def scored(identifier, pattern, **kwargs):
    kwargs.setdefault("prof", ALL_WET)
    plan, evaluation, dims = run(pattern, **kwargs)
    return Scored(identifier, plan, evaluation, dims)


def test_selector_picks_distinct_alternatives_and_respects_rules():
    baseline = scored("baseline", ["padi_sawah", "jagung", "bera:4"])
    candidates = [
        scored("same-as-baseline", ["padi_sawah", "jagung", "bera:4"]),
        scored("padi-kedelai", ["padi_sawah", "kedelai"]),
        scored("padi-kacang-hijau-bera", ["padi_sawah", "kacang_hijau", "bera:6"]),
        scored("padi-jagung-padi", ["padi_sawah", "jagung", "padi_sawah"]),
    ]
    selection = select(candidates, baseline)
    roles = {role: item.id for role, item in selection.alternatives}
    assert set(roles) == {"hemat_air", "jaga_tanah"}
    assert "same-as-baseline" not in roles.values()
    assert roles["hemat_air"] != roles["jaga_tanah"]
    assert all(
        item.dimensions.bare_months <= baseline.dimensions.bare_months
        for role, item in selection.alternatives
        if role == "hemat_air"
    )
    jaga = dict(selection.alternatives)["jaga_tanah"]
    assert jaga.dimensions.legume or jaga.dimensions.cover_crop


def test_selector_without_pattern_returns_three_roles():
    candidates = [
        scored("a", ["padi_sawah", "kedelai"]),
        scored("b", ["padi_sawah", "jagung", "kedelai"]),
        scored("c", ["padi_sawah", "jagung", "padi_sawah"]),
    ]
    selection = select(candidates, None)
    assert [role for role, _ in selection.alternatives] == ["hemat_air", "jaga_tanah", "seimbang"]
    assert selection.wanted == 3


def test_selector_reports_fewer_candidates_and_the_most_common_failure():
    dry = rain(20)
    candidates = [
        scored("dry-a", ["padi_sawah", "jagung", "bera:4"], monthly=dry),
        scored("dry-b", ["padi_sawah", "kedelai"], monthly=dry),
        scored("wet", ["padi_sawah", "kacang_hijau", "bera:6"]),
    ]
    selection = select(candidates, None)
    assert selection.feasible == 1
    assert len(selection.alternatives) == 1
    assert selection.common_failures[0] == ("K5", 2)


def test_signature_ignores_months_after_the_horizon():
    short = build_calendar(stages("padi_sawah", "jagung"), CROPS, 6)
    other = build_calendar(stages("padi_sawah", "jagung", "kedelai"), CROPS, 6)
    assert signature(short) == signature(other)


@pytest.mark.parametrize("horizon", [6, 12, 18, 24])
def test_calendar_covers_every_supported_horizon(horizon):
    plan = build_calendar(stages("padi_sawah", "kedelai"), CROPS, horizon)
    assert sum(s.months_in_horizon for s in plan) == horizon
