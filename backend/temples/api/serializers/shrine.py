from rest_framework import serializers
from temples.models import Shrine, Visit, GoriyakuTag
from temples.models import Shrine, Visit, GoriyakuTag, Favorite

class GoriyakuTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoriyakuTag
        fields = ["id", "name", "category"]


# 一覧用（軽量）
class ShrineListSerializer(serializers.ModelSerializer):
    goriyaku_tags = GoriyakuTagSerializer(many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()
    
    class Meta:
        model = Shrine
        fields = [
            "id",
            "name_jp",
            "address",
            "latitude",
            "longitude",
            "goriyaku",
            "sajin",
            "description",
            "goriyaku_tags",
            "is_favorite",
        ]

    def get_is_favorite(self, obj):
        user = self.context["request"].user
        if user.is_authenticated:
            return Favorite.objects.filter(user=user, shrine=obj).exists()
        return False


# 詳細用（リッチ）
class ShrineDetailSerializer(serializers.ModelSerializer):
    goriyaku_tags = GoriyakuTagSerializer(many=True, read_only=True)

    class Meta:
        model = Shrine
        fields = "__all__"
    
    is_favorite = serializers.SerializerMethodField()
    
    def get_is_favorite(self, obj):
        user = self.context["request"].user
        if user.is_authenticated:
            return Favorite.objects.filter(user=user, shrine=obj).exists()
        return False

class VisitSerializer(serializers.ModelSerializer):
    shrine = ShrineListSerializer(read_only=True)

    class Meta:
        model = Visit
        fields = ["id", "shrine", "visited_at", "note", "status"]


