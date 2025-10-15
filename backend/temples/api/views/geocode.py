from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.api.serializers.geocode import (
    ReverseQuerySerializer,
    ReverseResponseSerializer,
    SearchQuerySerializer,
    SearchResponseSerializer,
)
from temples.services.geocode import geocode_reverse, geocode_search


@method_decorator(csrf_exempt, name="dispatch")  # GETのみならCSRF不要だが、開発中は残してOK
class GeocodeSearchView(APIView):
    throttle_scope = "geocode"

    @extend_schema(
        summary="Geocode search",
        description="住所/地名をクエリで与えてジオコーディングします。",
        # クエリパラメータは Serializer を parameters に渡せる（drf-spectacularの流儀）
        parameters=[SearchQuerySerializer],
        responses={200: SearchResponseSerializer},
        tags=["geocodes"],
    )
    def get(self, request, *args, **kwargs):
        s = SearchQuerySerializer(data=request.GET)
        s.is_valid(raise_exception=True)
        res = geocode_search(**s.validated_data)
        return Response(SearchResponseSerializer(res).data, status=status.HTTP_200_OK)


class GeocodeSearchViewLegacy(GeocodeSearchView):
    schema = None


@method_decorator(csrf_exempt, name="dispatch")
class GeocodeReverseView(APIView):
    throttle_scope = "geocode"

    @extend_schema(
        summary="Reverse geocode",
        description="緯度経度から住所を推定します。",
        parameters=[
            # Serializerでも良いけど、ここは明示的に列挙
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
    def get(self, request, *args, **kwargs):
        s = ReverseQuerySerializer(data=request.GET)
        s.is_valid(raise_exception=True)
        res = geocode_reverse(**s.validated_data)
        return Response(ReverseResponseSerializer(res).data, status=status.HTTP_200_OK)


class GeocodeReverseViewLegacy(GeocodeReverseView):
    schema = None
