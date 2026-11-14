"""HTTP contract, persistent cache, and provider-wide search budget. No live requests."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from email.utils import formatdate
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.geocode import get_geocode_service
from app.config import GeocodeSettings
from app.main import create_app
from app.schemas import ErrorResponse
from app.services.geocode import (
    GeocodeRateLimited,
    GeocodeService,
    GeocodeUnavailable,
    normalize_results,
)

PLACE = {
    "osm_type": "relation",
    "osm_id": 9687051,
    "lat": "-7.0964605",
    "lon": "110.8948834",
    "display_name": "Grobogan, Jawa Tengah, Indonesia",
    "addresstype": "county",
}


@pytest.fixture
def setup(tmp_path):
    now = [1000.0]
    calls = []
    settings = GeocodeSettings(cache_dir=tmp_path)

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=[PLACE])

    client = httpx.Client(transport=httpx.MockTransport(handler))
    service = GeocodeService(settings, client, clock=lambda: now[0])
    yield service, now, calls
    client.close()


def api_for(service):
    app = create_app()
    app.dependency_overrides[get_geocode_service] = lambda: service
    return app


def test_http_success_matches_frontend_contract_and_docs(setup):
    service, _, calls = setup
    with TestClient(api_for(service)) as client:
        response = client.get("/api/v1/geocode", params={"q": "  Grobogan  "})
        assert response.status_code == 200
        assert response.json() == {
            "results": [
                {
                    "id": "relation-9687051",
                    "name": PLACE["display_name"],
                    "center": [110.8948834, -7.0964605],
                    "zoom": 10.0,
                }
            ]
        }
        assert response.headers["X-Geocode-Cache"] == "miss"
        assert "openstreetmap.org/copyright" in response.headers["link"]
        docs = client.get("/openapi.json").json()["paths"]["/api/v1/geocode"]["get"]
        assert set(docs["responses"]) == {"200", "400", "429", "502"}
        assert client.post("/api/v1/analyze", json={}).status_code == 404
    request = calls[0]
    assert request.url.params["q"] == "Grobogan"
    assert request.url.params["countrycodes"] == "id"
    assert request.url.params["bounded"] == "1"
    assert request.url.params["limit"] == "5"
    west, south, east, north = service.settings.bbox
    assert request.url.params["viewbox"] == f"{west},{north},{east},{south}"
    assert request.headers["User-Agent"].startswith("FieldShift/")


@pytest.mark.parametrize(
    "params", [{}, {"q": ""}, {"q": "   "}, {"q": "Grobogan", "unexpected": "value"}]
)
def test_invalid_query_is_400_without_provider_call(setup, params):
    service, _, calls = setup
    with TestClient(api_for(service)) as client:
        response = client.get("/api/v1/geocode", params=params)
        assert response.status_code == 400
        ErrorResponse.model_validate(response.json())
        assert response.json()["detail"][0]["loc"][0] == "query"
    assert calls == []


def test_cache_reuse_normalization_and_service_restart(setup):
    service, _, calls = setup
    assert service.search("Grobogan")[1] == "miss"
    restarted = GeocodeService(service.settings, service.client, clock=service.clock)
    result, state = restarted.search("  gRoBoGaN  ")
    assert (
        state == "hit"
        and len(calls) == 1
        and result.results[0].center == (110.8948834, -7.0964605)
    )


def test_rate_budget_shared_by_service_instances_and_cache_bypasses_it(setup):
    service, now, calls = setup
    service.search("Grobogan")
    second = GeocodeService(service.settings, service.client, clock=service.clock)
    with pytest.raises(GeocodeRateLimited) as exc:
        second.search("Purwodadi")
    assert exc.value.retry_after == 1
    assert second.search("Grobogan")[1] == "hit"
    now[0] += 1
    second.search("Purwodadi")
    assert len(calls) == 2


def test_cache_identity_includes_bbox_and_provider(setup):
    service, now, calls = setup
    service.search("Grobogan")
    now[0] += 1
    changed = GeocodeService(
        replace(service.settings, bbox=(110.5, -7.3, 111.3, -6.8)),
        service.client,
        clock=service.clock,
    )
    assert changed.search("Grobogan")[1] == "miss"
    now[0] += 1
    changed = GeocodeService(
        replace(service.settings, base_url="https://other-provider.example"),
        service.client,
        clock=service.clock,
    )
    assert changed.search("Grobogan")[1] == "miss"
    assert len(calls) == 3


def test_concurrent_identical_requests_are_coalesced(tmp_path):
    calls = []

    def handler(request):
        calls.append(request)
        time.sleep(0.03)
        return httpx.Response(200, json=[PLACE])

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        settings = GeocodeSettings(cache_dir=tmp_path)
        services = [GeocodeService(settings, client, lambda: 1000) for _ in range(2)]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(
                pool.map(lambda service: service.search("Grobogan"), services)
            )
    assert sorted(state for _, state in results) == ["hit", "miss"]
    assert len(calls) == 1


def test_empty_results_are_valid_and_cached(tmp_path):
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=[]))
    ) as client:
        service = GeocodeService(
            GeocodeSettings(cache_dir=tmp_path), client, lambda: 1000
        )
        result, state = service.search("No matching place")
        assert result.results == [] and state == "miss"
        assert service.search("No matching place")[1] == "hit"


@pytest.mark.parametrize(
    "header,expected", [("5", 5), ("nonsense", 1), (formatdate(1010, usegmt=True), 10)]
)
def test_upstream_429_sets_retry_after_and_shared_cooldown(tmp_path, header, expected):
    now = [1000.0]
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(429, headers={"Retry-After": header})

    with httpx.Client(transport=httpx.MockTransport(handler)) as upstream:
        service = GeocodeService(
            GeocodeSettings(cache_dir=tmp_path), upstream, lambda: now[0]
        )
        with TestClient(api_for(service)) as client:
            response = client.get("/api/v1/geocode", params={"q": "Grobogan"})
            assert response.status_code == 429
            assert response.headers["retry-after"] == str(expected)
            ErrorResponse.model_validate(response.json())
        with pytest.raises(GeocodeRateLimited):
            service.search("different query")
        assert len(calls) == 1


@pytest.mark.parametrize(
    "failure", ["http", "timeout", "bad_json", "bad_envelope", "bad_coordinates"]
)
def test_provider_failures_return_502_without_inventing_results(tmp_path, failure):
    def handler(request):
        if failure == "http":
            return httpx.Response(503)
        if failure == "timeout":
            raise httpx.ReadTimeout("private upstream details", request=request)
        if failure == "bad_json":
            return httpx.Response(200, content=b"not JSON")
        if failure == "bad_envelope":
            return httpx.Response(200, json={"wrong": "shape"})
        return httpx.Response(200, json=[{**PLACE, "lat": "nan"}])

    with httpx.Client(transport=httpx.MockTransport(handler)) as upstream:
        service = GeocodeService(
            GeocodeSettings(cache_dir=tmp_path), upstream, lambda: 1000
        )
        with TestClient(api_for(service)) as client:
            response = client.get("/api/v1/geocode", params={"q": "Grobogan"})
            assert response.status_code == 502
            ErrorResponse.model_validate(response.json())
            assert "private upstream" not in response.text
    assert not list((tmp_path / "results").glob("*.json"))


def test_expired_cache_is_refreshed_or_explicitly_marked_stale(setup):
    service, now, calls = setup
    service.search("Grobogan")
    now[0] += service.settings.cache_ttl_seconds + 1
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(503))
    ) as upstream:
        offline = GeocodeService(service.settings, upstream, service.clock)
        with TestClient(api_for(offline)) as client:
            response = client.get("/api/v1/geocode", params={"q": "Grobogan"})
            assert response.status_code == 200
            assert response.headers["x-geocode-cache"] == "stale"
            assert "stale" in response.headers["warning"]
    now[0] += 1
    assert service.search("Grobogan")[1] == "miss"
    assert len(calls) == 2


def test_corrupt_cache_is_refetched_not_returned(setup):
    service, now, calls = setup
    service.search("Grobogan")
    path = next((service.root / "results").glob("*.json"))
    path.write_text('{"broken": true}')
    now[0] += 1
    assert service.search("Grobogan")[1] == "miss"
    assert len(calls) == 2


def test_normalization_filters_outside_bbox_and_deduplicates():
    settings = GeocodeSettings()
    outside = {**PLACE, "osm_id": 1, "lat": "-6.2", "lon": "106.8"}
    result = normalize_results([PLACE, PLACE, outside], settings.bbox)
    assert len(result.results) == 1
    assert normalize_results([outside], settings.bbox).results == []
    with pytest.raises(GeocodeUnavailable):
        normalize_results([{"lat": True}], settings.bbox)


def test_configuration_env_and_validation(monkeypatch, tmp_path):
    monkeypatch.setenv("CACHE_DIR", str(tmp_path))
    monkeypatch.setenv("DEMO_BBOX", "110,-8,112,-6")
    monkeypatch.setenv("NOMINATIM_BASE_URL", "https://nominatim.example.test/")
    monkeypatch.setenv("NOMINATIM_USER_AGENT", "FieldShift-test/1.0")
    settings = GeocodeSettings.from_env()
    assert settings.cache_dir == tmp_path / "geocode"
    assert settings.bbox == (110, -8, 112, -6)
    assert settings.base_url == "https://nominatim.example.test"
    monkeypatch.setenv("DEMO_BBOX", "110,-8")
    with pytest.raises(ValueError):
        GeocodeSettings.from_env()
    with pytest.raises(ValueError):
        GeocodeSettings(user_agent="python-httpx/0.28")
    with pytest.raises(ValueError):
        GeocodeSettings(bbox=(112, -6, 110, -8))


def test_non_object_cache_is_ignored(setup):
    service, now, calls = setup
    service.search("Grobogan")
    next((service.root / "results").glob("*.json")).write_text("[]")
    now[0] += 1
    assert service.search("Grobogan")[1] == "miss"
    assert len(calls) == 2


def test_upstream_rate_limit_without_retry_header_defaults_to_one_second(tmp_path):
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(429))
    ) as client:
        service = GeocodeService(
            GeocodeSettings(cache_dir=tmp_path), client, lambda: 1000
        )
        with pytest.raises(GeocodeRateLimited) as exc:
            service.search("Grobogan")
        assert exc.value.retry_after == 1
