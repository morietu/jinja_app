# temples/tests/test_favorites_e2e.py

from rest_framework.test import APIClient


def auth_login(api: APIClient, user):
    # Session + CSRF を使わず、DRF の強制認証を使う
    api.force_authenticate(user=user)


def test_favorites_crud_happy_path(db, api, user, requests_mock):
    # 未ログイン
    res = api.get("/api/favorites/")
    assert res.status_code in (401, 403)

    # ログイン（強制認証）
    auth_login(api, user)

    payload = {"target_type": "shrine", "target_id": 1}
    res = api.post("/api/favorites/", payload, format="json")
    print(
        "DEBUG favorites POST:",
        res.status_code,
        getattr(res, "data", None),
        getattr(res, "json", lambda: None)(),
    )

    assert res.status_code in (200, 201)
    fav_id = res.data["id"]

    # 冪等性
    res2 = api.post("/api/favorites/", payload, format="json")
    assert res2.status_code in (200, 201)
    assert res2.data["id"] == fav_id

    # 一覧
    res = api.get("/api/favorites/")
    assert res.status_code == 200
    ids = [row["id"] for row in res.data.get("results", res.data)]
    assert fav_id in ids

    # 削除
    res = api.delete(f"/api/favorites/{fav_id}/")
    assert res.status_code in (200, 204)

    # ログアウト（認証解除）
    api.force_authenticate(user=None)


def test_favorites_are_user_scoped(db, api, user, other_user):
    # user で作成
    auth_login(api, user)
    payload = {"target_type": "shrine", "target_id": 1}
    res = api.post("/api/favorites/", payload, format="json")
    assert res.status_code in (200, 201)
    fav_id = res.data["id"]

    # other_user に切替
    api.force_authenticate(user=other_user)

    # 見えない/消せない
    res = api.get("/api/favorites/")
    assert res.status_code == 200
    ids = [row["id"] for row in res.data.get("results", res.data)]
    assert fav_id not in ids

    res = api.delete(f"/api/favorites/{fav_id}/")
    assert res.status_code in (403, 404)
