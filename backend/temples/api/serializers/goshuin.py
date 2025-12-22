# 例: temples/api/serializers/goshuin.py
from __future__ import annotations

from rest_framework import serializers
from temples.models import GoshuinImage

MAX_BYTES = 10 * 1024 * 1024  # 10MB（任意で調整）
ALLOWED_CT = {"image/jpeg", "image/png", "image/webp"}

class GoshuinImageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoshuinImage
        fields = ["id", "goshuin", "image", "size_bytes", "created_at"]  # 適宜
        read_only_fields = ["id", "size_bytes", "created_at"]

    def create(self, validated_data):
        img = validated_data.get("image")

        # 1) まずは FieldFile.size で取得（ストレージ対応なら安全）
        size = None
        try:
            if img is not None:
                s = getattr(img, "size", None)
                if isinstance(s, int) and s > 0:
                    size = s
        except Exception:
            size = None

        obj = super().create(validated_data)

        # 2) 保存後に image が確実に紐づいた状態で、size_bytes を確定させる
        if (obj.size_bytes in (None, 0)) and size:
            obj.size_bytes = size
            obj.save(update_fields=["size_bytes"])

        return obj

class GoshuinCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goshuin
        fields = ["id", "image", "is_public", "shrine"]  # shrine が無ければ削除
        read_only_fields = ["id"]

    def validate_image(self, f):
        # content_type は環境によって付かないことがあるので “あれば” チェック
        ct = getattr(f, "content_type", None)
        if ct and ct not in ALLOWED_CT:
            raise serializers.ValidationError("Unsupported image type.")
        if getattr(f, "size", 0) and f.size > MAX_BYTES:
            raise serializers.ValidationError("Image too large.")
        return f

    def create(self, validated_data):
        req = self.context["request"]
        # user は必ずサーバ側で付与
        return Goshuin.objects.create(user=req.user, **validated_data)


class GoshuinSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Goshuin
        fields = ["id", "image_url", "is_public", "created_at", "updated_at", "shrine"]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        try:
            return obj.image.url
        except Exception:
            return None


class GoshuinPatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goshuin
        fields = ["is_public"]
