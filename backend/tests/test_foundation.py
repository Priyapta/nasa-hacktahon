from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import create_app
from app.schemas import AnalysisInput


@pytest.fixture
def payload(monkeypatch):
    # Freeze the contract's clock rather than tying tests to today's month.
    monkeypatch.setattr("app.schemas.current_month_index", lambda: 2026 * 12 + 10)
    return {
        "location": {"type": "Polygon", "coordinates": [[[110.90, -7.10], [110.92, -7.10], [110.92, -7.08], [110.90, -7.10]]]},
        "rotation": {
            "has_pattern": True,
            "stages": [
                {"crop_id": "padi_sawah"},
                {"crop_id": "padi_sawah"},
                {"crop_id": "bera", "months": 4},
            ],
        },
        "time": {"start_month": "2026-11", "horizon_months": 12},
        "water_source": "tadah_hujan",
    }


def test_health_and_documentation_without_providers():
    with TestClient(create_app()) as client:
        assert client.get("/api/v1/health").json() == {"status": "ok"}
        assert client.get("/docs").status_code == 200
        schema = client.get("/openapi.json").json()
        assert "/api/v1/health" in schema["paths"]
        # An unfinished calculation must not look like working analysis.
        assert client.post("/api/v1/analyze", json={}).status_code == 404


def test_polygon_request_and_no_pattern(payload):
    parsed = AnalysisInput.model_validate(payload)
    assert parsed.lang == "id"
    assert parsed.rotation.stages[-1].months == 4
    payload["rotation"] = {"has_pattern": False, "stages": []}
    assert not AnalysisInput.model_validate(payload).rotation.has_pattern


@pytest.mark.parametrize("month", ["2026-11", "2027-10"])
def test_start_window_including_year_boundary(payload, month):
    payload["time"]["start_month"] = month
    AnalysisInput.model_validate(payload)


@pytest.mark.parametrize("month", ["2026-10", "2027-11", "2026-13", "2026-1"])
def test_reject_month_outside_window_or_invalid_format(payload, month):
    payload["time"]["start_month"] = month
    with pytest.raises(ValidationError):
        AnalysisInput.model_validate(payload)


@pytest.mark.parametrize(
    "rotation",
    [
        {"has_pattern": True, "stages": []},
        {"has_pattern": False, "stages": [{"crop_id": "jagung"}]},
        {"has_pattern": True, "stages": [{"crop_id": "jagung"}] * 7},
        {"has_pattern": True, "stages": [{"crop_id": "unknown"}]},
        {"has_pattern": True, "stages": [{"crop_id": "bera"}]},
        {"has_pattern": True, "stages": [{"crop_id": "bera", "months": 7}]},
        {"has_pattern": True, "stages": [{"crop_id": "bera", "months": True}]},
        {"has_pattern": True, "stages": [{"crop_id": "jagung", "months": 4}]},
    ],
)
def test_reject_inconsistent_rotation(payload, rotation):
    payload["rotation"] = rotation
    with pytest.raises(ValidationError):
        AnalysisInput.model_validate(payload)


@pytest.mark.parametrize("latitude", [91, float("nan"), float("inf"), "-7.09", True])
def test_reject_invalid_coordinates(payload, latitude):
    payload["location"]["coordinates"][0][1][1] = latitude
    with pytest.raises(ValidationError):
        AnalysisInput.model_validate(payload)


def test_global_coordinates_allowed_for_later_demo_warning(payload):
    payload["location"] = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}
    AnalysisInput.model_validate(payload)


@pytest.mark.parametrize("horizon", [5, "12", 12.0, True])
def test_reject_invalid_horizon(payload, horizon):
    payload["time"]["horizon_months"] = horizon
    with pytest.raises(ValidationError):
        AnalysisInput.model_validate(payload)


def test_http_validation_matches_prd_without_exposing_input(payload):
    app = create_app()

    # Test-only endpoint exercises HTTP validation without publishing a fake
    # /analyze implementation or inventing environmental data.
    @app.post("/_test/input")
    def validate_input(body: AnalysisInput):
        return body.model_dump()

    with TestClient(app) as client:
        assert client.post("/_test/input", json=payload).status_code == 200
        invalid = deepcopy(payload)
        invalid["time"]["horizon_months"] = 9
        response = client.post("/_test/input", json=invalid)
        assert response.status_code == 400
        detail = response.json()["detail"][0]
        assert detail["loc"] == ["body", "time", "horizon_months"]
        assert set(detail) == {"loc", "msg"}
        invalid["time"]["start_month"] = "2026-10"
        assert client.post("/_test/input", json=invalid).status_code == 400
        assert client.post(
            "/_test/input", content="{", headers={"Content-Type": "application/json"}
        ).status_code == 400
