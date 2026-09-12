"""WeeklyPresentationSnapshot（Model constraints + persistence service）のTest。

DB constraint（Owner XOR / Snapshot Uniqueness）を、application validation を
経由せずDB側で実際に拒否されることまで確認する。
"""

from __future__ import annotations

from datetime import date

import pytest
from django.db import IntegrityError, transaction

from temples.domain.weekly_presentation import (
    WEEKLY_PRESENTATION_VERSION,
    build_direction_fingerprint,
    build_weekly_owner_key,
    select_featured_shrine_ids,
)
from temples.domain.weekly_theme_catalog_v1 import select_weekly_theme
from temples.domain.weekly_time_contract import resolve_week_start
from temples.models import WeeklyPresentationSnapshot
from temples.services.weekly_presentation_snapshot import (
    create_weekly_snapshot,
    get_existing_weekly_snapshot,
)

pytestmark = pytest.mark.django_db

WEEK_START = date(2026, 9, 7)
PURPOSE = "career"
ANONYMOUS_ID = "0f8f1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f"
DIRECTION_CONTEXT = {
    "targetDate": "2026-09-15",
    "targetYear": 2026,
    "solarMonthIndex": 8,
    "referenceDirections": ["北西"],
    "calculationMethod": "annual_monthly_kyusei_v1",
}
FINGERPRINT = build_direction_fingerprint(DIRECTION_CONTEXT)

THEME = {"key": "career_next_step", "title": "次の一歩を書き出す", "message": "テスト用の文言。"}


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(username="weekly_owner", password="x")


def _snapshot_kwargs(**overrides):
    values = dict(
        week_start=WEEK_START,
        purpose=PURPOSE,
        direction_fingerprint=FINGERPRINT,
        weekly_theme=THEME,
        featured_shrine_ids=[3, 1, 2],
        presentation_version=WEEKLY_PRESENTATION_VERSION,
    )
    values.update(overrides)
    return values


# --------------------------------------------------------------------------
# Owner XOR (DB constraint)
# --------------------------------------------------------------------------


def test_authenticated_owner_snapshot_is_accepted(user):
    snapshot = create_weekly_snapshot(user=user, **_snapshot_kwargs())
    assert snapshot.user_id == user.id
    assert snapshot.anonymous_id is None


def test_anonymous_owner_snapshot_is_accepted():
    snapshot = create_weekly_snapshot(anonymous_id=ANONYMOUS_ID, **_snapshot_kwargs())
    assert snapshot.user_id is None
    assert snapshot.anonymous_id == ANONYMOUS_ID


def test_database_rejects_snapshot_without_any_owner():
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            WeeklyPresentationSnapshot.objects.create(
                user=None, anonymous_id=None, **_snapshot_kwargs()
            )


def test_database_rejects_snapshot_with_both_owners(user):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            WeeklyPresentationSnapshot.objects.create(
                user=user, anonymous_id=ANONYMOUS_ID, **_snapshot_kwargs()
            )


@pytest.mark.parametrize("kwargs", [{}, {"anonymous_id": "  "}])
def test_service_rejects_ownerless_calls_before_touching_the_database(kwargs):
    with pytest.raises(ValueError):
        create_weekly_snapshot(**kwargs, **_snapshot_kwargs())
    with pytest.raises(ValueError):
        get_existing_weekly_snapshot(
            **kwargs,
            week_start=WEEK_START,
            purpose=PURPOSE,
            direction_fingerprint=FINGERPRINT,
        )


# --------------------------------------------------------------------------
# Snapshot Uniqueness (DB constraint)
# --------------------------------------------------------------------------


def test_database_rejects_duplicate_snapshot_for_the_same_authenticated_owner(user):
    create_weekly_snapshot(user=user, **_snapshot_kwargs())
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            create_weekly_snapshot(user=user, **_snapshot_kwargs(featured_shrine_ids=[9]))


def test_database_rejects_duplicate_snapshot_for_the_same_anonymous_owner():
    create_weekly_snapshot(anonymous_id=ANONYMOUS_ID, **_snapshot_kwargs())
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            create_weekly_snapshot(
                anonymous_id=ANONYMOUS_ID, **_snapshot_kwargs(featured_shrine_ids=[9])
            )


@pytest.mark.parametrize(
    "changed",
    [
        {"week_start": date(2026, 9, 14)},
        {"purpose": "money"},
        {"direction_fingerprint": build_direction_fingerprint({"referenceDirections": ["東"]})},
        {"presentation_version": "weekly_presentation_v2"},
    ],
)
def test_a_different_unique_key_component_allows_a_second_snapshot(user, changed):
    create_weekly_snapshot(user=user, **_snapshot_kwargs())
    create_weekly_snapshot(user=user, **_snapshot_kwargs(**changed))
    assert WeeklyPresentationSnapshot.objects.filter(user=user).count() == 2


def test_different_owners_do_not_collide(user):
    create_weekly_snapshot(user=user, **_snapshot_kwargs())
    create_weekly_snapshot(anonymous_id=ANONYMOUS_ID, **_snapshot_kwargs())
    assert WeeklyPresentationSnapshot.objects.count() == 2


