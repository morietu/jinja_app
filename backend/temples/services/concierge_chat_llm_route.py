from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from django.conf import settings

from temples.services.concierge_chat_pool import _seed_recs_from_candidates
from temples.services.concierge_chat_ranking import _prefilter_candidates_for_need

log = logging.getLogger(__name__)


def resolve_llm_route(
    *,
    query: str,
    valid_candidates: List[Dict[str, Any]],
    need_tags: List[str],
    llm_enabled: bool,
) -> Dict[str, Any]:
    """
    LLM 利用可否を判定し、recommendations の初期 recs を返す。

    戻り値:
      {
        "recs": Dict[str, Any],
        "requested_llm_enabled": bool,
        "effective_llm_enabled": bool,
        "llm_used": bool,
        "llm_error": Optional[str],
      }
    """
    requested_llm_enabled = bool(llm_enabled)
    effective_llm_enabled = bool(
        requested_llm_enabled and getattr(settings, "CONCIERGE_USE_LLM", False)
    )

    llm_used = False
    llm_error: Optional[str] = None

    if effective_llm_enabled:
        try:
            from temples.llm import orchestrator as orch_mod  # type: ignore

            llm_used = True
            recs = orch_mod.ConciergeOrchestrator().suggest(
                query=query,
                candidates=valid_candidates,
            )
        except Exception as e:
            llm_error = f"{type(e).__name__}: {e}"
            log.exception("[resolve_llm_route] LLM exception traceback")

            prefiltered = _prefilter_candidates_for_need(
                valid_candidates,
                need_tags=need_tags,
            )
            recs = _seed_recs_from_candidates(prefiltered, size=12)
    else:
        prefiltered = _prefilter_candidates_for_need(
            valid_candidates,
            need_tags=need_tags,
        )
        recs = _seed_recs_from_candidates(prefiltered, size=12)

    return {
        "recs": recs,
        "requested_llm_enabled": requested_llm_enabled,
        "effective_llm_enabled": effective_llm_enabled,
        "llm_used": llm_used,
        "llm_error": llm_error,
    }


__all__ = [
    "resolve_llm_route",
]
