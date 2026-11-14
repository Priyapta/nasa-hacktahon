"""Prepare 45 native SoilGrids windows for three test polygons; resumable."""

import argparse
import fcntl
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shapely import union_all
from shapely.geometry import shape
from app.core.soil import PROPERTIES, DEPTHS, STATISTICS, project_polygon
from app.services.soil_archive import SoilArchive, SoilSpec, bounds_for_polygon, ROOT
from app.services.power_archive import atomic_json, utc_now


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--workers", type=int, choices=(1, 2), default=2)
    args = parser.parse_args()
    args.root.mkdir(parents=True, exist_ok=True)
    lock = (args.root / "prepare.lock").open("a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        parser.error("Another sample preparer already holds this cache lock")
    samples = json.loads((ROOT / "samples.json").read_text())["samples"]
    geometry = union_all(
        [project_polygon(shape(sample["location"])) for sample in samples]
    )
    bounds = bounds_for_polygon(geometry)
    archive = SoilArchive(args.root)
    specs = [
        SoilSpec(p, d, s, bounds)
        for p in PROPERTIES
        for s in STATISTICS
        for d, _ in DEPTHS
    ]
    status = {
        "pid": os.getpid(),
        "state": "running",
        "total": len(specs),
        "completed": 0,
        "failures": [],
        "started_at": utc_now(),
    }

    def report():
        status["updated_at"] = utc_now()
        atomic_json(args.root / "prepare-status.json", status)

    report()
    try:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            jobs = {pool.submit(archive.ensure, spec): spec for spec in specs}
            for future in as_completed(jobs):
                spec = jobs[future]
                status["last_file"] = spec.coverage_id
                try:
                    metadata = future.result()
                    status["completed"] += 1
                    print(
                        json.dumps(
                            {
                                "file": spec.filename,
                                "bytes": metadata["bytes"],
                                "completed": status["completed"],
                            }
                        ),
                        flush=True,
                    )
                except Exception as exc:
                    status["failures"].append(
                        {"file": spec.filename, "error": str(exc)}
                    )
                    print(json.dumps(status["failures"][-1]), flush=True)
                report()
        status["state"] = "complete" if not status["failures"] else "partial"
    except KeyboardInterrupt:
        status["state"] = "interrupted"
    finally:
        status["finished_at"] = utc_now()
        report()
    return 0 if status["state"] == "complete" else 1


if __name__ == "__main__":
    raise SystemExit(main())