def test_null_owner_column_does_not_weaken_uniqueness_for_the_other_owner_kind(user):
    """user側Snapshotが複数あっても、anonymous_id=NULL 同士は衝突しない。"""
    create_weekly_snapshot(user=user, **_snapshot_kwargs())
    create_weekly_snapshot(user=user, **_snapshot_kwargs(purpose="money"))
    assert WeeklyPresentationSnapshot.objects.filter(anonymous_id__isnull=True).count() == 2


# --------------------------------------------------------------------------
# lookup / create separation
# --------------------------------------------------------------------------


def test_lookup_returns_none_when_no_snapshot_exists(user):
    assert (
        get_existing_weekly_snapshot(
            user=user,
            week_start=WEEK_START,
            purpose=PURPOSE,
            direction_fingerprint=FINGERPRINT,
        )
        is None
    )


def test_lookup_finds_the_snapshot_created_for_that_owner(user):
    created = create_weekly_snapshot(user=user, **_snapshot_kwargs())
    found = get_existing_weekly_snapshot(
        user=user,
        week_start=WEEK_START,
        purpose=PURPOSE,
        direction_fingerprint=FINGERPRINT,
    )
    assert found is not None and found.pk == created.pk


def test_lookup_does_not_leak_another_owners_snapshot(user):
    create_weekly_snapshot(user=user, **_snapshot_kwargs())
    assert (
        get_existing_weekly_snapshot(
            anonymous_id=ANONYMOUS_ID,
            week_start=WEEK_START,
            purpose=PURPOSE,
            direction_fingerprint=FINGERPRINT,
        )
        is None
    )


def test_lookup_is_scoped_to_the_presentation_version(user):
    create_weekly_snapshot(user=user, **_snapshot_kwargs())
    assert (
        get_existing_weekly_snapshot(
            user=user,
            week_start=WEEK_START,
            purpose=PURPOSE,
            direction_fingerprint=FINGERPRINT,
            presentation_version="weekly_presentation_v2",
        )
        is None
    )


# --------------------------------------------------------------------------
# what the snapshot stores (and deliberately does not store)
# --------------------------------------------------------------------------


def test_snapshot_stores_theme_key_title_and_message(user):
    create_weekly_snapshot(user=user, **_snapshot_kwargs())
    stored = WeeklyPresentationSnapshot.objects.get()
    assert stored.weekly_theme == THEME


def test_stored_theme_survives_a_catalog_change(user):
    """Catalogが将来変わっても、その週の表示結果は変わらない。"""
    create_weekly_snapshot(user=user, **_snapshot_kwargs())
    stored = WeeklyPresentationSnapshot.objects.get()
    assert stored.weekly_theme["message"] == THEME["message"]
    assert stored.weekly_theme["message"] != select_weekly_theme(
        purpose=PURPOSE,
        direction_fingerprint=FINGERPRINT,
        week_start=WEEK_START,
        presentation_version=WEEKLY_PRESENTATION_VERSION,
    )["message"]


def test_featured_shrine_ids_preserve_their_order(user):
    create_weekly_snapshot(user=user, **_snapshot_kwargs(featured_shrine_ids=[30, 10, 20]))
    assert WeeklyPresentationSnapshot.objects.get().featured_shrine_ids == [30, 10, 20]


def test_snapshot_has_only_the_agreed_business_fields():
    """保存禁止fieldがModelへ紛れ込んでいないことを、column集合で固定する。"""
    stored_fields = {field.name for field in WeeklyPresentationSnapshot._meta.fields}
    assert stored_fields == {
        "id",
        "user",
        "anonymous_id",
        "week_start",
        "purpose",
        "direction_fingerprint",
        "weekly_theme",
        "featured_shrine_ids",
        "presentation_version",
        "created_at",
    }


# --------------------------------------------------------------------------
# Reproducibility Contract (domain -> snapshot, end to end within this PR)
# --------------------------------------------------------------------------


def test_same_context_reproduces_the_same_theme_and_featured_ids(user):
    recommendations = [{"shrine_id": shrine_id} for shrine_id in range(1, 13)]
    owner_key = build_weekly_owner_key(user_id=user.id)
    week_start = resolve_week_start(date(2026, 9, 12))

    def _resolve():
        theme = select_weekly_theme(
            purpose=PURPOSE,
            direction_fingerprint=FINGERPRINT,
            week_start=week_start,
            presentation_version=WEEKLY_PRESENTATION_VERSION,
        )
        featured = select_featured_shrine_ids(
            recommendations=recommendations,
            owner_key=owner_key,
            week_start=week_start,
            purpose=PURPOSE,
            direction_fingerprint=FINGERPRINT,
            presentation_version=WEEKLY_PRESENTATION_VERSION,
        )
        return theme, featured

    first_theme, first_featured = _resolve()
    second_theme, second_featured = _resolve()
    assert (first_theme, first_featured) == (second_theme, second_featured)

    snapshot = create_weekly_snapshot(
        user=user,
        week_start=week_start,
        purpose=PURPOSE,
        direction_fingerprint=FINGERPRINT,
        weekly_theme=first_theme,
        featured_shrine_ids=first_featured,
    )
    assert snapshot.weekly_theme == second_theme
    assert snapshot.featured_shrine_ids == second_featured
    assert snapshot.week_start == WEEK_START
