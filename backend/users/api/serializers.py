from django.contrib.auth import get_user_model
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
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            email=validated_data.get("email") or "",
        )
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    icon = serializers.ImageField(read_only=True)
    icon_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ("nickname", "is_public", "bio", "icon", "icon_url", "created_at")

    def get_icon_url(self, obj):
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
