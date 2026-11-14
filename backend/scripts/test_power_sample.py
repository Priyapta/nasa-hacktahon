"""Explicit live-data smoke check; reads local archive, never downloads."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.power import PowerService

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cross-grid", action="store_true", help="Use polygon crossing meteorological and solar cells")
    args = parser.parse_args()
    location = json.loads((Path(__file__).resolve().parents[1] / "contracts/fixtures/analyze_request.json").read_text())["location"]
    if args.cross_grid:
        location = {"type": "Polygon", "coordinates": [[[110.8, -7.1], [111.1, -7.1], [111.1, -6.9], [110.8, -6.9], [110.8, -7.1]]]}
    result = PowerService().for_polygon(location, start_year=2025, end_year=2025, allow_network=False)
    print(json.dumps({"period": result["period"], "method": result["method"], "variables": {
        p: {"unit": v["unit"], "days": len(v["daily"]), "cells": len(v["cells"]),
            "missing_days": v["missing_days"], "first_day": next(iter(v["daily"].items()))}
        for p, v in result["variables"].items()}}, indent=2))
