from django.contrib.auth import get_user_model
from rest_framework import serializers
from users.models import UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("nickname", "is_public", "bio")
        extra_kwargs = {
            "nickname": {"required": False, "allow_null": True, "allow_blank": True},
            "bio": {"required": False, "allow_null": True, "allow_blank": True},
            "is_public": {"required": False},
        }


class MeSerializer(serializers.ModelSerializer):
    nickname = serializers.SerializerMethodField()
    is_public = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    icon = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source="date_joined", read_only=True)
    profile = serializers.SerializerMethodField()

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
            "profile",
        )

    # ---- helpers ----
    @staticmethod
    def _profile_of(user):
        # related_name の有無に関係なく **DB検索で確実に取得**
        return UserProfile.objects.filter(user=user).first()

    # ---- getters (read) ----
    def get_nickname(self, obj):
        p = self._profile_of(obj)
        return p.nickname if (p and p.nickname not in (None, "")) else obj.username

    def get_is_public(self, obj):
        p = self._profile_of(obj)
        return bool(p.is_public) if p else False

    def get_bio(self, obj):
        p = self._profile_of(obj)
        return p.bio if p else None

    def get_icon(self, obj):
        p = self._profile_of(obj)
        return p.icon.url if (p and getattr(p, "icon", None)) else None

    def get_profile(self, obj):
        p = self._profile_of(obj)
        return UserProfileSerializer(p).data if p else None

    # ---- update (write) ----
    def update(self, instance, validated_data):
        """
        flat（nickname/bio/is_public/email）と
        nested（profile: {nickname, bio, is_public}）の両方を受け付ける。
        SerializerMethodField は write 不可なので initial_data を参照。
        """
        data = dict(getattr(self, "initial_data", {}) or {})

        # nested -> flat 吸収
        profile_in = data.get("profile") or {}
        if isinstance(profile_in, dict):
            for k in ("nickname", "bio", "is_public"):
                if k in profile_in and k not in data:
                    data[k] = profile_in[k]

        # User 側
        if "email" in data:
            instance.email = data["email"]
            instance.save(update_fields=["email"])

        # Profile 側
        prof, _ = UserProfile.objects.get_or_create(user=instance)
        changed = False
        if "nickname" in data:
            prof.nickname = data["nickname"]
            changed = True
        if "bio" in data:
            prof.bio = data["bio"]
            changed = True
        if "is_public" in data:
            prof.is_public = bool(data["is_public"])
            changed = True
        if changed:
            prof.save()

        return instance
