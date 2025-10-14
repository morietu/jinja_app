from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularJSONAPIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
from temples import api_views_concierge as concierge

from .views import favicon, index

urlpatterns = [
    path("", index),
    path("favicon.ico", favicon),
    path("admin/", admin.site.urls),
    # API ルートはこの1本に集約
    path("api/", include(("users.api.urls", "users"), namespace="users_api")),
    path("api/", include("favorites.urls")),
    path("api/", include(("temples.api.urls", "temples"), namespace="temples")),
    # concierge（必要なら temples 側へ移行検討）
    path("api/concierge/plan/", concierge.ConciergePlanView.as_view(), name="concierge-plan"),
    # JWT (Next のプロキシが /api/auth/jwt/... を見に行くのでこのパスを残す)
    path("api/auth/jwt/create/", TokenObtainPairView.as_view(), name="jwt_create"),
    path("api/auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("api/auth/jwt/verify/", TokenVerifyView.as_view(), name="jwt_verify"),
    # debug
    path("schema/", SpectacularJSONAPIView.as_view(), name="schema"),
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
    path(
        "_debug/whoami_jwt/",
        api_view(["GET"])(
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
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
