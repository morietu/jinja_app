# backend/temples/management/commands/backfill_astro_elements.py
from __future__ import annotations

import random
from typing import Iterable, List, Optional

from django.core.management.base import BaseCommand
from django.db import transaction

from temples.models import Shrine

JA_ELEMENTS = ["火", "土", "風", "水"]

# 英語/日本語混在しても必ず日本語に寄せる
TO_JA = {
    "fire": "火",
    "water": "水",
    "earth": "土",
    "air": "風",
    "火": "火",
    "水": "水",
    "土": "土",
    "風": "風",
    # 旧表記/揺れ
    "地": "土",
}


def normalize_elements_to_ja(elems: Iterable[object] | None) -> List[str]:
    if not elems:
        return []
    out: List[str] = []
    for e in elems:
        k = str(e).strip()
        if not k:
            continue
        out.append(TO_JA.get(k, k))

    # 重複除去（順序維持）
    seen = set()
    dedup: List[str] = []
    for e in out:
        if e in seen:
            continue
        seen.add(e)
        dedup.append(e)

    # 許可値以外は落とす（DBを固める）
    return [e for e in dedup if e in JA_ELEMENTS]


def is_valid_ja_elems(elems: Optional[Iterable[object]]) -> bool:
    """
    DBの生値が「火土風水（1要素）」として正しいかだけを見る。
    normalize して正しく見える（fire→火 など）は valid 扱いにしない。
    """
    if not elems:
        return False
    raw = [str(x).strip() for x in elems if str(x).strip()]
    return len(raw) == 1 and raw[0] in JA_ELEMENTS


def pick_element_rotate(index: int) -> str:
    return JA_ELEMENTS[index % len(JA_ELEMENTS)]


def pick_element_popular(rng: random.Random, popular: float) -> str:
    p = float(popular or 0.0)
    if p >= 7:
        weights = [3, 2, 2, 1]  # 火/土/風/水
    elif p >= 4:
        weights = [2, 2, 2, 2]
    else:
        weights = [1, 1, 2, 3]  # 静けさ寄り = 水/風寄り
    return rng.choices(JA_ELEMENTS, weights=weights, k=1)[0]


class Command(BaseCommand):
    help = "Backfill Shrine.astro_elements with Japanese 4 elements (火土風水)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Print changes without writing to DB.")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Repair-only: normalize invalid values; DO NOT reshuffle already-valid 火土風水 rows.",
        )
        parser.add_argument(
            "--mode",
            choices=["popular", "rotate"],
            default="popular",
            help="Assignment strategy (still outputs JA elements only).",
        )
        parser.add_argument("--seed", type=int, default=42, help="Random seed for deterministic assignment.")

    @transaction.atomic
    def handle(self, *args, **opts):
        dry_run: bool = bool(opts["dry_run"])
        force: bool = bool(opts["force"])
        mode: str = str(opts["mode"])
        seed: int = int(opts["seed"])

        rng = random.Random(seed)

        rows = list(Shrine.objects.all().order_by("id"))
        self.stdout.write(f"mode={mode} force={force} dry_run={dry_run} seed={seed} count={len(rows)}")

        updated = 0

        for i, s in enumerate(rows):
            raw_before = list(s.astro_elements or [])
            before_norm = normalize_elements_to_ja(raw_before)

            # すでに正規（火土風水 1要素）なら触らない（forceでも同じ：修復専用）
            if is_valid_ja_elems(raw_before):
                continue

            # force でも force無しでも：
            #  - 英語/地/混在 → before_norm が取れれば修復
            #  - 空/未知 → pick で付与
            if before_norm:
                after = before_norm[:1]
            else:
                popular = float(getattr(s, "popular_score", 0.0) or 0.0)
                chosen = pick_element_rotate(i) if mode == "rotate" else pick_element_popular(rng, popular)
                after = [chosen]

            after = normalize_elements_to_ja(after)

            # raw が fire でも after は 火 なので保存される（ここが重要）
            if raw_before == after:
                continue

            name = getattr(s, "name_jp", "") or ""
            pop = float(getattr(s, "popular_score", 0.0) or 0.0)
            self.stdout.write(f"- id={s.id} name={name!r} popular={pop} {raw_before} -> {after}")

            updated += 1
            if not dry_run:
                s.astro_elements = after
                s.save(update_fields=["astro_elements"])

        if dry_run:
            self.stdout.write("Dry-run: no changes written.")
        else:
            self.stdout.write(f"Updated {updated} rows.")
