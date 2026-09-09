"""Contract for the immutable Production Visit Style rollback snapshot."""

from __future__ import annotations

import json
from pathlib import Path

from temples.management.commands.restore_visit_style_tags_snapshot import (
    snapshot_core_payload,
    validate_snapshot,
)
from temples.management.commands.sync_visit_style_tags_from_seed import (
    compute_snapshot_sha256,
)

SNAPSHOT_PATH = (
    Path(__file__).resolve().parents[1]
    / "data/ops/visit_style_production_before_20260909T040450Z.json"
)
EXPECTED_SOURCE_SEED_SHA256 = (
    "15dc4bd475cbb857b23aafbfb59832e4bf0934b6c8c91b196002f5a56a172838"
)
EXPECTED_SNAPSHOT_SHA256 = (
    "f584954df14c22ebb86654b45dcaed4cdd6374b4f42c0bba4deaacdbb4ef315e"
)
EXPECTED_TOP_LEVEL_KEYS = {
    "snapshot_version",
    "source_seed_sha256",
    "planned_update_count",
    "rows",
    "snapshot_sha256",
}
EXPECTED_ROW_KEYS = {"id", "name_jp", "address", "before", "after"}


def _load_snapshot() -> dict:
    return json.loads(SNAPSHOT_PATH.read_bytes().decode("utf-8"))


def test_production_snapshot_contract():
    assert SNAPSHOT_PATH.is_file()

    snapshot = _load_snapshot()
    assert set(snapshot) == EXPECTED_TOP_LEVEL_KEYS
    assert snapshot["snapshot_version"] == 1
    assert snapshot["planned_update_count"] == 64
    assert len(snapshot["rows"]) == 64

    rows = snapshot["rows"]
    assert len({row["id"] for row in rows}) == 64
    assert len({(row["name_jp"], row["address"]) for row in rows}) == 64
    assert all(set(row) == EXPECTED_ROW_KEYS for row in rows)

    validate_snapshot(snapshot)

    recomputed = compute_snapshot_sha256(snapshot_core_payload(snapshot))
    assert recomputed == snapshot["snapshot_sha256"]
    assert recomputed == EXPECTED_SNAPSHOT_SHA256
    assert snapshot["source_seed_sha256"] == EXPECTED_SOURCE_SEED_SHA256
