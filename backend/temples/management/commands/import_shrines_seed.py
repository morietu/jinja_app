import json
import os
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from temples.models import GoriyakuTag, Shrine


CANONICAL_GORIYAKU_TAG_IDS = tuple(range(1, 40))


def _parse_explicit_goriyaku_tags(data: list[dict]) -> dict[int, list[str]]:
    """Validate explicit goriyaku_tags without changing legacy key-absent rows."""
    explicit: dict[int, list[str]] = {}

    for index, row in enumerate(data):
        name = str(row.get("name_jp") or "").strip()
        address = str(row.get("address") or "").strip()
        if not name or not address or "goriyaku_tags" not in row:
            continue

        raw = row["goriyaku_tags"]
        if not isinstance(raw, list):
            raise CommandError(
                f"{name}: goriyaku_tags must be a list of canonical tag names"
            )

        names: list[str] = []
        seen: set[str] = set()
        for value in raw:
            if not isinstance(value, str) or not value.strip():
                raise CommandError(
                    f"{name}: goriyaku_tags must contain non-empty strings only"
                )
            tag_name = value.strip()
            if tag_name in seen:
                raise CommandError(
                    f"{name}: duplicate goriyaku_tags entry {tag_name!r}"
                )
            seen.add(tag_name)
            names.append(tag_name)

        explicit[index] = names

    return explicit


def _canonical_goriyaku_tag_map(requested_names: set[str]) -> dict[str, GoriyakuTag]:
    """Resolve only the Production-compatible canonical master (ids 1..39)."""
    if not requested_names:
        return {}

    canonical = list(
        GoriyakuTag.objects.filter(
            id__gte=CANONICAL_GORIYAKU_TAG_IDS[0],
            id__lte=CANONICAL_GORIYAKU_TAG_IDS[-1],
        ).order_by("id")
    )
    ids = tuple(tag.id for tag in canonical)
    if ids != CANONICAL_GORIYAKU_TAG_IDS:
        raise CommandError(
            "explicit goriyaku_tags require the canonical GoriyakuTag master "
            "with exact ids 1..39"
        )

    by_name = {tag.name: tag for tag in canonical}
    if len(by_name) != len(CANONICAL_GORIYAKU_TAG_IDS):
        raise CommandError(
            "canonical GoriyakuTag master contains duplicate names; import blocked"
        )

    unknown = sorted(requested_names - set(by_name))
    if unknown:
        raise CommandError(
            f"unknown goriyaku_tags outside canonical master: {unknown}"
        )

    return by_name


