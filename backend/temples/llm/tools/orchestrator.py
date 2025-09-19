# -*- coding: utf-8 -*-
import os, json, uuid
from typing import Dict, Any, List
from .prompts import SYSTEM_PROMPT
from .schemas import CONCIERGE_PLAN
from .tools.db_search import search_db_shrines
from .tools.places_search import search_places_text
from .tools.route import rough_route

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

def _recalc_duration(plan: Dict[str, Any], transport: str) -> Dict[str, Any]:
    """LLM出力のduration_minを安全のためサーバ側でも再計算して上書き。"""
    for s in plan.get("shrines", []):
        dist = int(s.get("distance_m") or 0)
        s["duration_min"] = rough_route(dist, transport)
    return plan

def chat_to_plan(message: str, lat: float, lng: float, transport: str = "walking") -> Dict[str, Any]:
    """
    自由文の要望 + 現在地から、以下の順でプランを返す。
      1) DB候補収集（距離昇順）
      2) 不足時はGoogle Placesで補完
      3) OpenAIがあれば「一押し＋近場2件」のJSONに整形（無ければ距離順3件）
    """
    plan_id = str(uuid.uuid4())[:8]

    # 1) DBから候補（ご利益抽出は後続。MVPは空＝全件距離順）
    db = search_db_shrines(lat, lng, goriyaku=[], limit=10)

    # 2) DBが足りない場合はPlaces補完
    need = max(0, 3 - len(db))
    places = search_places_text(lat, lng, query="神社", radius=7000, limit=need * 5) if need > 0 else []
    candidates: List[Dict[str, Any]] = sorted([*db, *places], key=lambda x: x["distance_m"])[:12]

    # 3) OpenAIキーが無ければフォールバック（距離順 上位3件）
    if not (OpenAI and os.getenv("OPENAI_API_KEY")):
        picked = candidates[:3]
        out = {
            "plan_id": plan_id,
            "summary": "近い順で候補を提示します（フォールバック）。",
            "shrines": [{
                "name": s["name"],
                "id": s.get("id"),
                "place_id": s.get("place_id"),
                "reason": "現在地から近いため。",
                "distance_m": int(s["distance_m"]),
                "duration_min": rough_route(int(s["distance_m"]), transport),
                "lat": s.get("lat"), "lng": s.get("lng")
            } for s in picked],
            "tips": ["朝は比較的空いています。", "参拝作法を確認してから臨みましょう。"]
        }
        return out

    # 3) OpenAIで「一押し+近場2件」に整形
    client = OpenAI()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"現在地: lat={lat}, lng={lng}, 移動手段: {transport}"},
        {"role": "user", "content": f"要望: {message}"},
        {"role": "user", "content": "以下の候補（distance_m昇順）から、最適な1件を先頭に、その後に距離が近い順で最大2件を選び、JSONスキーマに従って返してください。"},
        {"role": "user", "content": json.dumps(candidates, ensure_ascii=False)}
    ]
    resp = client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        messages=messages,
        response_format={"type": "json_schema", "json_schema": CONCIERGE_PLAN},
        temperature=0.2
    )
    out = resp.output_parsed or {}
    out["plan_id"] = plan_id
    # 安全のためサーバ側でduration再計算（LLMの誤差を抑える）
    return _recalc_duration(out, transport)
