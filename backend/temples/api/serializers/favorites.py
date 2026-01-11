# backend/temples/api/serializers/favorites.py

import re

from rest_framework import serializers
from temples.models import Favorite, PlaceRef, Shrine
from temples.services.places import get_or_sync_place

PLACE_ID_RE = re.compile(r"^[A-Za-z0-9._=-]{10,200}$")


class ShrineLiteSerializer(serializers.Serializer):
    id = serializers.IntegerField()

class FavoriteSerializer(serializers.ModelSerializer):
    shrine = ShrineLiteSerializer(read_only=True)
    place = serializers.SerializerMethodField()

    class Meta:
        model = Favorite
        fields = ["id", "shrine", "place_id", "place", "created_at"]  # 実フィールドに合わせて調整

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


# backend/temples/api/serializers/favorites.py

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
        # --- compat: e2e の target_type/target_id を吸収 ---
        raw = (self.initial_data or {}) if isinstance(self.initial_data, dict) else {}
        ttype = raw.get("target_type") or raw.get("targetType")
        tid = raw.get("target_id") or raw.get("targetId")

        if ttype and tid and not attrs.get("shrine") and not raw.get("place_id"):
            t = str(ttype).strip().lower()
            if t == "shrine":
                try:
                    attrs["shrine"] = Shrine.objects.get(pk=int(tid))
                except Exception:
                    raise serializers.ValidationError("invalid shrine_id")
            elif t == "place":
                raw["place_id"] = str(tid)
            else:
                raise serializers.ValidationError("invalid target_type")

        has_shrine = attrs.get("shrine") is not None
        pid = raw.get("place_id")
        has_place = bool(pid)

        if not (has_shrine or has_place):
            raise serializers.ValidationError("either shrine_id or place_id is required")
        if has_place and not PLACE_ID_RE.match(str(pid)):
            raise serializers.ValidationError("invalid place_id format")
        return attrs

    def create(self, validated):
        user = self.context["request"].user
        raw = (self.initial_data or {}) if isinstance(self.initial_data, dict) else {}

        if validated.get("shrine") is not None:
            obj, _ = Favorite.objects.get_or_create(user=user, shrine=validated["shrine"])
            return obj

        pid = raw.get("place_id")
        get_or_sync_place(pid)
        obj, _ = Favorite.objects.get_or_create(user=user, place_id=pid)
        return obj
