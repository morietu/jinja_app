from __future__ import annotations

import math
import logging
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)


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

NEED_TEXT_WEIGHTS: Dict[str, Dict[str, int]] = {
    "study": {
        "合格祈願": 3,
        "学業成就": 3,
        "資格試験": 3,
        "受験": 2,
        "試験": 2,
        "学問": 2,
        "勉強": 1,
        "入試": 2,
    },
    "career": {
        "転職": 3,
        "導き": 3,
        "挑戦": 3,
        "後押し": 3,
        "道を開く": 3,
        "勝運": 2,
        "仕事運": 1,
        "出世": 1,
        "昇進": 1,
        "成功": 1,
    },
    "mental": {
        "厄除": 2,
        "厄払い": 3,
        "浄化": 2,
        "心を整える": 2,
        "不安": 2,
        "落ち着く": 2,
        "静か": 1,
        "守護": 1,
        "守ってほしい": 1,
    },
    "love": {
        "縁結び": 3,
        "恋愛成就": 3,
        "良縁": 3,
        "復縁": 2,
        "結婚": 2,
        "夫婦円満": 2,
        "恋愛": 2,
        "ご縁": 1,
        "出会い": 1,
    },
    "money": {
        "商売繁盛": 3,
        "金運": 3,
        "財運": 3,
        "売上": 2,
        "事業": 2,
        "福徳": 2,
        "収入": 1,
        "資産": 1,
        "商売": 1,
    },
    "rest": {
        "休息": 3,
        "癒し": 3,
        "静か": 2,
        "リセット": 2,
        "穏やか": 2,
        "気分転換": 2,
        "落ち着き": 2,
        "ひと息": 1,
        "自然": 1,
        "休みたい": 1,
    },
}

STUDY_SHRINE_HINTS = [
    "学業成就",
    "合格祈願",
    "学問",
]


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


def _clamp01(v: float) -> float:
    """0.0〜1.0 の範囲に収める"""
    return max(0.0, min(1.0, v))


def _distance_decay(distance_m: Optional[float]) -> float:
    """
    距離を 0〜1 のスコアに変換する。
    近いほど高い。
    """
    if distance_m is None or distance_m < 0:
        return 0.0
    return math.exp(-distance_m / 2500.0)


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
            "distance": float(weights.get("distance", 0.0)),
        }

    if flow == "B":
        return {
            "element": 0.8,
            "need": 0.2,
            "popular": 0.0,
            "distance": 0.15,
        }

    return {
        "element": 0.6,
        "need": 0.3,
        "popular": 0.1,
        "distance": 0.35,
    }


def _resolve_mode_meta(
    *,
    flow: str,
    weights: Dict[str, float],
    astro_bonus_enabled: bool,
) -> Dict[str, Any]:
    public_weights = {
        "element": float(weights.get("element", 0.0)),
        "need": float(weights.get("need", 0.0)),
        "popular": float(weights.get("popular", 0.0)),
    }

    if flow == "B":
        return {
            "flow": "B",
            "weights": public_weights,
            "astro_bonus_enabled": bool(astro_bonus_enabled),
            "ui_label_ja": "占星術強め",
            "ui_note_ja": "生年月日（星座/四元素）を強く反映して並べ替えています",
        }

    return {
        "flow": "A",
        "weights": public_weights,
        "astro_bonus_enabled": bool(astro_bonus_enabled),
        "ui_label_ja": "標準",
        "ui_note_ja": "相談内容と近さをもとに並べ替えています",
    }


