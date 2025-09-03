import pytest

# Shrine.location はもうDBにある想定なので常に True
@pytest.fixture
def shrine_has_location():
    return True

# geocoding を毎テスト関数ごとにモック（function scope）
@pytest.fixture(autouse=True)
def mock_geocoding(monkeypatch):
    try:
        import temples.signals as sig
    except Exception:
        # signals が未ロードでもテストは続行
        yield
        return

    class _Geo:
        def __init__(self, lat=35.681236, lon=139.767125, formatted_address='テスト住所'):
            self.lat = lat
            self.lon = lon
            self.formatted_address = formatted_address

    def fake_geocode_address(*a, **k):
        return _Geo()

    class DummyClient:
        def __init__(self, *a, **k): pass
        def geocode(self, *a, **k): return _Geo()

    monkeypatch.setattr(sig, 'geocode_address', fake_geocode_address, raising=False)
    monkeypatch.setattr(sig, 'GeocodingClient', DummyClient, raising=False)
    yield
