from rest_framework import serializers
from temples.models import ConciergeHistory

class ConciergeRequestSerializer(serializers.Serializer):
    birth_year = serializers.IntegerField(required=True)
    birth_month = serializers.IntegerField(required=False)
    birth_day = serializers.IntegerField(required=False)
    theme = serializers.CharField(required=False, allow_blank=True)

class ConciergeHistorySerializer(serializers.ModelSerializer):
    shrine_name = serializers.CharField(source="shrine.name_jp", read_only=True)

    class Meta:
        model = ConciergeHistory
        fields = ["id", "shrine", "shrine_name", "reason", "tags", "created_at"]
