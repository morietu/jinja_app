"""Weekly Snapshot の同時create収束（race recovery）Test。

契約:
    同時初回requestが両方Snapshot MISSになっても500にしない
    最終AuthorityはDBのconditional UniqueConstraint
    衝突した側は自分の生成結果を返さず、勝者のSnapshotを読み直して返す
    結果としてSnapshotは1件、両requestが同一Presentationを返す

DB UniqueConstraint自体の正しさはPR1のModel Test
（temples/tests/services/test_weekly_presentation_snapshot.py）をAuthorityとし、
ここでは「衝突したときにどう収束するか」だけを検証する。実際の並行transactionを
再現するflakyなconcurrency testは作らない（負けた側のlookupをMISSへ固定する形で
競合を決定論的に再現する）。
"""

from __future__ import annotations

import json
from datetime import date
from unittest.mock import patch

import pytest
from django.db import IntegrityError

from temples.domain.weekly_presentation import (
    WEEKLY_PRESENTATION_VERSION,
    build_direction_fingerprint,
)
from temples.models_weekly_presentation import WeeklyPresentationSnapshot
from temples.services import weekly_presentation_snapshot as persistence
from temples.services.weekly_presentation_snapshot import (
    create_weekly_snapshot,
    get_existing_weekly_snapshot,
    get_or_create_weekly_snapshot,
)

pytestmark = pytest.mark.django_db

WEEK_START = date(2026, 9, 14)
PURPOSE = "career"
ANONYMOUS_ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
FINGERPRINT = build_direction_fingerprint(
    {
        "referenceDirections": ["北西"],
        "calculationMethod": "annual_monthly_kyusei_v1",
        "solarMonthIndex": 8,
        "targetYear": 2026,
    }
)

WINNER_THEME = {"key": "winner", "title": "勝者のテーマ", "message": "先に保存された文言。"}
LOSER_THEME = {"key": "loser", "title": "敗者のテーマ", "message": "後から生成された文言。"}
WINNER_IDS = [11, 12, 13]
LOSER_IDS = [21, 22, 23]


def _unique_key(**overrides):
    values = dict(
        anonymous_id=ANONYMOUS_ID,
        week_start=WEEK_START,
        purpose=PURPOSE,
        direction_fingerprint=FINGERPRINT,
        presentation_version=WEEKLY_PRESENTATION_VERSION,
    )
    values.update(overrides)
    return values


