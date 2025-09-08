import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from unittest.mock import patch

# すべてのテスト前後でキャッシュをクリア（DRFスロットルはcacheを使う）
@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()

# ---------- キャッシュ検証（Text Search） ----------
@pytest.mark.django_db
def test_text_search_is_cached(settings):
    client = APIClient()

    # services.places -> 低レイヤーのgoogle_places.* をモック
    with patch("temples.services.google_places.text_search") as mock_call:
        mock_call.return_value = {"status": "OK", "results": [{"name": "A"}], "next_page_token": None}

        r1 = client.get("/api/places/text_search/", {"q": "神社 渋谷"})
        assert r1.status_code == 200, r1.content
        r2 = client.get("/api/places/text_search/", {"q": "神社 渋谷"})
        assert r2.status_code == 200, r2.content

        # 2回叩いても下層呼び出しは1回（キャッシュヒット）
        assert mock_call.call_count == 1

# ---------- キャッシュ検証（Photo） ----------
@pytest.mark.django_db
def test_photo_is_cached(settings):
    client = APIClient()
    with patch("temples.services.google_places.photo") as mock_photo:
        # サービス層の契約： (bytes, content_type) を返す
        mock_photo.return_value = (b"JPEGDATA", "image/jpeg")

        r1 = client.get("/api/places/photo/", {"photo_reference": "X", "maxwidth": 800})
        assert r1.status_code == 200
        assert r1["Cache-Control"].startswith("public, max-age=")

        r2 = client.get("/api/places/photo/", {"photo_reference": "X", "maxwidth": 800})
        assert r2.status_code == 200
        assert mock_photo.call_count == 1  # 2回目はキャッシュ

# ---------- スロットル検証（Nearby） ----------
@pytest.mark.django_db
def test_nearby_search_throttled(settings):
    """
    スロットル発動を確認する。
    （環境変数や settings で 30/min などに設定済み前提）
    """
    client = APIClient()

    # 実呼び出しはモックして速くする（結果は何でもよい）
    with patch("temples.services.google_places.nearby_search") as mock_call:
        mock_call.return_value = {"status": "OK", "results": [], "next_page_token": None}

        got_429 = False
        # 連打すると 429 になるはず（レート次第で回数は多少前後OK）
        for _ in range(80):
            res = client.get("/api/places/nearby_search/", {"lat": 35.0, "lng": 139.0, "radius": 1000})
            if res.status_code == 429:
                got_429 = True
                break

        assert got_429, "Too Many Requests(429) が返らない — settings.REST_FRAMEWORK のスロットル設定を確認してください"
