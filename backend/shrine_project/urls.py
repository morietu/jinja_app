# backend/shrine_project/urls.py
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from django.views.static import serve as media_serve

from drf_spectacular.renderers import OpenApiJsonRenderer
from drf_spectacular.utils import OpenApiTypes, extend_schema
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from users.api.auth import AuthTokenObtainPairView
from temples import api_views_concierge as concierge

from .views import favicon, index
from temples.api.views.shrine_submission import ShrineSubmissionCreateView


@extend_schema(
    summary="Health check",
    responses={200: OpenApiTypes.OBJECT},
    tags=["misc"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def healthz(request):
    return JsonResponse({"ok": True, "release": getattr(settings, "RELEASE", None)})

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


@extend_schema(exclude=True)
def schema_alias(request):
    schema_view = SpectacularAPIView.as_view(renderer_classes=[OpenApiJsonRenderer])
    return schema_view(request)


urlpatterns = [
    path("", index),
    path("favicon.ico", favicon),
    path("admin/", admin.site.urls),
    path("api/", include(("users.api.urls", "users"), namespace="users_api")),
    path("api/", include(("temples.api.urls", "temples"), namespace="temples")),
    path("api/concierge/plan/", concierge.plan, name="concierge-plan"),
    path("api/_debug/whoami/", whoami, name="whoami"),
    path("_debug/whoami_jwt/", whoami_jwt, name="whoami_jwt"),
    path("api/auth/jwt/create/", AuthTokenObtainPairView.as_view(), name="jwt_create"),
    path("api/auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("api/auth/jwt/verify/", TokenVerifyView.as_view(), name="jwt_verify"),
    path(
        "api/schemas/swagger/",
        SpectacularSwaggerView.as_view(url_name="api-schemas"),
        name="api-docs",
    ),
    path(
        "api/schemas/redoc/",
        SpectacularRedocView.as_view(url_name="api-schemas"),
        name="api-redoc",
    ),
    path(
        "api/schemas/",
        SpectacularAPIView.as_view(renderer_classes=[OpenApiJsonRenderer]),
        name="api-schemas",
    ),
    path("api/schema/", schema_alias, name="schema"),
    re_path(r"^api/schema$", RedirectView.as_view(url="/api/schema/", permanent=False)),
    re_path(
        r"^api/schema/swagger-ui/?$",
        RedirectView.as_view(url="/api/schemas/swagger/", permanent=False),
    ),
    re_path(
        r"^api/schema/redoc/?$",
        RedirectView.as_view(url="/api/schemas/redoc/", permanent=False),
    ),
    path("healthz/", healthz, name="healthz"),
    path("robots.txt", robots_txt, name="robots_txt"),
    path("api/shrine-submissions/", ShrineSubmissionCreateView.as_view(), name="shrine-submission-create"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", media_serve, {"document_root": settings.MEDIA_ROOT}),
    ]
