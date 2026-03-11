# -*- coding: utf-8 -*-
import pytest

from temples.models import PlaceRef, Shrine
from temples.services.concierge_chat_candidates import build_chat_candidates


@pytest.fixture
def shrine_factory(db):
    def _factory(
        *,
        name: str,
        latitude=None,
        longitude=None,
        address: str = "東京都千代田区",
        place_id: str | None = None,
        popular_score: float = 0.0,
    ) -> Shrine:
        place_ref = None
        if place_id:
            place_ref = PlaceRef.objects.create(place_id=place_id, name=name, address=address)

        shrine = Shrine(
            name_jp=name,
            address=address,
            latitude=latitude,
            longitude=longitude,
            popular_score=popular_score,
            place_ref=place_ref,
        )
        Shrine.objects.bulk_create([shrine])
        return Shrine.objects.get(pk=shrine.pk)

    return _factory


@pytest.mark.django_db
def test_candidates_exclude_missing_coordinates(shrine_factory):
    """
    CR-006:
    lat/lng が欠損している shrine は候補に入らない。
    """

    shrine_factory(
        name="OK神社",
        latitude=35.0,
        longitude=139.0,
    )

    shrine_factory(
        name="NG神社",
        latitude=None,
        longitude=None,
    )

    cands = build_chat_candidates(
        lat=35.0,
        lng=139.0,
        area=None,
        goriyaku_tag_ids=None,
        trace_id="test",
    )

    names = [c["name"] for c in cands]

    assert "OK神社" in names
    assert "NG神社" not in names


@pytest.mark.django_db
def test_candidates_exclude_empty_address(shrine_factory):
    """
    CR-006:
    address が空文字の shrine は候補に入らない。
    """

    shrine_factory(
        name="住所あり神社",
        latitude=35.0,
        longitude=139.0,
        address="東京都千代田区1-1",
    )

    shrine_factory(
        name="住所なし神社",
        latitude=35.0,
        longitude=139.0,
        address="",
    )

    cands = build_chat_candidates(
        lat=35.0,
        lng=139.0,
        area=None,
        goriyaku_tag_ids=None,
        trace_id="test",
    )

    names = [c["name"] for c in cands]

    assert "住所あり神社" in names
    assert "住所なし神社" not in names


@pytest.mark.django_db
def test_candidates_include_distance_m(shrine_factory):
    """
    CR-006:
    candidate は distance_m を持つ。
    """

    shrine_factory(
        name="距離テスト神社",
        latitude=35.0,
        longitude=139.0,
        place_id="test_place_id",
    )

    cands = build_chat_candidates(
        lat=35.0,
        lng=139.0,
        area=None,
        goriyaku_tag_ids=None,
        trace_id="test",
    )

    cand = next(c for c in cands if c["name"] == "距離テスト神社")

    assert "distance_m" in cand


@pytest.mark.django_db
def test_candidates_include_place_id_when_available(shrine_factory):
    """
    CR-006:
    place_id がある shrine は candidate に place_id を含む。
    """

    shrine_factory(
        name="place_idテスト神社",
        latitude=35.0,
        longitude=139.0,
        place_id="test_place_id",
    )

    cands = build_chat_candidates(
        lat=35.0,
        lng=139.0,
        area=None,
        goriyaku_tag_ids=None,
        trace_id="test",
    )

    cand = next(c for c in cands if c["name"] == "place_idテスト神社")

    assert cand["place_id"] == "test_place_id"


@pytest.mark.django_db
def test_candidates_are_sorted_by_popular_score_desc(shrine_factory):
    """
    CR-006:
    candidate order は popular_score で降順。
    """

    shrine_factory(
        name="人気低",
        latitude=35.0,
        longitude=139.0,
        popular_score=10,
    )

    shrine_factory(
        name="人気高",
        latitude=35.0,
        longitude=139.0,
        popular_score=100,
    )

    cands = build_chat_candidates(
        lat=35.0,
        lng=139.0,
        area=None,
        goriyaku_tag_ids=None,
        trace_id="test",
    )

    names = [c["name"] for c in cands]

    assert names.index("人気高") < names.index("人気低")
