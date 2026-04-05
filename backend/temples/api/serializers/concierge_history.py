from rest_framework import serializers
from temples.models import ConciergeHistory
from temples.models import ConciergeThread, ConciergeMessage


class ConciergeHistorySerializer(serializers.ModelSerializer):
    # 外部I/Fは以前どおり 'query' で返すが、実体は 'reason'
    query = serializers.CharField(source="reason")
    # shrine は読み取り専用の主キー（必要に応じて StringRelatedField 等に）
    shrine = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ConciergeHistory
        fields = ["id", "created_at", "query", "tags", "shrine"]


class ConciergeThreadListSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ConciergeThread
        fields = [
            "id",
            "title",
            "last_message",
            "created_at",
            "updated_at",
            "last_message_at",
            "message_count",
        ]

    def get_last_message(self, obj) -> str:
        msg = getattr(obj, "_last_message", None)
        if msg is not None:
            return msg
        # Fallback（N=20 くらいなら許容）
        last = obj.messages.order_by("-created_at").first()
        return last.content if last else ""

    def get_message_count(self, obj) -> int:
        cnt = getattr(obj, "_message_count", None)
        if cnt is not None:
            return cnt
        return obj.messages.count()


class ConciergeMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConciergeMessage
        fields = ["id", "role", "content", "created_at"]


class ConciergeThreadDetailSerializer(serializers.ModelSerializer):
    messages = ConciergeMessageSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ConciergeThread
        fields = [
            "id",
            "title",
            "created_at",
            "updated_at",
            "last_message_at",
            "message_count",
            "messages",
        ]

    def get_message_count(self, obj) -> int:
        return obj.messages.count()
