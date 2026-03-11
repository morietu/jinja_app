# -*- coding: utf-8 -*-
import json

import pytest

URL = "/api/concierge/chat/"


def _capture_calls(monkeypatch):
    captured = {"recs": {}, "cands": {}}

    def fake_build_chat_candidates(**kwargs):
        captured["cands"].update(kwargs)
        return []

    def fake_build_chat_recommendations(**kwargs):
        captured["recs"].update(kwargs)
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

    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", fake_build_chat_candidates)
    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )
    return captured


@pytest.mark.django_db
def test_request_normalization_characterisation_top_level_precedence_over_filters(client, monkeypatch):
    captured = _capture_calls(monkeypatch)

    payload = {
        "query": "近場で参拝したい",
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

    assert captured["recs"]["birthdate"] == "1990-01-01"
    assert captured["recs"]["goriyaku_tag_ids"] == [999]
    assert captured["recs"]["extra_condition"] == "にぎやか"


@pytest.mark.django_db
def test_request_normalization_characterisation_promotes_filters_only_when_top_level_missing(
    client, monkeypatch
):
    captured = _capture_calls(monkeypatch)

    payload = {
        "query": "近場で参拝したい",
        "lat": 35.0,
        "lng": 139.0,
        "birthdate": "",
        "goriyaku_tag_ids": [],
        "extra_condition": "",
        "filters": {
            "birthdate": "1984-05-15",
            "goriyaku_tag_ids": [10, 20],
            "extra_condition": "静か",
        },
    }
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["recs"]["birthdate"] == "1984-05-15"
    assert captured["recs"]["goriyaku_tag_ids"] == [10, 20]
    assert captured["recs"]["extra_condition"] == "静か"


@pytest.mark.django_db
def test_request_normalization_characterisation_message_precedence_over_query(client, monkeypatch):
    captured = _capture_calls(monkeypatch)

    payload = {
        "message": "message優先",
        "query": "queryは使わない",
        "lat": 35.0,
        "lng": 139.0,
    }
    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["recs"]["query"] == "message優先"


@pytest.mark.django_db
def test_request_normalization_characterisation_top_level_latlng_precedence_over_area_geocode(
    client, monkeypatch
):
    captured = _capture_calls(monkeypatch)
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

    assert captured["cands"]["lat"] == pytest.approx(35.1)
    assert captured["cands"]["lng"] == pytest.approx(139.1)
    assert captured["recs"]["bias"]["lat"] == pytest.approx(35.1)
    assert captured["recs"]["bias"]["lng"] == pytest.approx(139.1)
