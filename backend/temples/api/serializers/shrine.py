from typing import Optional

from rest_framework import serializers
from drf_spectacular.utils import OpenApiTypes, extend_schema_field

from temples.geo_utils import to_lat_lng_dict
from temples.models import GoriyakuTag, Shrine, Visit


class GoriyakuTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoriyakuTag
        fields = ["id", "name", "category"]


class _DistanceFieldsMixin:
    def _distance_m(self, obj) -> Optional[float]:
        d = getattr(obj, "d_m", None)
        if d is None:
            d = getattr(obj, "distance_m", None)
        if d is None:
            d = getattr(obj, "distance", None)
        if d is None:
            return None
        try:
            return float(getattr(d, "m", d))
        except Exception:
            return None

    def get_distance(self, obj) -> Optional[float]:
        m = self._distance_m(obj)
        return None if m is None else round(m, 1)

    def get_distance_text(self, obj) -> Optional[str]:
        m = self._distance_m(obj)
        if m is None:
            return None
        return f"{int(round(m))} m" if m < 1000 else f"{m / 1000:.1f} km"


class _DeityMixin:
    deities = serializers.SerializerMethodField(read_only=True)

    @extend_schema_field(list[str])
    def get_deities(self, obj) -> list[str]:
        try:
            return [d.name for d in obj.deities.all()]
        except Exception:
            return []


class ShrineBaseSerializer(_DistanceFieldsMixin, _DeityMixin, serializers.ModelSerializer):
    goriyaku_tags = GoriyakuTagSerializer(many=True, read_only=True)
    is_favorite = serializers.BooleanField(read_only=True)
    distance = serializers.SerializerMethodField(read_only=True)
    distance_text = serializers.SerializerMethodField(read_only=True)
    location = serializers.SerializerMethodField(read_only=True)

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_location(self, obj):
        d = to_lat_lng_dict(getattr(obj, "location", None))
        if d is not None:
            return d
        if getattr(obj, "latitude", None) is not None and getattr(obj, "longitude", None) is not None:
            return {"lat": float(obj.latitude), "lng": float(obj.longitude)}
        return None


class ShrineListSerializer(ShrineBaseSerializer):
    class Meta:
        model = Shrine
        fields = [
            "id",
            "kind",
            "name_jp",
            "address",
            "latitude",
            "longitude",
            "goriyaku_tags",
            "deities",
            "is_favorite",
            "distance",
            "distance_text",
            "location",
            "kyusei",
        ]
        read_only_fields = (
            "latitude",
            "longitude",
            "location",
            "created_at",
            "updated_at",
        )


class ShrineDetailSerializer(ShrineBaseSerializer):
    class Meta:
        model = Shrine
        fields = [
            "id",
            "kind",
            "name_jp",
            "name_romaji",
            "address",
            "latitude",
            "longitude",
            "goriyaku",
            "goriyaku_tags",
            "deities",
            "is_favorite",
            "distance",
            "distance_text",
            "location",
            "kyusei",
        ]


# 互換名
ShrineSerializer = ShrineDetailSerializer


class VisitSerializer(serializers.ModelSerializer):
    shrine = ShrineListSerializer(read_only=True)

    class Meta:
        model = Visit
        fields = ["id", "shrine", "visited_at", "note", "status"]


__all__ = [
    "ShrineSerializer",
    "ShrineListSerializer",
    "ShrineDetailSerializer",
    "GoriyakuTagSerializer",
    "VisitSerializer",
]
