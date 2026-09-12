"""Weekly Theme Catalog v1（Presentation Copy）.

Weekly Theme は **Presentation Copy であって Recommendation Signal ではない**。
候補生成・filtering・ranking・Reason には一切影響させない。この module は
Shrine も Recommendation も参照せず、`purpose` と deterministic seed だけから
表示文言を選ぶ。

v1 では LLM を使わない。監査可能な versioned curated catalog（コード上で
全文を読める固定catalog）から deterministic に1件を選ぶ。

方位の扱い:
`direction_fingerprint` は deterministic seed の一部としてのみ使う。
「北だから○○」「南西だから△△」のような KAMI MUSUBI 独自の方位象徴体系は
作らない -- catalog の文言は purpose のみに由来し、方位に言及しない。

purpose authority:
purpose slug の正本は `temples.domain.need_tags.NEED_TAGS`（15 tags）である。
ここで独自の purpose を新設しない。
"""

from __future__ import annotations

import logging
from typing import Any, Mapping

from temples.domain.need_tags import NEED_TAGS
from temples.domain.weekly_presentation import build_weekly_theme_seed, stable_index

log = logging.getLogger(__name__)

# Catalog の版。将来 catalog を差し替えた際に「どの版で選ばれた文言か」を
# 追えるようにするための識別子で、Snapshot の presentation_version とは
# 別概念（presentation_version は Weekly Presentation 全体の版）。
WEEKLY_THEME_CATALOG_VERSION = "weekly_theme_catalog_v1"

THEME_KEY_FIELD = "key"
THEME_TITLE_FIELD = "title"
THEME_MESSAGE_FIELD = "message"

# Theme生成に失敗した場合の固定Fallback。断定的・宗教的・心理的に強い表現を
# 避けた、状態を決めつけない文言のみを置く。
WEEKLY_FALLBACK_THEME: Mapping[str, str] = {
    THEME_KEY_FIELD: "weekly_default",
    THEME_TITLE_FIELD: "今週のテーマ",
    THEME_MESSAGE_FIELD: "今週は、無理のない範囲でできることを一つだけ選んでみてください。",
}

