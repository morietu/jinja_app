"""Sync ONLY ``Shrine.visit_style_tags`` from the canonical Base Seed.

Why this exists instead of ``import_shrines_seed``
--------------------------------------------------
A Production ``import_shrines_seed --dry-run`` showed ``updated=66`` while only
64 rows differed in ``visit_style_tags``. The importer carries a full payload
(``goriyaku`` / ``latitude`` / ``longitude`` / ``kyusei`` / ``astro_elements`` /
``name_romaji`` / ``sajin`` / ``description`` / ``element`` / ``location``), and
Production genuinely carries non-Visit-Style drift on top of that -- e.g.
長太稲荷神社 (``goriyaku``), 富岡八幡宮 (``latitude`` / ``longitude``),
給田六所神社 / 建部大社 / 波上宮 (``goriyaku`` + ``visit_style_tags``). Running
the importer to fix Visit Style would silently rewrite all of it in the same
transaction.

This command's responsibility is therefore exactly one field::

    ONLY Shrine.visit_style_tags

Safety contract
---------------
* Default run is a DRY RUN. ``--apply`` is required to write.
* ``--apply`` additionally requires all three expected locks
  (``--expected-updates`` / ``--expected-seed-sha256`` /
  ``--expected-snapshot-sha256``); any missing lock is a hard abort with zero
  writes.
* The full Seed is validated, and every one of the 103 identities is resolved,
  before a single row is written.
* Identity is ``(name_jp, address)`` exact match, the same identity
  ``import_shrines_seed`` uses -- but resolved strictly: 0 matches aborts and
  2+ matches abort. No ``.first()``, no CREATE fallback.
* Writes are ``save(update_fields=["visit_style_tags"])`` inside a single
  ``transaction.atomic()``. All-or-nothing; partial application is impossible.

The Base Seed is the canonical source for ``visit_style_tags``.
``infer_visit_style_tags`` / ``backfill_goriyaku_tags --with-visit-style``
remain REPAIR_ONLY / NON-CANONICAL and are not used here.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from temples.models import Shrine

# Canonical Shrine Visit Style taxonomy. Not extended by this command.
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

# `nearby` is a user-side request condition (relative to the visitor's current
# location), never a fixed Shrine attribute.
REQUEST_ONLY_TAGS = frozenset({"nearby"})

# Retired labels that must never reappear in the canonical Seed.
FORBIDDEN_LEGACY_TAGS = frozenset({"love", "formal", "tourism"})

EXPECTED_SEED_ROW_COUNT = 103
MIN_TAGS_PER_SHRINE = 1
MAX_TAGS_PER_SHRINE = 3

DEFAULT_SOURCE = "temples/data/shrines_seed_clean.json"

SNAPSHOT_VERSION = 1


def canonical_json(payload: Any) -> str:
    """Serialize deterministically so the same content always hashes the same."""
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def compute_snapshot_sha256(core_payload: dict) -> str:
    """SHA256 over the canonical serialization of a snapshot's core payload.

    ``core_payload`` is the snapshot *without* its own ``snapshot_sha256``
    field, and without any volatile value (timestamps, hostnames, run ids), so
    repeating a dry-run against the same Seed and the same DB state reproduces
    the same digest. ``restore_visit_style_tags_snapshot`` recomputes with this
    exact function so the two commands can never drift apart.
    """
    return hashlib.sha256(canonical_json(core_payload).encode("utf-8")).hexdigest()


def build_snapshot_core(
    *, source_seed_sha256: str, rows: list[dict]
) -> dict:
    return {
        "snapshot_version": SNAPSHOT_VERSION,
        "source_seed_sha256": source_seed_sha256,
        "planned_update_count": len(rows),
        "rows": rows,
    }


def validate_seed_rows(data: Any) -> list[dict]:
    """Validate the whole Seed before any DB access. Returns the rows.

    Raises CommandError listing every violation found, so an operator sees the
    complete picture instead of fixing one row at a time.
    """
    if not isinstance(data, list):
        raise CommandError("seed json must be a list")

    if len(data) != EXPECTED_SEED_ROW_COUNT:
        raise CommandError(
            f"seed row count must be exactly {EXPECTED_SEED_ROW_COUNT}, got {len(data)}"
        )

    problems: list[str] = []
    seen_identity: dict[tuple[str, str], int] = {}

    for index, row in enumerate(data):
        label = f"row[{index}]"
        if not isinstance(row, dict):
            problems.append(f"{label}: must be an object")
            continue

        name = row.get("name_jp")
        address = row.get("address")
        name = str(name).strip() if isinstance(name, str) else ""
        address = str(address).strip() if isinstance(address, str) else ""

        if not name:
            problems.append(f"{label}: name_jp must be a non-empty string")
        if not address:
            problems.append(f"{label}: address must be a non-empty string")

        if name and address:
            identity = (name, address)
            if identity in seen_identity:
                problems.append(
                    f"{label} {name!r}: duplicate (name_jp, address) "
                    f"also at row[{seen_identity[identity]}]"
                )
            else:
                seen_identity[identity] = index

        if "visit_style_tags" not in row:
            problems.append(f"{label} {name or '?'}: visit_style_tags key is missing")
            continue

        tags = row["visit_style_tags"]
        if not isinstance(tags, list):
            problems.append(f"{label} {name or '?'}: visit_style_tags must be a list")
            continue

        if not MIN_TAGS_PER_SHRINE <= len(tags) <= MAX_TAGS_PER_SHRINE:
            problems.append(
                f"{label} {name or '?'}: visit_style_tags cardinality must be "
                f"{MIN_TAGS_PER_SHRINE}-{MAX_TAGS_PER_SHRINE}, got {len(tags)}"
            )

        seen_tags: set[str] = set()
        for tag in tags:
            if not isinstance(tag, str) or not tag.strip():
                problems.append(f"{label} {name or '?'}: blank or non-string tag {tag!r}")
                continue
            if tag in seen_tags:
                problems.append(f"{label} {name or '?'}: duplicate tag {tag!r}")
            seen_tags.add(tag)

            if tag in REQUEST_ONLY_TAGS:
                problems.append(
                    f"{label} {name or '?'}: {tag!r} is request-only and must not be "
                    f"a Shrine attribute"
                )
            elif tag in FORBIDDEN_LEGACY_TAGS:
                problems.append(
                    f"{label} {name or '?'}: {tag!r} is a forbidden legacy label"
                )
            elif tag not in ALLOWED_VISIT_STYLE_TAGS:
                problems.append(
                    f"{label} {name or '?'}: {tag!r} is outside the allowed taxonomy"
                )

    if problems:
        raise CommandError(
            "seed validation failed with "
            f"{len(problems)} problem(s); no row was written:\n  - "
            + "\n  - ".join(problems)
        )

    return data


class Command(BaseCommand):
    help = (
        "Sync ONLY Shrine.visit_style_tags from the canonical Base Seed. "
        "Dry-run by default; --apply requires all three expected locks."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            type=str,
            default=DEFAULT_SOURCE,
            help="canonical seed json path",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="actually write. Without it the command never touches the DB.",
        )
        parser.add_argument(
            "--expected-updates",
            type=int,
            default=None,
            help="abort unless the planned update count equals this value",
        )
        parser.add_argument(
            "--expected-seed-sha256",
            type=str,
            default=None,
            help="abort unless sha256(source raw bytes) equals this value",
        )
        parser.add_argument(
            "--expected-snapshot-sha256",
            type=str,
            default=None,
            help="abort unless the computed preservation snapshot hash equals this value",
        )

    def handle(self, *args, **options):
        source = Path(options["source"])
        apply_changes = bool(options["apply"])
        expected_updates = options["expected_updates"]
        expected_seed_sha256 = options["expected_seed_sha256"]
        expected_snapshot_sha256 = options["expected_snapshot_sha256"]

        # --- 1. --apply gate: every lock must be present before anything else.
        if apply_changes:
            missing_locks = [
                name
                for name, value in (
                    ("--expected-updates", expected_updates),
                    ("--expected-seed-sha256", expected_seed_sha256),
                    ("--expected-snapshot-sha256", expected_snapshot_sha256),
                )
                if value is None
            ]
            if missing_locks:
                raise CommandError(
                    "--apply requires every expected lock; missing: "
                    + ", ".join(missing_locks)
                )

        if not source.exists():
            raise CommandError(f"source file not found: {source}")

        # --- 2. Seed SHA over raw bytes.
        raw_bytes = source.read_bytes()
        source_seed_sha256 = hashlib.sha256(raw_bytes).hexdigest()

        if (
            expected_seed_sha256 is not None
            and expected_seed_sha256 != source_seed_sha256
        ):
            raise CommandError(
                "seed sha256 mismatch; no row was written. "
                f"expected={expected_seed_sha256} actual={source_seed_sha256}"
            )

        # --- 3. Seed validation (no DB access yet).
        try:
            data = json.loads(raw_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise CommandError(f"seed json is not readable: {exc}") from exc

        seed_rows = validate_seed_rows(data)

        # --- 4. Identity pre-flight for every Seed row.
        resolved, identity_problems = self._resolve_identities(seed_rows)
        if identity_problems:
            raise CommandError(
                "identity pre-flight failed with "
                f"{len(identity_problems)} problem(s); no row was written:\n  - "
                + "\n  - ".join(identity_problems)
            )

        # --- 5. Diff on visit_style_tags only, in Seed order.
        preservation_rows = self._build_preservation_rows(resolved)
        planned_updates = len(preservation_rows)

        core_payload = build_snapshot_core(
            source_seed_sha256=source_seed_sha256, rows=preservation_rows
        )
        snapshot_sha256 = compute_snapshot_sha256(core_payload)

        # --- 6. Expected locks against the computed plan.
        if expected_updates is not None and expected_updates != planned_updates:
            raise CommandError(
                "expected update count mismatch; no row was written. "
                f"expected={expected_updates} planned={planned_updates}"
            )

        if (
            expected_snapshot_sha256 is not None
            and expected_snapshot_sha256 != snapshot_sha256
        ):
            raise CommandError(
                "snapshot sha256 mismatch; no row was written. "
                f"expected={expected_snapshot_sha256} actual={snapshot_sha256}"
            )

        # --- 7. Machine-readable preservation rows (one line each, never one
        # giant JSON blob).
        for row in preservation_rows:
            self.stdout.write("PRESERVE " + canonical_preserve_line(row))

        mode = "APPLY" if apply_changes else "DRY_RUN"
        self.stdout.write(f"mode={mode}")
        self.stdout.write(f"total_seed={len(seed_rows)}")
        self.stdout.write(f"planned_updates={planned_updates}")
        self.stdout.write(f"source_seed_sha256={source_seed_sha256}")
        self.stdout.write(f"snapshot_sha256={snapshot_sha256}")

        if not apply_changes:
            self.stdout.write(
                self.style.WARNING(
                    "DRY RUN: no row was written. Re-run with --apply and all three "
                    "expected locks to write."
                )
            )
            return

        applied = self._apply(preservation_rows)
        self.stdout.write(f"applied_updates={applied}")
        self.stdout.write(
            self.style.SUCCESS(
                f"visit_style_tags sync applied to {applied} shrine(s); "
                "no other field was written."
            )
        )

    # ------------------------------------------------------------------ #

    def _resolve_identities(
        self, seed_rows: list[dict]
    ) -> tuple[list[tuple[dict, Shrine]], list[str]]:
        """Resolve every Seed row to exactly one existing Shrine.

        0 matches and 2+ matches are both hard failures: this command never
        creates a Shrine, and never silently picks one of several candidates.
        """
        resolved: list[tuple[dict, Shrine]] = []
        problems: list[str] = []

        for row in seed_rows:
            name = str(row["name_jp"]).strip()
            address = str(row["address"]).strip()
            matches = list(
                Shrine.objects.filter(name_jp=name, address=address).order_by("id")[:2]
            )

            if not matches:
                problems.append(
                    f"{name!r} / {address!r}: no Shrine matches this identity "
                    f"(CREATE is not allowed)"
                )
                continue
            if len(matches) > 1:
                problems.append(
                    f"{name!r} / {address!r}: {len(matches)}+ Shrines match this "
                    f"identity; refusing to guess"
                )
                continue

            resolved.append((row, matches[0]))

        return resolved, problems

    def _build_preservation_rows(
        self, resolved: list[tuple[dict, Shrine]]
    ) -> list[dict]:
        """Rows whose visit_style_tags differ, in Seed order.

        Seed tag order is canonical and is preserved verbatim -- nothing here
        sorts or normalizes the tag list.
        """
        rows: list[dict] = []
        for seed_row, shrine in resolved:
            before = list(shrine.visit_style_tags or [])
            after = list(seed_row["visit_style_tags"])
            if before == after:
                continue
            rows.append(
                {
                    "id": shrine.id,
                    "name_jp": shrine.name_jp,
                    "address": shrine.address,
                    "before": before,
                    "after": after,
                }
            )
        return rows

    def _apply(self, preservation_rows: list[dict]) -> int:
        """Write inside one atomic block. All-or-nothing."""
        applied = 0
        with transaction.atomic():
            # Lock the exact rows we planned against, then re-verify that
            # `before` still holds. Anything that changed between the pre-flight
            # read and the lock invalidates the plan (and its snapshot hash), so
            # the whole transaction is rolled back rather than applied blindly.
            locked = {
                shrine.id: shrine
                for shrine in Shrine.objects.select_for_update()
                .filter(id__in=[row["id"] for row in preservation_rows])
                .order_by("id")
            }

            for row in preservation_rows:
                shrine = locked.get(row["id"])
                if shrine is None:
                    raise CommandError(
                        f"shrine id={row['id']} disappeared between pre-flight and "
                        f"apply; the whole sync was rolled back"
                    )
                current = list(shrine.visit_style_tags or [])
                if current != row["before"]:
                    raise CommandError(
                        f"shrine id={row['id']} changed between pre-flight and apply "
                        f"(expected before={row['before']!r}, found {current!r}); "
                        f"the whole sync was rolled back"
                    )

                shrine.visit_style_tags = list(row["after"])
                shrine.save(update_fields=["visit_style_tags"])
                applied += 1

        return applied


def canonical_preserve_line(row: dict) -> str:
    """One preservation row as a single machine-readable JSON line.

    Key order here is the human-facing display order (id, name_jp, address,
    before, after); the *hash* uses ``canonical_json`` with sorted keys.
    """
    return json.dumps(
        {
            "id": row["id"],
            "name_jp": row["name_jp"],
            "address": row["address"],
            "before": row["before"],
            "after": row["after"],
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
