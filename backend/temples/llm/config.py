# backend/temples/llm/config.py
from __future__ import annotations

import os
from dataclasses import dataclass


def _getenv(key: str, default: str | None = None) -> str | None:
    val = os.getenv(key, default)
    return val if val not in ("", None) else default


def _truthy(v: str | None) -> bool:
    if v is None:
        return False
    return str(v).lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class LLMConfig:
    api_key: str
    model: str
    temperature: float
    max_tokens: int
    base_url: str | None
    force_chat: bool
    force_json: bool
    retries: int
    backoff_s: float
    coord_round: int

    def validate(self) -> "LLMConfig":
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        return self

    @classmethod
    def load(cls) -> "LLMConfig":
        # モデル名は LLM_MODEL を第一優先、なければ OPENAI_MODEL を後方互換で参照
        model = _getenv("LLM_MODEL") or _getenv("OPENAI_MODEL") or "gpt-4o-mini"
        return cls(
            api_key=_getenv("OPENAI_API_KEY", "") or "",
            model=model,
            temperature=float(_getenv("LLM_TEMPERATURE", "0.3")),
            max_tokens=int(_getenv("LLM_MAX_TOKENS", "512")),
            base_url=_getenv("LLM_BASE_URL", None),
            force_chat=_truthy(_getenv("LLM_FORCE_CHAT", "0")),
            force_json=_truthy(_getenv("LLM_FORCE_JSON", "1")),
            retries=int(_getenv("LLM_RETRIES", "2")),
            backoff_s=float(_getenv("LLM_BACKOFF_S", "0.5")),
            coord_round=int(_getenv("LLM_COORD_ROUND", "3")),
        ).validate()
