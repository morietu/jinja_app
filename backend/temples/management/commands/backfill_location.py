# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand
from django.db import transaction
from temples.models import Shrine

class Command(BaseCommand):
    help = "lat/lng から location(JSON/Point) を再生成して保存"

    def add_arguments(self, parser):
        parser.add_argument("--batch", type=int, default=500)

    def handle(self, *args, **opts):
        batch = opts["batch"]
        updated = 0
        qs = Shrine.objects.only("id", "latitude", "longitude", "location")
        with transaction.atomic():
            for s in qs.iterator(chunk_size=batch):
                # save() 内で location を再計算してくれる
                s.save(update_fields={"latitude", "longitude", "location"})
                updated += 1
        self.stdout.write(self.style.SUCCESS(f"updated: {updated}"))
