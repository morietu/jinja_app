# backend/temples/api/views/shrine_from_place.py
import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from temples.services import google_places as GP
from temples.models import Shrine  # ここは実プロジェクトの import に合わせて
from rest_framework.permissions import AllowAny
from django.contrib.gis.geos import Point



logger = logging.getLogger(__name__)



@api_view(["POST"])
@permission_classes([AllowAny])  # いまはデバッグでOK。本番は IsAuthenticated に戻す
def shrine_from_place(request):
    place_id = (request.data.get("place_id") or "").strip()
    if not place_id:
        return Response({"detail": "place_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        data = GP.detail(place_id=place_id) if hasattr(GP, "detail") else GP.details(place_id=place_id)
        src = data.get("result") or data.get("place") or data or {}
        name = src.get("name")
        address = src.get("formatted_address") or src.get("vicinity")

        loc = ((src.get("geometry") or {}).get("location")) or {}
        lat = loc.get("lat")
        lng = loc.get("lng")
    except Exception:
        logger.exception("shrine_from_place: failed to fetch place detail")
        return Response({"detail": "failed to fetch place detail"}, status=status.HTTP_502_BAD_GATEWAY)

    if not name or lat is None or lng is None:
        return Response({"detail": "place detail is insufficient"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    # 同一座標で既存を拾う（最短）
    shrine = Shrine.objects.filter(latitude=lat, longitude=lng).first()

    if shrine:
        created = False
        shrine.name_jp = name
        shrine.address = address
        shrine.location = Point(lng, lat)
        shrine.save(update_fields=["name_jp", "address", "location", "updated_at"])
    else:
        shrine = Shrine.objects.create(
            kind="shrine",  # ここが違うなら値だけ直す（次の手順参照）
            name_jp=name,
            address=address,
            latitude=lat,
            longitude=lng,
            location=Point(lng, lat),
        )
        created = True

    return Response(
        {"shrine_id": shrine.id, "created": created},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )
