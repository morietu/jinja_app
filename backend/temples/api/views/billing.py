from __future__ import annotations
import os
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from temples.services.billing_state import get_billing_status

PROVIDER_CHOICES = ("stub", "stripe", "revenuecat", "unknown")


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
        st = get_billing_status(user=getattr(request, "user", None))
        ser = BillingStatusSerializer(
            instance={
                "plan": st.plan,
                "is_active": st.is_active,
                "provider": st.provider,
                "current_period_end": st.current_period_end,
                "trial_ends_at": st.trial_ends_at,
                "cancel_at_period_end": st.cancel_at_period_end,
            }
        )
        u = getattr(request, "user", None)
        return Response(ser.data, status=200)


@extend_schema(exclude=True)
class BillingStatusLegacyView(BillingStatusView):
    pass
