# backend/temples/api_urls.py
"""
互換エイリアス:
過去に `temples.api_urls` を参照していたコードのために残す。
実体は `temples.api.urls` に一本化。
"""
from temples.api.urls import urlpatterns  # noqa: F401
app_name = "temples"
