# backend/temples/llm/client.py
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from django.conf import settings

from .config import OPENAI_API_KEY, LLMConfig

# LLM呼べない環境（TESTINGなど）で返すプレースホルダー
PLACEHOLDER = {
    "role": "assistant",
    "content": "(LLM disabled or error: returning placeholder)",
}


class DummyLLMClient:
    """テスト用のダミークライアント。呼ばれたら分かるように例外を出す。"""

    def __getattr__(self, name):
        raise RuntimeError("LLM disabled in tests (DummyLLMClient accessed)")


def make_openai_client(
    cfg: Optional[LLMConfig] = None, base_url: Optional[str] = None, api_key: Optional[str] = None
) -> Any:
    """
    OpenAI v1 SDK クライアントを生成（lazy import）。
    - TESTING=1 のとき：外部呼び出しを避けるため Dummy を返す
    - それ以外：openai>=1.0,<2 が必要
    """
    if getattr(settings, "TESTING", False):
        return DummyLLMClient()

    # lazy import（モジュール読み込み時の ImportError を避ける）
    try:
        from openai import OpenAI
    except Exception as e:
        raise ImportError(
            "OpenAI Python SDK v1 is required. Install with: pip install 'openai>=1.0,<2'"
        ) from e

    cfg = cfg or LLMConfig.load()
    api_key = api_key or cfg.api_key or os.getenv("OPENAI_API_KEY") or OPENAI_API_KEY
    base_url = base_url or cfg.base_url

    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)


class LLMClient:
    """
    - OpenAI v1 の Responses API を優先（なければ chat.completions）
    - 失敗時は PLACEHOLDER を返す
    """

    def __init__(self, cfg: Optional[LLMConfig] = None):
        self.cfg = cfg or LLMConfig.load()
        try:
            self._client = make_openai_client(self.cfg)
            # Responses API 優先
            if getattr(self._client, "responses", None) and not self.cfg.force_chat:
                self._mode = "responses"
            elif getattr(self._client, "chat", None) and getattr(
                self._client.chat, "completions", None
            ):
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
                resp = self._client.responses.create(**kwargs)  # type: ignore
                content = getattr(resp, "output_text", None)
                if not content:
                    try:
                        content = resp.output[0].content[0].text  # type: ignore
                    except Exception:
                        content = str(resp)
                return {"role": "assistant", "content": content}

            # Chat Completions
            resp = self._client.chat.completions.create(
                model=self.cfg.model,
                messages=messages,
                temperature=self.cfg.temperature,
                max_tokens=self.cfg.max_tokens,
            )  # type: ignore
            text = resp.choices[0].message.content  # type: ignore
            return {"role": "assistant", "content": text}
        except Exception:
            return PLACEHOLDER
