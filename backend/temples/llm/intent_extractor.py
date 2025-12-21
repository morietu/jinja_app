from __future__ import annotations

import json
from typing import Any, Dict

from .client import LLMClient, PLACEHOLDER
from .intent_prompt import INTENT_SYSTEM_PROMPT
from .intent_schema import DEFAULT_INTENT, normalize_intent


def _extract_first_json_object(text: str) -> Any:
    """
    想定外の混入（前置き等）があった場合でも最初の {...} を拾う簡易抽出。
    force_json=1 が効けば基本は json.loads(text) が通るはず。
    """
    text = (text or "").strip()
    if not text:
        raise ValueError("empty")

    try:
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError("no json object found")


def extract_intent(user_text: str) -> Dict[str, Any]:
    user_text = (user_text or "").strip()
    if not user_text:
        return dict(DEFAULT_INTENT)

    try:
        llm = LLMClient()
        msg = llm.chat(
            [
                {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_text},
            ]
        )
    except Exception:
        # OPENAI_API_KEY 未設定、SDK未導入、接続失敗などは全部ここで吸収
        return dict(DEFAULT_INTENT)

    if not isinstance(msg, dict):
        return dict(DEFAULT_INTENT)
    if msg == PLACEHOLDER:
        return dict(DEFAULT_INTENT)

    content = (msg.get("content") or "").strip()
    if not content:
        return dict(DEFAULT_INTENT)

    try:
        obj = _extract_first_json_object(content)
        return normalize_intent(obj)
    except Exception:
        return dict(DEFAULT_INTENT)
