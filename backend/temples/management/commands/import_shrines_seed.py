
import json
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

        for row in data:
            qs = Shrine.objects.filter(
                name_jp=row["name_jp"],
                address=row["address"],
            ).order_by("id")

            obj = qs.first()

            lat = row.get("latitude")
            lng = row.get("longitude")

            location_value = None
            if lat is not None and lng is not None:
                location_value = Point(lng, lat)

            payload = {
                "address": row["address"],
                "latitude": lat,
                "longitude": lng,
                "goriyaku": row.get("goriyaku") or "",
                "kyusei": row.get("kyusei"),
                "astro_elements": row.get("astro_elements") or [],
                "location": location_value,
            }

            if obj is None:
                Shrine.objects.create(
                    name_jp=row["name_jp"],
                    **payload,
                )
                created += 1
                self.stdout.write(f"CREATE {row['name_jp']}")
            else:
                changed = False
                for field, value in payload.items():
                    current = getattr(obj, field)

                    # Point 同士の比較は文字列化で雑に吸収
                    if field == "location":
                        current_cmp = str(current) if current is not None else None
                        value_cmp = str(value) if value is not None else None
                        if current_cmp != value_cmp:
                            setattr(obj, field, value)
                            changed = True
                    else:
                        if current != value:
                            setattr(obj, field, value)
                            changed = True

                if changed:
                    obj.save()
                    updated += 1
                    self.stdout.write(f"UPDATE id={obj.id} {obj.name_jp}")
                else:
                    self.stdout.write(f"SKIP id={obj.id} {obj.name_jp}")

        self.stdout.write(
            self.style.SUCCESS(
                f"done created={created} updated={updated} total_seed={len(data)}"
            )
        )
