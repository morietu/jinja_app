from typing import Any, List, Dict
from .config import LLMConfig

class LLMClient:
    """Thin wrapper around OpenAI client with a graceful local fallback."""
    def __init__(self, cfg: LLMConfig = None):
        self.cfg = (cfg or LLMConfig())
        try:
            from openai import OpenAI  # type: ignore
        except Exception:
            OpenAI = None  # type: ignore
        self._OpenAI = OpenAI
        self._client = None
        if OpenAI is not None and self.cfg.api_key:
            kwargs = {"api_key": self.cfg.api_key}
            if self.cfg.base_url:
                kwargs["base_url"] = self.cfg.base_url
            self._client = OpenAI(**kwargs)

    def chat(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        if self._client is None:
            return {"role": "assistant", "content": "(LLM disabled locally: returning placeholder)"}  # type: ignore
        resp = self._client.chat.completions.create(
            model=self.cfg.model,
            messages=messages,
            temperature=self.cfg.temperature,
            max_tokens=self.cfg.max_tokens,
        )
        return {"role": resp.choices[0].message.role, "content": resp.choices[0].message.content}
