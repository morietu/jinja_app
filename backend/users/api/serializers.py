# backend/users/api/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers
from users.models import UserProfile

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    # 未設定なら None を返し、設定済みなら URL を返す（DRF の ImageField は安全）
    icon = serializers.ImageField(read_only=True)

    # 絶対URLが欲しい場合は icon_url を別途足す
    icon_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ("nickname", "is_public", "bio", "icon", "icon_url", "created_at")

    def get_icon_url(self, obj):
        request = self.context.get("request")
        try:
            if obj.icon and obj.icon.name:  # ファイル名がある時だけ
                url = obj.icon.url  # ここは安全に評価される
                return request.build_absolute_uri(url) if request else url
        except Exception:
            pass
        return None


class UserMeSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "profile")

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("nickname", "is_public", "bio", "icon")
