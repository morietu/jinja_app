# backend/shrine_project/urls.py
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from temples.api_views_concierge import ConciergePlanView

from .views import favicon, index

urlpatterns = [
    path("", index),
    path("favicon.ico", favicon),
    path("admin/", admin.site.urls),
    # --- debug whoami（常時有効 / 認証状態の簡易確認）---
    path(
        "api/_debug/whoami/",
        lambda request: JsonResponse(
            {
                "is_authenticated": getattr(request.user, "is_authenticated", False),
                "username": getattr(request.user, "username", None),
                "is_superuser": getattr(request.user, "is_superuser", False),
            }
        ),
    ),
    # --- JWT 対応 whoami（Authorization: Bearer を解釈） ---
    path(
        "api/_debug/whoami_jwt/",
        api_view(["GET"])(  # 関数化せずインラインでOK
            authentication_classes([JWTAuthentication, SessionAuthentication])(
                permission_classes([AllowAny])(
                    lambda request: Response(
                        {
                            "auth_classes": ["JWT", "Session"],
                            "is_authenticated": bool(
                                getattr(request.user, "is_authenticated", False)
                            ),
                            "username": getattr(request.user, "username", None),
                            "is_superuser": bool(getattr(request.user, "is_superuser", False)),
                        }
                    )
                )
            )
        ),
    ),
    # アプリのAPI
    path("api/", include("users.api.urls")),
    path("api/", include(("temples.urls", "temples"), namespace="temples")),
    path("api/concierge/plan/", ConciergePlanView.as_view(), name="concierge-plan"),
    path("api/temples/", include(("temples.api.urls", "temples"), namespace="temples_api")),
    # SimpleJWT（フロントが使っているのはこっち）
    path("api/auth/jwt/create/", TokenObtainPairView.as_view(), name="jwt_create"),
    path("api/auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("api/auth/jwt/verify/", TokenVerifyView.as_view(), name="jwt_verify"),
    # 互換が不要なら ↓ は削除してOK（残すなら両立可）
    # path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    # path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        from temples import debug_views

        if hasattr(debug_views, "whoami"):
            urlpatterns += [path("api/_debug/whoami/", debug_views.whoami)]
    except Exception:
        pass
