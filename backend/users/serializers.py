from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import UserProfile

User = get_user_model()


class MeSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(source="profile.nickname", allow_blank=True, required=False)
    is_public = serializers.BooleanField(source="profile.is_public", required=False)
    bio = serializers.CharField(
        source="profile.bio", allow_blank=True, allow_null=True, required=False
    )
    icon = serializers.ImageField(source="profile.icon", allow_null=True, required=False)
    created_at = serializers.DateTimeField(source="profile.created_at", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "nickname",
            "is_public",
            "bio",
            "icon",
            "created_at",
        )

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})
        # ユーザー本体の更新（email など）
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # プロファイル更新/作成
        profile, _ = UserProfile.objects.get_or_create(user=instance)
        for attr, value in profile_data.items():
            setattr(profile, attr, value)
        profile.save()

        return instance
