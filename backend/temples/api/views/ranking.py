from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Q
from temples.models import Shrine

class RankingAPIView(APIView):
    def get(self, request):
        last_30_days = timezone.now() - timedelta(days=30)

        shrines = (
            Shrine.objects.all()
            .annotate(
                visit_count=Count(
                    "visits",
                    filter=Q(visits__visited_at__gte=last_30_days),
                ),
                favorite_count=Count(
                    "favorited_by",
                    filter=Q(favorited_by__created_at__gte=last_30_days),
                ),
            )
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

        # スコアでソートして上位10件
        results = sorted(results, key=lambda x: x["score"], reverse=True)[:10]

        return Response(results)
