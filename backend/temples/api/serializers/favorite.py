# backend/temples/api/serializers/favorite.py
from typing import Any, Dict

from rest_framework import serializers
from temples.models import Favorite, Shrine


class ShrineMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shrine
        fields = ("id", "name_jp", "latitude", "longitude")


class FavoriteUpsertSerializer(serializers.Serializer):
    """POST /api/favorites/ 用のアップサート（idempotent）"""

    shrine_id = serializers.IntegerField(min_value=1)

    def validate_shrine_id(self, value: int) -> int:
        if not Shrine.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Shrine not found")
        return value

    def create(self, validated_data: Dict[str, Any]) -> Favorite:
        user = self.context["request"].user
        shrine = Shrine.objects.get(pk=validated_data["shrine_id"])
        fav, _ = Favorite.objects.get_or_create(user=user, shrine=shrine)
        return fav


class FavoriteSerializer(serializers.ModelSerializer):
    """GET レスポンス & POST（idempotent）兼用"""

    shrine = ShrineMiniSerializer(read_only=True)
    shrine_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Favorite
        fields = ("id", "shrine", "shrine_id", "created_at")
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        # POST では shrine_id 必須
        if not attrs.get("shrine_id") and not self.initial_data.get("shrine_id"):
            raise serializers.ValidationError({"shrine_id": "This field is required."})
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        assert request and request.user and request.user.is_authenticated, "auth required"

        shrine_id = validated_data.pop("shrine_id", None) or self.initial_data.get("shrine_id")
        try:
            shrine = Shrine.objects.get(pk=shrine_id)
        except Shrine.DoesNotExist as err:
            raise serializers.ValidationError({"shrine_id": "Shrine not found."}) from err

        # idempotent: 既存があればそれを返す
        fav, _created = Favorite.objects.get_or_create(user=request.user, shrine=shrine)
        return fav
