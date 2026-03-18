import json
import os
from pathlib import Path

from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point

from temples.models import Shrine


class Command(BaseCommand):
    help = "Import shrine seed data"

    def handle(self, *args, **options):
        p = Path("temples/data/shrines_seed_clean.json")
        data = json.loads(p.read_text(encoding="utf-8"))

        created = 0
        updated = 0
        skipped = 0

        use_gis = os.getenv("USE_GIS", "1") == "1"

        for row in data:
            name = row["name_jp"].strip()
            address = row["address"].strip()

            lat = row.get("latitude")
            lng = row.get("longitude")

            payload = {
                "address": address,
                "latitude": lat,
                "longitude": lng,
                "goriyaku": row.get("goriyaku") or "",
                "kyusei": row.get("kyusei"),
                "astro_elements": row.get("astro_elements") or [],
            }

            if use_gis and lat is not None and lng is not None:
                payload["location"] = Point(float(lng), float(lat))

            qs = Shrine.objects.filter(
                name_jp=name,
                address=address,
            ).order_by("id")

            obj = qs.first()

            if obj is None:
                Shrine.objects.create(
                    name_jp=name,
                    **payload,
                )
                created += 1
                self.stdout.write(f"CREATE {name}")
                continue

            changed_fields = {}
            for field, value in payload.items():
                current = getattr(obj, field)

                if field == "location":
                    current_cmp = str(current) if current is not None else None
                    value_cmp = str(value) if value is not None else None
                    if current_cmp != value_cmp:
                        changed_fields[field] = value
                else:
                    if current != value:
                        changed_fields[field] = value

            if changed_fields:
                Shrine.objects.filter(pk=obj.pk).update(**changed_fields)
                updated += 1
                self.stdout.write(f"UPDATE id={obj.id} {obj.name_jp}")
            else:
                skipped += 1
                self.stdout.write(f"SKIP id={obj.id} {obj.name_jp}")

        self.stdout.write(
            self.style.SUCCESS(
                f"done created={created} updated={updated} skipped={skipped} total_seed={len(data)}"
            )
        )
