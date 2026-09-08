"""Restore ``Shrine.visit_style_tags`` to the pre-sync state of a snapshot.

Counterpart of ``sync_visit_style_tags_from_seed``. If Mother Ship withdraws a
Production Visit Style sync, this replays each preserved row's ``before`` value
back onto the Shrine -- exactly, and only for ``visit_style_tags``.

Safety contract
---------------
* Default run is a DRY RUN. ``--apply`` is required to write, and then
  ``--expected-snapshot-sha256`` is mandatory.
* The snapshot's own ``snapshot_sha256`` is recomputed with the *same* function
  the sync command used (``compute_snapshot_sha256``), so a tampered or
  hand-edited snapshot is rejected before any DB access.
* **Rollback interlock:** every row's current ``visit_style_tags`` must still
  equal the snapshot's ``after``. If even one row has moved on, the entire
  restore aborts. A stale snapshot must never clobber a later legitimate edit.
* Writes are ``save(update_fields=["visit_style_tags"])`` inside a single
  ``transaction.atomic()``. All-or-nothing; partial restore is impossible.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from temples.management.commands.sync_visit_style_tags_from_seed import (
    SNAPSHOT_VERSION,
    compute_snapshot_sha256,
)
from temples.models import Shrine

SNAPSHOT_HASH_FIELD = "snapshot_sha256"


def snapshot_core_payload(snapshot: dict) -> dict:
    """The hashed part of a snapshot: everything except the hash field itself.

    Taking the mapping as-is (rather than rebuilding a known set of keys) means
    an added, removed, or renamed key also changes the digest, so tampering is
    detected instead of silently ignored.
    """
    return {key: value for key, value in snapshot.items() if key != SNAPSHOT_HASH_FIELD}


def validate_snapshot(snapshot: Any) -> list[dict]:
    """Validate snapshot structure and integrity. Returns its rows."""
    if not isinstance(snapshot, dict):
        raise CommandError("snapshot json must be an object")

    problems: list[str] = []

    version = snapshot.get("snapshot_version")
    if version != SNAPSHOT_VERSION:
        problems.append(
            f"snapshot_version must be {SNAPSHOT_VERSION}, got {version!r}"
        )

    rows = snapshot.get("rows")
    if not isinstance(rows, list):
        problems.append("rows must be a list")
        raise CommandError(
            "snapshot validation failed; no row was written:\n  - "
            + "\n  - ".join(problems)
        )

    planned = snapshot.get("planned_update_count")
    if planned != len(rows):
        problems.append(
            f"planned_update_count must equal len(rows); "
            f"planned_update_count={planned!r} len(rows)={len(rows)}"
        )

    seen_ids: dict[Any, int] = {}
    seen_identity: dict[tuple[str, str], int] = {}

    for index, row in enumerate(rows):
        label = f"rows[{index}]"
        if not isinstance(row, dict):
            problems.append(f"{label}: must be an object")
            continue

        row_id = row.get("id")
        if not isinstance(row_id, int) or isinstance(row_id, bool):
            problems.append(f"{label}: id must be an integer, got {row_id!r}")
        elif row_id in seen_ids:
            problems.append(
                f"{label}: duplicate id {row_id} also at rows[{seen_ids[row_id]}]"
            )
        else:
            seen_ids[row_id] = index

        name = row.get("name_jp")
        address = row.get("address")
        if not isinstance(name, str) or not name.strip():
            problems.append(f"{label}: name_jp must be a non-empty string")
        if not isinstance(address, str) or not address.strip():
            problems.append(f"{label}: address must be a non-empty string")

        if isinstance(name, str) and isinstance(address, str):
            identity = (name, address)
            if identity in seen_identity:
                problems.append(
                    f"{label}: duplicate (name_jp, address) also at "
                    f"rows[{seen_identity[identity]}]"
                )
            else:
                seen_identity[identity] = index

        for field in ("before", "after"):
            if not isinstance(row.get(field), list):
                problems.append(f"{label}: {field} must be a list")

    if problems:
        raise CommandError(
            f"snapshot validation failed with {len(problems)} problem(s); "
            "no row was written:\n  - " + "\n  - ".join(problems)
        )

    return rows


class Command(BaseCommand):
    help = (
        "Restore Shrine.visit_style_tags to a preservation snapshot's `before` "
        "values. Dry-run by default; --apply requires --expected-snapshot-sha256."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--snapshot",
            type=str,
            required=True,
            help="preservation snapshot json produced by sync_visit_style_tags_from_seed",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="actually write. Without it the command never touches the DB.",
        )
        parser.add_argument(
            "--expected-snapshot-sha256",
            type=str,
            default=None,
            help="abort unless the recomputed snapshot hash equals this value",
        )

    def handle(self, *args, **options):
        snapshot_path = Path(options["snapshot"])
        apply_changes = bool(options["apply"])
        expected_snapshot_sha256 = options["expected_snapshot_sha256"]

        if apply_changes and expected_snapshot_sha256 is None:
            raise CommandError(
                "--apply requires --expected-snapshot-sha256; no row was written"
            )

        if not snapshot_path.exists():
            raise CommandError(f"snapshot file not found: {snapshot_path}")

        try:
            snapshot = json.loads(snapshot_path.read_bytes().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise CommandError(f"snapshot json is not readable: {exc}") from exc

        rows = validate_snapshot(snapshot)

        # --- Integrity: stored hash must match a fresh recomputation.
        recomputed = compute_snapshot_sha256(snapshot_core_payload(snapshot))
        stored = snapshot.get(SNAPSHOT_HASH_FIELD)
        if stored != recomputed:
            raise CommandError(
                "snapshot integrity check failed; no row was written. "
                f"stored={stored!r} recomputed={recomputed}"
            )

        if (
            expected_snapshot_sha256 is not None
            and expected_snapshot_sha256 != recomputed
        ):
            raise CommandError(
                "expected snapshot sha256 mismatch; no row was written. "
                f"expected={expected_snapshot_sha256} actual={recomputed}"
            )

        # --- DB pre-flight: identity, id agreement, and the rollback interlock.
        resolved, problems = self._resolve_rows(rows)
        if problems:
            raise CommandError(
                f"restore pre-flight failed with {len(problems)} problem(s); "
                "no row was written:\n  - " + "\n  - ".join(problems)
            )

        for row in rows:
            self.stdout.write("RESTORE " + canonical_restore_line(row))

        mode = "APPLY" if apply_changes else "DRY_RUN"
        self.stdout.write(f"mode={mode}")
        self.stdout.write(f"snapshot_version={snapshot.get('snapshot_version')}")
        self.stdout.write(
            f"source_seed_sha256={snapshot.get('source_seed_sha256')}"
        )
        self.stdout.write(f"planned_restores={len(rows)}")
        self.stdout.write(f"snapshot_sha256={recomputed}")

        if not apply_changes:
            self.stdout.write(
                self.style.WARNING(
                    "DRY RUN: no row was written. Re-run with --apply and "
                    "--expected-snapshot-sha256 to write."
                )
            )
            return

        applied = self._apply(resolved)
        self.stdout.write(f"applied_restores={applied}")
        self.stdout.write(
            self.style.SUCCESS(
                f"visit_style_tags restored on {applied} shrine(s); "
                "no other field was written."
            )
        )

    # ------------------------------------------------------------------ #

    def _resolve_rows(self, rows: list[dict]) -> tuple[list[tuple[dict, Shrine]], list[str]]:
        resolved: list[tuple[dict, Shrine]] = []
        problems: list[str] = []

        for row in rows:
            name = row["name_jp"]
            address = row["address"]
            matches = list(
                Shrine.objects.filter(name_jp=name, address=address).order_by("id")[:2]
            )

            if not matches:
                problems.append(
                    f"{name!r} / {address!r}: no Shrine matches this identity"
                )
                continue
            if len(matches) > 1:
                problems.append(
                    f"{name!r} / {address!r}: {len(matches)}+ Shrines match this "
                    f"identity; refusing to guess"
                )
                continue

            shrine = matches[0]
            if shrine.id != row["id"]:
                problems.append(
                    f"{name!r} / {address!r}: snapshot id={row['id']} does not match "
                    f"DB id={shrine.id}"
                )
                continue

            # Rollback interlock: the row must still carry what the sync wrote.
            current = list(shrine.visit_style_tags or [])
            if current != list(row["after"]):
                problems.append(
                    f"{name!r} (id={shrine.id}): current visit_style_tags "
                    f"{current!r} != snapshot after {list(row['after'])!r}; the row "
                    f"changed after the sync, so this snapshot must not overwrite it"
                )
                continue

            resolved.append((row, shrine))

        return resolved, problems

    def _apply(self, resolved: list[tuple[dict, Shrine]]) -> int:
        applied = 0
        with transaction.atomic():
            locked = {
                shrine.id: shrine
                for shrine in Shrine.objects.select_for_update()
                .filter(id__in=[shrine.id for _row, shrine in resolved])
                .order_by("id")
            }

            for row, shrine in resolved:
                locked_shrine = locked.get(shrine.id)
                if locked_shrine is None:
                    raise CommandError(
                        f"shrine id={shrine.id} disappeared between pre-flight and "
                        f"apply; the whole restore was rolled back"
                    )
                current = list(locked_shrine.visit_style_tags or [])
                if current != list(row["after"]):
                    raise CommandError(
                        f"shrine id={shrine.id} changed between pre-flight and apply "
                        f"(expected after={list(row['after'])!r}, found {current!r}); "
                        f"the whole restore was rolled back"
                    )

                locked_shrine.visit_style_tags = list(row["before"])
                locked_shrine.save(update_fields=["visit_style_tags"])
                applied += 1

        return applied


def canonical_restore_line(row: dict) -> str:
    """One restore row as a single machine-readable JSON line.

    ``from`` is what the row currently carries (the snapshot's ``after``) and
    ``to`` is what it will be restored to (the snapshot's ``before``).
    """
    return json.dumps(
        {
            "id": row["id"],
            "name_jp": row["name_jp"],
            "address": row["address"],
            "from": row["after"],
            "to": row["before"],
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
