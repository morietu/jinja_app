from __future__ import annotations

import math
import logging
from typing import Any, Dict, List, Optional, TypedDict
from temples.domain.need_to_goriyaku_tag_ids import need_tags_to_goriyaku_ids
from temples.services.concierge_history import (
    build_recent_reflection_hint,
    calculate_action_profile_breakdown,
    calculate_light_behavior_profile_breakdown,
    calculate_reflection_profile_breakdown,
    calculate_shrine_behavior_signal_breakdown,
    classify_shrine_action_state,
)
from temples.services.recommendation_score_v2 import (
    ScoreV2Input,
    calculate_recommendation_score_v2,
)
from typing import Literal



PublicMode = Literal["need", "compat"]


class DirectionBonusResult(TypedDict):
    bonus: float
    reason: str | None


# Legacy score_v2 contract. Active direction scoring is direction_signal only.
DIRECTION_BONUS_MAX = 0.0
PROFILE_SIGNAL_MAX = 0.02


log = logging.getLogger(__name__)

# 五行 → astro_elements マッピング
_GOGYO_TO_ELEMENTS: Dict[str, List[str]] = {
    "木": ["木", "Wood", "tree", "木星"],
    "火": ["火", "Fire", "flame", "火星"],
    "土": ["土", "Earth", "ground", "土星"],
    "金": ["金", "Metal", "gold", "金星"],
    "水": ["水", "Water", "water", "水星"],
}


DIRECTION_SIGNAL_MAX = 0.02

_SCORE_V3_WEIGHTS: Dict[str, float] = {
    "state": 0.45,
    "history": 0.10,
    "distance": 0.10,
    "behavior": 0.25,
    "profile": 0.05,
    "direction": 0.02,
    "action": 0.02,
    "reflection": 0.01,
}


def resolve_score_v3_mode() -> str:
    """Score v3 のモードを返す。

    SCORE_V3_MODE=active の場合のみ "active"。未設定・不正値は "shadow"。
    呼び出し元との互換を保つため文字列を返す。
    詳細（source）は resolve_score_v3_mode_detail() で取得する。
    """
    return resolve_score_v3_mode_detail()["mode"]


def resolve_score_v3_mode_detail() -> Dict[str, str]:
    """Score v3 モードと source を返す。

    Returns:
        {"mode": "shadow" | "active", "source": "default" | "env" | "invalid_env"}
    """
    import os

    raw = os.environ.get("SCORE_V3_MODE", "")
    stripped = raw.strip().lower()

    if stripped == "active":
        return {"mode": "active", "source": "env"}
    if stripped == "shadow":
        return {"mode": "shadow", "source": "env"}
    if stripped == "":
        return {"mode": "shadow", "source": "default"}
    return {"mode": "shadow", "source": "invalid_env"}


def resolve_score_sort_key(rec: Dict[str, Any], *, score_v3_mode: str) -> float:
    """並び順に使うスコアを返す。

    score_v3_mode == "active" の場合は breakdown.score_v3 を使う。
    それ以外（shadow）は既存の rec["_score_total"] を使う。
    現時点では resolve_score_v3_mode() が "shadow" 固定なので sort 順は変わらない。
    """
    if score_v3_mode == "active":
        return float((rec.get("breakdown") or {}).get("score_v3") or 0.0)
    return float(rec.get("_score_total") or 0.0)


def build_recommendation_score_v3_breakdown(
    *,
    state_signal: float,
    history_signal: float,
    distance_signal: float,
    behavior_profile: Dict[str, Any],
    profile_signal: Dict[str, Any],
    direction_signal: Dict[str, Any],
    action_profile: Dict[str, Any],
    reflection_profile: Dict[str, Any],
) -> Dict[str, Any]:
    """Score v3 統合ヘルパー（shadow モード）。

    既存の score_total / ranking には一切影響しない。
    breakdown.score_v3 / score_v3_detail として観測用に付与するのみ。
    """
    w = _SCORE_V3_WEIGHTS
    behavior_score = float((behavior_profile or {}).get("total", 0.0))
    profile_score = float((profile_signal or {}).get("score", 0.0))
    direction_score = float((direction_signal or {}).get("score", 0.0))
    action_score = float((action_profile or {}).get("score", 0.0))
    reflection_score = float((reflection_profile or {}).get("score", 0.0))

    score = (
        state_signal * w["state"]
        + history_signal * w["history"]
        + distance_signal * w["distance"]
        + behavior_score * w["behavior"]
        + profile_score * w["profile"]
        + direction_score * w["direction"]
        + action_score * w["action"]
        + reflection_score * w["reflection"]
    )

    return {
        "score": float(score),
        "components": {
            "state_signal": float(state_signal),
            "history_signal": float(history_signal),
            "distance_signal": float(distance_signal),
            "behavior_signal": float(behavior_score),
            "profile_signal": float(profile_score),
            "direction_signal": float(direction_score),
            "action_signal": float(action_score),
            "reflection_signal": float(reflection_score),
        },
        "weights": {k: float(v) for k, v in w.items()},
        "mode": "shadow",
    }


SCORE_V3_HISTORY_THEME_BY_AXIS: dict[str, dict[str, float]] = {
    "career_change": {
        "勝負": 1.0,
        "再出発": 0.8,
        "学び": 0.6,
        "守り": 0.3,
        "静寂": 0.2,
        "縁": 0.2,
        "復興": 0.2,
    },
    "relationship_repair": {
        "縁": 1.0,
        "静寂": 0.7,
        "守り": 0.5,
        "再出発": 0.4,
        "復興": 0.4,
        "学び": 0.2,
        "勝負": 0.1,
    },
    "money_growth": {
        "守り": 1.0,
        "勝負": 0.8,
        "再出発": 0.6,
        "学び": 0.4,
        "縁": 0.3,
        "静寂": 0.2,
        "復興": 0.2,
    },
    "restart_mindset": {
        "再出発": 1.0,
        "勝負": 0.8,
        "静寂": 0.6,
        "学び": 0.5,
        "復興": 0.5,
        "守り": 0.3,
        "縁": 0.2,
    },
    "nature_reset": {
        "静寂": 1.0,
        "復興": 0.8,
        "守り": 0.6,
        "縁": 0.2,
        "学び": 0.2,
        "再出発": 0.2,
        "勝負": 0.0,
    },
    "rest_healing": {
        "静寂": 1.0,
        "復興": 0.8,
        "守り": 0.6,
        "縁": 0.2,
        "学び": 0.2,
        "再出発": 0.2,
        "勝負": 0.0,
    },
    "health": {
        "守り": 1.0,
        "復興": 0.9,
        "静寂": 0.6,
        "再出発": 0.3,
        "学び": 0.2,
        "縁": 0.1,
        "勝負": 0.0,
    },
    "study_success": {
        "学び": 1.0,
        "勝負": 0.7,
        "静寂": 0.5,
        "再出発": 0.4,
        "守り": 0.3,
        "復興": 0.2,
        "縁": 0.1,
    },
    "protection": {
        "守り": 1.0,
        "静寂": 0.7,
        "復興": 0.5,
        "再出発": 0.3,
        "縁": 0.2,
        "学び": 0.1,
        "勝負": 0.0,
    },
    "travel_safe": {
        "守り": 1.0,
        "縁": 0.5,
        "静寂": 0.3,
        "再出発": 0.3,
        "勝負": 0.2,
        "学び": 0.2,
        "復興": 0.1,
    },
}

