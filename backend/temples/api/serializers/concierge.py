from rest_framework import serializers
from temples.models import ConciergeHistory

class GoriyakuTagMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()

class ShrineNearbySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name_jp = serializers.CharField()
    address = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    distance_m = serializers.FloatField(required=False)
    goriyaku_tags = GoriyakuTagMiniSerializer(many=True, required=False)

class OriginSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    label = serializers.CharField(required=False, allow_blank=True)

# クエリ（GET）用：/api/concierge/recommendations
class ConciergeRecommendationsQuery(serializers.Serializer):
    lat = serializers.FloatField(required=False)
    lng = serializers.FloatField(required=False)
    q = serializers.CharField(required=False, allow_blank=True)
    theme = serializers.CharField(required=False, allow_blank=True)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=10, default=3)

class ConciergeRecommendationsResponse(serializers.Serializer):
    origin = OriginSerializer(required=False)
    results = ShrineNearbySerializer(many=True)
    message = serializers.CharField(required=False, allow_blank=True)

# （将来AI診断フォームは別エンドポイントで）
# class ConciergePreferenceSerializer(serializers.Serializer):
#     birth_year = serializers.IntegerField(required=True)
#     birth_month = serializers.IntegerField(required=False, min_value=1, max_value=12)
#     birth_day = serializers.IntegerField(required=False, min_value=1, max_value=31)
#     theme = serializers.CharField(required=False, allow_blank=True)

class ConciergeHistorySerializer(serializers.ModelSerializer):
    shrine_name = serializers.CharField(source="shrine.name_jp", read_only=True)

    class Meta:
        model = ConciergeHistory
        fields = ["id", "shrine", "shrine_name", "reason", "tags", "created_at"]
