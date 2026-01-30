from django.core.management.base import BaseCommand
from django.db import transaction

from temples.models import ShrineCandidate, Shrine, PlaceRef


class Command(BaseCommand):
    help = "Import approved ShrineCandidate into Shrine"

    @transaction.atomic
    def handle(self, *args, **opts):
        qs = ShrineCandidate.objects.filter(
            status=ShrineCandidate.Status.APPROVED
        ).order_by("id")

        created = 0
        skipped = 0

        for c in qs:
            place_id = (getattr(c, "place_id", "") or "").strip()

            # 1) PlaceRef を place_id で解決
            place_ref_obj = None
            if place_id:
                place_ref_obj, _ = PlaceRef.objects.get_or_create(
                    place_id=place_id,
                    defaults={
                        "name": c.name_jp,
                        "address": c.address,
                        "latitude": getattr(c, "lat", None) or getattr(c, "latitude", None),
                        "longitude": getattr(c, "lng", None) or getattr(c, "longitude", None),
                    },
                )

            # 2) 重複判定（place_id 優先）
            if place_ref_obj:
                if Shrine.objects.filter(place_ref=place_ref_obj).exists():
                    skipped += 1
                    c.status = ShrineCandidate.Status.IMPORTED
                    c.save(update_fields=["status"])
                    continue
            else:
                if Shrine.objects.filter(name_jp=c.name_jp, address=c.address).exists():
                    skipped += 1
                    c.status = ShrineCandidate.Status.IMPORTED
                    c.save(update_fields=["status"])
                    continue

            # 3) Shrine 作成
            data = {
                "name_jp": c.name_jp,
                "address": c.address,
                "latitude": getattr(c, "lat", None) or getattr(c, "latitude", None),
                "longitude": getattr(c, "lng", None) or getattr(c, "longitude", None),
                "goriyaku": getattr(c, "goriyaku", None),
                "place_ref": place_ref_obj,
            }
            data = {k: v for k, v in data.items() if v is not None}

            Shrine.objects.create(**data)
            created += 1

            # 4) approved を残さない
            c.status = ShrineCandidate.Status.IMPORTED
            c.save(update_fields=["status"])

        self.stdout.write(
            f"[import_approved_candidates] total={qs.count()} created={created} skipped={skipped}"
        )
