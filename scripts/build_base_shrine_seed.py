#!/usr/bin/env python
"""W0-B01 Base Shrine Seed builder / validator.

現在のBase Shrine集合（103社）を、同一入力から毎回bit単位で同一の
`backend/temples/data/shrines_seed_clean.json` として再生成する。

本builderの契約:

* 入力元は1ファイルに固定する（`SOURCE_PATH`）。出力先も同一ファイルであり、
  Base Seed自身がcanonical sourceである。
* Shrine identityは現行Productionと同じく `(name_jp, address)` である。
  `import_shrines_seed` / Knowledge Seedの `shrine_ref` 解決がこのpairに
  依存しているため、identityを変える正規化は行わない。
* `name_jp` / `address` の永続値は一切変更しない（NFKC・全角半角変換・
  括弧変換・住所表記変換をいずれも行わない）。trimはvalidation用途の
  検査のみで、値の書き換えには使わない。
* Shrine行の並び順は入力の順序をそのまま維持する（sortしない）。
* JSON object内のkey順とserialization形式だけを決定論的に統一する。
* `id` / `prefecture` はBase Seedのfieldに追加しない。W0-B01はschema拡張
  ではなくBase Shrine集合の再現性確保が目的であり、Production schemaを
  維持する。`prefecture` は住所から導出するderived valueとして検証・集計
  のみに使い、Seedへは書き出さない。
* Knowledge / GoriyakuTag / Recommendation / visit_style_tags の意味内容は
  変更しない。builderは既存の `visit_style_tags` の値を書き換えず、
  新規Shrineへタグを推測・自動生成もしない。
* `visit_style_tags` は **optional key** である。Importer / Sync と同じ
  managed / unmanaged 契約をここでも強制する:

      key なし          = unmanaged / 未レビュー（合法）
      key あり + 1〜3件  = managed / canonical
      key あり + []      = invalid（VISIT_STYLE_INVALID gate失敗 →
                            BASE_SEED_BUILD=FAILED / exit 1 で書き込まない）

  canonical taxonomy 外・legacy・request-only・重複タグはいずれもinvalid。

Usage:
    python scripts/build_base_shrine_seed.py            # build + write
    python scripts/build_base_shrine_seed.py --check    # 差分検証のみ（書き込みなし）
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = REPO_ROOT / "backend" / "temples" / "data" / "shrines_seed_clean.json"
OUTPUT_PATH = SOURCE_PATH

# Base Seed行のcanonical key順。現行Seedは同じ9keyを持ちながら
# `visit_style_tags` / `location` の順序だけが2通りに割れているため、
# ここで1通りへ固定する。keyの追加・削除はschema変更として検出する。
CANONICAL_KEY_ORDER: tuple[str, ...] = (
    "name_jp",
    "address",
    "latitude",
    "longitude",
    "goriyaku",
    "goriyaku_tags",
    "kyusei",
    "astro_elements",
    "visit_style_tags",
    "location",
)
EXPECTED_KEYS = frozenset(CANONICAL_KEY_ORDER)

# `visit_style_tags` はoptional。key なし = 未レビュー / unmanaged であり、
# Base Seedへ新規Shrineを追加するとき合法な状態である。builderはその行へ
# キーを補わない（空listを足すとImporter側で「レビュー済みタグ0件」と
# 区別できなくなる）。
OPTIONAL_KEYS = frozenset({"goriyaku_tags", "visit_style_tags"})
REQUIRED_SCHEMA_KEYS = EXPECTED_KEYS - OPTIONAL_KEYS


# `location` object内のcanonical key順。
CANONICAL_LOCATION_KEY_ORDER: tuple[str, ...] = ("lat", "lng")

# Shrine identity。Importerが既存行を引くkeyであり、値を変えてはならない。
IDENTITY_KEYS: tuple[str, ...] = ("name_jp", "address")

# 必須field。W0-B01の決定により `id` / `prefecture` は必須fieldに含めない。
REQUIRED_KEYS: tuple[str, ...] = ("name_jp", "address")

# 導出専用の都道府県一覧。Seedへは書き出さない。
# `scripts/audit_recommendation_eligibility_geographic_impact.py` のREGIONSと
# 同じ集合だが、そちらはDjango settingsを要求するため本builderからは
# importせず、DB非依存で動かせるようローカルに保持する。
PREFECTURES: tuple[str, ...] = (
    "北海道",
    "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
    "岐阜県", "静岡県", "愛知県",
    "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
    "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県",
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県",
    "沖縄県",
)

# Canonical Shrine Visit Style taxonomy。
# `temples.management.commands.sync_visit_style_tags_from_seed` が正本だが、
# 本builderはPREFECTURESと同じ理由（Django settings非依存で動かす）により
# importせずローカルに保持する。両者が一致することは
# `test_base_shrine_seed_build_contract.py` のdrift testが固定する。
ALLOWED_VISIT_STYLE_TAGS = frozenset(
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

# `nearby` は訪問者の現在地に対する相対条件であり、Shrineの固定属性ではない。
REQUEST_ONLY_TAGS = frozenset({"nearby"})

# canonical Seedへ二度と現れてはならない旧ラベル。
FORBIDDEN_LEGACY_TAGS = frozenset({"love", "formal", "tourism"})

MIN_TAGS_PER_SHRINE = 1
MAX_TAGS_PER_SHRINE = 3

# docs/audit/shrine-geographic-knowledge-coverage.md が記録するGoogle Maps形式
# address 2件の既知例外。prefecture導出時にのみ前置部を読み飛ばす。
# addressの永続値は書き換えない。
_GMAPS_PREFIX_RE = re.compile(r"^日本、〒?[0-9\-－]*\s*")


class BuildError(Exception):
    """Base Seedをそのまま再生成できない状態を表す。"""


def derive_prefecture(address: str) -> str | None:
    """addressから都道府県を導出する（Seedへは書き出さないderived value）。"""
    normalized = _GMAPS_PREFIX_RE.sub("", str(address or "")).strip()
    for prefecture in PREFECTURES:
        if normalized.startswith(prefecture):
            return prefecture
    return None


def validate_visit_style_tags(row: dict[str, Any], label: str) -> list[str]:
    """1行分の `visit_style_tags` を検証し、違反の一覧を返す。

    key が無い行（unmanaged / 未レビュー）は違反ゼロで返す。値は読むだけで、
    書き換えも補完もしない。
    """
    if "visit_style_tags" not in row:
        return []

    tags = row["visit_style_tags"]
    if not isinstance(tags, list):
        return [f"{label}: visit_style_tags must be a list"]

    if not tags:
        # key があるのに空 = 「レビュー済みでタグ0件」は認めない。
        # 未レビューを表したいなら key ごと省く。
        return [
            f"{label}: visit_style_tags is present but empty; "
            "omit the key entirely for an unreviewed Shrine"
        ]

    violations: list[str] = []
    if not MIN_TAGS_PER_SHRINE <= len(tags) <= MAX_TAGS_PER_SHRINE:
        violations.append(
            f"{label}: visit_style_tags cardinality must be "
            f"{MIN_TAGS_PER_SHRINE}-{MAX_TAGS_PER_SHRINE}, got {len(tags)}"
        )

    seen: set[str] = set()
    for tag in tags:
        if not isinstance(tag, str) or not tag.strip():
            violations.append(f"{label}: blank or non-string tag {tag!r}")
            continue
        if tag in seen:
            violations.append(f"{label}: duplicate tag {tag!r}")
        seen.add(tag)

        if tag in REQUEST_ONLY_TAGS:
            violations.append(
                f"{label}: {tag!r} is request-only and must not be a Shrine attribute"
            )
        elif tag in FORBIDDEN_LEGACY_TAGS:
            violations.append(f"{label}: {tag!r} is a forbidden legacy label")
        elif tag not in ALLOWED_VISIT_STYLE_TAGS:
            violations.append(f"{label}: {tag!r} is outside the allowed taxonomy")

    return violations


def load_source(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise BuildError(f"source file not found: {path}")

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise BuildError("Base Seed must be a JSON list")
    for index, row in enumerate(data):
        if not isinstance(row, dict):
            raise BuildError(f"row {index} is not a JSON object")
    return data


def canonicalize_row(row: dict[str, Any]) -> dict[str, Any]:
    """key順だけを固定する。値は一切変換しない。

    optional key（goriyaku_tags / visit_style_tags）が無い行にはkeyを補わない。
    特に visit_style_tags keyなしは未レビュー / unmanaged を意味するため、
    空listを補完しない。
    """
    canonical = {key: row[key] for key in CANONICAL_KEY_ORDER if key in row}

    location = canonical.get("location")
    if isinstance(location, dict):
        canonical["location"] = {
            key: location[key]
            for key in CANONICAL_LOCATION_KEY_ORDER
            if key in location
        }
    return canonical


def serialize(rows: list[dict[str, Any]]) -> str:
    """JSON serializationを固定する。"""
    return (
        json.dumps(
            rows,
            ensure_ascii=False,
            indent=2,
            separators=(",", ": "),
            sort_keys=False,
        )
        + "\n"
    )


def sha256_of(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def validate(source_rows: list[dict[str, Any]], built_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Base Seedのvalidationを行い、集計値を返す。"""
    schema_violations: list[str] = []
    missing_required: list[str] = []
    untrimmed_identity: list[str] = []
    visit_style_violations: list[str] = []
    managed_visit_style_rows = 0
    unmanaged_visit_style_rows = 0

    for index, row in enumerate(source_rows):
        label = str(row.get("name_jp") or f"<row {index}>")

        unexpected = sorted(set(row) - EXPECTED_KEYS)
        absent = sorted(REQUIRED_SCHEMA_KEYS - set(row))
        if unexpected:
            schema_violations.append(f"{label}: unexpected keys {unexpected}")
        if absent:
            schema_violations.append(f"{label}: missing keys {absent}")

        for key in REQUIRED_KEYS:
            value = row.get(key)
            if not isinstance(value, str) or not value.strip():
                missing_required.append(f"{label}: required field {key!r} is missing or empty")

        if "visit_style_tags" in row:
            managed_visit_style_rows += 1
        else:
            unmanaged_visit_style_rows += 1
        visit_style_violations.extend(validate_visit_style_tags(row, label))

        # trimはvalidation用途のみ。値の書き換えには使わない。
        for key in IDENTITY_KEYS:
            value = row.get(key)
            if isinstance(value, str) and value != value.strip():
                untrimmed_identity.append(f"{label}: {key!r} has surrounding whitespace")

    # identity mutation: buildの前後で (name_jp, address) が1件も変わらないこと。
    identity_mutations: list[str] = []
    if len(source_rows) != len(built_rows):
        identity_mutations.append(
            f"row count changed: {len(source_rows)} -> {len(built_rows)}"
        )
    else:
        for index, (before, after) in enumerate(zip(source_rows, built_rows)):
            for key in IDENTITY_KEYS:
                if before.get(key) != after.get(key):
                    identity_mutations.append(
                        f"row {index}: {key!r} changed {before.get(key)!r} -> {after.get(key)!r}"
                    )

    identity_counts = Counter(
        (row.get("name_jp"), row.get("address")) for row in built_rows
    )
    duplicate_identity = sorted(
        f"{name} / {address}"
        for (name, address), count in identity_counts.items()
        if count > 1
    )

    # `id` はW0-B01のBase Seed fieldではない。存在すれば重複検証の対象にする。
    id_values = [row["id"] for row in built_rows if "id" in row]
    duplicate_id = sorted(
        str(value) for value, count in Counter(id_values).items() if count > 1
    )

    prefecture_counts: Counter[str] = Counter()
    prefecture_unresolved: list[str] = []
    for row in built_rows:
        prefecture = derive_prefecture(row.get("address", ""))
        if prefecture is None:
            prefecture_unresolved.append(
                f"{row.get('name_jp')}: {row.get('address')}"
            )
        else:
            prefecture_counts[prefecture] += 1

    return {
        "total": len(built_rows),
        "duplicate_identity": duplicate_identity,
        "duplicate_id": duplicate_id,
        "id_field_rows": len(id_values),
        "missing_required": missing_required,
        "identity_mutations": identity_mutations,
        "schema_violations": schema_violations,
        "untrimmed_identity": untrimmed_identity,
        "visit_style_violations": visit_style_violations,
        "managed_visit_style_rows": managed_visit_style_rows,
        "unmanaged_visit_style_rows": unmanaged_visit_style_rows,
        "prefecture_counts": prefecture_counts,
        "prefecture_unresolved": prefecture_unresolved,
    }


