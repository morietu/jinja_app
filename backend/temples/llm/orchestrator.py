# -*- coding: utf-8 -*-
"""
LLMオーケストレーター（コンシェルジュ）
- DB候補 → 不足時は Places（あなたの places_nearby_search を間接利用）で補完
- LLMあり: 「一押し＋近場2件（距離昇順）」に整形（JSONスキーマ）
- LLMなし: 距離順トップ3のフォールバック
- メモリキャッシュ（MVP）
"""
from __future__ import annotations

import os
import json
import uuid
import time
from typing import Dict, Any, List

from .config import CONFIG, redacted_coords
from .prompts import SYSTEM_PROMPT
from .schemas import CONCIERGE_PLAN
from .tools.db_search import search_db_shrines
from .tools.places_search import search_places_text   # ← 前段で nearby_search に差し替え済み

from .tools.route import rough_route
from .client import get_client
import logging
logger = logging.getLogger("temples")  # temples ロガーに統一




PLACES_RADIUS = int(os.getenv("PLACES_RADIUS_M", "7000"))
PLACES_LIMIT  = int(os.getenv("PLACES_LIMIT", "30"))

# --- 超簡易メモリキャッシュ（MVP） ---
_CACHE: Dict[str, Dict[str, Any]] = {}  # {key: {"ts": epoch, "value": any}}

def _normalize_plan(out: Dict[str, Any] | None, plan_id: str, transport: str) -> Dict[str, Any]:
    if not isinstance(out, dict):
        out = {}
    # デフォルト補完
    out.setdefault("summary", "あなたの要望に合わせて候補を整理しました。")
    out.setdefault("tips", ["朝は比較的空いています。", "参拝作法を確認してから臨みましょう。"])
    shrines = out.get("shrines") or []
    if not isinstance(shrines, list):
        shrines = []

    norm = []
    for s in shrines[:3]:
        s = s or {}
        dist = int(s.get("distance_m") or 0)
        norm.append({
            "name":      s.get("name") or s.get("title") or "（名称不明）",
            "id":        s.get("id"),
            "place_id":  s.get("place_id"),
            "address":   s.get("address") or "",
            "lat":       s.get("lat"),
            "lng":       s.get("lng"),
            "distance_m": dist,
            "duration_min": rough_route(dist, transport),
            "reason":    s.get("reason") or "要望に合致したため。",
        })
    out["plan_id"] = plan_id
    out["shrines"] = norm
    return out

def _cache_get(key: str):
    item = _CACHE.get(key)
    if not item:
        return None
    if time.time() - item["ts"] > CONFIG.cache_ttl_s:
        _CACHE.pop(key, None)
        return None
    return item["value"]

def _cache_set(key: str, value: Dict[str, Any]):
    _CACHE[key] = {"ts": time.time(), "value": value}

def _recalc_duration(plan: Dict[str, Any], transport: str) -> Dict[str, Any]:
    """安全のため、LLMのdurationをサーバ側で上書き。"""
    for s in plan.get("shrines", []) or []:
        dist = int(s.get("distance_m") or 0)
        s["duration_min"] = rough_route(dist, transport)
    return plan

def _fallback_from_candidates(plan_id: str, candidates: List[Dict[str, Any]], transport: str) -> Dict[str, Any]:
    picked = (candidates or [])[:3]
    if not picked:
        return {
            "plan_id": plan_id,
            "summary": "近い候補が見つかりませんでした。検索範囲を広げてお試しください。",
            "shrines": [],
            "tips": ["駅名やエリア名を含めて検索すると精度が上がります。"],
        }
    return {
        "plan_id": plan_id,
        "summary": "近い順で候補を提示します（フォールバック）。",
        "shrines": [{
            "name": s.get("name"),
            "id": s.get("id"),
            "place_id": s.get("place_id"),
            "address": s.get("address"),                     # ← 追加
            "lat": s.get("lat"), "lng": s.get("lng"),        # ← 追加
            "distance_m": int(s.get("distance_m") or 0),
            "duration_min": rough_route(int(s.get("distance_m") or 0), transport),
            "reason": "現在地から近いため。",
        } for s in picked],
        "tips": ["朝は比較的空いています。", "参拝作法を確認してから臨みましょう。"],
    }

