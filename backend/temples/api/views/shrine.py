# shrine.py
from rest_framework import viewsets, permissions
from django.db.models import Q
from temples.models import Shrine, GoriyakuTag
from ..serializers import ShrineListSerializer, ShrineDetailSerializer, GoriyakuTagSerializer

class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Shrine.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Shrine.objects.all()
        name = self.request.query_params.get("name")
        if name:
            queryset = queryset.filter(
                Q(name_jp__icontains=name) | Q(name_romaji__icontains=name)
            )
        tag = self.request.query_params.get("tag")
        if tag:
            queryset = queryset.filter(goriyaku_tags__name__icontains=tag)
        return queryset.distinct()

    def get_serializer_class(self):
        if self.action == "list":
            return ShrineListSerializer
        return ShrineDetailSerializer


class GoriyakuTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GoriyakuTag.objects.all()
    serializer_class = GoriyakuTagSerializer
    permission_classes = [permissions.AllowAny]
