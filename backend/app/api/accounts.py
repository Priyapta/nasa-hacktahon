import hashlib
import hmac
import os
import secrets
from threading import BoundedSemaphore
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import Field, field_validator
from psycopg import Connection
from psycopg.types.json import Jsonb

from app.database import database
from app.schemas import AnalysisInput, ContractModel

router = APIRouter()
DB = Annotated[Connection, Depends(database)]
COOKIE = "field_session"
SESSION_SECONDS = 60 * 60 * 24 * 30
_password_work = BoundedSemaphore(2)


class Credentials(ContractModel):
    username: Annotated[str, Field(pattern=r"^[a-zA-Z0-9_]{3,32}$")]
    password: Annotated[str, Field(min_length=8, max_length=128)]

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.lower()


class SavedFieldInput(ContractModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    plan: AnalysisInput

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    # Each hash needs about 128 MiB; cap concurrent work within the API's memory budget.
    with _password_work:
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024)
    return f"{salt}:{digest.hex()}"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def require_browser_request(request: Request):
    # A custom header requires a CORS preflight; cross-origin callers are not allowed this header.
    if request.headers.get("x-field-request") != "1":
        raise HTTPException(403, "Permintaan tidak diizinkan.")


def current_user(request: Request, db: DB):
    token = request.cookies.get(COOKIE, "")
    user = db.execute(
        "SELECT u.id, u.username FROM users u JOIN sessions s ON s.user_id = u.id "
        "WHERE s.token_hash = %s AND s.expires_at > now()", (token_hash(token),),
    ).fetchone()
    if not user:
        raise HTTPException(401, "Masuk terlebih dahulu untuk menyimpan dan membuka lahan.")
    return user


User = Annotated[dict, Depends(current_user)]


def create_session(db: Connection, response: Response, user_id):
    token = secrets.token_urlsafe(32)
    db.execute("DELETE FROM sessions WHERE expires_at <= now()")
    db.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, now() + interval '30 days')",
        (token_hash(token), user_id),
    )
    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, httponly=True, samesite="lax",
                        secure=os.getenv("COOKIE_SECURE", "true").lower() != "false", path="/api/v1")
    response.headers["Cache-Control"] = "no-store"


def throttle(db: Connection, request: Request, username: str):
    address = request.client.host if request.client else "unknown"
    db.execute("DELETE FROM auth_attempts WHERE created_at < now() - interval '15 minutes'")
    db.execute("INSERT INTO auth_attempts (username, address) VALUES (%s, %s)", (username, address))
    counts = db.execute(
        "SELECT count(*) FILTER (WHERE username = %s) AS username, "
        "count(*) FILTER (WHERE address = %s) AS address FROM auth_attempts", (username, address),
    ).fetchone()
    # Persist attempts even when authentication fails and its transaction rolls back.
    db.commit()
    if counts["username"] > 20 or counts["address"] > 100:
        raise HTTPException(429, "Terlalu banyak percobaan. Tunggu 15 menit.", headers={"Retry-After": "900"})


@router.post("/auth/register", status_code=201, dependencies=[Depends(require_browser_request)])
def register(body: Credentials, request: Request, response: Response, db: DB):
    throttle(db, request, body.username)
    user_id = uuid4()
    user = db.execute(
        "INSERT INTO users (id, username, password_hash) VALUES (%s, %s, %s) "
        "ON CONFLICT (username) DO NOTHING RETURNING id, username",
        (user_id, body.username, hash_password(body.password)),
    ).fetchone()
    if not user:
        raise HTTPException(409, "Username sudah digunakan.")
    create_session(db, response, user_id)
    return user


@router.post("/auth/login", dependencies=[Depends(require_browser_request)])
def login(body: Credentials, request: Request, response: Response, db: DB):
    throttle(db, request, body.username)
    user = db.execute("SELECT id, username, password_hash FROM users WHERE username = %s", (body.username,)).fetchone()
    stored = user["password_hash"] if user else "00" * 16 + ":" + "00" * 64
    candidate = hash_password(body.password, stored.split(":")[0])
    if not hmac.compare_digest(candidate, stored) or not user:
        raise HTTPException(401, "Username atau password salah.")
    if previous := request.cookies.get(COOKIE):
        db.execute("DELETE FROM sessions WHERE token_hash = %s", (token_hash(previous),))
    create_session(db, response, user["id"])
    return {"id": user["id"], "username": user["username"]}


@router.get("/auth/me")
def me(user: User, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return user


@router.post("/auth/logout", dependencies=[Depends(require_browser_request)])
def logout(request: Request, response: Response, db: DB):
    db.execute("DELETE FROM sessions WHERE token_hash = %s", (token_hash(request.cookies.get(COOKIE, "")),))
    response.delete_cookie(COOKIE, path="/api/v1")
    response.headers["Cache-Control"] = "no-store"
    return {"ok": True}


@router.get("/fields")
def list_fields(user: User, db: DB, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"fields": db.execute(
        "SELECT id, name, plan, created_at FROM fields WHERE user_id = %s ORDER BY created_at DESC", (user["id"],),
    ).fetchall()}


@router.post("/fields", status_code=201, dependencies=[Depends(require_browser_request)])
def save_field(body: SavedFieldInput, user: User, db: DB):
    return db.execute(
        "INSERT INTO fields (id, user_id, name, plan) VALUES (%s, %s, %s, %s) RETURNING id, name, plan, created_at",
        (uuid4(), user["id"], body.name, Jsonb(body.plan.model_dump())),
    ).fetchone()


@router.delete("/fields/{field_id}", dependencies=[Depends(require_browser_request)])
def delete_field(field_id: UUID, user: User, db: DB):
    if not db.execute("DELETE FROM fields WHERE id = %s AND user_id = %s RETURNING id", (field_id, user["id"])).fetchone():
        raise HTTPException(404, "Lahan tidak ditemukan.")
    return {"ok": True}


@router.get("/fields/{field_id}")
def get_field(field_id: UUID, user: User, db: DB, response: Response):
    response.headers["Cache-Control"] = "no-store"
    field = db.execute(
        "SELECT id, name, plan, created_at FROM fields WHERE id = %s AND user_id = %s",
        (field_id, user["id"]),
    ).fetchone()
    if not field:
        raise HTTPException(404, "Lahan tidak ditemukan.")
    return field


@router.put("/fields/{field_id}", dependencies=[Depends(require_browser_request)])
def update_field(field_id: UUID, body: SavedFieldInput, user: User, db: DB):
    field = db.execute(
        "UPDATE fields SET name = %s, plan = %s WHERE id = %s AND user_id = %s "
        "RETURNING id, name, plan, created_at",
        (body.name, Jsonb(body.plan.model_dump()), field_id, user["id"]),
    ).fetchone()
    if not field:
        raise HTTPException(404, "Lahan tidak ditemukan.")
    return field
