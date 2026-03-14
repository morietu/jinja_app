from __future__ import annotations

from typing import Any, Dict, List, Optional

from temples.services.concierge_chat_ranking import _resolve_mode_meta


def build_result_state(
    *,
    recommendations: List[Dict[str, Any]],
    extra_condition: Optional[str],
    goriyaku_tag_ids: Optional[List[int]],
    hard_filter_tags: set[str],
) -> Dict[str, Any]:
    displayed_count = len(
        [r for r in (recommendations or []) if isinstance(r, dict)]
    )

    requested_extra = (extra_condition or "").strip() or None
    requested_goriyaku = bool(goriyaku_tag_ids)
    requested_hard_filter = bool(hard_filter_tags)

    fallback_mode = "none"
    fallback_reason_ja = None
    ui_disclaimer_ja = None
    matched_count = displayed_count

    if requested_goriyaku or requested_hard_filter:
        fallback_mode = "nearby_unfiltered"
        fallback_reason_ja = "条件に一致する神社が見つかりませんでした（0件）"
        ui_disclaimer_ja = "代わりに近い神社を表示しています（条件は反映されていません）"
        matched_count = 0

    return {
        "matched_count": matched_count,
        "pool_count": displayed_count,
        "displayed_count": displayed_count,
        "fallback_mode": fallback_mode,
        "fallback_reason_ja": fallback_reason_ja,
        "ui_disclaimer_ja": ui_disclaimer_ja,
        "requested_extra_condition": requested_extra,
    }


def build_stats(
    *,
    valid_candidates: List[Dict[str, Any]],
    recommendations: List[Dict[str, Any]],
) -> Dict[str, Any]:
    displayed_count = len(
        [r for r in (recommendations or []) if isinstance(r, dict)]
    )

    total = len(valid_candidates)

    missing_place_id = sum(1 for c in valid_candidates if not c.get("place_id"))
    missing_latlng = sum(
        1 for c in valid_candidates
        if c.get("lat") is None or c.get("lng") is None
    )
    missing_address = sum(
        1 for c in valid_candidates
        if not (c.get("formatted_address") or c.get("address"))
    )

    return {
        "candidate_count": total,
        "valid_candidate_count": total,
        "pool_count": displayed_count,
        "displayed_count": displayed_count,
        "missing_fields": {
            "total": total,
            "place_id": {
                "missing": missing_place_id,
                "rate": (missing_place_id / total) if total else 0.0,
            },
            "latlng": {
                "missing": missing_latlng,
                "rate": (missing_latlng / total) if total else 0.0,
            },
            "address": {
                "missing": missing_address,
                "rate": (missing_address / total) if total else 0.0,
            },
        },
    }


def build_signals(
    *,
    flow: str,
    weights: Dict[str, float],
    astro_bonus_enabled: bool,
    effective_llm_enabled: bool,
    llm_used: bool,
    llm_error: Optional[str],
    valid_candidates: List[Dict[str, Any]],
    recommendations: List[Dict[str, Any]],
    result_state: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "mode": _resolve_mode_meta(
            flow=flow,
            weights=weights,
            astro_bonus_enabled=astro_bonus_enabled,
        ),
        "llm": {
            "enabled": bool(effective_llm_enabled),
            "used": bool(effective_llm_enabled and llm_used),
            "error": llm_error,
        },
        "engine": {
            "orchestrator_used": bool(llm_used),
            "openai_enabled": bool(effective_llm_enabled),
            "openai_used": bool(effective_llm_enabled and llm_used),
        },
        "stats": build_stats(
            valid_candidates=valid_candidates,
            recommendations=recommendations,
        ),
        "result_state": result_state,
    }


def attach_response_meta(
    recs: Dict[str, Any],
    *,
    flow: str,
    weights: Dict[str, float],
    astro_bonus_enabled: bool,
    effective_llm_enabled: bool,
    llm_used: bool,
    llm_error: Optional[str],
    valid_candidates: List[Dict[str, Any]],
    extra_condition: Optional[str],
    goriyaku_tag_ids: Optional[List[int]],
    hard_filter_tags: set[str],
) -> Dict[str, Any]:
    recommendations = [
        r for r in (recs.get("recommendations") or [])
        if isinstance(r, dict)
    ]

    result_state = build_result_state(
        recommendations=recommendations,
        extra_condition=extra_condition,
        goriyaku_tag_ids=goriyaku_tag_ids,
        hard_filter_tags=hard_filter_tags,
    )

    recs["_signals"] = build_signals(
        flow=flow,
        weights=weights,
        astro_bonus_enabled=astro_bonus_enabled,
        effective_llm_enabled=effective_llm_enabled,
        llm_used=llm_used,
        llm_error=llm_error,
        valid_candidates=valid_candidates,
        recommendations=recommendations,
        result_state=result_state,
    )

    return recs


__all__ = [
    "build_result_state",
    "build_stats",
    "build_signals",
    "attach_response_meta",
]
