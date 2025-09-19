# backend/temples/llm/tools/places_search.py
from typing import List, Dict, Any, Optional
from math import radians, sin, cos, asin, sqrt
from temples.services import places as places_service  # 高レベルAPI（キャッシュ＆ランキング＆注入付き）
from pprint import pprint

def _hav_m(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    R = 6371000.0
    dlat = radians(lat2 - lat1); dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return int(2 * R * asin(sqrt(a)))

def _extract_lat_lng(r: Dict[str, Any]) -> Optional[tuple[float, float]]:
    # 正規化済みrowは r["lat"], r["lng"] を想定。無ければ geometry から拾う。
    lat = r.get("lat"); lng = r.get("lng")
    if lat is None or lng is None:
        loc = ((r.get("geometry") or {}).get("location") or {})
        lat, lng = loc.get("lat"), loc.get("lng")
    if lat is None or lng is None:
        return None
    return float(lat), float(lng)

def _addr_from_details(det: Dict[str, Any]) -> tuple[Optional[str], Optional[float], Optional[float]]:
    """
    Places Details のレスポンスから address, lat, lng を安全に取り出す。
    - det["result"] がある場合はそこを優先
    - なければトップレベルを参照
    - formatted_address / vicinity / address_components の順で組み立て
    """
    doc = det.get("result") if isinstance(det.get("result"), dict) else det
    addr = doc.get("formatted_address") or doc.get("vicinity")
    if not addr and isinstance(doc.get("address_components"), list):
        try:
            # ざっくり連結（区切りはスペース）
            addr = " ".join(c.get("long_name") for c in doc["address_components"] if c.get("long_name"))
        except Exception:
            addr = None
    loc = (doc.get("geometry") or {}).get("location") or {}
    la, ln = loc.get("lat"), loc.get("lng")
    return addr, la, ln

def _enrich_address(rows: List[Dict[str, Any]], language: str = "ja", max_count: int = 5) -> List[Dict[str, Any]]:
    """上位数件だけ Place Details で住所/座標を補完（キャッシュ付）。"""
    out: List[Dict[str, Any]] = []
    used = 0
    for r in rows:
        if used < max_count and not r.get("address") and r.get("place_id"):
            try:
                det = places_service.places_details(r["place_id"], {"language": language})
                addr, la2, ln2 = _addr_from_details(det)
                if addr and not r.get("address"):
                    r = dict(r)
                    r["address"] = addr
                # 念のため座標も補完
                if (r.get("lat") is None or r.get("lng") is None) and la2 is not None and ln2 is not None:
                    r["lat"], r["lng"] = float(la2), float(ln2)
            except Exception:
                pass
            finally:
                used += 1  # 成否に関わらず試行カウント進めて無限試行を防ぐ
        out.append(r)
    return out

def search_places_text(lat: float, lng: float, query: str, radius: int = 7000, limit: int = 30) -> List[Dict[str, Any]]:
    # クランプ & クエリ正規化
    radius = max(100, int(radius or 100))
    limit  = max(1, int(limit or 1))
    q = (query or "").strip() or "神社"

    resp = places_service.places_nearby_search({
        "lat": lat, "lng": lng, "radius": radius,
        "keyword": q, "language": "ja",
    })
    results = resp.get("results") or []

    # LLM用に正規化（place_id で重複除去）
    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for r in results:
        pos = _extract_lat_lng(r)
        if not pos:
            continue
        pid = r.get("place_id")
        if pid:
            if pid in seen:
                continue
            seen.add(pid)
        lt, lg = pos
        out.append({
            "id": None,
            "name": r.get("name"),
            "address": r.get("formatted_address") or r.get("vicinity"),  # 無ければ補完で埋める
            "lat": lt, "lng": lg, "place_id": pid,
            "distance_m": _hav_m(lat, lng, lt, lg),
        })

    # 住所補完（上位 min(limit, 5) 件）
    out = _enrich_address(out, language="ja", max_count=min(5, limit))
    return out[:limit]


