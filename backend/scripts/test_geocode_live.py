"""One explicit real-provider smoke request; never run automatically by pytest."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import create_app
from app.services.geocode import atomic_json

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", default="Purwodadi, Grobogan")
    args = parser.parse_args()
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/geocode", params={"q": args.query})
        print(
            json.dumps(
                {
                    "status": response.status_code,
                    "cache": response.headers.get("X-Geocode-Cache"),
                    "attribution": "OpenStreetMap contributors — https://www.openstreetmap.org/copyright",
                    "body": response.json(),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        if response.status_code != 200:
            raise SystemExit(1)
        service = client.app.state.geocode_service
        atomic_json(
            service.root / "probes" / "last-live-response.json", response.json()
        )
