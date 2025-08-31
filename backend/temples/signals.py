from __future__ import annotations

import logging
from django.conf import settings
from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import Shrine
from .geocoding.normalizer import normalize_address
from .geocoding.client import GeocodingClient, GeocodingError

logger = logging.getLogger(__name__)

def _compose_address(obj) -> str | None:
    """
    モデルに address 系フィールド名が何であってもベストエフォートで連結。
    無ければ None を返し、何もしない。
    """
    # まず単一フィールド優先
    for k in ("address", "full_address", "address_text"):
        if hasattr(obj, k):
            v = (getattr(obj, k) or "").strip()
            if v:
                return v

    # 分割フィールドをいい感じに連結（存在するものだけ）
    parts = []
    for k in ("postal_code", "prefecture", "city", "ward", "town", "street", "address1", "address2"):
        if hasattr(obj, k):
            v = getattr(obj, k) or ""
            v = str(v).strip()
            if v:
                parts.append(v)
    return " ".join(parts) if parts else None

def _assign_latlng(obj, lat: float, lng: float) -> bool:
    """
    モデル側の緯度経度フィールド名に合わせて代入。
    変更があれば True。
    """
    changed = False
    for lat_name, lng_name in (("latitude", "longitude"), ("lat", "lon"), ("lat", "lng")):
        if hasattr(obj, lat_name) and hasattr(obj, lng_name):
            old_lat = getattr(obj, lat_name, None)
            old_lng = getattr(obj, lng_name, None)
            if old_lat != lat or old_lng != lng:
                setattr(obj, lat_name, lat)
                setattr(obj, lng_name, lng)
                changed = True
            break
    return changed

@receiver(pre_save, sender=Shrine)
def auto_geocode_on_save(sender, instance: Shrine, **kwargs):
    # トグルOFFなら何もしない
    if not getattr(settings, "AUTO_GEOCODE_ON_SAVE", False):
        return

    addr = _compose_address(instance)
    if not addr:
        return

    addr_n = normalize_address(addr)
    # すでに座標が埋まっていて、住所がほぼ同じなら skip（大文字小文字/全角半角の違いは無視）
    try:
        current_lat = getattr(instance, "latitude", getattr(instance, "lat", None))
        current_lng = getattr(instance, "longitude", getattr(instance, "lon", getattr(instance, "lng", None)))
    except Exception:
        current_lat = current_lng = None

    # 住所変更判定：シンプルに文字列比較（モデル側に old 値が無ければ常に実行でもOK）
    # pre_save なので旧オブジェクトをDBから読むのはコストがかかるため、まずはベストエフォート
    try:
        prev = sender.objects.filter(pk=instance.pk).only().first() if instance.pk else None
        if prev is not None:
            prev_addr = _compose_address(prev) or ""
            if normalize_address(prev_addr) == addr_n:
                return  # 住所変わってない
    except Exception:
        pass

    try:
        client = GeocodingClient()
        res = client.geocode(addr_n)
    except GeocodingError as e:
        logger.warning("auto_geocode_on_save: geocode failed: %s", e)
        return
    except Exception as e:
        logger.exception("auto_geocode_on_save: unexpected error: %s", e)
        return

    _assign_latlng(instance, res.lat, res.lon)
