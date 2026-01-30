from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from temples.services.places import PlacesError, get_or_create_shrine_by_place_id

class PlacesResolveView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        place_id = (request.data or {}).get("place_id")
        if not place_id:
            return Response({"detail": "place_id is required"}, status=400)

        try:
            shrine = get_or_create_shrine_by_place_id(place_id)
            return Response(
                {"id": shrine.id, "shrine_id": shrine.id, "place_id": place_id},
                status=200,
            )
        except PlacesError as e:
            return Response({"detail": str(e)}, status=getattr(e, "status", 502) or 502)
