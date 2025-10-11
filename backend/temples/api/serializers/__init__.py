# backend/temples/api/serializers/__init__.py
from __future__ import annotations

from django.apps import apps
from rest_framework import serializers


def _get_model_or_none(app_label: str, model_name: str):
    try:
        # require_ready=False は「起動準備前でも可」の意味であり、
        # 「存在しないモデルなら LookupError」は依然として発生するため捕捉する。
        return apps.get_model(app_label, model_name, require_ready=False)
    except Exception:
        return None


# -- モデルを“遅延取得”し、見つからなければ None --
Shrine = _get_model_or_none("temples", "Shrine")
Favorite = _get_model_or_none("temples", "Favorite")
PlaceRef = _get_model_or_none("temples", "PlaceRef")

# ========== Shrine ==========
if Shrine is not None:

    class ShrineSerializer(serializers.ModelSerializer):
        class Meta:
            model = Shrine
            fields = ["id", "name_jp", "address", "latitude", "longitude"]

else:
    # フォールバック（読み取り専用の形だけ提供）
    class ShrineSerializer(serializers.Serializer):
        id = serializers.IntegerField(read_only=True)
        name_jp = serializers.CharField(read_only=True, allow_null=True)
        address = serializers.CharField(read_only=True, allow_null=True)
        latitude = serializers.FloatField(read_only=True, allow_null=True)
        longitude = serializers.FloatField(read_only=True, allow_null=True)


# ========== Favorite（GET/LIST 用）==========
if Favorite is not None:

    class FavoriteSerializer(serializers.ModelSerializer):
        shrine = ShrineSerializer(read_only=True)
        place = serializers.SerializerMethodField()

        class Meta:
            model = Favorite
            fields = ["id", "shrine", "place", "place_id", "created_at"]
            read_only_fields = ["id", "created_at"]

        def get_place(self, obj):
            pid = getattr(obj, "place_id", None)
            if not pid or PlaceRef is None:
                return None
            pr = (
                PlaceRef.objects.filter(pk=pid)
                .only("place_id", "name", "address", "latitude", "longitude")
                .first()
            )
            if not pr:
                return None
            return {
                "place_id": pr.place_id,
                "name": pr.name,
                "address": pr.address,
                "location": {"lat": pr.latitude, "lng": pr.longitude},
            }

else:
    # フォールバック（構造だけ維持）
    class FavoriteSerializer(serializers.Serializer):
        id = serializers.IntegerField(read_only=True)
        shrine = ShrineSerializer(read_only=True)
        place = serializers.JSONField(read_only=True)
        place_id = serializers.CharField(read_only=True)
        created_at = serializers.DateTimeField(read_only=True)


# ========== Favorite（作成/更新）==========
if Favorite is not None:

    class FavoriteUpsertSerializer(serializers.ModelSerializer):
        # Shrine があれば queryset、無ければ後で validate で弾く
        shrine_id = serializers.PrimaryKeyRelatedField(
            queryset=(Shrine.objects.all() if Shrine is not None else None),
            source="shrine",
            write_only=True,
            required=False,
            allow_null=True,
        )
        place_id = serializers.CharField(write_only=True, required=False)

        class Meta:
            model = Favorite
            fields = ["id", "shrine_id", "place_id", "created_at"]
            read_only_fields = ["id", "created_at"]

        def validate(self, attrs):
            has_shrine = attrs.get("shrine") is not None
            pid = (self.initial_data.get("place_id") or "").strip()
            has_place = bool(pid)
            if not (has_shrine or has_place):
                raise serializers.ValidationError("either shrine_id or place_id is required")
            if has_shrine and has_place:
                attrs["_ignore_place_id"] = True
            return attrs

        def create(self, validated):
            user = self.context["request"].user

            # shrine を優先（互換）
            if validated.get("shrine") is not None:
                obj, _ = Favorite.objects.get_or_create(user=user, shrine=validated["shrine"])
                return obj

            # place_id 側（関数内 import で依存を遅延）
            pid = (self.initial_data.get("place_id") or "").strip()
            if pid and not validated.get("_ignore_place_id"):
                try:
                    from temples.services.places import get_or_sync_place

                    get_or_sync_place(pid)  # PlaceRef 作成/更新（存在すれば）
                except Exception:
                    # services 側が未配置でも作成自体は通す
                    pass
                obj, _ = Favorite.objects.get_or_create(user=user, place_id=pid)
                return obj

            # ここには来ない想定（validate 済み）
            raise serializers.ValidationError("invalid payload")

else:

    class FavoriteUpsertSerializer(serializers.Serializer):
        shrine_id = serializers.IntegerField(required=False, allow_null=True)
        place_id = serializers.CharField(required=False, allow_blank=True)

        def validate(self, attrs):
            raise serializers.ValidationError("Favorites API is not available on this build.")
