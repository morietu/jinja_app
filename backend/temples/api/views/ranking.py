from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from temples.models import Shrine


class RankingAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        period = request.query_params.get("period", "monthly")

        if period == "yearly":
            days = 365
        else:
            days = 30

        since_date = timezone.now() - timedelta(days=days)

        shrines = Shrine.objects.all().annotate(
            visit_count=Count(
                "visits",
                filter=Q(visits__visited_at__gte=since_date),
            ),
            favorite_count=Count(
                "favorited_by",
                filter=Q(favorited_by__created_at__gte=since_date),
            ),
        )

        results = [
            {
                "id": shrine.id,
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "latitude": shrine.latitude,
                "longitude": shrine.longitude,
                "score": shrine.visit_count + shrine.favorite_count,
                "visit_count": shrine.visit_count,
                "favorite_count": shrine.favorite_count,
                "goriyaku_tags": [{"id": t.id, "name": t.name} for t in shrine.goriyaku_tags.all()],
            }
            for shrine in shrines
        ]

        # スコア順でTOP10
        results = sorted(results, key=lambda x: x["score"], reverse=True)[:10]

        # ランク付与
        for idx, r in enumerate(results, start=1):
            r["rank"] = idx

        return Response(results)
