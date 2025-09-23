# backend/temples/api/serializers/favorites.py

import re

from rest_framework import serializers

from temples.models import Favorite, PlaceRef, Shrine
from temples.services.places import get_or_sync_place

PLACE_ID_RE = re.compile(r"^[A-Za-z0-9._=-]{10,200}$")


class ShrineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shrine
        fields = ["id", "name_jp", "address", "latitude", "longitude"]


class FavoriteSerializer(serializers.ModelSerializer):
    shrine = ShrineSerializer(read_only=True)
    place = serializers.SerializerMethodField()

    class Meta:
        model = Favorite
        fields = ["id", "shrine", "place", "place_id", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_place(self, obj):
        if not obj.place_id:
            return None

        # ★ api_views から渡された一括ロード結果を優先
        ctx_places = self.context.get("places") or {}
        pr = ctx_places.get(obj.place_id)

        # フォールバック（単体取得：N+1は list() 側で回避済み）
        if pr is None:
            pr = (
                PlaceRef.objects.filter(pk=obj.place_id)
                .only("place_id", "name", "address", "latitude", "longitude")
                .first()
            )
            if pr is None:
                return None

        return {
            "place_id": pr.place_id,
            "name": pr.name,
            "address": pr.address,
            "location": {"lat": pr.latitude, "lng": pr.longitude},
        }


class FavoriteUpsertSerializer(serializers.ModelSerializer):
    shrine_id = serializers.PrimaryKeyRelatedField(
        queryset=Shrine.objects.all(), source="shrine", write_only=True, required=False
    )
    place_id = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Favorite
        fields = ["id", "shrine_id", "place_id", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        has_shrine = attrs.get("shrine") is not None
        pid = (self.initial_data or {}).get("place_id")
        has_place = bool(pid)
        if not (has_shrine or has_place):
            raise serializers.ValidationError("either shrine_id or place_id is required")
        if has_place and not PLACE_ID_RE.match(pid):
            raise serializers.ValidationError("invalid place_id format")
        return attrs

    def create(self, validated):
        user = self.context["request"].user
        if validated.get("shrine") is not None:
            obj, _ = Favorite.objects.get_or_create(user=user, shrine=validated["shrine"])
            return obj
        pid = self.initial_data.get("place_id")
        get_or_sync_place(pid)
        obj, _ = Favorite.objects.get_or_create(user=user, place_id=pid)
        return obj
