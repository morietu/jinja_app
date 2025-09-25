# backend/temples/llm/orchestrator.py
from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional

from .client import LLMClient, make_openai_client
from .config import LLMConfig
from .prompts import SYSTEM_PROMPT
from .schemas import complete_recommendations, normalize_recs


def chat_to_plan(message: str, candidates: list[dict] | None = None) -> dict:
    """
    Back-compat shim expected by older tests/imports.
    旧API互換: message を query とみなし、recommendations 形式を返す。
    """
    return ConciergeOrchestrator().suggest(query=message, candidates=candidates or [])


def _extract_json(text: str):
    if not isinstance(text, str):
        return None
    # ```json ... ``` 優先
    m = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # 最初の { ... } を緩く拾う
    m = re.search(r"(\{[\s\S]*\})", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    return None


def _extract_markdown_list(text: str):
    """
    箇条書き表現から {name, reason} を抽出して recommendations に落とす。
    """
    items = []
    lines = [l.rstrip() for l in text.splitlines()]
    for line in lines:
        s = line.strip()
        if not s:
            continue
        # 1. **神社名** 理由...
        m = re.match(r"^(?:[-*+]|\d+[\).])\s*\*\*(.+?)\*\*\s*(.+)?$", s)
        if m:
            name = (m.group(1) or "").strip()
            reason = (m.group(2) or "").strip(" ・-—:　")
            if name:
                items.append({"name": name, "reason": reason})
    # タイトル行→次行が理由 の簡易対応
    if not items:
        for i, l in enumerate(lines[:-1]):
            m = re.match(r"^(?:[-*+]|\d+[\).])\s*\*\*(.+?)\*\*\s*$", l.strip())
            if m:
                name = (m.group(1) or "").strip()
                reason = lines[i + 1].strip()
                if name:
                    items.append({"name": name, "reason": reason})
    if not items:
        return None
    return {
        "recommendations": [
            {"name": it["name"], "location": "", "reason": it.get("reason", "")} for it in items[:3]
        ]
    }


class ConciergeOrchestrator:
    """チャット→推薦JSON（recommendations）にまとめる最小オーケストレータ。"""

    def __init__(self, client: Optional[LLMClient] = None):
        self.client = client or LLMClient()

    def suggest(self, query: str, candidates: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
        candidates = candidates or []
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Query: {query}\nCandidates: {candidates}"},
        ]
        msg = self.client.chat(messages)
        if isinstance(msg, dict) and msg.get("content"):
            text = msg["content"]
            data = _extract_json(text)
            tmp = (
                normalize_recs(data, query=query)
                if data is not None
                else (_extract_markdown_list(text) or {"raw": text})
            )
            return (
                complete_recommendations(tmp, query=query, candidates=candidates)
                if isinstance(tmp, dict) and "recommendations" in tmp
                else tmp
            )

        # LLM不在のフォールバック：入力候補の順序をスコア化
        recs = []
        for i, c in enumerate(candidates):
            name = c.get("name") or c.get("place_id") or "unknown"
            recs.append(
                {"name": name, "reason": "暫定（順序ベース）", "score": max(0.0, 1.0 - i * 0.1)}
            )
        return {"recommendations": recs}


# ---- v2: 位置情報を含む Plan 形式（/api/concierge/chat と統一して使える） ----


def _round_coord(v: Optional[float], ndigits: int) -> Optional[float]:
    if v is None:
        return None
    try:
        return round(float(v), ndigits)
    except Exception:
        return None


def _build_user_prompt_for_plan(
    query: str, lat: Optional[float], lng: Optional[float], transport: Optional[str]
) -> str:
    loc = f"{lat},{lng}" if lat is not None and lng is not None else "不明"
    t = transport or "不明"
    return f"""要望: {query}
出発位置: {loc}
移動手段: {t}
出力は以下のJSONスキーマに厳密に従ってください。"""


def generate_plan(
    query: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    transport: Optional[str] = None,
) -> Dict[str, Any]:
    """
    OpenAI Responses API の json_schema を使って {summary, spots[]} を強制。
    失敗時は recommendations 互換の簡易フォールバックを返す。
    """
    cfg = LLMConfig.load()
    lat = _round_coord(lat, cfg.coord_round)
    lng = _round_coord(lng, cfg.coord_round)

    user_prompt = _build_user_prompt_for_plan(query, lat, lng, transport)

    # JSON Schema（厳格）
    schema = {
        "name": "Plan",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "spots": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 5,
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "place_id": {"type": ["string", "null"]},
                            "lat": {"type": ["number", "null"]},
                            "lng": {"type": ["number", "null"]},
                            "reason": {"type": ["string", "null"]},
                        },
                        "required": ["name"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["summary", "spots"],
            "additionalProperties": False,
        },
    }

    # 実行（簡易リトライ）
    last_err: Optional[Exception] = None
    try:
        oai = make_openai_client(cfg)
    except Exception as e:
        oai = None
        last_err = e

    for _ in range(cfg.retries + 1):
        try:
            if oai is None:
                raise RuntimeError("OpenAI client is not available")
            resp = oai.responses.create(
                model=cfg.model,
                temperature=cfg.temperature,
                max_output_tokens=cfg.max_tokens,
                response_format={"type": "json_schema", "json_schema": schema},
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = getattr(resp, "output_text", None) or json.dumps({})
            data = json.loads(content)
            # Plan → recommendations 互換へも変換して返す（フロントの使い回しを想定）
            spots = data.get("spots") or []
            recs = [
                {
                    "name": (s.get("name") or "").strip(),
                    "reason": s.get("reason", ""),
                    "place_id": s.get("place_id"),
                    "lat": s.get("lat"),
                    "lng": s.get("lng"),
                }
                for s in spots
                if isinstance(s, dict) and s.get("name")
            ]
            return {
                "summary": data.get("summary", ""),
                "spots": spots,
                "recommendations": recs[:3],
            }
        except Exception as e:
            last_err = e
            time.sleep(cfg.backoff_s)

    # フォールバック（位置がわかるなら近傍3件のプレースホルダ、なければ簡易）
    if lat is not None and lng is not None:
        return {
            "summary": "LLMに失敗したため、現在地から近い候補のプレースホルダを提示します。",
            "spots": [
                {"name": "近隣の神社A", "reason": "距離が近い"},
                {"name": "近隣の神社B", "reason": "距離が近い"},
                {"name": "近隣の神社C", "reason": "距離が近い"},
            ],
            "recommendations": [
                {"name": "近隣の神社A", "reason": "距離が近い"},
                {"name": "近隣の神社B", "reason": "距離が近い"},
                {"name": "近隣の神社C", "reason": "距離が近い"},
            ],
            "_error": str(last_err) if last_err else "",
        }
    return {
        "summary": "LLMに失敗しました。仮の候補を返します。",
        "spots": [{"name": "近隣の神社"}],
        "recommendations": [{"name": "近隣の神社"}],
        "_error": str(last_err) if last_err else "",
    }
