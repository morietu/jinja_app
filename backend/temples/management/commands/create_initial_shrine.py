# backend/temples/management/commands/create_initial_shrine.py
from django.core.management.base import BaseCommand
from temples.models import Shrine

class Command(BaseCommand):
    help = "Create initial test shrine if not exists"

    def handle(self, *args, **options):
        shrine, created = Shrine.objects.get_or_create(
            id=1,
            defaults={
                "name": "テスト神社",
                "prefecture": "東京都",  # 必須項目に合わせて埋める
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created shrine: {shrine}"))
        else:
            self.stdout.write(self.style.WARNING("Shrine(id=1) already exists"))
