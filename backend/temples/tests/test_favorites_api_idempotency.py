# backend/temples/tests/test_favorites_api_idempotency.py
import pytest
from rest_framework.test import APIClient
from temples.models import Shrine
from .factories import make_shrine, Favorite

@pytest.mark.django_db
def test_requires_auth():
    c = APIClient()
    r = c.get("/api/favorites/")
    assert r.status_code in (401, 403)

@pytest.mark.django_db
def test_post_is_idempotent(django_user_model):
    user = django_user_model.objects.create_user(username="alice", password="pw")
    s = Shrine.objects.first()
if s is None:
    s = make_shrine(name="API Shrine")
    assert s is not None, "Shrine のfixture/初期データが必要です"

    c = APIClient(); c.force_authenticate(user=user)

    r1 = c.post("/api/favorites/", {"shrine_id": s.id}, format="json")
    assert r1.status_code in (200, 201)
    assert Favorite.objects.filter(user=user, shrine=s).count() == 1

    r2 = c.post("/api/favorites/", {"shrine_id": s.id}, format="json")
    assert r2.status_code == 200
    assert Favorite.objects.filter(user=user, shrine=s).count() == 1
