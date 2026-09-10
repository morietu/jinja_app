#!/usr/bin/env python
"""W0-B02 Production Shrine Reconciliation Gate（read-only）。

W0-B01で固定したBase Shrine Seedと、現在のProduction Shrine母集団を
exact `(name_jp, address)` 単位で完全突合する。

契約:

* Base Seed（`backend/temples/data/shrines_seed_clean.json`）を変更しない。
* Production DBを変更しない。本scriptはSELECT/read-onlyのみを行う。
* identity normalizationを行わない。`(name_jp, address)` はSeed側・
  Production側ともに格納値をそのまま比較する。NFKC・trim・全角半角変換・
  括弧変換・住所表記変換をいずれも行わない。
* 類似候補はREVIEW候補として別枠で表示するだけで、自動的にMATCH扱いしない。
* 差分がある場合はSTATUS=FAILとして差分一覧を出し、修正せずSTOPする。

Production側の取得経路は2つあり、明示的にどちらかを選ぶ。ambient credential
lookupは行わない。

1. `--production-snapshot PATH`（Production向けの正式経路）

       scripts/migration_safety/readonly_query.sh \
         ~/.config/kami-musubi/production-db.env DATABASE_URL \
         scripts/migration_safety/sql/shrine_identity_reconciliation.sql \
         > /path/outside/repo/production-shrine-snapshot.txt

       python scripts/reconcile_production_shrine_identity.py \
         --production-snapshot /path/outside/repo/production-shrine-snapshot.txt

2. `--from-db`（DBへ直接到達できるlocal / CI用）

       DJANGO_SETTINGS_MODULE=shrine_project.settings PYTHONPATH=backend \
       python scripts/reconcile_production_shrine_identity.py --from-db

Exit code: PASS=0 / FAIL=1。
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
BASE_SEED_PATH = REPO_ROOT / "backend" / "temples" / "data" / "shrines_seed_clean.json"
DEFAULT_REPORT_PATH = REPO_ROOT / "logs" / "shrine_identity_reconciliation.json"

# 類似候補の表示しきい値。REVIEW表示専用であり、MATCH判定には一切使わない。
SIMILARITY_THRESHOLD = 0.80
MAX_REVIEW_CANDIDATES_PER_ROW = 3


class GateError(Exception):
    """Gateを実行できない状態を表す。"""


# ---------------------------------------------------------------------------
# 入力
# ---------------------------------------------------------------------------


def load_base_seed(path: Path = BASE_SEED_PATH) -> list[dict[str, Any]]:
    if not path.exists():
        raise GateError(f"Base Seed not found: {path}")

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise GateError("Base Seed must be a JSON list")

    rows: list[dict[str, Any]] = []
    for index, row in enumerate(data):
        if not isinstance(row, dict):
            raise GateError(f"Base Seed row {index} is not a JSON object")
        name_jp = row.get("name_jp")
        address = row.get("address")
        if not isinstance(name_jp, str) or not isinstance(address, str):
            raise GateError(f"Base Seed row {index} has a non-string identity")
        # normalizationは行わない。格納値をそのまま使う。
        rows.append({"name_jp": name_jp, "address": address})
    return rows


def extract_snapshot_json(text: str) -> str:
    """psqlのaligned出力からjson_agg結果を取り出す。

    純粋なJSON配列ファイルもそのまま受け付ける。
    """
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise GateError(
            "production snapshot does not contain a JSON array; "
            "expected the output of sql/shrine_identity_reconciliation.sql"
        )
    return text[start : end + 1]


def load_production_snapshot(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise GateError(f"production snapshot not found: {path}")

    payload = json.loads(extract_snapshot_json(path.read_text(encoding="utf-8")))
    if not isinstance(payload, list):
        raise GateError("production snapshot must decode to a JSON list")

    rows: list[dict[str, Any]] = []
    for index, row in enumerate(payload):
        if not isinstance(row, dict):
            raise GateError(f"production snapshot row {index} is not an object")
        missing = {"id", "name_jp", "address"} - set(row)
        if missing:
            raise GateError(
                f"production snapshot row {index} is missing {sorted(missing)}"
            )
        rows.append(
            {
                "id": row["id"],
                "name_jp": row["name_jp"] if row["name_jp"] is not None else "",
                "address": row["address"] if row["address"] is not None else "",
                "kind": row.get("kind"),
            }
        )
    return rows


def load_production_from_db() -> list[dict[str, Any]]:
    """Django ORM経由でread-only取得する（local / CI用）。

    `.values()` によるSELECTのみで、いかなるwriteも行わない。
    """
    try:
        import django  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - 環境依存
        raise GateError(
            "--from-db requires Django. Set DJANGO_SETTINGS_MODULE and PYTHONPATH=backend."
        ) from exc

    django.setup()
    from temples.models import Shrine  # noqa: PLC0415

    return [
        {
            "id": row["id"],
            "name_jp": row["name_jp"] or "",
            "address": row["address"] or "",
            "kind": row.get("kind"),
        }
        for row in Shrine.objects.order_by("id").values("id", "name_jp", "address", "kind")
    ]


# ---------------------------------------------------------------------------
# 突合
# ---------------------------------------------------------------------------


def _identity(row: dict[str, Any]) -> tuple[str, str]:
    """exact identity。normalizationを一切行わない。"""
    return (row["name_jp"], row["address"])


def _similarity(left: tuple[str, str], right: tuple[str, str]) -> float:
    name = SequenceMatcher(None, left[0], right[0]).ratio()
    address = SequenceMatcher(None, left[1], right[1]).ratio()
    return max(name, address)


def _top_similar(
    target: dict[str, Any], population: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    scored = sorted(
        (
            (_similarity(_identity(target), _identity(other)), other)
            for other in population
            if _identity(other) != _identity(target)
        ),
        key=lambda item: -item[0],
    )
    return [
        {
            "score": round(score, 4),
            "name_jp": other["name_jp"],
            "address": other["address"],
            "db_id": other.get("id"),
        }
        for score, other in scored[:MAX_REVIEW_CANDIDATES_PER_ROW]
        if score >= SIMILARITY_THRESHOLD
    ]


def find_review_candidates(
    prod_only: list[dict[str, Any]],
    seed_only: list[dict[str, Any]],
    seed_rows: list[dict[str, Any]],
    production_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """差分行ごとに類似候補をREVIEW用に列挙する。

    比較先は相手側の母集団**全体**であり、差分行同士に限定しない。
    Base Seedに完全一致行が別途存在するProduction側の近似重複は、
    この列挙でしか表面化しないため。

    ここで挙がった候補を自動的にMATCH扱いすることはない。MATCHは
    exact `(name_jp, address)` 一致のみで決まる。
    """
    review: list[dict[str, Any]] = []

    for prod_row in prod_only:
        candidates = _top_similar(prod_row, seed_rows)
        if candidates:
            review.append(
                {
                    "side": "PROD_ONLY",
                    "db_id": prod_row.get("id"),
                    "name_jp": prod_row["name_jp"],
                    "address": prod_row["address"],
                    "candidates": candidates,
                }
            )

    for seed_row in seed_only:
        candidates = _top_similar(seed_row, production_rows)
        if candidates:
            review.append(
                {
                    "side": "SEED_ONLY",
                    "db_id": None,
                    "name_jp": seed_row["name_jp"],
                    "address": seed_row["address"],
                    "candidates": candidates,
                }
            )

    return review


def reconcile(
    seed_rows: list[dict[str, Any]], production_rows: list[dict[str, Any]]
) -> dict[str, Any]:
    seed_identities = [_identity(row) for row in seed_rows]
    seed_identity_set = set(seed_identities)

    production_by_identity: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in production_rows:
        production_by_identity[_identity(row)].append(row)
    production_identity_set = set(production_by_identity)

    matched = seed_identity_set & production_identity_set

    prod_only_rows = [
        row
        for row in production_rows
        if _identity(row) not in seed_identity_set
    ]
    seed_only_rows = [
        row for row in seed_rows if _identity(row) not in production_identity_set
    ]

    production_duplicates = [
        {
            "name_jp": name_jp,
            "address": address,
            "db_ids": [row.get("id") for row in rows],
            "count": len(rows),
        }
        for (name_jp, address), rows in sorted(
            production_by_identity.items(), key=lambda item: item[0]
        )
        if len(rows) > 1
    ]

    seed_duplicates = [
        {"name_jp": name_jp, "address": address, "count": count}
        for (name_jp, address), count in sorted(Counter(seed_identities).items())
        if count > 1
    ]

    status = (
        "PASS"
        if not prod_only_rows and not seed_only_rows and not production_duplicates
        else "FAIL"
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_seed_path": str(BASE_SEED_PATH.relative_to(REPO_ROOT)),
        "identity_definition": "exact (name_jp, address); no normalization applied",
        "base_seed_total": len(seed_rows),
        "production_total": len(production_rows),
        "match": len(matched),
        "prod_only": [
            {
                "db_id": row.get("id"),
                "name_jp": row["name_jp"],
                "address": row["address"],
                "kind": row.get("kind"),
            }
            for row in prod_only_rows
        ],
        "seed_only": [
            {"db_id": None, "name_jp": row["name_jp"], "address": row["address"]}
            for row in seed_only_rows
        ],
        "production_duplicate_identity": production_duplicates,
        "base_seed_duplicate_identity": seed_duplicates,
        "review_candidates": find_review_candidates(
            prod_only_rows, seed_only_rows, seed_rows, production_rows
        ),
        "status": status,
    }


# ---------------------------------------------------------------------------
# 出力
# ---------------------------------------------------------------------------


def report(result: dict[str, Any], stream=sys.stdout) -> None:
    def emit(line: str) -> None:
        print(line, file=stream)

    emit(f"BASE_SEED_TOTAL={result['base_seed_total']}")
    emit(f"PRODUCTION_TOTAL={result['production_total']}")
    emit(f"MATCH={result['match']}")
    emit(f"PROD_ONLY={len(result['prod_only'])}")
    emit(f"SEED_ONLY={len(result['seed_only'])}")
    emit(
        f"PRODUCTION_DUPLICATE_IDENTITY={len(result['production_duplicate_identity'])}"
    )
    emit(f"STATUS={result['status']}")
    emit(f"BASE_SEED_DUPLICATE_IDENTITY={len(result['base_seed_duplicate_identity'])}")
    emit(f"REVIEW_CANDIDATES={len(result['review_candidates'])}")

    if result["prod_only"]:
        emit("")
        emit("PROD_ONLY (Production にあり Base Seed にない):")
        for row in result["prod_only"]:
            emit(
                f"  db_id={row['db_id']} kind={row['kind']!r} "
                f"name_jp={row['name_jp']!r} address={row['address']!r}"
            )

    if result["seed_only"]:
        emit("")
        emit("SEED_ONLY (Base Seed にあり Production にない):")
        for row in result["seed_only"]:
            emit(
                f"  db_id=None name_jp={row['name_jp']!r} address={row['address']!r}"
            )

    if result["production_duplicate_identity"]:
        emit("")
        emit("PRODUCTION_DUPLICATE_IDENTITY:")
        for row in result["production_duplicate_identity"]:
            emit(
                f"  count={row['count']} db_ids={row['db_ids']} "
                f"name_jp={row['name_jp']!r} address={row['address']!r}"
            )

    if result["base_seed_duplicate_identity"]:
        emit("")
        emit("BASE_SEED_DUPLICATE_IDENTITY:")
        for row in result["base_seed_duplicate_identity"]:
            emit(
                f"  count={row['count']} name_jp={row['name_jp']!r} "
                f"address={row['address']!r}"
            )

    if result["review_candidates"]:
        emit("")
        emit("REVIEW_CANDIDATES (類似のみ。自動的にMATCH扱いしない):")
        for row in result["review_candidates"]:
            emit(
                f"  [{row['side']}] db_id={row['db_id']} "
                f"name_jp={row['name_jp']!r} address={row['address']!r}"
            )
            for candidate in row["candidates"]:
                emit(
                    f"    -> score={candidate['score']} db_id={candidate['db_id']} "
                    f"name_jp={candidate['name_jp']!r} "
                    f"address={candidate['address']!r}"
                )

    if result["status"] == "FAIL":
        emit("")
        emit("差分を検出したため修正を行わずSTOPする。")


def save_report(result: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="W0-B02 Production Shrine Reconciliation Gate (read-only)"
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--production-snapshot",
        type=Path,
        help=(
            "sql/shrine_identity_reconciliation.sql を readonly_query.sh 経由で "
            "実行した出力ファイル"
        ),
    )
    source.add_argument(
        "--from-db",
        action="store_true",
        help="Django ORM経由でread-only取得する（local / CI用）",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=DEFAULT_REPORT_PATH,
        help=f"audit reportの保存先 (default: {DEFAULT_REPORT_PATH})",
    )
    args = parser.parse_args()

    try:
        seed_rows = load_base_seed()
        if args.from_db:
            production_rows = load_production_from_db()
        else:
            production_rows = load_production_snapshot(args.production_snapshot)
    except GateError as exc:
        print(f"GATE_ERROR: {exc}", file=sys.stderr)
        print("STATUS=ERROR", file=sys.stderr)
        return 2

    result = reconcile(seed_rows, production_rows)
    report(result)
    save_report(result, args.report)
    print(f"REPORT_SAVED={args.report}")

    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
