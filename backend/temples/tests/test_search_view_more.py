# -*- coding: utf-8 -*-
import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_places_text_search_missing_query_returns_400():
    """
    /api/places/text-search/ で query(or q) が無いと 400
    """
    url = reverse("temples:places-text-search")
    resp = APIClient().get(url, data={})
    assert resp.status_code == 400


@pytest.mark.django_db
def test_places_text_search_legacy_route_exists_and_400_without_query():
    """
    /api/places/text_search/ (legacy) ルートが解決でき、
    パラメータ不足で 400 を返す
    """
    url = reverse("temples:places-text-search-legacy")
    resp = APIClient().get(url, data={})
    assert resp.status_code == 400


@pytest.mark.django_db
def test_places_detail_missing_place_id_returns_400():
    """
    /api/places/detail/ で place_id 無し → 400
    """
    # urls.py 側の name が "places-search" 等と並んでいる想定に合わせる
    # detail の name が異なる場合はここを合わせてください
    url = reverse("temples:places-search").replace("search/", "detail/")
    resp = APIClient().get(url, data={})
    # ルートが存在しない場合は NoReverseMatch になるので、
    # そのときは urls の name に合わせて修正
    assert resp.status_code == 400


@pytest.mark.django_db
def test_places_photo_missing_reference_returns_400():
    """
    /api/places/photo/ で photo_reference 無し → 400
    """
    url = reverse("temples:places-search").replace("search/", "photo/")
    resp = APIClient().get(url, data={})
    assert resp.status_code == 400


@pytest.mark.django_db
def test_places_nearby_missing_location_returns_400():
    """
    /api/places/nearby-search/ で location 無し → 400
    """
    url = reverse("temples:places-nearby-search")
    resp = APIClient().get(url, data={})
    assert resp.status_code == 400
