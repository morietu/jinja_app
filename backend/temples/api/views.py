from rest_framework.permissions import IsAuthenticated
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView   # ← これを追加
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404


from ..serializers import ShrineSerializer
from .permissions import IsOwnerOrReadOnly   # 後述


from django.db.models import Q
from temples.models import Shrine, Favorite, GoriyakuTag   # ← 追加
from ..serializers import ShrineSerializer, GoriyakuTagSerializer

from math import radians, cos, sin, asin, sqrt

import logging
logger = logging.getLogger(__name__)

def haversine(lon1, lat1, lon2, lat2):
    """緯度経度2点間の距離をメートルで返す"""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371000  # 地球の半径(m)
    return c * r

class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ShrineSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Shrine.objects.all()

        # タグフィルタ
        tag = self.request.query_params.get("tag")
        if tag:
            queryset = queryset.filter(goriyaku_tags__name__icontains=tag)

        # 名前フィルタ
        name = self.request.query_params.get("name")
        if name:
            queryset = queryset.filter(
                Q(name_jp__icontains=name) | Q(name_romaji__icontains=name)
            )

        # 半径フィルタ
        lat = self.request.query_params.get("lat")
        lng = self.request.query_params.get("lng")
        radius = float(self.request.query_params.get("radius", 5000))

        if lat and lng:
            lat, lng = float(lat), float(lng)
            ids = []
            for shrine in queryset:
                if shrine.latitude and shrine.longitude:
                    distance = haversine(
                        float(lng), float(lat),
                        float(shrine.longitude), float(shrine.latitude)
                    )
                    logger.debug(f"{shrine.name_jp}: {distance}m")  # デバッグ出力
                    if distance <= radius:
                        ids.append(shrine.id)
            queryset = queryset.filter(id__in=ids)

        return queryset.distinct()



class FavoriteToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shrine_id):
        shrine = get_object_or_404(Shrine, id=shrine_id)   # ← 修正 (Shrine.get_object_or_404 → get_object_or_404)
        favorite, created = Favorite.objects.get_or_create(
            user=request.user, shrine=shrine
        )
        if not created:
            favorite.delete()
            return Response({
                "status": "removed",
                "shrine": {
                    "id": shrine.id,
                    "name_jp": shrine.name_jp,
                    "address": shrine.address,
                },
                "user": request.user.username
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "added",
            "shrine": {
                "id": shrine.id,
                "name_jp": shrine.name_jp,
                "address": shrine.address,
            },
            "user": request.user.username
            }, status=status.HTTP_201_CREATED)


class RouteView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        # TODO: Google Maps API のルート検索ロジック
        return Response({"message": "Route API placeholder"})


class VisitCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shrine_id):
        shrine = get_object_or_404(Shrine, id=shrine_id)

        favorite, created = Favorite.objects.get_or_create(
            user=request.user,
            shrine=shrine
        )

        if not created:
            favorite.delete()
            return Response(
                {
                    "status": "removed",
                    "shrine": {
                        "id": shrine.id,
                        "name_jp": shrine.name_jp,
                        "address": shrine.address,
                    },
                    "user": request.user.username
                },
                status=status.HTTP_200_OK
            )

        return Response(
            {
                "status": "added",
                "shrine": {
                    "id": shrine.id,
                    "name_jp": shrine.name_jp,
                    "address": shrine.address,
                },
                "user": request.user.username
            },
            status=status.HTTP_201_CREATED
        )
    

class GoriyakuTagViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ご利益タグ一覧を返すAPI
    /api/goriyaku-tags/ で利用
    """
    queryset = GoriyakuTag.objects.all()
    serializer_class = GoriyakuTagSerializer
    permission_classes = [permissions.AllowAny]


