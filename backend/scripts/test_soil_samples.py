"""Offline live-data smoke check: no downloads and no fabricated soil values."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.soil import SoilService
from app.services.soil_archive import ROOT

if __name__ == "__main__":
    samples = json.loads((ROOT / "samples.json").read_text())["samples"]
    results = []
    for sample in samples:
        result = SoilService().for_polygon(sample["location"], allow_network=False)
        results.append(
            {
                "id": sample["id"],
                "soil": result["soil"],
                "notes": result["notes"],
                "skipped_rules": result["skipped_rules"],
            }
        )
    print(json.dumps(results, indent=2, ensure_ascii=False))
    if any(r["soil"]["status"] != "ok" for r in results):
        raise SystemExit(1)
