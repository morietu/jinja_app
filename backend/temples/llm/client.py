from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from django.conf import settings
from .config import LLMConfig

# LLM呼べない環境（TESTINGなど）で返すプレースホルダー
PLACEHOLDER: Dict[str, str] = {
    "role": "assistant",
    "content": "(LLM disabled or error: returning placeholder)",
}

class DummyLLMClient:
    """
    LLM無効時の安全な置物。
    - getattr(..., "chat", None) などの存在確認で落ちない
    - 実際の呼び出し経路には入らない（_mode=None になる想定）
    """
    responses = None
    chat = None

    # もし「呼ばれたら即落ち」を明示したいなら、下の2行を有効化
    # responses = _Responses()
    # chat = _Chat()

def make_openai_client(
    cfg: Optional[LLMConfig] = None,
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Any:
    """
    OpenAI v1 SDK クライアントを生成（lazy import）。
    - LLM disabled / TESTING / SDKなし / APIキーなし → Dummy を返す（落とさない）
    """
    if not getattr(settings, "CONCIERGE_USE_LLM", False):
        return DummyLLMClient()

    if getattr(settings, "TESTING", False):
        return DummyLLMClient()

    cfg = cfg or LLMConfig.load(validate=False)
    api_key = api_key or cfg.api_key or os.getenv("OPENAI_API_KEY")
    base_url = base_url or cfg.base_url

    if not api_key:
        return DummyLLMClient()

    try:
        from openai import OpenAI
    except Exception:
        return DummyLLMClient()

    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)


class LLMClient:
    def __init__(self, cfg: Optional[LLMConfig] = None) -> None:
        # ✅ ここが重要：LLM無効時に validate で死なない
        self.cfg: LLMConfig = cfg or LLMConfig.load(validate=False)

        self._client: Any | None
        self._mode: str | None

        try:
            self._client = make_openai_client(self.cfg)

            # Dummy ならモード無しでOK
            if getattr(self._client, "responses", None) and not self.cfg.force_chat:
                self._mode = "responses"
            elif getattr(self._client, "chat", None) and getattr(self._client.chat, "completions", None):
                self._mode = "chat"
            else:
                self._mode = None
        except Exception:
            self._client = None
            self._mode = None

    def _to_input_text(self, messages: List[Dict[str, Any]]) -> str:
        # system/user/assistant を直列化（Responses APIの文字列入力用）
        lines: List[str] = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                lines.append(f"[system] {content}")
            elif role == "user":
                lines.append(str(content))
            else:
                lines.append(f"[{role}] {content}")
        return "\n".join(lines)

    def chat(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        if self._client is None or self._mode is None:
            return PLACEHOLDER

        try:
            if self._mode == "responses" and not self.cfg.force_chat:
                # Responses API
                kwargs: Dict[str, Any] = {
                    "model": self.cfg.model,
                    "temperature": self.cfg.temperature,
                    "max_output_tokens": self.cfg.max_tokens,
                    "input": self._to_input_text(messages),
                }
                if self.cfg.force_json:
                    kwargs["response_format"] = {"type": "json_object"}
                resp: Any = self._client.responses.create(**kwargs)
                content = getattr(resp, "output_text", None)
                if not content:
                    try:
                        content = resp.output[0].content[0].text
                    except Exception:
                        content = str(resp)
                return {"role": "assistant", "content": str(content)}

            # Chat Completions
            resp = self._client.chat.completions.create(
                model=self.cfg.model,
                messages=messages,
                temperature=self.cfg.temperature,
                max_tokens=self.cfg.max_tokens,
            )
            text = resp.choices[0].message.content
            return {"role": "assistant", "content": str(text)}
        except Exception:
            return PLACEHOLDER
