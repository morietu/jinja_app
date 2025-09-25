# backend/temples/llm/schemas.py
from __future__ import annotations

from typing import Any, Dict, List


def normalize_recs(data: Any, query: str = "") -> Dict[str, Any] | None:
    """
    LLMが返したJSONらしきオブジェクトから { recommendations: [{name, reason, ...}], summary? } を抽出。
    柔らかく吸収してminimumスキーマに寄せる。
    """
    if not isinstance(data, dict):
        return None

    # すでに recommendations があれば尊重
    if "recommendations" in data and isinstance(data["recommendations"], list):
        return {
            "summary": data.get("summary", ""),
            "recommendations": [
                {
                    "name": (r.get("name") or r.get("title") or "").strip(),
                    "reason": (r.get("reason") or r.get("why") or ""),
                    "location": r.get("location") or "",
                    "place_id": r.get("place_id"),
                    "lat": r.get("lat"),
                    "lng": r.get("lng"),
                }
                for r in data["recommendations"]
                if isinstance(r, dict) and (r.get("name") or r.get("title"))
            ],
        }

    # spots 形式（Planスキーマ寄り）も吸収
    if "spots" in data and isinstance(data["spots"], list):
        return {
            "summary": data.get("summary", ""),
            "recommendations": [
                {
                    "name": (s.get("name") or "").strip(),
                    "reason": s.get("reason", ""),
                    "location": "",
                    "place_id": s.get("place_id"),
                    "lat": s.get("lat"),
                    "lng": s.get("lng"),
                }
                for s in data["spots"]
                if isinstance(s, dict) and s.get("name")
            ],
        }

    return None


def complete_recommendations(
    payload: Dict[str, Any], query: str = "", candidates: List[Dict[str, Any]] | None = None
) -> Dict[str, Any]:
    """
    name/理由はあるが location/place_id が空などのケースに後段で補完するためのフック。
    ここでは何もしない（将来、Places補完をここで実装）。
    """
    payload = dict(payload or {})
    recs = payload.get("recommendations") or []
    payload["recommendations"] = recs[:3]  # 上限3に丸める（UI想定）
    return payload
