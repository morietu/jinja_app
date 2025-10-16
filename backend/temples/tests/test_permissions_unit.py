# backend/temples/tests/test_permissions_unit.py
import types
import sys
import pytest
from rest_framework.test import APIRequestFactory
from django.contrib.auth.models import AnonymousUser

from backend.temples.permissions import IsOwnerOrReadOnly as Target


class DummyUser:
    def __init__(self, uid=1, is_auth=True):
        self.id = uid
        self.is_authenticated = is_auth


class DummyObj:
    pass


factory = APIRequestFactory()


def make_req(method: str, user):
    req = factory.generic(method, "/dummy")
    req.user = user
    return req


def test_safe_methods_are_allowed():
    perm = Target()
    req = make_req("GET", AnonymousUser())
    assert perm.has_object_permission(req, view=None, obj=DummyObj()) is True


def test_unsafe_denied_when_anonymous():
    perm = Target()
    req = make_req("POST", AnonymousUser())
    assert perm.has_object_permission(req, view=None, obj=DummyObj()) is False


def test_delegates_to_upstream_success(monkeypatch):
    # 上位実装が True を返すパス
    class UpstreamOK:
        def has_object_permission(self, request, view, obj):
            return True

    import backend.temples.permissions as mod

    monkeypatch.setattr(mod, "_UpstreamIsOwner", UpstreamOK, raising=True)

    perm = Target()
    req = make_req("PATCH", DummyUser())
    assert perm.has_object_permission(req, None, DummyObj()) is True


def test_upstream_raises_then_fallback_owner_id_hits(monkeypatch):
    # 上位実装が例外 → フォールバック owner_id が一致して True
    class UpstreamBoom:
        def has_object_permission(self, request, view, obj):
            raise RuntimeError("boom")

    import backend.temples.permissions as mod

    monkeypatch.setattr(mod, "_UpstreamIsOwner", UpstreamBoom, raising=True)

    obj = DummyObj()
    obj.owner_id = 42
    req = make_req("PUT", DummyUser(uid=42))
    perm = Target()
    assert perm.has_object_permission(req, None, obj) is True


def test_is_shrine_owner_true(monkeypatch):
    # backend.temples.views に _is_shrine_owner が存在し True を返すパス
    # （循環を避けるため動的にモジュールを差し込む）
    import backend.temples.permissions as mod

    monkeypatch.setattr(mod, "_UpstreamIsOwner", None, raising=True)

    helper_mod = types.ModuleType("backend.temples.views")

    def _is_shrine_owner(user, obj):
        return True

    helper_mod._is_shrine_owner = _is_shrine_owner

    # sys.modules に差し込むと `from .views import _is_shrine_owner` が解決される
    monkeypatch.setitem(sys.modules, "backend.temples.views", helper_mod)

    req = make_req("PATCH", DummyUser(uid=7))
    perm = Target()
    assert perm.has_object_permission(req, None, DummyObj()) is True


def test_no_matches_returns_false(monkeypatch):
    # 上位実装なし、_is_shrine_owner なし、フォールバック属性も不一致 → False
    import backend.temples.permissions as mod

    monkeypatch.setattr(mod, "_UpstreamIsOwner", None, raising=True)

    # もし前テストで注入した "backend.temples.views" が残っていたら消す
    import sys

    monkeypatch.delitem(sys.modules, "backend.temples.views", raising=False)

    obj = DummyObj()
    obj.owner_id = 99  # user.id=1 と合わない
    obj.user = types.SimpleNamespace(id=100)
    req = make_req("DELETE", DummyUser(uid=1))
    perm = Target()
    assert perm.has_object_permission(req, None, obj) is False
