"""Package verified native soil samples; ZIP stays outside version control."""

import hashlib
import json
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.soil_archive import ROOT, SoilArchive, SoilSpec
from app.services.power_archive import atomic_json, utc_now


def main():
    status = json.loads((ROOT / "prepare-status.json").read_text())
    if status["state"] != "complete" or status["completed"] != 45 or status["failures"]:
        raise RuntimeError(
            "Prepare all 45 soil sample layers successfully before packaging"
        )
    archive = SoilArchive()
    entries = []
    for path in sorted((ROOT / "raw").glob("*.tif")):
        saved = json.loads(path.with_suffix(".json").read_text())
        prop, depth, statistic = saved["coverage_id"].split("_")
        spec = SoilSpec(prop, depth, statistic, tuple(saved["bounds"]))
        metadata = archive.cached(spec)
        if metadata is None:
            raise RuntimeError("Invalid cache layer: " + path.name)
        entries.append(
            {
                "file": "raw/" + path.name,
                "metadata": "raw/" + path.with_suffix(".json").name,
                "sha256": metadata["sha256"],
            }
        )
    if len(entries) != 45:
        raise RuntimeError("Expected exactly the 45 shared sample layers")
    folder = ROOT.parents[1] / "cache-archives"
    name = "soilgrids-grobogan-samples-v1.zip"
    target = folder / name
    manifest = {
        "source": "SoilGrids 2.0",
        "created_at": utc_now(),
        "data_files": 45,
        "metadata_files": 45,
        "coverage": "Three provisional small test polygons near Grobogan, not all Indonesia",
        "samples": json.loads((ROOT / "samples.json").read_text()),
        "license": "CC BY 4.0",
        "attribution": "ISRIC - World Soil Information, SoilGrids 2.0",
        "reference": "https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html",
        "files": entries,
    }
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as stream:
        for entry in entries:
            stream.write(ROOT / entry["file"], entry["file"])
            stream.write(ROOT / entry["metadata"], entry["metadata"])
        stream.writestr(
            "raw/archive-manifest.json", json.dumps(manifest, indent=2) + "\n"
        )
    with zipfile.ZipFile(target) as stream:
        if stream.testzip() is not None:
            raise RuntimeError("ZIP CRC validation failed")
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    inventory_path = folder / "manifest.json"
    inventory = json.loads(inventory_path.read_text())
    inventory["archives"] = [
        entry for entry in inventory["archives"] if entry["filename"] != name
    ]
    inventory["archives"].append(
        {
            "id": "soilgrids-grobogan-samples-v1",
            "filename": name,
            "status": "ready",
            "upload_status": "not_uploaded",
            "upload_url": None,
            "bytes": target.stat().st_size,
            "sha256": digest,
            "contents": {
                "geotiff_files": 45,
                "metadata_json_files": 45,
                "depth": "0-30cm",
                "properties": ["phh2o", "soc", "clay", "sand", "silt"],
                "coverage": "Three provisional small Grobogan sample polygons, not Indonesia-wide",
            },
            "required_for": "Offline soil sample smoke checks",
            "extract_to": "backend/data/soilgrids",
            "include_in_git": False,
        }
    )
    atomic_json(inventory_path, inventory)
    checksums = folder / "checksums.sha256"
    lines = [
        line
        for line in checksums.read_text().splitlines()
        if not line.endswith("  " + name)
    ]
    checksums.write_text("\n".join(lines + [digest + "  " + name]) + "\n")
    print(
        json.dumps(
            {"archive": str(target), "bytes": target.stat().st_size, "sha256": digest},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
