from rest_framework import viewsets, filters
from django.db.models import Q
from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
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
        tag = self.request.query_params.get("tag")
        if tag:
            queryset = queryset.filter(goriyaku_tags__name__icontains=tag)

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
