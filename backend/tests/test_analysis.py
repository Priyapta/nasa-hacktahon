import json
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas import AnalysisInput, AnalysisResponse
from app.services.analysis import AnalysisService, ClimateUnavailable
from app.services.power_archive import ProviderUnavailable

ROOT = Path(__file__).resolve().parents[1]
REQUEST = json.loads((ROOT / "contracts/fixtures/analyze_request.json").read_text())
WET = {11, 12, 1, 2, 3}


@pytest.fixture(autouse=True)
def november_2026(monkeypatch):
    monkeypatch.setattr("app.schemas.current_month_index", lambda: 2026 * 12 + 10)
    monkeypatch.setattr("app.services.climate.last_complete_year", lambda: 2025)


def climate_result(rain_mm=150.0, lang="id"):
    monthly = [
        {
            "month": m,
            "rain_median_mm": rain_mm,
            "rain_min_mm": rain_mm,
            "rain_max_mm": rain_mm,
            "class": "basah" if m in WET else "lembap",
            "t_mean_c": 26.5,
            "t_min_c": 23.0,
            "t_max_c": 31.0,
            "rad": 17.0,
            "rh_pct": 82.0,
            "n_years": 10,
        }
        for m in range(1, 13)
    ]
    by_year = [
        {
            "month": f"{y}-{m:02d}",
            "valid": True,
            "values": {"PRECTOTCORR": rain_mm},
            "missing_days": {"PRECTOTCORR": 0},
        }
        for y in range(2016, 2026)
        for m in range(1, 13)
    ]
    return {
        "climate": {"period": "2016-01-01/2025-12-31", "monthly": monthly},
        "monthly_by_year": by_year,
        "quality": [{"month": m, "data_limited": False} for m in range(1, 13)],
        "historical_windows": [{"start": f"{y}-11"} for y in range(2016, 2025)],
        "notes": ["Hujan belum divalidasi terhadap dataset pembanding."],
        "assumptions": ["Estimasi berbasis pola historis, bukan prediksi."],
        "provenance": {
            "source": "NASA POWER",
            "computed_at": "2026-11-14T08:00:00+00:00",
            "rain_validation": {"status": "unvalidated", "reference": None},
            "source_files": {
                "PRECTOTCORR_2016.nc": {
                    "grid_spacing_degrees": {"lat": 0.5, "lon": 0.625},
                    "fetched_at": "2026-11-14T07:53:12+00:00",
                }
            },
        },
    }


class FakeClimate:
    def __init__(self, rain_mm=150.0, fail=False):
        self.rain_mm, self.fail = rain_mm, fail

    def for_polygon(self, location, **kwargs):
        if self.fail:
            raise ProviderUnavailable("no cache")
        return climate_result(self.rain_mm, kwargs["lang"])


class FakeSoil:
    def __init__(self, ph=6.0):
        self.ph = ph

    def for_polygon(self, location, **kwargs):
        if self.ph is None:
            return {
                "soil": {"status": "unavailable", "depth": "0-30cm", "texture_class": None,
                         "ph": None, "soc_g_per_kg": None, "uncertainty": {}},
                "notes": ["Data tanah tidak tersedia. K3 dilewati."],
                "provenance": {"source": "SoilGrids 2.0", "fetched_at": None, "resolution": "250 m"},
            }
        return {
            "soil": {"status": "ok", "depth": "0-30cm", "texture_class": "clay loam",
                     "ph": self.ph, "soc_g_per_kg": 20.0, "uncertainty": {}},
            "notes": [],
            "provenance": {"source": "SoilGrids 2.0", "fetched_at": "2026-11-14T09:00:00+00:00",
                           "resolution": "250 m"},
        }


def client_with(service):
    app = create_app()
    app.state.analysis = service
    return TestClient(app)


def test_analyze_returns_contract_with_usual_pattern_first():
    service = AnalysisService(climate=FakeClimate(), soil=FakeSoil(), allow_network=False)
    with client_with(service) as client:
        response = client.post("/api/v1/analyze", json=REQUEST)
    assert response.status_code == 200
    body = response.json()
    AnalysisResponse.model_validate(body)
    roles = [s["role"] for s in body["strategies"]]
    assert roles[0] == "pola_biasa"
    assert body["strategies"][0]["id"] == "baseline"
    assert set(roles[1:]) <= {"hemat_air", "jaga_tanah"}
    starts = {s["calendar"][0]["start"] for s in body["strategies"]}
    assert starts == {"2026-11"}
    assert body["provenance"]["climate"]["fetched_at"] == "2026-11-14T07:53:12+00:00"
    assert "50 km" in body["provenance"]["climate"]["resolution"]
    assert body["provenance"]["crop_table_version"]
    assert body["context"]["climate"]["monthly"][0]["class"] == "basah"


def test_no_pattern_returns_alternatives_and_explains_the_missing_baseline():
    request = deepcopy(REQUEST)
    request["rotation"] = {"has_pattern": False, "stages": []}
    service = AnalysisService(climate=FakeClimate(), soil=FakeSoil(), allow_network=False)
    result = service.analyze(AnalysisInput.model_validate(request))
    assert all(s.role != "pola_biasa" for s in result.strategies)
    assert any(n.startswith("Belum ada pola") for n in result.notes)