# 注意: 名称に "SCORE_V3" を含まない。SCORE_V3_HISTORY_THEME_BY_AXIS（shadow観測専用）の
# 複製だが、resolve_history_theme_candidate_boost() 経由で score_need_rank_weighted と
# 候補prefilterスコアへ直接加算されており、shadowではなく現行の本番ランキングに実影響する。
HISTORY_THEME_CANDIDATE_BOOST_BY_AXIS: dict[str, dict[str, float]] = {
    axis: dict(theme_scores)
    for axis, theme_scores in SCORE_V3_HISTORY_THEME_BY_AXIS.items()
}


def resolve_score_v3_history_signal(
    *,
    consultation_axis: str | None,
    history_theme: str | None,
) -> float:
    axis = str(consultation_axis or "").strip()
    theme = str(history_theme or "").strip()

    if not axis or not theme:
        return 0.0

    return float(SCORE_V3_HISTORY_THEME_BY_AXIS.get(axis, {}).get(theme, 0.0))


def resolve_history_theme_candidate_boost(
    *,
    consultation_axis: str | None,
    history_theme: str | None,
) -> float:
    axis = str(consultation_axis or "").strip()
    theme = str(history_theme or "").strip()

    if not axis or not theme:
        return 0.0

    return float(
        HISTORY_THEME_CANDIDATE_BOOST_BY_AXIS.get(axis, {}).get(theme, 0.0)
    )


# 方角ラベル（日本語）→ shrine 側の direction/direction_tags で使われうる値
_DIRECTION_LABELS_JA: set[str] = {"東", "西", "南", "北", "北東", "南東", "南西", "北西"}


def _score_direction_signal(
    rec: Dict[str, Any],
    profile_context: Optional[Dict[str, Any]],
    user_origin: Optional[Dict[str, Any]] = None,
) -> tuple[float, List[str]]:
    """
    参拝予定日の年盤・月盤と実座標の根拠が揃う場合だけ、最大 +0.02 を加算する。
    """
    from temples.services.direction_reference import build_direction_reference

    direction_profile = profile_context.get("direction_profile") if isinstance(profile_context, dict) else None
    try:
        reference = build_direction_reference(
            direction_profile=direction_profile if isinstance(direction_profile, dict) else None,
            user_origin=user_origin,
            shrine=rec,
        )
    except Exception:
        # 方位は補助シグナル。候補固有の失敗を推薦全体へ波及させない。
        logging.getLogger(__name__).error("direction_score_candidate_failed")
        rec.pop("direction_reference", None)
        rec.pop("direction_from_origin", None)
        return 0.0, []
    if reference is None:
        return 0.0, []

    actual_direction = str(reference["actual_direction"])
    rec["direction_from_origin"] = actual_direction
    rec["direction_reference"] = reference
    if reference["matched"]:
        return DIRECTION_SIGNAL_MAX, [f"plannedLuckyDirection:{actual_direction}"]

    return 0.0, []


def _score_profile_signal(
    rec: Dict[str, Any],
    profile_context: Optional[Dict[str, Any]],
) -> tuple[float, List[str]]:
    """
    profile_context（五行）を補助シグナルとして評価する。
    最大 PROFILE_SIGNAL_MAX (+0.02) を返す。
    既存の need / distance / history_theme スコアを上書きしない。
    """
    if not isinstance(profile_context, dict):
        return 0.0, []

    score = 0.0
    matched: List[str] = []

    derived = profile_context.get("derived_profile") or {}

    # 五行マッチ (+0.02)
    gogyo = str(derived.get("gogyo") or "").strip()
    if gogyo:
        shrine_elements = [
            str(e).strip()
            for e in (rec.get("astro_elements") or [])
            if isinstance(e, str) and str(e).strip()
        ]
        target_elements = _GOGYO_TO_ELEMENTS.get(gogyo, [])
        if any(e in target_elements for e in shrine_elements):
            score += 0.02
            matched.append(f"gogyo:{gogyo}")

    return min(score, PROFILE_SIGNAL_MAX), matched

NEED_TAG_ALIASES: Dict[str, str] = {
    "romance": "love",
    "anxiety": "mental",
    "healing": "rest",
    "career_change": "career",
    "work": "career",
    "fortune": "money",
    "challenge": "courage",
    "ambition": "courage",
    "success": "courage",
}
# "relationship" (人間関係全般) is a distinct need tag from "love"
# (恋愛) -- see the identical fix + rationale in
# temples/services/concierge_chat_need.NEED_TAG_ALIASES (this module
# has its own independent copy of the same table, used by
# _attach_breakdown's matching path; both had to be fixed for the
# alias removal to actually take effect end-to-end, see
# docs/audit/concierge-l1-freetext-readiness.md Finding C / PR #2409).
#
# "marriage" (結婚/婚活/夫婦円満) was removed from this table for the
# same reason relationship was: need_tags.py and consultation_interpreter.py
# both independently define a real, distinct marriage keyword list, and
# collapsing it into "love" discarded that distinction end-to-end -- see
# docs/audit/marriage-love-alias-boundary.md (PRODUCT_SEMANTIC_DECISION_REQUIRED,
# resolved in favor of independence) and
# docs/audit/marriage-need-independence-implementation.md. "romance" (a
# plain English synonym with no independent keyword list of its own)
# remains aliased to "love".


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
    "protection": "厄除け・守り",
    "focus": "集中・継続",
    "travel_safe": "移動・安全",
    # Added by fix/need-labels-ja-completeness (docs/audit/need-labels-ja-completeness-implementation.md):
    # the remaining 5 of 15 canonical Need tags (temples/domain/need_tags.py
    # NEED_TAGS), previously absent from every copy of this dict and
    # falling back to the raw English key. See that doc's Label Contract
    # section for sourcing; scope-sensitive labels ("family") are
    # deliberately scope-neutral pending the separate Mother Ship decision
    # in docs/audit/semantic-followup-decision-and-pr-split.md.
    "marriage": "結婚・夫婦円満",
    "relationship": "人間関係",
    "communication": "コミュニケーション",
    "health": "健康",
    "family": "家族",
    "element": "生年月日との相性",
    "fallback": "近い候補",
    "history_theme": "歴史文脈",
    "culture_translation": "神社固有文脈",
    "visit_style": "参拝スタイル",
}

# Recommendation Reason Responsibility:
# - need_tag は相談テーマ由来のユーザー状態として扱う。
# - goriyaku_tag / user_selected_tag は神社側分類・追加条件として扱う。
# - 「仕事」「金運」「恋愛」など語彙は重複してよいが、入力側と神社側で責務を分ける。
# - primary_reason は固定相談文ではなく、フリーワードや短いキーワードから抽出された相談テーマとの接続を優先する。

PRIMARY_REASON_PRIORITY: Dict[str, int] = {
    "history_theme": 0,
    "culture_translation": 1,
    "need_tag": 2,
    "text_hint": 3,
    "user_selected_tag": 4,
    "goriyaku_tag": 5,
    "element": 6,
    # visit_style: Level 2 Visit Preference. Lowest priority short of
    # fallback -- it is a "fallback primary reason candidate" (Task 8,
    # Recommendation Primary Reason Contract Unification): it only becomes
    # the primary reason when nothing else (not even element) matched.
    # This mirrors the precedence the previous, now-removed
    # concierge_explanation_payload._build_visit_style_primary_reason()
    # override enforced (it only fired when the reason_facts primary was
    # None/"fallback"), now expressed as a single ordinary priority tier
    # instead of a second, independent resolver.
    "visit_style": 7,
    "fallback": 9,
}

# Signal Authority boundary (docs/product/recommendation-signal-authority.md
# §5/§7 Primary Recommendation Contract): only these reason_facts types are
# grounded in Consultation Meaning x Shrine-side Evidence. "element"
# (birthdate/Personalization) and "visit_style" (Secondary/Context
# boundary) may still surface as a reason, but per §7 must never alone
# constitute Recommendation Meaning -- used to keep Context-driven
# re-ranking (e.g. distance_mode) from promoting a candidate with no
# Primary Recommendation Meaning ahead of one that has it.
PRIMARY_TIER_REASON_TYPES: frozenset[str] = frozenset(
    reason_type
    for reason_type, priority in PRIMARY_REASON_PRIORITY.items()
    if priority < PRIMARY_REASON_PRIORITY["element"]
)


