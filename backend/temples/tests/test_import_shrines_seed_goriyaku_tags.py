from __future__ import annotations

import json
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from temples.models import GoriyakuTag, Shrine

pytestmark = pytest.mark.django_db

CANONICAL_NAMES = (
    "縁結び",
    "厄除け",
    "交通安全",
    "商売繁盛",
    "五穀豊穣",
    "開運",
    "家内安全",
    "福徳",
    "学業成就",
    "合格祈願",
    "勝運",
    "仕事運",
    "航海安全",
    "海上安全",
    "武運長久",
    "安産",
    "八方除",
    "夫婦円満",
    "八難除",
    "恋愛成就",
    "導き",
    "美容",
    "方除け",
    "健康長寿",
    "芸能",
    "家庭円満",
    "出世運",
    "金運",
    "芸能運",
    "強運厄除け",
    "技芸上達",
    "八方除け",
    "病気平癒",
    "火防",
    "子宝",
    "心願成就",
    "延命長寿",
    "足腰健康",
    "農業守護",
)


def _seed_canonical_master() -> None:
    GoriyakuTag.objects.all().delete()
    for tag_id, name in enumerate(CANONICAL_NAMES, start=1):
        GoriyakuTag.objects.create(id=tag_id, name=name)


def _make_shrine(**overrides) -> Shrine:
    values = {
        "name_jp": "P0Bテスト神社",
        "address": "東京都千代田区1-1",
        "goriyaku": "",
        "astro_elements": [],
        "visit_style_tags": [],
        "sajin": "",
    }
    values.update(overrides)
    return Shrine.objects.create(**values)


def _write_seed(tmp_path: Path, rows: list[dict]) -> Path:
    path = tmp_path / "seed.json"
    path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    return path


def _run(source: Path, *args: str) -> str:
    out = StringIO()
    call_command("import_shrines_seed", "--source", str(source), *args, stdout=out)
    return out.getvalue()


def _tag_names(shrine: Shrine) -> set[str]:
    return set(shrine.goriyaku_tags.values_list("name", flat=True))


def test_absent_key_leaves_existing_m2m_untouched_and_needs_no_canonical_master(tmp_path):
    shrine = _make_shrine()
    legacy = GoriyakuTag.objects.create(id=99, name="既存リンク")
    shrine.goriyaku_tags.add(legacy)
    source = _write_seed(
        tmp_path,
        [{"name_jp": shrine.name_jp, "address": shrine.address}],
    )

    output = _run(source)

    assert _tag_names(shrine) == {"既存リンク"}
    assert "goriyaku_tags rows=0 updated=0 added_links=0 removed_links=0" in output


def test_skip_goriyaku_tags_allows_base_first_then_normal_pass_syncs_exact_set(tmp_path):
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": "two-passテスト神社",
                "address": "東京都台東区1-1",
                "goriyaku": "開運",
                "goriyaku_tags": ["開運"],
            }
        ],
    )

    first = _run(source, "--skip-goriyaku-tags")

    shrine = Shrine.objects.get(name_jp="two-passテスト神社")
    assert GoriyakuTag.objects.count() == 0
    assert _tag_names(shrine) == set()
    assert "GORIYAKU_TAGS DEFERRED rows=1 base_only_pass" in first
    assert "goriyaku_tags rows=0 updated=0 added_links=0 removed_links=0" in first

    _seed_canonical_master()
    second = _run(source)

    shrine.refresh_from_db()
    assert _tag_names(shrine) == {"開運"}
    assert GoriyakuTag.objects.count() == 39
    assert "GORIYAKU_TAGS SET" in second


def test_explicit_key_sets_exact_canonical_subset_without_creating_tags(tmp_path):
    _seed_canonical_master()
    shrine = _make_shrine()
    shrine.goriyaku_tags.add(
        GoriyakuTag.objects.get(id=1),
        GoriyakuTag.objects.get(id=3),
    )
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "goriyaku_tags": ["縁結び", "厄除け"],
            }
        ],
    )

    output = _run(source)

    assert _tag_names(shrine) == {"縁結び", "厄除け"}
    assert GoriyakuTag.objects.count() == 39
    assert "add=['厄除け'] remove=['交通安全']" in output
    assert "goriyaku_tags rows=1 updated=1 added_links=1 removed_links=1" in output


def test_explicit_key_on_new_shrine_sets_tags_in_same_import(tmp_path):
    _seed_canonical_master()
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": "新規P0B神社",
                "address": "東京都新宿区1-1",
                "goriyaku_tags": ["開運", "商売繁盛"],
            }
        ],
    )

    output = _run(source)

    shrine = Shrine.objects.get(name_jp="新規P0B神社")
    assert _tag_names(shrine) == {"開運", "商売繁盛"}
    assert GoriyakuTag.objects.count() == 39
    assert "CREATE 新規P0B神社" in output
    assert "GORIYAKU_TAGS SET 新規P0B神社" in output


def test_unknown_tag_blocks_before_any_scalar_or_tag_write(tmp_path):
    _seed_canonical_master()
    shrine = _make_shrine(goriyaku="旧値")
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "goriyaku": "新値",
                "goriyaku_tags": ["架空タグ"],
            }
        ],
    )

    with pytest.raises(CommandError, match="unknown goriyaku_tags"):
        _run(source)

    shrine.refresh_from_db()
    assert shrine.goriyaku == "旧値"
    assert _tag_names(shrine) == set()
    assert GoriyakuTag.objects.count() == 39
    assert not GoriyakuTag.objects.filter(name="架空タグ").exists()


def test_incomplete_canonical_master_blocks_explicit_activation(tmp_path):
    GoriyakuTag.objects.all().delete()
    GoriyakuTag.objects.create(id=1, name="縁結び")
    shrine = _make_shrine()
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "goriyaku_tags": ["縁結び"],
            }
        ],
    )

    with pytest.raises(CommandError, match="exact ids 1..39"):
        _run(source)

    assert _tag_names(shrine) == set()


def test_dry_run_reports_exact_set_delta_without_writing_m2m(tmp_path):
    _seed_canonical_master()
    shrine = _make_shrine()
    shrine.goriyaku_tags.add(GoriyakuTag.objects.get(id=1))
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "goriyaku_tags": ["厄除け"],
            }
        ],
    )

    output = _run(source, "--dry-run")

    assert _tag_names(shrine) == {"縁結び"}
    assert "add=['厄除け'] remove=['縁結び']" in output
    assert "goriyaku_tags rows=1 updated=1 added_links=1 removed_links=1" in output


def test_repeating_same_explicit_set_is_idempotent(tmp_path):
    _seed_canonical_master()
    shrine = _make_shrine()
    source = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "goriyaku_tags": ["縁結び", "厄除け"],
            }
        ],
    )

    _run(source)
    second = _run(source)

    assert _tag_names(shrine) == {"縁結び", "厄除け"}
    assert GoriyakuTag.objects.count() == 39
    assert "GORIYAKU_TAGS SKIP" in second
    assert "goriyaku_tags rows=1 updated=0 added_links=0 removed_links=0" in second


def test_explicit_value_must_be_a_unique_non_empty_string_list(tmp_path):
    _seed_canonical_master()
    shrine = _make_shrine()

    not_a_list = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "goriyaku_tags": "縁結び",
            }
        ],
    )
    with pytest.raises(CommandError, match="must be a list"):
        _run(not_a_list)

    duplicate = _write_seed(
        tmp_path,
        [
            {
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "goriyaku_tags": ["縁結び", "縁結び"],
            }
        ],
    )
    with pytest.raises(CommandError, match="duplicate goriyaku_tags"):
        _run(duplicate)
