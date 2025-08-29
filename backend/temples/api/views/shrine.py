# shrine.py
from rest_framework import viewsets, permissions
from django.db.models import Q
from temples.models import Shrine, GoriyakuTag
from temples.api.serializers.shrine import ShrineListSerializer, ShrineDetailSerializer, GoriyakuTagSerializer

class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Shrine.objects.all()
    serializer_class = ShrineListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Shrine.objects.all()
        params = self.request.query_params

        # 新: q パラメータ検索
        q = params.get("q")
        if q:
            queryset = queryset.filter(
                Q(name_jp__icontains=q) |
                Q(name_romaji__icontains=q) |
                Q(address__icontains=q) |
                Q(goriyaku__icontains=q) |
                Q(goriyaku_tags__name__icontains=q)
            )

        # 旧: 名前検索
        name = params.get("name")
        if name:
            queryset = queryset.filter(
                Q(name_jp__icontains=name) | Q(name_romaji__icontains=name)
            )

        # 旧: ご利益タグ
        goriyaku = params.getlist("goriyaku")
        if goriyaku:
            queryset = queryset.filter(goriyaku_tags__name__in=goriyaku)

        # 旧: 神格タグ
        shinkaku = params.getlist("shinkaku")
        if shinkaku:
            queryset = queryset.filter(goriyaku_tags__name__in=shinkaku)

        # 旧: 地域タグ
        region = params.getlist("region")
        if region:
            queryset = queryset.filter(goriyaku_tags__name__in=region)

        return queryset.distinct()

    def get_serializer_class(self):
        if self.action == "list":
            return ShrineListSerializer
        return ShrineDetailSerializer


class GoriyakuTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GoriyakuTag.objects.all()
    serializer_class = GoriyakuTagSerializer
    permission_classes = [permissions.AllowAny]
