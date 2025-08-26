from rest_framework import serializers
from .models import Shrine, Visit, GoriyakuTag

class GoriyakuTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoriyakuTag
        fields = ["id", "name"]

class ShrineSerializer(serializers.ModelSerializer):
    goriyaku_tags = GoriyakuTagSerializer(many=True, read_only=True)

    class Meta:
        model = Shrine
        fields = "__all__"   # 神社一覧・詳細・Visit参照 共通利用

class VisitSerializer(serializers.ModelSerializer):
    shrine = ShrineSerializer(read_only=True)

    class Meta:
        model = Visit
        fields = ["id", "shrine", "visited_at", "note", "status"]
