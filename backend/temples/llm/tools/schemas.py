# backend/temples/llm/tools/schemas.py
from __future__ import annotations

"""
Back-compat shim: temples.llm.tools.schemas -> temples.llm.schemas

旧コードからのインポート:

    from temples.llm.tools.schemas import CONCIERGE_PLAN

を、新しい:

    from temples.llm import schemas

へバイパスするための薄いラッパ。
"""

from typing import Any, Dict

from temples.llm import schemas as _schemas

JsonSchema = Dict[str, Any]

# mypy が "attr-defined" を出さないように getattr でフォールバック
CONCIERGE_PLAN: JsonSchema = getattr(_schemas, "CONCIERGE_PLAN", {})