# purpose ごとの curated Theme 候補。
#
# v1 の方針は「構造を成立させること」であり、大量のコピーは作らない。
# 各 purpose に最小限（2件）の安全な候補だけを置く。文言はいずれも
# 断定（必ず〜なる）・宗教的効能・利用者の心理状態の決めつけを含まない。
WEEKLY_THEME_CATALOG_V1: Mapping[str, tuple[Mapping[str, str], ...]] = {
    "love": (
        {
            THEME_KEY_FIELD: "love_pace",
            THEME_TITLE_FIELD: "歩幅をそろえる",
            THEME_MESSAGE_FIELD: "相手との距離のとり方を、今週は少しゆっくり考えてみる。",
        },
        {
            THEME_KEY_FIELD: "love_words",
            THEME_TITLE_FIELD: "言葉にしてみる",
            THEME_MESSAGE_FIELD: "伝えそびれていたことを、今週は一つだけ言葉にしてみる。",
        },
    ),
    "relationship": (
        {
            THEME_KEY_FIELD: "relationship_listen",
            THEME_TITLE_FIELD: "聞く側にまわる",
            THEME_MESSAGE_FIELD: "今週は、話すより聞く時間を少し多めにとってみる。",
        },
        {
            THEME_KEY_FIELD: "relationship_distance",
            THEME_TITLE_FIELD: "間合いを見直す",
            THEME_MESSAGE_FIELD: "近い関係と遠い関係を、今週は一度並べて眺めてみる。",
        },
    ),
    "marriage": (
        {
            THEME_KEY_FIELD: "marriage_small_promise",
            THEME_TITLE_FIELD: "小さな約束",
            THEME_MESSAGE_FIELD: "大きな決断より、今週は小さな約束を一つ守ってみる。",
        },
        {
            THEME_KEY_FIELD: "marriage_share",
            THEME_TITLE_FIELD: "分け合う",
            THEME_MESSAGE_FIELD: "ひとりで抱えていたことを、今週は一つだけ分けてみる。",
        },
    ),
    "communication": (
        {
            THEME_KEY_FIELD: "communication_first_word",
            THEME_TITLE_FIELD: "最初のひと言",
            THEME_MESSAGE_FIELD: "今週は、こちらから先に一言だけ声をかけてみる。",
        },
        {
            THEME_KEY_FIELD: "communication_plain",
            THEME_TITLE_FIELD: "短く伝える",
            THEME_MESSAGE_FIELD: "長く説明するより、短く伝えることを今週は試してみる。",
        },
    ),
    "career": (
        {
            THEME_KEY_FIELD: "career_next_step",
            THEME_TITLE_FIELD: "次の一歩を書き出す",
            THEME_MESSAGE_FIELD: "今週は、迷っていることを一行だけ書き出してみる。",
        },
        {
            THEME_KEY_FIELD: "career_scope",
            THEME_TITLE_FIELD: "引き受ける範囲を決める",
            THEME_MESSAGE_FIELD: "抱えている仕事の範囲に、今週は一度自分で線を引いてみる。",
        },
    ),
    "money": (
        {
            THEME_KEY_FIELD: "money_flow",
            THEME_TITLE_FIELD: "流れを眺める",
            THEME_MESSAGE_FIELD: "今週は、お金の出入りを一度だけ通して眺めてみる。",
        },
        {
            THEME_KEY_FIELD: "money_one_choice",
            THEME_TITLE_FIELD: "一つだけ決める",
            THEME_MESSAGE_FIELD: "保留にしていた支出の判断を、今週は一つだけ決めてみる。",
        },
    ),
    "study": (
        {
            THEME_KEY_FIELD: "study_small_unit",
            THEME_TITLE_FIELD: "短く区切る",
            THEME_MESSAGE_FIELD: "今週は、取り組む時間を短く区切ってみる。",
        },
        {
            THEME_KEY_FIELD: "study_revisit",
            THEME_TITLE_FIELD: "戻って確かめる",
            THEME_MESSAGE_FIELD: "先へ進む前に、今週は一度前に戻って確かめてみる。",
        },
    ),
    "health": (
        {
            THEME_KEY_FIELD: "health_rhythm",
            THEME_TITLE_FIELD: "同じ時間に",
            THEME_MESSAGE_FIELD: "今週は、起きる時間か寝る時間のどちらかをそろえてみる。",
        },
        {
            THEME_KEY_FIELD: "health_walk",
            THEME_TITLE_FIELD: "少しだけ歩く",
            THEME_MESSAGE_FIELD: "今週は、いつもより少しだけ歩く時間をとってみる。",
        },
    ),
    "mental": (
        {
            THEME_KEY_FIELD: "mental_pause",
            THEME_TITLE_FIELD: "ひと呼吸おく",
            THEME_MESSAGE_FIELD: "返事や判断の前に、今週はひと呼吸おいてみる。",
        },
        {
            THEME_KEY_FIELD: "mental_write_out",
            THEME_TITLE_FIELD: "書き出してみる",
            THEME_MESSAGE_FIELD: "頭の中にあることを、今週は一度紙に書き出してみる。",
        },
    ),
    "protection": (
        {
            THEME_KEY_FIELD: "protection_check",
            THEME_TITLE_FIELD: "足元を確かめる",
            THEME_MESSAGE_FIELD: "今週は、後回しにしていた確認を一つ済ませてみる。",
        },
        {
            THEME_KEY_FIELD: "protection_margin",
            THEME_TITLE_FIELD: "余白を残す",
            THEME_MESSAGE_FIELD: "予定を詰めすぎない余白を、今週は一つ残しておく。",
        },
    ),
    "courage": (
        {
            THEME_KEY_FIELD: "courage_small_start",
            THEME_TITLE_FIELD: "小さく始める",
            THEME_MESSAGE_FIELD: "いきなり大きく動かず、今週は小さく始めてみる。",
        },
        {
            THEME_KEY_FIELD: "courage_ask",
            THEME_TITLE_FIELD: "聞いてみる",
            THEME_MESSAGE_FIELD: "迷っていることを、今週は誰かに一度聞いてみる。",
        },
    ),
    "focus": (
        {
            THEME_KEY_FIELD: "focus_one_thing",
            THEME_TITLE_FIELD: "一つに絞る",
            THEME_MESSAGE_FIELD: "今週は、同時に進めるものを一つ減らしてみる。",
        },
        {
            THEME_KEY_FIELD: "focus_clear_view",
            THEME_TITLE_FIELD: "視界を整える",
            THEME_MESSAGE_FIELD: "手元とまわりを、今週は一度だけ整えてみる。",
        },
    ),
    "rest": (
        {
            THEME_KEY_FIELD: "rest_stop_line",
            THEME_TITLE_FIELD: "終わりを決める",
            THEME_MESSAGE_FIELD: "今週は、その日の終わりの時間を先に決めてみる。",
        },
        {
            THEME_KEY_FIELD: "rest_blank_time",
            THEME_TITLE_FIELD: "何もしない時間",
            THEME_MESSAGE_FIELD: "短くていいので、今週は何もしない時間をとってみる。",
        },
    ),
    "family": (
        {
            THEME_KEY_FIELD: "family_shared_time",
            THEME_TITLE_FIELD: "時間をそろえる",
            THEME_MESSAGE_FIELD: "今週は、短くても一緒に過ごす時間を一度つくってみる。",
        },
        {
            THEME_KEY_FIELD: "family_thanks",
            THEME_TITLE_FIELD: "言い忘れを渡す",
            THEME_MESSAGE_FIELD: "言いそびれていたお礼を、今週は一つ伝えてみる。",
        },
    ),
    "travel_safe": (
        {
            THEME_KEY_FIELD: "travel_safe_prepare",
            THEME_TITLE_FIELD: "先に整える",
            THEME_MESSAGE_FIELD: "出かける前の確認を、今週は前日までに済ませてみる。",
        },
        {
            THEME_KEY_FIELD: "travel_safe_margin",
            THEME_TITLE_FIELD: "時間に余裕を",
            THEME_MESSAGE_FIELD: "今週は、移動にかける時間を少し多めに見ておく。",
        },
    ),
}


