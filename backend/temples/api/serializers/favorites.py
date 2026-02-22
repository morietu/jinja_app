# backend/temples/api/serializers/favorites.py
from __future__ import annotations

from typing import Any, Optional

from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes

from temples.models import Favorite, PlaceRef, Shrine
from temples.services.places import get_or_sync_place
from temples.api.serializers.validators import validate_google_place_id_strict



class ShrineLiteSerializer(serializers.Serializer):
    id = serializers.IntegerField()


class FavoriteSerializer(serializers.ModelSerializer):
    shrine = ShrineLiteSerializer(read_only=True)
    place = serializers.SerializerMethodField()

    class Meta:
        model = Favorite
        fields = ["id", "shrine", "place_id", "place", "created_at"]

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_place(self, obj) -> Optional[dict[str, Any]]:
        if not obj.place_id:
            return None

        ctx_places = self.context.get("places") or {}
        pr = ctx_places.get(obj.place_id)

        if pr is None:
            pr = (
                PlaceRef.objects.filter(place_id=obj.place_id)
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
        raw = (self.initial_data or {}) if isinstance(self.initial_data, dict) else {}
        ttype = raw.get("target_type") or raw.get("targetType")
        tid = raw.get("target_id") or raw.get("targetId")

        if ttype and tid and not attrs.get("shrine") and not raw.get("place_id"):
            t = str(ttype).strip().lower()
            if t == "shrine":
                try:
                    attrs["shrine"] = Shrine.objects.get(pk=int(tid))
                except Exception:
                    raise serializers.ValidationError({"shrine_id": "invalid shrine_id"})
            elif t == "place":
                raw["place_id"] = str(tid)
            else:
                raise serializers.ValidationError({"target_type": "invalid target_type"})

        has_shrine = attrs.get("shrine") is not None
        pid = raw.get("place_id")
        has_place = bool(pid)

        if not (has_shrine or has_place):
            raise serializers.ValidationError("either shrine_id or place_id is required")

        if has_place:
            # ★ここが重要：確定した place_id を attrs に入れる
            attrs["place_id"] = validate_google_place_id_strict(str(pid))

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user

        if validated_data.get("shrine") is not None:
            obj, _ = Favorite.objects.get_or_create(user=user, shrine=validated_data["shrine"])
            return obj

        pid = validated_data["place_id"]  # ★rawじゃなくvalidated
        get_or_sync_place(pid)
        obj, _ = Favorite.objects.get_or_create(user=user, place_id=pid)
        return obj
