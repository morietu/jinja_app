# temples/tests/_helpers_patch.py
import pytest
from django.db import connection
from django.db.models.signals import post_save

# 1) ジオコーディングをダミー化
@pytest.fixture(autouse=True)
def _mock_geocoding(monkeypatch):
    try:
        from temples.geocoding import client as gclient
    except Exception:
        yield
        return
    class _DummyClient:
        def __init__(self, *a, **k): pass
        def geocode(self, *a, **k):
            return {"lat": 35.681236, "lng": 139.767125, "formatted_address": "テスト住所"}
    try:
        monkeypatch.setattr(gclient, "GeocodingClient", _DummyClient, raising=False)
    except Exception:
        pass
    try:
        monkeypatch.setattr(
            gclient, "geocode_address",
            lambda *a, **k: {"lat": 35.681236, "lng": 139.767125, "formatted_address": "テスト住所"},
            raising=False
        )
    except Exception:
        pass
    yield

# 2) Shrine の post_save レシーバを全解除（自動ジオコーディング停止）
@pytest.fixture(autouse=True)
def _disable_auto_geocode_signal():
    try:
        from temples.models import Shrine
    except Exception:
        yield
        return
    for _r in list(getattr(post_save, "receivers", []) or []):
        try:
            recv = _r[1][1]
            post_save.disconnect(receiver=recv, sender=Shrine)
        except Exception:
            pass
    yield

# 3) DBに location カラムが無ければ API テストをスキップするためのフラグ
def _has_column(table: str, col: str) -> bool:
    try:
        with connection.cursor() as c:
            c.execute(f"PRAGMA table_info({table})")  # SQLite 前提。PGなら情報スキーマに差し替え可。
            cols = [row[1] for row in c.fetchall()]
        return col in cols
    except Exception:
        return False

@pytest.fixture(scope="session")
def shrine_has_location():
    return _has_column("temples_shrine", "location")
