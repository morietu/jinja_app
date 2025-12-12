# backend/shrine_project/urls.py


from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from django.views.static import serve as media_serve
from temples.api.views.create_superuser import create_superuser
from temples.api.views import debug as debug_views


from drf_spectacular.renderers import OpenApiJsonRenderer
from drf_spectacular.utils import OpenApiTypes, extend_schema
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from users.views import MeView, MeIconUploadView
from temples import api_views_concierge as concierge

from .views import favicon, index


class JsonSpectacularAPIView(SpectacularAPIView):
    renderer_classes = [OpenApiJsonRenderer]

    @extend_schema(exclude=True)  # スキーマ出力から“このビュー”を除外
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


# ---- ここから lambda をやめて関数ビュー化 ----
@extend_schema(
    summary="Health check",
    responses={200: OpenApiTypes.OBJECT},
    tags=["misc"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def healthz(request):
    return JsonResponse({"ok": True})


@extend_schema(exclude=True)  # スキーマに載せない場合は exclude
@api_view(["GET"])
@permission_classes([AllowAny])
def robots_txt(request):
    return HttpResponse("User-agent: *\nDisallow:", content_type="text/plain")


@extend_schema(exclude=True)  # デバッグ用は除外でOK
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


@extend_schema(exclude=True)  # こちらもデバッグ用
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


def openapi_json(request):
    # Spectacular のジェネレータから直接 dict を取得して JsonResponse で返す
    view = SpectacularAPIView()
    schema = view.schema_generator.get_schema(request=request, public=True) or {}
    return JsonResponse(schema, safe=False)


# ---- ここまで ----


urlpatterns = [
    path("", index),
    path("favicon.ico", favicon),
    path("admin/create-superuser/", create_superuser),
    path("admin/", admin.site.urls),
    # API ルート
    path("api/users/me/", MeView.as_view(), name="users-me"),
    path("api/users/me/icon/", MeIconUploadView.as_view(), name="users-me-icon"),
    path("api/", include(("users.api.urls", "users"), namespace="users_api")),

    path("api/debug/media/", debug_views.media_debug, name="media-debug"),
    
    # favorites エンドポイント（/api/favorites/）
    path("api/", include("favorites.urls")),

    # concierge-plan のグローバル alias
    path("api/concierge/plan/", concierge.plan, name="concierge-plan"),

    # temples 名前空間付き include（temples:shrine_route など用）
    path("api/", include(("temples.api.urls", "temples"), namespace="temples")),
    




    # JWT
    path("api/auth/jwt/create/", TokenObtainPairView.as_view(), name="jwt_create"),
    path("api/auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("api/auth/jwt/verify/", TokenVerifyView.as_view(), name="jwt_verify"),
    # ==== スキーマ & ドキュメント（/api/schemas に統一）====
    # 既存（複数形の正式名）
    # ✅ テスト互換：reverse("schema") は必ず JSON を返すようにする
    path(
        "api/schemas/swagger/",
        SpectacularSwaggerView.as_view(url_name="api-schemas"),
        name="api-docs",
    ),
    path(
        "api/schemas/redoc/", SpectacularRedocView.as_view(url_name="api-schemas"), name="api-redoc"
    ),
    # ✅ 互換：テストは reverse("schema") を要求するため、同じURLに別名を付与
    # ==== スキーマ & ドキュメント（/api/schemas に統一）====
    # 既存（複数形）を JSON 固定で公開
    path(
        "api/schemas/",
        SpectacularAPIView.as_view(renderer_classes=[OpenApiJsonRenderer]),
        name="api-schemas",
    ),
    # ✅ テスト互換：reverse("schema") も **同じURL** を指し、常に JSON を返す
    path(
        "api/schemas/",
        SpectacularAPIView.as_view(renderer_classes=[OpenApiJsonRenderer]),
        name="schema",
    ),
    # 旧URLはリダイレクトのみ（URL自体を残すと style テストに再度引っかかる可能性があるため name は付けない）
    re_path(r"^api/schema/?$", RedirectView.as_view(url="/api/schemas/", permanent=False)),
    re_path(
        r"^api/schema/swagger-ui/?$",
        RedirectView.as_view(url="/api/schemas/swagger/", permanent=False),
    ),
    re_path(
        r"^api/schema/redoc/?$", RedirectView.as_view(url="/api/schemas/redoc/", permanent=False)
    ),
    path("api/_debug/whoami/", whoami, name="whoami"),
    path("_debug/whoami_jwt/", whoami_jwt, name="whoami_jwt"),
    # misc
    path("healthz", healthz, name="healthz_noslash"),
    path("healthz/", healthz, name="healthz"),
    path("robots.txt", robots_txt, name="robots_txt"),
]

if settings.DEBUG:
    # ローカル開発用（今まで通り）
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # 本番用：/media/... を Django が直接返す
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            media_serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
