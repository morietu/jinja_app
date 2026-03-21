from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from django.conf import settings as dj_settings

from temples.services.concierge_candidate_utils import _normalize_candidate_fields
from temples.services.concierge_chat_extra_condition import (
    resolve_extra_condition_tags,
)
from temples.services.concierge_chat_llm_route import (
    resolve_llm_route,
)
from temples.services.concierge_chat_need import (
    resolve_need_payload,
)
from temples.services.concierge_chat_pool import (
    _ensure_pool_size,
    _merge_candidate_fields,
)
from temples.services.concierge_chat_presentation import (
    _fill_location_from_existing_address,
    _backfill_location_from_name,
    _apply_soft_signal_highlights,
    _attach_reason_source,
    _trim_to_top3_and_fill_message,
)
from temples.services.concierge_chat_ranking import (
    _attach_breakdown,
    _diversify_by_need,
    _resolve_mode_weights,
    build_recommendation_reason,
)
from temples.services.concierge_chat_response_meta import (
    attach_response_meta,
)
from temples.services.concierge_explanation_payload import (
    attach_explanation_payload,
)
from temples.services.concierge_explanations import (
    attach_explanations_for_chat,
)

log = logging.getLogger(__name__)


def _resolve_astro_profile(
    birthdate: Optional[str],
) -> Any:
    if not birthdate:
        return None

    try:
        from temples.domain.astrology import sun_sign_and_element  # type: ignore
        return sun_sign_and_element(birthdate)
    except Exception:
        return None

def _attach_chat_rec_enrichment(
    recs: Dict[str, Any],
    *,
    public_mode: str,
    birthdate: Optional[str],
    need_tags: List[str],
    weights: Dict[str, float],
    astro_bonus_enabled: bool,
    soft_signal_tags: set[str],
) -> Dict[str, Any]:
    for rec in recs.get("recommendations") or []:
        if not isinstance(rec, dict):
            continue

        _attach_breakdown(
            rec,
            birthdate=birthdate,
            need_tags=need_tags,
            weights=weights,
            astro_bonus_enabled=astro_bonus_enabled,
        )
        _apply_soft_signal_highlights(
            rec,
            soft_signal_tags=soft_signal_tags,
        )
        rec["reason"] = build_recommendation_reason(
            rec,
            public_mode=public_mode,  # type: ignore[arg-type]
            birthdate=birthdate,
            need_tags=need_tags,
        )
        _attach_reason_source(
            rec,
            public_mode=public_mode,
        )

    return recs


def _sort_chat_recommendations(
    recs: Dict[str, Any],
    *,
    sort_tags: set[str],
) -> Dict[str, Any]:
    recommendations = [
        r for r in (recs.get("recommendations") or [])
        if isinstance(r, dict)
    ]

    distance_mode = "sort_distance" in sort_tags

    if distance_mode:
        recommendations = sorted(
            recommendations,
            key=lambda r: (
                float(r.get("distance_m") or 1e12),
                -float(r.get("_score_total") or 0),
                str(r.get("name") or ""),
            ),
        )
    else:
        recommendations = sorted(
            recommendations,
            key=lambda r: (
                -float(r.get("_score_total") or 0),
                float(r.get("distance_m") or 1e12),
                str(r.get("name") or ""),
            ),
        )
        recommendations = _diversify_by_need(
            recommendations,
            limit=3,
        )

    recs["recommendations"] = recommendations
    return recs


def _attach_astro_meta(
    recs: Dict[str, Any],
    *,
    astro_profile: Any,
) -> Dict[str, Any]:
    if not astro_profile:
        return recs

    recs["_astro"] = {
        "sun_sign": getattr(astro_profile, "sign", None),
        "element": getattr(astro_profile, "element", None),
        "picked": [
            r.get("name")
            for r in (recs.get("recommendations") or [])
            if isinstance(r, dict) and r.get("name")
        ],
        "matched_count": sum(
            1
            for r in (recs.get("recommendations") or [])
            if isinstance(r, dict)
            and int(r.get("breakdown", {}).get("score_element", 0)) >= 2
        ),
    }
    return recs


