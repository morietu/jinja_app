# temples/api/serializers/shrine.py
from rest_framework import serializers
from temples.models import Favorite, GoriyakuTag, Shrine, Visit


class GoriyakuTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoriyakuTag
        fields = ["id", "name", "category"]


class _AddressValidationMixin:
    """住所必須 & 前後空白除去の共通化"""

    def validate_address(self, v):
        v = (v or "").strip()
        if not v:
            raise serializers.ValidationError("住所は必須です。")
        return v

    def _get_user(self):
        req = self.context.get("request")
        return getattr(req, "user", None) if req else None


# 一覧用（軽量）
class ShrineListSerializer(_AddressValidationMixin, serializers.ModelSerializer):
    goriyaku_tags = GoriyakuTagSerializer(many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()

    class Meta:
        model = Shrine
        fields = "__all__"  # 明示宣言した SerializerMethodField も含まれる
        read_only_fields = (
            "latitude",
            "longitude",
            "location",
            "created_at",
            "updated_at",
        )

    def get_is_favorite(self, obj):
        user = self._get_user()
        if user and user.is_authenticated:
            return Favorite.objects.filter(user=user, shrine=obj).exists()
        return False


# 詳細用（リッチ）
class ShrineDetailSerializer(_AddressValidationMixin, serializers.ModelSerializer):
    goriyaku_tags = GoriyakuTagSerializer(many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()

    class Meta:
        model = Shrine
        fields = "__all__"
        read_only_fields = (
            "latitude",
            "longitude",
            "location",
            "created_at",
            "updated_at",
        )

    def get_is_favorite(self, obj):
        user = self._get_user()
        if user and user.is_authenticated:
            return Favorite.objects.filter(user=user, shrine=obj).exists()
        return False


class VisitSerializer(serializers.ModelSerializer):
    shrine = ShrineListSerializer(read_only=True)

    class Meta:
        model = Visit
        fields = ["id", "shrine", "visited_at", "note", "status"]
