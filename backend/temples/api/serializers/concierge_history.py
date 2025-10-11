from rest_framework import serializers
from temples.models.concierge import ConciergeHistory


class ConciergeHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ConciergeHistory
        fields = ["id", "query", "response", "meta", "created_at"]
        read_only_fields = ["id", "created_at"]
