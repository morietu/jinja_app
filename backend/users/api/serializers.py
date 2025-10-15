from typing import Optional

from django.contrib.auth import get_user_model
from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from rest_framework import serializers
from users.models import UserProfile

User = get_user_model()


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ("username", "password", "email")

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            email=validated_data.get("email") or "",
        )


class UserProfileSerializer(serializers.ModelSerializer):
    icon = serializers.ImageField(read_only=True)
    icon_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = UserProfile
        # 必要なフィールドを一つに統合（必要に応じて created_at を残す/外す）
        fields = ("nickname", "is_public", "bio", "icon", "icon_url", "created_at")
        read_only_fields = ("icon", "icon_url", "created_at")

    @extend_schema_field(OpenApiTypes.URI)
    def get_icon_url(self, obj) -> Optional[str]:  # ← 引数の型注釈は外すのが安定
        request = self.context.get("request")
        try:
            if obj.icon and obj.icon.name:
                url = obj.icon.url
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
