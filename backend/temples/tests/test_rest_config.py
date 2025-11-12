# tests/test_rest_config.py
from django.conf import settings
from importlib import import_module

def _load(path):
    m, k = path.rsplit(".", 1)
    return getattr(import_module(m), k)

def test_auth_classes_are_authenticators():
    for p in settings.REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]:
        cls = _load(p)
        assert hasattr(cls(), "authenticate"), f"{p} は認証クラスではありません"

def test_throttle_classes_are_throttles():
    for p in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"]:
        cls = _load(p)
        assert hasattr(cls(), "allow_request"), f"{p} はスロットルクラスではありません"
