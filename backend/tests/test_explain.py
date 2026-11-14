import re

import pytest

from app.core.explain import risk_text, selection_notes, strategy_payload
from app.core.feasibility import Risk
from app.core.selector import Selection
from app.schemas import Strategy
from tests.test_rotation_engine import CROPS, START, rain, scored

FORBIDDEN = re.compile(r"prediksi|prakiraan|keuntungan|predict|forecast|profit", re.IGNORECASE)


@pytest.mark.parametrize("lang", ["id", "en"])
def test_payload_matches_the_contract_in_both_languages(lang):
    baseline = scored("baseline", ["padi_sawah", "jagung", "bera:4"])
    item = scored("padi-kedelai", ["padi_sawah", "kedelai"])
    for role, strategy, base in (
        ("pola_biasa", baseline, None),
        ("hemat_air", item, baseline),
        ("jaga_tanah", item, baseline),
    ):
        payload = strategy_payload(
            role,
            strategy,
            baseline=base,
            crops=CROPS,
            start_month=START,
            water_source="tadah_hujan",
            lang=lang,
        )
        Strategy.model_validate(payload)
        text = " ".join(payload["reasons"] + payload["tradeoffs"] + payload["dimensions"]["risks"])
        assert not FORBIDDEN.search(text)


def test_every_reason_carries_a_number():
    baseline = scored("baseline", ["padi_sawah", "jagung", "bera:4"])
    item = scored("padi-kedelai", ["padi_sawah", "kedelai"])
    payload = strategy_payload(
        "hemat_air", item, baseline=baseline, crops=CROPS,
        start_month=START, water_source="tadah_hujan", lang="id",
    )
    assert payload["reasons"]
    assert all(re.search(r"\d", line) for line in payload["reasons"] + payload["tradeoffs"])
    assert any("dari 4 menjadi 0 bulan" in line for line in payload["reasons"])


def test_failed_usual_pattern_explains_the_rain_count():
    baseline = scored("baseline", ["padi_sawah", "jagung", "bera:4"], monthly=rain(20))
    payload = strategy_payload(
        "pola_biasa", baseline, baseline=None, crops=CROPS,
        start_month=START, water_source="tadah_hujan", lang="id",
    )
    assert payload["id"] == "baseline"
    assert payload["feasibility"] == {"passed": False, "failed_rules": ["K5"]}
    assert payload["reasons"][0].startswith("Pada data 10 tahun, hujan untuk Padi sawah mencukupi hanya di 0 dari 9")


def test_irrigation_reasons_say_rain_alone_and_depends_on_irrigation():
    item = scored("padi-kedelai", ["padi_sawah", "kedelai"], water="irigasi")
    payload = strategy_payload(
        "hemat_air", item, baseline=None, crops=CROPS,
        start_month=START, water_source="irigasi", lang="en",
    )
    assert any("rain alone" in line and "irrigation" in line for line in payload["reasons"])


@pytest.mark.parametrize(
    "risk",
    [
        Risk("soil_unavailable"),
        Risk("irrigation_assumed"),
        Risk("water_unknown", "orok_orok"),
        Risk("water_proxy", "kacang_hijau"),
        Risk("water_unassessed", "jagung"),
        Risk("continues_after_horizon", "padi_sawah", (("end", "2027-12"),)),
        Risk("near_temperature", "jagung", (("month", 7),)),
        Risk("near_water", "jagung", (("met", 6), ("total", 9))),
        Risk("paddy_outside_wet", "padi_sawah", (("wet", 1), ("months", 4), ("start", "2027-03"))),
        Risk("data_limited", None, (("month", 2),)),
    ],
)
def test_every_risk_code_has_both_languages(risk):
    assert risk_text(risk, CROPS, "id")
    assert risk_text(risk, CROPS, "en")


def test_selection_notes_cover_no_pattern_fewer_and_none():
    none = Selection(alternatives=(), wanted=2, feasible=0, common_failures=(("K5", 8),))
    assert "Coba ubah bulan mulai" in selection_notes(none, has_pattern=True, lang="id")[0]
    assert "kecukupan hujan" in selection_notes(none, has_pattern=True, lang="id")[0]
    one = Selection(alternatives=(("hemat_air", object()),), wanted=3, feasible=1, common_failures=())
    notes = selection_notes(one, has_pattern=False, lang="en")
    assert notes[0].startswith("There is no usual pattern")
    assert "only 1 other option meets" in notes[1]


def test_paddy_outside_wet_months_is_explained_instead_of_rain():
    from tests.test_rotation_engine import profile

    baseline = scored("baseline", ["padi_sawah", "padi_sawah", "bera:4"], prof=profile())
    assert baseline.evaluation.failed_rules == ("K5",)
    payload = strategy_payload(
        "pola_biasa", baseline, baseline=None, crops=CROPS,
        start_month=START, water_source="tadah_hujan", lang="id",
    )
    assert payload["reasons"][0] == "Padi sawah mulai Mar 2027 hanya punya 1 dari 4 bulan basah."


def test_open_land_and_failure_reasons_are_not_repeated():
    from tests.test_rotation_engine import profile

    baseline = scored("baseline", ["padi_sawah", "padi_sawah", "bera:4"], prof=profile())
    payload = strategy_payload(
        "pola_biasa", baseline, baseline=None, crops=CROPS,
        start_month=START, water_source="tadah_hujan", lang="id",
    )
    assert not set(payload["reasons"]) & set(payload["dimensions"]["risks"])
    more_bare = scored("bera-lebih", ["padi_sawah", "kacang_hijau", "bera:6"])
    payload = strategy_payload(
        "jaga_tanah", more_bare, baseline=scored("b", ["padi_sawah", "jagung", "bera:4"]),
        crops=CROPS, start_month=START, water_source="tadah_hujan", lang="id",
    )
    open_land = [t for t in payload["tradeoffs"] if "lahan terbuka" in t.lower()]
    assert len(open_land) == 1
