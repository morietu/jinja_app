"""Base Shrine Seed / Import Contract。

`import_shrines_seed` は Base Shrine Seed（`temples/data/shrines_seed_clean.json`）を
`Shrine` テーブルへ同期する唯一のimport入口であり、`bootstrap_production_data`
の第1ステップでもある。本ファイルはその契約
（Seed integrity / CREATE・UPDATE・SKIP / dry-run / 更新field範囲）を固定する。

Seedの件数・重複・Batch17 identityは既存の
`test_shrine_base_batch17_seed.py` が正本であり、ここでは重複させない。
本ファイルはImporterから見た契約（Importerが必要とする前提と、Importerの挙動）
だけを扱う。
"""

from __future__ import annotations

import json
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction

from temples.management.commands.sync_visit_style_tags_from_seed import (
    MANAGED_COHORT_MIN_COUNT,
)
from temples.models import Shrine

pytestmark = pytest.mark.django_db

# import_shrines_seed の --source default（"temples/data/shrines_seed_clean.json"）と
# 同じファイルを指す。default値はCWD相対のため、testでは絶対パスで解決する。
SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "shrines_seed_clean.json"

# Importerが payload として書き込むfield（location はUSE_GIS時のみ）。
IMPORTER_PAYLOAD_FIELDS = frozenset(
    {
        "address",
        "latitude",
        "longitude",
        "goriyaku",
        "kyusei",
        "astro_elements",
        "visit_style_tags",
        "name_romaji",
        "sajin",
        "description",
        "element",
    }
)

# `visit_style_tags` は payload dict literal には含まれない。key を持つ行
# だけ、後から条件付きで payload に載る（key なし行は CREATE で model
# default、UPDATE で既存値保持）。
IMPORTER_CONDITIONAL_PAYLOAD_FIELDS = frozenset({"visit_style_tags"})
IMPORTER_UNCONDITIONAL_PAYLOAD_FIELDS = (
    IMPORTER_PAYLOAD_FIELDS - IMPORTER_CONDITIONAL_PAYLOAD_FIELDS
)

# Seed JSONに現れてよいkey。Importerが読むkeyと、Importerが無視するkey
# （location）の両方を含む。新しいkeyが増えたらここで気づけるようにする。
SEED_ALLOWED_KEYS = frozenset(
    {
        "name_jp",
        "address",
        "latitude",
        "longitude",
        "goriyaku",
        "kyusei",
        "astro_elements",
        "visit_style_tags",
        "location",
    }
)


def _load_seed() -> list[dict]:
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


def _run(*args) -> str:
    out = StringIO()
    call_command("import_shrines_seed", *args, stdout=out)
    return out.getvalue()


def _summary(output: str) -> dict[str, int]:
    line = [ln for ln in output.splitlines() if ln.startswith("done ")][-1]
    return {
        key: int(value)
        for key, value in (token.split("=") for token in line.split()[1:])
    }


# temples/tests/conftest.py の autouse fixture が Shrine(pk=1, "テスト神社")
# を毎テスト作成するため、件数はdeltaで比較する。
def _shrine_count() -> int:
    return Shrine.objects.count()


def _make_shrine(**overrides) -> Shrine:
    values = dict(
        name_jp="契約テスト神社",
        address="東京都千代田区1-1",
        latitude=35.0,
        longitude=139.0,
    )
    values.update(overrides)
    return Shrine.objects.create(**values)


def _write_seed(tmp_path: Path, rows: list[dict]) -> Path:
    path = tmp_path / "seed.json"
    path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    return path


# --------------------------------------------------------------------------
# A. Seed integrity（Importerが成立するための前提）
# --------------------------------------------------------------------------


def test_seed_file_exists_at_the_path_the_command_defaults_to():
    # commandの--source defaultは "temples/data/shrines_seed_clean.json"。
    assert SEED_PATH.exists()
    assert SEED_PATH.parts[-3:] == ("temples", "data", "shrines_seed_clean.json")


def test_seed_top_level_is_a_list_of_objects():
    data = _load_seed()
    assert isinstance(data, list)
    assert data
    assert all(isinstance(row, dict) for row in data)


