"""Polygon location contract shared by analysis, chat, and scenario inputs."""
import json
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import create_app
from app.schemas import AnalysisInput, ChatInput, ChatScenario, LocationInput

FIXTURES = Path(__file__).resolve().parents[1] / "contracts" / "fixtures"
SHELL = [[110.90, -7.10], [110.92, -7.10], [110.92, -7.08], [110.90, -7.08], [110.90, -7.10]]
HOLE = [[110.905, -7.095], [110.905, -7.085], [110.915, -7.085], [110.915, -7.095], [110.905, -7.095]]


def polygon(*rings):
    return {"type": "Polygon", "coordinates": deepcopy(list(rings or (SHELL,)))}


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch):
    monkeypatch.setattr("app.schemas.current_month_index", lambda: 2026 * 12 + 10)


@pytest.mark.parametrize("rings", [(SHELL,), (list(reversed(SHELL)),), (SHELL, HOLE)])
def test_valid_rings_preserved_without_repair_or_centroid(rings):
    body = polygon(*rings)
    result = LocationInput.model_validate(body)
    assert result.model_dump() == body
    assert json.loads(result.model_dump_json()) == body
    assert LocationInput.model_validate_json(json.dumps(body)).model_dump() == body


INVALID = [
    {"lat": -7.09, "lon": 110.91},
    {"type": "Point", "coordinates": [110.91, -7.09]},
    {"type": "MultiPolygon", "coordinates": [[SHELL]]},
    {"type": "Feature", "geometry": polygon(), "properties": {}},
    {"type": "Polygon", "coordinates": []},
    polygon(SHELL[:-1]),  # open ring
    polygon([[0, 0], [1, 0], [0, 0]]),  # too short
    polygon([[0, 0], [1, 0], [1, 0], [0, 0]]),  # fewer than three vertices
    polygon([[0, 0], [1, 1], [2, 2], [0, 0]]),  # zero area
    polygon([[0, 0], [2, 2], [0, 2], [2, 0], [0, 0]]),  # crossing boundary
    polygon(SHELL, [[111, -7.1], [111.1, -7.1], [111.1, -7], [111, -7.1]]),  # outside hole
    polygon(SHELL, HOLE, HOLE),  # overlapping holes
    {**polygon(), "centroid": [110.91, -7.09]},
]


@pytest.mark.parametrize("body", INVALID)
def test_reject_invalid_geometry_types_and_topology(body):
    with pytest.raises(ValidationError):
        LocationInput.model_validate(body)


@pytest.mark.parametrize("value,axis", [
    (181, 0), (-181, 0), (91, 1), (-91, 1), (float("nan"), 0),
    (float("inf"), 1), ("110.92", 0), (True, 1),
])
def test_reject_invalid_position_values(value, axis):
    body = polygon()
    body["coordinates"][0][1][axis] = value
    with pytest.raises(ValidationError):
        LocationInput.model_validate(body)


@pytest.mark.parametrize("position", [[1], [1, 2, 3]])
def test_two_dimensional_positions_only(position):
    body = polygon()
    body["coordinates"][0][1] = position
    with pytest.raises(ValidationError):
        LocationInput.model_validate(body)


def test_all_analysis_contexts_share_polygon_and_reject_old_point():
    analysis = json.loads((FIXTURES / "analyze_request.json").read_text())
    chat = json.loads((FIXTURES / "chat_request.json").read_text())
    scenario = json.loads((FIXTURES / "chat_scenario.json").read_text())["scenario"]
    for model, body, context in [
        (AnalysisInput, analysis, analysis),
        (ChatInput, chat, chat["analysis_input"]),
        (ChatScenario, scenario, scenario["input"]),
    ]:
        model.model_validate_json(json.dumps(body))
        context["location"] = {"lat": -7.09, "lon": 110.91}
        with pytest.raises(ValidationError):
            model.model_validate_json(json.dumps(body))


def test_http_polygon_validation_returns_400():
    app = create_app()

    @app.post("/_test/polygon")
    def validate(body: AnalysisInput):
        return body.model_dump()

    payload = json.loads((FIXTURES / "analyze_request.json").read_text())
    with TestClient(app) as client:
        response = client.post("/_test/polygon", json=payload)
        assert response.status_code == 200
        assert response.json()["location"] == payload["location"]
        payload["location"]["coordinates"][0].pop()
        response = client.post("/_test/polygon", json=payload)
        assert response.status_code == 400
        detail = response.json()["detail"][0]
        assert detail["loc"] == ["body", "location", "coordinates"]
        assert set(detail) == {"loc", "msg"}
        assert client.post("/api/v1/analyze", json=payload).status_code == 400
