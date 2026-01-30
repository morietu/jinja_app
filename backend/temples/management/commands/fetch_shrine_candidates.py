from django.core.management.base import BaseCommand
from django.utils import timezone
from temples.models import ShrineCandidate

class Command(BaseCommand):
    help = "Fetch shrine candidates (stub)"

    def handle(self, *args, **opts):
        now = timezone.now()

        place_id = "stub-place-id"
        payload = {
            "name_jp": "テスト候補神社",
            "address": "テスト住所",
            "lat": 35.0,
            "lng": 135.0,
            "source": "stub",
            "synced_at": now,  # ✅ ここ重要
            "raw": {
                "provider": "stub",
                "fetched_at": now.isoformat(),
                "snapshot": {"note": "replace with places later"},
            },
        }

        obj, created = ShrineCandidate.objects.update_or_create(
            place_id=place_id,
            defaults=payload,
        )

        self.stdout.write(self.style.SUCCESS(
            f"[fetch_shrine_candidates] created={created} id={obj.id} synced_at={obj.synced_at}"
        ))
