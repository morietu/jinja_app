"""Weekly Presentation Snapshot persistence service.

`lookup` と `create` を別責務として分離する。この module は request object に
依存しない（Owner解決＝cookie/認証からuser/anonymous_idを取り出す処理は
API層の責務であり、このPRの対象外）。

責務境界:
    Model（temples.models_weekly_presentation）      -> 何を保存できるか
    Selection（temples.domain.weekly_presentation ほか）-> 何を選ぶか
    このmodule                                        -> 既存Snapshotを引く / 確定結果を保存する

Selection algorithm も API View もここへ持ち込まない。
"""

from __future__ import annotations

from datetime import date
from typing import Any, Mapping, Optional, Sequence

from temples.domain.weekly_presentation import WEEKLY_PRESENTATION_VERSION
from temples.models_weekly_presentation import WeeklyPresentationSnapshot


def _resolve_owner_filters(
    *,
    user: Any = None,
    anonymous_id: Optional[str] = None,
) -> dict[str, Any]:
    """Owner XOR を Domain 側でも強制し、Owner種別に応じたfilter条件を返す。

    Model側の CheckConstraint（chk_weekly_presentation_snapshot_owner_xor）と
    同じ規則。ここで弾いておくことで、「user も anonymous_id も無い」lookupが
    無関係なSnapshotに一致してしまう事故を防ぐ。
    """
    normalized_anonymous_id = anonymous_id.strip() if isinstance(anonymous_id, str) else None
    normalized_anonymous_id = normalized_anonymous_id or None
    has_user = user is not None
    has_anonymous = normalized_anonymous_id is not None

    if has_user == has_anonymous:
        raise ValueError(
            "weekly presentation snapshot owner must be exactly one of user / anonymous_id"
        )
    if has_user:
        return {"user": user, "anonymous_id": None}
    return {"user": None, "anonymous_id": normalized_anonymous_id}


def get_existing_weekly_snapshot(
    *,
    user: Any = None,
    anonymous_id: Optional[str] = None,
    week_start: date,
    purpose: str,
    direction_fingerprint: str,
    presentation_version: str = WEEKLY_PRESENTATION_VERSION,
) -> Optional[WeeklyPresentationSnapshot]:
    """意味上のunique key で既存Snapshotを1件引く。無ければ None。

    unique key: owner + week_start + purpose + direction_fingerprint + presentation_version
    （Model側の conditional UniqueConstraint と同一の組）。
    """
    owner_filters = _resolve_owner_filters(user=user, anonymous_id=anonymous_id)
    return WeeklyPresentationSnapshot.objects.filter(
        week_start=week_start,
        purpose=purpose,
        direction_fingerprint=direction_fingerprint,
        presentation_version=presentation_version,
        **owner_filters,
    ).first()


def create_weekly_snapshot(
    *,
    user: Any = None,
    anonymous_id: Optional[str] = None,
    week_start: date,
    purpose: str,
    direction_fingerprint: str,
    weekly_theme: Mapping[str, Any],
    featured_shrine_ids: Sequence[int],
    presentation_version: str = WEEKLY_PRESENTATION_VERSION,
) -> WeeklyPresentationSnapshot:
    """確定したWeekly Presentation結果を新規Snapshotとして保存する。

    ここでは「既に存在するか」を判定しない（lookupは
    `get_existing_weekly_snapshot()` の責務）。同一unique keyの重複は
    DB constraint が拒否する -- application側の事前チェックへ依存させない。
    """
    owner_filters = _resolve_owner_filters(user=user, anonymous_id=anonymous_id)
    return WeeklyPresentationSnapshot.objects.create(
        week_start=week_start,
        purpose=purpose,
        direction_fingerprint=direction_fingerprint,
        weekly_theme=dict(weekly_theme),
        featured_shrine_ids=[int(shrine_id) for shrine_id in featured_shrine_ids],
        presentation_version=presentation_version,
        **owner_filters,
    )


__all__ = [
    "get_existing_weekly_snapshot",
    "create_weekly_snapshot",
]
