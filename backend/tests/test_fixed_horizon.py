"""Examples shown on the input form must match the actual decision calendar."""
from app.catalog import load_catalog
from app.core.rotation import build_calendar
from app.schemas import RotationStage


def test_six_month_analysis_of_six_four_month_crops_uses_only_two_stages():
    crops = {crop.crop_id: crop for crop in load_catalog().crops}
    stages = [RotationStage(crop_id="jagung") for _ in range(6)]
    plan = build_calendar(stages, crops, 6)
    assert len(plan) == 2
    assert [(row.start("2027-01"), row.end("2027-01")) for row in plan] == [
        ("2027-01", "2027-04"), ("2027-05", "2027-08")
    ]
    assert plan[-1].continues_after_horizon
    assert plan[-1].months_in_horizon == 2


def test_short_fixed_pattern_repeats_to_fill_the_selected_period():
    crops = {crop.crop_id: crop for crop in load_catalog().crops}
    plan = build_calendar([
        RotationStage(crop_id="padi_sawah"), RotationStage(crop_id="bera", months=2)
    ], crops, 12)
    assert [(row.crop_id, row.length) for row in plan] == [
        ("padi_sawah", 4), ("bera", 2), ("padi_sawah", 4), ("bera", 2)
    ]
    assert plan[-1].end("2027-01") == "2027-12"
