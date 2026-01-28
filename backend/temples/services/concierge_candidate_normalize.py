# backend/temples/services/concierge_candidate_normalize.py
from __future__ import annotations
from typing import Any, Dict, Optional  # ✅ Optional を追加

def _none_if_blank(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s if s else None
    return v  # ← 文字列以外はそのまま（勝手に str にしない方が安全）

def normalize_candidate(c: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(c, dict):
        return {}

    out = dict(c)

    # ✅ 先に空文字を潰す（判定が全部安定する）
    for k in ("place_id", "placeId", "google_place_id", "googlePlaceId",
              "shrine_id", "shrineId", "formatted_address", "formattedAddress",
              "address", "name", "display_name", "displayName"):
        if k in out:
            out[k] = _none_if_blank(out.get(k))

    # --- shrine id（DB候補は id しか無いのでここが最重要） ---
    if out.get("shrine_id") is None:
        out["shrine_id"] = out.get("shrineId") or out.get("shrine_pk") or out.get("shrinePk")

    # ✅ DB候補の互換：id -> shrine_id
    if out.get("shrine_id") is None and out.get("id") is not None:
        out["shrine_id"] = out.get("id")

    # --- place id ---
    if out.get("place_id") is None:
        out["place_id"] = out.get("placeId") or out.get("google_place_id") or out.get("googlePlaceId")

    # --- address ---
    if out.get("formatted_address") is None:
        out["formatted_address"] = out.get("formattedAddress")
    if out.get("address") is None:
        out["address"] = out.get("formatted_address")

    # --- lat/lng ---
    if out.get("lat") is None:
        out["lat"] = out.get("latitude")
    if out.get("lng") is None:
        out["lng"] = out.get("longitude")

    # --- name ---
    if out.get("name") is None:
        out["name"] = out.get("display_name") or out.get("displayName") or out.get("name_jp")

    # contract cleanup
    out.pop("id", None)

    # ✅ 最後に主要フィールドも空文字を潰す（place_id が "" とか）
    for k in ("place_id", "shrine_id", "formatted_address", "address", "name"):
        out[k] = _none_if_blank(out.get(k))

    return out
