from typing import Any, List, Dict
from .config import LLMConfig
PLACEHOLDER = {"role": "assistant", "content": "(LLM disabled or error: returning placeholder)"}
class LLMClient:
    def __init__(self, cfg: LLMConfig = None):
        self.cfg = (cfg or LLMConfig())
        try:
            from openai import OpenAI  # type: ignore
        except Exception:
            OpenAI = None  # type: ignore
        self._client = None
        self._mode = None
        if OpenAI is not None and self.cfg.api_key:
            kw = {"api_key": self.cfg.api_key}
            if self.cfg.base_url: kw["base_url"] = self.cfg.base_url
            c = OpenAI(**kw)
            self._mode = "responses" if getattr(c, "responses", None) else ("chat" if getattr(c, "chat", None) and getattr(c.chat, "completions", None) else None)
            self._client = c
    def _to_input_text(self, messages: List[Dict[str, Any]]) -> str:
        parts=[]; 
        for m in messages:
            role=m.get("role","user"); content=m.get("content","")
            parts.append(f"[{role}] {content}" if role not in ("system","user") else (f"[system] {content}" if role=="system" else content))
        return "\n".join(parts)
    def chat(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        if self._client is None or self._mode is None: return PLACEHOLDER
        try:
            if self._mode=="responses":
                resp=self._client.responses.create(model=self.cfg.model, input=self._to_input_text(messages),
                                                   temperature=self.cfg.temperature, max_output_tokens=self.cfg.max_tokens)  # type: ignore
                content=getattr(resp,"output_text",None)
                if not content:
                    try: content = resp.output[0].content[0].text  # type: ignore
                    except Exception: content = str(resp)
                return {"role":"assistant","content":content}
            resp=self._client.chat.completions.create(model=self.cfg.model, messages=messages,
                                                      temperature=self.cfg.temperature, max_tokens=self.cfg.max_tokens)  # type: ignore
            return {"role":"assistant","content":resp.choices[0].message.content}  # type: ignore
        except Exception:
            return PLACEHOLDER
