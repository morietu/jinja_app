# temples/llm/tools/prompts.py
from __future__ import annotations

"""
Back-compat shim:
    temples.llm.tools.prompts -> temples.llm.prompts
"""

from temples.llm.prompts import SYSTEM_PROMPT

__all__ = ["SYSTEM_PROMPT"]
