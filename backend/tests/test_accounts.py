import os
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql

from app.api.accounts import hash_password
from app.main import create_app


def test_password_hash_is_salted():
    first = hash_password("password-test")
    second = hash_password("password-test")
    assert first != second
    assert hash_password("password-test", first.split(":")[0]) == first
    assert hash_password("different-password", first.split(":")[0]) != first


def test_database_unconfigured(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with TestClient(create_app()) as client:
        assert client.get("/api/v1/health").status_code == 200
        assert client.get("/api/v1/fields").status_code == 503
        assert client.post("/api/v1/auth/login", json={}).status_code == 403


@pytest.fixture
def clients(monkeypatch):
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to test against PostgreSQL.")
    schema = "accounts_test_" + uuid4().hex
    with psycopg.connect(url, autocommit=True) as db:
        db.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    test_url = psycopg.conninfo.make_conninfo(url, options=f"-c search_path={schema}")
    try:
        with psycopg.connect(test_url) as db:
            migration = (Path(__file__).parents[1] / "migrations/001_accounts_fields.sql").read_text()
            db.execute(migration)
            db.execute(migration)
        monkeypatch.setenv("DATABASE_URL", test_url)
        monkeypatch.setenv("COOKIE_SECURE", "true")
        app = create_app()
        with TestClient(app, base_url="https://testserver", headers={"X-Field-Request": "1"}) as a, TestClient(
            app, base_url="https://testserver", headers={"X-Field-Request": "1"}
        ) as b:
            yield a, b
    finally:
        with psycopg.connect(url, autocommit=True) as db:
            db.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def field_payload():
    from app.schemas import current_month_index
    index = current_month_index()
    return {"name": "  Sawah utara  ", "plan": {
        "location": {"type": "Polygon", "coordinates": [[[110.9, -7.1], [110.91, -7.1], [110.91, -7.09], [110.9, -7.1]]]},
        "rotation": {"has_pattern": False, "stages": []},
        "time": {"start_month": f"{index // 12}-{index % 12 + 1:02}", "horizon_months": 12},
        "water_source": "tadah_hujan", "lang": "id",
    }}


def test_accounts_fields_and_session_isolation(clients):
    a, b = clients
    credentials = {"username": "Petani_1", "password": "a-long-password"}
    assert a.get("/api/v1/fields").status_code == 401
    assert a.post("/api/v1/auth/register", json={**credentials, "password": "short"}).status_code == 400
    registered = a.post("/api/v1/auth/register", json=credentials)
    assert registered.status_code == 201
    assert registered.json()["username"] == "petani_1"
    assert set(registered.json()) == {"id", "username"}
    cookie = registered.headers["set-cookie"]
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
    assert b.post("/api/v1/auth/register", json=credentials).status_code == 409
    assert b.post("/api/v1/auth/login", json={**credentials, "password": "wrong-password"}).status_code == 401
    assert b.post("/api/v1/auth/register", json={**credentials, "username": "petani_2"}).status_code == 201

    field = a.post("/api/v1/fields", json=field_payload())
    assert field.status_code == 201
    saved = field.json()
    assert saved["name"] == "Sawah utara"
    assert a.get(f"/api/v1/fields/{saved['id']}").json() == saved
    assert b.get(f"/api/v1/fields/{saved['id']}").status_code == 404
    changed = {**field_payload(), "name": "Sawah diperbarui"}
    assert b.put(f"/api/v1/fields/{saved['id']}", json=changed).status_code == 404
    assert a.get("/api/v1/fields").json()["fields"] == [saved]
    updated = a.put(f"/api/v1/fields/{saved['id']}", json=changed)
    assert updated.status_code == 200
    assert updated.json()["id"] == saved["id"]
    assert updated.json()["created_at"] == saved["created_at"]
    saved = updated.json()
    assert saved["name"] == "Sawah diperbarui"
    assert a.get("/api/v1/fields").json()["fields"] == [saved]
    assert b.get("/api/v1/fields").json() == {"fields": []}
    assert b.delete(f"/api/v1/fields/{saved['id']}").status_code == 404
    assert a.post("/api/v1/fields", json={**field_payload(), "user_id": b.get("/api/v1/auth/me").json()["id"]}).status_code == 400
    assert a.post("/api/v1/fields", json={**field_payload(), "name": "  "}).status_code == 400

    old_session = a.cookies.get("field_session")
    assert a.post("/api/v1/auth/logout").status_code == 200
    assert a.get("/api/v1/auth/me").status_code == 401
    a.cookies.set("field_session", old_session)
    assert a.get("/api/v1/auth/me").status_code == 401
    a.cookies.clear()
    assert a.post("/api/v1/auth/login", json=credentials).status_code == 200
    assert len(a.get("/api/v1/fields").json()["fields"]) == 1
    assert a.delete(f"/api/v1/fields/{saved['id']}").status_code == 200
    assert a.get("/api/v1/fields").json() == {"fields": []}


def test_csrf_expiry_and_login_throttle(clients):
    a, _ = clients
    credentials = {"username": "petani_3", "password": "a-long-password"}
    assert a.post("/api/v1/auth/register", json=credentials).status_code == 201
    with psycopg.connect(os.environ["DATABASE_URL"]) as db:
        db.execute("UPDATE sessions SET expires_at = now() - interval '1 second'")
    assert a.get("/api/v1/fields").status_code == 401
    a.headers.pop("X-Field-Request")
    assert a.post("/api/v1/auth/logout").status_code == 403
    assert a.put(f"/api/v1/fields/{uuid4()}", json=field_payload()).status_code == 403
    a.headers["X-Field-Request"] = "1"
    with psycopg.connect(os.environ["DATABASE_URL"]) as db:
        db.execute("INSERT INTO auth_attempts (username, address) SELECT 'petani_3', 'testclient' FROM generate_series(1, 20)")
    assert a.post("/api/v1/auth/login", json=credentials).status_code == 429
