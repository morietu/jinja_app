from __future__ import annotations

from django.conf import settings
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class DebugDbSchemaView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        result = {
            "ok": True,
            "database": {
                "engine": settings.DATABASES["default"].get("ENGINE"),
                "name": settings.DATABASES["default"].get("NAME"),
                "host": settings.DATABASES["default"].get("HOST"),
                "port": settings.DATABASES["default"].get("PORT"),
            },
            "migration": {
                "temples_0078_applied": False,
            },
            "schema": {
                "has_temples_goshuin": False,
                "has_temples_conciergethread": False,
                "has_conciergethread_anonymous_id": False,
            },
        }

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM django_migrations
                    WHERE app = %s
                      AND name = %s
                )
                """,
                ["temples", "0078_conciergethread_anonymous_id_and_more"],
            )
            result["migration"]["temples_0078_applied"] = bool(cursor.fetchone()[0])

            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'temples_goshuin'
                )
                """
            )
            result["schema"]["has_temples_goshuin"] = bool(cursor.fetchone()[0])

            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'temples_conciergethread'
                )
                """
            )
            result["schema"]["has_temples_conciergethread"] = bool(cursor.fetchone()[0])

            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'temples_conciergethread'
                      AND column_name = 'anonymous_id'
                )
                """
            )
            result["schema"]["has_conciergethread_anonymous_id"] = bool(cursor.fetchone()[0])

        return Response(result)
