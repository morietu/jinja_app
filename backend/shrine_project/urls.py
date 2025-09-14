# backend/shrine_project/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from temples.views import ConciergePlanView
from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, TokenVerifyView
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # temples 側に router/エンドポイントを集約（Goshuin 公開/自分用も含む）
    path("api/", include(("temples.urls", "temples"), namespace="temples")),

    # JWT
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),

    # Concierge（必要ならここに残す）
    path("api/concierge/plan/", ConciergePlanView.as_view(), name="concierge-plan"),

    # users
    path("api/", include("users.urls")),
]

if settings.DEBUG:
    try:
        from temples import debug_views
    except Exception:
        debug_views = None
    if debug_views and hasattr(debug_views, "whoami"):
        urlpatterns += [path("api/_debug/whoami/", debug_views.whoami)]
