# backend/temples/services/concierge_chat.py

from __future__ import annotations
from collections import Counter
import logging
from typing import Any, Dict, List, Optional
from django.conf import settings
from temples.domain.extra_condition_tags import extract_extra_tags, split_tags_by_kind
from temples.llm import backfill as bf
from temples.services.concierge_explanations import attach_explanations_for_chat
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 内部ユーティリティ
# ---------------------------------------------------------------------------

def _clamp01(v: float) -> float:
    """0.0〜1.0 の範囲に収める"""
    return max(0.0, min(1.0, v))


def _normalize_astro_elements(elements: Any) -> list:
    """astro_elements をリストに正規化する"""
    if not isinstance(elements, list):
        return []
    return [e for e in elements if isinstance(e, str) and e.strip()]

NEED_SYNONYMS: Dict[str, List[str]] = {
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
    "career": 0,
    "mental": 1,
    "love": 2,
    "money": 3,
    "rest": 4,
}
# need タグと、goriyaku / description テキストに含まれるキーワードの対応表
NEED_TEXT_HINTS: Dict[str, List[str]] = {
    "career": [
        "仕事運", "転職", "出世", "昇進", "勝運",
        "導き", "挑戦", "後押し", "道を開く",
    ],
    "mental": ["厄除", "厄払い", "心", "癒し", "浄化", "落ち着", "静か"],
    "love":   ["縁結び", "恋愛", "良縁", "夫婦円満"],
    "money": ["金運", "財運", "福徳", "商売繁盛", "事業", "商売"],
    "rest":   ["休息", "癒し", "静か", "落ち着", "気持ちを整"],
}

NEED_REASON_LABELS: Dict[str, str] = {
    "career": "仕事や転機に向き合う参拝に",
    "mental": "不安・心に向き合う参拝に",
    "love": "ご縁や恋愛を願う参拝に",
    "money": "金運や商売繁盛を願う参拝に",
    "rest": "心身を休めたいときの参拝に",
}

NEED_BULLET_LABELS: Dict[str, List[str]] = {
    "career": [
        "仕事や転機に関する願いと相性があります。",
    ],
    "mental": [
        "心を整えたい相談内容と相性があります。",
    ],
    "love": [
        "縁結びや恋愛成就の願いと相性があります。",
    ],
    "money": [
        "金運や商売繁盛の願いと相性があります。",
    ],
    "rest": [
        "落ち着いて気持ちを整えたい時に向いています。",
    ],
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
    "study": "career",
}

STUDY_QUERY_HINTS = ["学業", "受験", "合格", "試験", "勉強", "資格"]
STUDY_SHRINE_HINTS = ["学業成就", "合格祈願"]

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

SOFT_SIGNAL_HIGHLIGHTS: Dict[str, str] = {
    "calm": "落ち着いて気持ちを整えやすい雰囲気",
}

# ---------------------------------------------------------------------------
# 修正①: build_chat_recommendations() 側で pool を 12 件に広げる
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

def _apply_location_backfill(
    recs: Dict[str, Any],
    *,
    bias: Optional[Dict[str, float]],
    language: str,
) -> None:
    for r in recs.get("recommendations") or []:
        if not isinstance(r, dict):
            continue

        loc = r.get("location")
        if isinstance(loc, str) and loc.strip():
            continue

        name = str(r.get("name") or "").strip()
        if not name:
            continue

        try:
            addr = bf._lookup_address_by_name(name, bias=bias, lang=language)
        except Exception:
            addr = None

        if isinstance(addr, str) and addr.strip():
            short = bf._shorten_japanese_address(addr) or addr.strip()
            r["location"] = short

def _apply_soft_signal_highlights(
    rec: Dict[str, Any],
    *,
    soft_signal_tags: set[str],
) -> None:
    if not isinstance(rec, dict):
        return

    highlights = rec.get("highlights") or []
    if not isinstance(highlights, list):
        highlights = []

    normalized = [
        str(x).strip()
        for x in highlights
        if isinstance(x, str) and str(x).strip()
    ]

    for tag in soft_signal_tags:
        label = SOFT_SIGNAL_HIGHLIGHTS.get(tag)
        if label and label not in normalized:
            normalized.append(label)

    rec["highlights"] = normalized[:3]

def _attach_reason_source(rec: Dict[str, Any]) -> None:
    matched = ((rec.get("breakdown") or {}).get("matched_need_tags") or [])

    highlights = rec.get("highlights") or []
    if not isinstance(highlights, list):
        highlights = []
    bullets = [
        str(x).strip()
        for x in highlights
        if isinstance(x, str) and str(x).strip()
    ][:2]

    if matched:
        first = matched[0]
        reason = NEED_REASON_LABELS.get(first, "相談内容に合うご利益・特徴があります。")
        reason_source = "reason:matched_need_tags"
    else:
        raw_reason = str(rec.get("reason") or "").strip()
        if raw_reason:
            reason = "この神社ならではの特徴があります。"
            reason_source = "reason:normalized_original"
        else:
            reason = "相談内容に合うご利益・特徴があります。"
            reason_source = "reason:fallback"

    rec["reason"] = reason
    rec["reason_source"] = reason_source
    rec["bullets"] = bullets

