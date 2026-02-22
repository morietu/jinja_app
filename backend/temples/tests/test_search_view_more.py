# -*- coding: utf-8 -*-
import pytest
from rest_framework.test import APIClient
from django.urls import reverse

@pytest.mark.django_db
def test_places_text_search_missing_query_returns_400():
    url = reverse("temples:places-text-search")
    resp = APIClient().get(url, data={})
    assert resp.status_code == 400

@pytest.mark.django_db
def test_places_text_search_legacy_route_exists_and_400_without_query():
    url = reverse("temples:places-text-search-legacy")
    resp = APIClient().get(url, data={})
    assert resp.status_code == 400

@pytest.mark.django_db
def test_places_photo_missing_reference_returns_400():
    # name があるならそれを使うのが理想。なければ直URLでもいい。
    resp = APIClient().get("/api/places/photo/")
    assert resp.status_code == 400

@pytest.mark.django_db
def test_places_nearby_missing_location_returns_400():
    url = reverse("temples:places-nearby")
    res = APIClient().get(url)
    assert res.status_code == 400

@pytest.mark.django_db
def test_places_nearby_hyphen_missing_location_returns_400():
    url = reverse("temples:places-nearby-search-legacy-hyphen")
    res = APIClient().get(url)
    assert res.status_code == 400

# ---- contract: detail endpoints must be permissive (non-ChI allowed) ----

@pytest.mark.django_db
def test_places_detail_by_id_is_permissive_for_non_chi_place_id():
    res = APIClient().get("/api/places/PID_INTERNAL_123/")
    assert res.status_code != 400

@pytest.mark.django_db
def test_places_detail_by_query_is_permissive_for_non_chi_place_id():
    res = APIClient().get("/api/places/detail/", {"place_id": "PID_INTERNAL_123"})
    assert res.status_code != 400
