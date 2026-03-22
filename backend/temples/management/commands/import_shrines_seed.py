import json
import os
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from temples.models import Shrine


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

    def handle(self, *args, **options):
        source = Path(options["source"])
        dry_run = bool(options["dry_run"])

        if not source.exists():
            raise CommandError(f"source file not found: {source}")

        data = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise CommandError("seed json must be a list")

        created = 0
        updated = 0
        skipped = 0

        use_gis = os.getenv("USE_GIS", "1") == "1"

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE: DBは更新されません"))

        with transaction.atomic():
            for row in data:
                name = str(row.get("name_jp") or "").strip()
                address = str(row.get("address") or "").strip()

                if not name or not address:
                    skipped += 1
                    self.stdout.write(f"SKIP invalid row name={name!r} address={address!r}")
                    continue

                lat = row.get("latitude")
                lng = row.get("longitude")

                payload = {
                    "address": address,
                    "latitude": lat,
                    "longitude": lng,
                    "goriyaku": row.get("goriyaku") or "",
                    "kyusei": row.get("kyusei"),
                    "astro_elements": row.get("astro_elements") or [],
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
                        Shrine.objects.create(
                            name_jp=name,
                            **payload,
                        )
                    created += 1
                    self.stdout.write(f"CREATE {name}")
                    continue

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

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"done created={created} updated={updated} skipped={skipped} total_seed={len(data)}"
            )
        )
