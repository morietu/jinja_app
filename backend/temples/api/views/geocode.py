from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from temples.api.serializers.geocode import (
    GeocodeResponseSerializer,
    GeocodeResultSerializer,
)
from temples.geocoding.client import GeocodingClient, GeocodingError

_GOOD_PRECISIONS = {"rooftop", "street"}


class GeocodeView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, *args, **kwargs):
        q = (request.query_params.get("q") or "").strip()
        try:
            limit = int(request.query_params.get("limit") or 5)
        except Exception:
            limit = 5
        limit = max(1, min(limit, 10))

        if not q:
            return Response({"message": "q は必須です。"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = GeocodingClient()
            candidates = client.geocode_candidates(q, limit=limit)
        except GeocodingError as e:
            return Response({"message": f"geocoding failed: {e}"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"message": f"unexpected error: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not candidates:
            data = {"candidates": [], "message": "not found"}
            return Response(GeocodeResponseSerializer(data).data, status=status.HTTP_200_OK)

        if len(candidates) == 1 and (candidates[0].precision in _GOOD_PRECISIONS):
            data = {"result": GeocodeResultSerializer(candidates[0]).data}
            return Response(GeocodeResponseSerializer(data).data, status=status.HTTP_200_OK)

        data = {"candidates": [GeocodeResultSerializer(c).data for c in candidates]}
        return Response(GeocodeResponseSerializer(data).data, status=status.HTTP_200_OK)
