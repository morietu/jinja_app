# 例: temples/api/serializers/goshuin.py

from rest_framework import serializers
from temples.models import GoshuinImage

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
