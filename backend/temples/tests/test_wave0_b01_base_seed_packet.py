from __future__ import annotations

import json
from pathlib import Path

from temples.management.commands.import_shrines_seed import CANONICAL_GORIYAKU_TAG_IDS
from temples.models import GoriyakuTag


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
BATCH_PATH = DATA_DIR / "base_seed_batches" / "wave0_batch_01.json"
BASE_SEED_PATH = DATA_DIR / "shrines_seed_clean.json"

EXPECTED_NAMES = ["三輪神社", "大鳥大社", "御岩神社", "烏森神社", "榴岡天満宮"]


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_wave0_b01_packet_has_exact_five_unique_rows():
    rows = _load(BATCH_PATH)
    assert [row["name_jp"] for row in rows] == EXPECTED_NAMES
    identities = [(row["name_jp"], row["address"]) for row in rows]
    assert len(identities) == len(set(identities)) == 5


def test_wave0_b01_packet_has_required_base_seed_fields_and_matching_location():
    rows = _load(BATCH_PATH)
    for row in rows:
        for field in ("name_jp", "address", "latitude", "longitude", "goriyaku", "goriyaku_tags"):
            assert field in row
        assert row["latitude"] == row["location"]["lat"]
        assert row["longitude"] == row["location"]["lng"]
        assert row["goriyaku"].split("・") == row["goriyaku_tags"]
        assert row["goriyaku_tags"]
        assert len(row["goriyaku_tags"]) == len(set(row["goriyaku_tags"]))


def test_wave0_b01_packet_does_not_duplicate_existing_base_seed_identity():
    batch = _load(BATCH_PATH)
    base = _load(BASE_SEED_PATH)
    existing = {(row["name_jp"], row["address"]) for row in base}
    for row in batch:
        assert (row["name_jp"], row["address"]) not in existing


def test_canonical_master_id_contract_constant_is_1_through_39():
    assert CANONICAL_GORIYAKU_TAG_IDS == tuple(range(1, 40))
