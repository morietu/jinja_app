from __future__ import annotations

from typing import Any, Dict, List, Literal

Tone = Literal["soft", "neutral", "strong"]

INTENT_KEYS = ["goriyaku", "tone", "atmosphere", "avoid", "summary"]

DEFAULT_INTENT: Dict[str, Any] = {
    "goriyaku": [],
    "tone": "neutral",
    "atmosphere": [],
    "avoid": [],
    "summary": "",
}


def normalize_intent(obj: Any) -> Dict[str, Any]:
    """
    LLM出力を固定shapeに正規化（余計なキーは落とす / 型崩れを補正）
    """
    out: Dict[str, Any] = dict(DEFAULT_INTENT)

    if not isinstance(obj, dict):
        return out

    for k in INTENT_KEYS:
        if k in obj:
            out[k] = obj[k]

    if not isinstance(out["goriyaku"], list):
        out["goriyaku"] = []
    if out["tone"] not in ("soft", "neutral", "strong"):
        out["tone"] = "neutral"
    if not isinstance(out["atmosphere"], list):
        out["atmosphere"] = []
    if not isinstance(out["avoid"], list):
        out["avoid"] = []
    if not isinstance(out["summary"], str):
        out["summary"] = ""

    # listはstrに寄せる
    out["goriyaku"] = [str(x).strip() for x in out["goriyaku"] if str(x).strip()]
    out["atmosphere"] = [str(x).strip() for x in out["atmosphere"] if str(x).strip()]
    out["avoid"] = [str(x).strip() for x in out["avoid"] if str(x).strip()]

    out["summary"] = out["summary"][:120]
    return out
