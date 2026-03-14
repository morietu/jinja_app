from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from django.conf import settings

from temples.domain.extra_condition_tags import extract_extra_tags, split_tags_by_kind
from temples.services.concierge_chat_pool import (
    _ensure_pool_size,
    _merge_candidate_fields,
    _seed_recs_from_candidates,
)
from temples.services.concierge_chat_presentation import (
    _apply_location_backfill as _presentation_apply_location_backfill,
    _apply_soft_signal_highlights,
    _attach_reason_source,
    _trim_to_top3_and_fill_message,
)
from temples.services.concierge_chat_ranking import (
    _attach_breakdown,
    _prefilter_candidates_for_need,
    _resolve_mode_weights,
    _diversify_by_need,
)
from temples.services.concierge_explanations import (
    attach_explanations_for_chat,
)
from temples.services.concierge_chat_need import (
    normalize_need_tags,
    extract_need_fallback,
)

from temples.services.concierge_chat_response_meta import (
    attach_response_meta,
)
from temples.services.concierge_chat_extra_condition import (
    resolve_extra_condition_tags,
)


log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# presentation 互換 shim
# ---------------------------------------------------------------------------
def _apply_location_backfill(
    recs: Dict[str, Any],
    *,
    bias: Optional[Dict[str, float]],
    language: str,
) -> None:
    """
    互換用 shim。
    既存テストが temples.services.concierge_chat._apply_location_backfill を
    monkeypatch しているため、この公開名を残す。
    """
    _presentation_apply_location_backfill(
        recs,
        bias=bias,
        language=language,
    )


def build_chat_recommendations(
    *,
    query: str,
    language: str = "ja",
    candidates: Optional[List[Dict[str, Any]]] = None,
    bias: Optional[Dict[str, float]] = None,
    birthdate: Optional[str] = None,
    goriyaku_tag_ids: Optional[List[int]] = None,
    extra_condition: Optional[str] = None,
    flow: str = "A",
    trace_id: Optional[str] = None,
    llm_enabled: bool = True,
    need_tags: Optional[List[str]] = None,
    weights: Optional[Dict[str, float]] = None,
    astro_bonus_enabled: bool = False,
    **kwargs: object,
) -> Dict[str, Any]:
    """
    候補リストからおすすめ神社を選んで返す関数。

    facade はこのファイルに残し、
    ranking / pool / presentation の責務は各モジュールへ分離する。
    """

    valid_candidates = [
        dict(c) for c in (candidates or [])
        if isinstance(c, dict)
    ]

    need_payload: Dict[str, Any]

    if need_tags:
        need_payload = {
            "tags": normalize_need_tags(need_tags, max_tags=3),
            "hits": {},
        }
    else:
        try:
            from temples.domain.need_tags import extract_need_tags  # type: ignore

            ex = extract_need_tags(query, max_tags=3)
            raw_tags = getattr(ex, "tags", []) or []
            raw_hits = getattr(ex, "hits", {}) or {}

            cleaned_hits: Dict[str, List[str]] = {}
            if isinstance(raw_hits, dict):
                for k, v in raw_hits.items():
                    if not isinstance(k, str) or not k.strip():
                        continue
                    if isinstance(v, list):
                        cleaned_hits[k] = [str(x) for x in v if str(x).strip()]
                    elif v is not None and str(v).strip():
                        cleaned_hits[k] = [str(v)]

            need_payload = {
                "tags": normalize_need_tags(raw_tags, max_tags=3),
                "hits": cleaned_hits,
            }
        except Exception:
            need_payload = extract_need_fallback(query, max_tags=3)
            need_payload["tags"] = normalize_need_tags(
                need_payload.get("tags", []),
                max_tags=3,
            )

    need_tags = normalize_need_tags(need_payload.get("tags", []), max_tags=3)
    need_payload["tags"] = need_tags

    log.info(
        "[dbg] need_tags query=%r tags=%r language=%r flow=%r extra=%r goriyaku=%r",
        (query or "")[:60],
        need_tags,
        language,
        flow,
        extra_condition,
        goriyaku_tag_ids,
    )

    astro_profile = None
    if birthdate:
        try:
            from temples.domain.astrology import sun_sign_and_element  # type: ignore
            astro_profile = sun_sign_and_element(birthdate)
        except Exception:
            astro_profile = None

    extra_tags = resolve_extra_condition_tags(extra_condition)
    sort_tags = extra_tags["sort_tags"]
    hard_filter_tags = extra_tags["hard_filter_tags"]
    soft_signal_tags = extra_tags["soft_signal_tags"]

    weights = _resolve_mode_weights(flow=flow, weights=weights)

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
            log.exception("[build_chat_recommendations] LLM exception traceback")

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

    log.info(
        "[dbg] route llm_requested=%r llm_effective=%r llm_used=%r seed=%r candidate_count=%d",
        requested_llm_enabled,
        effective_llm_enabled,
        llm_used,
        bool(recs.get("_seed")) if isinstance(recs, dict) else None,
        len(valid_candidates),
    )

    pre_limit = 12
    recs = _ensure_pool_size(recs, candidates=valid_candidates, size=pre_limit)
    recs = _merge_candidate_fields(recs, candidates=valid_candidates)

    log.info(
        "[dbg] pool_after_merge size=%d top_names=%r",
        len(recs.get("recommendations") or []),
        [
            r.get("name")
            for r in (recs.get("recommendations") or [])[:5]
            if isinstance(r, dict)
        ],
    )

    for rec in recs.get("recommendations") or []:
        if isinstance(rec, dict):
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
            _attach_reason_source(rec)

    distance_mode = "sort_distance" in sort_tags

    if distance_mode:
        recs["recommendations"] = sorted(
            [r for r in recs.get("recommendations") if isinstance(r, dict)],
            key=lambda r: (
                float(r.get("distance_m") or 1e12),
                -float(r.get("_score_total") or 0),
                str(r.get("name") or ""),
            ),
        )
    else:
        recs["recommendations"] = sorted(
            [r for r in recs.get("recommendations") if isinstance(r, dict)],
            key=lambda r: (
                -float(r.get("_score_total") or 0),
                float(r.get("distance_m") or 1e12),
                str(r.get("name") or ""),
            ),
        )
        recs["recommendations"] = _diversify_by_need(
            recs["recommendations"],
            limit=3,
        )

    # ここは facade 側から呼ぶ。
    # 既存テストが temples.services.concierge_chat._apply_location_backfill を
    # monkeypatch しているため、presentation 側を直呼びしない。
    _apply_location_backfill(recs, bias=bias, language=language)
    _trim_to_top3_and_fill_message(recs)

    try:
        log.info(
            "[dbg] scored_pool=%r",
            [
                {
                    "name": r.get("name"),
                    "distance_m": r.get("distance_m"),
                    "score_total": r.get("_score_total"),
                    "matched_need_tags": (r.get("breakdown") or {}).get("matched_need_tags"),
                    "goriyaku": r.get("goriyaku"),
                }
                for r in (recs.get("recommendations") or [])
                if isinstance(r, dict)
            ],
        )
    except Exception:
        pass

    if llm_error:
        log.warning("[build_chat_recommendations] LLM error: %s", llm_error)

    if astro_profile:
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

    recs["_need"] = need_payload

    recs = attach_response_meta(
        recs,
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
        query=query,
        bias=bias,
        birthdate=birthdate,
        extra_condition=extra_condition,
    )

    return recs
