from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q, Sum

from temples.models import GoshuinImage


@dataclass
class SizeResult:
    size: Optional[int]
    source: str
    error: Optional[str] = None


def _get_size(img: GoshuinImage) -> SizeResult:
    """
    取得優先順位:
      1) FieldFile.size（ストレージ実装が対応していれば最も安全）
      2) FieldFile.path + os.path.getsize（ローカルFS限定）
    """
    f = getattr(img, "image", None)
    if not f:
        return SizeResult(size=None, source="none", error="no image field")

    last_err = None

    # 1) storage-aware
    try:
        s = getattr(f, "size", None)
        if isinstance(s, int) and s >= 0:
            return SizeResult(size=s, source="fieldfile.size")
        last_err = "fieldfile.size returned non-int"
    except Exception as e:
        last_err = f"fieldfile.size failed: {e}"

    # 2) local path
    try:
        p = getattr(f, "path", None)
        if p and os.path.exists(p):
            return SizeResult(size=os.path.getsize(p), source="os.path.getsize")
        return SizeResult(size=None, source="path", error=f"path missing or not exists: {p} ({last_err})")
    except Exception as e:
        return SizeResult(size=None, source="path", error=f"path/getsize failed: {e} ({last_err})")


class Command(BaseCommand):
    help = "Backfill GoshuinImage.size_bytes for rows where size_bytes=0 (or NULL)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually update DB. Without this flag, dry-run.")
        parser.add_argument("--limit", type=int, default=0, help="Limit number of rows to process (0 = no limit).")
        parser.add_argument("--ids", type=str, default="", help="Comma-separated GoshuinImage IDs to process.")
        parser.add_argument("--include-null", action="store_true", help="Also target rows where size_bytes IS NULL.")

    def handle(self, *args, **opts):
        apply = bool(opts["apply"])
        limit = int(opts["limit"] or 0)
        ids_raw = (opts["ids"] or "").strip()
        include_null = bool(opts["include_null"])

        qs = GoshuinImage.objects.all()

        if ids_raw:
            ids = [int(x) for x in ids_raw.split(",") if x.strip()]
            qs = qs.filter(id__in=ids)
        else:
            cond = Q(size_bytes=0)
            if include_null:
                cond = cond | Q(size_bytes__isnull=True)
            qs = qs.filter(cond)

        qs = qs.order_by("id")
        if limit > 0:
            qs = qs[:limit]

        total_candidates = qs.count()

        self.stdout.write(self.style.NOTICE(f"mode={'APPLY' if apply else 'DRY-RUN'}"))
        self.stdout.write(self.style.NOTICE(f"candidates={total_candidates} limit={limit or 'none'} ids={ids_raw or 'none'}"))

        updated = 0
        skipped = 0
        errors = 0
        planned_sum = 0

        def process_one(img: GoshuinImage):
            nonlocal updated, skipped, errors, planned_sum

            r = _get_size(img)

            if r.size is None:
                skipped += 1
                errors += 1
                self.stdout.write(self.style.WARNING(f"skip id={img.id} src={r.source} err={r.error}"))
                return

            if r.size == 0:
                skipped += 1
                errors += 1
                self.stdout.write(self.style.WARNING(f"skip id={img.id} size=0 src={r.source}"))
                return

            planned_sum += r.size

            if apply:
                img.size_bytes = r.size
                img.save(update_fields=["size_bytes"])
                updated += 1
                self.stdout.write(self.style.SUCCESS(f"update id={img.id} size={r.size} src={r.source}"))
            else:
                self.stdout.write(f"plan   id={img.id} size={r.size} src={r.source}")

        if apply:
            with transaction.atomic():
                for img in qs:
                    process_one(img)
        else:
            for img in qs:
                process_one(img)

        self.stdout.write(self.style.SUCCESS(f"updated={updated} skipped={skipped} errors={errors} planned_sum={planned_sum}"))
        agg = GoshuinImage.objects.aggregate(s=Sum("size_bytes"))
        self.stdout.write(self.style.NOTICE(f"db_sum_size_bytes={int(agg['s'] or 0)}"))
