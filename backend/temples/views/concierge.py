# backend/temples/views/concierge.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services.concierge import make_plan
from .services.places import text_search_first  # 既存のPlacesラッパを想定
from ..serializers.concierge import (
    ConciergePlanRequestSerializer,
    ConciergePlanResponseSerializer
)
from ..services.concierge import ConciergeService


class ConciergePlanView(APIView):
    throttle_scope = "concierge"  # DRFスロットル設定予定

    def post(self, request):
        lat = request.data.get("lat")
        lng = request.data.get("lng")
        benefit = request.data.get("benefit", "")
        mode = request.data.get("mode", "walk")
        req = ConciergePlanRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        data = req.validated_data

        service = ConciergeService()

        plan = make_plan(lat, lng, benefit, mode)
        plan = service.build_plan(
            query=data["query"],
            language=data.get("language", "ja"),
            locationbias=data.get("locationbias", ""),
            transportation=data.get("transportation", "walk")
        )
        res = ConciergePlanResponseSerializer(plan)
        return Response(res.data, status=status.HTTP_200_OK)

        # Google Placesで name+area_hint を正規化して place_id / 住所 / 写真URL を付与
        def normalize(c):
            hit = text_search_first(f"{c['name']} {c['area_hint']}")
            return {**c, "place_id": hit.get("place_id"), "address": hit.get("formatted_address"), "photo_url": hit.get("photo_url")}

        main = normalize(plan["main"])
        nearby = [normalize(x) for x in plan["nearby"]]

        return Response({"mode": plan["mode"], "main": main, "nearby": nearby}, status=status.HTTP_200_OK)
