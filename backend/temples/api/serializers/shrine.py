from typing import Optional

from rest_framework import serializers
from temples.models import GoriyakuTag, Shrine, Visit


class GoriyakuTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoriyakuTag
        fields = ["id", "name", "category"]


class _AddressValidationMixin:
    def validate_address(self, v):
        v = (v or "").strip()
        if not v:
            raise serializers.ValidationError("住所は必須です。")
        return v


class _DistanceFieldsMixin:
    def _distance_m(self, obj) -> Optional[float]:
        d = getattr(obj, "distance", None)
        if d is None:
            return None
        try:
            return float(getattr(d, "m", d))  # Distance/DistanceSphere or float
        except Exception:
            return None

    def get_distance(self, obj) -> Optional[float]:
        m = self._distance_m(obj)
        return None if m is None else round(m, 1)

    def get_distance_text(self, obj) -> Optional[str]:
        m = self._distance_m(obj)
        if m is None:
            return None
        return f"{int(round(m))} m" if m < 1000 else f"{m/1000:.1f} km"


# === 一覧
class ShrineListSerializer(
    _AddressValidationMixin, _DistanceFieldsMixin, serializers.ModelSerializer
):
    goriyaku_tags = GoriyakuTagSerializer(many=True, read_only=True)
    is_favorite = serializers.BooleanField(read_only=True)  # ← annotation で埋める
    distance = serializers.SerializerMethodField(read_only=True)
    distance_text = serializers.SerializerMethodField(read_only=True)
    location = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Shrine
        fields = [
            "id",
            "name_jp",
            "address",
            "latitude",
            "longitude",
            "goriyaku_tags",
            "is_favorite",
            "distance",
            "distance_text",
            "location",
        ]
        read_only_fields = (
            "latitude",
            "longitude",
            "location",
            "created_at",
            "updated_at",
        )

    def get_location(self, obj):
        loc = getattr(obj, "location", None)
        if not loc:
            return None
        return {"lat": float(loc.y), "lng": float(loc.x)}  # GEOS: y=lat, x=lng


# === 詳細
class ShrineDetailSerializer(
    _AddressValidationMixin, _DistanceFieldsMixin, serializers.ModelSerializer
):
    goriyaku_tags = GoriyakuTagSerializer(many=True, read_only=True)
    is_favorite = serializers.BooleanField(read_only=True)  # ← annotation で埋める
    distance = serializers.SerializerMethodField(read_only=True)
    distance_text = serializers.SerializerMethodField(read_only=True)
    location = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Shrine
        fields = [
            "id",
            "name_jp",
            "name_romaji",
            "address",
            "latitude",
            "longitude",
            "goriyaku",
            "goriyaku_tags",
            "is_favorite",
            "distance",
            "distance_text",
            "location",
            # 詳細は必要なら created_at/updated_at を戻してOK
            # "created_at", "updated_at",
        ]

    def get_location(self, obj):
        loc = getattr(obj, "location", None)
        if not loc:
            return None
        return {"lat": float(loc.y), "lng": float(loc.x)}


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
