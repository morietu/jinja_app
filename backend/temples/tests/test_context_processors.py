from django.test import RequestFactory
from django.conf import settings
import os

from shrine_project.context_processors import maps_api_key


def test_maps_api_key_prefers_django_setting(monkeypatch):
    rf = RequestFactory()
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "ENV_VALUE")
    # settings 側を優先
    settings.GOOGLE_MAPS_API_KEY = "SETTING_VALUE"
    ctx = maps_api_key(rf.get("/"))
    assert ctx["GOOGLE_MAPS_API_KEY"] == "SETTING_VALUE"


def test_maps_api_key_falls_back_to_env(monkeypatch):
    rf = RequestFactory()
    # settings を消して ENV にフォールバック
    if hasattr(settings, "GOOGLE_MAPS_API_KEY"):
        delattr(settings, "GOOGLE_MAPS_API_KEY")
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "ENV_VALUE")
    ctx = maps_api_key(rf.get("/"))
    assert ctx["GOOGLE_MAPS_API_KEY"] == "ENV_VALUE"


def test_maps_api_key_empty_when_missing(monkeypatch):
    rf = RequestFactory()
    if hasattr(settings, "GOOGLE_MAPS_API_KEY"):
        delattr(settings, "GOOGLE_MAPS_API_KEY")
    monkeypatch.delenv("GOOGLE_MAPS_API_KEY", raising=False)
    ctx = maps_api_key(rf.get("/"))
    assert ctx["GOOGLE_MAPS_API_KEY"] == ""
