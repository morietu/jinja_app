# temples/tests/api/test_favorites_place_id_validation.py
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from temples.models import PlaceRef, Favorite

pytestmark = pytest.mark.django_db
User = get_user_model()

def _auth_client() -> APIClient:
    u = User.objects.create_user(username="u1", password="pass12345")
    c = APIClient()
    c.force_authenticate(user=u)
    return c, u

def test_favorite_upsert_rejects_non_chi_place_id():
    c, _ = _auth_client()
    url = reverse("temples:favorite-list")  # ここが通らなければ "/api/favorites/" にする
    res = c.post(url, {"place_id": "stub-place-id"}, format="json")
    assert res.status_code == 400
    assert "place_id" in res.data  # {"place_id": "..."} を期待

def test_favorite_upsert_accepts_chi_place_id(monkeypatch):
    c, u = _auth_client()
    url = reverse("temples:favorite-list")

    # 外部API封じ。PlaceRef をDBに作るだけの偽関数でOK
    def fake_get_or_sync_place(pid: str, force: bool = False):
        return PlaceRef.objects.create(
            place_id=pid,
            name="dummy",
            address="dummy",
            latitude=1.0,
            longitude=2.0,
        )

    import temples.api.serializers.favorites as fav_ser
    monkeypatch.setattr(fav_ser, "get_or_sync_place", fake_get_or_sync_place)

    valid_pid = "ChIJ" + "A" * 20
    res = c.post(url, {"place_id": valid_pid}, format="json")
    assert res.status_code in (200, 201)

    # Favorite が作られていることも確認（再発防止）
    assert Favorite.objects.filter(user=u, place_id=valid_pid).exists()
