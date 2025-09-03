import pytest
from rest_framework.test import APIClient
from .factories import make_user, make_shrine

@pytest.mark.django_db
def test_favorites_crud_happy_path():
    u = make_user("apiu", password="p")
    s = make_shrine(name="Fav Shrine", owner=u)
    c = APIClient()
    assert c.login(username="apiu", password="p")

    # list: empty
    res = c.get("/api/favorites/")
    assert res.status_code == 200
    assert res.json() == []

    # create
    res = c.post("/api/favorites/", {"shrine": s.id}, format="json")
    assert res.status_code == 201
    fav = res.json()
    fav_id = fav["id"]
    assert fav["shrine"] == s.id

    # duplicate -> 400
    res = c.post("/api/favorites/", {"shrine": s.id}, format="json")
    assert res.status_code == 400

    # list: one item (own only)
    res = c.get("/api/favorites/")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1 and data[0]["id"] == fav_id and data[0]["shrine"] == s.id

    # delete
    res = c.delete(f"/api/favorites/{fav_id}/")
    assert res.status_code == 204

    # list: empty again
    res = c.get("/api/favorites/")
    assert res.status_code == 200 and res.json() == []

@pytest.mark.django_db
def test_favorites_are_user_scoped():
    owner = make_user("owner", password="p")
    other = make_user("other", password="p")
    s = make_shrine(name="Scoped Shrine", owner=owner)

    c_owner = APIClient(); assert c_owner.login(username="owner", password="p")
    c_other = APIClient(); assert c_other.login(username="other", password="p")

    # owner adds
    res = c_owner.post("/api/favorites/", {"shrine": s.id}, format="json")
    assert res.status_code == 201
    fav_id = res.json()["id"]

    # other cannot see owner's favorite
    res = c_other.get("/api/favorites/")
    assert res.status_code == 200
    assert res.json() == []

    # other cannot delete owner's favorite (404 or 403 のどちらか)
    res = c_other.delete(f"/api/favorites/{fav_id}/")
    assert res.status_code in (403, 404)