def chat_to_plan(message: str, lat: float, lng: float, transport: str = "walking") -> Dict[str, Any]:
    plan_id = str(uuid.uuid4())[:8]

    # 1) キャッシュキー
    rlat, rlng = redacted_coords(lat, lng)
    ckey = f"{CONFIG.model}:{CONFIG.prompt_version}:{transport}:{rlat},{rlng}:{message.strip()}"
    cval = _cache_get(ckey)
    if cval:
        out = dict(cval)
        out["plan_id"] = plan_id
        return out

    # 2) 候補収集
    db = search_db_shrines(lat, lng, goriyaku=[], limit=10)
    need = max(0, 3 - len(db))
    places: List[Dict[str, Any]] = []
    if need > 0:
        q = _intent_to_query(message)
        places = search_places_text(
            lat, lng, query=q,
            radius=PLACES_RADIUS,
            limit=min(PLACES_LIMIT, need * 5),
        )
    candidates = sorted([*db, *places], key=lambda x: int(x.get("distance_m") or 10**12))[:12]

    # 3) LLM呼び出し準備
    client = get_client()
    force_chat = os.getenv("LLM_FORCE_CHAT", "0") == "1"
    use_responses = hasattr(client, "responses") and not force_chat

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"現在地: lat={lat}, lng={lng}, 移動手段: {transport}"},
        {"role": "user", "content": f"要望: {message}"},
        {"role": "user", "content": "以下の候補（distance_m昇順）から、最適な1件を先頭に、その後に距離が近い順で最大2件を選び、JSONスキーマで返してください。"},
        {"role": "user", "content": json.dumps(candidates, ensure_ascii=False)},
    ]
    logger.info("[concierge] use_responses=%s force_chat=%s model=%s", use_responses, force_chat, CONFIG.model)

    # 4) LLM呼び出し（Responses優先 / 未対応はchat.completions）
    last_err = None
    for attempt in range(CONFIG.retries + 1):
        try:
            if use_responses:
                # --- Responses 分岐 ---
                try:
                    resp = client.responses.create(
                        model=CONFIG.model,
                        input=messages,
                        temperature=CONFIG.temperature,
                    )
                    raw = getattr(resp, "output_text", "") or ""
                    if not raw and getattr(resp, "output", None):
                        try:
                            raw = resp.output[0].content[0].text.value  # type: ignore[attr-defined]
                        except Exception:
                            raw = ""
                    out = json.loads(raw) if raw else {}
                except TypeError as te:
                    # SDK差異（messages/response_format 等）→ Chatへ切替
                    if "messages" in str(te) or "response_format" in str(te) or "input" in str(te):
                        logger.info("[concierge] Responses unsupported in this env → fallback to chat")
                        use_responses = False
                        continue
                    raise
            else:
                # --- Chat 分岐（json_object モード）---
                messages2 = messages + [{"role": "system", "content": "必ず有効なJSONだけを出力してください。"}]
                comp = client.chat.completions.create(
                    model=CONFIG.model,
                    temperature=CONFIG.temperature,
                    messages=messages2,
                    response_format={"type": "json_object"},
                )
                raw = (comp.choices[0].message.content or "").strip()
                try:
                    out = json.loads(raw)
                except Exception:
                    import re
                    m = re.search(r'(\{.*\}|\[.*\])', raw, re.S)
                    out = json.loads(m.group(1)) if m else {}

            # 最低限のバリデーション
            if not isinstance(out, dict) or "shrines" not in out:
                raise ValueError("LLM returned empty or invalid JSON")

            # 正規化（summary/tips補完＋duration_min上書き）
            out = _normalize_plan(out, plan_id, transport)
            _cache_set(ckey, out)
            return out

        except Exception as e:
            last_err = e
            logger.exception(
                "[concierge] LLM error (attempt %s/%s, use_responses=%s, force_chat=%s): %s",
                attempt + 1, CONFIG.retries + 1, use_responses, force_chat, e
            )
            time.sleep(CONFIG.backoff_s * (attempt + 1))

    # 5) フォールバック
    out = _fallback_from_candidates(plan_id, candidates, transport)
    out["summary"] = "LLMエラーにより距離順フォールバックしました。"
    _cache_set(ckey, out)
    return out

def _intent_to_query(message: str) -> str:
    m = (message or "").strip()
    if any(k in m for k in ["恋愛", "縁結", "良縁", "結婚"]): return "縁結び 神社"
    if any(k in m for k in ["金運", "商売", "仕事", "開運"]): return "商売繁盛 神社"
    if any(k in m for k in ["学業", "合格", "受験"]):       return "学業成就 神社"
    if any(k in m for k in ["厄", "厄除", "厄払い"]):         return "厄除け 神社"
    return "神社"