def get_fallback_theme() -> dict[str, str]:
    """固定Fallback Themeのコピーを返す（呼び出し側の変更がcatalogへ波及しない）。"""
    return dict(WEEKLY_FALLBACK_THEME)


def select_weekly_theme(
    *,
    purpose: str,
    direction_fingerprint: str,
    week_start: Any,
    presentation_version: str,
) -> dict[str, str]:
    """同じ入力に対して常に同じ Weekly Theme を返す。

    runtime random（`random` module）も Python built-in `hash()` も使わない。
    安定hash（`weekly_presentation.stable_index`）で catalog index を決める。

    Theme の失敗は Recommendation / API 全体の失敗にしない。未知のpurpose、
    catalog不整合、想定外の例外はすべて固定Fallback Themeへ落とす。
    """
    try:
        themes = WEEKLY_THEME_CATALOG_V1.get(str(purpose or "").strip())
        if not themes:
            return get_fallback_theme()

        seed = build_weekly_theme_seed(
            week_start=week_start,
            purpose=purpose,
            direction_fingerprint=direction_fingerprint,
            presentation_version=presentation_version,
        )
        theme = themes[stable_index(seed, len(themes))]
        return {
            THEME_KEY_FIELD: theme[THEME_KEY_FIELD],
            THEME_TITLE_FIELD: theme[THEME_TITLE_FIELD],
            THEME_MESSAGE_FIELD: theme[THEME_MESSAGE_FIELD],
        }
    except Exception:  # pragma: no cover - 予期しない失敗もFallbackへ落とす
        log.warning("[weekly_theme] selection_failed purpose=%r", purpose, exc_info=True)
        return get_fallback_theme()


def known_purposes() -> tuple[str, ...]:
    """catalog が Theme を持つ purpose slug 一覧（NEED_TAGS の順序を保つ）。"""
    return tuple(tag for tag in NEED_TAGS if tag in WEEKLY_THEME_CATALOG_V1)


__all__ = [
    "WEEKLY_THEME_CATALOG_VERSION",
    "WEEKLY_THEME_CATALOG_V1",
    "WEEKLY_FALLBACK_THEME",
    "THEME_KEY_FIELD",
    "THEME_TITLE_FIELD",
    "THEME_MESSAGE_FIELD",
    "get_fallback_theme",
    "select_weekly_theme",
    "known_purposes",
]