def report(result: dict[str, Any], sha256: str, stream=sys.stdout) -> None:
    def emit(line: str) -> None:
        print(line, file=stream)

    emit(f"TOTAL={result['total']}")
    emit(f"DUPLICATE_IDENTITY={len(result['duplicate_identity'])}")
    emit(f"DUPLICATE_ID={len(result['duplicate_id'])}")
    emit(f"MISSING_REQUIRED={len(result['missing_required'])}")
    emit(f"PREFECTURES={len(result['prefecture_counts'])}")
    emit(f"SHA256={sha256}")
    emit(f"IDENTITY_MUTATION={len(result['identity_mutations'])}")
    emit(f"SCHEMA_UNEXPECTED_CHANGE={len(result['schema_violations'])}")
    emit(f"PREFECTURE_UNRESOLVED={len(result['prefecture_unresolved'])}")
    emit(f"ID_FIELD_ROWS={result['id_field_rows']}")
    emit(f"VISIT_STYLE_MANAGED={result['managed_visit_style_rows']}")
    emit(f"VISIT_STYLE_UNMANAGED={result['unmanaged_visit_style_rows']}")
    emit(f"VISIT_STYLE_INVALID={len(result['visit_style_violations'])}")

    for key, label in (
        ("duplicate_identity", "DUPLICATE_IDENTITY"),
        ("duplicate_id", "DUPLICATE_ID"),
        ("missing_required", "MISSING_REQUIRED"),
        ("identity_mutations", "IDENTITY_MUTATION"),
        ("schema_violations", "SCHEMA_UNEXPECTED_CHANGE"),
        ("untrimmed_identity", "UNTRIMMED_IDENTITY"),
        ("visit_style_violations", "VISIT_STYLE_INVALID"),
        ("prefecture_unresolved", "PREFECTURE_UNRESOLVED"),
    ):
        for detail in result[key]:
            emit(f"  {label}: {detail}")

    emit("PREFECTURE_BREAKDOWN:")
    for prefecture, count in sorted(
        result["prefecture_counts"].items(), key=lambda item: (-item[1], item[0])
    ):
        emit(f"  {prefecture}={count}")


