import hashlib
import json
import sys
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shapely.geometry import box

from app.config import DEFAULT_DEMO_BBOX
from app.core.soil import DEPTHS, PROPERTIES, STATISTICS, project_polygon
from app.services.power_archive import utc_now
from app.services.soil_archive import ROOT, SoilArchive, SoilSpec, bounds_for_polygon

# Builds the Grobogan soil layers (45 rasters covering the demo bounding box)
# and packages them with the 45 local Indonesia catalogs into one ZIP for the
# server. Fields inside Grobogan are then cut from local rasters without any
# request to ISRIC. Run prepare_soil_catalogs.py first.

NAME = "soilgrids-indonesia-catalogs-grobogan-v1.zip"


def main() -> int:
    archive = SoilArchive()
    bounds = bounds_for_polygon(project_polygon(box(*DEFAULT_DEMO_BBOX)))
    specs = [
        SoilSpec(prop, depth, stat, bounds)
        for prop in PROPERTIES
        for stat in STATISTICS
        for depth, _ in DEPTHS
    ]
    catalogs = sorted((ROOT / "catalogs").glob("*.vrt"))
    if len(catalogs) != len(specs):
        print(f"Expected {len(specs)} catalogs, found {len(catalogs)}. Run prepare_soil_catalogs.py")
        return 1

    with ThreadPoolExecutor(max_workers=4) as pool:
        layers = list(pool.map(archive.ensure, specs))
    print(f"Grobogan layers ready: {len(layers)} ({sum(not m['cache_hit'] for m in layers)} downloaded)")

    folder = ROOT.parents[1] / "cache-archives"
    target = folder / NAME
    files = [f"catalogs/{p.name}" for p in catalogs]
    for metadata in layers:
        tif = f"raw/{metadata['filename']}"
        files += [tif, tif.replace(".tif", ".json")]
    manifest = {
        "source": "SoilGrids 2.0",
        "created_at": utc_now(),
        "catalogs": len(catalogs),
        "catalog_coverage_bbox": [94, -12, 142, 7],
        "region": "Grobogan demo bounding box",
        "region_bbox": list(DEFAULT_DEMO_BBOX),
        "region_bounds_igh": list(bounds),
        "region_layers": len(layers),
        "license": "CC BY 4.0",
        "attribution": "ISRIC - World Soil Information, SoilGrids 2.0",
    }
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as stream:
        for name in files:
            stream.write(ROOT / name, name)
        stream.writestr("soil-region-manifest.json", json.dumps(manifest, indent=2) + "\n")
    with zipfile.ZipFile(target) as stream:
        if stream.testzip() is not None:
            raise RuntimeError("ZIP CRC validation failed")

    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    inventory_path = folder / "manifest.json"
    inventory = json.loads(inventory_path.read_text())
    inventory["archives"] = [a for a in inventory["archives"] if a["filename"] != NAME]
    inventory["archives"].append(
        {
            "id": NAME.removesuffix(".zip"),
            "filename": NAME,
            "status": "ready",
            "upload_status": "not_uploaded",
            "upload_url": None,
            "bytes": target.stat().st_size,
            "sha256": digest,
            "contents": {
                "vrt_catalogs": len(catalogs),
                "catalog_coverage_bbox": [94, -12, 142, 7],
                "region_geotiff_files": len(layers),
                "region_metadata_json_files": len(layers),
                "region": "Grobogan demo bounding box",
                "depth": "0-30cm",
            },
            "required_for": "Fast soil lookups: local Indonesia catalogs and offline Grobogan soil",
            "extract_to": "backend/data/soilgrids",
            "include_in_git": False,
        }
    )
    inventory_path.write_text(json.dumps(inventory, indent=2) + "\n")
    checksums = folder / "checksums.sha256"
    lines = [line for line in checksums.read_text().splitlines() if not line.endswith(NAME)]
    checksums.write_text("\n".join(lines + [f"{digest}  {NAME}"]) + "\n")
    print(f"{NAME}: {target.stat().st_size / 1024 / 1024:.1f} MB, sha256 {digest[:12]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
