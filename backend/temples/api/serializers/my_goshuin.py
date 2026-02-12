# backend/temples/api/serializers/my_goshuin.py
from __future__ import annotations

from django.conf import settings
from rest_framework import serializers

from temples.api.serializers.validators import validate_image_file
from temples.models import Goshuin, GoshuinImage


MAX_GOSHUIN_IMAGE_BYTES = getattr(settings, "GOSHUIN_IMAGE_MAX_BYTES", 10 * 1024 * 1024)

# ct は小文字で統一
ALLOWED_GOSHUIN_IMAGE_CT = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_GOSHUIN_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}

class MyGoshuinCreateSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(write_only=True)

    class Meta:
        model = Goshuin
        fields = ["id", "shrine", "title", "is_public", "image"]
        read_only_fields = ["id"]

    def validate_image(self, f):
        validate_image_file(
            f,
            allowed_ct=ALLOWED_GOSHUIN_IMAGE_CT,
            allowed_formats=ALLOWED_GOSHUIN_IMAGE_FORMATS,
            max_bytes=MAX_GOSHUIN_IMAGE_BYTES,
        )
        return f

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user

        image_file = validated_data.pop("image")
        goshuin = Goshuin.objects.create(user=user, **validated_data)

        GoshuinImage.objects.create(
            goshuin=goshuin,
            image=image_file,
            order=0,
            size_bytes=getattr(image_file, "size", 0) or 0,
        )
        return goshuin
