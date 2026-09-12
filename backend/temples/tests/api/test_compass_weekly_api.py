"""Weekly Compass API（POST /api/compass/weekly/）の契約Test。

既存Compass API testの規約へ合わせている:
  - test client は Django の `client` fixture
  - 時刻依存は `timezone.localdate` の patch（既存 test_compass_runtime.py と同じ方式）
  - Recommendation Eligibility を満たすShrineは
    `temples.tests.support.recommendation_eligibility` の helper で作る
"""

from __future__ import annotations

import json
from datetime import date
from unittest.mock import patch

import pytest

from temples.domain.weekly_presentation import WEEKLY_PRESENTATION_VERSION
from temples.models import Shrine
from temples.models_weekly_presentation import WeeklyPresentationSnapshot
from temples.services.anonymous_id import ANONYMOUS_ID_COOKIE_NAME
from temples.tests.support.recommendation_eligibility import attach_usable_deity_fact

URL = "/api/compass/weekly/"
ORIGIN = {"lat": 35.0, "lng": 135.0}
BIRTHDATE = "1984-05-15"

# 1984-05-15 + 2026-09-15 は 北西 に解決される（test_kyusei_direction.py / 既存
# Compass API test と同じ固定値）。2026-09-15 は火曜で、その週のMondayは 09-14。
REFERENCE_DATE = date(2026, 9, 15)
WEEK_START = "2026-09-14"
WEEK_END = "2026-09-20"
NEXT_WEEK_REFERENCE_DATE = date(2026, 9, 21)
NEXT_WEEK_START = "2026-09-21"

pytestmark = pytest.mark.django_db


@pytest.fixture
def shrine_factory():
    def _factory(
        *,
        name: str,
        latitude: float,
        longitude: float,
        goriyaku: str = "仕事運",
        usable_knowledge: bool = True,
    ) -> Shrine:
        shrine = Shrine(
            name_jp=name,
            address="東京都千代田区",
            latitude=latitude,
            longitude=longitude,
            goriyaku=goriyaku,
        )
        Shrine.objects.bulk_create([shrine])
        created = Shrine.objects.get(pk=shrine.pk)
        if usable_knowledge:
            attach_usable_deity_fact(created, display_name=f"{name}の祭神")
        return created

    return _factory


@pytest.fixture
def northwest_shrines(shrine_factory):
    """北西方位・60km圏内に収まる複数Shrine（featured選択が意味を持つ件数）。"""
    return [
        shrine_factory(name=f"北西の神社{index}", latitude=35.2 + index * 0.01, longitude=134.8 - index * 0.01)
        for index in range(7)
    ]


def _jwt_client(user):
    """既存 test 規約（test_favorites_api.py）と同じJWT認証クライアント。

    このViewの authentication_classes は既存 CompassRecommendationsView と同じ
    JWTAuthentication のみなので、session loginでは認証されない。
    """
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    api_client = APIClient()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return api_client


def _post(client, **overrides):
    payload = {"purpose": "career", "birthdate": BIRTHDATE, "origin": ORIGIN}
    payload.update(overrides)
    return client.post(URL, data=json.dumps(payload), content_type="application/json")


def _post_on(client, reference_date: date, **overrides):
    """Backend Authorityの「今日」を固定したうえでrequestする。"""
    with patch(
        "temples.services.weekly_compass_service.timezone.localdate",
        return_value=reference_date,
    ):
        return _post(client, **overrides)


# --------------------------------------------------------------------------
# URL / success
# --------------------------------------------------------------------------


def test_weekly_endpoint_is_registered_with_trailing_slash(client):
    from django.urls import reverse

    assert reverse("temples:compass-weekly") == URL


def test_anonymous_request_returns_weekly_success(client, northwest_shrines):
    response = _post_on(client, REFERENCE_DATE)

    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "weekly_success"
    assert body["purpose"] == "career"
    assert body["week"] == {"start": WEEK_START, "end": WEEK_END}
    assert body["presentation_version"] == WEEKLY_PRESENTATION_VERSION
    assert set(body["weekly_theme"]) == {"key", "title", "message"}
    assert body["direction_context"]["referenceDirections"] == ["北西"]
    assert 1 <= len(body["featured_shrines"]) <= 3


