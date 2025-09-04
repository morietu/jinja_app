# shrine_project/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, TokenVerifyView
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("temples.urls")),

    # ★ token系を直に登録（users.urlsの影響を受けないようにする）
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),

    # users 側の /me などはこれでマウント（token系は上で直付けしているので競合しません）
    path("api/auth/", include(("users.urls", "users"), namespace="users")),
]

if settings.DEBUG:
    try:
        from temples import debug_views  # optional
    except Exception:
        debug_views = None
    if debug_views and hasattr(debug_views, "whoami"):
        urlpatterns += [path("api/_debug/whoami/", debug_views.whoami)]
