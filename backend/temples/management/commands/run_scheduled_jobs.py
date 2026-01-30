# backend/temples/management/commands/run_scheduled_jobs.py
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.utils import timezone

LOCK_KEY = "lock:scheduled_jobs"
LOCK_TTL = 60 * 10  # 10分

class Command(BaseCommand):
    help = "Run scheduled jobs (fetch candidates, import approved, etc.)"

    def add_arguments(self, parser):
        parser.add_argument("--only", choices=["fetch", "import", "all"], default="all")
        parser.add_argument("--once", action="store_true")

    def handle(self, *args, **opts):
        # --- ロック（多重起動対策）---
        if not cache.add(LOCK_KEY, timezone.now().isoformat(), LOCK_TTL):
            self.stdout.write(self.style.WARNING("another scheduler is running, skip"))
            return

        try:
            only = opts["only"]

            if only in ("fetch", "all"):
                from django.core.management import call_command
                call_command("fetch_shrine_candidates")

            if only in ("import", "all"):
                from django.core.management import call_command
                call_command("import_approved_candidates")

        finally:
            cache.delete(LOCK_KEY)
