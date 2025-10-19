import types

from backend.temples.api.throttles import PlacesNearbyThrottle


def _req(user=None, meta=None):
    # get_cache_key が見るのは request.user と request.META だけ
    req = types.SimpleNamespace()
    req.user = user
    req.META = meta or {}
    return req


class DummyUser:
    def __init__(self, pk, is_authenticated=True):
        self.pk = pk
        self.is_authenticated = is_authenticated


def test_throttle_key_authenticated_user():
    t = PlacesNearbyThrottle()
    key = t.get_cache_key(_req(user=DummyUser(pk=42)), view=None)  # ← 追加
    assert key == t.cache_format % {"scope": t.scope, "ident": "user:42"}


def test_throttle_key_anonymous_with_ip():
    t = PlacesNearbyThrottle()
    key = t.get_cache_key(
        _req(user=DummyUser(pk=None, is_authenticated=False), meta={"REMOTE_ADDR": "127.0.0.1"}),
        view=None,  # ← 追加
    )
    assert key == t.cache_format % {"scope": t.scope, "ident": "127.0.0.1"}


def test_throttle_key_anonymous_no_ip_fallback_anon():
    t = PlacesNearbyThrottle()
    key = t.get_cache_key(_req(user=None, meta={}), view=None)  # ← 追加
    assert key == t.cache_format % {"scope": t.scope, "ident": "anon"}
