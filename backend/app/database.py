import os
from collections.abc import Iterator

import psycopg
from fastapi import HTTPException
from psycopg.rows import dict_row


def database() -> Iterator[psycopg.Connection]:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise HTTPException(503, "Penyimpanan akun dan lahan belum dikonfigurasi.")
    try:
        with psycopg.connect(url, row_factory=dict_row, connect_timeout=10) as connection:
            yield connection
    except (psycopg.OperationalError, psycopg.ProgrammingError):
        raise HTTPException(503, "Penyimpanan sedang tidak tersedia. Coba lagi nanti.") from None
