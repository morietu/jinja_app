# backend/temples/services/places_sync.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from django.db import transaction
from django.utils import timezone

from temples.models import PlaceRef, PlaceCache


# ──────────────────────────────────────────────────────────────────────────────
# 外部I/O（Google Places呼び出し）はここから “1箇所” に閉じ込める
# ※あなたの既存実装に合わせて import / 関数名は差し替えてOK
# ──────────────────────────────────────────────────────────────────────────────

def _google_places_nearby_search(
    *,
    lat: float,
    lng: float,
    radius_m: int,
    keyword: str,
    limit: int,
) -> Dict[str, Any]:
    from temples.services.places import nearby_search

    # services/places.py の nearb_search は正規化された呼び口になってる前提
    return nearby_search(
        lat=lat,
        lng=lng,
        radius_m=radius_m,
        keyword=keyword,
        limit=limit,
    )

# ──────────────────────────────────────────────────────────────────────────────
# 正規化（Placesの結果 -> PlaceRef/PlaceCacheへ）
# ──────────────────────────────────────────────────────────────────────────────

def _extract_place_items(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Google Places Nearby の results を取り出す。
    実装差分があるならここで吸収する。
    """
    results = raw.get("results")
    if isinstance(results, list):
        return results
    # もし "candidates" 等の別名があるならここでフォールバック
    candidates = raw.get("candidates")
    if isinstance(candidates, list):
        return candidates
    return []


def _normalize_place_item(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    item 1件を PlaceRef に入る形に薄く正規化。
    """
    place_id = item.get("place_id") or item.get("placeId") or item.get("id")
    if not place_id:
        return None

    name = item.get("name") or ""
    address = (
        item.get("vicinity")
        or item.get("formatted_address")
        or item.get("address")
        or ""
    )

    # geometry.location.{lat,lng} 形式が多い
    lat = None
    lng = None
    geom = item.get("geometry") or {}
    loc = geom.get("location") or {}
    if isinstance(loc, dict):
        lat = loc.get("lat")
        lng = loc.get("lng")

    # たまに lat/lng が直で来る実装もある
    if lat is None:
        lat = item.get("lat")
    if lng is None:
        lng = item.get("lng")

    try:
        lat_f = float(lat) if lat is not None else None
        lng_f = float(lng) if lng is not None else None
    except Exception:
        lat_f = None
        lng_f = None

    return {
        "place_id": str(place_id),
        "name": str(name)[:255],
        "address": str(address)[:255],
        "latitude": lat_f,
        "longitude": lng_f,
        "snapshot_json": item,  # 1件分だけ薄く保持（PlaceRefの思想）
    }


@transaction.atomic
def _upsert_place_ref(norm: Dict[str, Any], *, dry_run: bool) -> bool:
    """
    PlaceRef へ upsert。戻り値は upsert(=更新/作成)が行われたか。
    """
    if dry_run:
        return True

    place_id = norm["place_id"]
    defaults = {
        "name": norm.get("name", ""),
        "address": norm.get("address", ""),
        "latitude": norm.get("latitude"),
        "longitude": norm.get("longitude"),
        "snapshot_json": norm.get("snapshot_json"),
        "synced_at": timezone.now(),
    }

    # update_or_create は “単一窓口” としては分かりやすくて正義
    PlaceRef.objects.update_or_create(place_id=place_id, defaults=defaults)
    return True


@transaction.atomic
def _upsert_place_cache(
    place_id: str,
    raw_item: Dict[str, Any],
    *,
    dry_run: bool,
) -> bool:
    """
    PlaceCache は “rawを厚めに保持” したいときの保険。
    """
    if dry_run:
        return True

    # PlaceCache のフィールドに合わせて薄く詰める（無理しない）
    name = raw_item.get("name") or ""
    address = (
        raw_item.get("vicinity")
        or raw_item.get("formatted_address")
        or raw_item.get("address")
        or ""
    )

    # 位置
    lat = None
    lng = None
    geom = raw_item.get("geometry") or {}
    loc = geom.get("location") or {}
    if isinstance(loc, dict):
        lat = loc.get("lat")
        lng = loc.get("lng")
    if lat is None:
        lat = raw_item.get("lat")
    if lng is None:
        lng = raw_item.get("lng")

    try:
        lat_f = float(lat) if lat is not None else None
        lng_f = float(lng) if lng is not None else None
    except Exception:
        lat_f = None
        lng_f = None

    defaults = {
        "name": str(name)[:255],
        "address": str(address)[:255],
        "lat": lat_f,
        "lng": lng_f,
        "rating": raw_item.get("rating"),
        "user_ratings_total": raw_item.get("user_ratings_total"),
        "types": raw_item.get("types") or [],
        "raw": raw_item,
    }
    PlaceCache.objects.update_or_create(place_id=place_id, defaults=defaults)
    return True


# ──────────────────────────────────────────────────────────────────────────────
# 公開API：seed 1点の同期（あなたが欲しいやつ）
# ──────────────────────────────────────────────────────────────────────────────

def sync_nearby_seed(
    lat: float,
    lng: float,
    radius_m: int,
    keyword: str,
    limit: int,
    *,
    dry_run: bool = False,
    store_cache: bool = False,
) -> Dict[str, Any]:
    """
    1 seed (lat/lng) から nearby を引いて、PlaceRef (and optional PlaceCache) に upsert。

    return:
      {
        "requests_used": int,
        "upserted": int,
        "errors": [ ... ],
        "fetched": int,
      }
    """
    errors: List[Dict[str, Any]] = []
    upserted = 0
    fetched = 0
    requests_used = 0

    # B案: places.py を再利用するので upstream は 0〜複数回になり得る
    # req_history の差分で “実リクエスト数” を計測して budget を守る
    try:
        # ✅ 実リクエスト数を計測（B案: places.py 再利用の必須条件）
        from temples.services.places import req_history  # google_places.req_history の別名

        before = len(req_history)

        raw = _google_places_nearby_search(
            lat=lat,
            lng=lng,
            radius_m=radius_m,
            keyword=keyword,
            limit=limit,
        )

        after = len(req_history)
        requests_used += max(0, after - before)

    except Exception as e:
        errors.append({"type": "places_request_failed", "error": str(e)})
        return {"requests_used": requests_used, "upserted": 0, "errors": errors, "fetched": 0}

    items = _extract_place_items(raw)
    fetched = len(items)

    for item in items[: max(0, int(limit))]:
        norm = _normalize_place_item(item)
        if not norm:
            errors.append({"type": "invalid_item", "error": "missing place_id", "item": item})
            continue

        try:
            ok = _upsert_place_ref(norm, dry_run=dry_run)
            if ok:
                upserted += 1

            if store_cache:
                _upsert_place_cache(norm["place_id"], item, dry_run=dry_run)

        except Exception as e:
            errors.append(
                {
                    "type": "upsert_failed",
                    "place_id": norm.get("place_id"),
                    "error": str(e),
                }
            )

    return {
        "requests_used": requests_used,
        "upserted": upserted,
        "errors": errors,
        "fetched": fetched,
    }
