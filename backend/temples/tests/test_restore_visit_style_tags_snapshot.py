"""Contract tests for `restore_visit_style_tags_snapshot`.

The rollback path is the more dangerous of the two commands: it writes values
that were captured at some earlier point in time. These tests pin the
interlocks that stop a stale snapshot from clobbering a later legitimate edit.
"""

from __future__ import annotations

import json
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from temples.management.commands import restore_visit_style_tags_snapshot as restore_module
from temples.management.commands.sync_visit_style_tags_from_seed import (
    build_snapshot_core,
    compute_snapshot_sha256,
)
from temples.models import PlaceRef, Shrine


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


def _make_shrine(name: str, address: str, tags: list, **extra) -> Shrine:
    return Shrine.objects.create(
        name_jp=name,
        address=address,
        latitude=35.0,
        longitude=139.0,
        visit_style_tags=list(tags),
        **extra,
    )


def _snapshot_payload(rows: list[dict], *, source_seed_sha256: str = "seed-sha") -> dict:
    core = build_snapshot_core(source_seed_sha256=source_seed_sha256, rows=rows)
    return {**core, "snapshot_sha256": compute_snapshot_sha256(core)}


def _write_snapshot(tmp_path, payload: dict, name: str = "snapshot.json") -> str:
    path = tmp_path / name
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return str(path)


def _row(shrine: Shrine, before: list, after: list) -> dict:
    return {
        "id": shrine.id,
        "name_jp": shrine.name_jp,
        "address": shrine.address,
        "before": list(before),
        "after": list(after),
    }


def _run(snapshot: str, *args) -> str:
    out = StringIO()
    call_command(
        "restore_visit_style_tags_snapshot",
        "--snapshot",
        snapshot,
        *args,
        stdout=out,
        stderr=out,
    )
    return out.getvalue()


def _summary(output: str) -> dict[str, str]:
    values = {}
    for line in output.splitlines():
        if "=" in line and not line.startswith("RESTORE "):
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip()
    return values


def _all_tags() -> dict[str, list]:
    return {s.name_jp: list(s.visit_style_tags) for s in Shrine.objects.all()}


@pytest.fixture
def synced(tmp_path):
    """Two shrines already carrying the post-sync (`after`) values."""
    a = _make_shrine("復元テスト神社A", "東京都復元区1-1", ["quiet", "nature"])
    b = _make_shrine("復元テスト神社B", "東京都復元区2-2", ["study"])
    rows = [_row(a, ["classic"], ["quiet", "nature"]), _row(b, [], ["study"])]
    payload = _snapshot_payload(rows)
    return {
        "a": a,
        "b": b,
        "rows": rows,
        "payload": payload,
        "path": _write_snapshot(tmp_path, payload),
        "sha": payload["snapshot_sha256"],
    }


# --------------------------------------------------------------------------- #
# 1 / 2. dry run
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_default_run_is_dry_and_writes_nothing(synced):
    before = _all_tags()

    output = _run(synced["path"])
    summary = _summary(output)

    assert summary["mode"] == "DRY_RUN"
    assert summary["planned_restores"] == "2"
    assert summary["snapshot_sha256"] == synced["sha"]
    assert _all_tags() == before


@pytest.mark.django_db
def test_dry_run_emits_a_restore_plan_line_per_row(synced):
    output = _run(synced["path"])

    lines = [line for line in output.splitlines() if line.startswith("RESTORE ")]
    assert len(lines) == 2

    first = json.loads(lines[0][len("RESTORE ") :])
    assert first["id"] == synced["a"].id
    assert first["from"] == ["quiet", "nature"]
    assert first["to"] == ["classic"]


# --------------------------------------------------------------------------- #
# 3. apply
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_apply_restores_only_visit_style_tags(synced):
    drifted = _make_shrine(
        "復元テスト神社C",
        "東京都復元区3-3",
        ["urban"],
        goriyaku="変更してはいけないご利益",
    )

    output = _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])
    summary = _summary(output)

    assert summary["mode"] == "APPLY"
    assert summary["applied_restores"] == "2"
    assert Shrine.objects.get(pk=synced["a"].pk).visit_style_tags == ["classic"]
    assert Shrine.objects.get(pk=synced["b"].pk).visit_style_tags == []
    # a shrine outside the snapshot is never touched
    drifted.refresh_from_db()
    assert drifted.visit_style_tags == ["urban"]
    assert drifted.goriyaku == "変更してはいけないご利益"


