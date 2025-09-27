from __future__ import annotations

from typing import Any, Dict, List


def normalize_recs(data: Dict[str, Any] | None, *, query: str = "") -> Dict[str, Any]:
    """
    LLMが返したJSONから {recommendations: [{name, reason, ...}], ...} に正規化。
    想定キーがなければ空を返す。
    """
    if not isinstance(data, dict):
        return {"recommendations": []}
    recs: List[Dict[str, Any]] = []
    cand = data.get("recommendations") or data.get("spots") or []
    if isinstance(cand, list):
        for it in cand:
            if not isinstance(it, dict):
                continue
            name = (it.get("name") or "").strip()
            if not name:
                continue
            recs.append(
                {
                    "name": name,
                    "reason": (it.get("reason") or data.get("summary") or "").strip(),
                    "place_id": it.get("place_id"),
                    "lat": it.get("lat"),
                    "lng": it.get("lng"),
                }
            )
    return {"recommendations": recs}


def complete_recommendations(
    payload: Dict[str, Any], *, query: str = "", candidates=None
) -> Dict[str, Any]:
    """
    recommendations の shape を最終整形。上限3件に丸めるなど。
    """
    recs = payload.get("recommendations") or []
    if not isinstance(recs, list):
        recs = []
    # 先頭3件に丸め、必須キーだけ保証
    out = []
    for it in recs[:3]:
        if isinstance(it, dict) and it.get("name"):
            out.append(
                {
                    "name": it["name"],
                    "reason": it.get("reason", ""),
                    "place_id": it.get("place_id"),
                    "lat": it.get("lat"),
                    "lng": it.get("lng"),
                }
            )
    return {"recommendations": out}
