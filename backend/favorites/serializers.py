from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Favorite


class FavoriteCreateSerializer(serializers.Serializer):
    # temples 側テストは {"shrine_id": s.id} を送る
    # e2e は {"target_type":"shrine","target_id":1} なので両対応
    target_type = serializers.CharField(required=False, default="shrine")
    target_id = serializers.IntegerField(required=False, min_value=1)
    shrine_id = serializers.IntegerField(required=False, min_value=1)

    def validate_target_type(self, v: str) -> str:
        v = (v or "").strip().lower()
        if v != "shrine":
            raise serializers.ValidationError("unsupported type")
        return v

    def validate(self, attrs):
        tid = attrs.get("shrine_id") or attrs.get("target_id")
        if not tid:
            # temples/tests はこのメッセージを期待
            raise serializers.ValidationError({"shrine_id": "この項目は必須です。"})
        attrs["target_id"] = int(tid)
        attrs["target_type"] = "shrine"
        return attrs


class FavoriteSerializer(serializers.ModelSerializer):
    # temples 側は created/一覧 ともに created_json["shrine"]["id"] を見に来る
    shrine = serializers.SerializerMethodField()

    @extend_schema_field({"type": "object", "properties": {"id": {"type": "integer"}}})
    def get_shrine(self, obj) -> dict:
        return {"id": obj.target_id}

    class Meta:
        model = Favorite
        # ※ Favorite に存在するフィールド + 期待される "shrine"
        fields = ("id", "target_type", "target_id", "created_at", "shrine")
        read_only_fields = ("id", "created_at")
