# backend/temples/llm/tools/orchestrator.py
# -*- coding: utf-8 -*-
import uuid
from typing import Any, Dict, List

from django.conf import settings

from .db_search import search_db_shrines
from .places_search import search_places_text
from .route import rough_route


def chat_to_plan(message: str, lat: float, lng: float, transport: str = "walking") -> Dict[str, Any]:
    """
    自由文の要望 + 現在地から、以下の順でプランを返す。
      1) DB候補収集（距離昇順）
      2) 不足時はGoogle Placesで補完
    """
    plan_id = str(uuid.uuid4())[:8]

    db = search_db_shrines(lat, lng, goriyaku=[], limit=10)

    need = max(0, 3 - len(db))
    places = search_places_text(lat, lng, query="神社", radius=7000, limit=need * 5) if need > 0 else []
    candidates: List[Dict[str, Any]] = sorted([*db, *places], key=lambda x: x["distance_m"])[:12]

    # ここは “常に” ローカル生成（外部通信なし）
    picked = candidates[:3]
    return {
        "plan_id": plan_id,
        "summary": "近い順で候補を提示します（ローカル生成）。",
        "shrines": [
            {
                "name": s["name"],
                "id": s.get("id"),
                "place_id": s.get("place_id"),
                "reason": "現在地から近いため。",
                "distance_m": int(s["distance_m"]),
                "duration_min": rough_route(int(s["distance_m"]), transport),
                "lat": s.get("lat"),
                "lng": s.get("lng"),
            }
            for s in picked
        ],
        "tips": ["朝は比較的空いています。", "参拝作法を確認してから臨みましょう。"],
        "_signals": {"llm": {"enabled": bool(getattr(settings, "CONCIERGE_USE_LLM", False)), "used": False}},
    }
