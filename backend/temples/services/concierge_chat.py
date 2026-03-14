from __future__ import annotations

from collections import Counter
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
    _resolve_mode_meta,
    _resolve_mode_weights,
)
from temples.services.concierge_explanations import (
    attach_explanations_for_chat,
)

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 内部ユーティリティ
# ---------------------------------------------------------------------------


def _normalize_astro_elements(elements: Any) -> list:
    """astro_elements をリストに正規化する"""
    if not isinstance(elements, list):
        return []
    return [e for e in elements if isinstance(e, str) and e.strip()]


NEED_SYNONYMS: Dict[str, List[str]] = {
    "study": [
        "学業", "学業成就", "合格", "合格祈願",
        "試験", "資格試験", "受験", "勉強", "入試",
    ],
    "career": [
        "仕事運", "転職", "出世", "昇進", "勝運",
        "導き", "挑戦", "後押し", "道を開く",
    ],
    "mental": [
        "不安", "悩み", "つらい", "苦しい", "しんどい", "落ち込む", "落ち込み",
        "怖い", "心配", "迷い", "モヤモヤ", "気持ち", "心", "整えたい", "浄化",
        "厄", "厄除け", "厄払い",
    ],
    "love": [
        "恋愛", "恋", "縁結び", "良縁", "結婚", "復縁", "片思い", "両思い",
        "夫婦", "パートナー", "出会い", "ご縁",
    ],
    "money": [
        "金運", "お金", "収入", "売上", "商売繁盛", "財運", "裕福", "貯金",
        "経済", "資産", "稼ぎたい",
    ],
    "rest": [
        "休みたい", "休息", "疲れた", "疲れて", "疲労", "癒し", "静か", "落ち着きたい",
        "落ち着く", "穏やか", "ひと息", "整えたい", "リセット", "気分転換",
    ],
}

NEED_PRIORITY = {
    "study": 0,
    "career": 1,
    "mental": 2,
    "love": 3,
    "money": 4,
    "rest": 5,
}

NEED_TAG_ALIASES: Dict[str, str] = {
    "marriage": "love",
    "romance": "love",
    "relationship": "love",
    "anxiety": "mental",
    "healing": "rest",
    "career_change": "career",
    "work": "career",
    "fortune": "money",
    "courage": "career",
    "challenge": "career",
    "ambition": "career",
    "success": "career",
}


def _normalize_need_tag(tag: Any) -> str:
    s = str(tag or "").strip().lower()
    return NEED_TAG_ALIASES.get(s, s)


def _normalize_need_tags(tags: Any, *, max_tags: int = 3) -> List[str]:
    normalized: List[str] = []
    for t in tags or []:
        if not isinstance(t, str) or not t.strip():
            continue
        nt = _normalize_need_tag(t)
        if nt and nt not in normalized:
            normalized.append(nt)
    return normalized[:max_tags]


# ---------------------------------------------------------------------------
# need fallback
# ---------------------------------------------------------------------------
def _extract_need_fallback(query: str, *, max_tags: int = 3) -> Dict[str, Any]:
    text = str(query or "").strip()
    if not text:
        return {"tags": [], "hits": {}}

    counter: Counter[str] = Counter()
    hits: Dict[str, List[str]] = {}

    for tag, words in NEED_SYNONYMS.items():
        matched_words: List[str] = []
        for w in words:
            if w and w in text:
                matched_words.append(w)
                counter[tag] += 1

        if matched_words:
            uniq: List[str] = []
            seen = set()
            for w in matched_words:
                if w not in seen:
                    uniq.append(w)
                    seen.add(w)
            hits[tag] = uniq

    tags = sorted(
        counter.keys(),
        key=lambda t: (-counter[t], NEED_PRIORITY.get(t, 99), t),
    )[:max_tags]

    return {"tags": tags, "hits": hits}


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
    **kwargs: Any,
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
            "tags": _normalize_need_tags(need_tags, max_tags=3),
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
                "tags": _normalize_need_tags(raw_tags, max_tags=3),
                "hits": cleaned_hits,
            }
        except Exception:
            need_payload = _extract_need_fallback(query, max_tags=3)
            need_payload["tags"] = _normalize_need_tags(
                need_payload.get("tags", []),
                max_tags=3,
            )

    need_tags = _normalize_need_tags(need_payload.get("tags", []), max_tags=3)
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

    sort_tags: set[str] = set()
    hard_filter_tags: set[str] = set()
    soft_signal_tags: set[str] = set()

    try:
        ex = extract_extra_tags(extra_condition or "", max_tags=3)
        kinds = split_tags_by_kind(ex.tags)
        sort_tags = set(kinds.get("sort_override") or [])
        hard_filter_tags = set(kinds.get("hard_filter") or [])
        soft_signal_tags = set(kinds.get("soft_signal") or [])
    except Exception:
        sort_tags = set()
        hard_filter_tags = set()
        soft_signal_tags = set()

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

    displayed_count = len(
        [r for r in (recs.get("recommendations") or []) if isinstance(r, dict)]
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

    result_state = {
        "matched_count": matched_count,
        "pool_count": displayed_count,
        "displayed_count": displayed_count,
        "fallback_mode": fallback_mode,
        "fallback_reason_ja": fallback_reason_ja,
        "ui_disclaimer_ja": ui_disclaimer_ja,
        "requested_extra_condition": requested_extra,
    }

    recs["_signals"] = {
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
        "stats": {
            "candidate_count": len(valid_candidates),
            "valid_candidate_count": len(valid_candidates),
            "pool_count": displayed_count,
            "displayed_count": displayed_count,
            "missing_fields": {
                "total": len(valid_candidates),
                "place_id": {
                    "missing": sum(1 for c in valid_candidates if not c.get("place_id")),
                    "rate": (
                        sum(1 for c in valid_candidates if not c.get("place_id")) / len(valid_candidates)
                        if valid_candidates else 0.0
                    ),
                },
                "latlng": {
                    "missing": sum(
                        1 for c in valid_candidates
                        if c.get("lat") is None or c.get("lng") is None
                    ),
                    "rate": (
                        sum(
                            1 for c in valid_candidates
                            if c.get("lat") is None or c.get("lng") is None
                        ) / len(valid_candidates)
                        if valid_candidates else 0.0
                    ),
                },
                "address": {
                    "missing": sum(
                        1 for c in valid_candidates
                        if not (c.get("formatted_address") or c.get("address"))
                    ),
                    "rate": (
                        sum(
                            1 for c in valid_candidates
                            if not (c.get("formatted_address") or c.get("address"))
                        ) / len(valid_candidates)
                        if valid_candidates else 0.0
                    ),
                },
            },
        },
        "result_state": result_state,
    }

    recs = attach_explanations_for_chat(
        recs,
        query=query,
        bias=bias,
        birthdate=birthdate,
        extra_condition=extra_condition,
    )

    return recs
