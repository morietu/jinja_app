# backend/temples/tests/test_api_urls_smoke.py
from importlib import import_module
from django.urls import URLPattern, URLResolver


def iter_patterns(urls):
    for p in urls.urlpatterns:
        if isinstance(p, URLPattern):
            yield p
        elif isinstance(p, URLResolver):
            for c in p.url_patterns:
                if isinstance(c, URLPattern):
                    yield c


def test_api_urls_resolve_smoke():
    urls = import_module("temples.api.urls")
    paths = [p.pattern for p in iter_patterns(urls)]
    # 1件以上拾えていればOK（importに失敗してない）
    assert len(paths) > 0
