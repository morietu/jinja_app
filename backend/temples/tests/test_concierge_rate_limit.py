# backend/temples/tests/test_concierge_rate_limit.py

import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from temples.models import ConciergeUsage


@pytest.mark.django_db
def test_rate_limit_authenticated_user():
    client = APIClient()
    User = get_user_model()

    user = User.objects.create_user(username="user1", password="pass1234")

    # 念のため、その日の Usage を消してクリーンに
    today = timezone.localdate()
    ConciergeUsage.objects.filter(user=user, date=today).delete()

    # JWT 取得
    r = client.post(
        "/api/auth/jwt/create/",
        {"username": "user1", "password": "pass1234"},
        format="json",
    )
    assert r.status_code == 200
    access = r.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    replies = []
    remainings = []

    # 7回叩く（1〜5回目: 通常、6回目以降: 上限メッセージ）
    for _ in range(7):
        res = client.post(
            "/api/concierge/chat/",
            {"query": "仕事運を上げたい"},
            format="json",
        )
        assert res.status_code == 200
        replies.append(res.data.get("reply"))
        remainings.append(res.data.get("remaining_free"))

    # 1〜5回目は remaining_free が 4→3→2→1→0
    assert remainings[:5] == [4, 3, 2, 1, 0]

    # 6回目以降は「無料で利用できる回数を使い切りました。」で remaining_free=0
    assert replies[5] == "無料で利用できる回数を使い切りました。"
    assert remainings[5] == 0
    assert replies[6] == "無料で利用できる回数を使い切りました。"
    assert remainings[6] == 0

    # DB 上も 5回になっていること
    usage = ConciergeUsage.objects.get(user=user, date=today)
    assert usage.count == 5


@pytest.mark.django_db
def test_rate_limit_is_separated_per_user():
    client = APIClient()
    User = get_user_model()

    user_a = User.objects.create_user(username="userA", password="passA1234")
    user_b = User.objects.create_user(username="userB", password="passB1234")

    today = timezone.localdate()
    ConciergeUsage.objects.filter(user__in=[user_a, user_b], date=today).delete()

    # Aでログイン → 5回使い切る
    r = client.post(
        "/api/auth/jwt/create/",
        {"username": "userA", "password": "passA1234"},
        format="json",
    )
    access_a = r.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_a}")

    for _ in range(5):
        res = client.post(
            "/api/concierge/chat/",
            {"query": "仕事運を上げたい"},
            format="json",
        )
        assert res.status_code == 200

    # A の Usage は 5
    usage_a = ConciergeUsage.objects.get(user=user_a, date=today)
    assert usage_a.count == 5

    # B でログイン → 初回アクセスは 4 残っているはず
    client = APIClient()
    r = client.post(
        "/api/auth/jwt/create/",
        {"username": "userB", "password": "passB1234"},
        format="json",
    )
    access_b = r.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_b}")

    res = client.post(
        "/api/concierge/chat/",
        {"query": "仕事運を上げたい"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["remaining_free"] == 4

    usage_b = ConciergeUsage.objects.get(user=user_b, date=today)
    assert usage_b.count == 1


@pytest.mark.django_db
def test_guest_user_is_not_rate_limited():
    client = APIClient()

    replies = []
    keys_list = []

    # 未ログイン状態で何回か叩く
    for _ in range(7):
        res = client.post(
            "/api/concierge/chat/",
            {"query": "仕事運を上げたい"},
            format="json",
        )
        assert res.status_code == 200
        replies.append(res.data.get("reply"))
        keys_list.append(set(res.data.keys()))

    # ゲストは remaining_free / limit がレスポンスに含まれない想定
    for keys in keys_list:
        assert "remaining_free" not in keys
        assert "limit" not in keys

    # ゲストには「無料で利用できる回数を使い切りました。」は出ない
    assert all(
        r != "無料で利用できる回数を使い切りました。"
        for r in replies
    )
