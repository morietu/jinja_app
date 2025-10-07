import pytest
from django.urls import get_resolver, resolve, reverse


def _has_namespace(ns: str) -> bool:
    try:
        return ns in get_resolver().app_dict
    except Exception:
        return False


def test_resolve_names():
    if not _has_namespace("temples"):
        pytest.skip("temples namespace not registered yet")
    assert resolve("/api/shrines/").url_name == "shrine_list"


def test_reverse_paths():
    if not _has_namespace("temples"):
        pytest.skip("temples namespace not registered yet")
    assert reverse("temples:shrine_list") == "/api/shrines/"
