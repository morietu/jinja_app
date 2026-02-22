from __future__ import annotations

from django.conf import settings
from rest_framework import serializers

from temples.models import Goshuin, GoshuinImage
from temples.api.serializers.validators import validate_image_file
from typing import Optional
from drf_spectacular.utils import extend_schema_field, OpenApiTypes

MAX_BYTES = getattr(settings, "GOSHUIN_IMAGE_MAX_BYTES", 10 * 1024 * 1024)
ALLOWED_CT = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


class GoshuinImageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoshuinImage
        fields = ["id", "goshuin", "image", "size_bytes", "created_at"]
        read_only_fields = ["id", "size_bytes", "created_at"]

    def create(self, validated_data):
        img = validated_data.get("image")

        size = None
        try:
            if img is not None:
                s = getattr(img, "size", None)
                if isinstance(s, int) and s > 0:
                    size = s
        except Exception:
            size = None

        obj = super().create(validated_data)

        if (obj.size_bytes in (None, 0)) and size:
            obj.size_bytes = size
            obj.save(update_fields=["size_bytes"])

        return obj


class GoshuinCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goshuin
        fields = ["id", "image", "is_public", "shrine"]
        read_only_fields = ["id"]

    def validate_image(self, f):
        return validate_image_file(
            f,
            allowed_ct=ALLOWED_CT,
            allowed_formats=ALLOWED_FORMATS,
            max_bytes=MAX_BYTES,
        )

    def create(self, validated_data):
        req = self.context["request"]
        return Goshuin.objects.create(user=req.user, **validated_data)


class GoshuinSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Goshuin
        fields = ["id", "image_url", "is_public", "created_at", "updated_at", "shrine"]

    @extend_schema_field(OpenApiTypes.URI)
    def get_image_url(self, obj) -> Optional[str]:
        request = self.context.get("request")

        # 1) 旧: Goshuin.image が存在する環境を吸収
        img_field = getattr(obj, "image", None)
        if img_field:
            try:
                url = img_field.url
                return request.build_absolute_uri(url) if request else url
            except Exception:
                return None

        # 2) 新: GoshuinImage 経由（obj.images）
        images_rel = getattr(obj, "images", None)
        if not images_rel:
            return None

        try:
            img = images_rel.order_by("order", "id").first()
        except Exception:
            return None

        if not img or not getattr(img, "image", None):
            return None

        try:
            url = img.image.url
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None


class GoshuinPatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goshuin
        fields = ["is_public"]
