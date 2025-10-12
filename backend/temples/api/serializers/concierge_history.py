from rest_framework import serializers
from temples.models import ConciergeHistory


class ConciergeHistorySerializer(serializers.ModelSerializer):
    # 外部I/Fは以前どおり 'query' で返すが、実体は 'reason'
    query = serializers.CharField(source="reason")
    # shrine は読み取り専用の主キー（必要に応じて StringRelatedField 等に）
    shrine = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ConciergeHistory
        fields = ["id", "created_at", "query", "tags", "shrine"]
