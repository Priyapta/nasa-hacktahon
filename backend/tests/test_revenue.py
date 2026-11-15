import json
from dataclasses import replace
from decimal import Decimal

import pytest
from app.catalog import load_catalog
from app.core.revenue import estimate_revenue
from app.core.rotation import build_calendar, signature
from app.core.selector import Scored, select
from app.economics import DATA_FILE, field_area_ha, load_revenue_table
from app.schemas import AnalysisInput, RotationStage
from app.services.analysis import AnalysisService
from test_analysis import REQUEST, FakeClimate, FakeSoil
from test_rotation_engine import run


@pytest.fixture(autouse=True)
def clock(monkeypatch):
    monkeypatch.setattr("app.schemas.current_month_index", lambda: 2026 * 12 + 10)


def estimate(ids, horizon=12, area="1"):
    stages = [RotationStage(crop_id=i) for i in ids]
    crops = {c.crop_id: c for c in load_catalog().crops}
    plan = build_calendar(stages, crops, horizon)
    return plan, estimate_revenue(
        plan, load_revenue_table().core(), area_ha=Decimal(area), start_month="2026-11"
    )


def test_source_transcription_units_and_documented_maize_adjustment():
    table = load_revenue_table()
    rows = table.core()
    assert rows["padi_sawah"].price == Decimal("6761.92")
    assert rows["padi_sawah"].yield_kg_ha == 5285
    assert rows["kedelai"].price == 10264
    assert rows["kedelai"].yield_kg_ha == 1596
    assert rows["kacang_hijau"].price == 18211
    assert rows["kacang_hijau"].yield_kg_ha == 1142
    assert rows["jagung"].yield_kg_ha == Decimal(8071) * 72 / 85
    assert any("bukan harga terukur" in text for text in table.assumptions["id"])


def test_only_complete_harvests_count_and_repeat_is_counted_once_per_harvest():
    plan, revenue = estimate(["padi_sawah"], horizon=6)
    assert len(plan) == 2
    assert revenue.harvests == 1
    assert revenue.total == Decimal("35736747.20")
    assert revenue.payload()["gross_idr"] == 35736747
    assert revenue.stages[-1]["reason"] == "after_horizon"
    assert revenue.stages[-1]["gross_idr"] == 0
    _, soy = estimate(["kedelai"], horizon=6, area="0.5")
    assert soy.harvests == 2
    assert soy.total == Decimal(16381344)


def test_cover_crop_has_explicit_no_sales_not_missing_facts_or_profit():
    _, revenue = estimate(["orok_orok"], horizon=6)
    assert revenue.total == 0 and revenue.harvests == 0
    assert {s["reason"] for s in revenue.stages} == {"no_sales"}
    plan, _ = estimate(["kedelai"])
    with pytest.raises(KeyError):
        estimate_revenue(plan, {}, area_ha=Decimal(1), start_month="2026-11")
    with pytest.raises(ValueError):
        estimate_revenue(
            plan,
            load_revenue_table().core(),
            area_ha=Decimal("NaN"),
            start_month="2026-11",
        )


def test_area_handles_clockwise_boundaries_and_holes():
    outer = [[110, -7], [110.02, -7], [110.02, -6.98], [110, -6.98], [110, -7]]
    hole = [
        [110.005, -6.995],
        [110.015, -6.995],
        [110.015, -6.985],
        [110.005, -6.985],
        [110.005, -6.995],
    ]
    whole = field_area_ha({"type": "Polygon", "coordinates": [outer]})
    assert whole > 400
    with_hole = field_area_ha({"type": "Polygon", "coordinates": [outer, hole]})
    assert 0 < with_hole < whole
    assert abs(
        field_area_ha({"type": "Polygon", "coordinates": [list(reversed(outer)), hole]})
        - with_hole
    ) < Decimal("0.000001")