def gate_failures(result: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    if result["duplicate_identity"]:
        failures.append("DUPLICATE_IDENTITY != 0")
    if result["duplicate_id"]:
        failures.append("DUPLICATE_ID != 0")
    if result["missing_required"]:
        failures.append("MISSING_REQUIRED != 0")
    if result["identity_mutations"]:
        failures.append("IDENTITY_MUTATION != 0")
    if result["schema_violations"]:
        failures.append("SCHEMA_UNEXPECTED_CHANGE != 0")
    if result["untrimmed_identity"]:
        failures.append("UNTRIMMED_IDENTITY != 0")
    if result["visit_style_violations"]:
        failures.append("VISIT_STYLE_INVALID != 0")
    if result["prefecture_unresolved"]:
        failures.append("PREFECTURE_UNRESOLVED != 0")
    return failures


def build(check_only: bool = False, stream=sys.stdout) -> int:
    source_rows = load_source(SOURCE_PATH)
    built_rows = [canonicalize_row(row) for row in source_rows]

    result = validate(source_rows, built_rows)
    payload = serialize(built_rows)
    digest = sha256_of(payload)

    report(result, digest, stream=stream)

    failures = gate_failures(result)
    if failures:
        for failure in failures:
            print(f"GATE_FAIL: {failure}", file=stream)
        print("BASE_SEED_BUILD=FAILED", file=stream)
        return 1

    current = OUTPUT_PATH.read_text(encoding="utf-8")
    if check_only:
        if current != payload:
            print("GATE_FAIL: --check found a pending diff", file=stream)
            print("BASE_SEED_BUILD=FAILED", file=stream)
            return 1
        print("WRITTEN=0", file=stream)
        print("BASE_SEED_BUILD=OK", file=stream)
        return 0

    if current == payload:
        print("WRITTEN=0", file=stream)
    else:
        OUTPUT_PATH.write_text(payload, encoding="utf-8")
        print("WRITTEN=1", file=stream)

    print("BASE_SEED_BUILD=OK", file=stream)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the W0-B01 Base Shrine Seed")
    parser.add_argument(
        "--check",
        action="store_true",
        help="書き込まずに、再buildで差分が出ないことだけを検証する",
    )
    args = parser.parse_args()

    try:
        return build(check_only=args.check)
    except BuildError as exc:
        print(f"GATE_FAIL: {exc}", file=sys.stderr)
        print("BASE_SEED_BUILD=FAILED", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
