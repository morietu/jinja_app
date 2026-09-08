# backend/users/tests/test_users_me_api.py
import pytest
from django.urls import reverse
from users.models import UserProfile

from tests.factories import UserFactory
from tests.utils import api_client_as

ME_URL_NAME = "users_api:me"


@pytest.mark.django_db
def test_me_requires_auth():
    c = api_client_as()  # 未認証
    res = c.get(reverse(ME_URL_NAME))
    # プロジェクトの仕様に合わせて 401 or 404 のどちらかにしてOK
    assert res.status_code in (401, 404)


@pytest.mark.django_db
def test_me_get_returns_profile_like_payload():
    user = UserFactory(username="tarou", email="taro@example.com")
    prof, _ = UserProfile.objects.get_or_create(user=user)
    prof.nickname = "太郎"
    prof.is_public = False
    prof.bio = "よろしく"
    prof.save()

    c = api_client_as(user)
    res = c.get(reverse(ME_URL_NAME))
    assert res.status_code == 200
    data = res.json()

    # フラット構成 or ネスト構成どちらでも通るように柔軟にチェック
    if "profile" in data:
        p = data["profile"]
        assert p["nickname"] == "太郎"
        assert p["is_public"] is False
        assert p.get("bio") in ("よろしく", None, "")
        assert data["username"] == "tarou"
        assert data["email"] == "taro@example.com"
    else:
        assert data["username"] == "tarou"
        assert data["email"] == "taro@example.com"
        assert data["nickname"] == "太郎"
        assert data["is_public"] is False
        assert data.get("bio") in ("よろしく", None, "")


@pytest.mark.django_db
def test_me_patch_updates_nickname():
    user = UserFactory()
    UserProfile.objects.get_or_create(user=user)

    c = api_client_as(user)
    res = c.patch(reverse(ME_URL_NAME), {"nickname": "NewName"}, format="json")
    assert res.status_code == 200
    body = res.json()
    # フラット/ネスト両対応
    new = body["profile"]["nickname"] if "profile" in body else body["nickname"]
    assert new == "NewName"


@pytest.mark.django_db
def test_me_patch_persists_birth_profile_fields_and_get_restores_them():
    user = UserFactory()
    UserProfile.objects.get_or_create(user=user)
    c = api_client_as(user)

    payload = {
        "birthday": "1984-05-15",
        "birth_time": "05:25",
        "birth_place": "東京都",
    }
    patched = c.patch(reverse(ME_URL_NAME), payload, format="json")
    assert patched.status_code == 200
    assert patched.json()["profile"]["birthday"] == "1984-05-15"

    restored = c.get(reverse(ME_URL_NAME))
    assert restored.status_code == 200
    profile = restored.json()["profile"]
    assert profile["birthday"] == "1984-05-15"
    assert profile["birth_time"] == "05:25:00"
    assert profile["birth_place"] == "東京都"


@pytest.mark.django_db
def test_me_response_does_not_expose_retired_worship_style():
    """worship_styleはProfile schemaから退役済みなので、GET/PATCHどちらの応答にも出さない。"""
    user = UserFactory()
    UserProfile.objects.get_or_create(user=user)
    c = api_client_as(user)

    got = c.get(reverse(ME_URL_NAME))
    assert got.status_code == 200
    assert "worship_style" not in got.json()["profile"]

    patched = c.patch(reverse(ME_URL_NAME), {"nickname": "NewName"}, format="json")
    assert patched.status_code == 200
    assert "worship_style" not in patched.json()["profile"]


@pytest.mark.django_db
def test_me_patch_ignores_legacy_worship_style_without_breaking_request():
    """legacy clientがworship_styleを送ってもrequest全体を壊さず、無視する。

    他fieldの更新は通常通り成功し、responseにもworship_styleは出ない。
    """
    user = UserFactory()
    UserProfile.objects.get_or_create(user=user)
    c = api_client_as(user)

    res = c.patch(
        reverse(ME_URL_NAME),
        {"nickname": "LegacyClient", "birth_place": "東京都", "worship_style": "朝参り"},
        format="json",
    )

    assert res.status_code == 200
    profile = res.json()["profile"]
    assert profile["nickname"] == "LegacyClient"
    assert profile["birth_place"] == "東京都"
    assert "worship_style" not in profile

    prof = UserProfile.objects.get(user=user)
    assert not hasattr(prof, "worship_style")


@pytest.mark.django_db
def test_me_patch_rejects_invalid_or_future_birthday():
    user = UserFactory()
    UserProfile.objects.get_or_create(user=user)
    c = api_client_as(user)

    invalid = c.patch(reverse(ME_URL_NAME), {"birthday": "2025-02-30"}, format="json")
    assert invalid.status_code == 400
    future = c.patch(reverse(ME_URL_NAME), {"birthday": "2999-01-01"}, format="json")
    assert future.status_code == 400