def test_failed_candidate_never_becomes_highest_even_if_its_revenue_is_larger():
    p, evaluation, dims = run(["padi_sawah"], water="irigasi")
    rev = estimate_revenue(
        p, load_revenue_table().core(), area_ha=Decimal(1), start_month="2026-11"
    )
    good = Scored("good", p, evaluation, dims, rev)
    failed = replace(
        good,
        id="failed",
        evaluation=replace(evaluation, failed_rules=("K3",)),
        revenue=replace(rev, per_ha=rev.per_ha * 100),
    )
    selected = select([failed, good], None)
    assert selected.highest_revenue_id == "good"
    assert len({signature(s.plan) for _, s in selected.alternatives}) == len(
        selected.alternatives
    )


def test_highest_is_compared_with_baseline_and_reuses_the_same_card():
    p, evaluation, dims = run(["padi_sawah"], water="irigasi")
    rev = estimate_revenue(
        p, load_revenue_table().core(), area_ha=Decimal(1), start_month="2026-11"
    )
    baseline = Scored("baseline", p, evaluation, dims, rev)
    selected = select([replace(baseline, id="same")], baseline)
    assert selected.highest_revenue_id == "baseline"
    assert not selected.alternatives


def test_local_reference_rejects_missing_crop_bad_source_and_wrong_year(tmp_path):
    for mutation in ["missing", "source", "year"]:
        data = json.loads(DATA_FILE.read_text())
        if mutation == "missing":
            data["crops"].pop()
        elif mutation == "source":
            data["crops"][0]["sources"] = ["unknown"]
        else:
            data["reference_year"] = 2024
        target = tmp_path / (mutation + ".json")
        target.write_text(json.dumps(data))
        with pytest.raises(ValueError):
            load_revenue_table(target)


def test_analysis_publishes_arithmetic_provenance_and_only_feasible_highest():
    service = AnalysisService(
        climate=FakeClimate(), soil=FakeSoil(), allow_network=False
    )
    result = service.analyze(AnalysisInput.model_validate(REQUEST))
    assert len(result.strategies) <= 4
    assert result.provenance.economics.reference_year == 2023
    assert result.provenance.economics.scope == "Indonesia"
    assert len(result.provenance.economics.references) == 6
    assert all(s.revenue is not None for s in result.strategies)
    highest = [s for s in result.strategies if s.revenue.is_highest]
    assert len(highest) == 1 and highest[0].feasibility.passed
    for strategy in result.strategies:
        assert abs(
            sum(row.gross_idr for row in strategy.revenue.stages)
            - strategy.revenue.gross_idr
        ) <= len(strategy.calendar)
    english = service.analyze(AnalysisInput.model_validate({**REQUEST, "lang": "en"}))
    assert all(
        "Harga dan produktivitas" not in s
        for s in english.provenance.economics.assumptions
    )


def test_a_new_global_revenue_winner_is_added_without_displacing_other_roles():
    def scored(name, pattern):
        p, evaluation, dims = run(pattern, water="irigasi")
        revenue = estimate_revenue(
            p, load_revenue_table().core(), area_ha=Decimal(1), start_month="2026-11"
        )
        return Scored(name, p, evaluation, dims, revenue)

    baseline = scored("baseline", ["padi_sawah", "bera:1"])
    water = scored("water", ["padi_sawah"])
    soil = scored("soil", ["kedelai"])
    winner = scored("revenue", ["jagung", "bera:6"])
    # Isolate the selector from source values: this candidate has the greatest
    # revenue but cannot be Water-saving (more fallow) or Soil-care (no legumes).
    winner = replace(
        winner,
        revenue=replace(
            winner.revenue, per_ha=Decimal(999999999), total=Decimal(999999999)
        ),
    )
    result = select([water, soil, winner], baseline)
    assert result.highest_revenue_id == "revenue"
    assert [role for role, _ in result.alternatives] == [
        "hemat_air",
        "jaga_tanah",
        "omzet_tertinggi",
    ]
    assert result.wanted == 3


def test_no_sales_patterns_do_not_receive_a_highest_revenue_badge():
    p, evaluation, dims = run(["orok_orok"], water="irigasi")
    revenue = estimate_revenue(
        p, load_revenue_table().core(), area_ha=Decimal(1), start_month="2026-11"
    )
    result = select([Scored("green", p, evaluation, dims, revenue)], None)
    assert result.highest_revenue_id is None
