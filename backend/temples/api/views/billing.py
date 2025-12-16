from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

PROVIDER_CHOICES = ("stub", "stripe", "revenuecat", "unknown")


def _provider() -> str:
    p = os.getenv("BILLING_PROVIDER", "stub")
    return p if p in PROVIDER_CHOICES else "unknown"


class BillingStatusSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=["free", "premium"])
    is_active = serializers.BooleanField()
    provider = serializers.ChoiceField(choices=PROVIDER_CHOICES)
    current_period_end = serializers.DateTimeField(allow_null=True, required=False)
    trial_ends_at = serializers.DateTimeField(allow_null=True, required=False)
    cancel_at_period_end = serializers.BooleanField()


@extend_schema(
    summary="Billing status",
    tags=["billing"],
    responses={200: OpenApiResponse(response=BillingStatusSerializer)},
)
class BillingStatusView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        stub_plan = os.getenv("BILLING_STUB_PLAN", "free")
        stub_active = os.getenv("BILLING_STUB_ACTIVE", "0") in {"1", "true", "True"}
        stub_cancel_at_period_end = os.getenv("BILLING_STUB_CANCEL_AT_PERIOD_END", "0") in {"1", "true", "True"}

        if stub_plan == "premium" and os.getenv("BILLING_STUB_ACTIVE") is None:
            stub_active = True

        now = datetime.now(timezone.utc)

        payload = {
            "plan": "premium" if stub_plan == "premium" else "free",
            "is_active": bool(stub_active),
            "provider": _provider(),
            "current_period_end": (now + timedelta(days=30)) if stub_active else None,
            "trial_ends_at": None,
            "cancel_at_period_end": bool(stub_cancel_at_period_end),
        }

        # schema/実レスポンスを一致させる（日時もここでISO化される）
        ser = BillingStatusSerializer(instance=payload)
        return Response(ser.data, status=200)


@extend_schema(exclude=True)
class BillingStatusLegacyView(BillingStatusView):
    pass
