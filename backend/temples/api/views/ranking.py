import math
from datetime import timedelta

from django.db.models import Count, F, Q, Value
from django.db.models.functions import Abs, Coalesce
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.api.serializers.shrine import ShrineListSerializer
from temples.models import Shrine


class RankingAPIView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "shrines"

    def get(self, request):
        # limit（1..50）
        try:
            limit = int(request.query_params.get("limit", 10))
        except ValueError:
            limit = 10
        limit = max(1, min(limit, 50))

        qs = Shrine.objects.all()

        # --- 近傍フィルタ（BBOX 簡易版）---
        near = request.query_params.get("near")
        radius_km = request.query_params.get("radius_km")
        if near and radius_km:
            try:
                lat0, lng0 = [float(x) for x in near.split(",", 1)]
                r = float(radius_km)
                dlat = r / 111.0
                dlng = r / (111.0 * max(0.1, math.cos(math.radians(lat0))))
                qs = qs.filter(
                    latitude__gte=lat0 - dlat,
                    latitude__lte=lat0 + dlat,
                    longitude__gte=lng0 - dlng,
                    longitude__lte=lng0 + dlng,
                ).annotate(
                    _approx_deg=Abs(F("latitude") - Value(lat0)) + Abs(F("longitude") - Value(lng0))
                )
            except Exception:
                pass

        # --- 動的30日窓の集計（既存フィールド名と衝突しないよう別名）---
        since = timezone.now() - timedelta(days=30)
        qs = qs.annotate(
            visits_30d_dyn=Count("visits", filter=Q(visits__visited_at__gte=since)),
            favorites_30d_dyn=Count("favorited_by", filter=Q(favorited_by__created_at__gte=since)),
            _popular=Coalesce(F("popular_score"), Value(0.0)),
        ).annotate(
            # 重み: 訪問×2 + お気に入り×1 + 人気スコア×0.5
            score=F("visits_30d_dyn") * 2
            + F("favorites_30d_dyn") * 1
            + F("_popular") * 0.5,
        )

        # 並び順: スコア降順 → popular_score降順 → id昇順 →（近傍指定時）_approx_deg
        order_by = ["-score", "-popular_score", "id"]
        if "_approx_deg" in qs.query.annotations:
            order_by.append("_approx_deg")

        qs = qs.order_by(*order_by)[:limit]

        data = ShrineListSerializer(qs, many=True, context={"request": request}).data
        return Response({"items": data})
