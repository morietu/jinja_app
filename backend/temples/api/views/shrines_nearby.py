from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone

from temples.models import PlaceRef, Shrine

@transaction.atomic
def shrines_nearby(request):
    lat = request.GET.get("lat")
    lng = request.GET.get("lng")
    if not lat or not lng:
        return JsonResponse({"error": "missing lat/lng"}, status=400)

    radius_m = int(request.GET.get("radius_m", "3000"))
    limit = int(request.GET.get("limit", "20"))

    # TODO: ここは既存の Google Places クライアントに差し替え
    places = search_nearby_places(lat=float(lat), lng=float(lng), radius_m=radius_m, limit=limit)

    results = []
    now = timezone.now()

    for p in places:
        place_id = p.get("place_id")
        if not place_id:
            continue

        pref, _ = PlaceRef.objects.update_or_create(
            place_id=place_id,
            defaults={
                "name": p.get("name") or "",
                "address": p.get("address") or "",
                "latitude": p.get("latitude"),
                "longitude": p.get("longitude"),
                "snapshot_json": p.get("raw"),
                "synced_at": now,
            },
        )

        shrine, _ = Shrine.objects.update_or_create(
            place_ref=pref,
            defaults={
                "kind": "shrine",
                "name_jp": pref.name or "名称未設定",
                "address": pref.address or "",
                "latitude": pref.latitude,
                "longitude": pref.longitude,
            },
        )

        results.append({
            "id": shrine.id,
            "name_jp": shrine.name_jp,
            "address": shrine.address,
            "latitude": shrine.latitude,
            "longitude": shrine.longitude,
            "place_id": pref.place_id,
        })

    return JsonResponse({"results": results}, status=200)
