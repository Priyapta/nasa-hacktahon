import json
import os
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.catalog import load_catalog
from app.main import create_app
from app.schemas import AnalysisResponse
from app.services.agent import AgentService
from app.services.agent_fields import SavedFieldTools
from app.services.analysis import ClimateUnavailable
from test_accounts import clients, field_payload


def completion(message):
    return httpx.Response(200, json={"choices": [{"message": message, "finish_reason": "stop"}]})


def test_chat_can_look_up_owned_fields_before_answering(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "test-only")
    calls = []

    def provider(request):
        body = json.loads(request.content)
        calls.append(body)
        if "response_format" in body:
            return completion({"content": json.dumps({"allowed": True, "reason": "in_scope"})})
        assert {tool["function"]["name"] for tool in body["tools"]} == {"list_saved_fields", "inspect_saved_field"}
        if len(calls) == 2:
            return completion({"role": "assistant", "content": None, "tool_calls": [{
                "id": "lookup", "type": "function", "function": {"name": "list_saved_fields", "arguments": '{"search":"test","offset":0}'},
            }]})
        assert json.loads(body["messages"][-1]["content"])["status"] == "sign_in_required"
        assert body["messages"][-1]["tool_call_id"] == "lookup"
        return completion({"content": "Masuk terlebih dahulu agar saya bisa memeriksa lahan test milik Anda."})

    app = create_app()
    app.state.agent = AgentService(httpx.MockTransport(provider))
    with TestClient(app) as client:
        response = client.post("/api/v1/agent/chat", json={
            "message": "Lahan test saya sekarang bagaimana perkembangannya?", "history": [], "analysis_input": None, "lang": "id",
        })
    assert response.status_code == 200
    assert "lahan test" in response.json()["answer"]
    assert len(calls) == 3


class FakeAnalysis:
    catalog = load_catalog()

    def __init__(self, fail=False):
        self.requests = []
        self.fail = fail

    def analyze(self, plan):
        self.requests.append(plan)
        if self.fail:
            raise ClimateUnavailable("Climate unavailable")
        return AnalysisResponse.model_validate_json(
            (Path(__file__).parents[1] / "contracts/fixtures/analyze_success.json").read_text()
        )


def field_tools(client, analysis):
    cookie = client.cookies.get("field_session", "")
    return SavedFieldTools(Request({"type": "http", "headers": [(b"cookie", f"field_session={cookie}".encode())]}), analysis, "id")


def register(client, username):
    assert client.post("/api/v1/auth/register", json={"username": username, "password": "test-password-long"}).status_code == 201


def test_saved_fields_are_scoped_to_session_and_expiry(clients):
    a, b = clients
    register(a, "field_owner_a")
    register(b, "field_owner_b")
    saved = a.post("/api/v1/fields", json={**field_payload(), "name": "test"}).json()
    foreign = b.post("/api/v1/fields", json={**field_payload(), "name": "secret-other-field"}).json()
    analysis = FakeAnalysis()
    own, other = field_tools(a, analysis), field_tools(b, analysis)
    assert own.run("list_saved_fields", '{}')["fields"] == [{"id": saved["id"], "name": "test"}]
    assert other.run("list_saved_fields", '{"search":"test"}')["fields"] == []
    assert other.run("inspect_saved_field", json.dumps({"field_id": saved["id"]})) == {"status": "not_found"}
    assert own.run("inspect_saved_field", json.dumps({"field_id": foreign["id"]})) == {"status": "not_found"}
    assert not analysis.requests
    with psycopg.connect(os.environ["DATABASE_URL"]) as db:
        db.execute("UPDATE sessions SET expires_at = now() - interval '1 second'")
    assert own.run("list_saved_fields", '{}') == {"status": "sign_in_required"}


@pytest.mark.parametrize("foreign", [False, True])
def test_chat_inspects_only_owned_field_even_with_active_id_or_history(clients, monkeypatch, foreign):
    a, b = clients
    monkeypatch.setenv("AI_API_KEY", "test-only")
    register(a, "chat_owner_a")
    register(b, "chat_owner_b")
    owner = b if foreign else a
    saved = owner.post("/api/v1/fields", json={**field_payload(), "name": "test"}).json()
    analysis = FakeAnalysis()
    a.app.state.analysis = analysis
    calls = []

    def provider(request):
        body = json.loads(request.content)
        calls.append(body)
        if "response_format" in body:
            return completion({"content": json.dumps({"allowed": True, "reason": "in_scope"})})
        if len(calls) == 2:
            assert saved["id"] in body["messages"][1]["content"]
            return completion({"role": "assistant", "content": None, "tool_calls": [{
                "id": "inspect", "type": "function", "function": {"name": "inspect_saved_field", "arguments": json.dumps({"field_id": saved["id"]})},
            }]})
        data = json.loads(body["messages"][-1]["content"])
        if foreign:
            assert data == {"status": "not_found"}
            return completion({"content": "Lahan tersebut tidak ditemukan dalam akun Anda."})
        assert data["name"] == "test"
        assert data["analysis"]["strategies"]
        assert data["actual_observations"] is None
        assert data["id"] == saved["id"]
        assert "coordinates" not in body["messages"][-1]["content"]
        return completion({"content": "Lahan test memakai tadah hujan menurut rencana tersimpan."})

    a.app.state.agent = AgentService(httpx.MockTransport(provider))
    response = a.post("/api/v1/agent/chat", json={
        "message": "Lahan ini sekarang bagaimana?", "field_id": saved["id"],
        "history": [{"role": "assistant", "content": "Mari kita bahas lahan test."}], "analysis_input": None, "lang": "id",
    })
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert len(calls) == 3
    assert len(analysis.requests) == (0 if foreign else 1)


def test_storage_outage_is_distinct_from_an_empty_field_list(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    tools = SavedFieldTools(Request({"type": "http", "headers": [(b"cookie", b"field_session=fake")]}), FakeAnalysis(), "id")
    assert tools.run("list_saved_fields", '{}') == {"status": "storage_unavailable"}


def test_tool_rounds_are_bounded_and_finish_with_an_answer(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "test-only")
    calls = []

    def provider(request):
        body = json.loads(request.content)
        calls.append(body)
        if "response_format" in body:
            return completion({"content": json.dumps({"allowed": True, "reason": "in_scope"})})
        if body["tool_choice"] == "none":
            return completion({"content": "Masuk dahulu untuk membaca lahan tersimpan Anda."})
        return completion({"role": "assistant", "content": None, "tool_calls": [{
            "id": f"list-{len(calls)}", "type": "function", "function": {"name": "list_saved_fields", "arguments": '{}'},
        }]})

    app = create_app()
    app.state.agent = AgentService(httpx.MockTransport(provider))
    with TestClient(app) as client:
        response = client.post("/api/v1/agent/chat", json={"message": "Daftar lahan saya", "history": [], "analysis_input": None})
    assert response.status_code == 200
    assert len(calls) == 5


def test_pagination_and_name_search_only_return_owned_matches(clients):
    a, b = clients
    register(a, "field_paging_a")
    register(b, "field_paging_b")
    plan = field_payload()["plan"]
    from psycopg.types.json import Jsonb
    with psycopg.connect(os.environ["DATABASE_URL"]) as db:
        user_id = a.get("/api/v1/auth/me").json()["id"]
        for index in range(21):
            db.execute("INSERT INTO fields (id, user_id, name, plan) VALUES (%s, %s, %s, %s)", (uuid4(), user_id, f"test {index}", Jsonb(plan)))
    tools = field_tools(a, FakeAnalysis())
    first = tools.run("list_saved_fields", '{"search":"test"}')
    second = tools.run("list_saved_fields", '{"search":"test","offset":20}')
    assert len(first["fields"]) == 20
    assert first["next_offset"] == 20
    assert len(second["fields"]) == 1
    assert second["next_offset"] is None
    assert len({row["id"] for row in first["fields"] + second["fields"]}) == 21
    assert field_tools(b, FakeAnalysis()).run("list_saved_fields", '{}')["fields"] == []


@pytest.mark.parametrize("climate_failed", [False, True])
def test_progress_uses_original_calendar_and_does_not_rewrite_expired_plan(monkeypatch, climate_failed):
    class March(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2027, 3, 15, 10, tzinfo=tz)

    monkeypatch.setattr("app.services.agent_fields.datetime", March)
    monkeypatch.setattr("app.schemas.current_month_index", lambda: 2027 * 12 + 2)
    saved = field_payload()
    saved["plan"]["rotation"] = {"has_pattern": True, "stages": [{"crop_id": "padi_sawah"}, {"crop_id": "jagung"}]}
    saved["plan"]["time"] = {"start_month": "2026-11", "horizon_months": 12}
    field = {"id": uuid4(), "name": "test", "plan": saved["plan"]}
    before = json.dumps(field["plan"])
    analysis = FakeAnalysis(fail=climate_failed)
    tools = SavedFieldTools(Request({"type": "http", "headers": []}), analysis, "id")
    result = tools.inspect(field)
    assert result["planned_status"] == "in_progress"
    assert result["planned_current_stage"]["crop_id"] == "jagung"
    assert result["planned_current_stage"]["start"] == "2027-03"
    assert result["actual_observations"] is None
    assert result["analysis_rebased"] is True
    assert analysis.requests[0].time.start_month == "2027-03"
    assert result["saved_start_month"] == "2026-11"
    assert json.dumps(field["plan"]) == before
    assert result["area_ha"] > 0
    if climate_failed:
        assert result["analysis"] == {"status": "climate_unavailable"}
    else:
        assert result["analysis"]["strategies"]


@pytest.mark.parametrize("name,args", [
    ("delete_field", '{}'), ("inspect_saved_field", '{"field_id":"bad"}'),
    ("list_saved_fields", '{"offset":-1}'), ("list_saved_fields", '{"user_id":"other"}'),
    ("list_saved_fields", 'not JSON'),
])
def test_tool_input_is_validated_before_database_access(monkeypatch, name, args):
    def forbidden_database():
        pytest.fail("Invalid tool calls must not access the database")
    monkeypatch.setattr("app.services.agent_fields.database", forbidden_database)
    tools = SavedFieldTools(Request({"type": "http", "headers": [(b"cookie", b"field_session=fake")]}), FakeAnalysis(), "id")
    assert tools.run(name, args)["status"] in ("unknown_tool", "invalid_arguments_or_saved_plan")
