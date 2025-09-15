from __future__ import annotations

import logging
from django.conf import settings
from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Shrine
from .geocoding.client import GeocodingClient, GeocodingError

logger = logging.getLogger(__name__)

try:
    from django.contrib.gis.geos import Point  # USE_GIS=0 でも基本 import 可
except Exception:
    Point = None  # GEOS が無い環境では None にして後段でスキップ
# --- ユーティリティ -------------------------------------------------

def _compose_address(obj) -> str | None:
    """モデルに address 系フィールドが複数あってもベストエフォートで結合。"""
    for k in ("address", "full_address", "address_text"):
        if hasattr(obj, k):
            v = (getattr(obj, k) or "").strip()
            if v:
                return v

    parts = []
    for k in ("postal_code", "prefecture", "city", "ward", "town", "street", "address1", "address2"):
        if hasattr(obj, k):
            v = str(getattr(obj, k) or "").strip()
            if v:
                parts.append(v)
    return " ".join(parts) if parts else None


def _normalize_address_safe(s: str) -> str:
    """normalize_address が無い環境でも動くように安全に正規化（簡易版）。"""
    s = (s or "").strip()
    try:
        # もし normalizer を導入しているなら有効化してOK
        # from .geocoding.normalizer import normalize_address
        # return normalize_address(s)
        return s
    except Exception:
        return s

# --- メインハンドラ -------------------------------------------------

@receiver(pre_save, sender=Shrine)
def auto_geocode_on_save(sender, instance: Shrine, **kwargs):
    """
    Shrine 保存直前に住所→座標を補完。
    - AUTO_GEOCODE_ON_SAVE=False なら何もしない
    - 既に latitude/longitude が入っていれば geocode しない（新規作成でも）
    - geocode 失敗時はログのみで保存は続行（落とさない）
    """
    # 0) フラグで全体ON/OFF（settings 未定義なら True 扱い）
    if getattr(settings, "AUTO_GEOCODE_ON_SAVE", True) is False:
        return

    # 1) 既に座標が指定されていれば何もしない（新規/更新どちらも）
    if getattr(instance, "latitude", None) is not None and getattr(instance, "longitude", None) is not None:
        return

    # 2) 住所の取得＆正規化（無ければ何もしない）
    addr = _compose_address(instance)
    addr = _normalize_address_safe(addr)
    if not addr:
        return

    # 3) 既存レコードで住所未変更ならスキップ（保険）
    if instance.pk:
        try:
            prev = sender.objects.filter(pk=instance.pk).only("id").first()
            if prev is not None:
                prev_addr = _normalize_address_safe(_compose_address(prev) or "")
                if prev_addr == addr:
                    return
        except Exception:
            pass  # 取れなくても続行

    # 4) geocode（失敗しても保存は続行）
    try:
        client = GeocodingClient()
        res = client.geocode(addr)
        if not res:
            logger.warning("auto_geocode_on_save: no result for %r", addr)
            return
        instance.latitude = float(res.lat)
        instance.longitude = float(res.lon)
        if Point is not None:
            try:
                instance.location = Point(res.lon, res.lat, srid=4326)
            except Exception:
                pass  # GeoDjango 無効時などは無視
    except GeocodingError as e:
        logger.warning("auto_geocode_on_save: geocode failed: %s (skip)", e)
        return
    except Exception as e:
        logger.exception("auto_geocode_on_save: unexpected error: %s (skip)", e)
        return
