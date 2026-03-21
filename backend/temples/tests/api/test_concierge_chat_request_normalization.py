# -*- coding: utf-8 -*-
import json

import pytest

URL = "/api/concierge/chat/"


@pytest.mark.django_db
def test_chat_promotes_filters_to_top_level_and_keeps_need_mode_when_query_exists(client, monkeypatch):
    """
    CR-001:
    filters.birthdate / filters.goriyaku_tag_ids / filters.extra_condition が
    top-level 未指定時に build_chat_recommendations へ渡ること。
    ただし message/query があるので public_mode='need', flow='A' を維持すること。
    """
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

    payload = {
        "message": "近場で参拝したい",
        "lat": 35.0,
        "lng": 139.0,
        "filters": {
            "birthdate": "1984-05-15",
            "goriyaku_tag_ids": [10, 20],
            "extra_condition": "静か",
        },
    }

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["query"] == "近場で参拝したい"
    assert captured["birthdate"] == "1984-05-15"
    assert captured["goriyaku_tag_ids"] == [10, 20]
    assert captured["extra_condition"] == "静か"
    assert captured["public_mode"] == "need"
    assert captured["flow"] == "A"


@pytest.mark.django_db
def test_chat_top_level_values_override_filters_values_and_keep_need_mode(client, monkeypatch):
    """
    CR-001:
    top-level と filters の両方に値があるときは top-level 優先。
    かつ query/message があるため public_mode='need', flow='A' を維持する。
    """
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

    payload = {
        "message": "転職が気になる",
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

    assert captured["query"] == "転職が気になる"
    assert captured["birthdate"] == "1990-01-01"
    assert captured["goriyaku_tag_ids"] == [999]
    assert captured["extra_condition"] == "にぎやか"
    assert captured["public_mode"] == "need"
    assert captured["flow"] == "A"

@pytest.mark.django_db
def test_chat_rescues_birthdate_from_query_and_switches_to_compat_mode(client, monkeypatch):
    """
    CR-002:
    top-level birthdate / filters.birthdate が空でも、
    query が YYYY-MM-DD 形式なら backend で birthdate に救済すること。
    その場合 public_mode='compat', flow='B' になること。
    """
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

    payload = {
        "query": "1984-05-15",
    }

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["query"] == ""
    assert captured["birthdate"] == "1984-05-15"
    assert captured["public_mode"] == "compat"
    assert captured["flow"] == "B"


@pytest.mark.django_db
def test_chat_birthdate_only_allows_empty_query_in_compat_mode(client, monkeypatch):
    """
    CR-002:
    birthdate only の入力では query='' でも 400 にならず、
    compat として build_chat_recommendations へ到達すること。
    """
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

    payload = {
        "birthdate": "1984-05-15",
        "query": "",
    }

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["query"] == ""
    assert captured["birthdate"] == "1984-05-15"
    assert captured["public_mode"] == "compat"
    assert captured["flow"] == "B"

@pytest.mark.django_db
def test_chat_rescues_birthdate_from_slash_query_and_switches_to_compat_mode(client, monkeypatch):
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

    payload = {"query": "1984/05/15"}

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["query"] == ""
    assert captured["birthdate"] == "1984-05-15"
    assert captured["public_mode"] == "compat"
    assert captured["flow"] == "B"

@pytest.mark.django_db
def test_chat_rescues_birthdate_from_slash_query_and_switches_to_compat_mode(client, monkeypatch):
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

    payload = {"query": "1984/05/15"}

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["query"] == ""
    assert captured["birthdate"] == "1984-05-15"
    assert captured["public_mode"] == "compat"
    assert captured["flow"] == "B"


@pytest.mark.django_db
def test_chat_rescues_birthdate_from_compact_query_and_switches_to_compat_mode(client, monkeypatch):
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

    payload = {"query": "19840515"}

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["query"] == ""
    assert captured["birthdate"] == "1984-05-15"
    assert captured["public_mode"] == "compat"
    assert captured["flow"] == "B"

@pytest.mark.django_db
def test_chat_does_not_rescue_invalid_birthdate_query(client, monkeypatch):
    captured = {}

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_candidates",
        lambda **kwargs: [],
    )

    def fake_build_chat_recommendations(**kwargs):
        captured.update(kwargs)
        return {
            "recommendations": [
                {"name": "A", "reason": "ok", "breakdown": {"matched_need_tags": []}}
            ]
        }

    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        fake_build_chat_recommendations,
    )

    payload = {"query": "1984-02-30"}

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    assert captured["query"] == "1984-02-30"
    assert captured["birthdate"] is None
    assert captured["public_mode"] == "need"
    assert captured["flow"] == "A"