def _resolve_mode_weights(
    *,
    flow: str,
    weights: Optional[Dict[str, float]],
) -> Dict[str, float]:
    if isinstance(weights, dict):
        return {
            "element": float(weights.get("element", 0.0)),
            "need": float(weights.get("need", 0.0)),
            "popular": float(weights.get("popular", 0.0)),
        }

    if flow == "B":
        return {"element": 0.8, "need": 0.2, "popular": 0.0}

    return {"element": 0.6, "need": 0.3, "popular": 0.1}

def _resolve_mode_meta(
    *,
    flow: str,
    weights: Dict[str, float],
    astro_bonus_enabled: bool,
) -> Dict[str, Any]:
    if flow == "B":
        return {
            "flow": "B",
            "weights": dict(weights),
            "astro_bonus_enabled": bool(astro_bonus_enabled),
            "ui_label_ja": "占星術強め",
            "ui_note_ja": "生年月日（星座/四元素）を強く反映して並べ替えています",
        }

    return {
        "flow": "A",
        "weights": dict(weights),
        "astro_bonus_enabled": bool(astro_bonus_enabled),
        "ui_label_ja": "標準",
        "ui_note_ja": "相談内容と近さをもとに並べ替えています",
    }


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

    修正①: pool（候補プール）のサイズを 12 件に広げた。
    修正②: LLM が使えないときも 12 件のプールを確保する。
    修正③: need score を astro_tags だけでなく goriyaku/description テキストにも反応させる。
    修正④: スコアリング後のログを追加する（顔ぶれの変化を確認するため）。
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

    # -------------------------------------------------------------------
    # 修正①②: LLM の使用有無にかかわらず pool を 12 件に広げる
    # -------------------------------------------------------------------
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
            recs = _seed_recs_from_candidates(valid_candidates, size=12)
    else:
        prefiltered = _prefilter_candidates_for_need(
            valid_candidates,
            need_tags=need_tags,
            query=query,
        )
        recs = _seed_recs_from_candidates(prefiltered, size=12)

    # -------------------------------------------------------------------
    # pool のサイズを 12 件に保証する（LLM が少なく返してきた場合も補填）
    # -------------------------------------------------------------------
    pre_limit = 12
    recs = _ensure_pool_size(recs, candidates=valid_candidates, size=pre_limit)
    recs = _merge_candidate_fields(recs, candidates=valid_candidates)

    # -------------------------------------------------------------------
    # 修正③: スコアを計算する（need score は astro_tags だけでなく
    #         goriyaku / description テキストにも反応させる）
    # -------------------------------------------------------------------
    for rec in recs.get("recommendations") or []:
        if isinstance(rec, dict):
            _attach_breakdown(
                rec,
                birthdate=birthdate,
                need_tags=need_tags,
                weights=weights,
                astro_bonus_enabled=astro_bonus_enabled,
                query=query,
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

    _apply_location_backfill(recs, bias=bias, language=language)

    # top3だけ返す
    recs["recommendations"] = recs["recommendations"][:3]

    # -------------------------------------------------------------------
    # 修正④: スコアリング後のログ（相談ごとに顔ぶれが変わるか確認用）
    # -------------------------------------------------------------------
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
        pass  # ログ失敗はメイン処理に影響させない

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
                if isinstance(r, dict) and int(r.get("breakdown", {}).get("score_element", 0)) >= 2
            ),
        }

    recs["_need"] = need_payload

    if not isinstance(recs.get("message"), str) or not recs["message"].strip():
        top_names = [
            str(r.get("name") or "").strip()
            for r in (recs.get("recommendations") or [])
            if isinstance(r, dict) and str(r.get("name") or "").strip()
        ]

        if top_names:
            recs["message"] = (
                f"相談内容と近さをもとに、参拝候補を3件に整理しました。"
                f" {', '.join(top_names[:3])}"
            )
        else:
            recs["message"] = (
                "条件に合いそうな神社が見つかりませんでした。条件を少しゆるめて試してください。"
            )

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

# ---------------------------------------------------------------------------
# 内部ヘルパー: シード（seed）候補を作る
# ---------------------------------------------------------------------------

def _seed_recs_from_candidates(
    candidates: Optional[List[Dict[str, Any]]],
    size: int = 12,
) -> Dict[str, Any]:
    safe_candidates = list(candidates or [])
    return {
        "recommendations": safe_candidates[:size],
        "_seed": True,
    }


