import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.soil import DEPTHS, PROPERTIES, STATISTICS
from app.services.soil_archive import SoilArchive, SoilSpec, download_catalog

# Downloads each of the 45 global SoilGrids catalogs once (3.5 to 6 MB each),
# keeps only the Indonesia tiles and stores them under data/soilgrids/catalogs.
# Existing catalogs are skipped, so the script is safe to rerun.


def main() -> int:
    archive = SoilArchive()
    specs = [
        SoilSpec(prop, depth, stat, (0, 0, 250, 250))
        for prop in PROPERTIES
        for stat in STATISTICS
        for depth, _ in DEPTHS
    ]
    todo = [spec for spec in specs if not archive.catalog_path(spec).exists()]
    print(f"{len(specs) - len(todo)} catalogs present, {len(todo)} to download")

    def fetch(spec):
        started = time.perf_counter()
        try:
            download_catalog(spec, archive.catalog_path(spec))
            size = archive.catalog_path(spec).stat().st_size
            return f"ok   {spec.coverage_id}: {size / 1024:.0f} KB in {time.perf_counter() - started:.1f}s"
        except Exception as exc:
            return f"FAIL {spec.coverage_id}: {exc}"

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(fetch, todo))
    for line in results:
        print(line)
    failed = [line for line in results if line.startswith("FAIL")]
    total = sum(p.stat().st_size for p in archive.root.joinpath("catalogs").glob("*.vrt"))
    print(f"{len(specs) - len(failed)}/{len(specs)} catalogs ready, {total / 1024 / 1024:.1f} MB")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
