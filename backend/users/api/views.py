# users/api/views.py
from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings
from django.db.models import Count, Sum
from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from temples.models import GoshuinImage
from users.models import UserProfile
from users.services.stripe_webhook import apply_stripe_subscription_event

from .serializers import SignupSerializer, UserMeSerializer, UserProfileUpdateSerializer

log = logging.getLogger(__name__)


def _storage_limit_bytes() -> int:
    return int(getattr(settings, "STORAGE_LIMIT_BYTES", 200 * 1024 * 1024))


class MeStorageResponseSerializer(serializers.Serializer):
    total_bytes = serializers.IntegerField()
    total_images = serializers.IntegerField()
    limit_bytes = serializers.IntegerField()
    remaining_bytes = serializers.IntegerField()
    is_over_limit = serializers.BooleanField()


class MeStorageView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="api_users_me_storage_retrieve",
        responses={200: MeStorageResponseSerializer},
        tags=["users"],
    )
    def get(self, request):
        qs = GoshuinImage.objects.filter(goshuin__user=request.user)
        agg = qs.aggregate(total_bytes=Sum("size_bytes"), total_images=Count("id"))

        total_bytes = int(agg["total_bytes"] or 0)
        total_images = int(agg["total_images"] or 0)

        limit_bytes = _storage_limit_bytes()
        remaining_bytes = max(0, limit_bytes - total_bytes)
        is_over_limit = total_bytes > limit_bytes

        return Response(
            {
                "total_bytes": total_bytes,
                "total_images": total_images,
                "limit_bytes": limit_bytes,
                "remaining_bytes": remaining_bytes,
                "is_over_limit": is_over_limit,
            }
        )


class MeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(
        summary="Get current user profile",
        responses={200: UserMeSerializer},
        tags=["users"],
    )
    def get(self, request):
        UserProfile.objects.get_or_create(
            user=request.user,
            defaults={"nickname": request.user.username, "is_public": True},
        )
        user = type(request.user).objects.select_related("profile").get(pk=request.user.pk)
        return Response(UserMeSerializer(user, context={"request": request}).data)

    @extend_schema(
        summary="Update current user profile",
        request=UserProfileUpdateSerializer,
        responses={200: UserMeSerializer},
        tags=["users"],
    )
    def patch(self, request):
        prof, _ = UserProfile.objects.get_or_create(user=request.user)
        ser = UserProfileUpdateSerializer(prof, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()

        user = type(request.user).objects.select_related("profile").get(pk=request.user.pk)
        return Response(UserMeSerializer(user, context={"request": request}).data)


class SignupResponse(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()


class SignupView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Signup",
        request=SignupSerializer,
        responses={201: SignupResponse},
        tags=["users"],
    )
    def post(self, request):
        s = SignupSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        user = s.save()
        return Response({"id": user.id, "username": user.username}, status=status.HTTP_201_CREATED)


@extend_schema(exclude=True)
@csrf_exempt
def stripe_webhook(request: HttpRequest) -> HttpResponse:
    payload = request.body
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        import stripe
    except Exception:
        log.exception("[stripe] stripe sdk not installed")
        return HttpResponse(status=500)

    webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "")
    if not webhook_secret:
        log.error("[stripe] STRIPE_WEBHOOK_SECRET is missing")
        return HttpResponse(status=500)

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=webhook_secret,
        )
    except stripe.error.SignatureVerificationError:
        return HttpResponse(status=400)
    except Exception:
        log.exception("[stripe] construct_event failed")
        return HttpResponse(status=400)

    try:
        event_dict: dict[str, Any] = json.loads(json.dumps(event))
    except Exception:
        event_dict = {"type": getattr(event, "type", None), "data": {}}

    etype = event_dict.get("type") or ""
    obj = (event_dict.get("data") or {}).get("object") or {}

    if getattr(settings, "STRIPE_WEBHOOK_DEBUG", False) and isinstance(obj, dict):
        if etype.startswith("customer.subscription"):
            items = obj.get("items")
            first_item_cpe = None
            try:
                data0 = ((items or {}).get("data") or [None])[0]
                if isinstance(data0, dict):
                    first_item_cpe = data0.get("current_period_end")
            except Exception:
                pass

            log.debug(
                "[stripe] etype=%s obj.current_period_end=%r item0.current_period_end=%r items_type=%s items_keys=%s",
                etype,
                obj.get("current_period_end"),
                first_item_cpe,
                type(items).__name__,
                sorted(items.keys()) if isinstance(items, dict) else None,
            )

    try:
        apply_stripe_subscription_event(event=event_dict)
    except Exception:
        log.exception("[stripe] apply event failed etype=%s", etype)
        return HttpResponse(status=500)

    return HttpResponse(status=200)