@pytest.mark.django_db
def test_apply_does_not_write_any_other_field(synced):
    shrine = synced["a"]
    Shrine.objects.filter(pk=shrine.pk).update(
        goriyaku="Production側のご利益",
        latitude=11.5,
        longitude=99.5,
        sajin="Production側の祭神",
    )

    _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])

    shrine.refresh_from_db()
    assert shrine.visit_style_tags == ["classic"]
    assert shrine.goriyaku == "Production側のご利益"
    assert shrine.latitude == 11.5
    assert shrine.longitude == 99.5
    assert shrine.sajin == "Production側の祭神"


@pytest.mark.django_db
def test_restore_never_creates_or_deletes_a_shrine(synced):
    count_before = Shrine.objects.count()

    _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])

    assert Shrine.objects.count() == count_before


# --------------------------------------------------------------------------- #
# 4. the rollback interlock
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_current_value_different_from_snapshot_after_aborts(synced):
    # A legitimate later edit landed after the sync. The stale snapshot must
    # not overwrite it -- and must not restore the *other* row either.
    Shrine.objects.filter(pk=synced["b"].pk).update(visit_style_tags=["business"])
    before = _all_tags()

    with pytest.raises(CommandError, match="!= snapshot after"):
        _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])

    assert _all_tags() == before


@pytest.mark.django_db
def test_interlock_also_blocks_dry_run_planning(synced):
    Shrine.objects.filter(pk=synced["a"].pk).update(visit_style_tags=["nature", "quiet"])

    with pytest.raises(CommandError, match="!= snapshot after"):
        _run(synced["path"])


@pytest.mark.django_db
def test_tag_order_difference_counts_as_a_changed_row(synced):
    # ["nature","quiet"] is not ["quiet","nature"]: order is canonical.
    Shrine.objects.filter(pk=synced["a"].pk).update(visit_style_tags=["nature", "quiet"])
    before = _all_tags()

    with pytest.raises(CommandError, match="!= snapshot after"):
        _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])

    assert _all_tags() == before


# --------------------------------------------------------------------------- #
# 5 / 6 / 7. identity pre-flight
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_missing_identity_aborts_without_writing(synced):
    Shrine.objects.filter(pk=synced["b"].pk).delete()
    before = _all_tags()

    with pytest.raises(CommandError, match="no Shrine matches this identity"):
        _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])

    assert _all_tags() == before


@pytest.mark.django_db
def test_duplicate_identity_aborts_without_writing(synced):
    original = synced["a"]
    ref = PlaceRef.objects.create(place_id="restore-dup")
    Shrine.objects.create(
        name_jp=original.name_jp,
        address=original.address,
        latitude=original.latitude,
        longitude=original.longitude,
        place_ref=ref,
    )
    before = _all_tags()

    with pytest.raises(CommandError, match="refusing to guess"):
        _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])

    assert _all_tags() == before


@pytest.mark.django_db
def test_snapshot_id_not_matching_db_id_aborts(tmp_path):
    shrine = _make_shrine("復元ID不一致神社", "東京都復元区9-9", ["quiet"])
    rows = [
        {
            "id": shrine.id + 10_000,
            "name_jp": shrine.name_jp,
            "address": shrine.address,
            "before": ["classic"],
            "after": ["quiet"],
        }
    ]
    payload = _snapshot_payload(rows)
    path = _write_snapshot(tmp_path, payload)
    before = _all_tags()

    with pytest.raises(CommandError, match="does not match"):
        _run(path, "--apply", "--expected-snapshot-sha256", payload["snapshot_sha256"])

    assert _all_tags() == before


# --------------------------------------------------------------------------- #
# 8 / 9 / 10. snapshot integrity and expected hash
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_tampered_snapshot_row_is_rejected(synced, tmp_path):
    payload = json.loads(json.dumps(synced["payload"]))
    payload["rows"][0]["before"] = ["business"]  # edited, hash left alone
    path = _write_snapshot(tmp_path, payload, name="tampered.json")
    before = _all_tags()

    with pytest.raises(CommandError, match="snapshot integrity check failed"):
        _run(path)

    assert _all_tags() == before


@pytest.mark.django_db
def test_extra_key_added_to_snapshot_is_rejected(synced, tmp_path):
    payload = json.loads(json.dumps(synced["payload"]))
    payload["injected"] = "anything"
    path = _write_snapshot(tmp_path, payload, name="injected.json")

    with pytest.raises(CommandError, match="snapshot integrity check failed"):
        _run(path)


@pytest.mark.django_db
def test_expected_snapshot_sha256_mismatch_aborts_without_writing(synced):
    before = _all_tags()

    with pytest.raises(CommandError, match="expected snapshot sha256 mismatch"):
        _run(synced["path"], "--apply", "--expected-snapshot-sha256", "0" * 64)

    assert _all_tags() == before


