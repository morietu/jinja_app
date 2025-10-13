from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
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


@method_decorator(csrf_exempt, name="dispatch")  # 開発中だけ。必要に応じて外す
class GeocodeSearchView(APIView):
    throttle_scope = "geocode"

    def get(self, request):
        s = SearchQuerySerializer(data=request.GET)
        s.is_valid(raise_exception=True)
        res = geocode_search(**s.validated_data)
        return Response(SearchResponseSerializer(res).data, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class GeocodeReverseView(APIView):
    throttle_scope = "geocode"

    def get(self, request):
        s = ReverseQuerySerializer(data=request.GET)
        s.is_valid(raise_exception=True)
        res = geocode_reverse(**s.validated_data)
        return Response(ReverseResponseSerializer(res).data, status=status.HTTP_200_OK)
