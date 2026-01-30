# backend/temples/management/commands/backfill_goriyaku_tags.py
from __future__ import annotations

import re
from typing import Iterable

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count
from temples.models import GoriyakuTag, Shrine


_SPLIT_RE = re.compile(r"[、,／/・\|\n\r\t]+")  # "縁結び・厄除け・交通安全" 対応


def parse_goriyaku(text: str) -> list[str]:
    raw = (text or "").strip()
    if not raw:
        return []
    parts = [p.strip() for p in _SPLIT_RE.split(raw)]
    # 空と重複を落とす（順序は維持）
    seen: set[str] = set()
    out: list[str] = []
    for p in parts:
        if not p:
            continue
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
    return out


class Command(BaseCommand):
    help = "Split Shrine.goriyaku and backfill Shrine.goriyaku_tags (M2M)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Don't write changes.")
        parser.add_argument("--force", action="store_true", help="Also process shrines that already have goriyaku_tags.")
        parser.add_argument("--limit", type=int, default=0, help="Limit number of shrines processed (0 = no limit).")

    @transaction.atomic
    def handle(self, *args, **opts):
        dry_run: bool = bool(opts["dry_run"])
        force: bool = bool(opts["force"])
        limit: int = int(opts["limit"] or 0)

        qs = (
            Shrine.objects.exclude(goriyaku__isnull=True)
            .exclude(goriyaku__exact="")
            .order_by("id")
            .prefetch_related("goriyaku_tags")
        )
        if not force:
            qs = qs.annotate(gcnt=Count("goriyaku_tags"))
            if not force:
                qs = qs.filter(gcnt=0)
        if limit > 0:
            qs = qs[:limit]

        total = 0
        updated = 0
        created_tags = 0
        added_links = 0

        for s in qs:
            total += 1
            names = parse_goriyaku(s.goriyaku or "")
            if not names:
                continue

            # force=false の時は基本 empty 対象だが、念のため差分だけ add する
            existing = {t.name for t in s.goriyaku_tags.all()}

            to_add: list[GoriyakuTag] = []
            for name in names:
                if name in existing:
                    continue
                tag, created = GoriyakuTag.objects.get_or_create(name=name)
                if created:
                    created_tags += 1
                to_add.append(tag)

            if not to_add:
                continue

            updated += 1
            added_links += len(to_add)

            if not dry_run:
                s.goriyaku_tags.add(*to_add)

        self.stdout.write(
            f"[backfill_goriyaku_tags] dry_run={dry_run} force={force} "
            f"total={total} updated={updated} created_tags={created_tags} added_links={added_links}"
        )

        if dry_run:
            # transaction.atomic なので dry-run でも念のため rollback したいなら例外で落とす手もあるが、
            # 今回は write を避けてるので不要。
            pass