@pytest.mark.django_db
def test_apply_without_expected_snapshot_sha256_aborts_without_writing(synced):
    before = _all_tags()

    with pytest.raises(CommandError, match="requires --expected-snapshot-sha256"):
        _run(synced["path"], "--apply")

    assert _all_tags() == before


# --------------------------------------------------------------------------- #
# snapshot schema validation
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_wrong_snapshot_version_aborts(synced, tmp_path):
    payload = json.loads(json.dumps(synced["payload"]))
    payload["snapshot_version"] = 2
    payload["snapshot_sha256"] = compute_snapshot_sha256(
        {k: v for k, v in payload.items() if k != "snapshot_sha256"}
    )
    path = _write_snapshot(tmp_path, payload, name="v2.json")

    with pytest.raises(CommandError, match="snapshot_version must be 1"):
        _run(path)


@pytest.mark.django_db
def test_planned_update_count_not_matching_rows_aborts(synced, tmp_path):
    payload = json.loads(json.dumps(synced["payload"]))
    payload["planned_update_count"] = 99
    payload["snapshot_sha256"] = compute_snapshot_sha256(
        {k: v for k, v in payload.items() if k != "snapshot_sha256"}
    )
    path = _write_snapshot(tmp_path, payload, name="count.json")

    with pytest.raises(CommandError, match="planned_update_count must equal len\\(rows\\)"):
        _run(path)


@pytest.mark.django_db
def test_duplicate_id_in_snapshot_aborts(synced, tmp_path):
    rows = [_row(synced["a"], ["classic"], ["quiet", "nature"])] * 2
    payload = _snapshot_payload(rows)
    path = _write_snapshot(tmp_path, payload, name="dupid.json")

    with pytest.raises(CommandError, match="duplicate id"):
        _run(path)


@pytest.mark.django_db
def test_non_list_before_or_after_aborts(synced, tmp_path):
    rows = [
        {
            "id": synced["a"].id,
            "name_jp": synced["a"].name_jp,
            "address": synced["a"].address,
            "before": "classic",
            "after": ["quiet", "nature"],
        }
    ]
    payload = _snapshot_payload(rows)
    path = _write_snapshot(tmp_path, payload, name="badbefore.json")

    with pytest.raises(CommandError, match="before must be a list"):
        _run(path)


@pytest.mark.django_db
def test_missing_snapshot_file_aborts(tmp_path):
    with pytest.raises(CommandError, match="snapshot file not found"):
        _run(str(tmp_path / "nope.json"))


# --------------------------------------------------------------------------- #
# 11. atomicity
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_save_failure_rolls_back_every_restore(synced, monkeypatch):
    before = _all_tags()

    original_save = Shrine.save
    calls = {"n": 0}

    def exploding_save(self, *args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("simulated restore failure")
        return original_save(self, *args, **kwargs)

    monkeypatch.setattr(Shrine, "save", exploding_save)

    with pytest.raises(RuntimeError, match="simulated restore failure"):
        _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])

    monkeypatch.undo()
    assert _all_tags() == before


@pytest.mark.django_db
def test_row_changed_between_preflight_and_apply_rolls_back(synced, monkeypatch):
    original_resolve = restore_module.Command._resolve_rows

    def resolve_then_drift(self, rows):
        resolved, problems = original_resolve(self, rows)
        Shrine.objects.filter(pk=synced["b"].pk).update(visit_style_tags=["urban"])
        return resolved, problems

    monkeypatch.setattr(restore_module.Command, "_resolve_rows", resolve_then_drift)

    with pytest.raises(CommandError, match="changed between pre-flight and apply"):
        _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])

    monkeypatch.undo()
    assert Shrine.objects.get(pk=synced["a"].pk).visit_style_tags == ["quiet", "nature"]


# --------------------------------------------------------------------------- #
# round trip
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_apply_then_restore_returns_the_exact_pre_sync_values(synced):
    pre_sync = {
        synced["a"].pk: ["classic"],
        synced["b"].pk: [],
    }

    _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])

    for pk, expected in pre_sync.items():
        assert Shrine.objects.get(pk=pk).visit_style_tags == expected

    # A second restore is now blocked by the interlock: the rows no longer
    # carry `after`, so the snapshot has been spent.
    with pytest.raises(CommandError, match="!= snapshot after"):
        _run(synced["path"], "--apply", "--expected-snapshot-sha256", synced["sha"])
