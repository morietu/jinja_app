import json
import re
from typing import Any, Dict, List

from .client import LLMClient
from .prompts import SYSTEM_PROMPT
from .schemas import complete_recommendations, normalize_recs


def _extract_json(text: str):
    if not isinstance(text, str):
        return None
    # ```json {...} ``` または ``` {...} ``` を優先して抜く
    m = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # テキスト内の最初の { ... } を試す（浅い）
    m = re.search(r"(\{[\s\S]*\})", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    return None


def _extract_markdown_list(text: str):
    """
    1. **神社名**  改行   理由...
    2) **神社名** 理由...
    などの箇条書きから {name, reason} を抽出。location は空にして normalize 側で維持。
    """
    import re

    items = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        # "1. **赤坂氷川神社**  理由..." / "- **赤坂氷川神社** 理由..."
        m = re.match(r"^(?:[-*+]|\d+[\).])\s*\*\*(.+?)\*\*\s*(.+)?$", line)
        if m:
            name = m.group(1).strip()
            reason = (m.group(2) or "").strip(" ・-—:　")
            if name:
                items.append({"name": name, "reason": reason})
    # タイトル行 → 次行理由 みたいなパターンにも対応（簡易）
    if not items:
        lines = [l.rstrip() for l in text.splitlines() if l.strip()]
        for i, l in enumerate(lines[:-1]):
            m = re.match(r"^(?:[-*+]|\d+[\).])\s*\*\*(.+?)\*\*\s*$", l)
            if m:
                name = m.group(1).strip()
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
    """A very small coordinator that formats prompts and handles fallbacks."""

    def __init__(self, client: LLMClient = None):
        self.client = client or LLMClient()

    def suggest(self, query: str, candidates: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        candidates = candidates or []
        sys_msg = SYSTEM_PROMPT
        messages = [
            {"role": "system", "content": sys_msg},
            {"role": "user", "content": f"Query: {query}\nCandidates: {candidates}"},
        ]
        msg = self.client.chat(messages)
        if isinstance(msg, dict) and msg.get("content"):
            data = _extract_json(msg["content"])
            tmp = (
                normalize_recs(data, query=query)
                if data is not None
                else (_extract_markdown_list(msg["content"]) or {"raw": msg["content"]})
            )
            return (
                complete_recommendations(tmp, query=query, candidates=candidates)
                if isinstance(tmp, dict) and "recommendations" in tmp
                else tmp
            )
        # Fallback: rank given order with simple decreasing score.
        recs = []
        for i, c in enumerate(candidates):
            name = c.get("name") or c.get("place_id") or "unknown"
            recs.append(
                {
                    "name": name,
                    "reason": "暫定（順序ベース）",
                    "score": max(0.0, 1.0 - i * 0.1),
                }
            )
        return {"recommendations": recs}


def chat_to_plan(query, candidates=None):
    """
    Back-compat function expected by older api_views.py.
    Delegates to ConciergeOrchestrator.suggest().
    """
    return ConciergeOrchestrator().suggest(query=query, candidates=candidates or [])

    from .tools.orchestrator import chat_to_plan as _legacy_chat_to_plan

    return _legacy_chat_to_plan(message, lat, lng, transport)
