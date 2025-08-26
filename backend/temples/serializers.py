from rest_framework import serializers
from .models import Shrine, Visit, GoriyakuTag


class GoriyakuTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoriyakuTag
        fields = ["id", "name"]


# 一覧用（軽量）
class ShrineListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shrine
        fields = ["id", "name_jp", "address"]


# 詳細用（リッチ）
class ShrineDetailSerializer(serializers.ModelSerializer):
    goriyaku_tags = GoriyakuTagSerializer(many=True, read_only=True)

    class Meta:
        model = Shrine
        fields = "__all__"


class VisitSerializer(serializers.ModelSerializer):
    shrine = ShrineListSerializer(read_only=True)

    class Meta:
        model = Visit
        fields = ["id", "shrine", "visited_at", "note", "status"]
