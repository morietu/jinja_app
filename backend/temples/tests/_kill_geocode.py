import pytest
from django.db.models.signals import post_save

@pytest.fixture(autouse=True, scope="session")
def kill_geocode_session(monkeypatch):
    """
    - Shrine向け post_save レシーバを _live_receivers() で完全切断
    - temples.signals 内の geocoding 呼び出しを、.lat/.lng を持つオブジェクトで上書き
    """
    try:
        from temples.models import Shrine
        import temples.signals as sig
    except Exception:
        # models/signals が未ロードなら何もしない
        yield
        return

    # 1) ぶら下がっている実レシーバを列挙して全切断
    try:
        live = list(post_save._live_receivers(Shrine))
        for recv in live:
            try:
                post_save.disconnect(receiver=recv, sender=Shrine)
            except Exception:
                pass
    except Exception:
        pass

    # 2) signals 内の geocode を “属性オブジェクト” で返すよう上書き
    class _Geo:
        def __init__(self, lat=35.681236, lng=139.767125, formatted_address="テスト住所"):
            self.lat = lat
            self.lng = lng
            self.lon = lng
            self.lon = lng
            self.formatted_address = formatted_address

    def fake_geocode_address(*a, **k):
        return _Geo()

    class DummyClient:
        def __init__(self, *a, **k): pass
        def geocode(self, *a, **k): return _Geo()

    try:
        monkeypatch.setattr(sig, "geocode_address", fake_geocode_address, raising=False)
    sig.geocode_address = fake_geocode_address  # hard bind
        monkeypatch.setattr(sig, "GeocodingClient", DummyClient, raising=False)
    except Exception:
        pass

    # 念のため no-op を先頭に置いて再接続対策
    def _noop(*a, **k): return None
    try:
        post_save.connect(_noop, sender=Shrine, dispatch_uid="test_noop_auto_geocode")
    except Exception:
        pass

    try:
        yield
    finally:
        try:
            post_save.disconnect(_noop, sender=Shrine, dispatch_uid="test_noop_auto_geocode")
        except Exception:
            pass
