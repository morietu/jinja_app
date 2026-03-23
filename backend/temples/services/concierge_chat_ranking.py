from __future__ import annotations

import math
import logging
from typing import Any, Dict, List, Optional
from temples.domain.need_to_goriyaku_tag_ids import need_tags_to_goriyaku_ids
from typing import Literal

PublicMode = Literal["need", "compat"]


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
    "challenge": "courage",
    "ambition": "courage",
    "success": "courage",
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
    "courage": {
        "開運": 3,
        "開運祈願": 3,
        "勝運": 3,
        "運を開く": 3,
        "背中を押して": 3,
        "一歩踏み出す": 2,
        "勇気": 2,
        "変わりたい": 2,
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

NEED_LABELS_JA: Dict[str, str] = {
    "study": "学業・合格",
    "career": "転機・仕事",
    "mental": "不安・心",
    "love": "恋愛",
    "money": "金運",
    "rest": "休息",
    "courage": "前進・後押し",
    "element": "生年月日との相性",
    "fallback": "近い候補",
}

PRIMARY_REASON_PRIORITY: Dict[str, int] = {
    "need_tag": 0,
    "goriyaku_tag": 1,
    "text_hint": 2,
    "element": 3,
    "fallback": 9,
}




def _make_reason_fact(
    *,
    type_: str,
    label: str,
    evidence: List[str],
    score: float,
) -> Dict[str, Any]:
    return {
        "type": type_,
        "label": label,
        "label_ja": NEED_LABELS_JA.get(label, label),
        "evidence": [
            str(x).strip()
            for x in evidence
            if isinstance(x, str) and str(x).strip()
        ],
        "score": float(score),
        "is_primary": False,
    }

NEED_TAG_LABELS_JA = {
    "love": "恋愛",
    "career": "転機・仕事",
    "mental": "不安・心",
    "rest": "休息",
    "money": "金運",
    "courage": "前進・後押し",
    "study": "学業・合格",
}

def _need_tag_to_ja(tag: str) -> str:
    return NEED_TAG_LABELS_JA.get(tag, tag)


def _build_reason_facts(
    *,
    matched_by_tag: List[str],
    matched_by_gid: List[str],
    matched_by_text: List[str],
    text_score_by_tag: Dict[str, int],
    score_element: int,
    astro_bonus_enabled: bool,
) -> List[Dict[str, Any]]:
    facts: List[Dict[str, Any]] = []

    for tag in matched_by_tag:
        facts.append(
            _make_reason_fact(
                type_="need_tag",
                label=tag,
                evidence=[tag],
                score=2.0,
            )
        )

    for tag in matched_by_gid:
        facts.append(
            _make_reason_fact(
                type_="goriyaku_tag",
                label=tag,
                evidence=["goriyaku_tag_ids"],
                score=2.0,
            )
        )

    for tag in matched_by_text:
        facts.append(
            _make_reason_fact(
                type_="text_hint",
                label=tag,
                evidence=[f"text_score:{text_score_by_tag.get(tag, 0)}"],
                score=float(text_score_by_tag.get(tag, 0)),
            )
        )

    if astro_bonus_enabled and score_element > 0:
        facts.append(
            _make_reason_fact(
                type_="element",
                label="element",
                evidence=[f"score_element:{score_element}"],
                score=float(score_element),
            )
        )

    return facts


def _resolve_primary_reason(
    facts: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not facts:
        return {
            "type": "fallback",
            "label": "fallback",
            "label_ja": "近い候補",
            "evidence": [],
            "score": 0.0,
            "is_primary": True,
        }

    ordered = sorted(
        facts,
        key=lambda x: (
            PRIMARY_REASON_PRIORITY.get(str(x.get("type") or "").strip(), 99),
            -float(x.get("score") or 0.0),
            str(x.get("label") or ""),
        ),
    )

    primary = dict(ordered[0])
    primary["is_primary"] = True
    return primary


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
    public_mode: PublicMode,
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

    if public_mode == "compat":
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
    public_mode: PublicMode,
    flow: str,
    weights: Dict[str, float],
    astro_bonus_enabled: bool,
) -> Dict[str, Any]:
    public_weights = {
        "element": float(weights.get("element", 0.0)),
        "need": float(weights.get("need", 0.0)),
        "popular": float(weights.get("popular", 0.0)),
    }

    if public_mode == "compat":
        return {
            "mode": "compat",
            "flow": flow,
            "weights": public_weights,
            "astro_bonus_enabled": bool(astro_bonus_enabled),
            "ui_label_ja": "相性重視",
            "ui_note_ja": "生年月日との相性を中心に並べ替えています",
        }

    return {
        "mode": "need",
        "flow": flow,
        "weights": public_weights,
        "astro_bonus_enabled": bool(astro_bonus_enabled),
        "ui_label_ja": "悩み重視",
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

    candidate_gid_set = {
        int(x)
        for x in (rec.get("goriyaku_tag_ids") or [])
        if isinstance(x, int) or (isinstance(x, str) and str(x).strip().isdigit())
    }

    matched_by_gid: List[str] = []
    for tag in need_tags_clean:
        expected_gids = need_tags_to_goriyaku_ids([tag])
        if expected_gids and (candidate_gid_set & expected_gids):
            matched_by_gid.append(tag)

    is_study_need = "study" in need_tags_clean
    study_bonus = 0
    if is_study_need and any(h in material for h in STUDY_SHRINE_HINTS):
        study_bonus = 1

    matched_all: List[str] = []
    seen: set[str] = set()
    for t in matched_by_tag + matched_by_text + matched_by_gid:
        if t not in seen:
            matched_all.append(t)
            seen.add(t)

    score_need = len(matched_all)

    score_need_rank = (
        len(matched_by_tag) * 2
        + len(matched_by_gid) * 2
        + sum(text_score_by_tag.values())
        + study_bonus
    )

    score_need_rank_weighted = (
        len(matched_by_tag) * 2.0
        + len(matched_by_gid) * 2.0
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

    score_total = (
        score_element * w1
        + score_need * w2
        + score_popular * w3
        + astro_bonus
    )

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
                "matched_by_gid_count": len(matched_by_gid),
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

    reason_facts = _build_reason_facts(
        matched_by_tag=matched_by_tag,
        matched_by_gid=matched_by_gid,
        matched_by_text=matched_by_text,
        text_score_by_tag=text_score_by_tag,
        score_element=score_element,
        astro_bonus_enabled=astro_bonus_enabled,
    )
    primary_reason = _resolve_primary_reason(reason_facts)

    if reason_facts:
        for fact in reason_facts:
            if (
                str(fact.get("type") or "") == str(primary_reason.get("type") or "")
                and str(fact.get("label") or "") == str(primary_reason.get("label") or "")
                and list(fact.get("evidence") or []) == list(primary_reason.get("evidence") or [])
            ):
                fact["is_primary"] = True
                break
    else:
        reason_facts = [primary_reason]

    rec["_reason_facts"] = reason_facts
    rec["_primary_reason_source"] = str(primary_reason.get("type") or "")
    rec["_primary_reason_label"] = str(primary_reason.get("label") or "")

    need_score_reason = "normal_scored"
    if not need_tags_clean:
        need_score_reason = "no_need_tags"
    elif not matched_all:
        if not candidate_gid_set and not shrine_tag_set and not material.strip():
            need_score_reason = "no_candidate_material"
        elif matched_by_tag or matched_by_text or matched_by_gid:
            need_score_reason = "unexpected_empty_after_match"
        else:
            need_score_reason = "no_overlap"

    try:
        log.info(
            "[dbg] attach_breakdown shrine_id=%r name=%r need_tags=%r prefilter_matched=%r matched_by_tag=%r matched_by_text=%r matched_by_gid=%r matched_all=%r score_need=%r need_score_reason=%r primary_reason_source=%r primary_reason_label=%r",
            rec.get("shrine_id"),
            rec.get("name"),
            need_tags_clean,
            (rec.get("_prefilter_debug") or {}).get("matched"),
            matched_by_tag,
            matched_by_text,
            matched_by_gid,
            matched_all,
            score_need,
            need_score_reason,
            rec.get("_primary_reason_source"),
            rec.get("_primary_reason_label"),
        )
    except Exception:
        pass

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

        candidate_gid_set = {
            int(x)
            for x in (c.get("goriyaku_tag_ids") or [])
            if isinstance(x, int) or (isinstance(x, str) and str(x).strip().isdigit())
        }

        material = f"{c.get('goriyaku') or ''} {c.get('description') or ''}".replace("　", " ")

        score = 0
        matched: List[str] = []
        matched_text_hints_by_tag: Dict[str, List[str]] = {}
        text_score_by_tag: Dict[str, int] = {}
        matched_gid_tags: List[str] = []

        for tag in need_tags_clean:
            if tag in astro_tag_set:
                score += 2
                matched.append(f"{tag}:astro")

            expected_gids = need_tags_to_goriyaku_ids([tag])
            if expected_gids and (candidate_gid_set & expected_gids):
                score += 2
                matched.append(f"{tag}:gid")
                matched_gid_tags.append(tag)

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
            "matched_gid_tags": matched_gid_tags,
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
                    "shrine_id": r.get("shrine_id"),
                    "name": r.get("name") or r.get("name_jp"),
                    "prefilter_score": (r.get("_prefilter_debug") or {}).get("score"),
                    "prefilter_matched": (r.get("_prefilter_debug") or {}).get("matched"),
                    "text_score_by_tag": (r.get("_prefilter_debug") or {}).get("text_score_by_tag"),
                    "matched_gid_tags": (r.get("_prefilter_debug") or {}).get("matched_gid_tags"),
                    "astro_tags": r.get("astro_tags"),
                    "goriyaku_tag_ids": r.get("goriyaku_tag_ids"),
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

def _resolve_public_mode(
    *,
    mode: Optional[str],
    birthdate: Optional[str],
    query: Optional[str],
) -> PublicMode:
    mode_norm = str(mode or "").strip().lower()

    if mode_norm == "compat":
        return "compat"

    if mode_norm == "need":
        return "need"

    has_birthdate = bool(str(birthdate or "").strip())
    has_query = bool(str(query or "").strip())

    if has_birthdate and not has_query:
        return "compat"

    return "need"


def _resolve_flow_from_mode(
    *,
    public_mode: PublicMode,
    flow: Optional[str],
) -> str:
    flow_norm = str(flow or "").strip().upper()

    if flow_norm in {"A", "B"}:
        return flow_norm

    if public_mode == "compat":
        return "B"

    return "A"

def build_recommendation_reason(
    rec: Dict[str, Any],
    *,
    public_mode: PublicMode,
    birthdate: Optional[str],
    need_tags: List[str],
) -> str:
    if public_mode == "compat":
        user_element = None
        if birthdate:
            try:
                from temples.domain.astrology import sun_sign_and_element  # type: ignore
                prof = sun_sign_and_element(birthdate)
                if prof:
                    user_element = getattr(prof, "element", None)
            except Exception:
                user_element = None

        shrine_elements = [
            str(x).strip()
            for x in (rec.get("astro_elements") or [])
            if isinstance(x, str) and str(x).strip()
        ]

        if user_element and shrine_elements:
            shrine_elements_text = "・".join(shrine_elements)
            return (
                f"あなたの生年月日から見た「{user_element}」の要素と、"
                f"この神社の性質（{shrine_elements_text}）が噛み合っています。"
            )

        return "あなたの生年月日との相性を中心に、この神社をおすすめしています。"

    matched = (rec.get("breakdown") or {}).get("matched_need_tags") or []
    matched_tags = [
        str(tag).strip()
        for tag in matched
        if isinstance(tag, str) and str(tag).strip()
    ]
    primary_label = str(rec.get("_primary_reason_label") or "").strip()

    try:
        log.info(
            "[dbg] build_reason shrine_id=%r name=%r public_mode=%r matched_need_tags=%r primary_reason_label=%r score_need=%r",
            rec.get("shrine_id"),
            rec.get("name"),
            public_mode,
            matched_tags,
            primary_label,
            (rec.get("breakdown") or {}).get("score_need"),
        )
    except Exception:
        pass

    name = str(rec.get("name") or "").strip()
    goriyaku = str(rec.get("goriyaku") or "").strip()

    if primary_label:
        return _build_need_reason_text(
            primary_label,
            name=name,
            goriyaku=goriyaku,
        )

    if matched_tags:
        return _build_need_reason_text(
            matched_tags[0],
            name=name,
            goriyaku=goriyaku,
        )

    if name:
        return f"{name}は、今の悩みや願いに合わせて参拝先の候補に入れています。"
    return "今の悩みや願いに合わせた参拝先の候補としておすすめしています。"

    primary_label = str(rec.get("_primary_reason_label") or "").strip()
    matched_tags = [
        str(tag).strip()
        for tag in matched
        if isinstance(tag, str) and str(tag).strip()
    ]

    try:
        log.info(
            "[dbg] build_reason shrine_id=%r name=%r public_mode=%r matched_need_tags=%r score_need=%r",
            rec.get("shrine_id"),
            rec.get("name"),
            public_mode,
            matched_tags,
            (rec.get("breakdown") or {}).get("score_need"),
        )
    except Exception:
        pass

    name = str(rec.get("name") or "").strip()
    goriyaku = str(rec.get("goriyaku") or "").strip()

    if primary_label:
        return _build_need_reason_text(
            primary_label,
            name=name,
            goriyaku=goriyaku,
        )

    if matched_tags:
        return _build_need_reason_text(
            matched_tags[0],
            name=name,
            goriyaku=goriyaku,
        )

    if name:
        return f"{name}は、今の悩みや願いに合わせて参拝先の候補に入れています。"
    return "今の悩みや願いに合わせた参拝先の候補としておすすめしています。"

def _build_need_lead(tag: str, goriyaku: str) -> str:
    if goriyaku:
        normalized = (
            goriyaku.replace("、", "・")
            .replace("，", "・")
            .replace("/", "・")
        )
        parts = [p.strip() for p in normalized.split("・") if p.strip()]
        if parts:
            return parts[0]

    fallback = {
        "study": "学業成就",
        "mental": "心願成就",
        "rest": "心身浄化",
        "love": "良縁成就",
        "career": "仕事運",
        "money": "金運",
        "courage": "開運",
    }
    return fallback.get(tag, "ご利益")


def _build_need_reason_text(
    tag: str,
    *,
    name: str = "",
    goriyaku: str = "",
) -> str:
    intent_map = {
        "study": "学業や合格",
        "mental": "不安や心の安定",
        "rest": "休息や気持ちの切り替え",
        "love": "恋愛や良縁",
        "career": "仕事や転機",
        "money": "金運向上",
        "courage": "前進や後押し",
    }

    user_intent = intent_map.get(tag, "今の願い")

    if name:
        lead = _build_need_lead(tag, goriyaku)
        return f"{lead}のご利益で知られる{name}は、{user_intent}を願う参拝先として適しています。"

    mapping = {
        "study": "学業や合格を願う今の気持ちに寄り添いやすく、参拝にも向いています。",
        "mental": "不安や心を整えたい今の気持ちに寄り添いやすく、参拝にも向いています。",
        "rest": "気持ちを静かに整えて、ひと息つきたい時の参拝に向いています。",
        "love": "恋愛やご縁を願う今の気持ちに寄り添いやすく、参拝にも向いています。",
        "career": "仕事や転機を後押ししたい今の願いに寄り添いやすく、参拝にも向いています。",
        "money": "金運や仕事の流れを整えたい今の願いに寄り添いやすく、参拝にも向いています。",
        "courage": "前に進みたい、流れを変えたい今の気持ちを後押しする参拝に向いています。",
    }
    return mapping.get(tag, "今の悩みや願いに寄り添いやすい神社としておすすめしています。")

__all__ = [
    "NEED_TEXT_WEIGHTS",
    "STUDY_SHRINE_HINTS",
    "_clamp01",
    "_distance_decay",
    "_resolve_public_mode",
    "_resolve_flow_from_mode",
    "_resolve_mode_weights",
    "_resolve_mode_meta",
    "_attach_breakdown",
    "_prefilter_candidates_for_need",
    "_diversify_by_need",
    "build_recommendation_reason",
]
