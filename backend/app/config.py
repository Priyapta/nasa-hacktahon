"""Small environment configuration; no provider calls during startup."""

import os


def allowed_origins() -> list[str]:
    """Comma-separated exact origins for optional direct frontend access."""
    return [
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