def test_soil_unavailable_is_partial_not_an_error():
    service = AnalysisService(climate=FakeClimate(), soil=FakeSoil(ph=None), allow_network=False)
    result = service.analyze(AnalysisInput.model_validate(REQUEST))
    assert result.context.soil.status == "unavailable"
    assert any("tanah" in n.lower() for n in result.notes)
    baseline = result.strategies[0]
    assert "K3" not in baseline.feasibility.failed_rules
    assert any("pH" in risk for risk in baseline.dimensions.risks)


def test_climate_without_cache_is_502_with_detail(caplog):
    service = AnalysisService(climate=FakeClimate(fail=True), soil=FakeSoil(), allow_network=False)
    with client_with(service) as client:
        response = client.post("/api/v1/analyze", json=REQUEST)
    assert response.status_code == 502
    assert "Climate analysis failed:" in caplog.text
    assert caplog.records[-1].exc_info is not None
    assert response.json() == {
        "detail": [{"loc": [], "msg": "Data iklim belum bisa diambil. Coba lagi sebentar."}]
    }
    with pytest.raises(ClimateUnavailable):
        service.analyze(AnalysisInput.model_validate({**REQUEST, "lang": "en"}))


def test_outside_demo_region_warns_but_still_analyzes():
    far = deepcopy(REQUEST)
    far["location"]["coordinates"] = [[[100.0, -1.0], [100.01, -1.0], [100.01, -0.99], [100.0, -0.99], [100.0, -1.0]]]
    service = AnalysisService(climate=FakeClimate(), soil=FakeSoil(), allow_network=False)
    result = service.analyze(AnalysisInput.model_validate(far))
    assert any("Grobogan" in n for n in result.notes)
    assert result.strategies


def test_english_request_returns_english_labels_and_text():
    service = AnalysisService(climate=FakeClimate(), soil=FakeSoil(), allow_network=False)
    result = service.analyze(AnalysisInput.model_validate({**REQUEST, "lang": "en"}))
    assert result.strategies[0].label == "Your usual pattern"
    assert all("Hujan dianggap" not in a for a in result.provenance.assumptions)


def test_invalid_request_is_400():
    bad = deepcopy(REQUEST)
    bad["time"]["horizon_months"] = 9
    service = AnalysisService(climate=FakeClimate(), soil=FakeSoil(), allow_network=False)
    with client_with(service) as client:
        assert client.post("/api/v1/analyze", json=bad).status_code == 400


POWER_CACHE = ROOT / "data/power/raw"
real_data = pytest.mark.skipif(
    not POWER_CACHE.exists() or not any(POWER_CACHE.rglob("*.nc")),
    reason="NASA POWER archive not extracted; see cache-archives/README.md",
)


def real_service():
    return AnalysisService(allow_network=False)


def real_request(**changes):
    request = deepcopy(REQUEST)
    request["rotation"] = {
        "has_pattern": True,
        "stages": [{"crop_id": "padi_sawah"}, {"crop_id": "padi_sawah"}, {"crop_id": "bera", "months": 4}],
    }
    for key, value in changes.items():
        request[key] = value
    return AnalysisInput.model_validate(request)


def summary(result):
    return [
        (s.role, s.id, tuple(s.feasibility.failed_rules), s.dimensions.water_pressure.level)
        for s in result.strategies
    ]


@real_data
def test_real_data_water_source_changes_the_result():
    service = real_service()
    rainfed = service.analyze(real_request(water_source="tadah_hujan"))
    irrigated = service.analyze(real_request(water_source="irigasi"))
    assert summary(rainfed) != summary(irrigated)
    assert rainfed.context.soil.status == "unavailable"


@real_data
def test_real_data_start_month_changes_the_result():
    service = real_service()
    november = service.analyze(real_request())
    may = service.analyze(real_request(time={"start_month": "2027-05", "horizon_months": 12}))
    assert summary(november) != summary(may)
    assert any("Coba ubah bulan mulai" in note for note in may.notes)


@real_data
def test_real_data_with_cached_soil_runs_k3():
    samples = json.loads((ROOT / "data/soilgrids/samples.json").read_text())["samples"]
    request = deepcopy(REQUEST)
    request["location"] = samples[0]["location"]
    result = real_service().analyze(AnalysisInput.model_validate(request))
    assert result.context.soil.status == "ok"
    assert result.provenance.soil.fetched_at


class SlowSoil(FakeSoil):
    def for_polygon(self, location, **kwargs):
        import time

        time.sleep(0.5)
        return super().for_polygon(location, **kwargs)


def test_slow_soil_becomes_partial_instead_of_blocking(monkeypatch):
    monkeypatch.setattr("app.services.analysis.SOIL_TIMEOUT_S", 0.05)
    service = AnalysisService(climate=FakeClimate(), soil=SlowSoil(), allow_network=False)
    result = service.analyze(AnalysisInput.model_validate(REQUEST))
    assert result.context.soil.status == "unavailable"
    assert result.provenance.soil.fetched_at is None
