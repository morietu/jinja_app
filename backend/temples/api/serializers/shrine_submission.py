from __future__ import annotations

from rest_framework import serializers

from temples.models import ShrineSubmission
from temples.services.shrine_submission import check_submission_duplicates


class ShrineSubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShrineSubmission
        fields = [
            "id",
            "name",
            "address",
            "lat",
            "lng",
            "goriyaku_tags",
            "note",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_at",
        ]

    def validate_goriyaku_tags(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("goriyaku_tags は配列で指定してください。")
        return value

    def validate(self, attrs):
        name = (attrs.get("name") or "").strip()
        address = (attrs.get("address") or "").strip()
        lat = attrs.get("lat")
        lng = attrs.get("lng")

        if not name:
            raise serializers.ValidationError({"name": ["この項目は必須です。"]})

        if not address:
            raise serializers.ValidationError({"address": ["この項目は必須です。"]})

        if (lat is None) != (lng is None):
            raise serializers.ValidationError(
                {"non_field_errors": ["lat と lng は両方指定するか、両方省略してください。"]}
            )

        duplicate = check_submission_duplicates(
            name=name,
            address=address,
        )

        if duplicate.exists_in_shrine:
            raise serializers.ValidationError(
                {"non_field_errors": ["既存の神社と重複しています。"]}
            )

        if duplicate.exists_in_pending_submission:
            raise serializers.ValidationError(
                {"non_field_errors": ["同じ神社の審査中投稿が既に存在します。"]}
            )

        attrs["name"] = name
        attrs["address"] = address
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        return ShrineSubmission.objects.create(
            user=user,
            status=ShrineSubmission.Status.PENDING,
            **validated_data,
        )