def test_every_seed_row_has_the_identity_keys_the_importer_requires():
    # Importerは name_jp / address が空の行をSKIPする。Base Seedにその行が
    # 混ざっていないこと（= 全行がimport対象として成立すること）を固定する。
    for row in _load_seed():
        assert str(row.get("name_jp") or "").strip(), row
        assert str(row.get("address") or "").strip(), row


def test_seed_identity_pairs_are_unique_so_lookup_is_unambiguous():
    # Importerは (name_jp, address) で既存行を引く。重複するとimport順に
    # 依存した非決定的な更新になる。
    data = _load_seed()
    pairs = [(row["name_jp"], row["address"]) for row in data]
    assert len(pairs) == len(set(pairs))


def test_seed_rows_contain_no_unknown_keys():
    # Importerが読まないkeyが増えても黙って無視されるため、keyの増減を固定する。
    for row in _load_seed():
        unknown = set(row) - SEED_ALLOWED_KEYS
        assert unknown == set(), f"{row.get('name_jp')}: unexpected keys {sorted(unknown)}"


def test_seed_numeric_coordinates_are_usable_by_the_importer():
    for row in _load_seed():
        assert isinstance(row.get("latitude"), (int, float)), row["name_jp"]
        assert isinstance(row.get("longitude"), (int, float)), row["name_jp"]


# --------------------------------------------------------------------------
# B. Import behavior: CREATE / UPDATE / SKIP
# --------------------------------------------------------------------------


def test_create_when_no_shrine_matches_name_and_address(tmp_path):
    source = _write_seed(
        tmp_path,
        [{"name_jp": "新規神社", "address": "東京都新宿区1-1", "latitude": 35.7, "longitude": 139.7}],
    )
    output = _run("--source", str(source))

    assert _summary(output) == {"created": 1, "updated": 0, "skipped": 0, "total_seed": 1}
    assert Shrine.objects.filter(name_jp="新規神社").count() == 1


def test_update_when_a_payload_field_differs(tmp_path):
    shrine = _make_shrine(goriyaku="旧ご利益")
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "latitude": shrine.latitude,
                "longitude": shrine.longitude,
                "goriyaku": "新ご利益",
            }
        ],
    )
    output = _run("--source", str(source))

    assert _summary(output)["updated"] == 1
    assert "fields=['goriyaku']" in output
    shrine.refresh_from_db()
    assert shrine.goriyaku == "新ご利益"


def test_skip_when_every_payload_field_already_matches(tmp_path):
    shrine = _make_shrine(goriyaku="", astro_elements=[], visit_style_tags=[], sajin="")
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "latitude": shrine.latitude,
                "longitude": shrine.longitude,
            }
        ],
    )
    output = _run("--source", str(source))

    assert _summary(output) == {"created": 0, "updated": 0, "skipped": 1, "total_seed": 1}
    assert f"SKIP id={shrine.id}" in output


def test_row_without_name_or_address_is_skipped_as_invalid(tmp_path):
    source = _write_seed(
        tmp_path,
        [
            {"name_jp": "", "address": "東京都千代田区1-1"},
            {"name_jp": "住所なし神社", "address": ""},
        ],
    )
    before = _shrine_count()
    output = _run("--source", str(source))

    assert _summary(output) == {"created": 0, "updated": 0, "skipped": 2, "total_seed": 2}
    assert output.count("SKIP invalid row") == 2
    assert _shrine_count() == before


def test_database_forbids_the_duplicate_identity_the_importer_looks_up():
    """Importerは (name_jp, address) で既存行を引き、複数一致した場合は
    最小idを採る防御的実装になっている。実際にはDB側のUniqueConstraint
    （uq_shrine_name_addr_when_loc_null / uq_shrine_name_loc）が重複を
    禁止しており、この防御分岐に到達しないことを固定する。"""
    shrine = _make_shrine()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Shrine.objects.create(
                name_jp=shrine.name_jp,
                address=shrine.address,
                latitude=shrine.latitude,
                longitude=shrine.longitude,
            )


