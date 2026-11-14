import asyncio
import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas import AnalysisResponse
from app.services.recommendation import RecommendationService

ROOT = Path(__file__).parents[1]


def analysis():
    return AnalysisResponse.model_validate_json(
        (ROOT / "contracts/fixtures/analyze_success.json").read_text()
    )


@pytest.mark.parametrize("lang", ["id", "en"])
def test_endpoint_generates_all_sections_without_changing_analysis(monkeypatch, lang):
    monkeypatch.setenv("AI_API_KEY", "test-secret")
    monkeypatch.setenv("AI_MODEL", "configured-model")
    monkeypatch.setattr("app.schemas.current_month_index", lambda: 2026 * 12 + 10)
    result = analysis()
    original = result.model_dump()
    points = {
        s.id: {"assessment": [f"Assessment {s.id}"], "basis": ["NASA POWER"], "cautions": ["Historical evidence."]}
        for s in result.strategies
    }
    calls = []

    def provider(request):
        calls.append(request)
        body = json.loads(request.content)
        assert request.headers["Authorization"] == "Bearer test-secret"
        assert body["model"] == "configured-model"
        assert body["response_format"] == {"type": "json_object"}
        assert ("Indonesian" if lang == "id" else "English") in body["messages"][0]["content"]
        evidence = json.loads(body["messages"][1]["content"])
        assert evidence["strategies"][0]["calendar"]
        assert evidence["provenance"]["climate"]["rain_validation"]
        assert "coordinates" not in request.content.decode()
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(points)}}]})

    class FakeAnalysis:
        def analyze(self, body):
            return result

    app = create_app()
    app.state.analysis = FakeAnalysis()
    app.state.recommendation = RecommendationService(httpx.MockTransport(provider))
    request = json.loads((ROOT / "contracts/fixtures/analyze_request.json").read_text())
    with TestClient(app) as client:
        response = client.post("/api/v1/analyze", json={**request, "lang": lang})
    assert response.status_code == 200
    assert len(calls) == 1
    for strategy in response.json()["strategies"]:
        assert strategy.pop("explanation") == points[strategy["id"]]
    for strategy in result.strategies:
        strategy.explanation = None
    assert result.model_dump() == original


@pytest.mark.parametrize("failure", ["timeout", "http", "invalid_json", "empty_points", "blank", "wrong_ids", "truncated"])
def test_provider_failure_keeps_analysis_and_fallback(monkeypatch, failure):
    monkeypatch.setenv("AI_API_KEY", "test-secret")
    result = analysis()
    original = result.model_dump()

    def provider(request):
        if failure == "timeout":
            raise httpx.ReadTimeout("secret provider detail")
        if failure == "http":
            return httpx.Response(500, text="secret provider detail")
        points = {s.id: {"assessment": ["Point"], "basis": ["Source"], "cautions": ["Caution"]} for s in result.strategies}
        if failure == "empty_points":
            points[result.strategies[0].id]["basis"] = []
        if failure == "blank":
            points[result.strategies[0].id]["basis"] = ["   "]
        if failure == "wrong_ids":
            points = {"invented-id": next(iter(points.values()))}
        return httpx.Response(200, json={"choices": [{
            "finish_reason": "length" if failure == "truncated" else "stop",
            "message": {"content": "invalid" if failure == "invalid_json" else json.dumps(points)},
        }]})

    service = RecommendationService(httpx.MockTransport(provider))
    assert asyncio.run(service.explain(result, "id")).model_dump() == original


def test_missing_key_and_quota_skip_provider(monkeypatch):
    calls = []

    def provider(request):
        calls.append(request)
        return httpx.Response(503)

    service = RecommendationService(httpx.MockTransport(provider))
    monkeypatch.delenv("AI_API_KEY", raising=False)
    asyncio.run(service.explain(analysis(), "id"))
    assert not calls
    monkeypatch.setenv("AI_API_KEY", "test-secret")
    service.requests = 5
    asyncio.run(service.explain(analysis(), "id"))
    assert not calls
    service.window_start -= 61
    asyncio.run(service.explain(analysis(), "id"))
    assert len(calls) == 1