def build_chat_recommendations(
    *,
    query: str,
    language: str,
    candidates: List[Dict[str, Any]],
    bias: Optional[Dict[str, Any]],
    birthdate: Optional[str],
    goriyaku_tag_ids: Optional[List[int]],
    extra_condition: Optional[str],
    public_mode: str,
    flow: str,
) -> Dict[str, Any]:
    """
    候補リストからおすすめ神社を選んで返す関数。

    facade はこのファイルに残し、
    ranking / pool / presentation の責務は各モジュールへ分離する。
    """
    valid_candidates = [
        _normalize_candidate_fields(c)
        for c in (candidates or [])
        if isinstance(c, dict)
    ]

    need_payload = resolve_need_payload(
        query=query or "",
        need_tags=[],
        max_tags=3,
    )
    need_tags = need_payload["tags"]

    log.info(
        "[dbg] need_tags query=%r tags=%r language=%r flow=%r mode=%r extra=%r goriyaku=%r",
        (query or "")[:60],
        need_tags,
        language,
        flow,
        public_mode,
        extra_condition,
        goriyaku_tag_ids,
    )

    astro_profile = _resolve_astro_profile(birthdate)

    extra_tags = resolve_extra_condition_tags(extra_condition)
    sort_tags = extra_tags["sort_tags"]
    hard_filter_tags = extra_tags["hard_filter_tags"]
    soft_signal_tags = extra_tags["soft_signal_tags"]

    weights = _resolve_mode_weights(
        public_mode=public_mode,  # type: ignore[arg-type]
        flow=flow,
        weights=None,
    )

    astro_bonus_enabled = public_mode == "compat"
    llm_enabled = bool(getattr(dj_settings, "CONCIERGE_USE_LLM", False))

    route = resolve_llm_route(
        query=query or "",
        valid_candidates=valid_candidates,
        need_tags=need_tags,
        llm_enabled=llm_enabled,
    )

    recs = route["recs"]
    requested_llm_enabled = bool(route["requested_llm_enabled"])
    effective_llm_enabled = bool(route["effective_llm_enabled"])
    llm_used = bool(route["llm_used"])
    llm_error = route["llm_error"]

    if llm_error:
        log.exception("[build_chat_recommendations] LLM exception traceback")

    log.info(
        "[dbg] route llm_requested=%r llm_effective=%r llm_used=%r seed=%r candidate_count=%d",
        requested_llm_enabled,
        effective_llm_enabled,
        llm_used,
        bool(recs.get("_seed")) if isinstance(recs, dict) else None,
        len(valid_candidates),
    )

    recs = _ensure_pool_size(
        recs,
        candidates=valid_candidates,
        size=12,
    )
    recs = _merge_candidate_fields(
        recs,
        candidates=valid_candidates,
    )

    log.info(
        "[dbg] pool_after_merge size=%d top_names=%r",
        len(recs.get("recommendations") or []),
        [
            r.get("name")
            for r in (recs.get("recommendations") or [])[:5]
            if isinstance(r, dict)
        ],
    )

    recs = _attach_chat_rec_enrichment(
        recs,
        public_mode=public_mode,
        birthdate=birthdate,
        need_tags=need_tags,
        weights=weights,
        astro_bonus_enabled=astro_bonus_enabled,
        soft_signal_tags=soft_signal_tags,
    )

    recs = attach_explanation_payload(recs)

    try:
        log.info(
            "[dbg] explanation_payload_after=%r",
            [
                {
                    "shrine_id": r.get("shrine_id"),
                    "name": r.get("name"),
                    "breakdown_matched_need_tags": (r.get("breakdown") or {}).get("matched_need_tags"),
                    "breakdown_score_need": (r.get("breakdown") or {}).get("score_need"),
                    "explanation_payload": r.get("_explanation_payload"),
                }
                for r in (recs.get("recommendations") or [])
                if isinstance(r, dict)
            ],
        )
    except Exception:
        pass

    recs = _sort_chat_recommendations(
        recs,
        sort_tags=sort_tags,
    )

    _fill_location_from_existing_address(recs)
    _backfill_location_from_name(
        recs,
        bias=bias,
        language=language,
    )
    _trim_to_top3_and_fill_message(recs)

    try:
        log.info(
            "[dbg] scored_pool=%r",
            [
                {
                    "name": r.get("name"),
                    "distance_m": r.get("distance_m"),
                    "score_total": r.get("_score_total"),
                    "score_need": (r.get("breakdown") or {}).get("score_need"),
                    "matched_need_tags": (r.get("breakdown") or {}).get("matched_need_tags"),
                    "goriyaku": r.get("goriyaku"),
                    "reason": r.get("reason"),
                }
                for r in (recs.get("recommendations") or [])
                if isinstance(r, dict)
            ],
        )
    except Exception:
        pass

    if llm_error:
        log.warning("[build_chat_recommendations] LLM error: %s", llm_error)

    recs = _attach_astro_meta(
        recs,
        astro_profile=astro_profile,
    )

    recs["_need"] = need_payload

    recs = attach_response_meta(
        recs,
        public_mode=public_mode,
        flow=flow,
        weights=weights,
        astro_bonus_enabled=astro_bonus_enabled,
        effective_llm_enabled=effective_llm_enabled,
        llm_used=llm_used,
        llm_error=llm_error,
        valid_candidates=valid_candidates,
        extra_condition=extra_condition,
        goriyaku_tag_ids=goriyaku_tag_ids,
        hard_filter_tags=hard_filter_tags,
    )

    recs = attach_explanations_for_chat(
        recs,
        query=query or "",
        bias=bias,
        birthdate=birthdate,
        extra_condition=extra_condition,
    )

    return recs
