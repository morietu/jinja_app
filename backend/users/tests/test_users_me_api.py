# backend/users/tests/test_users_me_api.py
import pytest
from django.urls import reverse
from tests.factories import UserFactory
from tests.utils import api_client_as
from users.models import UserProfile

ME_URL_NAME = "users-me"


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
