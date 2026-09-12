"""Visit Style legacy drift cleanup contract.

PR-B1.5で既存51社の ``visit_style_tags`` から canonical taxonomy 外の
legacy tagだけを削除した状態を固定する。

PR-B2で承認済み52社をcanonical Seedへ追加し、canonical管理対象103社が
visit_style_tagsを持つ状態を固定する。

Base Seedの総件数はもう固定しない。新規Shrineは``visit_style_tags`` key
なし（未レビュー / unmanaged）で追加されうる。固定するのは

* canonical 管理対象（keyあり）が103社を下回らないこと
* keyがある行は必ずnon-emptyなcanonical tagsを持つこと

の2点。
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


MANAGED_COHORT_MIN_COUNT = 103


def test_canonical_managed_cohort_never_shrinks_below_103():
    data = _load_seed()
    with_tags = [row for row in data if "visit_style_tags" in row]

    assert len(with_tags) >= MANAGED_COHORT_MIN_COUNT


def test_every_key_present_row_carries_non_empty_canonical_tags():
    # keyありは「レビュー済み」の意味。空配列は未レビューの表現ではない。
    data = _load_seed()

    for row in data:
        if "visit_style_tags" not in row:
            continue
        tags = row["visit_style_tags"]
        assert isinstance(tags, list), row["name_jp"]
        assert tags, row["name_jp"]
        assert set(tags) <= ALLOWED_SHRINE_VISIT_STYLE_TAGS, row["name_jp"]


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
