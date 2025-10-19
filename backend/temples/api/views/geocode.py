from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from temples.api.serializers.geocode import (
    ReverseQuerySerializer,
    ReverseResponseSerializer,
    SearchQuerySerializer,
    SearchResponseSerializer,
)
from temples.services.geocode import geocode_reverse as svc_geocode_reverse
from temples.services.geocode import geocode_search as svc_geocode_search


# ---- /api/geocodes/search/ ---------------------------------------------------
@extend_schema(
    summary="Geocode search",
    description="住所/地名をクエリで与えてジオコーディングします。",
    parameters=[SearchQuerySerializer],  # drf-spectacular: Serializer を parameters に渡せる
    responses={200: SearchResponseSerializer},
    tags=["geocodes"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def geocode_search(request, *_, **__):
    # throttle scope
    request.throttle_scope = "geocode"
    s = SearchQuerySerializer(data=request.GET)
    s.is_valid(raise_exception=True)
    res = svc_geocode_search(**s.validated_data)
    return Response(SearchResponseSerializer(res).data, status=status.HTTP_200_OK)


# 後方互換（テストや古い import が search を参照することがある）
search = geocode_search


# ---- /api/geocodes/reverse/ --------------------------------------------------
@extend_schema(
    summary="Reverse geocode",
    description="緯度経度から住所を推定します。",
    parameters=[
        OpenApiParameter(
            "lat", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=True, description="緯度"
        ),
        OpenApiParameter(
            "lng", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=True, description="経度"
        ),
        OpenApiParameter(
            "lang",
            OpenApiTypes.STR,
            OpenApiParameter.QUERY,
            required=False,
            description="言語 (既定: ja)",
        ),
    ],
    responses={200: ReverseResponseSerializer},
    tags=["geocodes"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def geocode_reverse(request, *_, **__):
    request.throttle_scope = "geocode"
    s = ReverseQuerySerializer(data=request.GET)
    s.is_valid(raise_exception=True)
    res = svc_geocode_reverse(**s.validated_data)
    return Response(ReverseResponseSerializer(res).data, status=status.HTTP_200_OK)


# 後方互換（テストが reverse_geocode を import する場合）
reverse = geocode_reverse
reverse_geocode = geocode_reverse


# ---- レガシー入口（schema からは除外） ---------------------------------------
@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def geocode_search_legacy(request, *args, **kwargs):
    # /api/geocode/search/ → /api/geocodes/search/ に委譲
    raw_request = getattr(request, "_request", request)
    return geocode_search(raw_request, *args, **kwargs)


@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def geocode_reverse_legacy(request, *args, **kwargs):
    # /api/geocode/reverse/ → /api/geocodes/reverse/ に委譲
    raw_request = getattr(request, "_request", request)
    return geocode_reverse(raw_request, *args, **kwargs)
