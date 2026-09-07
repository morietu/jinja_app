from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Sequence

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.models import Count, F
from django.utils import timezone
from temples.models import PlaceCache, PlacesSeed, ProductionDataBootstrapRun, Shrine


@dataclass(frozen=True)
class BootstrapStep:
    step: str
    version: str
    command: str
    args: tuple[str, ...] = ()


BOOTSTRAP_STEPS: tuple[BootstrapStep, ...] = (
    BootstrapStep(
        step="import_shrines_seed",
        version="2026-05-10-v1",
        command="import_shrines_seed",
    ),
    BootstrapStep(
        step="backfill_goriyaku_tags",
        # Historical Production marker. Keep this version stable so existing SUCCESS rows remain SKIP.
        # visit_style_tags is canonical in Base Seed; --with-visit-style is repair-only.
        version="2026-05-10-with-visit-style-force-v1",
        command="backfill_goriyaku_tags",
        args=("--force",),
    ),
)


class Command(BaseCommand):
    help = "Run one-time production data bootstrap steps that have not succeeded yet."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-debug-counts",
            action="store_true",
            help="Do not print concierge candidate summary counts after bootstrap.",
        )

    def handle(self, *args, **options):
        self.stdout.write("[bootstrap_production_data] start")

        for step in BOOTSTRAP_STEPS:
            self._run_step_once(step)

        if not options["skip_debug_counts"]:
            self._write_concierge_candidate_counts()

        self.stdout.write(self.style.SUCCESS("[bootstrap_production_data] done"))

    def _run_step_once(self, step: BootstrapStep) -> None:
        claim_status, run = self._claim_step(step)
        if claim_status == "success":
            self.stdout.write(
                f"[bootstrap_production_data] SKIP step={step.step} version={step.version} already_success"
            )
            return
        if claim_status == "running":
            self.stdout.write(
                f"[bootstrap_production_data] SKIP step={step.step} version={step.version} "
                f"already_running started_at={run.started_at}"
            )
            return

        self.stdout.write(
            f"[bootstrap_production_data] START step={step.step} version={step.version} "
            f"attempt={run.attempts} command={step.command} args={list(step.args)}"
        )

        try:
            call_command(step.command, *step.args)
        except Exception as exc:
            finished_at = timezone.now()
            ProductionDataBootstrapRun.objects.filter(pk=run.pk).update(
                status=ProductionDataBootstrapRun.Status.FAILED,
                last_error=str(exc),
                finished_at=finished_at,
            )
            self.stderr.write(
                self.style.ERROR(
                    f"[bootstrap_production_data] FAILED step={step.step} version={step.version} "
                    f"attempt={run.attempts} error={exc}"
                )
            )
            raise

        finished_at = timezone.now()
        ProductionDataBootstrapRun.objects.filter(pk=run.pk).update(
            status=ProductionDataBootstrapRun.Status.SUCCESS,
            last_error="",
            finished_at=finished_at,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"[bootstrap_production_data] SUCCESS step={step.step} version={step.version} "
                f"attempt={run.attempts}"
            )
        )

    def _claim_step(self, step: BootstrapStep) -> tuple[str, ProductionDataBootstrapRun]:
        with transaction.atomic():
            run, _created = ProductionDataBootstrapRun.objects.select_for_update().get_or_create(
                step=step.step,
                version=step.version,
                defaults={
                    "command": step.command,
                    "args": list(step.args),
                    "status": ProductionDataBootstrapRun.Status.RUNNING,
                    "attempts": 0,
                },
            )
            if run.status == ProductionDataBootstrapRun.Status.SUCCESS:
                return "success", run

            now = timezone.now()
            running_started_at = run.started_at
            running_is_recent = (
                run.status == ProductionDataBootstrapRun.Status.RUNNING
                and running_started_at is not None
                and running_started_at > now - timedelta(minutes=30)
            )
            if running_is_recent:
                return "running", run

            run.command = step.command
            run.args = list(step.args)
            run.status = ProductionDataBootstrapRun.Status.RUNNING
            run.started_at = now
            run.finished_at = None
            run.last_error = ""
            run.attempts = F("attempts") + 1
            run.save(
                update_fields=[
                    "command",
                    "args",
                    "status",
                    "started_at",
                    "finished_at",
                    "last_error",
                    "attempts",
                    "updated_at",
                ]
            )
            run.refresh_from_db(fields=["attempts"])
            return "claimed", run

    def _safe_count(self, model) -> int | str:
        table_name = model._meta.db_table
        if table_name not in connection.introspection.table_names():
            return "missing_table"
        return model.objects.count()

    def _write_concierge_candidate_counts(self) -> None:
        shrine_qs = Shrine.objects.all()
        shrine_kind_counts: Sequence[dict[str, int | str | None]] = list(
            shrine_qs.values("kind").annotate(total=Count("id")).order_by("kind")
        )
        shrine_with_location = shrine_qs.filter(
            latitude__isnull=False,
            longitude__isnull=False,
        ).count()
        shrine_with_visit_style_tags = shrine_qs.exclude(visit_style_tags=[]).count()
        shrine_with_goriyaku_tags = shrine_qs.filter(goriyaku_tags__isnull=False).distinct().count()

        self.stdout.write("[bootstrap_production_data] concierge_candidate_counts start")
        self.stdout.write(f"[bootstrap_production_data] Shrine total: {shrine_qs.count()}")
        for row in shrine_kind_counts:
            self.stdout.write(
                f"[bootstrap_production_data] Shrine kind={row['kind'] or '(blank)'} total={row['total']}"
            )
        self.stdout.write(
            f"[bootstrap_production_data] Shrine with latitude/longitude: {shrine_with_location}"
        )
        self.stdout.write(
            f"[bootstrap_production_data] Shrine with visit_style_tags: {shrine_with_visit_style_tags}"
        )
        self.stdout.write(
            f"[bootstrap_production_data] Shrine with goriyaku_tags: {shrine_with_goriyaku_tags}"
        )
        self.stdout.write(f"[bootstrap_production_data] PlaceCache total: {self._safe_count(PlaceCache)}")
        self.stdout.write(f"[bootstrap_production_data] PlacesSeed total: {self._safe_count(PlacesSeed)}")
        self.stdout.write("[bootstrap_production_data] concierge_candidate_counts done")