def test_missing_source_file_raises_command_error(tmp_path):
    with pytest.raises(CommandError):
        _run("--source", str(tmp_path / "does_not_exist.json"))


def test_non_list_source_raises_command_error(tmp_path):
    path = tmp_path / "seed.json"
    path.write_text(json.dumps({"shrines": []}), encoding="utf-8")
    with pytest.raises(CommandError):
        _run("--source", str(path))


# --------------------------------------------------------------------------
# C. Dry-run behavior
# --------------------------------------------------------------------------


def test_dry_run_does_not_create_rows(tmp_path):
    source = _write_seed(
        tmp_path,
        [{"name_jp": "新規神社", "address": "東京都新宿区1-1", "latitude": 35.7, "longitude": 139.7}],
    )
    output = _run("--source", str(source), "--dry-run")

    # 判定自体は行われる。
    assert _summary(output)["created"] == 1
    assert "CREATE 新規神社" in output
    # DBは変わらない。
    assert Shrine.objects.filter(name_jp="新規神社").count() == 0


def test_dry_run_does_not_update_rows(tmp_path):
    shrine = _make_shrine(goriyaku="旧ご利益")
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "latitude": shrine.latitude,
                "longitude": shrine.longitude,
                "goriyaku": "新ご利益",
            }
        ],
    )
    output = _run("--source", str(source), "--dry-run")

    assert _summary(output)["updated"] == 1
    assert "fields=['goriyaku']" in output
    shrine.refresh_from_db()
    assert shrine.goriyaku == "旧ご利益"


def test_dry_run_over_the_real_base_seed_leaves_the_database_untouched():
    before = list(
        Shrine.objects.order_by("id").values_list("id", "name_jp", "visit_style_tags")
    )
    output = _run("--source", str(SEED_PATH), "--dry-run")

    assert _summary(output)["total_seed"] == len(_load_seed())
    assert (
        list(Shrine.objects.order_by("id").values_list("id", "name_jp", "visit_style_tags"))
        == before
    )


# --------------------------------------------------------------------------
# D. Field scope: Importerは payload 外のfieldを書き換えない
# --------------------------------------------------------------------------


def test_update_touches_only_payload_fields(tmp_path):
    shrine = _make_shrine(
        goriyaku="旧ご利益",
        history_theme="再出発",
        popular_score=42.0,
    )
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "latitude": shrine.latitude,
                "longitude": shrine.longitude,
                "goriyaku": "新ご利益",
            }
        ],
    )
    output = _run("--source", str(source))

    # 報告されたchanged_fieldsがpayload範囲を超えない。
    reported = [
        line.split("fields=")[1] for line in output.splitlines() if "fields=" in line
    ]
    for entry in reported:
        for field in json.loads(entry.replace("'", '"')):
            assert field in IMPORTER_PAYLOAD_FIELDS | {"location"}, field

    shrine.refresh_from_db()
    assert shrine.goriyaku == "新ご利益"
    # payload外は保持される。
    assert shrine.history_theme == "再出発"
    assert shrine.popular_score == 42.0


def test_importer_payload_field_set_is_pinned():
    # payload fieldが増減すると、Importerが書き換える範囲が変わる。
    # 意図しない拡大を検知するためにfield集合そのものを固定する。
    source = (
        Path(__file__).resolve().parents[1]
        / "management"
        / "commands"
        / "import_shrines_seed.py"
    ).read_text(encoding="utf-8")
    payload_block = source.split("payload = {", 1)[1].split("}", 1)[0]
    declared = {
        line.strip().split('"')[1]
        for line in payload_block.splitlines()
        if line.strip().startswith('"')
    }
    assert declared == set(IMPORTER_UNCONDITIONAL_PAYLOAD_FIELDS)

    # visit_style_tags は key を持つ行だけに条件付きで追加される。
    assert 'payload["visit_style_tags"] = list(managed_visit_style[index])' in source


# --------------------------------------------------------------------------
# E. visit_style_tags: Base Seed canonical completeness / importer semantics
# --------------------------------------------------------------------------


