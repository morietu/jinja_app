# backend/temples/llm/config.py
from __future__ import annotations

import os
from dataclasses import dataclass



OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.2"))

def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default

def _get_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


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
    def load(cls, *, validate: bool = True) -> "LLMConfig":
        ...
        cfg = cls(
            api_key=_getenv("OPENAI_API_KEY", "") or "",
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            base_url=_getenv("LLM_BASE_URL", None),
            force_chat=_truthy(_getenv("LLM_FORCE_CHAT", "0")),
            force_json=_truthy(_getenv("LLM_FORCE_JSON", "1")),
            retries=retries,
            backoff_s=backoff_s,
            coord_round=coord_round,
        )
        return cfg.validate() if validate else cfg
