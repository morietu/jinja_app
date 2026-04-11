from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from temples.models import Shrine, ShrineSubmission


pytestmark = pytest.mark.django_db


def _create_user(username: str = "submission_user"):
    User = get_user_model()
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="testpass123",
    )


def test_create_shrine_submission_authenticated():
    user = _create_user()

    client = APIClient()
    client.force_authenticate(user=user)

    payload = {
        "name": "投稿テスト神社",
        "address": "東京都投稿区1-2-3",
        "lat": 35.6812,
        "lng": 139.7671,
        "goriyaku_tags": ["開運", "厄除け"],
        "note": "投稿APIの動作確認",
    }

    resp = client.post("/api/shrine-submissions/", payload, format="json")

    assert resp.status_code == 201
    body = resp.json()

    assert body["name"] == "投稿テスト神社"
    assert body["address"] == "東京都投稿区1-2-3"
    assert body["status"] == "pending"
    assert body["goriyaku_tags"] == ["開運", "厄除け"]
    assert body["note"] == "投稿APIの動作確認"

    sub = ShrineSubmission.objects.get(id=body["id"])
    assert sub.user_id == user.id
    assert sub.status == ShrineSubmission.Status.PENDING

    # 投稿時点では shrine 本体は作られない
    assert not Shrine.objects.filter(name_jp="投稿テスト神社", address="東京都投稿区1-2-3").exists()


def test_create_shrine_submission_requires_auth():
    client = APIClient()

    payload = {
        "name": "未ログイン投稿神社",
        "address": "東京都未ログイン区1-1-1",
        "lat": 35.6812,
        "lng": 139.7671,
        "goriyaku_tags": ["開運"],
        "note": "未ログイン投稿",
    }

    resp = client.post("/api/shrine-submissions/", payload, format="json")

    assert resp.status_code in (401, 403)
    assert ShrineSubmission.objects.filter(name="未ログイン投稿神社").count() == 0


def test_create_shrine_submission_rejects_duplicate_existing_shrine():
    user = _create_user(username="dup_user")

    Shrine.objects.create(
        name_jp="既存重複神社",
        address="東京都重複区9-9-9",
        latitude=35.7000,
        longitude=139.7000,
        owner=user,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    payload = {
        "name": "既存重複神社",
        "address": "東京都重複区9-9-9",
        "lat": 35.7000,
        "lng": 139.7000,
        "goriyaku_tags": ["厄除け"],
        "note": "duplicate test",
    }

    resp = client.post("/api/shrine-submissions/", payload, format="json")

    assert resp.status_code == 400
    body = resp.json()
    assert "non_field_errors" in body
    assert ShrineSubmission.objects.filter(name="既存重複神社", address="東京都重複区9-9-9").count() == 0


def test_create_shrine_submission_rejects_duplicate_pending_submission():
    user = _create_user(username="pending_dup_user")

    ShrineSubmission.objects.create(
        user=user,
        name="審査中重複神社",
        address="東京都審査中区8-8-8",
        lat=35.6800,
        lng=139.7600,
        goriyaku_tags=["開運"],
        note="existing pending",
        status=ShrineSubmission.Status.PENDING,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    payload = {
        "name": "審査中重複神社",
        "address": "東京都審査中区8-8-8",
        "lat": 35.6800,
        "lng": 139.7600,
        "goriyaku_tags": ["開運"],
        "note": "new pending dup",
    }

    resp = client.post("/api/shrine-submissions/", payload, format="json")

    assert resp.status_code == 400
    body = resp.json()
    assert "non_field_errors" in body
    assert ShrineSubmission.objects.filter(name="審査中重複神社", address="東京都審査中区8-8-8").count() == 1
