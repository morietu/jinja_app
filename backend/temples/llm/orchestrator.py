from typing import Any, Dict, List
from .client import LLMClient

class ConciergeOrchestrator:
    """A very small coordinator that formats prompts and handles fallbacks."""
    def __init__(self, client: LLMClient = None):
        self.client = client or LLMClient()

    def suggest(self, query: str, candidates: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        candidates = candidates or []
        sys_msg = "You are a shrine concierge. Return concise JSON-like summaries."
        messages = [
            {"role": "system", "content": sys_msg},
            {"role": "user", "content": f"Query: {query}\nCandidates: {candidates}"},
        ]
        msg = self.client.chat(messages)
        if isinstance(msg, dict) and msg.get("content"):
            return {"raw": msg["content"]}
        # Fallback: rank given order with simple decreasing score.
        recs = []
        for i, c in enumerate(candidates):
            name = c.get("name") or c.get("place_id") or "unknown"
            recs.append({"name": name, "reason": "暫定（順序ベース）", "score": max(0.0, 1.0 - i * 0.1)})
        return {"recommendations": recs}
