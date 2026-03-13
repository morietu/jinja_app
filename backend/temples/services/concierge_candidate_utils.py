from __future__ import annotations

from typing import Any, Dict, List, Optional


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            return float(s)
        except Exception:
            return None
    return None


def _candidate_key(c: Dict[str, Any]) -> tuple:
    if c.get("place_id"):
        return ("place_id", str(c["place_id"]))
    if c.get("shrine_id") or c.get("id"):
        return ("shrine_id", str(c.get("shrine_id") or c.get("id")))

    name = str(c.get("name") or "").strip()
    address = str(c.get("address") or c.get("formatted_address") or "").strip()
    return ("name_address", name, address)


def _dedupe_candidates(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    seen = set()

    for c in items:
        if not isinstance(c, dict):
            continue
        key = _candidate_key(c)
        if key in seen:
            continue
        seen.add(key)
        out.append(c)

    return out