def _attach_breakdown(
    rec: Dict[str, Any],
    *,
    birthdate: Optional[str],
    need_tags: List[str],
    weights: Dict[str, float],
    astro_bonus_enabled: bool,
) -> None:
    """
    rec（1件の神社辞書）にスコアの内訳を追加する。

    契約用:
      - breakdown.score_total
      - breakdown.score_need

    内部ランキング用:
      - rec["_score_total"]
      - breakdown_detail.features.need.rank_weighted
    """

    astro_elements = rec.get("astro_elements")
    if isinstance(astro_elements, list):
        rec["astro_elements"] = [
            e for e in astro_elements if isinstance(e, str) and e.strip()
        ]

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
            pass

    score_element = int(pri)

    shrine_tags = rec.get("astro_tags") or []
    if not isinstance(shrine_tags, list):
        shrine_tags = []
    shrine_tags = [t for t in shrine_tags if isinstance(t, str) and t.strip()]
    shrine_tag_set = set(shrine_tags)

    need_tags_clean = _normalize_need_tags(need_tags, max_tags=10)
    matched_by_tag = [t for t in need_tags_clean if t in shrine_tag_set]

    goriyaku_text = str(rec.get("goriyaku") or "")
    description_text = str(rec.get("description") or "")
    material = f"{goriyaku_text} {description_text}".replace("　", " ")

    matched_by_text: List[str] = []
    text_score_by_tag: Dict[str, int] = {}

    for tag in need_tags_clean:
        text_weights = NEED_TEXT_WEIGHTS.get(tag, {})
        score = 0

        for hint, weight in text_weights.items():
            if hint in material:
                score += int(weight)

        if score > 0:
            text_score_by_tag[tag] = score
            matched_by_text.append(tag)

    is_study_need = "study" in need_tags_clean
    study_bonus = 0
    if is_study_need and any(h in material for h in STUDY_SHRINE_HINTS):
        study_bonus = 1

    matched_all: List[str] = []
    seen: set[str] = set()
    for t in matched_by_tag + matched_by_text:
        if t not in seen:
            matched_all.append(t)
            seen.add(t)

    # 契約用
    score_need = len(matched_all)

    # 既存契約テストと相性のよい整数 rank
    score_need_rank = (
        len(matched_by_tag) * 2
        + sum(text_score_by_tag.values())
        + study_bonus
    )

    # 内部ランキング専用の強化版
    score_need_rank_weighted = (
        len(matched_by_tag) * 2.0
        + sum(text_score_by_tag.values()) * 1.2
        + study_bonus
    )

    w1 = float(weights.get("element", 0.0))
    w2 = float(weights.get("need", 0.0))
    w3 = float(weights.get("popular", 0.0))
    w4 = float(weights.get("distance", 0.0))

    astro_bonus = 0.0
    if astro_bonus_enabled:
        if pri == 2:
            astro_bonus = 0.6
        elif pri == 1:
            astro_bonus = 0.3

    try:
        popular_f = float(rec.get("popular_score") or 0.0)
    except Exception:
        popular_f = 0.0
    score_popular = _clamp01(popular_f / 10.0)

    raw_distance = rec.get("distance_m")
    try:
        distance_m = float(raw_distance) if raw_distance is not None else None
    except Exception:
        distance_m = None
    score_distance = _distance_decay(distance_m)

    # 契約用 total には distance を入れない
    score_total = (
        score_element * w1
        + score_need * w2
        + score_popular * w3
        + astro_bonus
    )

    # 内部ランキング用 total
    score_total_ranked = (
        score_element * w1
        + score_need_rank_weighted * w2
        + score_popular * w3
        + score_distance * w4
        + astro_bonus
    )

    rec["_score_total"] = float(score_total_ranked)

    rec["breakdown"] = {
        "score_element": int(score_element),
        "score_need": int(score_need),
        "score_popular": float(score_popular),
        "score_total": float(score_total),
        "weights": {
            "element": float(w1),
            "need": float(w2),
            "popular": float(w3),
        },
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
                "rank_weighted": float(score_need_rank_weighted),
                "weight": float(w2),
                "matched_tags": matched_all,
                "matched_by_tag_count": len(matched_by_tag),
                "matched_by_text_count": len(matched_by_text),
                "contribution": float(score_need * w2),
                "rank_contribution": float(score_need_rank * w2),
                "rank_weighted_contribution": float(score_need_rank_weighted * w2),
            },
            "popular": {
                "raw": float(score_popular),
                "weight": float(w3),
                "contribution": float(score_popular * w3),
            },
            "distance": {
                "raw": float(score_distance),
                "weight": float(w4),
                "contribution": float(score_distance * w4),
            },
            "astro_bonus": float(astro_bonus) if astro_bonus_enabled else 0.0,
            "score_total_ranked": float(score_total_ranked),
        },
    }


