"""Weekly Compass Time Contract（週境界）のUnit Test。

Backend が timezone authority であること（Asia/Tokyo / week starts Monday /
半開区間 [Mon 00:00, next Mon 00:00)）を、Frontend由来の値に依存せず検証する。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone as dt_timezone

import pytest
from django.conf import settings
from django.utils import timezone

from temples.domain.weekly_time_contract import (
    WEEK_LENGTH_DAYS,
    WEEK_START_WEEKDAY,
    derive_week_end,
    resolve_week_start,
)

# 2026-09-12 は土曜日。その週のMondayは 2026-09-07。
SATURDAY = date(2026, 9, 12)
MONDAY_OF_THAT_WEEK = date(2026, 9, 7)
NEXT_MONDAY = date(2026, 9, 14)


def test_backend_timezone_authority_is_asia_tokyo():
    """週境界の前提。ここが Asia/Tokyo でなくなったら週の切れ目が変わる。"""
    assert settings.TIME_ZONE == "Asia/Tokyo"
    assert settings.USE_TZ is True


def test_week_starts_monday():
    assert WEEK_START_WEEKDAY == 0
    assert resolve_week_start(MONDAY_OF_THAT_WEEK).weekday() == WEEK_START_WEEKDAY


def test_monday_resolves_to_itself():
    assert resolve_week_start(MONDAY_OF_THAT_WEEK) == MONDAY_OF_THAT_WEEK


def test_every_day_in_the_same_week_resolves_to_the_same_week_start():
    resolved = {
        resolve_week_start(MONDAY_OF_THAT_WEEK + timedelta(days=offset))
        for offset in range(WEEK_LENGTH_DAYS)
    }
    assert resolved == {MONDAY_OF_THAT_WEEK}


def test_next_monday_starts_a_new_week_half_open_interval():
    """半開区間: 次のMondayは前の週に含まれない（境界が重ならない）。"""
    sunday = NEXT_MONDAY - timedelta(days=1)
    assert resolve_week_start(sunday) == MONDAY_OF_THAT_WEEK
    assert resolve_week_start(NEXT_MONDAY) == NEXT_MONDAY


def test_none_uses_backend_local_today_not_utc():
    """reference_date 省略時は settings.TIME_ZONE 基準の「今日」を使う。"""
    # UTC では 2026-09-06（日曜）だが、Asia/Tokyo では 2026-09-07（月曜）。
    utc_moment = datetime(2026, 9, 6, 16, 30, tzinfo=dt_timezone.utc)
    with timezone.override(settings.TIME_ZONE):
        local_today = timezone.localtime(utc_moment).date()
    assert local_today == MONDAY_OF_THAT_WEEK

    assert resolve_week_start(utc_moment) == MONDAY_OF_THAT_WEEK


def test_aware_datetime_is_converted_to_backend_timezone_before_resolving():
    """JSTで月曜0時台の瞬間は、UTC表現で渡しても前週へ落ちてはいけない。"""
    jst_monday_early = datetime(2026, 9, 6, 15, 0, tzinfo=dt_timezone.utc)  # JST 2026-09-07 00:00
    assert resolve_week_start(jst_monday_early) == MONDAY_OF_THAT_WEEK


def test_naive_datetime_is_treated_as_local():
    assert resolve_week_start(datetime(2026, 9, 12, 23, 59)) == MONDAY_OF_THAT_WEEK


def test_invalid_reference_date_type_raises():
    with pytest.raises(TypeError):
        resolve_week_start("2026-09-12")


def test_derive_week_end_is_week_start_plus_six_days():
    assert derive_week_end(MONDAY_OF_THAT_WEEK) == date(2026, 9, 13)
    assert derive_week_end(MONDAY_OF_THAT_WEEK) == MONDAY_OF_THAT_WEEK + timedelta(days=6)
    assert derive_week_end(MONDAY_OF_THAT_WEEK) < NEXT_MONDAY


def test_derive_week_end_rejects_datetime():
    """week_end は日付の導出値。datetime を渡せる設計にしない。"""
    with pytest.raises(TypeError):
        derive_week_end(datetime(2026, 9, 7, 0, 0))


def test_resolve_week_start_is_stable_across_repeated_calls():
    assert resolve_week_start(SATURDAY) == resolve_week_start(SATURDAY)