def test_authenticated_request_returns_weekly_success(django_user_model, northwest_shrines):
    user = django_user_model.objects.create_user(username="weekly_api_user", password="x")
    api_client = _jwt_client(user)

    response = _post_on(api_client, REFERENCE_DATE)

    assert response.status_code == 200
    assert response.json()["state"] == "weekly_success"
    snapshot = WeeklyPresentationSnapshot.objects.get()
    assert snapshot.user_id == user.id
    assert snapshot.anonymous_id is None


def test_authenticated_owner_gets_no_anonymous_cookie(django_user_model, northwest_shrines):
    user = django_user_model.objects.create_user(username="weekly_api_user2", password="x")

    response = _post_on(_jwt_client(user), REFERENCE_DATE)

    assert ANONYMOUS_ID_COOKIE_NAME not in response.cookies


def test_authenticated_and_anonymous_owners_do_not_share_a_snapshot(
    client, django_user_model, northwest_shrines
):
    user = django_user_model.objects.create_user(username="weekly_api_user3", password="x")
    _post_on(_jwt_client(user), REFERENCE_DATE)
    _post_on(client, REFERENCE_DATE)

    assert WeeklyPresentationSnapshot.objects.count() == 2
    assert WeeklyPresentationSnapshot.objects.filter(user=user).count() == 1
    assert WeeklyPresentationSnapshot.objects.filter(anonymous_id__isnull=False).count() == 1


def test_featured_shrines_use_the_existing_shrine_card_representation(client, northwest_shrines):
    body = _post_on(client, REFERENCE_DATE).json()

    first = body["featured_shrines"][0]
    # ShrineListSerializer（Shrine一覧/nearest/rankingと同じ公開表現）のfield。
    for field in ("id", "name_jp", "address", "latitude", "longitude", "goriyaku_tags", "location"):
        assert field in first


def test_response_never_exposes_recommendation_instance_id(client, northwest_shrines):
    body = _post_on(client, REFERENCE_DATE).json()

    assert "recommendation_instance_id" not in body
    assert all("recommendation_instance_id" not in shrine for shrine in body["featured_shrines"])