def _prefilter_candidates_for_need(
    candidates: List[Dict[str, Any]],
    *,
    need_tags: List[str],
) -> List[Dict[str, Any]]:
    scored: List[tuple[int, float, str, Dict[str, Any]]] = []

    need_tags_clean = _normalize_need_tags(need_tags, max_tags=10)
    is_study_need = "study" in need_tags_clean

    for c in candidates:
        if not isinstance(c, dict):
            continue

        astro_tags = c.get("astro_tags") or []
        if not isinstance(astro_tags, list):
            astro_tags = []
        astro_tag_set = {
            str(t).strip()
            for t in astro_tags
            if isinstance(t, str) and str(t).strip()
        }

        material = f"{c.get('goriyaku') or ''} {c.get('description') or ''}".replace("　", " ")

        score = 0
        matched: List[str] = []
        matched_text_hints_by_tag: Dict[str, List[str]] = {}
        text_score_by_tag: Dict[str, int] = {}

        for tag in need_tags_clean:
            if tag in astro_tag_set:
                score += 2
                matched.append(f"{tag}:astro")

            text_weights = NEED_TEXT_WEIGHTS.get(tag, {})
            tag_matched_hints = [hint for hint in text_weights.keys() if hint in material]

            if tag_matched_hints:
                score += 1
                matched.append(f"{tag}:text")
                matched_text_hints_by_tag[tag] = tag_matched_hints
                text_score_by_tag[tag] = sum(text_weights[h] for h in tag_matched_hints)

        if is_study_need and any(h in material for h in STUDY_SHRINE_HINTS):
            score += 2
            matched.append("study:text_bonus")

        row = dict(c)
        row["_prefilter_debug"] = {
            "score": score,
            "matched": matched,
            "text_score_by_tag": text_score_by_tag,
            "matched_text_hints_by_tag": matched_text_hints_by_tag,
        }

        scored.append(
            (
                score,
                float(c.get("popular_score") or 0.0),
                str(c.get("name") or c.get("name_jp") or ""),
                row,
            )
        )

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


def _diversify_by_need(
    recs: List[Dict[str, Any]],
    limit: int = 3,
) -> List[Dict[str, Any]]:
    """
    上位候補で matched_need_tags の偏りを少し緩和する。

    - 先頭 limit 件だけ多様化を意識
    - ただし元のスコア順を大きく壊さない
    - matched_need_tags が無い候補も除外しない
    """
    pool = [r for r in recs if isinstance(r, dict)]
    if len(pool) <= 1:
        return pool

    picked: List[Dict[str, Any]] = []
    used_tags: set[str] = set()

    while pool and len(picked) < limit:
        best_index: Optional[int] = None

        for i, r in enumerate(pool):
            tags = (r.get("breakdown") or {}).get("matched_need_tags") or []
            normalized_tags = [
                str(t).strip()
                for t in tags
                if isinstance(t, str) and str(t).strip()
            ]

            if not normalized_tags:
                continue

            if any(t not in used_tags for t in normalized_tags):
                best_index = i
                break

        if best_index is None:
            best_index = 0

        picked_row = pool.pop(best_index)
        picked.append(picked_row)

        picked_tags = (picked_row.get("breakdown") or {}).get("matched_need_tags") or []
        used_tags.update(
            str(t).strip()
            for t in picked_tags
            if isinstance(t, str) and str(t).strip()
        )

    picked.extend(pool)
    return picked


__all__ = [
    "NEED_TEXT_WEIGHTS",
    "STUDY_SHRINE_HINTS",
    "_clamp01",
    "_distance_decay",
    "_resolve_mode_weights",
    "_resolve_mode_meta",
    "_attach_breakdown",
    "_prefilter_candidates_for_need",
    "_diversify_by_need",
]
