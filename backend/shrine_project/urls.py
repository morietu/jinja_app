# backend/shrine_project/urls.py
from pathlib import Path

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
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
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
from temples import api_views_concierge as concierge

from temples.api.views.create_superuser import create_superuser
from users.api.views import MeView as ApiMeView
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
def debug_db(request):
    from temples.models import PlaceRef, Shrine
    from django.apps import apps

    try:
        from temples.models import ShrineCandidate
        shrine_candidate_count = ShrineCandidate.objects.count()
    except Exception as e:
        shrine_candidate_count = f"ERR: {type(e).__name__}"

    # --- migration 状態 ---
    migration_0078_applied = None
    migration_count = None
    latest_temples_migrations = []
    has_0048 = None
    has_0049 = None
    has_0050 = None
    has_0077 = None
    has_0078 = None

    # --- schema ---
    has_temples_goshuin = None
    has_temples_goshuinimage = None
    has_temples_like = None
    has_temples_rankinglog = None
    has_temples_conciergethread = None
    has_conciergethread_anonymous_id = None

    # --- disk ---
    disk_has_0078_file = None
    disk_latest_temples_migration_files = []
    migrations_dir = None

    # --- loader ---
    loader_has_0078 = None
    loader_leaf_nodes = []
    loader_disk_migrations_tail = []

    # --- app resolution ---
    migration_modules_temples = None
    app_config_name = None
    app_module_file = None
    temples_package_file = None
    temples_migrations_file = None

    migration_check_error = None
    schema_check_error = None
    migration_files_error = None
    migration_loader_error = None
    app_resolution_error = None

    # ======================
    # migration DB
    # ======================
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM django_migrations
                WHERE app = %s
                """,
                ["temples"],
            )
            migration_count = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT name
                FROM django_migrations
                WHERE app = %s
                ORDER BY id DESC
                LIMIT 10
                """,
                ["temples"],
            )
            latest_temples_migrations = [row[0] for row in cursor.fetchall()]

            def _exists_migration(name: str) -> bool:
                cursor.execute(
                    """
                    SELECT EXISTS (
                      SELECT 1
                      FROM django_migrations
                      WHERE app = %s AND name = %s
                    )
                    """,
                    ["temples", name],
                )
                return bool(cursor.fetchone()[0])

            has_0048 = _exists_migration("0048_conciergethread_conciergemessage_and_more")
            has_0049 = _exists_migration("0049_goshuin_shrine")
            has_0050 = _exists_migration("0050_alter_goshuin_options_goshuin_updated_at_and_more")
            has_0077 = _exists_migration("0077_featureusage")
            has_0078 = _exists_migration("0078_conciergethread_anonymous_id_and_more")
            migration_0078_applied = has_0078

    except Exception as e:
        migration_check_error = f"{type(e).__name__}: {e}"

    # ======================
    # schema
    # ======================
    try:
        with connection.cursor() as cursor:
            def _table_exists(name):
                cursor.execute(
                    """
                    SELECT EXISTS (
                      SELECT 1 FROM information_schema.tables
                      WHERE table_schema = 'public'
                      AND table_name = %s
                    )
                    """,
                    [name],
                )
                return bool(cursor.fetchone()[0])

            has_temples_goshuin = _table_exists("temples_goshuin")
            has_temples_goshuinimage = _table_exists("temples_goshuinimage")
            has_temples_like = _table_exists("temples_like")
            has_temples_rankinglog = _table_exists("temples_rankinglog")
            has_temples_conciergethread = _table_exists("temples_conciergethread")

            cursor.execute(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name='temples_conciergethread'
                  AND column_name='anonymous_id'
                )
                """
            )
            has_conciergethread_anonymous_id = bool(cursor.fetchone()[0])

    except Exception as e:
        schema_check_error = f"{type(e).__name__}: {e}"

    # ======================
    # disk
    # ======================
    try:
        migrations_dir = Path(__file__).resolve().parents[1] / "temples" / "migrations"

        disk_has_0078_file = (
            migrations_dir / "0078_conciergethread_anonymous_id_and_more.py"
        ).exists()

        disk_latest_temples_migration_files = sorted(
            [
                p.name
                for p in migrations_dir.glob("[0-9][0-9][0-9][0-9]_*.py")
                if p.name != "__init__.py"
            ]
        )[-10:]

    except Exception as e:
        migration_files_error = f"{type(e).__name__}: {e}"

    # ======================
    # loader
    # ======================
    try:
        from django.db.migrations.loader import MigrationLoader

        loader = MigrationLoader(connection, ignore_no_migrations=True)

        loader_has_0078 = ("temples", "0078_conciergethread_anonymous_id_and_more") in loader.disk_migrations

        loader_leaf_nodes = [
            [app_label, migration_name]
            for app_label, migration_name in loader.graph.leaf_nodes()
            if app_label == "temples"
        ]

        loader_disk_migrations_tail = sorted(
            [
                name
                for app_label, name in loader.disk_migrations.keys()
                if app_label == "temples"
            ]
        )[-10:]

    except Exception as e:
        migration_loader_error = f"{type(e).__name__}: {e}"

    # ======================
    # ⭐️ app resolution（今回の本命）
    # ======================
    try:
        import temples
        import importlib

        migration_modules_temples = getattr(settings, "MIGRATION_MODULES", {}).get("temples")

        app_config = apps.get_app_config("temples")
        app_config_name = app_config.name
        app_module_file = getattr(app_config.module, "__file__", None)

        temples_package_file = getattr(temples, "__file__", None)

        try:
            temples_migrations = importlib.import_module("temples.migrations")
            temples_migrations_file = getattr(temples_migrations, "__file__", None)
        except Exception as e:
            temples_migrations_file = f"ERR: {type(e).__name__}"

    except Exception as e:
        app_resolution_error = f"{type(e).__name__}: {e}"

    # ======================
    return JsonResponse(
        {
            "ENGINE": settings.DATABASES["default"]["ENGINE"],
            "NAME": settings.DATABASES["default"].get("NAME"),
            "HOST": settings.DATABASES["default"].get("HOST"),
            "PORT": settings.DATABASES["default"].get("PORT"),
            "USER": settings.DATABASES["default"].get("USER"),
            "connection_vendor": connection.vendor,
            "shrine_count": Shrine.objects.count(),
            "place_ref_count": PlaceRef.objects.count(),
            "shrine_candidate_count": shrine_candidate_count,
            "migration": {
                "temples_migration_count": migration_count,
                "latest_temples_migrations": latest_temples_migrations,
                "temples_0078_applied": migration_0078_applied,
                "has_0048": has_0048,
                "has_0049": has_0049,
                "has_0050": has_0050,
                "has_0077": has_0077,
                "has_0078": has_0078,
                "error": migration_check_error,
            },
            "migration_files": {
                "migrations_dir": str(migrations_dir) if migrations_dir else None,
                "disk_has_0078_file": disk_has_0078_file,
                "disk_latest_temples_migration_files": disk_latest_temples_migration_files,
                "error": migration_files_error,
            },
            "migration_loader": {
                "loader_has_0078": loader_has_0078,
                "loader_leaf_nodes": loader_leaf_nodes,
                "loader_disk_migrations_tail": loader_disk_migrations_tail,
                "error": migration_loader_error,
            },
            "app_resolution": {
                "migration_modules_temples": migration_modules_temples,
                "app_config_name": app_config_name,
                "app_module_file": app_module_file,
                "temples_package_file": temples_package_file,
                "temples_migrations_file": temples_migrations_file,
                "error": app_resolution_error,
            },
            "schema": {
                "has_temples_goshuin": has_temples_goshuin,
                "has_temples_goshuinimage": has_temples_goshuinimage,
                "has_temples_like": has_temples_like,
                "has_temples_rankinglog": has_temples_rankinglog,
                "has_temples_conciergethread": has_temples_conciergethread,
                "has_conciergethread_anonymous_id": has_conciergethread_anonymous_id,
                "error": schema_check_error,
            },
        }
    )

@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def debug_media(request):
    p = Path(settings.MEDIA_ROOT) / "goshuin" / "upload_EZ1Xq7g.jpg"
    return JsonResponse(
        {
            "MEDIA_ROOT": str(settings.MEDIA_ROOT),
            "target": str(p),
            "exists": p.exists(),
            "is_file": p.is_file(),
            "size": p.stat().st_size if p.exists() and p.is_file() else None,
        }
    )


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
    path("admin/create-superuser/", create_superuser),
    path("admin/", admin.site.urls),
    path("api/users/me/", ApiMeView.as_view(), name="users-me"),
    path("api/", include(("users.api.urls", "users"), namespace="users_api")),
    path("api/", include(("temples.api.urls", "temples"), namespace="temples")),
    path("api/concierge/plan/", concierge.plan, name="concierge-plan"),
    path("api/_debug/db/", debug_db, name="debug_db"),
    path("api/_debug/media/", debug_media, name="debug_media"),
    path("api/_debug/whoami/", whoami, name="whoami"),
    path("_debug/whoami_jwt/", whoami_jwt, name="whoami_jwt"),
    path("api/auth/jwt/create/", TokenObtainPairView.as_view(), name="jwt_create"),
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
