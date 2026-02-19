# backend/temples/management/commands/crawl_tiles.py
from __future__ import annotations

import time
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from temples.models import CrawlTile, PlaceCache
from temples.services import places as places_service


def _upsert_place_cache(row: dict[str, Any]) -> None:
    """
    places_service.places_nearby_search の正規化結果を想定。
    row に place_id/name/address/lat/lng/types/rating/user_ratings_total/raw がある前提で吸収する。
    """
    pid = row.get("place_id")
    if not pid:
        return

    defaults = {
        "name": row.get("name") or "",
        "address": row.get("address") or row.get("formatted_address") or row.get("vicinity") or "",
        "lat": row.get("lat"),
        "lng": row.get("lng"),
        "rating": row.get("rating"),
        "user_ratings_total": row.get("user_ratings_total"),
        "types": row.get("types") or [],
        "raw": row,
        "fetched_at": timezone.now(),
    }
    PlaceCache.objects.update_or_create(place_id=pid, defaults=defaults)


class Command(BaseCommand):
    help = "Crawl CrawlTile rows and fill PlaceCache via Google Places"

    def add_arguments(self, parser):
        parser.add_argument("--step-km", type=float, required=True)
        parser.add_argument("--limit", type=int, default=20, help="tiles to process in this run")
        parser.add_argument("--max-tries", type=int, default=3)
        parser.add_argument("--sleep", type=float, default=0.2, help="sleep seconds between requests")
        parser.add_argument("--max-requests", type=int, default=200, help="hard cap for upstream requests")
        parser.add_argument("--reset-running", action="store_true", help="set running -> pending (recovery)")
        parser.add_argument("--dry-run", action="store_true", help="do not call upstream / do not write PlaceCache")
        parser.add_argument("--keyword", type=str, default="神社", help="nearby keyword")

    def handle(self, *args, **opts):
        step_km = float(opts["step_km"])
        limit = int(opts["limit"])
        max_tries = int(opts["max_tries"])
        sleep_s = float(opts["sleep"])
        max_requests = int(opts["max_requests"])
        reset_running = bool(opts["reset_running"])
        dry_run = bool(opts["dry_run"])
        keyword = (opts.get("keyword") or "神社").strip() or "神社"

        if reset_running:
            n = CrawlTile.objects.filter(step_km=step_km, status=CrawlTile.Status.RUNNING).update(
                status=CrawlTile.Status.PENDING
            )
            self.stdout.write(self.style.WARNING(f"reset running -> pending: {n} tiles"))
            return

        # 対象：pending/failed で tries が許容内
        qs = (
            CrawlTile.objects
            .filter(step_km=step_km)
            .filter(status__in=[CrawlTile.Status.PENDING, CrawlTile.Status.FAILED])
            .filter(tries__lt=max_tries)
            .order_by("id")
        )

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"dry-run: will process up to {limit} tiles (step_km={step_km})"))
            for t in qs[:limit]:
                self.stdout.write(f"- tile#{t.id} center=({t.center_lat:.5f},{t.center_lng:.5f}) token={bool(t.next_page_token)} tries={t.tries}")
            return

        processed_tiles = 0
        req_count = 0
        inserted_places = 0

        while processed_tiles < limit and req_count < max_requests:
            # --- 1 tile をロックして取る（多重実行でも被らない） ---
            with transaction.atomic():
                tile = (
                    qs.select_for_update(skip_locked=True)
                    .first()
                )
                if tile is None:
                    break
                tile.status = CrawlTile.Status.RUNNING
                tile.tries = (tile.tries or 0) + 1
                tile.updated_at = timezone.now()
                tile.save(update_fields=["status", "tries", "updated_at"])

            # --- タイル処理 ---
            try:
                # radius は step_km をmに（ざっくり：タイル間隔=半径でもOK）
                radius_m = int(step_km * 1000)

                # ページング：token があれば付けて続きから
                params = {
                    "lat": tile.center_lat,
                    "lng": tile.center_lng,
                    "radius": radius_m,
                    "keyword": keyword,
                    "language": "ja",
                }
                if tile.next_page_token:
                    params["pagetoken"] = tile.next_page_token

                # ここで upstream を叩く（places.py はキャッシュもある）
                data = places_service.places_nearby_search(params)

                status_ = (data or {}).get("status")
                if status_ == "OVER_QUERY_LIMIT":
                    # ここで止める。タイルは pending/failed に戻す（DONEにしない）
                    tile.status = CrawlTile.Status.FAILED
                    tile.last_error = "OVER_QUERY_LIMIT"
                    tile.last_crawled_at = timezone.now()
                    tile.save(update_fields=["status", "last_error", "last_crawled_at", "updated_at"])
                    self.stdout.write(self.style.ERROR("STOP: OVER_QUERY_LIMIT"))
                    break
                req_count += 1

                results = (data or {}).get("results") or []
                next_token = (data or {}).get("next_page_token") or ""

                # PlaceCache upsert
                for r in results:
                    _upsert_place_cache(r)
                inserted_places += len(results)

                # tokenが出たら続行、無ければDONE
                tile.next_page_token = next_token or ""
                tile.last_crawled_at = timezone.now()
                tile.last_error = ""

                if next_token:
                    tile.status = CrawlTile.Status.PENDING  # まだ続きがあるので再度pendingへ
                else:
                    tile.status = CrawlTile.Status.DONE

                tile.save(
                    update_fields=["status", "next_page_token", "last_crawled_at", "last_error", "updated_at"]
                )
                processed_tiles += 1

            except Exception as e:
                tile.status = CrawlTile.Status.FAILED
                tile.last_error = str(e)[:2000]
                tile.last_crawled_at = timezone.now()
                tile.save(update_fields=["status", "last_error", "last_crawled_at", "updated_at"])
                processed_tiles += 1

            if sleep_s > 0:
                time.sleep(sleep_s)

        self.stdout.write(
            self.style.SUCCESS(
                f"tiles_processed={processed_tiles} requests={req_count}/{max_requests} places_upserted={inserted_places} step_km={step_km}"
            )
        )