def has_primary_tier_reason(reason_facts: List[Dict[str, Any]] | None) -> bool:
    """True if any reason_fact is grounded in Recommendation Meaning
    (Primary tier), as opposed to Context/Secondary/Personalization only."""
    return any(
        str(fact.get("type") or "") in PRIMARY_TIER_REASON_TYPES
        for fact in (reason_facts or [])
        if isinstance(fact, dict)
    )


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
        "evidence": [str(x).strip() for x in evidence if isinstance(x, str) and str(x).strip()],
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
    "protection": "厄除け・守り",
    "focus": "集中・継続",
    "travel_safe": "移動・安全",
    # Added by fix/need-labels-ja-completeness -- kept textually identical
    # to NEED_LABELS_JA's own additions above (same 5 Needs, same source).
    "marriage": "結婚・夫婦円満",
    "relationship": "人間関係",
    "communication": "コミュニケーション",
    "health": "健康",
    "family": "家族",
}


def _need_tag_to_ja(tag: str) -> str:
    return NEED_TAG_LABELS_JA.get(tag, tag)


def _build_reason_facts(
    *,
    matched_by_tag: List[str],
    matched_by_gid: List[str],
    matched_by_text: List[str],
    matched_by_user_selected_gid: List[int],
    goriyaku_tag_label_by_id: Optional[Dict[int, str]],
    text_score_by_tag: Dict[str, int],
    score_element: int,
    astro_bonus_enabled: bool,
    shrine_meaning_profile: Optional[Dict[str, Any]] = None,
    matched_visit_style_tags: Optional[List[str]] = None,
    history_theme_candidate_boost: float = 0.0,
) -> List[Dict[str, Any]]:
    facts: List[Dict[str, Any]] = []
    profile = shrine_meaning_profile or {}
    profile_matched_need_tags = [
        str(tag).strip()
        for tag in (profile.get("matched_need_tags") or [])
        if isinstance(tag, str) and str(tag).strip()
    ]
    history_theme = str(profile.get("history_theme") or "").strip()
    culture_translation_present = bool(profile.get("culture_translation_present"))

    # docs/product/recommendation-signal-authority.md §6: history_theme is
    # "Primary（条件付き）" -- Rank寄与はconsultation_axis一致時のみ
    # (history_theme_candidate_boost). A candidate whose theme does not
    # correspond to the resolved axis (boost == 0.0) had zero ranking
    # authority from history_theme, so it must not be presented as the
    # (or a) reason this candidate ranked -- gating this fact on the same
    # boost signal that actually reached the score keeps the Explanation
    # SSOT aligned with the real Ranking Authority (Explanation Alignment
    # Hardening audit finding).
    if profile_matched_need_tags and history_theme and history_theme_candidate_boost > 0:
        facts.append(
            _make_reason_fact(
                type_="history_theme",
                label=history_theme,
                evidence=["history_theme", "matched_need_tags"],
                score=4.0,
            )
        )

    if profile_matched_need_tags and culture_translation_present:
        facts.append(
            _make_reason_fact(
                type_="culture_translation",
                label="culture_translation",
                evidence=["culture_translation_present", "matched_need_tags"],
                score=3.5,
            )
        )

    label_map = goriyaku_tag_label_by_id or {}
    for gid in matched_by_user_selected_gid:
        label = str(label_map.get(gid) or f"goriyaku_tag:{gid}")
        facts.append(
            _make_reason_fact(
                type_="user_selected_tag",
                label=label,
                evidence=["requested_goriyaku_tag_ids"],
                score=3.0,
            )
        )

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

    visit_style_tags = [
        str(tag).strip()
        for tag in (matched_visit_style_tags or [])
        if str(tag).strip()
    ]
    if visit_style_tags:
        facts.append(
            _make_reason_fact(
                type_="visit_style",
                label="visit_style",
                evidence=list(visit_style_tags),
                score=float(len(visit_style_tags)),
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
    # culture_translation is curated Explanation material, not a Ranking
    # Authority. Keep its fact in the payload, but never let its presence
    # select or replace the Primary Ranking Reason (PR #2421).
    primary_candidates = [
        fact
        for fact in facts
        if str(fact.get("type") or "").strip() != "culture_translation"
    ]

    if not primary_candidates:
        return {
            "type": "fallback",
            "label": "fallback",
            "label_ja": "近い候補",
            "evidence": [],
            "score": 0.0,
            "is_primary": True,
        }

    ordered = sorted(
        primary_candidates,
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

DIRECTION_LABELS_JA = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"]


def _to_float_or_none(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _bearing_degrees(*, from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float:
    lat1 = math.radians(from_lat)
    lat2 = math.radians(to_lat)
    delta_lng = math.radians(to_lng - from_lng)

    y = math.sin(delta_lng) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lng)

    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _direction_label_ja(bearing: float) -> str:
    index = int((bearing + 22.5) // 45) % 8
    return DIRECTION_LABELS_JA[index]


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
    birthdate: Optional[str] = None,
) -> Dict[str, Any]:
    public_weights = {
        "element": float(weights.get("element", 0.0)),
        "need": float(weights.get("need", 0.0)),
        "popular": float(weights.get("popular", 0.0)),
    }
    has_birthdate = bool(str(birthdate or "").strip())

    if public_mode == "compat":
        return {
            "mode": "compat",
            "flow": flow,
            "weights": public_weights,
            "astro_bonus_enabled": bool(astro_bonus_enabled),
            "ui_label_ja": "相性重視" if has_birthdate else "条件重視",
            "ui_note_ja": (
                "生年月日との相性を中心に並べ替えています"
                if has_birthdate
                else "追加条件との一致を中心に並べ替えています"
            ),
        }

    return {
        "mode": "need",
        "flow": flow,
        "weights": public_weights,
        "astro_bonus_enabled": bool(astro_bonus_enabled),
        "ui_label_ja": "悩み重視",
        "ui_note_ja": "相談内容と近さをもとに並べ替えています",
    }


# Standalone helper: _build_entry_context
def _build_entry_context(
    *,
    query: Optional[str],
    birthdate: Optional[str],
) -> Dict[str, Any]:
    has_query = bool(str(query or "").strip())
    has_birthdate = bool(str(birthdate or "").strip())

    if has_query:
        entry_type = "consultation"
    else:
        entry_type = "flow"

    return {
        "version": 1,
        "entry_type": entry_type,
        "has_query": has_query,
        "has_consultation_axis": has_query,
        "has_birthdate": has_birthdate,
    }


def _resolve_direction_bonus(
    *,
    rec: Dict[str, Any],
    birthdate: Optional[str],
    user_origin: Optional[Dict[str, Any]] = None,
) -> DirectionBonusResult:
    """Deprecated direction_bonus contract; active scoring is direction_signal."""
    return {"bonus": 0.0, "reason": None}


def _normalize_int_signal_list(values: Any) -> List[int]:
    normalized: List[int] = []
    for value in values or []:
        try:
            normalized.append(int(value))
        except (TypeError, ValueError):
            continue
    return normalized


def _build_shrine_meaning_profile(
    *,
    rec: Dict[str, Any],
    shrine_id_int: int | None,
    matched_all: List[str],
    matched_by_tag: List[str],
    matched_by_text: List[str],
    matched_by_gid: List[str],
    matched_by_user_selected_gid: List[int],
) -> Dict[str, Any]:
    """Build a debug-friendly Shrine Meaning Profile for score_v2 observation.

    This profile keeps shrine-side meaning signals in one place.
    matched_* values are user × shrine match results, but are included here as
    the observation bridge between User State Profile and Shrine Meaning Profile.
    """
    culture_translation = rec.get("culture_translation")
    origin_summary = rec.get("origin_summary")

    return {
        "version": 1,
        "shrine_id": shrine_id_int,
        "name": rec.get("name") or rec.get("name_jp") or "",
        "goriyaku": rec.get("goriyaku") or "",
        "goriyaku_tags": [
            str(tag).strip()
            for tag in (rec.get("goriyaku_tags") or [])
            if isinstance(tag, str) and str(tag).strip()
        ],
        "goriyaku_tag_ids": _normalize_int_signal_list(rec.get("goriyaku_tag_ids") or []),
        "history_theme": rec.get("history_theme") or "",
        "culture_translation_present": bool(culture_translation),
        "origin_summary_present": bool(origin_summary),
        "matched_need_tags": list(matched_all or []),
        "matched_by_tag": list(matched_by_tag or []),
        "matched_by_text": list(matched_by_text or []),
        "matched_by_gid": list(matched_by_gid or []),
        "matched_user_selected_goriyaku_tag_ids": list(matched_by_user_selected_gid or []),
    }


# New helper function: _build_context_profile
def _build_context_profile(
    *,
    distance_m: float | None,
    score_distance: float,
    user_visit_style_tags: set[str],
    shrine_visit_style_tags: set[str],
    matched_visit_style_tags: List[str],
    score_visit_style: int,
    direction_bonus: float,
    direction_reason: str | None,
) -> Dict[str, Any]:
    """Build a debug-friendly Context Profile for score_v2 observation.

    This profile keeps distance, visit style, and direction signals in one place.
    It is observational and does not add any new ranking contribution by itself.
    """
    return {
        "version": 1,
        "distance_m": float(distance_m) if distance_m is not None else None,
        "score_distance": float(score_distance),
        "requested_visit_style_tags": sorted(user_visit_style_tags),
        "visit_style_tags": sorted(shrine_visit_style_tags),
        "matched_visit_style_tags": list(matched_visit_style_tags or []),
        "score_visit_style": int(score_visit_style),
        "direction_bonus": float(direction_bonus),
        "direction_reason": direction_reason,
    }


# New helper function: _build_behavior_profile
def _build_behavior_profile(
    *,
    action_state: str,
    behavior_breakdown: Dict[str, float],
    behavior_signal: float,
    behavior_contribution: float,
    capped_behavior_contribution: float,
    behavior_ratio: float,
    visit_signal: float,
    reflection_signal: float,
    reflection_hint: Dict[str, Any] | None,
) -> Dict[str, Any]:
    """Build a debug-friendly Behavior Profile for score_v2 observation.

    This profile keeps user behavior signals in one place.
    It is observational and does not add any new ranking contribution by itself.
    """
    return {
        "version": 1,
        "action_state": action_state,
        "behavior_breakdown": behavior_breakdown,
        "behavior_signal": float(behavior_signal),
        "behavior_contribution": float(behavior_contribution),
        "capped_behavior_contribution": float(capped_behavior_contribution),
        "behavior_ratio": float(behavior_ratio),
        "visit_signal": float(visit_signal),
        "reflection_signal": float(reflection_signal),
        "reflection_hint": reflection_hint,
    }


def _attach_breakdown(
    rec: Dict[str, Any],
    *,
    birthdate: Optional[str],
    need_tags: List[str],
    weights: Dict[str, float],
    astro_bonus_enabled: bool,
    visit_style_tags: set[str] | None = None,
    query: Optional[str] = None,
    requested_goriyaku_tag_ids: Optional[List[int]] = None,
    goriyaku_tag_label_by_id: Optional[Dict[int, str]] = None,
    user_origin: Optional[Dict[str, Any]] = None,
    user=None,
    profile_context: Optional[Dict[str, Any]] = None,
    consultation_axis: Optional[str] = None,
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
        rec["astro_elements"] = [e for e in astro_elements if isinstance(e, str) and e.strip()]

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

    requested_gid_set = {
        int(x)
        for x in (requested_goriyaku_tag_ids or [])
        if isinstance(x, int) or (isinstance(x, str) and str(x).strip().isdigit())
    }
    matched_by_user_selected_gid = sorted(candidate_gid_set & requested_gid_set)

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

    shrine_id = rec.get("shrine_id") or rec.get("id")
    try:
        shrine_id_int = int(shrine_id) if shrine_id is not None else None
    except (TypeError, ValueError):
        shrine_id_int = None

    shrine_meaning_profile = _build_shrine_meaning_profile(
        rec=rec,
        shrine_id_int=shrine_id_int,
        matched_all=matched_all,
        matched_by_tag=matched_by_tag,
        matched_by_text=matched_by_text,
        matched_by_gid=matched_by_gid,
        matched_by_user_selected_gid=matched_by_user_selected_gid,
    )

    # Text Evidence Scoring Contract (docs/audit/compass-text-evidence-scoring-decision.md,
    # RECOMMEND_C1_MAX): per-tag, GID and Text evidence are no longer summed
    # -- the larger of the two is taken (tie -> GID), removing the BOTH-state
    # double-count while GID_ONLY/TEXT_ONLY/NONE stay exactly as before.
    # matched_by_gid/matched_by_text/text_score_by_tag/matched_all are left
    # untouched (raw evidence stays observable) -- only the rank contribution
    # formula changes. astro (matched_by_tag) is a separate evidence channel,
    # out of this Contract's scope, and keeps its own flat +2 unconditionally.
    need_evidence_winner_by_tag: Dict[str, str] = {}
    gid_text_contribution = 0
    gid_text_contribution_weighted = 0.0
    for tag in set(matched_by_gid) | set(matched_by_text):
        gid_present = tag in matched_by_gid
        text_present = tag in matched_by_text
        gid_raw, gid_weighted = (2, 2.0) if gid_present else (0, 0.0)
        text_raw = text_score_by_tag.get(tag, 0) if text_present else 0
        text_weighted = text_raw * 1.2

        if gid_present and text_present:
            winner = "text" if text_weighted > gid_weighted else "gid"
        elif gid_present:
            winner = "gid"
        else:
            winner = "text"
        need_evidence_winner_by_tag[tag] = winner

        if winner == "gid":
            gid_text_contribution += gid_raw
            gid_text_contribution_weighted += gid_weighted
        else:
            gid_text_contribution += text_raw
            gid_text_contribution_weighted += text_weighted

    score_need_rank = (
        len(matched_by_tag) * 2
        + gid_text_contribution
        + study_bonus
    )

    score_need_rank_weighted = (
        len(matched_by_tag) * 2.0
        + gid_text_contribution_weighted
        + study_bonus
    )

    history_theme_candidate_boost = resolve_history_theme_candidate_boost(
        consultation_axis=consultation_axis,
        history_theme=rec.get("history_theme"),
    )
    score_need_rank_weighted += history_theme_candidate_boost

    w1 = float(weights.get("element", 0.0))
    w2 = float(weights.get("need", 0.0))
    w3 = float(weights.get("popular", 0.0))
    w4 = float(weights.get("distance", 0.0))
    w5 = 0.35
    direction_result = _resolve_direction_bonus(
        rec=rec,
        birthdate=birthdate,
        user_origin=user_origin,
    )
    direction_bonus = min(float(direction_result["bonus"]), DIRECTION_BONUS_MAX)
    direction_reason = direction_result["reason"]

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

    user_visit_style_tag_set = {
        str(t).strip()
        for t in (visit_style_tags or set())
        if isinstance(t, str) and str(t).strip()
    }
    shrine_visit_style_tag_set = {
        str(t).strip()
        for t in (rec.get("visit_style_tags") or [])
        if isinstance(t, str) and str(t).strip()
    }
    matched_visit_style_tags = sorted(user_visit_style_tag_set & shrine_visit_style_tag_set)
    score_visit_style = len(matched_visit_style_tags)

    context_profile = _build_context_profile(
        distance_m=distance_m,
        score_distance=score_distance,
        user_visit_style_tags=user_visit_style_tag_set,
        shrine_visit_style_tags=shrine_visit_style_tag_set,
        matched_visit_style_tags=matched_visit_style_tags,
        score_visit_style=score_visit_style,
        direction_bonus=direction_bonus,
        direction_reason=direction_reason,
    )

    # score_total:
    #   API 契約用の公開スコア。
    #   画面表示や explanation の基本値として使う。
    # _score_total:
    #   実際の並び順に使う内部ランキング用スコア。
    #   need の強一致・距離減衰まで含めた ranked score を入れる。
    score_total = score_element * w1 + score_need * w2 + score_popular * w3 + astro_bonus

    # shrine_id_int is already computed above for use in behavior_breakdown etc.

    behavior_breakdown = calculate_shrine_behavior_signal_breakdown(
        user=user,
        shrine_id=shrine_id_int,
    )
    behavior_signal = float(behavior_breakdown.get("total") or 0.0)
    visit_signal = float(behavior_breakdown.get("visit_signal") or 0.0)
    reflection_signal = float(behavior_breakdown.get("reflection_signal") or 0.0)
    action_state = classify_shrine_action_state(
        user=user,
        shrine_id=shrine_id_int,
    )
    reflection_hint = build_recent_reflection_hint(
        user=user,
        shrine_id=shrine_id_int,
    )
    rec["action_state"] = action_state
    rec["reflection_hint"] = reflection_hint
    behavior_weight = 0.1
    behavior_contribution = float(behavior_signal) * behavior_weight

    score_total_ranked_base = (
        score_element * w1
        + score_need_rank_weighted * w2
        + score_popular * w3
        + score_distance * w4
        + score_visit_style * w5
        + astro_bonus
    )
    # 行動の影響を相談内容に対して最大30％または0.5に制限
    behavior_cap = min(score_total_ranked_base * 0.3, 0.5)
    capped_behavior_contribution = min(behavior_contribution, behavior_cap)
    behavior_ratio = (
        capped_behavior_contribution / score_total_ranked_base
        if score_total_ranked_base > 0
        else 0.0
    )
    behavior_profile = _build_behavior_profile(
        action_state=action_state,
        behavior_breakdown=behavior_breakdown,
        behavior_signal=behavior_signal,
        behavior_contribution=behavior_contribution,
        capped_behavior_contribution=capped_behavior_contribution,
        behavior_ratio=behavior_ratio,
        visit_signal=visit_signal,
        reflection_signal=reflection_signal,
        reflection_hint=reflection_hint,
    )
    # Behavior Profile v1: light signals のみ（visit / reflection は含まない）
    light_behavior = calculate_light_behavior_profile_breakdown(behavior_breakdown=behavior_breakdown)

    # Action Profile v1: visit_signal のみ（スコアへの加算はまだしない）
    action_profile = calculate_action_profile_breakdown(behavior_breakdown=behavior_breakdown)

    # Reflection Profile v1: reflection_signal のみ（意味解析はまだしない）
    reflection_profile = calculate_reflection_profile_breakdown(behavior_breakdown=behavior_breakdown)

    # profile_context 補助シグナル（最大 +0.02、主重みには影響しない）
    profile_signal_score, profile_signal_matched = _score_profile_signal(rec, profile_context)

    # direction_profile 補助シグナル（最大 +0.02、候補に方位情報がある場合のみ加算）
    direction_signal_score, direction_signal_matched = _score_direction_signal(rec, profile_context, user_origin)

    # For now, direction_bonus is 0.0 and does not reverse ranking
    score_total_ranked = (
        score_total_ranked_base
        + capped_behavior_contribution
        + profile_signal_score
        + direction_signal_score
    )

    rec["_score_total"] = float(score_total_ranked)

    rec["breakdown"] = {
        "score_element": int(score_element),
        "score_need": int(score_need),
        "score_popular": float(score_popular),
        "score_total": float(score_total),
        "direction_bonus": float(direction_bonus),
        "weights": {
            "element": float(w1),
            "need": float(w2),
            "popular": float(w3),
            "direction_bonus": 0.0,
        },
        "matched_need_tags": matched_all,
        "need_evidence_winner_by_tag": dict(need_evidence_winner_by_tag),
        "profile_signal": {
            "score": float(profile_signal_score),
            "matched": profile_signal_matched,
            "reason": "profile_context補助" if profile_signal_matched else None,
        },
        "direction_signal": {
            "score": float(direction_signal_score),
            "matched": direction_signal_matched,
            "reason": "予定日の参考方位一致" if direction_signal_matched else "方位条件未適用",
        },
        "behavior_profile": {
            "score": float(light_behavior["total"]),
            "detail_view_signal": float(light_behavior["detail_view_signal"]),
            "route_open_signal": float(light_behavior["route_open_signal"]),
            "save_signal": float(light_behavior["save_signal"]),
            "reason": "light_behavior_only",
        },
        "action_profile": {
            "score": float(action_profile["score"]),
            "visit_signal": float(action_profile["visit_signal"]),
            "status": str(action_profile["status"]),
            "reason": str(action_profile["reason"]),
        },
        "reflection_profile": {
            "score": float(reflection_profile["score"]),
            "reflection_signal": float(reflection_profile["reflection_signal"]),
            "status": str(reflection_profile["status"]),
            "reason": str(reflection_profile["reason"]),
        },
    }

    # Score v3 統合（shadow モード: 既存 score_total / sort 順に影響しない）
    score_v3_breakdown = build_recommendation_score_v3_breakdown(
        state_signal=float(score_need),
        history_signal=resolve_score_v3_history_signal(
            consultation_axis=consultation_axis,
            history_theme=rec.get("history_theme"),
        ),
        distance_signal=float(score_distance),
        behavior_profile={"total": light_behavior["total"]},
        profile_signal={"score": profile_signal_score},
        direction_signal={"score": direction_signal_score},
        action_profile=action_profile,
        reflection_profile=reflection_profile,
    )
    rec["breakdown"]["score_v3"] = float(score_v3_breakdown["score"])
    rec["breakdown"]["score_v3_detail"] = score_v3_breakdown

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
                "history_theme_candidate_boost": float(history_theme_candidate_boost),
                "weight": float(w2),
                "matched_tags": matched_all,
                "matched_by_tag_count": len(matched_by_tag),
                "matched_by_text_count": len(matched_by_text),
                "matched_by_gid_count": len(matched_by_gid),
                "contribution": float(score_need * w2),
                "rank_contribution": float(score_need_rank * w2),
                "rank_weighted_contribution": float(score_need_rank_weighted * w2),
            },
            "history_theme_candidate_boost": {
                "raw": float(history_theme_candidate_boost),
                "weight": float(w2),
                "contribution": float(history_theme_candidate_boost * w2),
                "consultation_axis": str(consultation_axis or "") or None,
                "history_theme": str(rec.get("history_theme") or "") or None,
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
            "visit_style": {
                "raw": int(score_visit_style),
                "weight": float(w5),
                "matched_tags": matched_visit_style_tags,
                "contribution": float(score_visit_style * w5),
            },
            "behavior": {
                "raw": float(behavior_signal),
                "weight": float(behavior_weight),
                "contribution": float(behavior_contribution),
                "capped_contribution": float(capped_behavior_contribution),
                "cap": float(behavior_cap),
                "ratio": float(behavior_ratio),
                "detail_view_signal": float(behavior_breakdown.get("detail_view_signal") or 0.0),
                "route_open_signal": float(behavior_breakdown.get("route_open_signal") or 0.0),
                "save_signal": float(behavior_breakdown.get("save_signal") or 0.0),
                "visit_signal": float(visit_signal),
                "reflection_signal": float(reflection_signal),
            },
            "reflection_hint": reflection_hint,
            "direction_bonus": {
                "raw": float(direction_bonus),
                "weight": 1.0,
                "contribution": float(direction_bonus),
                "reason": direction_reason,
                "max": float(DIRECTION_BONUS_MAX),
            },
            "astro_bonus": float(astro_bonus) if astro_bonus_enabled else 0.0,
            "profile_signal": {
                "raw": float(profile_signal_score),
                "weight": 1.0,
                "contribution": float(profile_signal_score),
                "matched": profile_signal_matched,
                "max": float(PROFILE_SIGNAL_MAX),
            },
            "direction_signal": {
                "raw": float(direction_signal_score),
                "weight": 1.0,
                "contribution": float(direction_signal_score),
                "matched": direction_signal_matched,
                "max": float(DIRECTION_SIGNAL_MAX),
                "reason": "予定日の参考方位一致" if direction_signal_matched else "方位条件未適用",
            },
            "score_total_ranked_base": float(score_total_ranked_base),
            "capped_behavior_contribution": float(capped_behavior_contribution),
            "behavior_ratio": float(behavior_ratio),
            "score_total_ranked": float(score_total_ranked),
        },
    }

    score_v2_result = calculate_recommendation_score_v2(
        ScoreV2Input(
            score_total_ranked=float(score_total_ranked),
            score_total_ranked_base=float(score_total_ranked_base),
            score_need_rank_weighted=float(score_need_rank_weighted),
            score_need=int(score_need),
            score_visit_style=int(score_visit_style),
            score_element=int(score_element),
            score_distance=float(score_distance),
            score_popular=float(score_popular),
            astro_bonus=float(astro_bonus) if astro_bonus_enabled else 0.0,
            direction_bonus=float(direction_bonus),
            direction_reason=direction_reason,
            behavior_signal=float(behavior_signal),
            behavior_contribution=float(behavior_contribution),
            capped_behavior_contribution=float(capped_behavior_contribution),
            behavior_ratio=float(behavior_ratio),
            visit_signal=float(visit_signal),
            reflection_signal=float(reflection_signal),
            need_weight=float(w2),
            element_weight=float(w1),
            distance_weight=float(w4),
            popular_weight=float(w3),
            visit_style_weight=float(w5),
            matched_need_tags=matched_all,
            matched_by_tag=matched_by_tag,
            matched_by_text=matched_by_text,
            matched_by_gid=matched_by_gid,
            matched_visit_style_tags=matched_visit_style_tags,
            matched_user_selected_goriyaku_tag_ids=matched_by_user_selected_gid,
            context_profile=context_profile,
            shrine_meaning_profile=shrine_meaning_profile,
            behavior_profile=behavior_profile,
            behavior_breakdown=behavior_breakdown,
            reflection_hint=reflection_hint,
        )
    )
    rec["score_v2"] = score_v2_result.as_dict()

    reason_facts = _build_reason_facts(
        matched_by_tag=matched_by_tag,
        matched_by_gid=matched_by_gid,
        matched_by_text=matched_by_text,
        matched_by_user_selected_gid=matched_by_user_selected_gid,
        goriyaku_tag_label_by_id=goriyaku_tag_label_by_id,
        text_score_by_tag=text_score_by_tag,
        score_element=score_element,
        astro_bonus_enabled=astro_bonus_enabled,
        shrine_meaning_profile=shrine_meaning_profile,
        matched_visit_style_tags=matched_visit_style_tags,
        history_theme_candidate_boost=history_theme_candidate_boost,
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
    rec["reason_facts"] = reason_facts
    rec["_primary_reason_source"] = str(primary_reason.get("type") or "")
    rec["_primary_reason_label"] = str(primary_reason.get("label") or "")
    entry_context = _build_entry_context(query=query, birthdate=birthdate)
    rec["rank_explanation"] = _to_rank_explanation(rec=rec, entry_context=entry_context)

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
            "[dbg] attach_breakdown shrine_id=%r name=%r need_tags=%r prefilter_matched=%r matched_by_tag=%r matched_by_text=%r matched_by_gid=%r matched_by_user_selected_gid=%r matched_all=%r score_need=%r need_score_reason=%r primary_reason_source=%r primary_reason_label=%r",
            rec.get("shrine_id"),
            rec.get("name"),
            need_tags_clean,
            (rec.get("_prefilter_debug") or {}).get("matched"),
            matched_by_tag,
            matched_by_text,
            matched_by_gid,
            matched_by_user_selected_gid,
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
    consultation_axis: str | None = None,
) -> List[Dict[str, Any]]:
    scored: List[tuple[float, float, str, Dict[str, Any]]] = []

    need_tags_clean = _normalize_need_tags(need_tags, max_tags=10)
    is_study_need = "study" in need_tags_clean

    for c in candidates:
        if not isinstance(c, dict):
            continue

        astro_tags = c.get("astro_tags") or []
        if not isinstance(astro_tags, list):
            astro_tags = []
        astro_tag_set = {
            str(t).strip() for t in astro_tags if isinstance(t, str) and str(t).strip()
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

        history_theme_candidate_boost = resolve_history_theme_candidate_boost(
            consultation_axis=consultation_axis,
            history_theme=c.get("history_theme"),
        )
        if history_theme_candidate_boost > 0:
            score += history_theme_candidate_boost
            matched.append(f"history_theme:{c.get('history_theme')}")

        row = dict(c)
        row["_prefilter_debug"] = {
            "score": score,
            "matched": matched,
            "text_score_by_tag": text_score_by_tag,
            "matched_text_hints_by_tag": matched_text_hints_by_tag,
            "matched_gid_tags": matched_gid_tags,
            "history_theme_candidate_boost": float(history_theme_candidate_boost),
            "consultation_axis": str(consultation_axis or "") or None,
            "history_theme": str(c.get("history_theme") or "") or None,
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
                str(t).strip() for t in tags if isinstance(t, str) and str(t).strip()
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
            str(t).strip() for t in picked_tags if isinstance(t, str) and str(t).strip()
        )

    picked.extend(pool)
    return picked


def _resolve_public_mode(
    *,
    mode: str | None,
    birthdate: str | None,
    query: str | None,
) -> str:
    explicit = str(mode or "").strip().lower()
    if explicit in {"need", "compat"}:
        return explicit

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


def _resolve_matched_lead_evidence(
    rec: Dict[str, Any],
    tag: str,
    need_gid_label_by_id: Optional[Dict[int, str]],
) -> tuple[Optional[str], Optional[str]]:
    """Resolve Lead evidence for `tag` from data `_prefilter_candidates_for_need`/
    `_attach_breakdown` already attached to `rec` -- no per-candidate DB query
    (docs/audit/compass-need-lead-purpose-alignment.md Phase A7/A8).

    Priority follows the C1 Max scoring winner recorded by `_attach_breakdown`
    in `rec["breakdown"]["need_evidence_winner_by_tag"]` (docs/audit/compass-
    scoring-explanation-evidence-handoff.md, USE_WINNER_FOR_LEAD_ONLY): the
    Lead cites whichever of GID/Text evidence the score actually used for
    `tag`. `_build_need_lead` itself is unchanged and always prefers a
    non-empty matched_gid_label over matched_text_hint -- when the winner is
    text, matched_gid_label is withheld here so that preference falls through
    to matched_text_hint. When no winner is recorded for `tag` (rec built
    without going through `_attach_breakdown`), this falls back to the
    pre-C1 GID-first order.
    """
    matched_gid_label: Optional[str] = None
    if need_gid_label_by_id:
        candidate_gid_set = {
            int(x)
            for x in (rec.get("goriyaku_tag_ids") or [])
            if isinstance(x, int) or (isinstance(x, str) and str(x).strip().isdigit())
        }
        expected_gids = need_tags_to_goriyaku_ids([tag])
        matched_gids = sorted(candidate_gid_set & expected_gids & set(need_gid_label_by_id.keys()))
        if matched_gids:
            matched_gid_label = need_gid_label_by_id.get(matched_gids[0])

    winner = ((rec.get("breakdown") or {}).get("need_evidence_winner_by_tag") or {}).get(tag)

    matched_text_hint: Optional[str] = None
    if winner == "text" or not matched_gid_label:
        hints = ((rec.get("_prefilter_debug") or {}).get("matched_text_hints_by_tag") or {}).get(tag) or []
        if hints:
            text_weights = NEED_TEXT_WEIGHTS.get(tag, {})
            matched_text_hint = max(hints, key=lambda h: text_weights.get(h, 0))

    if winner == "text":
        # Withhold matched_gid_label so _build_need_lead's unchanged
        # gid-first check falls through to matched_text_hint.
        return None, matched_text_hint

    return matched_gid_label, matched_text_hint


def build_recommendation_reason(
    rec: Dict[str, Any],
    *,
    public_mode: PublicMode,
    birthdate: Optional[str],
    need_tags: List[str],
    need_gid_label_by_id: Optional[Dict[int, str]] = None,
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
        str(tag).strip() for tag in matched if isinstance(tag, str) and str(tag).strip()
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
        matched_gid_label, matched_text_hint = _resolve_matched_lead_evidence(
            rec, primary_label, need_gid_label_by_id
        )
        return _build_need_reason_text(
            primary_label,
            name=name,
            goriyaku=goriyaku,
            matched_gid_label=matched_gid_label,
            matched_text_hint=matched_text_hint,
        )

    if matched_tags:
        matched_gid_label, matched_text_hint = _resolve_matched_lead_evidence(
            rec, matched_tags[0], need_gid_label_by_id
        )
        return _build_need_reason_text(
            matched_tags[0],
            name=name,
            goriyaku=goriyaku,
            matched_gid_label=matched_gid_label,
            matched_text_hint=matched_text_hint,
        )

    if name:
        return f"{name}は、今の悩みや願いに合わせて参拝先の候補に入れています。"
    return "今の悩みや願いに合わせた参拝先の候補としておすすめしています。"


def _build_need_lead(
    tag: str,
    goriyaku: str,
    *,
    matched_gid_label: str | None = None,
    matched_text_hint: str | None = None,
) -> str:
    # Evidence Chain (docs/audit/compass-need-lead-purpose-alignment.md
    # Option C): matched goriyaku_tag label -> matched text_hint -> Purpose
    # fallback -> generic. `goriyaku`'s own first-listed item is no longer
    # used -- it is not matched evidence for `tag` and produced Purpose-
    # unrelated leads (see the audit's MISALIGNED cases). Kept as a
    # parameter only for call-site/signature stability.
    if matched_gid_label:
        return matched_gid_label
    if matched_text_hint:
        return matched_text_hint

    fallback = {
        "study": "学業成就",
        "mental": "心願成就",
        "rest": "心身浄化",
        "love": "良縁成就",
        "career": "仕事運",
        "money": "金運",
        "courage": "開運",
        # NEED_TO_GORIYAKU_IDS["protection"]の主要な一致先である実在
        # GoriyakuTag「厄除け」(id=2) をそのまま短いlead語として使う。
        "protection": "厄除け",
    }
    return fallback.get(tag, "ご利益")


def _axis_label_ja(axis: str) -> str:
    mapping = {
        "need": "悩みとの一致",
        "element": "生年月日との相性",
        "direction": "風水・方角との相性",
        "distance": "距離",
        "popular": "定番性",
        "astro_bonus": "相性補正",
        "fallback": "近さ",
    }
    return mapping.get(axis, axis)


def _to_rank_explanation(
    *,
    rec: Dict[str, Any],
    entry_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    breakdown = rec.get("breakdown") or {}
    detail = (rec.get("breakdown_detail") or {}).get("features") or {}

    primary_source = str(rec.get("_primary_reason_source") or "").strip()
    primary_label = str(rec.get("_primary_reason_label") or "").strip()

    need_feature = detail.get("need") or {}
    element_feature = detail.get("element") or {}
    direction_feature = detail.get("direction") or {}
    popular_feature = detail.get("popular") or {}
    distance_feature = detail.get("distance") or {}

    contributors = [
        {
            "axis": "need",
            "axis_ja": _axis_label_ja("need"),
            "raw": float(need_feature.get("rank_weighted") or 0.0),
            "weight": float(need_feature.get("weight") or 0.0),
            "contribution": float(need_feature.get("rank_weighted_contribution") or 0.0),
        },
        {
            "axis": "element",
            "axis_ja": _axis_label_ja("element"),
            "raw": float(element_feature.get("raw") or 0.0),
            "weight": float(element_feature.get("weight") or 0.0),
            "contribution": float(element_feature.get("contribution") or 0.0),
        },
        {
            "axis": "direction",
            "axis_ja": _axis_label_ja("direction"),
            "raw": float(direction_feature.get("raw") or 0.0),
            "weight": float(direction_feature.get("weight") or 0.0),
            "contribution": float(direction_feature.get("contribution") or 0.0),
        },
        {
            "axis": "distance",
            "axis_ja": _axis_label_ja("distance"),
            "raw": float(distance_feature.get("raw") or 0.0),
            "weight": float(distance_feature.get("weight") or 0.0),
            "contribution": float(distance_feature.get("contribution") or 0.0),
        },
        {
            "axis": "popular",
            "axis_ja": _axis_label_ja("popular"),
            "raw": float(popular_feature.get("raw") or 0.0),
            "weight": float(popular_feature.get("weight") or 0.0),
            "contribution": float(popular_feature.get("contribution") or 0.0),
        },
    ]

    astro_bonus = float(detail.get("astro_bonus") or 0.0)
    if astro_bonus > 0:
        contributors.append(
            {
                "axis": "astro_bonus",
                "axis_ja": _axis_label_ja("astro_bonus"),
                "raw": astro_bonus,
                "weight": 1.0,
                "contribution": astro_bonus,
            }
        )

    contributors = sorted(
        contributors,
        key=lambda x: (-float(x.get("contribution") or 0.0), str(x.get("axis") or "")),
    )

    top_contributors = [c for c in contributors if float(c.get("contribution") or 0.0) > 0][:2]

    primary_axis = "fallback"
    if primary_source in {"user_selected_tag", "need_tag", "goriyaku_tag", "text_hint"}:
        primary_axis = "need"
    elif primary_source == "element":
        primary_axis = "element"

    if primary_label == "element":
        primary_label_ja = "生年月日との相性"
    else:
        primary_label_ja = _need_tag_to_ja(primary_label) if primary_label else None

    summary_parts: List[str] = []

    if primary_axis == "need" and primary_label_ja:
        summary_parts.append(f"相談内容との一致は「{primary_label_ja}」が主因です")
    elif primary_axis == "element":
        summary_parts.append("生年月日との相性が主因です")
    else:
        summary_parts.append("近さや候補条件を含めた総合順位です")

    if top_contributors:
        tail = "・".join(c["axis_ja"] for c in top_contributors)
        summary_parts.append(f"特に {tail} が順位を押し上げています")

    return {
        "version": 1,
        "entry_context": entry_context or {},
        "primary_axis": primary_axis,
        "primary_axis_ja": _axis_label_ja(primary_axis),
        "primary_reason_source": primary_source or "fallback",
        "primary_label": primary_label or None,
        "primary_label_ja": primary_label_ja,
        "matched_need_tags": list(breakdown.get("matched_need_tags") or []),
        "score_total": float(breakdown.get("score_total") or 0.0),
        "score_total_ranked": float(detail.get("score_total_ranked") or 0.0),
        "contributors": contributors,
        "top_contributors": top_contributors,
        "summary": "。".join(summary_parts) + "。",
    }


# New helper function: _attach_rank_comparison
def _attach_rank_comparison(
    recs: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    items = [r for r in recs if isinstance(r, dict)]
    if not items:
        return items

    top = items[0]
    top_score = float(top.get("_score_total") or 0.0)
    top_need_tags = list(((top.get("breakdown") or {}).get("matched_need_tags") or []))
    top_primary = str(top.get("_primary_reason_label") or "").strip()
    top_name = str(top.get("name") or "").strip()

    for index, rec in enumerate(items):
        rank_explanation = rec.get("rank_explanation") or {}
        rec_score = float(rec.get("_score_total") or 0.0)
        gap_from_top = round(top_score - rec_score, 6)

        shared_need_tags = [
            tag
            for tag in list(((rec.get("breakdown") or {}).get("matched_need_tags") or []))
            if tag in top_need_tags
        ]
        shared_need_tags_ja = [_need_tag_to_ja(tag) for tag in shared_need_tags]

        same_primary_reason = str(rec.get("_primary_reason_label") or "").strip() == top_primary

        comparison: Dict[str, Any] = {
            "version": 1,
            "rank": index + 1,
            "is_top": index == 0,
            "top_name": top_name or None,
            "gap_from_top": gap_from_top,
            "same_primary_reason": same_primary_reason,
            "shared_need_tags": shared_need_tags,
            "shared_need_tags_ja": shared_need_tags_ja,
            "top_summary": rank_explanation.get("summary") if index == 0 else None,
            "comparison_summary": None,
        }

        if index == 0:
            comparison["comparison_summary"] = "この神社が現在の1位です。"
        else:
            shared_label_text = "・".join(shared_need_tags_ja) if shared_need_tags_ja else ""

            if gap_from_top == 0:
                if shared_need_tags_ja:
                    comparison["comparison_summary"] = (
                        f"1位と同点です。共通する悩み軸は「{shared_label_text}」で、"
                        f"並び順上はこの順位になっています。"
                    )
                else:
                    comparison["comparison_summary"] = (
                        "1位と同点ですが、重なる主軸は異なり、並び順上はこの順位になっています。"
                    )
            else:
                if shared_need_tags_ja:
                    comparison["comparison_summary"] = (
                        f"1位と共通する悩み軸は「{shared_label_text}」です。"
                        f"1位との差は {gap_from_top:.2f} です。"
                    )
                else:
                    comparison["comparison_summary"] = (
                        f"1位とは別の軸で選ばれており、1位との差は {gap_from_top:.2f} です。"
                    )

        rec["rank_comparison"] = comparison

    return items


def _build_need_reason_text(
    tag: str,
    *,
    name: str = "",
    goriyaku: str = "",
    matched_gid_label: str | None = None,
    matched_text_hint: str | None = None,
) -> str:
    intent_map = {
        "study": "学業や合格",
        "mental": "不安や心の安定",
        "rest": "休息や気持ちの切り替え",
        "love": "恋愛や良縁",
        "career": "仕事や転機",
        "money": "金運向上",
        "courage": "前進や後押し",
        # NEED_LABELS_JA["protection"]（"厄除け・守り"）と同じ2語を、
        # 既存の「AやB」文型へそのまま流し込む。新しい意味解釈は加えない
        # (docs/audit/compass-protection-signal-completion.md Phase 6/7)。
        "protection": "厄除けや守り",
        # 縁結び（GoriyakuTag id=1、結婚を願う相談）と夫婦円満（id=18、既に
        # ある夫婦関係を願う相談）の両方を1語で言い切らず、"良縁"（marriage
        # の実キーワードの一つ、temples/domain/need_tags.py KEYWORDS
        # ["marriage"]）と"夫婦円満"（id=18の実ラベルそのもの）をそのまま
        # 組み合わせる。"恋愛"を含めず"love"の"恋愛や良縁"と区別しつつ、
        # 結婚成立や関係修復を保証する断定表現も避ける
        # (docs/audit/marriage-reason-copy-implementation.md)。
        "marriage": "良縁や夫婦円満",
        "relationship": "人間関係の改善や修復",
        "health": "健康や体調の安定",
        "focus": "集中や習慣づくり",
        "travel_safe": "移動や旅の安全",
        # family の M1 後マッピング {16, 35} の実ラベルそのもの
        # （子宝 = id=35、安産 = id=16）を、既存の「AやB」文型へそのまま
        # 流し込む。Mother Ship 2026-08-29: Family = NARROW / DROP_ALL
        # （docs/audit/remaining-need-semantic-decision-packets.md
        # 「## Mother Ship Decisions」）で family は fertility / childbirth /
        # parenting に限定されており、家庭円満・家族関係の修復・対人関係へ
        # 広げる語は含めない。断定的・超自然的な表現も避ける。
        "family": "子宝や安産",
    }

    user_intent = intent_map.get(tag, "今の願い")

    if name:
        lead = _build_need_lead(
            tag,
            goriyaku,
            matched_gid_label=matched_gid_label,
            matched_text_hint=matched_text_hint,
        )
        return f"{lead}のご利益で知られる{name}は、{user_intent}を願う参拝先として適しています。"

    mapping = {
        "study": "学業や合格を願う今の気持ちに寄り添いやすく、参拝にも向いています。",
        "mental": "不安や心を整えたい今の気持ちに寄り添いやすく、参拝にも向いています。",
        "rest": "気持ちを静かに整えて、ひと息つきたい時の参拝に向いています。",
        "love": "恋愛やご縁を願う今の気持ちに寄り添いやすく、参拝にも向いています。",
        "career": "仕事や転機を後押ししたい今の願いに寄り添いやすく、参拝にも向いています。",
        "money": "金運や仕事の流れを整えたい今の願いに寄り添いやすく、参拝にも向いています。",
        "courage": "前に進みたい、流れを変えたい今の気持ちを後押しする参拝に向いています。",
        # study/loveと同じ「〜を願う今の気持ちに寄り添いやすく」文型を再利用。
        "protection": "厄除けや守りを願う今の気持ちに寄り添いやすく、参拝にも向いています。",
    }
    return mapping.get(tag, "今の悩みや願いに寄り添いやすい神社としておすすめしています。")


__all__ = [
    "NEED_TEXT_WEIGHTS",
    "STUDY_SHRINE_HINTS",
    "_score_profile_signal",
    "_score_direction_signal",
    "_clamp01",
    "_distance_decay",
    "_resolve_public_mode",
    "_resolve_flow_from_mode",
    "_resolve_mode_weights",
    "_resolve_mode_meta",
    "_build_entry_context",
    "_resolve_direction_bonus",
    "_attach_breakdown",
    "_attach_rank_comparison",
    "_prefilter_candidates_for_need",
    "_diversify_by_need",
    "build_recommendation_reason",
    "resolve_score_v3_mode",
    "resolve_score_v3_mode_detail",
    "resolve_score_sort_key",
    "resolve_score_v3_history_signal",
    "resolve_history_theme_candidate_boost",
    "PRIMARY_TIER_REASON_TYPES",
    "has_primary_tier_reason",
]
