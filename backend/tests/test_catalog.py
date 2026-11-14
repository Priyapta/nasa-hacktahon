"""Offline catalog checks: evidence, scientific units, and published API contract."""

import json
import shutil

import httpx
import pytest
from fastapi.testclient import TestClient

from app.catalog import DATA_DIR, load_catalog
from app.main import create_app


def test_reviewed_values_and_prd_slots():
    crops = {c.crop_id: c for c in load_catalog().crops}
    # Pin reviewed source transcription, including optimal/absolute column order.
    expected = {
        "padi_sawah": (4, 10, 20, 30, 36, 4.5, 9, 450, 700),
        "jagung": (4, 10, 18, 33, 47, 4.5, 8.5, 500, 800),
        "kedelai": (3, 10, 20, 33, 38, 4.5, 8.4, 450, 700),
        "kacang_hijau": (2, 8, 21, 36, 40, 4.3, 8.3, 300, 500),
        "orok_orok": (2, 4, 20, 30, 40, 5, 8.4, None, None),
        "bera": (None, None, None, None, None, None, None, 0, 0),
    }
    for crop_id, values in expected.items():
        c = crops[crop_id]
        assert (
            c.slot_bulan,
            c.t_abs_min,
            c.t_opt_min,
            c.t_opt_max,
            c.t_abs_max,
            c.ph_abs_min,
            c.ph_abs_max,
            c.air_min_mm,
            c.air_max_mm,
        ) == values
    assert crops["orok_orok"].k5_mode == "exempt_unknown_water"
    assert crops["kacang_hijau"].water_basis == "bean_proxy"
    assert crops["bera"].k5_mode == "not_applicable"
    assert {c.crop_id for c in crops.values() if c.penambat_n} == {
        "kedelai",
        "kacang_hijau",
        "orok_orok",
    }
    assert not any(c.aturan_urutan for c in crops.values())


def test_sourced_candidates_keep_mapping_and_draft_disclosures():
    catalog = load_catalog()
    candidates = catalog.candidate_rotations()
    assert len(candidates) == 8
    assert sum(r.evidence_basis == "reported_sequence" for r in candidates) == 4
    assert sum(r.evidence_basis == "local_pattern_mapping" for r in candidates) == 4
    assert all(r.evidence_scope == "grobogan" for r in candidates)
    assert len([r for r in catalog.rotations if r.status == "draft"]) == 2
    assert all("orok_orok" not in [s.crop_id for s in r.stages] for r in candidates)
    assert all(
        len(r.catatan["id"]) >= 2
        for r in candidates
        if r.evidence_basis == "local_pattern_mapping"
    )
    assert any(
        [s.crop_id for s in r.stages][:2] == ["padi_sawah", "padi_sawah"]
        for r in candidates
    )


def test_crops_http_is_localized_and_offline(monkeypatch):
    def network_forbidden(*args, **kwargs):
        raise AssertionError("Catalog must not fetch sources at runtime")

    monkeypatch.setattr(httpx, "get", network_forbidden)
    monkeypatch.setattr(httpx.AsyncClient, "get", network_forbidden)
    with TestClient(create_app()) as client:
        indonesian = client.get("/api/v1/crops")
        english = client.get("/api/v1/crops?lang=en")
        assert indonesian.status_code == english.status_code == 200
        a, b = indonesian.json()["crops"], english.json()["crops"]
        assert len(a) == len(b) == 6
        assert a[0]["nama"] == "Padi sawah"
        assert b[0]["nama"] == "Paddy rice"
        assert a[-1]["slot_bulan"] is None
        assert all(set(c) == {"crop_id", "nama", "peran", "slot_bulan"} for c in a)
        assert client.get("/api/v1/crops?lang=xx").status_code == 400
        assert client.get("/api/v1/crops?unknown=true").status_code == 400
        responses = client.get("/openapi.json").json()["paths"]["/api/v1/crops"]["get"][
            "responses"
        ]
        assert "400" in responses and "422" not in responses
        assert client.post("/api/v1/analyze", json={}).status_code == 404


@pytest.fixture
def copied_catalog(tmp_path):
    root = tmp_path / "catalog"
    shutil.copytree(DATA_DIR, root)
    return root


def edit(root, filename, mutate):
    path = root / filename
    doc = json.loads(path.read_text())
    mutate(doc)
    path.write_text(json.dumps(doc))


@pytest.mark.parametrize(
    "filename,mutate",
    [
        ("crops.json", lambda d: d["crops"][0]["sumber"].pop("t_abs_min")),
        (
            "crops.json",
            lambda d: d["crops"][0]["sumber"]["t_abs_min"][0].update(
                source_id="unknown"
            ),
        ),
        ("crops.json", lambda d: d["crops"][4].update(air_min_mm=0, air_max_mm=0)),
        ("crops.json", lambda d: d["crops"][3].update(water_basis="direct_fao")),
        ("crops.json", lambda d: d["crops"][0]["nama"].pop("en")),
        ("crops.json", lambda d: d["crops"].append(d["crops"][0])),
        ("crops.json", lambda d: d["crops"][0].update(t_opt_min=-20)),
        (
            "rotations.json",
            lambda d: d["rotations"][-1].update(status="source_checked"),
        ),
        ("rotations.json", lambda d: d["rotations"].append(d["rotations"][0])),
        (
            "rotations.json",
            lambda d: d["rotations"][0]["stages"][0].update(crop_id="unknown"),
        ),
        ("rotations.json", lambda d: d.update(version="different")),
        ("sources.json", lambda d: d["sources"].append(d["sources"][0])),
    ],
)
def test_catalog_rejects_damaged_or_unsubstantiated_data(
    copied_catalog, filename, mutate
):
    edit(copied_catalog, filename, mutate)
    with pytest.raises(ValueError):
        load_catalog(copied_catalog)


def test_content_hash_changes_when_source_notes_change(copied_catalog, tmp_path):
    other = tmp_path / "other"
    shutil.copytree(copied_catalog, other)
    edit(
        other,
        "sources.json",
        lambda d: d["sources"][0].update(title="Reviewed PRD reference"),
    )
    assert load_catalog(copied_catalog).version != load_catalog(other).version


def test_crop_fixture_matches_live_catalog():
    path = DATA_DIR.parents[1] / "contracts" / "fixtures" / "crops.json"
    assert json.loads(path.read_text()) == load_catalog().crop_options("id").model_dump(
        mode="json"
    )
