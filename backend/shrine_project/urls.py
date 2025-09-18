# backend/shrine_project/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from .views import index, favicon

# SimpleJWT: フロントが使う /api/auth/jwt/* をここで提供
from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, TokenVerifyView
)

urlpatterns = [
    path("", index),
    path("favicon.ico", favicon),

    path("admin/", admin.site.urls),
    

    # アプリ側に委譲（temples の中で places/find や favorites, concierge/chat 等を定義）
    path("api/", include("temples.urls")),
    path("api/", include("users.urls")),

    # SimpleJWT（フロントの favorites.ts 等が参照する想定のパス名に合わせる）
    path("api/auth/jwt/create/", TokenObtainPairView.as_view(), name="jwt_create"),
    path("api/auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("api/auth/jwt/verify/", TokenVerifyView.as_view(), name="jwt_verify"),

    # ※ 以前ここに書いていた下記は削除/コメントアウト
    # path("api/places/find/", PlacesFindPlaceView.as_view(), name="places-find"),  # ← 削除
    # path("api/concierge/plan/", ConciergePlanView.as_view(), name="concierge-plan"),  # temples側にあるなら不要
    # path("api/token/", ...), path("api/auth/token/", ...) など重複JWTエンドポイントも不要
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        from temples import debug_views
        if hasattr(debug_views, "whoami"):
            urlpatterns += [path("api/_debug/whoami/", debug_views.whoami)]
    except Exception:
        pass
