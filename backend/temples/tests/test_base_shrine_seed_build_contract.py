"""W0-B01 Base Shrine Seed build contract。

`scripts/build_base_shrine_seed.py` が現在のBase Shrine Seed
（`temples/data/shrines_seed_clean.json`）を、同一入力から毎回bit単位で
同一に再生成できることを固定する。

本ファイルが守る契約:

* commit済みSeedがbuilderの出力とbyte単位で一致する（再build差分ゼロ）。
* 同一入力から2回buildしてSHA-256が一致する。
* 全行がcanonical key順を持つ（optional keyを除いた部分列として）。
* Shrine identity `(name_jp, address)` がbuildで変化しない。
* Base Seed schemaが `CANONICAL_KEY_ORDER` の9keyから増減しない。
* `visit_style_tags` のmanaged / unmanaged契約をbuilderが強制する。
  Importer / Sync / Builder の3経路で意味が完全一致していること。

件数・Batch17 identity・visit_style_tagsの意味内容は既存の
`test_shrine_base_batch17_seed.py` / `test_visit_style_legacy_drift_seed_contract.py`
が正本であり、ここでは重複させない。
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
BUILDER_PATH = REPO_ROOT / "scripts" / "build_base_shrine_seed.py"


def _load_builder():
    spec = importlib.util.spec_from_file_location(
        "build_base_shrine_seed", BUILDER_PATH
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def builder():
    return _load_builder()


@pytest.fixture(scope="module")
def source_rows(builder):
    return builder.load_source(builder.SOURCE_PATH)


@pytest.fixture(scope="module")
def built_rows(builder, source_rows):
    return [builder.canonicalize_row(row) for row in source_rows]


def test_builder_script_exists_at_the_documented_path():
    assert BUILDER_PATH.exists()


def test_committed_seed_is_byte_identical_to_the_builder_output(builder, built_rows):
    # 再buildで差分が発生しないこと。差分が出る場合は
    # `python scripts/build_base_shrine_seed.py` を実行して結果をcommitする。
    committed = builder.SOURCE_PATH.read_text(encoding="utf-8")
    assert committed == builder.serialize(built_rows)


def test_repeated_build_produces_the_same_sha256(builder, built_rows):
    first = builder.sha256_of(builder.serialize(built_rows))
    second = builder.sha256_of(builder.serialize(built_rows))
    assert first == second


def _expected_key_order(builder, row) -> tuple[str, ...]:
    """行が実際に持つkeyだけに絞ったcanonical key順。

    optional key（`visit_style_tags`）を持たない未レビュー行も、残りのkeyは
    canonical順に並んでいなければならない。
    """
    return tuple(key for key in builder.CANONICAL_KEY_ORDER if key in row)


def test_every_row_uses_the_canonical_key_order(builder, source_rows):
    for row in source_rows:
        assert tuple(row.keys()) == _expected_key_order(builder, row), row.get("name_jp")


def test_every_location_object_uses_the_canonical_key_order(builder, source_rows):
    for row in source_rows:
        assert (
            tuple(row["location"].keys()) == builder.CANONICAL_LOCATION_KEY_ORDER
        ), row.get("name_jp")


def test_build_does_not_mutate_shrine_identity(builder, source_rows, built_rows):
    # Importerは (name_jp, address) で既存Shrineを引き、Knowledge Seedの
    # shrine_ref も同じpairで解決する。builderがこの値を変えてはならない。
    result = builder.validate(source_rows, built_rows)
    assert result["identity_mutations"] == []


def test_all_validation_gates_pass(builder, source_rows, built_rows):
    result = builder.validate(source_rows, built_rows)
    assert builder.gate_failures(result) == []
    assert result["duplicate_identity"] == []
    assert result["duplicate_id"] == []
    assert result["missing_required"] == []
    assert result["schema_violations"] == []
    assert result["prefecture_unresolved"] == []


def test_base_seed_does_not_carry_id_or_prefecture_fields(builder, source_rows):
    # W0-B01の決定: Base Seedはschema拡張しない。prefectureは住所からの
    # derived valueとして扱い、Seedへは永続化しない。
    assert "id" not in builder.EXPECTED_KEYS
    assert "prefecture" not in builder.EXPECTED_KEYS
    for row in source_rows:
        assert "id" not in row, row.get("name_jp")
        assert "prefecture" not in row, row.get("name_jp")


def test_prefecture_is_derivable_for_every_row(builder, source_rows):
    for row in source_rows:
        assert builder.derive_prefecture(row["address"]) is not None, row["name_jp"]


# --------------------------------------------------------------------------
# visit_style_tags managed / unmanaged 契約
#
# 正本契約（Importer / Sync / Builder の3経路で同一）:
#   key なし          = unmanaged / 未レビュー
#   key あり + 1〜3件  = managed / canonical
#   key あり + []      = invalid / fail closed
#   unknown / legacy / request-only / duplicate tag = invalid
# --------------------------------------------------------------------------


def _row(**overrides) -> dict:
    """W0-DB01形式の1行。`visit_style_tags` は明示したときだけ載る。"""
    row = {
        "name_jp": "契約テスト未レビュー神社",
        "address": "東京都千代田区丸の内1-1-1",
        "latitude": 35.6812,
        "longitude": 139.7671,
        "goriyaku": "開運",
        "kyusei": None,
        "astro_elements": [],
        "location": {"lat": 35.6812, "lng": 139.7671},
    }
    row.update(overrides)
    return row


def _gate(builder, rows):
    built = [builder.canonicalize_row(row) for row in rows]
    return builder.gate_failures(builder.validate(rows, built))


def _violations(builder, rows):
    built = [builder.canonicalize_row(row) for row in rows]
    return builder.validate(rows, built)["visit_style_violations"]


# 1. keyなしrowはbuilder PASS
def test_row_without_the_visit_style_tags_key_passes_the_builder(builder):
    rows = [_row()]

    assert _gate(builder, rows) == []
    assert _violations(builder, rows) == []


def test_builder_never_adds_a_visit_style_tags_key_to_an_unmanaged_row(builder):
    # 空listを補うと「レビュー済みでタグ0件」と区別できなくなる。
    built = builder.canonicalize_row(_row())

    assert "visit_style_tags" not in built
    assert tuple(built.keys()) == _expected_key_order(builder, built)


# 2. keyありcanonical tagsはPASS
@pytest.mark.parametrize(
    "tags",
    [
        ["classic"],
        ["quiet", "nature"],
        ["urban", "classic", "business"],
    ],
)
def test_row_with_canonical_visit_style_tags_passes_the_builder(builder, tags):
    rows = [_row(visit_style_tags=list(tags))]

    assert _gate(builder, rows) == []
    assert _violations(builder, rows) == []


def test_builder_does_not_rewrite_canonical_visit_style_tag_values(builder):
    # 順序も含めて値をそのまま通すこと（sort / dedupe / 正規化をしない）。
    tags = ["urban", "classic", "business"]
    built = builder.canonicalize_row(_row(visit_style_tags=list(tags)))

    assert built["visit_style_tags"] == tags


# 3. keyあり空listはFAIL
def test_present_but_empty_visit_style_tags_fails_the_build(builder):
    rows = [_row(visit_style_tags=[])]

    assert "VISIT_STYLE_INVALID != 0" in _gate(builder, rows)
    assert any("present but empty" in v for v in _violations(builder, rows))


# 4. unknown tagはFAIL
def test_unknown_visit_style_tag_fails_the_build(builder):
    rows = [_row(visit_style_tags=["classic", "sunset_view"])]

    assert "VISIT_STYLE_INVALID != 0" in _gate(builder, rows)
    assert any("outside the allowed taxonomy" in v for v in _violations(builder, rows))


# 5. duplicate tagはFAIL
def test_duplicate_visit_style_tag_fails_the_build(builder):
    rows = [_row(visit_style_tags=["classic", "classic"])]

    assert "VISIT_STYLE_INVALID != 0" in _gate(builder, rows)
    assert any("duplicate tag" in v for v in _violations(builder, rows))


# 6. request-only nearbyはFAIL
def test_request_only_nearby_tag_fails_the_build(builder):
    rows = [_row(visit_style_tags=["classic", "nearby"])]

    assert "VISIT_STYLE_INVALID != 0" in _gate(builder, rows)
    assert any("request-only" in v for v in _violations(builder, rows))


# 7. legacy love/formal/tourismはFAIL
@pytest.mark.parametrize("tag", ["love", "formal", "tourism"])
def test_forbidden_legacy_visit_style_tag_fails_the_build(builder, tag):
    rows = [_row(visit_style_tags=["classic", tag])]

    assert "VISIT_STYLE_INVALID != 0" in _gate(builder, rows)
    assert any("forbidden legacy label" in v for v in _violations(builder, rows))


def test_visit_style_cardinality_above_three_fails_the_build(builder):
    rows = [_row(visit_style_tags=["classic", "quiet", "nature", "urban"])]

    assert "VISIT_STYLE_INVALID != 0" in _gate(builder, rows)
    assert any("cardinality must be 1-3" in v for v in _violations(builder, rows))


def test_non_list_visit_style_tags_fails_the_build(builder):
    rows = [_row(visit_style_tags="classic")]

    assert "VISIT_STYLE_INVALID != 0" in _gate(builder, rows)
    assert any("must be a list" in v for v in _violations(builder, rows))


# 8. existing canonical Seedはdeterministic
def test_existing_canonical_seed_rebuilds_deterministically(builder):
    # 独立した2回のload + buildがbyte単位で一致すること。
    first = builder.serialize(
        [builder.canonicalize_row(r) for r in builder.load_source(builder.SOURCE_PATH)]
    )
    second = builder.serialize(
        [builder.canonicalize_row(r) for r in builder.load_source(builder.SOURCE_PATH)]
    )

    assert first == second
    assert builder.sha256_of(first) == builder.sha256_of(second)
    assert builder.SOURCE_PATH.read_text(encoding="utf-8") == first


def test_existing_canonical_seed_is_fully_managed(builder, source_rows):
    # 既存103社はすべてkeyを持つ（未レビュー扱いへ退行していない）。
    built = [builder.canonicalize_row(row) for row in source_rows]
    result = builder.validate(source_rows, built)

    assert result["managed_visit_style_rows"] == len(source_rows)
    assert result["unmanaged_visit_style_rows"] == 0
    assert result["visit_style_violations"] == []


# 9. W0-DB01形式のunmanaged追加rowを含むSeedでもbuild可能
def test_seed_with_appended_unmanaged_rows_still_builds(builder, source_rows):
    # 実データ5社は追加しない。形式だけ同じplaceholderで契約を固定する。
    appended = [
        _row(
            name_jp=f"契約テスト未レビュー神社{i}",
            address=f"神奈川県横浜市中区山下町{i}-1",
        )
        for i in range(1, 6)
    ]
    rows = list(source_rows) + appended
    built = [builder.canonicalize_row(row) for row in rows]
    result = builder.validate(rows, built)

    assert builder.gate_failures(result) == []
    assert result["total"] == len(source_rows) + 5
    assert result["managed_visit_style_rows"] == len(source_rows)
    assert result["unmanaged_visit_style_rows"] == 5
    assert result["identity_mutations"] == []
    assert result["schema_violations"] == []
    assert result["prefecture_unresolved"] == []

    # serializationは通り、既存103行のbyte表現は前置部としてそのまま残る。
    payload = builder.serialize(built)
    assert isinstance(payload, str)
    for appended_row in built[len(source_rows) :]:
        assert "visit_style_tags" not in appended_row


def test_appended_unmanaged_rows_do_not_touch_the_committed_seed_file(builder):
    # validate / serialize は純粋関数であり、ファイルへ書き戻さない。
    before = builder.SOURCE_PATH.read_text(encoding="utf-8")
    rows = builder.load_source(builder.SOURCE_PATH) + [_row()]
    builder.serialize([builder.canonicalize_row(row) for row in rows])

    assert builder.SOURCE_PATH.read_text(encoding="utf-8") == before


# --------------------------------------------------------------------------
# 3経路 taxonomy drift
# --------------------------------------------------------------------------


def test_builder_taxonomy_matches_the_canonical_command_module(builder):
    """builderはDjango非依存のためtaxonomyをローカル保持している。

    正本（`sync_visit_style_tags_from_seed`）とずれた瞬間に、Builderが通した
    Seedを Importer / Sync が拒否する（またはその逆）状態が生まれるため、
    ここで両者の一致を固定する。
    """
    from temples.management.commands import sync_visit_style_tags_from_seed as canonical

    assert builder.ALLOWED_VISIT_STYLE_TAGS == canonical.ALLOWED_VISIT_STYLE_TAGS
    assert builder.REQUEST_ONLY_TAGS == canonical.REQUEST_ONLY_TAGS
    assert builder.FORBIDDEN_LEGACY_TAGS == canonical.FORBIDDEN_LEGACY_TAGS
    assert builder.MIN_TAGS_PER_SHRINE == canonical.MIN_TAGS_PER_SHRINE
    assert builder.MAX_TAGS_PER_SHRINE == canonical.MAX_TAGS_PER_SHRINE


def test_visit_style_tags_is_an_optional_schema_key(builder):
    assert "visit_style_tags" in builder.EXPECTED_KEYS
    assert "visit_style_tags" in builder.OPTIONAL_KEYS
    assert "visit_style_tags" not in builder.REQUIRED_SCHEMA_KEYS
    # identity / location など他のkeyは必須のまま。
    assert builder.REQUIRED_SCHEMA_KEYS == builder.EXPECTED_KEYS - {"visit_style_tags"}
