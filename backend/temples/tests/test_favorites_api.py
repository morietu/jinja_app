import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .factories import make_user, make_shrine


def auth_client(user):
    token = str(RefreshToken.for_user(user).access_token)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


@pytest.mark.django_db
def test_favorites_crud_happy_path():
    u = make_user("apiu", password="p")
    s = make_shrine(name="Fav Shrine", owner=u)
    c = auth_client(u)

    # list: 初期（空想定だが、少なくとも 200 が返ることを確認）
    res = c.get("/api/favorites/")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)

    # create
    res = c.post("/api/favorites/", {"shrine_id": s.id}, format="json")
    assert res.status_code in (200, 201)
    created = res.json()
    assert created["shrine"]["id"] == s.id

    # create (idempotent)
    res2 = c.post("/api/favorites/", {"shrine_id": s.id}, format="json")
    assert res2.status_code in (200, 201)
    dup = res2.json()
    assert dup["shrine"]["id"] == s.id
    if "id" in created and "id" in dup:
        assert dup["id"] == created["id"]

    # list に含まれること
    res = c.get("/api/favorites/")
    assert res.status_code == 200
    ids = [item["shrine"]["id"] for item in res.json()]
    assert s.id in ids


@pytest.mark.django_db
def test_favorites_are_user_scoped():
    owner = make_user("owner", password="p")
    other = make_user("other", password="p")
    s = make_shrine(name="Scoped Shrine", owner=owner)

    c_owner = auth_client(owner)
    c_other = auth_client(other)

    # owner adds
    res = c_owner.post("/api/favorites/", {"shrine_id": s.id}, format="json")
    assert res.status_code in (200, 201)

    # other list: まだ s は含まれない
    res = c_other.get("/api/favorites/")
    assert res.status_code == 200
    list_other = res.json()
    assert all(item["shrine"]["id"] != s.id for item in list_other)

    # other も追加
    res = c_other.post("/api/favorites/", {"shrine_id": s.id}, format="json")
    assert res.status_code in (200, 201)

    # owner 側の list に s があること
    res = c_owner.get("/api/favorites/")
    assert res.status_code == 200
    ids_owner = [item["shrine"]["id"] for item in res.json()]
    assert s.id in ids_owner
