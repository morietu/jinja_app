# backend/temples/llm/orchestrator.py
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from django.conf import settings

from .client import LLMClient, PLACEHOLDER, make_openai_client
from .config import LLMConfig
from .prompts import SYSTEM_PROMPT
from .schemas import complete_recommendations, normalize_recs


# ---- v1: /api/concierge/chat 向け（recommendations ベース） ----


@dataclass
class ConciergeInput:
    """コンシェルジュ LLM に渡す入力まとめ."""

    query: str
    area: Optional[str] = None
    language: str = "ja"
    candidates: List[Dict[str, Any]] = field(default_factory=list)

    def as_payload(self) -> Dict[str, Any]:
        summarized_candidates: List[Dict[str, Any]] = []
        for c in self.candidates[:10]:
            summarized_candidates.append(
                {
                    "name": c.get("name"),
                    "location": c.get("location"),
                    "tags": c.get("tags") or [],
                    "deities": c.get("deities") or [],
                    "popular_score": c.get("popular_score"),
                }
            )

        return {
            "query": self.query,
            "area": self.area,
            "language": self.language,
            "candidates": summarized_candidates,
        }


class ConciergeOrchestrator:
    """チャット→推薦JSON（recommendations）にまとめるオーケストレータ。"""

    def __init__(self, client: Optional[LLMClient] = None) -> None:
        self.client: LLMClient = client or LLMClient()
        self.enabled: bool = bool(getattr(settings, "USE_LLM_CONCIERGE", False))

    def _fallback_from_candidates(
        self, candidates: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        recs: List[Dict[str, Any]] = []
        for i, c in enumerate(candidates):
            name = c.get("name") or c.get("place_id") or "unknown"
            recs.append(
                {
                    "name": name,
                    "reason": "暫定（候補ベース）",
                    "score": max(0.0, 1.0 - i * 0.1),
                }
            )
        if not recs:
            recs = [{"name": "近隣の神社", "reason": "暫定"}]
        return {"recommendations": recs}

    def suggest(
        self, query: str, candidates: List[Dict[str, Any]] | None = None
    ) -> Dict[str, Any]:
        candidates = candidates or []
        query = (query or "").strip()
        if not query:
            return {"recommendations": []}

        if (
            not self.enabled
            or getattr(self.client, "_client", None) is None
            or getattr(self.client, "_mode", None) is None
        ):
            return self._fallback_from_candidates(candidates)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Query: {query}\nCandidates: {candidates}"},
        ]

        try:
            msg = self.client.chat(messages)
        except Exception:
            out = self._fallback_from_candidates(candidates)
            out["raw"] = PLACEHOLDER["content"]
            return out

        if isinstance(msg, dict) and msg.get("content"):
            text = msg["content"]
            data = _extract_json(text)
            if data is not None:
                tmp: Any = normalize_recs(data, query=query)
            else:
                tmp = _extract_markdown_list(text) or {"raw": text}

            if isinstance(tmp, dict) and tmp.get("recommendations"):
                return complete_recommendations(
                    tmp,
                    query=query,
                    candidates=candidates,
                )

        return self._fallback_from_candidates(candidates)


# --- Back-compat: 旧呼び出し向け shim ------------------------------------


def chat_to_plan(
    message: str,
    candidates: List[Dict[str, Any]] | None = None,
    *args: Any,
    **kwargs: Any,
) -> Dict[str, Any]:
    if candidates is None:
        raw_cands = kwargs.get("candidates")
        candidates = raw_cands if isinstance(raw_cands, list) else []
    area = kwargs.get("area") or ""

    try:
        orch = ConciergeOrchestrator()
        out = orch.suggest(query=message, candidates=candidates or [])
    except Exception:
        out = {}

    recs: List[Dict[str, Any]] = []
    if isinstance(out, dict):
        raw_recs = out.get("recommendations") or []
        if isinstance(raw_recs, list):
            for r in raw_recs:
                if isinstance(r, dict):
                    recs.append(r)

    if not recs:
        for i, c in enumerate(candidates or []):
            name = c.get("name") or c.get("place_id") or "unknown"
            recs.append(
                {
                    "name": name,
                    "reason": "暫定（候補ベース）",
                    "score": max(0.0, 1.0 - i * 0.1),
                }
            )

    if not recs:
        recs = [{"name": "近隣の神社", "reason": "暫定"}]

    if area:
        try:
            from .backfill import _shorten_japanese_address as _S

            short = _S(area)
        except Exception:
            short = area
        if recs:
            rec0 = dict(recs[0])
            rec0["location"] = short
            recs[0] = rec0

    return {"recommendations": recs}




def _extract_json(text: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(text, str):
        return None
    m = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    m = re.search(r"(\{[\s\S]*\})", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    return None


def _extract_markdown_list(text: str) -> Optional[Dict[str, Any]]:
    items: List[Dict[str, str]] = []
    lines = [line.rstrip() for line in text.splitlines()]
    for line in lines:
        s = line.strip()
        if not s:
            continue
        m = re.match(r"^(?:[-*+]|\d+[\).])\s*\*\*(.+?)\*\*\s*(.+)?$", s)
        if m:
            name = (m.group(1) or "").strip()
            reason = (m.group(2) or "").strip(" ・-—:\u3000")
            if name:
                items.append({"name": name, "reason": reason})
    if not items:
        for i, line in enumerate(lines[:-1]):
            m = re.match(r"^(?:[-*+]|\d+[\).])\s*\*\*(.+?)\*\*\s*$", line.strip())
            if m:
                name = (m.group(1) or "").strip()
                reason = lines[i + 1].strip()
                if name:
                    items.append({"name": name, "reason": reason})
    if not items:
        return None
    return {
        "recommendations": [
            {"name": it["name"], "location": "", "reason": it.get("reason", "")}
            for it in items[:3]
        ]
    }


# ---- v2: 位置情報を含む Plan 形式（/api/concierge/plan 用） ----


def _round_coord(v: Optional[float], ndigits: int) -> Optional[float]:
    if v is None:
        return None
    try:
        return round(float(v), ndigits)
    except Exception:
        return None


def _build_user_prompt_for_plan(
    query: str,
    lat: Optional[float],
    lng: Optional[float],
    transport: Optional[str],
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
    cfg = LLMConfig.load()
    lat = _round_coord(lat, cfg.coord_round)
    lng = _round_coord(lng, cfg.coord_round)

    user_prompt = _build_user_prompt_for_plan(query, lat, lng, transport)

    schema: Dict[str, Any] = {
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

    last_err: Optional[Exception] = None
    try:
        oai = make_openai_client(cfg)
    except Exception as e:  # pragma: no cover
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
            spots_raw = data.get("spots") or []
            spots: List[Dict[str, Any]] = [
                {
                    "name": (s.get("name") or "").strip(),
                    "place_id": s.get("place_id"),
                    "lat": s.get("lat"),
                    "lng": s.get("lng"),
                    "reason": s.get("reason"),
                }
                for s in spots_raw
                if isinstance(s, dict) and s.get("name")
            ]
            recs: List[Dict[str, Any]] = [
                {
                    "name": s["name"],
                    "reason": s.get("reason", ""),
                    "place_id": s.get("place_id"),
                    "lat": s.get("lat"),
                    "lng": s.get("lng"),
                }
                for s in spots
            ]
            return {
                "summary": data.get("summary", ""),
                "spots": spots,
                "recommendations": recs[:3],
            }
        except Exception as e:  # pragma: no cover
            last_err = e
            time.sleep(cfg.backoff_s)

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
