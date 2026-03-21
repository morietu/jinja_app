# -*- coding: utf-8 -*-
import json

import pytest

URL = "/api/concierge/chat/"


def _capture_recommendations(monkeypatch):
    captured = {}

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {
                    "name": "神社A",
                    "reason": "ok",
                    "reason_source": "reason:test",
                    "breakdown": {"matched_need_tags": []},
                }
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )
    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )
    return captured


@pytest.mark.django_db
def test_chat_view_characterisation_message_takes_precedence_over_query(client, monkeypatch):
    captured = _capture_recommendations(monkeypatch)

    payload = {
        "message": "message優先",
        "query": "queryは使わない",
        "lat": 35.0,
        "lng": 139.0,
    }
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200
    assert captured["query"] == "message優先"


@pytest.mark.django_db
def test_chat_view_characterisation_top_level_takes_precedence_over_filters(client, monkeypatch):
    captured = _capture_recommendations(monkeypatch)

    payload = {
        "message": "近場で参拝したい",
        "lat": 35.0,
        "lng": 139.0,
        "birthdate": "1990-01-01",
        "goriyaku_tag_ids": [999],
        "extra_condition": "にぎやか",
        "filters": {
            "birthdate": "1984-05-15",
            "goriyaku_tag_ids": [10, 20],
            "extra_condition": "静か",
        },
    }
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["birthdate"] == "1990-01-01"
    assert captured["goriyaku_tag_ids"] == [999]
    assert captured["extra_condition"] == "にぎやか"


@pytest.mark.django_db
def test_chat_view_characterisation_direct_latlng_overrides_area_geocode(client, monkeypatch):
    captured = _capture_recommendations(monkeypatch)

    monkeypatch.setattr(
        "temples.api_views_concierge._geocode_area_for_chat",
        lambda **kwargs: (35.0, 140.0),
    )

    payload = {
        "query": "近場で参拝したい",
        "area": "東京駅",
        "lat": 35.1,
        "lng": 139.1,
    }
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["bias"]["lat"] == pytest.approx(35.1)
    assert captured["bias"]["lng"] == pytest.approx(139.1)


@pytest.mark.django_db
def test_chat_view_characterisation_uses_area_geocode_when_latlng_missing(client, monkeypatch):
    captured = _capture_recommendations(monkeypatch)
    monkeypatch.setattr(
        "temples.api_views_concierge._geocode_area_for_chat",
        lambda **kwargs: (35.6812, 139.7671),
    )

    payload = {"query": "東京駅周辺", "area": "東京駅"}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["bias"]["lat"] == pytest.approx(35.6812)
    assert captured["bias"]["lng"] == pytest.approx(139.7671)


@pytest.mark.django_db
def test_chat_view_characterisation_flow_remains_a_when_query_exists_with_goriyaku_tag_ids(client, monkeypatch):
    """
    query/message がある通常相談では、
    goriyaku_tag_ids が指定されても flow は A を維持する。
    """
    captured = _capture_recommendations(monkeypatch)

    payload = {"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0, "goriyaku_tag_ids": [1]}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200
    assert captured["flow"] == "A"

@pytest.mark.django_db
def test_chat_view_characterisation_flow_remains_a_when_query_exists_with_extra_condition(client, monkeypatch):
    """
    query/message がある通常相談では、
    extra_condition が非空でも flow は A を維持する。
    """
    captured = _capture_recommendations(monkeypatch)

    payload = {"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0, "extra_condition": "静か"}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200
    assert captured["flow"] == "A"



@pytest.mark.django_db
def test_chat_view_characterisation_flow_remains_a_when_no_effective_filters(client, monkeypatch):
    captured = _capture_recommendations(monkeypatch)

    payload = {
        "query": "近場で参拝したい",
        "lat": 35.0,
        "lng": 139.0,
        "goriyaku_tag_ids": [],
        "extra_condition": "   ",
    }
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200
    assert captured["flow"] == "A"

@pytest.mark.django_db
def test_chat_view_characterisation_flow_remains_a_when_query_exists_with_goriyaku_tag_ids(client, monkeypatch):
    """
    query/message がある通常相談では、
    goriyaku_tag_ids が指定されても flow は A を維持する。
    """
    captured = _capture_recommendations(monkeypatch)

    payload = {"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0, "goriyaku_tag_ids": [1]}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200
    assert captured["flow"] == "A"


@pytest.mark.django_db
def test_chat_view_characterisation_flow_remains_a_when_query_exists_with_extra_condition(client, monkeypatch):
    """
    query/message がある通常相談では、
    extra_condition が非空でも flow は A を維持する。
    """
    captured = _capture_recommendations(monkeypatch)

    payload = {"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0, "extra_condition": "静か"}
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200
    assert captured["flow"] == "A"
