# backend/temples/api/views/shrine_from_place.py
import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from temples.services import google_places as GP
from temples.models import Shrine  # ここは実プロジェクトの import に合わせて

logger = logging.getLogger(__name__)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def shrine_from_place(request):
    place_id = (request.data.get("place_id") or "").strip()
    if not place_id:
        return Response({"detail": "place_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # 既存の detail を使う（GP.detail_query でも OK）
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

    # ★ここ：プロジェクトの Shrine のフィールド名に合わせて調整
    # 例: google_place_id / name / address / lat / lng
    shrine, created = Shrine.objects.update_or_create(
        google_place_id=place_id,  # ←フィールド名を合わせる
        defaults={
            "name": name,
            "address": address,
            "lat": lat,
            "lng": lng,
        },
    )

    return Response(
        {"shrine_id": shrine.id, "created": created},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )
