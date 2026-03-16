# backend/temples/management/commands/create_initial_shrine.py
from django.core.management.base import BaseCommand
from temples.models import Shrine


class Command(BaseCommand):
    help = "Create initial test shrine if not exists"

    def handle(self, *args, **options):
        shrine, created = Shrine.objects.get_or_create(
            id=1,
            defaults={
                "kind": "shrine",
                "name_jp": "テスト神社",
                "name_romaji": "Test Shrine",
                "address": "東京都千代田区1-1-1",
                "latitude": 35.681236,
                "longitude": 139.767125,
                "goriyaku": "開運・厄除け",
                "sajin": "天照大御神",
                "description": "本番疎通確認用の初期神社データです。",
                "element": "火",
                "kyusei": "九紫火星",
                "astro_elements": ["火"],
            },
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Created shrine: {shrine}"))
        else:
            self.stdout.write(self.style.WARNING("Shrine(id=1) already exists"))
