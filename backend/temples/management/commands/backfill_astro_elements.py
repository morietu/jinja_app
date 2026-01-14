# backend/temples/management/commands/backfill_astro_elements.py
from __future__ import annotations

import random
from typing import Iterable, List

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from temples.models import Shrine

# 4元素（文字列は domain.astrology 側の想定に合わせて "fire/water/earth/air"）
ELEMENTS = ["fire", "water", "earth", "air"]


def _pick_element_by_popularity(popular_score: float) -> str:
    """
    popular_score に応じて元素を偏らせる（ざっくりでOK）
    - 高い: fire/air を少し多め
    - 中: 均等に近い
    - 低い: earth/water を少し多め
    """
    p = float(popular_score or 0.0)

    # weights は相対値。合計は何でも良い。
    if p >= 7.0:
        weights = {"fire": 4, "air": 3, "earth": 2, "water": 2}
    elif p >= 4.0:
        weights = {"fire": 3, "air": 3, "earth": 3, "water": 3}
    else:
        weights = {"fire": 2, "air": 2, "earth": 4, "water": 3}

    bag: List[str] = []
    for e, w in weights.items():
        bag.extend([e] * int(w))
    return random.choice(bag) if bag else random.choice(ELEMENTS)


class Command(BaseCommand):
    help = "Backfill Shrine.astro_elements for existing rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would change, but do not write to DB.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing astro_elements even if non-empty.",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            help="Random seed for reproducible results (default: 42).",
        )
        parser.add_argument(
            "--mode",
            choices=["popular", "rotate"],
            default="popular",
            help="How to assign elements: 'popular' (weighted by popular_score) or 'rotate' (round-robin).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Limit number of rows to process (0 = no limit).",
        )

    def handle(self, *args, **opts):
        dry_run: bool = opts["dry_run"]
        force: bool = opts["force"]
        seed: int = int(opts["seed"])
        mode: str = str(opts["mode"])
        limit: int = int(opts["limit"])

        random.seed(seed)

        qs = Shrine.objects.all().only("id", "name_jp", "popular_score", "astro_elements").order_by("id")

        if not force:
            # 空だけ対象（NULL と [] 両方を見る）
            qs = qs.filter(Q(astro_elements__isnull=True) | Q(astro_elements=[]))

        if limit and limit > 0:
            qs = qs[:limit]

        targets = list(qs)
        if not targets:
            self.stdout.write(self.style.SUCCESS("No rows to update."))
            return

        # rotate 用
        it = iter(ELEMENTS)

        planned = []
        for s in targets:
            if mode == "rotate":
                try:
                    e = next(it)
                except StopIteration:
                    it = iter(ELEMENTS)
                    e = next(it)
            else:
                e = _pick_element_by_popularity(getattr(s, "popular_score", 0.0))

            new_val = [e]
            old_val = getattr(s, "astro_elements", None) or []
            planned.append((s, old_val, new_val))

        # dry-run 出力
        self.stdout.write(f"mode={mode} force={force} dry_run={dry_run} seed={seed} count={len(planned)}")
        for s, old_val, new_val in planned:
            self.stdout.write(f"- id={s.id} name={s.name_jp!r} popular={getattr(s,'popular_score',0)} {old_val} -> {new_val}")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run: no changes written."))
            return

        # 書き込み
        with transaction.atomic():
            for s, _old_val, new_val in planned:
                s.astro_elements = new_val
                s.save(update_fields=["astro_elements"])

        self.stdout.write(self.style.SUCCESS(f"Updated {len(planned)} rows."))
