from rest_framework import serializers

from temples.models import Favorite, PlaceRef, Shrine
from temples.services.places import get_or_sync_place


# --- Shrine を素直に読むためのシリアライザ ---
class ShrineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shrine
        fields = ["id", "name_jp", "address", "latitude", "longitude"]


# --- Favorite の読み取り用（GET/LIST で使う）---
class FavoriteSerializer(serializers.ModelSerializer):
    shrine = ShrineSerializer(read_only=True)
    place = serializers.SerializerMethodField()  # shrine が無い（place_id運用）と None になる

    class Meta:
        model = Favorite
        # ↓ "place" を追加
        fields = ["id", "shrine", "place", "place_id", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_place(self, obj):
        if not obj.place_id:
            return None
        pr = (
            PlaceRef.objects.filter(pk=obj.place_id)
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


# --- Favorite の作成/更新用（POST/PUT/PATCH）---
class FavoriteUpsertSerializer(serializers.ModelSerializer):
    # 互換: shrine_id も受ける
    shrine_id = serializers.PrimaryKeyRelatedField(
        queryset=Shrine.objects.all(),
        source="shrine",
        write_only=True,
        required=False,
    )
    # 新規: place_id を受ける（入力専用）
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
        # 両方来た場合は shrine を優先（任意のポリシー）
        if has_shrine and has_place:
            attrs["_ignore_place_id"] = True
        return attrs

    def create(self, validated):
        user = self.context["request"].user

        # shrine 優先（互換）
        if validated.get("shrine") is not None:
            obj, _ = Favorite.objects.get_or_create(user=user, shrine=validated["shrine"])
            return obj

        # place_id の場合：キャッシュ同期後に冪等作成
        pid = (self.initial_data.get("place_id") or "").strip()
        get_or_sync_place(pid)  # PlaceRef を作る/更新する（将来参照のため）
        obj, _ = Favorite.objects.get_or_create(user=user, place_id=pid)
        return obj
