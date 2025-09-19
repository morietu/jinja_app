from dataclasses import dataclass
import os

@dataclass
class LLMConfig:
    api_key: str = os.getenv("OPENAI_API_KEY", "")
    model: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.3"))
    max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "512"))
    base_url: str = os.getenv("LLM_BASE_URL") or ""

    def validate(self):
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        return self
