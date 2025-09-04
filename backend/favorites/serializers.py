from rest_framework import serializers
from .models import Favorite

class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = ["id", "shrine", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        # ログイン本人に固定（重複は get_or_create で吸収）
        obj, _ = Favorite.objects.get_or_create(
            user=self.context["request"].user, **validated_data
        )
        return obj
