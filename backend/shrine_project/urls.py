from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # ✅ JWT 認証API
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),

    # ✅ アプリAPI
    path("api/", include("temples.urls")),
    path("api/", include("users.urls")),
]

# デバッグ用
if settings.DEBUG:
    try:
        from temples import debug_views
    except Exception:
        debug_views = None
    if debug_views and hasattr(debug_views, "whoami"):
        urlpatterns += [path("api/_debug/whoami/", debug_views.whoami)]
