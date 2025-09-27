# backend/temples/llm/client.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from openai import OpenAI

from .config import OPENAI_API_KEY, LLMConfig

PLACEHOLDER = {
    "role": "assistant",
    "content": "(LLM disabled or error: returning placeholder)",
}


def get_client() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY)


def make_openai_client(cfg: LLMConfig):
    """OpenAI v1 SDK クライアントを生成。base_url にも対応。"""
    from openai import OpenAI  # lazy import

    if cfg.base_url:
        return OpenAI(api_key=cfg.api_key, base_url=cfg.base_url)
    return OpenAI(api_key=cfg.api_key)


class LLMClient:
    """
    - OpenAI v1 の Responses API を優先使用（存在しなければ chat.completions）
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
        # system/user/assistant をテキストに直列化（Responses APIに単一テキストで渡すfallback）
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
                # JSON出力を（可能なら）強制
                if self.cfg.force_json:
                    kwargs["response_format"] = {"type": "json_object"}
                resp = self._client.responses.create(**kwargs)  # type: ignore
                content = getattr(resp, "output_text", None)
                if not content:
                    try:
                        # 念のため深掘り
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
