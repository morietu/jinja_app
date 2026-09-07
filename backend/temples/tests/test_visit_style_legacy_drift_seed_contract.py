"""Visit Style legacy drift cleanup contract.

PR-B1.5で既存51社の ``visit_style_tags`` から canonical taxonomy 外の
legacy tagだけを削除した状態を固定する。

このtestは52社のcanonical追加を扱わない。Base Seedの部分適用
（51 tagged / 52 missing）はPR-B2まで維持する。
"""

from __future__ import annotations

import json
from pathlib import Path


SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "shrines_seed_clean.json"

ALLOWED_SHRINE_VISIT_STYLE_TAGS = frozenset(
    {
        "quiet",
        "less_crowded",
        "nature",
        "reset",
        "classic",
        "business",
        "study",
        "urban",
    }
)

FORBIDDEN_LEGACY_TAGS = frozenset({"love", "formal", "tourism"})

EXPECTED_CLEANED_TARGETS = {
    "浅草神社": ["classic", "less_crowded"],
    "川越氷川神社": ["classic", "nature"],
    "日枝神社": ["quiet", "classic"],
    "東京大神宮": ["quiet", "urban"],
    "江島神社": ["nature", "reset"],
    "貴船神社": ["nature", "quiet"],
    "赤坂氷川神社": ["quiet", "urban"],
    "白山神社": ["quiet", "urban"],
    "多摩川浅間神社": ["nature", "quiet"],
    "櫻木神社": ["study", "reset"],
    "足利織姫神社": ["study", "business"],
    "森戸大明神": ["nature", "reset"],
    "九頭龍神社 新宮": ["nature", "reset"],
}


def _load_seed() -> list[dict]:
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


def test_base_seed_visit_style_coverage_is_unchanged_by_legacy_cleanup():
    data = _load_seed()
    with_tags = [row for row in data if "visit_style_tags" in row]
    without_tags = [row for row in data if "visit_style_tags" not in row]

    assert len(data) == 103
    assert len(with_tags) == 51
    assert len(without_tags) == 52


def test_cleaned_legacy_targets_have_the_exact_mother_ship_approved_arrays():
    data = _load_seed()
    rows_by_name = {row["name_jp"]: row for row in data}

    assert len(EXPECTED_CLEANED_TARGETS) == 13
    for name, expected_tags in EXPECTED_CLEANED_TARGETS.items():
        assert name in rows_by_name
        assert rows_by_name[name]["visit_style_tags"] == expected_tags


def test_tagged_seed_rows_use_only_the_allowed_canonical_vocabulary():
    data = _load_seed()
    tagged_rows = [row for row in data if "visit_style_tags" in row]

    for row in tagged_rows:
        tags = row["visit_style_tags"]
        assert isinstance(tags, list), row["name_jp"]
        assert 1 <= len(tags) <= 3, row["name_jp"]
        assert all(isinstance(tag, str) and tag.strip() for tag in tags), row["name_jp"]
        assert len(tags) == len(set(tags)), row["name_jp"]
        assert set(tags) <= ALLOWED_SHRINE_VISIT_STYLE_TAGS, row["name_jp"]
        assert not (set(tags) & FORBIDDEN_LEGACY_TAGS), row["name_jp"]
        assert "nearby" not in tags, row["name_jp"]


def test_forbidden_legacy_tags_are_absent_from_all_shrine_visit_style_tags():
    data = _load_seed()
    occurrences = {
        tag: [
            row["name_jp"]
            for row in data
            if tag in (row.get("visit_style_tags") or [])
        ]
        for tag in FORBIDDEN_LEGACY_TAGS
    }

    assert occurrences == {"formal": [], "love": [], "tourism": []}
