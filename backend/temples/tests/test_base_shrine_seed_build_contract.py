"""W0-B01 Base Shrine Seed build contract。

`scripts/build_base_shrine_seed.py` が現在のBase Shrine Seed
（`temples/data/shrines_seed_clean.json`）を、同一入力から毎回bit単位で
同一に再生成できることを固定する。

本ファイルが守る契約:

* commit済みSeedがbuilderの出力とbyte単位で一致する（再build差分ゼロ）。
* 同一入力から2回buildしてSHA-256が一致する。
* 全行がcanonical key順を持つ。
* Shrine identity `(name_jp, address)` がbuildで変化しない。
* Base Seed schemaが `CANONICAL_KEY_ORDER` の9keyから増減しない。

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


def test_every_row_uses_the_canonical_key_order(builder, source_rows):
    for row in source_rows:
        assert tuple(row.keys()) == builder.CANONICAL_KEY_ORDER, row.get("name_jp")


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
