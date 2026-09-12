"""Weekly Compass application service（request非依存のorchestration）.

このmoduleは「既にtestされている既存Authorityを、安全な順序で呼ぶ」ことだけを
する。計算ロジックをここへ再実装しない。

呼び出す既存Authority:
    temples.domain.weekly_time_contract      -> 週境界（Asia/Tokyo / Monday start）
    temples.services.compass_runtime         -> direction runtime / monthly fallback
    temples.domain.weekly_presentation       -> fingerprint / owner key / featured選択
    temples.domain.weekly_theme_catalog_v1   -> Weekly Theme
    temples.services.compass_recommendation_orchestrator -> direction + distance + Recommendation
    temples.services.weekly_presentation_snapshot        -> lookup / create / race recovery

責務境界:
    このmodule -> orchestration（request objectへ依存しない）
    APIView    -> HTTP normalization / status / cookie / response
    hydration  -> temples.services.weekly_featured_shrines

処理順（この順序が契約の本体）:
    Input normalize（View側）
    -> Owner resolve（View側 / 引数で受け取る）
    -> week_start resolve
    -> build_compass_direction_runtime()
    -> direction_fingerprint
    -> Snapshot lookup
    -> HIT  : 保存済み結果を返す（get_compass_recommendations() は実行しない）
    -> MISS : get_compass_recommendations() -> Theme -> Featured -> Snapshot確定

Weekly独自の方位計算（weekly_lucky_directions / week_number % direction 等）は
存在しない。`purpose` の妥当性判定も既存Authority
（compass_recommendation_orchestrator -> NEED_TAGS）へ委譲し、ここで独自の
purpose enumを持たない。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Any, Mapping, Optional

from django.utils import timezone

from temples.domain.weekly_presentation import (
    WEEKLY_PRESENTATION_VERSION,
    build_direction_fingerprint,
    build_weekly_owner_key,
    build_weekly_pool,
    select_featured_shrine_ids,
)
from temples.domain.weekly_theme_catalog_v1 import select_weekly_theme
from temples.domain.weekly_time_contract import derive_week_end, resolve_week_start
from temples.models_weekly_presentation import WeeklyPresentationSnapshot
from temples.services.compass_recommendation_orchestrator import (
    STATE_RECOMMENDATION_SUCCESS,
    get_compass_recommendations,
)
from temples.services.compass_runtime import build_compass_direction_runtime
from temples.services.weekly_presentation_snapshot import (
    get_existing_weekly_snapshot,
    get_or_create_weekly_snapshot,
)

log = logging.getLogger(__name__)

# Weekly固有の成功state。既存Compassのstate文字列とは衝突しない別の語であり、
# 既存 `recommendation_success` を置き換えるものではない。
STATE_WEEKLY_SUCCESS = "weekly_success"


@dataclass(frozen=True)
class WeeklyPresentationResult:
    """Weekly Presentation 1件の解決結果（HTTPには依存しない）。

    `snapshot` が None なのは non-success の時だけである（non-success時は
    Snapshotを作成しない契約）。`compass_state` はSnapshot MISSでRecommendationを
    実行した場合のみ入る既存Compass stateで、HIT時はNone（Recommendationを
    実行していないという事実をそのまま表す）。
    """

    state: str
    week_start: date
    week_end: date
    direction_context: Optional[Mapping[str, Any]]
    direction_fingerprint: str
    purpose: Optional[str]
    snapshot: Optional[WeeklyPresentationSnapshot] = None
    snapshot_hit: bool = False
    snapshot_created: bool = False
    compass_state: Optional[str] = None
    # Weekly Candidate Poolの実効件数（Snapshot MISS時のみ観測可能）。
    # Snapshotへは保存しない（PR1契約: candidate countsは保存禁止）。
    weekly_pool_count: Optional[int] = None

    @property
    def is_success(self) -> bool:
        return self.state == STATE_WEEKLY_SUCCESS


def resolve_weekly_presentation(
    *,
    purpose: str,
    birthdate: Optional[str],
    origin: Optional[Mapping[str, Any]],
    user: Any = None,
    anonymous_id: Optional[str] = None,
    reference_date: Optional[date] = None,
    presentation_version: str = WEEKLY_PRESENTATION_VERSION,
) -> WeeklyPresentationResult:
    """現在週のWeekly Presentationを解決する。

    `reference_date` は **test容易性のためのinternal注入点** であり、public API
    requestのparameterではない。省略時はBackend Authority（settings.TIME_ZONE =
    Asia/Tokyo）の今日を使う。

    `user` / `anonymous_id` は Owner XOR（どちらか一方のみ）。両方nullまたは
    両方非nullの場合は `build_weekly_owner_key()` が ValueError を送出する。
    """
    # Owner resolve -> week_start resolve の順（Section 15の処理順）。
    owner_key = build_weekly_owner_key(
        user_id=getattr(user, "id", None) if user is not None else None,
        anonymous_id=anonymous_id,
    )

    resolved_reference_date = reference_date or timezone.localdate()
    week_start = resolve_week_start(resolved_reference_date)
    week_end = derive_week_end(week_start)

    # 既存Compass Runtime Authorityをそのまま使う。target_dateは「Backendが
    # 決めた今日」を明示的に渡す -- 週境界とdirection計算の基準日を1つに固定する
    # ため（compass_runtime側のdefault挙動には依存しない）。
    direction_context = build_compass_direction_runtime(
        birthdate=birthdate,
        target_date=resolved_reference_date.isoformat(),
    )
    direction_context_mapping = (
        direction_context if isinstance(direction_context, Mapping) else None
    )
    direction_fingerprint = build_direction_fingerprint(direction_context_mapping)

    snapshot_lookup_kwargs = dict(
        user=user,
        anonymous_id=anonymous_id,
        week_start=week_start,
        purpose=purpose,
        direction_fingerprint=direction_fingerprint,
        presentation_version=presentation_version,
    )
    existing_snapshot = get_existing_weekly_snapshot(**snapshot_lookup_kwargs)

    if existing_snapshot is not None:
        # Snapshot HIT。get_compass_recommendations() は実行しない。
        return WeeklyPresentationResult(
            state=STATE_WEEKLY_SUCCESS,
            week_start=week_start,
            week_end=week_end,
            direction_context=direction_context_mapping,
            direction_fingerprint=direction_fingerprint,
            purpose=existing_snapshot.purpose,
            snapshot=existing_snapshot,
            snapshot_hit=True,
        )

    # Snapshot MISS のときだけ既存Recommendationを実行する。
    compass_result = get_compass_recommendations(
        purpose=purpose,
        origin=origin,
        direction_context=direction_context,
    )

    if compass_result.state != STATE_RECOMMENDATION_SUCCESS:
        # 非成功状態をWeekly独自の成功Snapshotとして固定しない（Themeだけの
        # 保存もしない）。既存Compass stateをそのまま返す。
        return WeeklyPresentationResult(
            state=compass_result.state,
            week_start=week_start,
            week_end=week_end,
            direction_context=compass_result.direction_context,
            direction_fingerprint=direction_fingerprint,
            purpose=compass_result.purpose,
            compass_state=compass_result.state,
        )

    weekly_theme = select_weekly_theme(
        purpose=purpose,
        direction_fingerprint=direction_fingerprint,
        week_start=week_start,
        presentation_version=presentation_version,
    )
    featured_shrine_ids = select_featured_shrine_ids(
        recommendations=compass_result.recommendations,
        owner_key=owner_key,
        week_start=week_start,
        purpose=purpose,
        direction_fingerprint=direction_fingerprint,
        presentation_version=presentation_version,
    )
    # PR1レビューで確認された「上位6件のinvalid/duplicateで実効Poolが薄くなる」
    # 事象を観測するための件数。Snapshotへは保存しない。
    weekly_pool_count = len(build_weekly_pool(compass_result.recommendations))

    snapshot, created = get_or_create_weekly_snapshot(
        weekly_theme=weekly_theme,
        featured_shrine_ids=featured_shrine_ids,
        **snapshot_lookup_kwargs,
    )

    return WeeklyPresentationResult(
        state=STATE_WEEKLY_SUCCESS,
        week_start=week_start,
        week_end=week_end,
        direction_context=compass_result.direction_context,
        direction_fingerprint=direction_fingerprint,
        purpose=snapshot.purpose,
        snapshot=snapshot,
        snapshot_hit=False,
        snapshot_created=created,
        compass_state=compass_result.state,
        weekly_pool_count=weekly_pool_count,
    )


__all__ = [
    "STATE_WEEKLY_SUCCESS",
    "WeeklyPresentationResult",
    "resolve_weekly_presentation",
]