def _ensure_pool_size(
    recs: Dict[str, Any],
    *,
    candidates: List[Dict[str, Any]],
    size: int = 12,
) -> Dict[str, Any]:
    current: List[Dict[str, Any]] = list(recs.get("recommendations") or [])

    seen_ids = set()
    seen_names = set()

    for r in current:
        rid = r.get("shrine_id") or r.get("id")
        if rid is not None:
            seen_ids.add(rid)

        name = str(r.get("name") or "").strip()
        if name:
            seen_names.add(name)

    for cand in candidates:
        if len(current) >= size:
            break

        cid = cand.get("shrine_id") or cand.get("id")
        cname = str(cand.get("name") or "").strip()

        if cid is not None and cid in seen_ids:
            continue
        if cname and cname in seen_names:
            continue

        current.append(cand)

        if cid is not None:
            seen_ids.add(cid)
        if cname:
            seen_names.add(cname)

    recs = dict(recs)
    recs["recommendations"] = current
    return recs

def _merge_candidate_fields(
    recs: Dict[str, Any],
    *,
    candidates: List[Dict[str, Any]],
) -> Dict[str, Any]:
    by_id: Dict[Any, Dict[str, Any]] = {}
    by_name: Dict[str, Dict[str, Any]] = {}

    for c in candidates:
        if not isinstance(c, dict):
            continue

        cid = c.get("shrine_id") or c.get("id")
        if cid is not None:
            by_id[cid] = c

        name = str(c.get("name") or "").strip()
        if name:
            by_name[name] = c

    merged: List[Dict[str, Any]] = []

    for r in recs.get("recommendations") or []:
        if not isinstance(r, dict):
            continue

        base = None
        rid = r.get("shrine_id") or r.get("id")
        if rid is not None:
            base = by_id.get(rid)

        if base is None:
            name = str(r.get("name") or "").strip()
            if name:
                base = by_name.get(name)

        if base:
            row = dict(base)
            row.update(r)  # orchestrator の reason 等は優先
            merged.append(row)
        else:
            merged.append(r)

    recs = dict(recs)
    recs["recommendations"] = merged
    return recs
# ---------------------------------------------------------------------------
# 修正③: need score を astro_tags だけでなく goriyaku / description にも反応させる
# ---------------------------------------------------------------------------

