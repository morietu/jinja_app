from rest_framework import viewsets, filters
from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta


from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance

from rest_framework.views import APIView
from rest_framework.response import Response
from temples.models import Shrine, Visit, Favorite

from .models import Shrine, GoriyakuTag
from .serializers import ShrineSerializer, GoriyakuTagSerializer


class GoriyakuTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GoriyakuTag.objects.all()
    serializer_class = GoriyakuTagSerializer


class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ShrineSerializer

    def get_queryset(self):
        queryset = Shrine.objects.all()

        # 神社名フィルタ
        name = self.request.query_params.get("name")
        if name:
            queryset = queryset.filter(
                Q(name_jp__icontains=name) | Q(name_romaji__icontains=name)
            )

        # タグフィルタ
        tags = self.request.query_params.getlist("tag")  # ← 複数対応
        if tags:
            queryset = queryset.filter(goriyaku_tags__name__in=tags)


        # 半径フィルタ
        lat = self.request.query_params.get("lat")
        lng = self.request.query_params.get("lng")
        radius = self.request.query_params.get("radius")
        if lat and lng and radius:
            try:
                user_location = Point(float(lng), float(lat), srid=4326)
                queryset = queryset.filter(
                    latitude__isnull=False, longitude__isnull=False
                )
                queryset = [
                    shrine for shrine in queryset
                    if shrine.latitude and shrine.longitude and
                       user_location.distance(Point(shrine.longitude, shrine.latitude, srid=4326)) <= float(radius) / 111000
                ]
            except Exception:
                pass

        return queryset
    
class RankingAPIView(APIView):
    def get(self, request):
        last_30_days = timezone.now() - timedelta(days=30)

        # Visit 集計
        visits = (
            Visit.objects.filter(visited_at__gte=last_30_days)
            .values("shrine")
            .annotate(count=Count("id"))
        )
        # Favorite 集計
        favorites = (
            Favorite.objects.filter(created_at__gte=last_30_days)
            .values("shrine")
            .annotate(count=Count("id"))
        )

        # shrine_id ごとにスコア集計
        scores = {}
        for v in visits:
            scores[v["shrine"]] = scores.get(v["shrine"], 0) + v["count"]
        for f in favorites:
            scores[f["shrine"]] = scores.get(f["shrine"], 0) + f["count"]

        # スコア順にソートして TOP10
        ranking = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:10]

        data = []
        for shrine_id, score in ranking:
            shrine = Shrine.objects.get(id=shrine_id)
            data.append({
                "id": shrine.id,
                "name_jp": shrine.name_jp,
                "address": shrine.address,
                "score": score,
            })

        return Response(data)
    

