from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count
from temples.models import Shrine, Visit, Favorite

class RankingAPIView(APIView):
    def get(self, request):
        last_30_days = timezone.now() - timedelta(days=30)

        visits = Visit.objects.filter(visited_at__gte=last_30_days).values("shrine").annotate(count=Count("id"))
        favorites = Favorite.objects.filter(created_at__gte=last_30_days).values("shrine").annotate(count=Count("id"))

        scores = {}
        for v in visits:
            scores[v["shrine"]] = scores.get(v["shrine"], 0) + v["count"]
        for f in favorites:
            scores[f["shrine"]] = scores.get(f["shrine"], 0) + f["count"]

        ranking = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:10]

        data = [
            {"id": shrine.id, "name_jp": shrine.name_jp, "address": shrine.address, "score": score}
            for shrine_id, score in ranking
            for shrine in [Shrine.objects.get(id=shrine_id)]
        ]
        return Response(data)