def _forced_first_miss():
    """1回目のlookupだけMISSへ固定し、2回目以降は本物へ委譲する。

    「lookupの時点ではまだ勝者が存在しなかった」= 負けたrequestの視点を、
    並行transactionを使わずに決定論的に再現する。
    """
    real = get_existing_weekly_snapshot
    calls = {"count": 0}

    def _lookup(**kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            return None
        return real(**kwargs)

    return _lookup, calls


# --------------------------------------------------------------------------
# persistence service level
# --------------------------------------------------------------------------


def test_lookup_hit_returns_existing_without_creating():
    winner = create_weekly_snapshot(
        weekly_theme=WINNER_THEME, featured_shrine_ids=WINNER_IDS, **_unique_key()
    )

    snapshot, created = get_or_create_weekly_snapshot(
        weekly_theme=LOSER_THEME, featured_shrine_ids=LOSER_IDS, **_unique_key()
    )

    assert created is False
    assert snapshot.pk == winner.pk
    assert WeeklyPresentationSnapshot.objects.count() == 1


def test_first_create_wins_and_loser_recovers_the_winner_snapshot():
    """負けた側はIntegrityErrorを受けたあと、勝者のSnapshotを返す。"""
    winner = create_weekly_snapshot(
        weekly_theme=WINNER_THEME, featured_shrine_ids=WINNER_IDS, **_unique_key()
    )

    lookup, calls = _forced_first_miss()
    with patch.object(persistence, "get_existing_weekly_snapshot", side_effect=lookup):
        snapshot, created = get_or_create_weekly_snapshot(
            weekly_theme=LOSER_THEME, featured_shrine_ids=LOSER_IDS, **_unique_key()
        )

    # 負けた側のlookupはMISS -> create衝突 -> 再lookup の2回呼ばれている。
    assert calls["count"] == 2
    assert created is False
    assert snapshot.pk == winner.pk
    # 自分の生成結果ではなくDBに保存された勝者の結果を返す。
    assert snapshot.weekly_theme == WINNER_THEME
    assert snapshot.featured_shrine_ids == WINNER_IDS
    assert WeeklyPresentationSnapshot.objects.count() == 1


def test_concurrent_misses_do_not_raise_and_converge_on_one_snapshot():
    lookup, _ = _forced_first_miss()

    first_snapshot, first_created = get_or_create_weekly_snapshot(
        weekly_theme=WINNER_THEME, featured_shrine_ids=WINNER_IDS, **_unique_key()
    )
    with patch.object(persistence, "get_existing_weekly_snapshot", side_effect=lookup):
        second_snapshot, second_created = get_or_create_weekly_snapshot(
            weekly_theme=LOSER_THEME, featured_shrine_ids=LOSER_IDS, **_unique_key()
        )

    assert (first_created, second_created) == (True, False)
    assert first_snapshot.pk == second_snapshot.pk
    assert second_snapshot.weekly_theme == first_snapshot.weekly_theme
    assert second_snapshot.featured_shrine_ids == first_snapshot.featured_shrine_ids
    assert WeeklyPresentationSnapshot.objects.count() == 1


def test_authenticated_owner_race_recovers_the_same_way(django_user_model):
    user = django_user_model.objects.create_user(username="weekly_race_user", password="x")
    key = _unique_key(anonymous_id=None, user=user)
    winner = create_weekly_snapshot(
        weekly_theme=WINNER_THEME, featured_shrine_ids=WINNER_IDS, **key
    )

    lookup, _ = _forced_first_miss()
    with patch.object(persistence, "get_existing_weekly_snapshot", side_effect=lookup):
        snapshot, created = get_or_create_weekly_snapshot(
            weekly_theme=LOSER_THEME, featured_shrine_ids=LOSER_IDS, **key
        )

    assert created is False
    assert snapshot.pk == winner.pk
    assert WeeklyPresentationSnapshot.objects.count() == 1


def test_integrity_error_without_a_recoverable_winner_is_not_swallowed():
    """unique衝突以外のIntegrityErrorを成功へ化けさせない。"""
    with patch.object(persistence, "get_existing_weekly_snapshot", return_value=None):
        with patch.object(
            persistence, "create_weekly_snapshot", side_effect=IntegrityError("other constraint")
        ):
            with pytest.raises(IntegrityError):
                get_or_create_weekly_snapshot(
                    weekly_theme=WINNER_THEME,
                    featured_shrine_ids=WINNER_IDS,
                    **_unique_key(),
                )

    assert WeeklyPresentationSnapshot.objects.count() == 0


# --------------------------------------------------------------------------
# API level
# --------------------------------------------------------------------------


def test_weekly_api_does_not_500_on_snapshot_create_race(client, db):
    """同時初回requestを再現しても500にならず、Snapshotは1件のまま。

    「負けたrequest」を再現するために2箇所のlookupを操作する:
      - weekly_compass_service 側のlookup -> 常にMISS（自分はまだ無いと判断する）
      - persistence 側のlookup -> 1回目MISS（createへ進む）/ 2回目は本物（勝者を拾う）
    createの衝突は実DBのconditional UniqueConstraintが起こす（mockではない）。

    勝者のSnapshotには sentinel theme を書き込んでおく。復帰が効いていれば、
    負けたrequestは自分で生成したthemeではなく sentinel を返す。
    """
    from temples.models import Shrine
    from temples.services import weekly_compass_service
    from temples.tests.support.recommendation_eligibility import attach_usable_deity_fact

    for index in range(7):
        shrine = Shrine(
            name_jp=f"北西の神社{index}",
            address="東京都千代田区",
            latitude=35.2 + index * 0.01,
            longitude=134.8 - index * 0.01,
            goriyaku="仕事運",
        )
        Shrine.objects.bulk_create([shrine])
        attach_usable_deity_fact(Shrine.objects.get(pk=shrine.pk), display_name=f"祭神{index}")

    payload = json.dumps(
        {"purpose": PURPOSE, "birthdate": "1984-05-15", "origin": {"lat": 35.0, "lng": 135.0}}
    )

    def _post():
        with patch(
            "temples.services.weekly_compass_service.timezone.localdate",
            return_value=date(2026, 9, 15),
        ):
            return client.post(
                "/api/compass/weekly/", data=payload, content_type="application/json"
            )

    first = _post()
    assert first.status_code == 200
    assert WeeklyPresentationSnapshot.objects.count() == 1

    # 勝者が保存した内容であることを見分けるための sentinel。
    winner = WeeklyPresentationSnapshot.objects.get()
    winner.weekly_theme = {"key": "race_winner", "title": "勝者", "message": "DBに残った文言。"}
    winner.save(update_fields=["weekly_theme"])

    lookup, calls = _forced_first_miss()
    with patch.object(weekly_compass_service, "get_existing_weekly_snapshot", return_value=None):
        with patch.object(persistence, "get_existing_weekly_snapshot", side_effect=lookup):
            second = _post()

    assert second.status_code == 200
    # createが実際に衝突し、再lookupで勝者を拾っている。
    assert calls["count"] == 2
    assert WeeklyPresentationSnapshot.objects.count() == 1
    assert second.json()["weekly_theme"] == winner.weekly_theme
    assert [s["id"] for s in second.json()["featured_shrines"]] == [
        s["id"] for s in first.json()["featured_shrines"]
    ]
