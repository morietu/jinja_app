"""W0-B02 Production Shrine Reconciliation Gate contract。

`scripts/reconcile_production_shrine_identity.py` が Base Shrine Seed と
Production Shrine 母集団を exact `(name_jp, address)` 単位で突合し、
差分を修正せずSTOPすることを固定する。

本ファイルはDBを必要としない。分類ロジックとsnapshot parseだけを扱う。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
GATE_PATH = REPO_ROOT / "scripts" / "reconcile_production_shrine_identity.py"
SQL_PATH = (
    REPO_ROOT
    / "scripts"
    / "migration_safety"
    / "sql"
    / "shrine_identity_reconciliation.sql"
)


def _load_gate():
    spec = importlib.util.spec_from_file_location(
        "reconcile_production_shrine_identity", GATE_PATH
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def gate():
    return _load_gate()


def _seed(*pairs):
    return [{"name_jp": name, "address": address} for name, address in pairs]


def _prod(*triples):
    return [
        {"id": db_id, "name_jp": name, "address": address, "kind": "shrine"}
        for db_id, name, address in triples
    ]


# ---------------------------------------------------------------------------
# 分類
# ---------------------------------------------------------------------------


def test_status_is_pass_when_both_sides_are_identical(gate):
    seed = _seed(("明治神宮", "東京都A"), ("波上宮", "沖縄県B"))
    production = _prod((1, "明治神宮", "東京都A"), (2, "波上宮", "沖縄県B"))

    result = gate.reconcile(seed, production)

    assert result["status"] == "PASS"
    assert result["base_seed_total"] == 2
    assert result["production_total"] == 2
    assert result["match"] == 2
    assert result["prod_only"] == []
    assert result["seed_only"] == []
    assert result["production_duplicate_identity"] == []


def test_prod_only_row_is_reported_with_its_db_id(gate):
    seed = _seed(("明治神宮", "東京都A"))
    production = _prod((1, "明治神宮", "東京都A"), (7, "未登録神社", "東京都C"))

    result = gate.reconcile(seed, production)

    assert result["status"] == "FAIL"
    assert result["match"] == 1
    assert result["prod_only"] == [
        {"db_id": 7, "name_jp": "未登録神社", "address": "東京都C", "kind": "shrine"}
    ]
    assert result["seed_only"] == []


def test_seed_only_row_is_reported_without_a_db_id(gate):
    seed = _seed(("明治神宮", "東京都A"), ("波上宮", "沖縄県B"))
    production = _prod((1, "明治神宮", "東京都A"))

    result = gate.reconcile(seed, production)

    assert result["status"] == "FAIL"
    assert result["seed_only"] == [
        {"db_id": None, "name_jp": "波上宮", "address": "沖縄県B"}
    ]
    assert result["prod_only"] == []


def test_production_duplicate_identity_is_reported_with_every_db_id(gate):
    seed = _seed(("明治神宮", "東京都A"))
    production = _prod((1, "明治神宮", "東京都A"), (9, "明治神宮", "東京都A"))

    result = gate.reconcile(seed, production)

    assert result["status"] == "FAIL"
    assert result["production_duplicate_identity"] == [
        {"name_jp": "明治神宮", "address": "東京都A", "db_ids": [1, 9], "count": 2}
    ]
    # 重複していてもidentity自体はSeedに存在するのでMATCHは成立する。
    assert result["match"] == 1


def test_match_counts_distinct_identities_not_rows(gate):
    seed = _seed(("明治神宮", "東京都A"))
    production = _prod((1, "明治神宮", "東京都A"), (9, "明治神宮", "東京都A"))

    assert gate.reconcile(seed, production)["match"] == 1


# ---------------------------------------------------------------------------
# normalizationを行わないこと
# ---------------------------------------------------------------------------


def test_identity_comparison_applies_no_normalization(gate):
    # 全角括弧と半角括弧は別identityとして扱う（NFKCを適用しない）。
    seed = _seed(("伊勢神宮（内宮）", "三重県D"))
    production = _prod((1, "伊勢神宮(内宮)", "三重県D"))

    result = gate.reconcile(seed, production)

    assert result["status"] == "FAIL"
    assert result["match"] == 0
    assert len(result["prod_only"]) == 1
    assert len(result["seed_only"]) == 1


def test_surrounding_whitespace_is_not_trimmed_for_matching(gate):
    seed = _seed(("明治神宮", "東京都A"))
    production = _prod((1, "明治神宮 ", "東京都A"))

    assert gate.reconcile(seed, production)["match"] == 0


# ---------------------------------------------------------------------------
# REVIEW候補
# ---------------------------------------------------------------------------


def test_similar_row_is_listed_for_review_but_never_auto_matched(gate):
    seed = _seed(("伊勢神宮（内宮）", "三重県D"))
    production = _prod((1, "伊勢神宮（内宮）", "三重県D"), (2, "伊勢神宮(内宮)", "三重県D"))

    result = gate.reconcile(seed, production)

    # 類似していてもMATCHにはならず、PROD_ONLYのまま残る。
    assert result["status"] == "FAIL"
    assert result["match"] == 1
    assert [row["db_id"] for row in result["prod_only"]] == [2]

    review = result["review_candidates"]
    assert len(review) == 1
    assert review[0]["side"] == "PROD_ONLY"
    assert review[0]["db_id"] == 2
    assert review[0]["candidates"][0]["name_jp"] == "伊勢神宮（内宮）"


def test_review_candidates_compare_against_the_full_opposite_population(gate):
    # Seed側に完全一致行が別途存在するProduction近似重複は、差分行同士の
    # 比較だけでは表面化しない。母集団全体と比較することを固定する。
    seed = _seed(("明治神宮", "東京都A"), ("波上宮", "沖縄県B"))
    production = _prod(
        (1, "明治神宮", "東京都A"),
        (2, "波上宮", "沖縄県B"),
        (3, "明治神宮", "東京都A "),
    )

    review = gate.reconcile(seed, production)["review_candidates"]

    assert [row["db_id"] for row in review] == [3]


def test_unrelated_divergence_produces_no_review_candidate(gate):
    seed = _seed(("明治神宮", "東京都A"))
    production = _prod((1, "明治神宮", "東京都A"), (2, "全然違う名前", "北海道Z"))

    assert gate.reconcile(seed, production)["review_candidates"] == []


# ---------------------------------------------------------------------------
# snapshot入力
# ---------------------------------------------------------------------------


def test_snapshot_json_is_extracted_from_raw_psql_aligned_output(gate):
    raw = (
        " production_shrine_snapshot_json \n"
        "----------------------------------\n"
        ' [{"id": 1, "name_jp": "明治神宮", "address": "東京都A", "kind": "shrine"}]\n'
        "(1 row)\n\n"
    )
    assert json.loads(gate.extract_snapshot_json(raw)) == [
        {"id": 1, "name_jp": "明治神宮", "address": "東京都A", "kind": "shrine"}
    ]


def test_snapshot_without_a_json_array_is_rejected(gate):
    with pytest.raises(gate.GateError):
        gate.extract_snapshot_json("ERROR: permission denied\n")


def test_production_snapshot_file_round_trips(gate, tmp_path):
    path = tmp_path / "snapshot.txt"
    path.write_text(
        ' [{"id": 5, "name_jp": "A", "address": "B", "kind": "shrine"}]\n',
        encoding="utf-8",
    )
    assert gate.load_production_snapshot(path) == [
        {"id": 5, "name_jp": "A", "address": "B", "kind": "shrine"}
    ]


def test_snapshot_row_missing_identity_keys_is_rejected(gate, tmp_path):
    path = tmp_path / "snapshot.txt"
    path.write_text('[{"id": 5, "name_jp": "A"}]\n', encoding="utf-8")
    with pytest.raises(gate.GateError):
        gate.load_production_snapshot(path)


# ---------------------------------------------------------------------------
# Base Seed / read-only契約
# ---------------------------------------------------------------------------


def test_base_seed_loads_from_the_w0_b01_canonical_path(gate):
    rows = gate.load_base_seed()
    assert gate.BASE_SEED_PATH.parts[-3:] == (
        "temples",
        "data",
        "shrines_seed_clean.json",
    )
    assert rows
    assert all({"name_jp", "address"} == set(row) for row in rows)


def test_gate_never_writes_to_the_base_seed(gate, tmp_path):
    before = gate.BASE_SEED_PATH.read_bytes()

    seed = gate.load_base_seed()
    production = _prod((1, "未登録神社", "東京都C"))
    result = gate.reconcile(seed, production)
    gate.save_report(result, tmp_path / "report.json")

    assert gate.BASE_SEED_PATH.read_bytes() == before


def test_report_is_saved_as_json(gate, tmp_path):
    result = gate.reconcile(_seed(("A", "B")), _prod((1, "A", "B")))
    path = tmp_path / "nested" / "report.json"
    gate.save_report(result, path)

    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved["status"] == "PASS"
    assert saved["identity_definition"].startswith("exact (name_jp, address)")


def test_production_query_is_select_only():
    spec = importlib.util.spec_from_file_location(
        "migration_safety_guard",
        REPO_ROOT / "scripts" / "migration_safety" / "guard.py",
    )
    assert spec is not None and spec.loader is not None
    guard = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = guard
    spec.loader.exec_module(guard)

    ok, reason = guard.is_readonly_sql(SQL_PATH.read_text(encoding="utf-8"))
    assert ok, reason