class Command(BaseCommand):
    help = "Import shrine seed data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            type=str,
            default="temples/data/shrines_seed_clean.json",
            help="seed json path",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="DBを更新せずに create/update/skip の件数だけ確認する",
        )
        parser.add_argument(
            "--skip-goriyaku-tags",
            action="store_true",
            help=(
                "explicit goriyaku_tagsのM2M同期だけを遅延し、Base Shrineを先にimportする。"
                "値の構造検証は行う。fresh bootstrapの第1pass専用。"
            ),
        )

    def handle(self, *args, **options):
        source = Path(options["source"])
        dry_run = bool(options["dry_run"])
        skip_goriyaku_tags = bool(options["skip_goriyaku_tags"])

        if not source.exists():
            raise CommandError(f"source file not found: {source}")

        data = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise CommandError("seed json must be a list")

        # Even in Base-only mode, malformed explicit lists are blocked now rather
        # than carried into the later activation pass. Only canonical master
        # resolution and M2M writes are deferred.
        explicit_tags = _parse_explicit_goriyaku_tags(data)
        if skip_goriyaku_tags:
            requested_names: set[str] = set()
            canonical_tags: dict[str, GoriyakuTag] = {}
        else:
            requested_names = {
                name for names in explicit_tags.values() for name in names
            }
            canonical_tags = _canonical_goriyaku_tag_map(requested_names)

        created = 0
        updated = 0
        skipped = 0
        goriyaku_tag_rows = 0
        goriyaku_tag_updated = 0
        goriyaku_tag_added_links = 0
        goriyaku_tag_removed_links = 0

        use_gis = os.getenv("USE_GIS", "1") == "1"

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE: DBは更新されません"))
        if skip_goriyaku_tags and explicit_tags:
            self.stdout.write(
                self.style.WARNING(
                    f"GORIYAKU_TAGS DEFERRED rows={len(explicit_tags)} base_only_pass"
                )
            )

        with transaction.atomic():
            for index, row in enumerate(data):
                name = str(row.get("name_jp") or "").strip()
                address = str(row.get("address") or "").strip()

                if not name or not address:
                    skipped += 1
                    self.stdout.write(f"SKIP invalid row name={name!r} address={address!r}")
                    continue

                requested_tag_names = (
                    None if skip_goriyaku_tags else explicit_tags.get(index)
                )
                if requested_tag_names is not None:
                    goriyaku_tag_rows += 1

                lat = row.get("latitude")
                lng = row.get("longitude")

                payload = {
                    "address": address,
                    "latitude": lat,
                    "longitude": lng,
                    "goriyaku": row.get("goriyaku") or "",
                    "kyusei": row.get("kyusei"),
                    "astro_elements": row.get("astro_elements") or [],
                    "visit_style_tags": row.get("visit_style_tags") or [],
                    "name_romaji": row.get("name_romaji"),
                    "sajin": row.get("sajin") or "",
                    "description": row.get("description"),
                    "element": row.get("element"),
                }

                if use_gis and lat is not None and lng is not None:
                    from django.contrib.gis.geos import Point

                    payload["location"] = Point(float(lng), float(lat), srid=4326)

                obj = (
                    Shrine.objects.filter(name_jp=name, address=address)
                    .order_by("id")
                    .first()
                )

                if obj is None:
                    if not dry_run:
                        obj = Shrine.objects.create(
                            name_jp=name,
                            **payload,
                        )
                    created += 1
                    self.stdout.write(f"CREATE {name}")

                    if requested_tag_names is not None:
                        added = list(requested_tag_names)
                        removed: list[str] = []
                        if added:
                            goriyaku_tag_updated += 1
                            goriyaku_tag_added_links += len(added)
                            self.stdout.write(
                                f"GORIYAKU_TAGS SET {name} add={added} remove={removed}"
                            )
                        else:
                            self.stdout.write(
                                f"GORIYAKU_TAGS SKIP {name} already_exact"
                            )

                        if not dry_run:
                            assert obj is not None
                            obj.goriyaku_tags.set(
                                [canonical_tags[tag_name] for tag_name in requested_tag_names]
                            )
                    continue

                current_tag_names: set[str] | None = None
                added: list[str] = []
                removed: list[str] = []
                if requested_tag_names is not None:
                    current_tag_names = set(
                        obj.goriyaku_tags.values_list("name", flat=True)
                    )
                    requested_tag_set = set(requested_tag_names)
                    added = [
                        tag_name
                        for tag_name in requested_tag_names
                        if tag_name not in current_tag_names
                    ]
                    removed = sorted(current_tag_names - requested_tag_set)

                changed_fields = []
                for field, value in payload.items():
                    current = getattr(obj, field)

                    if field == "location":
                        current_cmp = str(current) if current is not None else None
                        value_cmp = str(value) if value is not None else None
                        if current_cmp != value_cmp:
                            setattr(obj, field, value)
                            changed_fields.append(field)
                    else:
                        if current != value:
                            setattr(obj, field, value)
                            changed_fields.append(field)

                if changed_fields:
                    if not dry_run:
                        obj.save(update_fields=changed_fields)
                    updated += 1
                    self.stdout.write(f"UPDATE id={obj.id} {obj.name_jp} fields={changed_fields}")
                else:
                    skipped += 1
                    self.stdout.write(f"SKIP id={obj.id} {obj.name_jp}")

                if requested_tag_names is not None:
                    if added or removed:
                        goriyaku_tag_updated += 1
                        goriyaku_tag_added_links += len(added)
                        goriyaku_tag_removed_links += len(removed)
                        self.stdout.write(
                            f"GORIYAKU_TAGS SET id={obj.id} {obj.name_jp} "
                            f"add={added} remove={removed}"
                        )
                    else:
                        self.stdout.write(
                            f"GORIYAKU_TAGS SKIP id={obj.id} {obj.name_jp} already_exact"
                        )

                    if not dry_run:
                        obj.goriyaku_tags.set(
                            [canonical_tags[tag_name] for tag_name in requested_tag_names]
                        )

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"goriyaku_tags rows={goriyaku_tag_rows} updated={goriyaku_tag_updated} "
                f"added_links={goriyaku_tag_added_links} removed_links={goriyaku_tag_removed_links}"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"done created={created} updated={updated} skipped={skipped} total_seed={len(data)}"
            )
        )
