from rest_framework import serializers
from .models import User   # カスタムユーザーモデルを直接import

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "nickname",
            "bio",
            "icon",
            "is_public",
            "created_at",
        ]
