"""Contract tests for `sync_visit_style_tags_from_seed`.

The command exists to write ONE field on Production. Everything here pins that
boundary: what it refuses to do, what it leaves alone, and that no partial
state can survive a failure.
"""

from __future__ import annotations

import hashlib
import json
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from temples.management.commands import sync_visit_style_tags_from_seed as sync_module
from temples.models import PlaceRef, Shrine

SEED_SIZE = sync_module.EXPECTED_SEED_ROW_COUNT  # 103


# --------------------------------------------------------------------------- #
# fixtures / helpers
# --------------------------------------------------------------------------- #


def _name(index: int) -> str:
    return f"同期テスト神社{index:03d}"


def _address(index: int) -> str:
    return f"東京都同期区{index:03d}-1"


def _seed_rows(tag_overrides: dict[int, list] | None = None) -> list[dict]:
    """A structurally valid Seed of exactly SEED_SIZE rows."""
    overrides = tag_overrides or {}
    return [
        {
            "name_jp": _name(i),
            "address": _address(i),
            "latitude": 35.0 + i * 0.001,
            "longitude": 139.0 + i * 0.001,
            "goriyaku": "開運",
            "kyusei": None,
            "astro_elements": [],
            "visit_style_tags": list(overrides.get(i, ["classic"])),
        }
        for i in range(SEED_SIZE)
    ]


def _write_seed(tmp_path, rows) -> str:
    path = tmp_path / "seed.json"
    path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    return str(path)


