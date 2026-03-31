# -*- coding: utf-8 -*-
import json
from types import SimpleNamespace

import pytest
from rest_framework.test import APIClient

URL = "/api/concierge/chat/"


def _stub_candidates(monkeypatch):
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])


def _stub_recommendations(monkeypatch, recommendations):
    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        lambda **kwargs: {"recommendations": recommendations},
    )


@pytest.mark.django_db
def test_chat_response_includes_base_contract_fields(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    body = r.json()
    for key in ("ok", "intent", "data", "_debug"):
        assert key in body


@pytest.mark.django_db
def test_chat_response_message_mode_reply_prefix_and_names(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(
        monkeypatch,
        [
            {"name": "神社A", "reason": "ok", "reason_source": "reason:test"},
            {"display_name": "神社B", "reason": "ok", "reason_source": "reason:test"},
        ],
    )

    r = client.post(
        URL,
        data=json.dumps({"message": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    reply = r.json()["reply"]
    assert isinstance(reply, str)
    assert reply.startswith("候補: ")
    assert "神社A" in reply
    assert "神社B" in reply


@pytest.mark.django_db
def test_chat_response_query_mode_reply_is_none(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200
    assert r.json()["reply"] is None


@pytest.mark.django_db
def test_chat_response_authenticated_non_premium_includes_remaining_and_limit(user, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])
    monkeypatch.setattr("temples.api_views_concierge.is_premium_for_user", lambda _u: False)

    client = APIClient()
    client.force_authenticate(user=user)

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    body = r.json()
    assert body["plan"] == "free"
    assert "remaining" in body
    assert body["remaining"] == 4
    assert body["limit"] == 5
    assert body["limitReached"] is False


@pytest.mark.django_db
def test_chat_response_anonymous_includes_remaining_and_limit(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(
        monkeypatch,
        [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}],
    )

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    body = r.json()
    assert "remaining" in body
    assert isinstance(body["remaining"], int)
    assert 0 <= body["remaining"] <= body["limit"]
    assert body["plan"] == "anonymous"
    assert body["limitReached"] is False


@pytest.mark.django_db
def test_chat_response_includes_thread_id_when_append_chat_succeeds(user, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(monkeypatch, [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}])
    monkeypatch.setattr("temples.api_views_concierge.is_premium_for_user", lambda _u: False)
    monkeypatch.setattr(
        "temples.api_views_concierge.append_chat",
        lambda **kwargs: SimpleNamespace(thread=SimpleNamespace(id=123)),
    )

    client = APIClient()
    client.force_authenticate(user=user)

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200
    assert r.json()["thread"]["id"] == 123


@pytest.mark.django_db
def test_chat_response_anonymous_includes_thread_when_append_chat_succeeds(client, monkeypatch):
    _stub_candidates(monkeypatch)
    _stub_recommendations(
        monkeypatch,
        [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}],
    )

    called = {"append_chat": 0, "observability": 0}

    def _append_chat_stub(**kwargs):
        called["append_chat"] += 1
        return SimpleNamespace(thread=SimpleNamespace(id=1))

    def _save_log_stub(**kwargs):
        called["observability"] += 1
        return None

    monkeypatch.setattr("temples.api_views_concierge.append_chat", _append_chat_stub)
    monkeypatch.setattr(
        "temples.services.concierge_observability.save_concierge_recommendation_log",
        _save_log_stub,
    )

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200

    body = r.json()
    assert called["append_chat"] == 1
    assert called["observability"] == 1
    assert "thread" in body
    assert body["thread"]["id"] == 1
    assert body["thread_id"] == "1"
    assert body["data"]["thread_id"] == "1"
