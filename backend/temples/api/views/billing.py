# backend/temples/api/views/billing.py
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema


@extend_schema(
    summary="Billing status (stub)",
    tags=["billing"],
    responses={200: dict},
)
class BillingStatusView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(
            {"plan": "free", "is_active": False, "provider": "stub"},
            status=200,
        )


@extend_schema(exclude=True)
class BillingStatusLegacyView(BillingStatusView):
    """Legacy alias: /api/billing/status/ (excluded from schema)"""
    pass
