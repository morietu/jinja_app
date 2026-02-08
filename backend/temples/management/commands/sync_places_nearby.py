# backend/temples/management/commands/sync_places_nearby.py
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from temples.services import google_places
from temples.services.place_cache_upsert import PlaceCacheInput, upsert_place_cache_many


def to_input(p: dict) -> PlaceCacheInput:
    # ✅ google_places 正規化済み: lat/lng がトップレベルにいる
    lat = p.get("lat")
    lng = p.get("lng")

    # 念のため geometry.location もフォールバック（将来仕様変更に備える）
    if (lat is None or lng is None) and isinstance(p.get("geometry"), dict):
        loc = (p["geometry"].get("location") or {})
        if isinstance(loc, dict):
            lat = lat if lat is not None else loc.get("lat")
            lng = lng if lng is not None else loc.get("lng")

    address = p.get("address") or p.get("vicinity") or p.get("formatted_address") or ""

    return PlaceCacheInput(
        place_id=p.get("place_id") or "",
        name=p.get("name") or "",
        address=address,
        lat=lat,
        lng=lng,
        rating=p.get("rating"),
        user_ratings_total=p.get("user_ratings_total"),
        types=p.get("types") or [],
        raw=p,
    )

def normalize_keyword(s: str) -> str:
    # 全角スペース→半角→連続スペース圧縮→trim
    s = (s or "").replace("\u3000", " ")
    return " ".join(s.split()).strip()

def is_shrine(p: dict) -> bool:
    ...
    name = (p.get("name") or "")
    types = set(p.get("types") or [])

    # 明確に寺は落とす
    if "buddhist_temple" in types:
        return False

    # typesで神社判定できるなら最強
    if "shinto_shrine" in types:
        return True

    # 文字列判定（最低限）
    if "神社" in name:
        return True

    # “稲荷”は神社として扱いたい（要件次第でON/OFF）
    if "稲荷" in name:
        return True

    return False



class Command(BaseCommand):
    help = "Sync nearby places from Google Places and upsert into DB."

    def add_arguments(self, parser):
        parser.add_argument("--lat", type=float, required=True)
        parser.add_argument("--lng", type=float, required=True)
        parser.add_argument("--limit", type=int, default=20)
        parser.add_argument("--radius", type=int, default=1500)
        parser.add_argument("--keyword", type=str, default="神社")  # 固定でもいいけど一応
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        lat: float = opts["lat"]
        lng: float = opts["lng"]
        limit: int = opts["limit"]
        radius: int = opts["radius"]
        keyword: str = normalize_keyword(opts["keyword"])
        dry_run: bool = opts["dry_run"]

        if limit <= 0 or limit > 60:
            raise CommandError("--limit must be 1..60")
        if radius <= 0 or radius > 50000:
            raise CommandError("--radius must be 1..50000")

        raw = google_places.nearby_search(
            lat=lat,
            lng=lng,
            radius=radius,
            keyword=keyword,
            language="ja",
        )

        results = (raw or {}).get("results") or []
        results = [p for p in results if isinstance(p, dict) and p.get("place_id")]
        

        # ✅ shrineっぽいものだけ残す（混入対策）
        results = [p for p in results if is_shrine(p)]

        # ✅ コスト対策（後で切る）
        results = results[:limit]

        self.stdout.write(
            f"RAW status={raw.get('status') if isinstance(raw, dict) else None} results={len(results)}"
        )
        self.stdout.write(f"keyword={keyword!r} radius={radius} limit={limit}")

        if results:
            p0 = results[0]
            self.stdout.write(
                str(
                    {
                        "keys": sorted(p0.keys()),
                        "lat": p0.get("lat"),
                        "lng": p0.get("lng"),
                        "geometry": p0.get("geometry"),
                        "location": (
                            (p0.get("geometry") or {}).get("location")
                            if isinstance(p0.get("geometry"), dict)
                            else None
                        ),
                    }
                )
            )

        items: list[PlaceCacheInput] = [to_input(p) for p in results]

        if not items:
            self.stdout.write(self.style.WARNING("No valid place_id results"))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run: show first 3 raw + normalized"))
            for p in results[:3]:
                self.stdout.write(
                    str(
                        {
                            "name": p.get("name"),
                            "place_id": p.get("place_id"),
                            "types": p.get("types"),
                            "geometry": (p.get("geometry") or {}).get("location"),
                        }
                    )
                )
            for i in items[:3]:
                self.stdout.write(f"- {i.name} ({i.place_id}) {i.lat},{i.lng}")
            self.stdout.write(self.style.SUCCESS(f"Dry-run OK: {len(items)} items"))
            return

        n = upsert_place_cache_many(items)
        self.stdout.write(self.style.SUCCESS(f"Upserted {n} places"))
