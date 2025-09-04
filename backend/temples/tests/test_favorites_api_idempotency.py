import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .factories import make_shrine, make_user


def auth_client(user):
    token = str(RefreshToken.for_user(user).access_token)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


@pytest.mark.django_db
def test_post_is_idempotent():
    user = make_user("alice", password="pw")
    s = make_shrine(name="Idem Shrine", owner=user)
    c = auth_client(user)

    r1 = c.post("/api/favorites/", {"shrine_id": s.id}, format="json")
    assert r1.status_code in (200, 201)
    fav1 = r1.json()
    assert fav1["shrine"]["id"] == s.id

    r2 = c.post("/api/favorites/", {"shrine_id": s.id}, format="json")
    assert r2.status_code in (200, 201)
    fav2 = r2.json()
    assert fav2["shrine"]["id"] == s.id

    # 同じリソースであること（ID が返ってくる実装なら一致）
    if "id" in fav1 and "id" in fav2:
        assert fav2["id"] == fav1["id"]

    # list 側も重複なし
    res = c.get("/api/favorites/")
    assert res.status_code == 200
    items = [it for it in res.json() if it["shrine"]["id"] == s.id]
    assert len(items) == 1
