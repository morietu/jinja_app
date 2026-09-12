"""Weekly Presentation Snapshot persistence service.

`lookup` / `create` / `race recovery` を別責務として分離する。この module は
request object に依存しない（Owner解決＝cookie/認証からuser/anonymous_idを
取り出す処理はAPI層の責務）。

責務境界:
    Model（temples.models_weekly_presentation）      -> 何を保存できるか
    Selection（temples.domain.weekly_presentation ほか）-> 何を選ぶか
    このmodule                                        -> 既存Snapshotを引く / 確定結果を保存する / 同時createを収束させる

Selection algorithm も API View もここへ持ち込まない。
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Mapping, Optional, Sequence

from django.db import IntegrityError, transaction

from temples.domain.weekly_presentation import WEEKLY_PRESENTATION_VERSION
from temples.models_weekly_presentation import WeeklyPresentationSnapshot

log = logging.getLogger(__name__)


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


def get_or_create_weekly_snapshot(
    *,
    user: Any = None,
    anonymous_id: Optional[str] = None,
    week_start: date,
    purpose: str,
    direction_fingerprint: str,
    weekly_theme: Mapping[str, Any],
    featured_shrine_ids: Sequence[int],
    presentation_version: str = WEEKLY_PRESENTATION_VERSION,
) -> tuple[WeeklyPresentationSnapshot, bool]:
    """Snapshotをrace-safeに確定し、`(snapshot, created)` を返す。

    同一Ownerの初回requestが同時に届いた場合（どちらもlookupがMISS）、両方が
    createへ進む。最終Authorityは DB の conditional UniqueConstraint
    （`uq_weekly_presentation_snapshot_user` /
    `uq_weekly_presentation_snapshot_anonymous`）であり、衝突した側は
    **自分が生成した結果を返さず**、勝者が保存したSnapshotを読み直して返す。
    これにより、競合した2requestが別々のPresentationを返すことがなくなる。

    transaction scope は create の1文だけへ狭く限定する（savepointを張るため
    のもので、Recommendation計算やShrine hydrationは決して含めない）。
    IntegrityError は呼び出し側のatomic blockを壊すため、内側のsavepointで
    受け止める必要がある。

    再lookupでも見つからないIntegrityErrorは unique 衝突ではない別の制約違反
    （例: Owner XOR違反）なので、飲み込まずそのまま送出する。
    """
    lookup_kwargs = dict(
        user=user,
        anonymous_id=anonymous_id,
        week_start=week_start,
        purpose=purpose,
        direction_fingerprint=direction_fingerprint,
        presentation_version=presentation_version,
    )

    existing = get_existing_weekly_snapshot(**lookup_kwargs)
    if existing is not None:
        return existing, False

    try:
        with transaction.atomic():
            created = create_weekly_snapshot(
                weekly_theme=weekly_theme,
                featured_shrine_ids=featured_shrine_ids,
                **lookup_kwargs,
            )
        return created, True
    except IntegrityError:
        winner = get_existing_weekly_snapshot(**lookup_kwargs)
        if winner is None:
            raise
        log.info("[weekly_snapshot] create_race_recovered week_start=%s purpose=%s", week_start, purpose)
        return winner, False


__all__ = [
    "get_existing_weekly_snapshot",
    "create_weekly_snapshot",
    "get_or_create_weekly_snapshot",
]
