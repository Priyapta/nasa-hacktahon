"""Run ten-year climate statistics from existing local POWER files; no network."""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.climate import ClimateService

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--start-month",
        default=datetime.now(ZoneInfo("Asia/Jakarta")).strftime("%Y-%m"),
    )
    parser.add_argument(
        "--horizon-months", type=int, choices=(6, 12, 18, 24), default=12
    )
    parser.add_argument("--lang", choices=("id", "en"), default="id")
    args = parser.parse_args()
    location = json.loads(
        (
            Path(__file__).resolve().parents[1]
            / "contracts/fixtures/analyze_request.json"
        ).read_text()
    )["location"]
    started = time.perf_counter()
    result = ClimateService().for_polygon(
        location,
        start_month=args.start_month,
        horizon_months=args.horizon_months,
        lang=args.lang,
        allow_network=False,
    )
    print(
        json.dumps(
            {
                "period": result["climate"]["period"],
                "cache_hit": result["provenance"]["cache_hit"],
                "elapsed_seconds": round(time.perf_counter() - started, 3),
                "monthly": result["climate"]["monthly"],
                "window_summary": result["window_summary"],
                "first_window": (
                    {
                        k: result["historical_windows"][0][k]
                        for k in ("start", "end", "valid")
                    }
                    if result["historical_windows"]
                    else None
                ),
                "last_window": (
                    {
                        k: result["historical_windows"][-1][k]
                        for k in ("start", "end", "valid")
                    }
                    if result["historical_windows"]
                    else None
                ),
                "notes": result["notes"],
                "rain_validation": result["provenance"]["rain_validation"],
            },
            indent=2,
            ensure_ascii=False,
        )
    )
