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
    # --- debug whoami ---
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
        "api/_debug/whoami_jwt/",
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
    # users の API は今のまま api/ 配下でOK
    path("api/", include("users.api.urls")),
    # ★ここを temples.urls → temples.api.urls に差し替え
    #    パスは /api/temples/ にぶら下げる
    path(
        "api/",
        include(("temples.api.urls", "temples"), namespace="temples"),
    ),
    path("api/concierge/plan/", ConciergePlanView.as_view(), name="concierge-plan"),
    # SimpleJWT
    path("api/auth/jwt/create/", TokenObtainPairView.as_view(), name="jwt_create"),
    path("api/auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("api/auth/jwt/verify/", TokenVerifyView.as_view(), name="jwt_verify"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        from temples import debug_views

        if hasattr(debug_views, "whoami"):
            urlpatterns += [path("api/_debug/whoami/", debug_views.whoami)]
    except Exception:
        pass
