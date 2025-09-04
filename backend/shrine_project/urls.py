from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,  # 使わないなら削除OK
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # アプリのAPI
    path("api/", include("temples.urls")),  # 既存のAPI
    path("api/", include("users.urls")),    # /api/users/me/ を提供（users/urls.py 側で定義）

    # JWT エンドポイント（/api/token/... で固定）
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
]

# デバッグ用
if settings.DEBUG:
    try:
        from temples import debug_views  # optional
    except Exception:
        debug_views = None
    if debug_views and hasattr(debug_views, "whoami"):
        urlpatterns += [path("api/_debug/whoami/", debug_views.whoami)]
