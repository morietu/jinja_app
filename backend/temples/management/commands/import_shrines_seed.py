import json
from pathlib import Path

from django.core.management.base import BaseCommand
from temples.models import Shrine


class Command(BaseCommand):
    help = "Import shrine seed data"

    def handle(self, *args, **options):
        p = Path("temples/data/shrines_seed_clean.json")
        data = json.loads(p.read_text(encoding="utf-8"))

        created = 0
        updated = 0

        for row in data:
            lat = row.get("latitude")
            lng = row.get("longitude")

            raw_location = row.get("location")
            location_value = None

            if isinstance(raw_location, dict):
                location_value = raw_location
            elif lat is not None and lng is not None:
                location_value = {"lat": lat, "lng": lng}

            payload = {
                "address": row["address"],
                "latitude": lat,
                "longitude": lng,
                "goriyaku": row.get("goriyaku") or "",
                "kyusei": row.get("kyusei"),
                "astro_elements": row.get("astro_elements") or [],
                "location": location_value,
            }

            qs = Shrine.objects.filter(
                name_jp=row["name_jp"],
                address=row["address"],
            ).order_by("id")

            obj = qs.first()

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