def test_base_seed_canonical_managed_cohort_is_complete_and_non_empty():
    """canonical契約: keyを持つ行が103社以上あり、いずれもnon-empty。

    Base Seedの総件数は固定しない。新規Shrineは``visit_style_tags`` key
    なし（未レビュー）で追加されうる。
    """
    data = _load_seed()
    with_tags = [row for row in data if "visit_style_tags" in row]

    assert len(with_tags) >= MANAGED_COHORT_MIN_COUNT
    assert all(row["visit_style_tags"] for row in with_tags)


def test_absent_visit_style_tags_key_preserves_the_existing_value(tmp_path):
    """keyなし = 未レビュー / unmanaged。既存のDB値を書き換えない。

    Base Seedは今後、Visit Style未レビューの新規Shrineを含みうる。その行が
    既存Shrineのcanonical visit_style_tagsを空listで上書きしないことを固定する。
    """
    shrine = _make_shrine(visit_style_tags=["quiet", "nature", "classic"])
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "latitude": shrine.latitude,
                "longitude": shrine.longitude,
                "goriyaku": "新ご利益",
            }
        ],
    )

    dry = _run("--source", str(source), "--dry-run")
    assert "visit_style_tags" not in dry

    _run("--source", str(source))

    shrine.refresh_from_db()
    assert shrine.visit_style_tags == ["quiet", "nature", "classic"]
    # keyがある他fieldは通常どおり更新される。
    assert shrine.goriyaku == "新ご利益"


def test_absent_visit_style_tags_key_on_create_uses_the_model_default(tmp_path):
    # 新規Shrineへタグを推測して付与しない。model defaultのまま作られる。
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": "未レビュー神社",
                "address": "東京都新宿区9-9",
                "latitude": 35.7,
                "longitude": 139.7,
            }
        ],
    )
    _run("--source", str(source))

    created = Shrine.objects.get(name_jp="未レビュー神社")
    assert created.visit_style_tags == []


def test_present_visit_style_tags_key_updates_to_the_exact_seed_value(tmp_path):
    # keyあり = canonical。Seedの値がそのまま（順序込みで）書かれる。
    shrine = _make_shrine(visit_style_tags=["classic"])
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "latitude": shrine.latitude,
                "longitude": shrine.longitude,
                "visit_style_tags": ["urban", "quiet"],
            }
        ],
    )

    output = _run("--source", str(source))
    assert "visit_style_tags" in output

    shrine.refresh_from_db()
    assert shrine.visit_style_tags == ["urban", "quiet"]


def test_present_but_empty_visit_style_tags_aborts_before_any_write(tmp_path):
    # keyありの空listはinvalid。未レビューを表したいならkeyごと省く。
    shrine = _make_shrine(visit_style_tags=["classic"])
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "latitude": shrine.latitude,
                "longitude": shrine.longitude,
                "goriyaku": "書かれてはいけない値",
                "visit_style_tags": [],
            }
        ],
    )

    with pytest.raises(CommandError, match="cardinality must be 1-3"):
        _run("--source", str(source))

    shrine.refresh_from_db()
    assert shrine.visit_style_tags == ["classic"]
    assert shrine.goriyaku != "書かれてはいけない値"


def test_repair_only_visit_style_backfill_is_idempotent_against_canonical_seed():
    """repair-onlyのvisit-style backfill後もcanonical Seedとの再同期で差分が発生しない。"""
    data = _load_seed()
    assert len(data) >= MANAGED_COHORT_MIN_COUNT
    assert all(row.get("visit_style_tags") for row in data)
    seed_names = [row["name_jp"] for row in data]

    first = _summary(_run("--source", str(SEED_PATH)))
    assert first["created"] == len(data)

    call_command("backfill_goriyaku_tags", "--with-visit-style", "--force", stdout=StringIO())
    assert Shrine.objects.filter(name_jp__in=seed_names).exclude(visit_style_tags=[]).count() == len(data)

    output = _run("--source", str(SEED_PATH), "--dry-run")
    second = _summary(output)
    assert second["created"] == 0
    assert second["updated"] == 0
    assert second["skipped"] == len(data)
    reported_fields = {line.split("fields=")[1] for line in output.splitlines() if "fields=" in line}
    assert reported_fields == set()