def test_existing_compass_recommendations_endpoint_has_no_weekly_presentation(client, northwest_shrines):
    """既存Endpointへweekly_presentationを足していないこと。"""
    response = client.post(
        "/api/compass/recommendations/",
        data=json.dumps(
            {
                "purpose": "career",
                "birthdate": BIRTHDATE,
                "origin": ORIGIN,
                "target_date": "2026-09-15",
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 200
    body = response.json()
    assert "weekly_presentation" not in body
    assert "weekly_theme" not in body
    assert "featured_shrines" not in body


# --------------------------------------------------------------------------
# anonymous cookie / owner identity
# --------------------------------------------------------------------------


def test_anonymous_request_without_cookie_sets_existing_concierge_anon_cookie(client, northwest_shrines):
    response = _post_on(client, REFERENCE_DATE)

    assert ANONYMOUS_ID_COOKIE_NAME in response.cookies
    cookie = response.cookies[ANONYMOUS_ID_COOKIE_NAME]
    assert cookie.value
    assert cookie["httponly"]
    assert cookie["path"] == "/"


def test_second_request_with_an_existing_cookie_does_not_reissue_it(client, northwest_shrines):
    """既にcookieを持つOwnerへは Set-Cookie を返さない。

    発行判断は `PlanContext.should_set_anon_cookie`（requestに既存cookieが
    無かったという事実）がAuthority。同じanonymous Ownerを再利用するだけで、
    cookieの再発行は不要である。
    """
    first = _post_on(client, REFERENCE_DATE)
    assert ANONYMOUS_ID_COOKIE_NAME in first.cookies
    issued_value = client.cookies[ANONYMOUS_ID_COOKIE_NAME].value
    assert issued_value

    second = _post_on(client, REFERENCE_DATE)

    assert second.status_code == 200
    # 2回目のresponseは Set-Cookie を含まない（clientが持つcookieは保持される）。
    assert ANONYMOUS_ID_COOKIE_NAME not in second.cookies
    assert client.cookies[ANONYMOUS_ID_COOKIE_NAME].value == issued_value
    # Ownerが同一なのでSnapshotはHITし、新規作成されない。
    assert WeeklyPresentationSnapshot.objects.count() == 1
    assert second.json()["weekly_theme"] == first.json()["weekly_theme"]


def test_cookie_is_reissued_when_the_client_lost_it(client, northwest_shrines):
    """cookieを失ったclientには再びSet-Cookieを返す（新しいOwnerとして発行）。"""
    _post_on(client, REFERENCE_DATE)
    client.cookies.clear()

    response = _post_on(client, REFERENCE_DATE)

    assert ANONYMOUS_ID_COOKIE_NAME in response.cookies


def test_same_anonymous_cookie_hits_the_same_snapshot(client, northwest_shrines):
    first = _post_on(client, REFERENCE_DATE)
    assert first.status_code == 200
    # Django test client は Set-Cookie を自動で保持する。
    assert ANONYMOUS_ID_COOKIE_NAME in client.cookies

    second = _post_on(client, REFERENCE_DATE)

    assert second.status_code == 200
    assert WeeklyPresentationSnapshot.objects.count() == 1
    assert first.json()["weekly_theme"] == second.json()["weekly_theme"]
    assert [s["id"] for s in first.json()["featured_shrines"]] == [
        s["id"] for s in second.json()["featured_shrines"]
    ]


def test_different_anonymous_owners_get_separate_snapshots(client, northwest_shrines):
    _post_on(client, REFERENCE_DATE)
    client.cookies.clear()
    _post_on(client, REFERENCE_DATE)

    assert WeeklyPresentationSnapshot.objects.count() == 2
    assert WeeklyPresentationSnapshot.objects.filter(user__isnull=True).count() == 2


def test_weekly_does_not_introduce_a_new_identity_cookie(client, northwest_shrines):
    response = _post_on(client, REFERENCE_DATE)

    assert set(response.cookies) == {ANONYMOUS_ID_COOKIE_NAME}


# --------------------------------------------------------------------------
# Snapshot HIT / MISS
# --------------------------------------------------------------------------


def test_snapshot_miss_runs_recommendation_then_hit_does_not(client, northwest_shrines):
    """HIT時に get_compass_recommendations() が呼ばれないことを明示的に証明する。"""
    import temples.services.weekly_compass_service as service

    real = service.get_compass_recommendations

    with patch.object(service, "get_compass_recommendations", side_effect=real) as spy:
        first = _post_on(client, REFERENCE_DATE)
        assert first.status_code == 200
        assert spy.call_count == 1
        assert WeeklyPresentationSnapshot.objects.count() == 1

        second = _post_on(client, REFERENCE_DATE)
        assert second.status_code == 200
        assert spy.call_count == 1

    assert WeeklyPresentationSnapshot.objects.count() == 1
    assert first.json()["weekly_theme"] == second.json()["weekly_theme"]
    assert [s["id"] for s in first.json()["featured_shrines"]] == [
        s["id"] for s in second.json()["featured_shrines"]
    ]


def test_snapshot_hit_returns_stored_theme_even_after_catalog_would_change(client, northwest_shrines):
    first = _post_on(client, REFERENCE_DATE).json()
    stored = WeeklyPresentationSnapshot.objects.get()
    stored.weekly_theme = {"key": "frozen", "title": "保存済みテーマ", "message": "Snapshotの文言。"}
    stored.save(update_fields=["weekly_theme"])

    second = _post_on(client, REFERENCE_DATE).json()

    assert second["weekly_theme"] == {
        "key": "frozen",
        "title": "保存済みテーマ",
        "message": "Snapshotの文言。",
    }
    assert second["weekly_theme"] != first["weekly_theme"]


# --------------------------------------------------------------------------
# Snapshot lookup key
# --------------------------------------------------------------------------


def test_next_week_creates_a_new_snapshot(client, northwest_shrines):
    _post_on(client, REFERENCE_DATE)
    _post_on(client, NEXT_WEEK_REFERENCE_DATE)

    week_starts = sorted(
        str(value) for value in WeeklyPresentationSnapshot.objects.values_list("week_start", flat=True)
    )
    assert week_starts == [WEEK_START, NEXT_WEEK_START]


def test_every_day_of_the_same_week_shares_one_snapshot(client, northwest_shrines):
    for day in (14, 15, 18, 20):
        response = _post_on(client, date(2026, 9, day))
        assert response.json()["week"]["start"] == WEEK_START

    assert WeeklyPresentationSnapshot.objects.count() == 1


def test_different_purpose_creates_a_new_snapshot(client, northwest_shrines):
    _post_on(client, REFERENCE_DATE, purpose="career")
    _post_on(client, REFERENCE_DATE, purpose="money")

    assert sorted(WeeklyPresentationSnapshot.objects.values_list("purpose", flat=True)) == [
        "career",
        "money",
    ]


def test_changed_direction_fingerprint_creates_a_new_snapshot(client, northwest_shrines):
    """同じ週・同じpurposeでも、direction_contextが変われば別Snapshotになる。

    fingerprint対象field（ここではsolarMonthIndex）を変えるために、既存
    Compass Runtimeの戻り値を差し替える。kyusei側の算出仕様は一切変更しない。
    """
    _post_on(client, REFERENCE_DATE)
    first_fingerprint = WeeklyPresentationSnapshot.objects.get().direction_fingerprint

    from temples.services.compass_runtime import build_compass_direction_runtime as real_runtime

    def _shifted_runtime(*, birthdate, target_date):
        context = real_runtime(birthdate=birthdate, target_date=target_date)
        assert isinstance(context, dict)
        return {**context, "solarMonthIndex": context["solarMonthIndex"] + 1}

    with patch(
        "temples.services.weekly_compass_service.build_compass_direction_runtime",
        side_effect=_shifted_runtime,
    ):
        _post_on(client, REFERENCE_DATE)

    fingerprints = set(
        WeeklyPresentationSnapshot.objects.values_list("direction_fingerprint", flat=True)
    )
    assert len(fingerprints) == 2
    assert first_fingerprint in fingerprints


def test_snapshot_lookup_is_scoped_to_presentation_version(client, northwest_shrines):
    """保存済みversionが異なるSnapshotはHITせず、Recommendationが再実行される。"""
    _post_on(client, REFERENCE_DATE)
    WeeklyPresentationSnapshot.objects.update(presentation_version="weekly_presentation_v0")

    import temples.services.weekly_compass_service as service

    real = service.get_compass_recommendations
    with patch.object(service, "get_compass_recommendations", side_effect=real) as spy:
        response = _post_on(client, REFERENCE_DATE)

    assert response.status_code == 200
    assert spy.call_count == 1
    assert WeeklyPresentationSnapshot.objects.count() == 2


# --------------------------------------------------------------------------
# non-success
# --------------------------------------------------------------------------


def test_invalid_purpose_returns_400_and_creates_no_snapshot(client, northwest_shrines):
    response = _post_on(client, REFERENCE_DATE, purpose="not_a_real_tag")

    assert response.status_code == 400
    assert response.json()["state"] == "invalid_purpose"
    assert WeeklyPresentationSnapshot.objects.count() == 0


def test_missing_birthdate_returns_direction_filter_unavailable_without_snapshot(client, northwest_shrines):
    response = _post_on(client, REFERENCE_DATE, birthdate="")

    assert response.status_code == 200
    assert response.json()["state"] == "direction_filter_unavailable"
    assert WeeklyPresentationSnapshot.objects.count() == 0


def test_no_common_direction_creates_no_snapshot(client, northwest_shrines):
    from temples.services.compass_runtime import NoCommonDirectionResult

    with patch(
        "temples.services.weekly_compass_service.build_compass_direction_runtime",
        return_value=NoCommonDirectionResult(),
    ):
        response = _post_on(client, REFERENCE_DATE)

    assert response.status_code == 200
    assert response.json()["state"] == "no_common_direction"
    assert WeeklyPresentationSnapshot.objects.count() == 0


def test_direction_zero_candidates_creates_no_snapshot(client, shrine_factory):
    """方位の合う候補が1件もない（南東側にしかShrineがない）ケース。"""
    shrine_factory(name="南東の神社", latitude=34.8, longitude=135.2)

    response = _post_on(client, REFERENCE_DATE)

    assert response.status_code == 200
    assert response.json()["state"] == "direction_zero_candidates"
    assert WeeklyPresentationSnapshot.objects.count() == 0


def test_evidence_zero_candidates_creates_no_snapshot(client, northwest_shrines):
    from temples.services.compass_recommendation_orchestrator import (
        STATE_EVIDENCE_ZERO_CANDIDATES,
        CompassRecommendationResult,
    )

    with patch(
        "temples.services.weekly_compass_service.get_compass_recommendations",
        return_value=CompassRecommendationResult(
            state=STATE_EVIDENCE_ZERO_CANDIDATES,
            purpose="career",
            direction_context={"referenceDirections": ["北西"]},
        ),
    ):
        response = _post_on(client, REFERENCE_DATE)

    assert response.status_code == 200
    assert response.json()["state"] == STATE_EVIDENCE_ZERO_CANDIDATES
    assert WeeklyPresentationSnapshot.objects.count() == 0


def test_non_success_response_keeps_a_stable_shape(client, northwest_shrines):
    body = _post_on(client, REFERENCE_DATE, birthdate="").json()

    assert body["weekly_theme"] is None
    assert body["featured_shrines"] == []
    assert body["week"] == {"start": WEEK_START, "end": WEEK_END}
    assert body["presentation_version"] == WEEKLY_PRESENTATION_VERSION


# --------------------------------------------------------------------------
# hydration: unavailable / ordering
# --------------------------------------------------------------------------


def test_unavailable_shrine_is_dropped_without_replacement(client, northwest_shrines):
    first = _post_on(client, REFERENCE_DATE).json()
    stored_ids = WeeklyPresentationSnapshot.objects.get().featured_shrine_ids
    assert len(stored_ids) == 3

    # 2件目のusable Factを外す -> Shared Recommendation Eligibility上表示不可。
    unavailable_id = stored_ids[1]
    Shrine.objects.get(pk=unavailable_id).deities.all().delete()

    second = _post_on(client, REFERENCE_DATE).json()

    assert [s["id"] for s in second["featured_shrines"]] == [stored_ids[0], stored_ids[2]]
    # Snapshot自体は書き換えず、補充もしない。
    assert WeeklyPresentationSnapshot.objects.get().featured_shrine_ids == stored_ids
    assert len(second["featured_shrines"]) == len(first["featured_shrines"]) - 1


def test_deleted_shrine_is_dropped_without_replacement(client, northwest_shrines):
    _post_on(client, REFERENCE_DATE)
    stored_ids = WeeklyPresentationSnapshot.objects.get().featured_shrine_ids
    Shrine.objects.filter(pk=stored_ids[0]).delete()

    body = _post_on(client, REFERENCE_DATE).json()

    assert [s["id"] for s in body["featured_shrines"]] == stored_ids[1:]


def test_response_order_follows_snapshot_not_db_order(client, northwest_shrines):
    _post_on(client, REFERENCE_DATE)
    snapshot = WeeklyPresentationSnapshot.objects.get()
    ascending = sorted(snapshot.featured_shrine_ids)
    reordered = [ascending[2], ascending[0], ascending[1]]
    snapshot.featured_shrine_ids = reordered
    snapshot.save(update_fields=["featured_shrine_ids"])

    body = _post_on(client, REFERENCE_DATE).json()

    assert [s["id"] for s in body["featured_shrines"]] == reordered


# --------------------------------------------------------------------------
# error contract
# --------------------------------------------------------------------------


def test_unexpected_exception_returns_500_without_leaking_details(client, northwest_shrines):
    with patch(
        "temples.services.weekly_compass_service.get_compass_recommendations",
        side_effect=RuntimeError("secret internal detail"),
    ):
        response = _post_on(client, REFERENCE_DATE)

    assert response.status_code == 500
    assert response.json() == {"state": "error"}
    assert "secret internal detail" not in response.content.decode()
    assert WeeklyPresentationSnapshot.objects.count() == 0


# --------------------------------------------------------------------------
# observability
# --------------------------------------------------------------------------


def test_pool_and_featured_counts_are_observable(client, northwest_shrines, caplog):
    import logging

    with caplog.at_level(logging.INFO, logger="temples.api_views_compass_weekly"):
        _post_on(client, REFERENCE_DATE)
        miss_log = caplog.text
        caplog.clear()
        _post_on(client, REFERENCE_DATE)
        hit_log = caplog.text

    assert "snapshot=miss" in miss_log
    assert "weekly_candidate_pool_count=" in miss_log
    assert "featured_shrine_count=" in miss_log
    assert "snapshot=hit" in hit_log


def test_logs_do_not_contain_pii(client, northwest_shrines, caplog):
    import logging

    with caplog.at_level(logging.INFO):
        _post_on(client, REFERENCE_DATE)

    anon_id_cookie = client.cookies[ANONYMOUS_ID_COOKIE_NAME].value
    weekly_logs = "\n".join(
        record.getMessage()
        for record in caplog.records
        if record.name.startswith("temples.api_views_compass_weekly")
        or record.name.startswith("temples.services.weekly")
    )

    assert BIRTHDATE not in weekly_logs
    assert anon_id_cookie not in weekly_logs
    assert "35.0" not in weekly_logs
    assert "135.0" not in weekly_logs
