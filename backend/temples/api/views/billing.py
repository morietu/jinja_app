from __future__ import annotations
import logging

from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from temples.services.billing_checkout import create_checkout_session
from temples.services.billing_portal import (
    BillingPortalCustomerMissing,
    BillingPortalNotConfigured,
    BillingPortalUnavailable,
    create_portal_session,
)
from temples.services.billing_state import get_billing_status
from users.services.stripe_webhook import (
    StripeWebhookInvalidSignature,
    StripeWebhookNotConfigured,
    apply_stripe_event,
    construct_stripe_event,
)

PROVIDER_CHOICES = ("stub", "stripe", "revenuecat", "unknown")
log = logging.getLogger(__name__)


class CheckoutUnavailable(APIException):
    status_code = 503
    default_detail = "checkout is unavailable"
    default_code = "checkout_unavailable"


class BillingPortalUnavailableError(APIException):
    status_code = 503
    default_detail = "billing portal is unavailable"
    default_code = "billing_portal_unavailable"


class BillingCustomerMissingError(APIException):
    status_code = 409
    default_detail = "billing customer is not linked to this account"
    default_code = "billing_customer_missing"


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
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        st = get_billing_status(user=getattr(request, "user", None))
        log.debug(
            "[BILLING_STATUS_AUTH] authenticated=%s user_id=%s",
            getattr(request.user, "is_authenticated", None),
            getattr(request.user, "id", None),
        )
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
        return Response(ser.data, status=200)


@extend_schema(exclude=True)
class BillingStatusLegacyView(BillingStatusView):
    pass


class CheckoutRequestSerializer(serializers.Serializer):
    success_url = serializers.URLField()
    cancel_url = serializers.URLField()


class CheckoutResponseSerializer(serializers.Serializer):
    session_id = serializers.CharField()
    checkout_url = serializers.URLField()


@extend_schema(
    summary="Create billing checkout session",
    tags=["billing"],
    request=CheckoutRequestSerializer,
    responses={200: OpenApiResponse(response=CheckoutResponseSerializer)},
)
class BillingCheckoutView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        req = CheckoutRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)

        try:
            session = create_checkout_session(
                user=request.user,
                success_url=req.validated_data["success_url"],
                cancel_url=req.validated_data["cancel_url"],
            )
        except RuntimeError as exc:
            raise CheckoutUnavailable(str(exc)) from exc

        ser = CheckoutResponseSerializer(
            instance={
                "session_id": session.session_id,
                "checkout_url": session.checkout_url,
            }
        )
        return Response(ser.data, status=200)


class PortalRequestSerializer(serializers.Serializer):
    return_url = serializers.URLField()


class PortalResponseSerializer(serializers.Serializer):
    portal_url = serializers.URLField()


@extend_schema(
    summary="Create billing customer portal session",
    tags=["billing"],
    request=PortalRequestSerializer,
    responses={200: OpenApiResponse(response=PortalResponseSerializer)},
)
class BillingPortalView(APIView):
    """
    Stripe Customer Portal への遷移 URL を発行する。

    解約/支払い方法変更などの管理 UI は Stripe 側に委譲しており、
    ここでは portal_url 以外を返さない（Stripe secret / 内部エラーは露出させない）。
    """

    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        req = PortalRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)

        try:
            session = create_portal_session(
                user=request.user,
                return_url=req.validated_data["return_url"],
            )
        except BillingPortalCustomerMissing as exc:
            raise BillingCustomerMissingError() from exc
        except BillingPortalNotConfigured as exc:
            log.warning("[stripe] billing portal is not configured")
            raise BillingPortalUnavailableError() from exc
        except BillingPortalUnavailable as exc:
            log.exception("[stripe] billing portal session creation failed")
            raise BillingPortalUnavailableError() from exc

        ser = PortalResponseSerializer(instance={"portal_url": session.portal_url})
        return Response(ser.data, status=200)


@extend_schema(exclude=True)
@method_decorator(csrf_exempt, name="dispatch")
class BillingStripeWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        try:
            event = construct_stripe_event(
                payload=request.body,
                sig_header=request.headers.get("Stripe-Signature", ""),
            )
        except StripeWebhookNotConfigured:
            log.exception("[stripe] webhook is not configured")
            return HttpResponse(status=503)
        except StripeWebhookInvalidSignature:
            return HttpResponse(status=400)
        except Exception:
            log.exception("[stripe] construct_event failed")
            return HttpResponse(status=400)

        try:
            apply_stripe_event(event=event)
        except Exception:
            log.exception("[stripe] apply event failed etype=%s", event.get("type"))
            return HttpResponse(status=500)

        return HttpResponse(status=200)