def _attach_breakdown(
    rec: Dict[str, Any],
    *,
    birthdate: Optional[str],
    need_tags: List[str],
    weights: Dict[str, float],
    astro_bonus_enabled: bool = False,
    query: str = "",
) -> None:
    """
    rec（1件の神社辞書）にスコアの内訳を追加する。

    計算する3種類のスコア:
      score_element : 生年月日と神社の相性（占星術ベース）
      score_need    : ユーザーの悩みタグとの一致度（astro_tags + テキスト検索）
      score_popular : 人気スコア（0〜1 に正規化）
    """

    # --- astro_elements を正規化 ---
    if isinstance(rec.get("astro_elements"), list):
        rec["astro_elements"] = _normalize_astro_elements(rec.get("astro_elements"))

    # --- element スコア（生年月日 × 神社の属性） ---
    pri_raw = rec.get("astro_priority")
    pri = int(pri_raw) if isinstance(pri_raw, int) else 0
    if birthdate:
        try:
            from temples.domain.astrology import element_priority, sun_sign_and_element  # type: ignore
            prof = sun_sign_and_element(birthdate)
            if prof:
                shrine_elems = rec.get("astro_elements") or []
                pri = int(element_priority(prof.element, shrine_elems))
        except Exception:
            pass  # 占星術モジュールが使えない場合はスキップ
    score_element = int(pri)

    # --- need スコア（① astro_tags との一致） ---
    shrine_tags = rec.get("astro_tags") or []
    if not isinstance(shrine_tags, list):
        shrine_tags = []
    shrine_tags = [t for t in shrine_tags if isinstance(t, str) and t.strip()]
    shrine_tag_set = set(shrine_tags)

    need_tags_clean = _normalize_need_tags(need_tags, max_tags=10)
    matched_by_tag = [t for t in need_tags_clean if t in shrine_tag_set]

    # --- need スコア（② goriyaku / description テキストとの一致） ---
    goriyaku_text = str(rec.get("goriyaku") or "")
    description_text = str(rec.get("description") or "")
    material = f"{goriyaku_text} {description_text}"
    
    matched_by_text: List[str] = []
    for tag in need_tags_clean:
        hints = NEED_TEXT_HINTS.get(tag, [])
        if any(hint in material for hint in hints):
            matched_by_text.append(tag)
    
    is_study_query = any(h in (query or "") for h in STUDY_QUERY_HINTS)
    study_bonus = 0
    if is_study_query and any(h in material for h in STUDY_SHRINE_HINTS):
        study_bonus = 1

    matched_all: List[str] = []
    seen: set[str] = set()
    for t in matched_by_tag + matched_by_text:
        if t not in seen:
            matched_all.append(t)
            seen.add(t)

    score_need = len(matched_all)
    score_need_rank = len(matched_by_tag) * 2 + len(matched_by_text) + study_bonus

    # --- 重みを取り出す ---
    w1 = float(weights.get("element", 0.0))
    w2 = float(weights.get("need", 0.0))
    w3 = float(weights.get("popular", 0.0))

    # --- astro ボーナス（オプション） ---
    astro_bonus = 0.0
    if astro_bonus_enabled:
        if pri == 2:
            astro_bonus = 0.6
        elif pri == 1:
            astro_bonus = 0.3

    # --- popular スコア（人気度を 0〜1 に正規化） ---
    try:
        popular_f = float(rec.get("popular_score") or 0.0)
    except Exception:
        popular_f = 0.0
    score_popular = _clamp01(popular_f / 10.0)

    # --- 合計スコア ---
    # 契約用
    score_total = score_element * w1 + score_need * w2 + score_popular * w3 + astro_bonus
    # 内部ランキング用
    score_total_ranked = (
        score_element * w1 + score_need_rank * w2 + score_popular * w3 + astro_bonus
    )

    rec["_score_total"] = float(score_total_ranked)

    rec["breakdown"] = {
        "score_element": int(score_element),
        "score_need": int(score_need),
        "score_popular": float(score_popular),
        "score_total": float(score_total),
        "weights": {"element": float(w1), "need": float(w2), "popular": float(w3)},
        "matched_need_tags": matched_all,
    }

    rec["breakdown_detail"] = {
        "version": 1,
        "features": {
            "element": {
                "raw": int(score_element),
                "weight": float(w1),
                "contribution": float(score_element * w1),
            },
            "need": {
                "raw": int(score_need),
                "rank_raw": int(score_need_rank),
                "weight": float(w2),
                "matched_tags": matched_all,
                "matched_by_tag_count": len(matched_by_tag),
                "matched_by_text_count": len(matched_by_text),
                "contribution": float(score_need * w2),
                "rank_contribution": float(score_need_rank * w2),
            },
            "popular": {
                "raw": float(score_popular),
                "weight": float(w3),
                "contribution": float(score_popular * w3),
            },
            "astro_bonus": float(astro_bonus) if astro_bonus_enabled else 0.0,
            "score_total_ranked": float(score_total_ranked),
        },
    }

def _prefilter_candidates_for_need(
    candidates: List[Dict[str, Any]],
    *,
    need_tags: List[str],
    query: str,
) -> List[Dict[str, Any]]:
    scored: List[tuple[int, float, str, Dict[str, Any]]] = []

    need_tags_clean = _normalize_need_tags(need_tags, max_tags=10)
    is_study_query = any(h in (query or "") for h in STUDY_QUERY_HINTS)

    for c in candidates:
        if not isinstance(c, dict):
            continue

        astro_tags = c.get("astro_tags") or []
        if not isinstance(astro_tags, list):
            astro_tags = []
        astro_tag_set = {
            str(t).strip() for t in astro_tags
            if isinstance(t, str) and str(t).strip()
        }

        material = f"{c.get('goriyaku') or ''} {c.get('description') or ''}"

        score = 0
        matched: List[str] = []

        for tag in need_tags_clean:
            if tag in astro_tag_set:
                score += 2
                matched.append(f"{tag}:astro")

            hints = NEED_TEXT_HINTS.get(tag, [])
            if any(h in material for h in hints):
                score += 1
                matched.append(f"{tag}:text")

        if is_study_query and any(h in material for h in STUDY_SHRINE_HINTS):
            score += 3
            matched.append("study:text")

        row = dict(c)
        row["_prefilter_debug"] = {
            "score": score,
            "matched": matched,
        }

        scored.append((
            score,
            float(c.get("popular_score") or 0.0),
            str(c.get("name") or c.get("name_jp") or ""),
            row,
        ))

    scored.sort(key=lambda x: (-x[0], -x[1], x[2]))
    ordered = [row for _, _, _, row in scored]

    try:
        log.info(
            "[dbg] prefiltered_top12=%r",
            [
                {
                    "name": r.get("name") or r.get("name_jp"),
                    "prefilter": r.get("_prefilter_debug"),
                    "astro_tags": r.get("astro_tags"),
                    "goriyaku": r.get("goriyaku"),
                }
                for r in ordered[:12]
            ],
        )
    except Exception:
        pass

    return ordered
