"""Shrine Meaning payload response shaping by plan.

責務:
- composer が生成した完全 payload を、plan に応じて削るだけ
- composer 側の生成責務には一切踏み込まない
- client 由来の plan 指定は受け取らない（呼び出し側が resolve_plan_context の結果を渡す）

方針:
- 既定は fail closed。未知の plan / 未知の access は premium 扱いで落とす
- premium 本文は「復元可能な形で残さない」
  - generated の premium 本文
  - display.blocks の premium block body
  - source.interpretationProfile / translationResult（premium 本文の復元経路）
- public / free 情報は維持する
"""

from __future__ import annotations

from typing import Any, Mapping

# plan ごとに応答へ残してよい access level。
# anonymous も free 情報は維持する（public/free 情報は plan に関係なく返す）。
PLAN_ALLOWED_ACCESS_LEVELS: dict[str, frozenset[str]] = {
    "anonymous": frozenset({"anonymous", "free"}),
    "free": frozenset({"anonymous", "free"}),
    "premium": frozenset({"anonymous", "free", "premium"}),
}

# 未知の plan / access を受け取った時の既定。
_FALLBACK_ALLOWED_ACCESS_LEVELS: frozenset[str] = PLAN_ALLOWED_ACCESS_LEVELS["anonymous"]
_UNKNOWN_ACCESS_LEVEL = "premium"

# generated のうち premium 本文にあたるキー。
# actionMeaning は frontend の型ガードが string 必須のため、
# 本文を落としたうえで空文字として型だけ維持する。
PREMIUM_GENERATED_REQUIRED_TEXT_FIELDS: tuple[str, ...] = ("actionMeaning",)

PREMIUM_GENERATED_OPTIONAL_TEXT_FIELDS: tuple[str, ...] = (
    "afterVisitReflection",
    "historyContext",
    "deitySymbolContext",
    "benefitActionContext",
    "todayFlowContext",
)

# premium 本文をクライアント側で再構成できてしまう source フィールド。
# translationResult は action_context / reflection_question_seed / history_theme を持ち、
# interpretationProfile は translate_meaning() で translationResult を決定的に再生成できる。
PREMIUM_SOURCE_RESTORATION_FIELDS: tuple[str, ...] = (
    "interpretationProfile",
    "translationResult",
)

_EMPTY_DISPLAY_FALLBACK_MESSAGE = "神社の意味情報はまだ準備中です。"


def allowed_access_levels_for_plan(plan: str | None) -> frozenset[str]:
    """plan から応答へ残してよい access level を返す。未知の plan は anonymous 相当。"""

    if not isinstance(plan, str):
        return _FALLBACK_ALLOWED_ACCESS_LEVELS
    return PLAN_ALLOWED_ACCESS_LEVELS.get(plan, _FALLBACK_ALLOWED_ACCESS_LEVELS)


def _shape_generated(generated: Mapping[str, Any], *, premium_allowed: bool) -> dict[str, Any]:
    shaped = dict(generated)
    if premium_allowed:
        return shaped

    for key in PREMIUM_GENERATED_REQUIRED_TEXT_FIELDS:
        if key in shaped:
            shaped[key] = ""
    for key in PREMIUM_GENERATED_OPTIONAL_TEXT_FIELDS:
        if key in shaped:
            shaped[key] = None
    return shaped


def _shape_source(source: Mapping[str, Any], *, premium_allowed: bool) -> dict[str, Any]:
    shaped = dict(source)
    if premium_allowed:
        return shaped

    for key in PREMIUM_SOURCE_RESTORATION_FIELDS:
        if key in shaped:
            shaped[key] = None
    return shaped


def _shape_display(
    display: Mapping[str, Any],
    *,
    allowed_access_levels: frozenset[str],
) -> dict[str, Any]:
    shaped = dict(display)

    raw_blocks = shaped.get("blocks")
    blocks = list(raw_blocks) if isinstance(raw_blocks, list) else []

    kept_blocks: list[Any] = []
    for block in blocks:
        if not isinstance(block, Mapping):
            # 想定外の block 形状は fail closed で落とす
            continue
        access = block.get("access")
        if not isinstance(access, str):
            access = _UNKNOWN_ACCESS_LEVEL
        if access not in allowed_access_levels:
            continue
        kept_blocks.append(dict(block))

    shaped["blocks"] = kept_blocks
    if not kept_blocks and not shaped.get("fallbackMessage"):
        shaped["fallbackMessage"] = _EMPTY_DISPLAY_FALLBACK_MESSAGE
    return shaped


def shape_shrine_meaning_payload_for_plan(payload: Mapping[str, Any], *, plan: str | None) -> dict[str, Any]:
    """完全 payload を plan に応じて削った新しい payload を返す。

    - 入力 payload は変更しない
    - premium 以外では premium 本文とその復元経路を落とす
    - payload の構造（version / source / generated / display のキー）は維持する
    """

    allowed_access_levels = allowed_access_levels_for_plan(plan)
    premium_allowed = "premium" in allowed_access_levels

    shaped: dict[str, Any] = dict(payload)

    source = shaped.get("source")
    if isinstance(source, Mapping):
        shaped["source"] = _shape_source(source, premium_allowed=premium_allowed)

    generated = shaped.get("generated")
    if isinstance(generated, Mapping):
        shaped["generated"] = _shape_generated(generated, premium_allowed=premium_allowed)

    display = shaped.get("display")
    if isinstance(display, Mapping):
        shaped["display"] = _shape_display(display, allowed_access_levels=allowed_access_levels)

    return shaped


__all__ = [
    "PLAN_ALLOWED_ACCESS_LEVELS",
    "PREMIUM_GENERATED_OPTIONAL_TEXT_FIELDS",
    "PREMIUM_GENERATED_REQUIRED_TEXT_FIELDS",
    "PREMIUM_SOURCE_RESTORATION_FIELDS",
    "allowed_access_levels_for_plan",
    "shape_shrine_meaning_payload_for_plan",
]
