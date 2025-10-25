# backend/shrine_project/urls.py（抜粋・最終形）
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path
from drf_spectacular.utils import OpenApiTypes, extend_schema
from drf_spectacular.views import (
    SpectacularJSONAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
from temples import api_views_concierge as concierge

from .views import favicon, index


# ---- util/debug ----
@extend_schema(summary="Health check", responses={200: OpenApiTypes.OBJECT}, tags=["misc"])
@api_view(["GET"])
@permission_classes([AllowAny])
def healthz(request):
    return JsonResponse({"ok": True})


@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def robots_txt(request):
    return HttpResponse("User-agent: *\nDisallow:", content_type="text/plain")


@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def whoami(request):
    return JsonResponse(
        {
            "is_authenticated": bool(getattr(request.user, "is_authenticated", False)),
            "username": getattr(request.user, "username", None),
            "is_superuser": bool(getattr(request.user, "is_superuser", False)),
        }
    )


@extend_schema(exclude=True)
@api_view(["GET"])
@authentication_classes([JWTAuthentication, SessionAuthentication])
@permission_classes([AllowAny])
def whoami_jwt(request):
    return Response(
        {
            "auth_classes": ["JWT", "Session"],
            "is_authenticated": bool(getattr(request.user, "is_authenticated", False)),
            "username": getattr(request.user, "username", None),
            "is_superuser": bool(getattr(request.user, "is_superuser", False)),
        }
    )


# ---- レガシー concierge: スキーマから除外する薄い関数ラッパ ----
@extend_schema(exclude=True)
@api_view(["POST"])
@permission_classes([AllowAny])
def concierge_plan_legacy_excluded(request, *args, **kwargs):
    return concierge.plan_legacy(request, *args, **kwargs)


@extend_schema(exclude=True)
@api_view(["POST"])
@permission_classes([AllowAny])
def concierge_chat_legacy_excluded(request, *args, **kwargs):
    return concierge.chat_legacy(request, *args, **kwargs)


urlpatterns = [
    path("", index),
    path("favicon.ico", favicon),
    path("admin/", admin.site.urls),
    # API ルート（既存の include はそのまま）
    path("api/", include(("users.api.urls", "users"), namespace="users_api")),
    path("api/", include("favorites.urls")),
    path("api/", include(("temples.api.urls", "temples"), namespace="temples")),
    # レガシー concierge（URLは据え置き、スキーマからは除外）
    path("api/concierge/plan/", concierge_plan_legacy_excluded, name="concierge-plan"),
    path("api/concierge/chat/", concierge_chat_legacy_excluded, name="concierge-chat"),
    # JWT
    path("api/auth/jwt/create/", TokenObtainPairView.as_view(), name="jwt_create"),
    path("api/auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("api/auth/jwt/verify/", TokenVerifyView.as_view(), name="jwt_verify"),
    # ==== OpenAPI スキーマ/ドキュメント（既存の /api/schema を維持）====
    path("api/schema/", SpectacularJSONAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # debug
    path("api/_debug/whoami/", whoami, name="whoami"),
    path("_debug/whoami_jwt/", whoami_jwt, name="whoami_jwt"),
    # misc
    path("healthz/", healthz, name="healthz"),
    path("robots.txt", robots_txt, name="robots_txt"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
