# backend/temples/management/commands/generate_tiles.py
from __future__ import annotations

import math
from dataclasses import dataclass
from itertools import islice
from typing import Iterable, Iterator

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from temples.models import CrawlTile


def _km_to_deg_lat(km: float) -> float:
    # 緯度1度あたり約110.574km
    return km / 110.574


def _km_to_deg_lng(km: float, lat_deg: float) -> float:
    # 経度1度あたり約111.320km * cos(lat)
    c = math.cos(math.radians(lat_deg))
    if c <= 1e-9:
        # 極付近は雑に逃がす
        return km / 111.320
    return km / (111.320 * c)


@dataclass(frozen=True)
class BBox:
    min_lat: float
    min_lng: float
    max_lat: float
    max_lng: float


def _parse_bbox(s: str) -> BBox:
    try:
        parts = [float(x.strip()) for x in s.split(",")]
        if len(parts) != 4:
            raise ValueError
        return BBox(parts[0], parts[1], parts[2], parts[3])
    except Exception:
        raise CommandError("bbox must be 'min_lat,min_lng,max_lat,max_lng'")  # noqa: B904


def _iter_tiles(b: BBox, step_km: float) -> Iterable[CrawlTile]:
    # bboxの中心緯度を代表値として経度ステップを計算
    mid_lat = (b.min_lat + b.max_lat) / 2.0
    step_lat = _km_to_deg_lat(step_km)
    step_lng = _km_to_deg_lng(step_km, mid_lat)

    if step_lat <= 0 or step_lng <= 0:
        raise CommandError("step_km must be > 0")

    lat = b.min_lat
    while lat < b.max_lat:
        next_lat = min(lat + step_lat, b.max_lat)

        lng = b.min_lng
        while lng < b.max_lng:
            next_lng = min(lng + step_lng, b.max_lng)

            center_lat = (lat + next_lat) / 2.0
            center_lng = (lng + next_lng) / 2.0

            yield CrawlTile(
                step_km=step_km,
                min_lat=lat,
                min_lng=lng,
                max_lat=next_lat,
                max_lng=next_lng,
                center_lat=center_lat,
                center_lng=center_lng,
            )

            lng = next_lng
        lat = next_lat


def _chunked(iterable: Iterable[CrawlTile], size: int) -> Iterator[list[CrawlTile]]:
    it = iter(iterable)
    while True:
        chunk = list(islice(it, size))
        if not chunk:
            break
        yield chunk


class Command(BaseCommand):
    help = "Generate CrawlTile rows from bbox + step_km"

    def add_arguments(self, parser):
        parser.add_argument("--step-km", type=float, required=True, help="Tile step in kilometers")
        parser.add_argument("--bbox", type=str, default="", help="min_lat,min_lng,max_lat,max_lng")
        parser.add_argument("--min-lat", type=float, default=None)
        parser.add_argument("--min-lng", type=float, default=None)
        parser.add_argument("--max-lat", type=float, default=None)
        parser.add_argument("--max-lng", type=float, default=None)

        parser.add_argument("--dry-run", action="store_true", help="Do not write to DB, only print counts")
        parser.add_argument("--batch-size", type=int, default=2000, help="bulk_create batch size")

    @transaction.atomic
    def handle(self, *args, **opts):
        step_km = float(opts["step_km"])
        batch_size = int(opts.get("batch_size") or 2000)
        dry_run = bool(opts.get("dry_run"))

        # --- bbox 決定 ---
        if opts.get("bbox"):
            b = _parse_bbox(opts["bbox"])
        else:
            if (
                opts.get("min_lat") is None
                or opts.get("min_lng") is None
                or opts.get("max_lat") is None
                or opts.get("max_lng") is None
            ):
                raise CommandError("Provide --bbox or all of --min-lat --min-lng --max-lat --max-lng")

            b = BBox(
                float(opts["min_lat"]),
                float(opts["min_lng"]),
                float(opts["max_lat"]),
                float(opts["max_lng"]),
            )

        if not (b.min_lat < b.max_lat and b.min_lng < b.max_lng):
            raise CommandError("bbox must satisfy min < max")

        # --- dry-run: 件数だけ数える ---
        if dry_run:
            total = sum(1 for _ in _iter_tiles(b, step_km))
            self.stdout.write(
                self.style.SUCCESS(
                    f"generated={total} (dry-run) step_km={step_km} bbox=({b.min_lat},{b.min_lng})-({b.max_lat},{b.max_lng})"
                )
            )
            return

        before = CrawlTile.objects.count()

        total = 0
        for chunk in _chunked(_iter_tiles(b, step_km), batch_size):
            total += len(chunk)
            CrawlTile.objects.bulk_create(chunk, ignore_conflicts=True, batch_size=batch_size)

        after = CrawlTile.objects.count()
        inserted = after - before

        self.stdout.write(
            self.style.SUCCESS(
                f"generated={total} inserted={inserted} step_km={step_km} bbox=({b.min_lat},{b.min_lng})-({b.max_lat},{b.max_lng})"
            )
        )
