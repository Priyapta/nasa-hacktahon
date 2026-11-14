"""Apply the initial schema: python -m app.migrate (DATABASE_URL must be set)."""

import os
from pathlib import Path

import psycopg


def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("Set DATABASE_URL before running migrations.")
    with psycopg.connect(url) as connection:
        connection.execute((Path(__file__).resolve().parents[1] / "migrations/001_accounts_fields.sql").read_text())
    print("Account and field schema applied.")


if __name__ == "__main__":
    main()
