from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from temples.api.serializers.places import PlaceLiteResponseSerializer
from temples.services.places import find_place, PlacesError
from temples.services import places


def _to_place_lite(r: dict) -> dict:
    geom = (r.get("geometry") or {}).get("location") or {}
    addr = r.get("formatted_address") or r.get("vicinity")
    return {
        "place_id": r.get("place_id"),
        "name": r.get("name") or "",
        "address": addr,
        "lat": geom.get("lat"),
        "lng": geom.get("lng"),
        "types": r.get("types") or [],
    }


class PlacesFindLiteView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request):
        q = (request.query_params.get("input") or "").strip()
        if not q:
            return Response({"detail": "input is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = places.find_place(
                input=q,
                inputtype="textquery",
                language="ja",
                fields=["place_id", "name", "geometry", "formatted_address", "types"],
            )
        except PlacesError as e:
            return Response({"detail": str(e)}, status=e.status or status.HTTP_502_BAD_GATEWAY)

        candidates = data.get("candidates") or []
        results = [_to_place_lite(r) for r in candidates if r.get("place_id")]

        ser = PlaceLiteResponseSerializer(data={"results": results})
        ser.is_valid(raise_exception=True)
        return Response(ser.validated_data, status=status.HTTP_200_OK)
