from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from temples.models import Favorite

class FavoriteSerializer(serializers.ModelSerializer):
    # user はリクエストユーザーで自動セット
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Favorite
        fields = ["id", "user", "shrine", "created_at"]
        read_only_fields = ["id", "created_at"]
        validators = [
            UniqueTogetherValidator(
                queryset=Favorite.objects.all(),
                fields=["user", "shrine"],
                message="This shrine is already in your favorites.",
            )
        ]
