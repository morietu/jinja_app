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


class ShrineViewSet(viewsets.ModelViewSet):
    queryset = Shrine.objects.all()
    serializer_class = ShrineSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
    
    def get_queryset(self):
        queryset = Shrine.objects.all()

         # タグフィルタ ?tag=縁 or ?tag=縁結び
        tag = self.request.query_params.get("tag")
        if tag:
            queryset = queryset.filter(goriyaku_tags__name__icontains=tag)

        # 名前フィルタ ?name=明治
        name = self.request.query_params.get("name")
        if name:
            queryset = queryset.filter(
                Q(name_jp__icontains=name) | Q(name_romaji__icontains=name)
            )

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