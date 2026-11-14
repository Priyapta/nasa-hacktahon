"""Download Indonesia bounding box sequentially; resume by re-running the command."""
import argparse
import fcntl
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.power_archive import DEFAULT_ROOT, PowerArchive, atomic_json, indonesia_specs, utc_now


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--start-year", type=int, default=2016)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--sample", action="store_true", help="Only the first tile, end year, six variables")
    parser.add_argument("--delay", type=float, default=1.0)
    args = parser.parse_args()
    if args.start_year > args.end_year or args.delay < 0:
        parser.error("Invalid year range or delay")
    args.root.mkdir(parents=True, exist_ok=True)
    lock = (args.root / "download.lock").open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        parser.error("Another downloader already holds this archive lock")
    specs = indonesia_specs(args.start_year, args.end_year)
    if args.sample:
        specs = specs[:6]
    status = {"pid": os.getpid(), "state": "running", "started_at": utc_now(), "total": len(specs),
              "completed": 0, "downloaded": 0, "cache_hits": 0, "bytes": 0, "failures": []}
    archive = PowerArchive(args.root)
    def report():
        status["updated_at"] = utc_now()
        atomic_json(args.root / "download-status.json", status)
    report()
    try:
        for spec in specs:
            status["current"] = spec.filename
            report()
            try:
                metadata = archive.ensure(spec)
                status["completed"] += 1
                status["cache_hits" if metadata["cache_hit"] else "downloaded"] += 1
                status["bytes"] += metadata["bytes"]
                print(json.dumps({"file": spec.filename, "bytes": metadata["bytes"],
                                  "cache_hit": metadata["cache_hit"], "completed": status["completed"],
                                  "total": len(specs)}), flush=True)
            except Exception as exc:
                status["failures"].append({"file": spec.filename, "error": str(exc)})
                print(json.dumps(status["failures"][-1]), flush=True)
            report()
            time.sleep(args.delay)
        status["state"] = "complete" if not status["failures"] else "partial"
    except KeyboardInterrupt:
        status["state"] = "interrupted"
    finally:
        status["finished_at"] = utc_now()
        report()
    return 0 if status["state"] == "complete" else 1


if __name__ == "__main__":
    raise SystemExit(main())
