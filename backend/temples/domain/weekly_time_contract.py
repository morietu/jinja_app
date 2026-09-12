"""Weekly Compass Time Contract (Backend timezone authority).

Weekly Presentation の週境界は Backend が唯一の権威である。Frontend 由来の
timezone / 週境界を前提にしない（Frontend が渡す値を信頼して週を決めない）。

    timezone   = Django settings.TIME_ZONE（本projectは "Asia/Tokyo"）
    week start = Monday
    week range = [ Monday 00:00 JST, next Monday 00:00 JST )  -- 半開区間

DB へ保存するのは ``week_start`` だけで、``week_end`` は保存しない
（`WeeklyPresentationSnapshot` 参照）。表示等で終端日が必要な場合は
`derive_week_end()` で導出する。

この module は既存 Compass Runtime（`temples.services.compass_runtime`）の
日時ロジックを一切参照も変更もしない。Compass Runtime の
`timezone.localdate()` は「今日の方位を計算する日」を決める責務であり、
ここでの「表示週の境界」とは別の責務である。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional, Union

from django.utils import timezone

# Monday。Python の date.weekday() は Monday=0。
WEEK_START_WEEKDAY = 0

# 週の長さ（日数）。week_end は week_start + 6 日（半開区間の終端 -1 日）。
WEEK_LENGTH_DAYS = 7

ReferenceDate = Optional[Union[date, datetime]]


def _to_local_date(reference_date: ReferenceDate) -> date:
    """Backend timezone authority で「どの日か」を確定する。

    - None            -> settings.TIME_ZONE 基準の今日（timezone.localdate()）
    - aware datetime  -> settings.TIME_ZONE へ変換した上での日付
    - naive datetime  -> そのままの日付（既に local として扱う）
    - date            -> そのまま

    ``datetime`` は ``date`` のサブクラスなので、必ず先に判定する。
    """
    if reference_date is None:
        return timezone.localdate()
    if isinstance(reference_date, datetime):
        if timezone.is_aware(reference_date):
            return timezone.localtime(reference_date).date()
        return reference_date.date()
    if isinstance(reference_date, date):
        return reference_date
    raise TypeError(f"reference_date must be date/datetime/None, got {type(reference_date)!r}")


def resolve_week_start(reference_date: ReferenceDate = None) -> date:
    """``reference_date`` が属する週の Monday を返す。

    同じ週（Monday 00:00 以上、次の Monday 00:00 未満）に属する日付は、
    曜日や時刻に関わらず必ず同じ ``week_start`` を返す。
    """
    local_date = _to_local_date(reference_date)
    return local_date - timedelta(days=(local_date.weekday() - WEEK_START_WEEKDAY) % WEEK_LENGTH_DAYS)


def derive_week_end(week_start: date) -> date:
    """保存済みの ``week_start`` から表示用の週終端（Sunday）を導出する。

    ``week_end`` は DB に保存しない（導出値であり、保存すると week_start と
    矛盾し得る第二の真実になるため）。
    """
    if isinstance(week_start, datetime) or not isinstance(week_start, date):
        raise TypeError(f"week_start must be a date, got {type(week_start)!r}")
    return week_start + timedelta(days=WEEK_LENGTH_DAYS - 1)


__all__ = [
    "WEEK_START_WEEKDAY",
    "WEEK_LENGTH_DAYS",
    "resolve_week_start",
    "derive_week_end",
]
