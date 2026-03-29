# -*- coding: utf-8 -*-
import json
from types import SimpleNamespace

import pytest
from rest_framework.test import APIClient

URL = "/api/concierge/chat/"


def _stub_base_dependencies(monkeypatch, recommendations):
    monkeypatch.setattr("temples.api_views_concierge.build_chat_candidates", lambda **kwargs: [])
    monkeypatch.setattr(
        "temples.api_views_concierge.build_chat_recommendations",
        lambda **kwargs: {"recommendations": recommendations},
    )


@pytest.mark.django_db
def test_chat_response_builder_includes_remaining_and_limit_for_authenticated_and_guest_but_not_premium(
    user, monkeypatch
):
    _stub_base_dependencies(
        monkeypatch,
        [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}],
    )
    monkeypatch.setattr("temples.api_views_concierge.is_premium_for_user", lambda _u: False)

    auth_client = APIClient()
    auth_client.force_authenticate(user=user)
    r_auth = auth_client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r_auth.status_code == 200
    body_auth = r_auth.json()
    assert "remaining_free" in body_auth
    assert "limit" in body_auth
    assert body_auth["limit"] == 5

    guest_client = APIClient()
    r_guest = guest_client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r_guest.status_code == 200
    body_guest = r_guest.json()
    assert "remaining_free" in body_guest
    assert "limit" in body_guest
    assert body_guest["limit"] == 3
    assert 0 <= body_guest["remaining_free"] <= body_guest["limit"]


@pytest.mark.django_db
def test_chat_response_builder_guest_response_includes_remaining_and_limit(client, monkeypatch):
    _stub_base_dependencies(
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
    assert "remaining_free" in body
    assert "limit" in body
    assert isinstance(body["remaining_free"], int)
    assert isinstance(body["limit"], int)
    assert body["limit"] == 3
    assert 0 <= body["remaining_free"] <= body["limit"]


@pytest.mark.django_db
def test_chat_response_builder_message_mode_reply_is_candidate_format(client, monkeypatch):
    _stub_base_dependencies(
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


@pytest.mark.django_db
def test_chat_response_builder_query_mode_reply_is_none(client, monkeypatch):
    _stub_base_dependencies(
        monkeypatch,
        [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}],
    )

    r = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r.status_code == 200
    assert r.json()["reply"] is None


@pytest.mark.django_db
def test_chat_response_builder_thread_included_only_when_append_chat_returns_saved_thread(
    user, monkeypatch
):
    _stub_base_dependencies(
        monkeypatch,
        [{"name": "神社A", "reason": "ok", "reason_source": "reason:test"}],
    )
    monkeypatch.setattr("temples.api_views_concierge.is_premium_for_user", lambda _u: False)

    client = APIClient()
    client.force_authenticate(user=user)

    monkeypatch.setattr(
        "temples.api_views_concierge.append_chat",
        lambda **kwargs: SimpleNamespace(thread=SimpleNamespace(id=101)),
    )
    r_with_thread = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r_with_thread.status_code == 200
    assert r_with_thread.json()["thread"]["id"] == 101

    monkeypatch.setattr(
        "temples.api_views_concierge.append_chat",
        lambda **kwargs: SimpleNamespace(thread=None),
    )
    r_without_thread = client.post(
        URL,
        data=json.dumps({"query": "近場で参拝したい", "lat": 35.0, "lng": 139.0}),
        content_type="application/json",
    )
    assert r_without_thread.status_code == 200
    assert "thread" not in r_without_thread.json()