def _seed_sha256(source: str) -> str:
    with open(source, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def _create_shrines(
    rows: list[dict],
    *,
    db_tags: dict[int, list] | None = None,
    skip_indexes: set[int] | None = None,
    field_overrides: dict[int, dict] | None = None,
) -> dict[int, Shrine]:
    """Create the matching Shrine rows, optionally drifted from the Seed."""
    db_tags = db_tags or {}
    skip = skip_indexes or set()
    field_overrides = field_overrides or {}

    created: dict[int, Shrine] = {}
    for i, row in enumerate(rows):
        if i in skip:
            continue
        kwargs = {
            "name_jp": row["name_jp"],
            "address": row["address"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "goriyaku": row["goriyaku"],
            "visit_style_tags": list(db_tags.get(i, row["visit_style_tags"])),
        }
        kwargs.update(field_overrides.get(i, {}))
        created[i] = Shrine.objects.create(**kwargs)
    return created


def _run(source: str, *args) -> str:
    out = StringIO()
    call_command(
        "sync_visit_style_tags_from_seed", "--source", source, *args, stdout=out, stderr=out
    )
    return out.getvalue()


def _summary(output: str) -> dict[str, str]:
    values = {}
    for line in output.splitlines():
        if "=" in line and not line.startswith("PRESERVE "):
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip()
    return values


def _all_tags() -> dict[str, list]:
    return {s.name_jp: list(s.visit_style_tags) for s in Shrine.objects.all()}


# --------------------------------------------------------------------------- #
# 1. default is a dry run
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_default_run_is_dry_and_writes_nothing(tmp_path):
    rows = _seed_rows({0: ["quiet", "nature"]})
    _create_shrines(rows, db_tags={0: ["classic"]})
    before = _all_tags()

    output = _run(_write_seed(tmp_path, rows))

    assert _summary(output)["mode"] == "DRY_RUN"
    assert _all_tags() == before


# --------------------------------------------------------------------------- #
# 2. planned_updates is the real diff count
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_single_mismatch_reports_one_planned_update(tmp_path):
    rows = _seed_rows({7: ["business", "classic"]})
    _create_shrines(rows, db_tags={7: ["classic"]})

    output = _run(_write_seed(tmp_path, rows))
    summary = _summary(output)

    assert summary["total_seed"] == str(SEED_SIZE)
    assert summary["planned_updates"] == "1"

    preserve = [line for line in output.splitlines() if line.startswith("PRESERVE ")]
    assert len(preserve) == 1
    payload = json.loads(preserve[0][len("PRESERVE ") :])
    assert payload["name_jp"] == _name(7)
    assert payload["before"] == ["classic"]
    assert payload["after"] == ["business", "classic"]


@pytest.mark.django_db
def test_matching_rows_are_not_planned_for_update(tmp_path):
    rows = _seed_rows()
    _create_shrines(rows)

    summary = _summary(_run(_write_seed(tmp_path, rows)))

    assert summary["planned_updates"] == "0"


@pytest.mark.django_db
def test_seed_tag_order_is_preserved_verbatim(tmp_path):
    # Seed order is canonical: the command must not sort or normalize.
    rows = _seed_rows({3: ["urban", "classic", "business"]})
    _create_shrines(rows, db_tags={3: ["classic"]})
    source = _write_seed(tmp_path, rows)

    _run(
        source,
        "--apply",
        "--expected-updates",
        "1",
        "--expected-seed-sha256",
        _seed_sha256(source),
        "--expected-snapshot-sha256",
        _summary(_run(source))["snapshot_sha256"],
    )

    shrine = Shrine.objects.get(name_jp=_name(3))
    assert shrine.visit_style_tags == ["urban", "classic", "business"]


# --------------------------------------------------------------------------- #
# 3 / 4. apply writes visit_style_tags and nothing else
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_apply_writes_only_visit_style_tags(tmp_path):
    rows = _seed_rows({0: ["quiet", "nature"], 1: ["study"]})
    _create_shrines(rows, db_tags={0: ["classic"], 1: ["classic"]})
    source = _write_seed(tmp_path, rows)
    snapshot_sha = _summary(_run(source))["snapshot_sha256"]

    output = _run(
        source,
        "--apply",
        "--expected-updates",
        "2",
        "--expected-seed-sha256",
        _seed_sha256(source),
        "--expected-snapshot-sha256",
        snapshot_sha,
    )
    summary = _summary(output)

    assert summary["mode"] == "APPLY"
    assert summary["applied_updates"] == "2"
    assert Shrine.objects.get(name_jp=_name(0)).visit_style_tags == ["quiet", "nature"]
    assert Shrine.objects.get(name_jp=_name(1)).visit_style_tags == ["study"]
    # untouched rows stay untouched
    assert Shrine.objects.get(name_jp=_name(2)).visit_style_tags == ["classic"]


@pytest.mark.django_db
def test_apply_leaves_non_visit_style_drift_untouched(tmp_path):
    # Production really does carry goriyaku / latitude / longitude drift
    # (長太稲荷神社, 富岡八幡宮, ...). This command must not "fix" any of it.
    rows = _seed_rows({0: ["quiet"]})
    drift = {
        "goriyaku": "Production側の別のご利益",
        "latitude": 12.5,
        "longitude": 100.25,
        "sajin": "Production側の祭神",
        "description": "Production側の説明",
        "kyusei": "一白水星",
        "astro_elements": ["火"],
        "name_romaji": "production-only",
        "element": "水",
    }
    _create_shrines(rows, db_tags={0: ["classic"]}, field_overrides={0: drift})
    source = _write_seed(tmp_path, rows)
    snapshot_sha = _summary(_run(source))["snapshot_sha256"]

    _run(
        source,
        "--apply",
        "--expected-updates",
        "1",
        "--expected-seed-sha256",
        _seed_sha256(source),
        "--expected-snapshot-sha256",
        snapshot_sha,
    )

    shrine = Shrine.objects.get(name_jp=_name(0))
    assert shrine.visit_style_tags == ["quiet"]
    for field, value in drift.items():
        assert getattr(shrine, field) == value, f"{field} must not be written"


# --------------------------------------------------------------------------- #
# 5 / 6 / 7. identity pre-flight
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_missing_identity_aborts_without_writing(tmp_path):
    rows = _seed_rows({0: ["quiet"]})
    _create_shrines(rows, db_tags={0: ["classic"]}, skip_indexes={5})
    before = _all_tags()
    count_before = Shrine.objects.count()

    with pytest.raises(CommandError, match="no Shrine matches this identity"):
        _run(_write_seed(tmp_path, rows))

    assert _all_tags() == before
    assert Shrine.objects.count() == count_before


@pytest.mark.django_db
def test_duplicate_identity_aborts_without_writing(tmp_path):
    rows = _seed_rows({0: ["quiet"]})
    _create_shrines(rows, db_tags={0: ["classic"]})

    # Both partial unique constraints are conditioned on place_ref IS NULL, so
    # attaching a PlaceRef produces a genuine duplicate identity without
    # touching the Model or adding a migration.
    original = Shrine.objects.get(name_jp=_name(4))
    for suffix in ("a", "b"):
        ref = PlaceRef.objects.create(place_id=f"dup-{suffix}")
        Shrine.objects.create(
            name_jp=original.name_jp,
            address=original.address,
            latitude=original.latitude,
            longitude=original.longitude,
            place_ref=ref,
        )
    assert (
        Shrine.objects.filter(name_jp=_name(4), address=_address(4)).count() == 3
    )
    before = _all_tags()

    with pytest.raises(CommandError, match="refusing to guess"):
        _run(_write_seed(tmp_path, rows))

    assert _all_tags() == before


@pytest.mark.django_db
def test_command_never_creates_a_shrine(tmp_path):
    rows = _seed_rows({0: ["quiet"]})
    _create_shrines(rows, db_tags={0: ["classic"]})
    source = _write_seed(tmp_path, rows)
    snapshot_sha = _summary(_run(source))["snapshot_sha256"]
    count_before = Shrine.objects.count()

    _run(
        source,
        "--apply",
        "--expected-updates",
        "1",
        "--expected-seed-sha256",
        _seed_sha256(source),
        "--expected-snapshot-sha256",
        snapshot_sha,
    )

    assert Shrine.objects.count() == count_before


# --------------------------------------------------------------------------- #
# 8-13. seed validation
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_seed_row_count_other_than_103_aborts(tmp_path):
    rows = _seed_rows()[:-1]
    _create_shrines(rows)

    with pytest.raises(CommandError, match="seed row count must be exactly 103"):
        _run(_write_seed(tmp_path, rows))


@pytest.mark.django_db
def test_missing_visit_style_tags_key_aborts(tmp_path):
    rows = _seed_rows()
    rows[2].pop("visit_style_tags")
    _create_shrines(_seed_rows())

    with pytest.raises(CommandError, match="visit_style_tags key is missing"):
        _run(_write_seed(tmp_path, rows))


@pytest.mark.django_db
def test_unknown_tag_aborts(tmp_path):
    rows = _seed_rows({1: ["classic", "sunset_view"]})
    _create_shrines(_seed_rows())

    with pytest.raises(CommandError, match="outside the allowed taxonomy"):
        _run(_write_seed(tmp_path, rows))


@pytest.mark.django_db
@pytest.mark.parametrize("tag", ["love", "formal", "tourism"])
def test_forbidden_legacy_tag_aborts(tmp_path, tag):
    rows = _seed_rows({1: ["classic", tag]})
    _create_shrines(_seed_rows())

    with pytest.raises(CommandError, match="forbidden legacy label"):
        _run(_write_seed(tmp_path, rows))


@pytest.mark.django_db
def test_request_only_nearby_tag_aborts(tmp_path):
    rows = _seed_rows({1: ["classic", "nearby"]})
    _create_shrines(_seed_rows())

    with pytest.raises(CommandError, match="request-only"):
        _run(_write_seed(tmp_path, rows))


@pytest.mark.django_db
@pytest.mark.parametrize(
    "tags",
    [
        [],
        ["classic", "quiet", "nature", "urban"],
    ],
)
def test_cardinality_outside_1_to_3_aborts(tmp_path, tags):
    rows = _seed_rows({1: tags})
    _create_shrines(_seed_rows())

    with pytest.raises(CommandError, match="cardinality must be 1-3"):
        _run(_write_seed(tmp_path, rows))


@pytest.mark.django_db
def test_duplicate_tag_within_one_shrine_aborts(tmp_path):
    rows = _seed_rows({1: ["classic", "classic"]})
    _create_shrines(_seed_rows())

    with pytest.raises(CommandError, match="duplicate tag"):
        _run(_write_seed(tmp_path, rows))


@pytest.mark.django_db
def test_blank_tag_aborts(tmp_path):
    rows = _seed_rows({1: ["classic", "  "]})
    _create_shrines(_seed_rows())

    with pytest.raises(CommandError, match="blank or non-string tag"):
        _run(_write_seed(tmp_path, rows))


@pytest.mark.django_db
def test_duplicate_identity_inside_the_seed_aborts(tmp_path):
    rows = _seed_rows()
    rows[9]["name_jp"] = rows[8]["name_jp"]
    rows[9]["address"] = rows[8]["address"]
    _create_shrines(_seed_rows())

    with pytest.raises(CommandError, match=r"duplicate \(name_jp, address\)"):
        _run(_write_seed(tmp_path, rows))


@pytest.mark.django_db
def test_seed_validation_runs_before_any_db_write(tmp_path):
    # An invalid Seed plus a real diff: the diff must never be applied.
    rows = _seed_rows({0: ["quiet"], 1: ["classic", "nearby"]})
    _create_shrines(rows, db_tags={0: ["classic"], 1: ["classic"]})
    before = _all_tags()
    source = _write_seed(tmp_path, rows)

    with pytest.raises(CommandError):
        _run(
            source,
            "--apply",
            "--expected-updates",
            "2",
            "--expected-seed-sha256",
            _seed_sha256(source),
            "--expected-snapshot-sha256",
            "deadbeef",
        )

    assert _all_tags() == before


# --------------------------------------------------------------------------- #
# 14-17. expected locks
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_expected_updates_mismatch_aborts_without_writing(tmp_path):
    rows = _seed_rows({0: ["quiet"]})
    _create_shrines(rows, db_tags={0: ["classic"]})
    before = _all_tags()
    source = _write_seed(tmp_path, rows)

    with pytest.raises(CommandError, match="expected update count mismatch"):
        _run(
            source,
            "--apply",
            "--expected-updates",
            "5",
            "--expected-seed-sha256",
            _seed_sha256(source),
            "--expected-snapshot-sha256",
            "whatever",
        )

    assert _all_tags() == before


@pytest.mark.django_db
def test_expected_seed_sha256_mismatch_aborts_without_writing(tmp_path):
    rows = _seed_rows({0: ["quiet"]})
    _create_shrines(rows, db_tags={0: ["classic"]})
    before = _all_tags()
    source = _write_seed(tmp_path, rows)

    with pytest.raises(CommandError, match="seed sha256 mismatch"):
        _run(
            source,
            "--apply",
            "--expected-updates",
            "1",
            "--expected-seed-sha256",
            "0" * 64,
            "--expected-snapshot-sha256",
            "whatever",
        )

    assert _all_tags() == before


@pytest.mark.django_db
def test_expected_snapshot_sha256_mismatch_aborts_without_writing(tmp_path):
    rows = _seed_rows({0: ["quiet"]})
    _create_shrines(rows, db_tags={0: ["classic"]})
    before = _all_tags()
    source = _write_seed(tmp_path, rows)

    with pytest.raises(CommandError, match="snapshot sha256 mismatch"):
        _run(
            source,
            "--apply",
            "--expected-updates",
            "1",
            "--expected-seed-sha256",
            _seed_sha256(source),
            "--expected-snapshot-sha256",
            "1" * 64,
        )

    assert _all_tags() == before


@pytest.mark.django_db
@pytest.mark.parametrize(
    "omit",
    ["--expected-updates", "--expected-seed-sha256", "--expected-snapshot-sha256"],
)
def test_apply_without_every_expected_lock_aborts(tmp_path, omit):
    rows = _seed_rows({0: ["quiet"]})
    _create_shrines(rows, db_tags={0: ["classic"]})
    before = _all_tags()
    source = _write_seed(tmp_path, rows)
    snapshot_sha = _summary(_run(source))["snapshot_sha256"]

    supplied = {
        "--expected-updates": "1",
        "--expected-seed-sha256": _seed_sha256(source),
        "--expected-snapshot-sha256": snapshot_sha,
    }
    supplied.pop(omit)
    args = [item for pair in supplied.items() for item in pair]

    with pytest.raises(CommandError, match="requires every expected lock"):
        _run(source, "--apply", *args)

    assert _all_tags() == before


@pytest.mark.django_db
def test_dry_run_accepts_expected_locks_without_writing(tmp_path):
    rows = _seed_rows({0: ["quiet"]})
    _create_shrines(rows, db_tags={0: ["classic"]})
    before = _all_tags()
    source = _write_seed(tmp_path, rows)
    snapshot_sha = _summary(_run(source))["snapshot_sha256"]

    output = _run(
        source,
        "--expected-updates",
        "1",
        "--expected-seed-sha256",
        _seed_sha256(source),
        "--expected-snapshot-sha256",
        snapshot_sha,
    )

    assert _summary(output)["mode"] == "DRY_RUN"
    assert _all_tags() == before


# --------------------------------------------------------------------------- #
# 18. deterministic snapshot hash
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_snapshot_sha256_is_deterministic_across_dry_runs(tmp_path):
    rows = _seed_rows({0: ["quiet"], 4: ["study", "classic"]})
    _create_shrines(rows, db_tags={0: ["classic"], 4: []})
    source = _write_seed(tmp_path, rows)

    first = _summary(_run(source))
    second = _summary(_run(source))
    third = _summary(_run(source))

    assert first["snapshot_sha256"] == second["snapshot_sha256"] == third["snapshot_sha256"]
    assert first["source_seed_sha256"] == _seed_sha256(source)
    assert first["planned_updates"] == "2"


@pytest.mark.django_db
def test_snapshot_sha256_changes_when_the_plan_changes(tmp_path):
    rows = _seed_rows({0: ["quiet"]})
    _create_shrines(rows, db_tags={0: ["classic"]})
    source = _write_seed(tmp_path, rows)
    baseline = _summary(_run(source))["snapshot_sha256"]

    Shrine.objects.filter(name_jp=_name(1)).update(visit_style_tags=["urban"])
    changed = _summary(_run(source))["snapshot_sha256"]

    assert baseline != changed


def test_snapshot_hash_excludes_volatile_values():
    # The hashed payload is exactly the four core keys -- no timestamp, no host,
    # no run id -- which is what makes a dry run reproducible.
    core = sync_module.build_snapshot_core(
        source_seed_sha256="abc",
        rows=[{"id": 1, "name_jp": "a", "address": "b", "before": [], "after": ["classic"]}],
    )
    assert set(core) == {
        "snapshot_version",
        "source_seed_sha256",
        "planned_update_count",
        "rows",
    }
    assert core["planned_update_count"] == 1
    assert sync_module.compute_snapshot_sha256(core) == sync_module.compute_snapshot_sha256(
        dict(reversed(list(core.items())))
    )


# --------------------------------------------------------------------------- #
# 19. atomicity
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_save_failure_rolls_back_every_update(tmp_path, monkeypatch):
    rows = _seed_rows({0: ["quiet"], 1: ["study"], 2: ["urban"]})
    _create_shrines(rows, db_tags={0: ["classic"], 1: ["classic"], 2: ["classic"]})
    before = _all_tags()
    source = _write_seed(tmp_path, rows)
    snapshot_sha = _summary(_run(source))["snapshot_sha256"]

    original_save = Shrine.save
    calls = {"n": 0}

    def exploding_save(self, *args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("simulated save failure")
        return original_save(self, *args, **kwargs)

    monkeypatch.setattr(Shrine, "save", exploding_save)

    with pytest.raises(RuntimeError, match="simulated save failure"):
        _run(
            source,
            "--apply",
            "--expected-updates",
            "3",
            "--expected-seed-sha256",
            _seed_sha256(source),
            "--expected-snapshot-sha256",
            snapshot_sha,
        )

    monkeypatch.undo()
    assert _all_tags() == before


@pytest.mark.django_db
def test_row_changed_between_preflight_and_apply_rolls_back(tmp_path, monkeypatch):
    rows = _seed_rows({0: ["quiet"], 1: ["study"]})
    _create_shrines(rows, db_tags={0: ["classic"], 1: ["classic"]})
    source = _write_seed(tmp_path, rows)
    snapshot_sha = _summary(_run(source))["snapshot_sha256"]

    original_build = sync_module.Command._build_preservation_rows

    def build_then_drift(self, resolved):
        built = original_build(self, resolved)
        # Simulate a concurrent writer landing after the plan was computed.
        Shrine.objects.filter(name_jp=_name(1)).update(visit_style_tags=["nature"])
        return built

    monkeypatch.setattr(sync_module.Command, "_build_preservation_rows", build_then_drift)

    with pytest.raises(CommandError, match="changed between pre-flight and apply"):
        _run(
            source,
            "--apply",
            "--expected-updates",
            "2",
            "--expected-seed-sha256",
            _seed_sha256(source),
            "--expected-snapshot-sha256",
            snapshot_sha,
        )

    monkeypatch.undo()
    # The first row's write was rolled back with the rest.
    assert Shrine.objects.get(name_jp=_name(0)).visit_style_tags == ["classic"]
