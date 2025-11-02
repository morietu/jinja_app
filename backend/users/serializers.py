# backend/users/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            "nickname",
            "is_public",
            "bio",
            "icon",  # Image/FileField ならこのままでOK（URLを出したければ後述）
            "icon_url",  # モデルに無ければコメントアウト or SerializerMethodField に変更
            "birthday",
            "location",
            "website",
            "created_at",
        )
        read_only_fields = ("created_at",)
        extra_kwargs = {
            "nickname": {"required": False, "allow_null": True, "allow_blank": True},
            "bio": {"required": False, "allow_null": True, "allow_blank": True},
            "icon": {"required": False, "allow_null": True},
            "icon_url": {"required": False, "allow_null": True, "read_only": True},
            "birthday": {"required": False, "allow_null": True},
            "location": {"required": False, "allow_null": True, "allow_blank": True},
            "website": {"required": False, "allow_null": True, "allow_blank": True},
        }

    # ★モデルに icon_url フィールドが無い場合はこれを使う：
    # icon_url = serializers.SerializerMethodField()
    # def get_icon_url(self, obj):
    #     try:
    #         return obj.icon.url if obj.icon else None
    #     except Exception:
    #         return None


class MeSerializer(serializers.ModelSerializer):
    # related_name が "profile" の場合。違うなら "userprofile" に変更
    profile = UserProfileSerializer(source="profile", required=False, allow_null=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "profile")

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        # ユーザー本体（email 等）が来た場合に備えて
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if profile_data is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return instance
