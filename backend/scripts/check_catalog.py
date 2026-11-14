"""Validate all local crop/rotation evidence and print a review summary."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.catalog import load_catalog

if __name__ == "__main__":
    catalog = load_catalog()
    print(
        json.dumps(
            {
                "version": catalog.version,
                "crops": catalog.crop_options("id").model_dump(mode="json"),
                "candidate_count": len(catalog.candidate_rotations()),
                "candidate_sequences": [
                    {
                        "id": r.id,
                        "basis": r.evidence_basis,
                        "stages": [s.model_dump() for s in r.stages],
                    }
                    for r in catalog.candidate_rotations()
                ],
                "disabled_drafts": [
                    r.id for r in catalog.rotations if r.status == "draft"
                ],
                "hard_sequence_rules": sum(len(c.aturan_urutan) for c in catalog.crops),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
